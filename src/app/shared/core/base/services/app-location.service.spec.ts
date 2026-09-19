import { AppLocationService } from './app-location.service';
import { DialogStore } from '../../../ui/context/stores/dialog.store';

describe('Explicit location request', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('leaves permission decision time to the native API and limits acquisition to ten seconds', async () => {
    vi.useFakeTimers();
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const service = Object.create(AppLocationService.prototype) as AppLocationService;
    const settled = vi.fn();
    const request = service.requestCurrentCoordinates().then(settled);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).not.toHaveBeenCalled();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 });
    getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 47, longitude: 19 } });
    await request;
    expect(settled).toHaveBeenCalledWith({ latitude: 47, longitude: 19 });
  });

  it('finishes without coordinates when the native acquisition times out', async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const service = Object.create(AppLocationService.prototype) as AppLocationService;
    const request = service.requestCurrentCoordinates();
    getCurrentPosition.mock.calls[0][1]({ code: 3 });
    expect(await request).toBeNull();
  });
});

describe('AppLocationService session-owned persistence', () => {
  it('does not persist streamed coordinates for a demo session', () => {
    const service = Object.create(AppLocationService.prototype) as {
      pendingCoordinatesByUserId: Map<string, { latitude: number; longitude: number }>;
      syncingUserIds: Set<string>;
      sessionService: {
        currentSession: () => { kind: 'demo'; userId: string };
      };
      isLocalUserRouteEnabled: ReturnType<typeof vi.fn>;
      flushPendingLocationSync: ReturnType<typeof vi.fn>;
      queueLocationSyncForActiveUser: (
        userId: string,
        activeUser: { id: string; admin: boolean },
        coordinates: { latitude: number; longitude: number }
      ) => void;
    };
    service.pendingCoordinatesByUserId = new Map();
    service.syncingUserIds = new Set();
    service.sessionService = {
      currentSession: () => ({ kind: 'demo', userId: 'demo-member' })
    };
    service.isLocalUserRouteEnabled = vi.fn().mockReturnValue(false);
    service.flushPendingLocationSync = vi.fn();

    service.queueLocationSyncForActiveUser(
      'demo-member',
      { id: 'demo-member', admin: false },
      { latitude: 48.8566, longitude: 2.3522 }
    );

    expect(service.pendingCoordinatesByUserId.size).toBe(0);
    expect(service.flushPendingLocationSync).not.toHaveBeenCalled();
  });
});

describe('Granted location background synchronization', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fixture() {
    let profile = { id: 'member', admin: false, profileStatus: 'active', locationCoordinates: undefined as { latitude: number; longitude: number } | undefined };
    const save = vi.fn().mockImplementation(async user => user);
    const service = Object.assign(Object.create(AppLocationService.prototype), {
      userProfileStore: {
        activeUserId: () => 'member',
        setUserProfile: vi.fn((user: typeof profile) => { profile = user; })
      },
      sessionService: { currentSession: () => ({ kind: 'firebase', profile: { id: 'member' } }) },
      resolveTrackedUser: () => profile,
      isLocalUserRouteEnabled: () => false,
      requestCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
      ensureCoordinateWatch: vi.fn(),
      storeCoordinates: vi.fn(),
      httpUsersService: async () => ({ saveUserProfile: save }),
      pendingCoordinatesByUserId: new Map(),
      lastPersistedCoordinatesByUserId: new Map(),
      primedLocationUserIds: new Set(),
      syncingUserIds: new Set(),
      blockedUserIds: new Set(),
      geolocationWatchId: null,
      geolocationWatchUserId: '',
      dialogStore: new DialogStore(),
      stopCoordinateWatch: vi.fn()
    });
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) } });
    return { service, save, profile: () => profile };
  }

  it('automatically saves a first location delivered by the permitted background watch', async () => {
    const { service, save, profile } = fixture();
    service.handleStreamedCoordinates('member', { latitude: 47, longitude: 19 });
    expect(profile().locationCoordinates).toEqual({ latitude: 47, longitude: 19 });
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(service.dialogStore.dialog()).toBeNull();
  });

  it('allows an explicit save to retry the same coordinates after a network failure', async () => {
    const { service, save, profile } = fixture();
    save.mockRejectedValueOnce(new Error('network unavailable'));
    const coordinates = { latitude: 47, longitude: 19 };
    await expect(service.saveCurrentCoordinates(coordinates)).rejects.toThrow('network unavailable');
    expect(profile().locationCoordinates).toBeUndefined();
    expect(await service.saveCurrentCoordinates(coordinates)).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does not request coordinates or prompt when native permission is not granted', async () => {
    const { service, save } = fixture();
    vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'prompt' } as PermissionStatus);
    await service.syncGrantedLocationForActiveUser();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves the active server profile when its ID differs from the Firebase identity', async () => {
    const { service, save, profile } = fixture();
    service.sessionService.currentSession = () => ({ kind: 'firebase', profile: { id: 'firebase-provider-uid' } });
    const coordinates = { latitude: 47, longitude: 19 };
    expect(await service.saveCurrentCoordinates(coordinates)).toBe(true);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'member', locationCoordinates: coordinates }));
    expect(profile().locationCoordinates).toEqual(coordinates);
    expect(service.isActiveFirebaseMemberSession('another-profile')).toBe(false);
    service.sessionService.currentSession = () => ({ kind: 'demo', userId: 'member' });
    expect(await service.saveCurrentCoordinates(coordinates)).toBe(false);
    expect(save).toHaveBeenCalledOnce();
  });

  it('keeps first coordinates absent until their server save succeeds without another native request', async () => {
    const { service, save, profile } = fixture();
    let complete!: (user: unknown) => void;
    save.mockReturnValue(new Promise(resolve => complete = resolve));
    const coordinates = { latitude: 47, longitude: 19 };
    const saving = service.saveCurrentCoordinates(coordinates);
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(profile().locationCoordinates).toBeUndefined();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(navigator.permissions.query).not.toHaveBeenCalled();
    complete({ ...profile(), locationCoordinates: coordinates });
    expect(await saving).toBe(true);
    expect(profile().locationCoordinates).toEqual(coordinates);
  });

  it('does not unlock missing location after a failed explicit save', async () => {
    const { service, save, profile } = fixture();
    save.mockRejectedValue(new Error('network unavailable'));
    await expect(service.saveCurrentCoordinates({ latitude: 47, longitude: 19 })).rejects.toThrow();
    expect(profile().locationCoordinates).toBeUndefined();
  });

  it('leaves missing server coordinates absent while the background watch is pending', async () => {
    const { service, save, profile } = fixture();
    const watchPosition = vi.fn().mockReturnValue(42);
    const getCurrentPosition = vi.fn();
    Object.assign(navigator, { geolocation: { watchPosition, getCurrentPosition } });
    delete service.ensureCoordinateWatch;

    service.runLocationSyncFlow('member', profile());
    await Promise.resolve();
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(profile().locationCoordinates).toBeUndefined();
    expect(service.userProfileStore.setUserProfile).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the server location at startup without an extra acquisition and updates it from the existing watch', async () => {
    const { service, save, profile } = fixture();
    const original = { latitude: 47, longitude: 19 };
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: original });
    service.userProfileStore.setUserProfile.mockClear();
    const watchPosition = vi.fn().mockReturnValue(42);
    const getCurrentPosition = vi.fn();
    Object.assign(navigator, { geolocation: { watchPosition, getCurrentPosition } });
    delete service.ensureCoordinateWatch;

    service.runLocationSyncFlow('member', profile());
    await Promise.resolve();
    expect(profile().locationCoordinates).toEqual(original);
    expect(service.userProfileStore.setUserProfile).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();

    const next = { latitude: 47.001, longitude: 19 };
    watchPosition.mock.calls[0][0]({ coords: next });
    expect(profile().locationCoordinates).toEqual(next);
    expect(save).not.toHaveBeenCalled();
    service.runLocationSyncFlow('member', profile());
    await Promise.resolve();
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'denied'])('does not start acquisition at startup when permission is %s', async state => {
    const { service, profile } = fixture();
    vi.mocked(navigator.permissions.query).mockResolvedValue({ state } as PermissionStatus);
    const watchPosition = vi.fn();
    const getCurrentPosition = vi.fn();
    Object.assign(navigator, { geolocation: { watchPosition, getCurrentPosition } });
    delete service.ensureCoordinateWatch;
    service.runLocationSyncFlow('member', profile());
    await Promise.resolve();
    expect(watchPosition).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
  });

  it('updates the store immediately and saves automatically at five kilometres from the last server save', async () => {
    const { service, save, profile } = fixture();
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: { latitude: 47, longitude: 19 } });
    const near = { latitude: 47.044, longitude: 19 }; // 4.89 km
    service.handleStreamedCoordinates('member', near);
    expect(profile().locationCoordinates).toEqual(near);
    expect(save).not.toHaveBeenCalled();

    const far = { latitude: 47.046, longitude: 19 }; // 5.11 km from server location
    service.handleStreamedCoordinates('member', far);
    expect(profile().locationCoordinates).toEqual(far);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'member', locationCoordinates: far }));
    expect(service.dialogStore.dialog()).toBeNull();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();

    service.handleStreamedCoordinates('member', far);
    service.handleStreamedCoordinates('member', { latitude: 47.048, longitude: 19 });
    expect(save).toHaveBeenCalledOnce();
  });

  it('retries a failed automatic save using the last successful server location as the distance baseline', async () => {
    const { service, save, profile } = fixture();
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: { latitude: 47, longitude: 19 } });
    save.mockRejectedValueOnce(new Error('network unavailable'));
    const candidate = { latitude: 48, longitude: 20 };
    service.handleStreamedCoordinates('member', candidate);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    expect(save).toHaveBeenCalledOnce();
    expect(profile().locationCoordinates).toEqual(candidate);

    service.runLocationSyncFlow('member', profile());
    service.handleStreamedCoordinates('member', candidate);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    expect(save).toHaveBeenCalledTimes(2);
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(service.dialogStore.dialog()).toBeNull();
  });

  it('ignores a late watch result for a user who is no longer active', () => {
    const { service, save, profile } = fixture();
    service.handleStreamedCoordinates('previous-member', { latitude: 48, longitude: 20 });
    expect(profile().locationCoordinates).toBeUndefined();
    expect(service.storeCoordinates).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

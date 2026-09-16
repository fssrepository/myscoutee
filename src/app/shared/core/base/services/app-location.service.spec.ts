import { AppLocationService } from './app-location.service';

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
        setUserProfile: (user: typeof profile) => { profile = user; }
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
      blockedUserIds: new Set()
    });
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) } });
    return { service, save, profile: () => profile };
  }

  it('sends coordinates when native permission is granted but the server has none', async () => {
    const { service, save } = fixture();
    await service.syncGrantedLocationForActiveUser();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].locationCoordinates).toEqual({ latitude: 47, longitude: 19 });
  });

  it('retries the same coordinates after a failed save instead of treating optimistic state as persisted', async () => {
    const { service, save, profile } = fixture();
    save.mockRejectedValueOnce(new Error('network unavailable'));
    await service.syncGrantedLocationForActiveUser();
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    service.primePersistedCoordinates('member', profile().locationCoordinates);
    await service.syncGrantedLocationForActiveUser();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it('does not request coordinates or prompt when native permission is not granted', async () => {
    const { service, save } = fixture();
    vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'prompt' } as PermissionStatus);
    await service.syncGrantedLocationForActiveUser();
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

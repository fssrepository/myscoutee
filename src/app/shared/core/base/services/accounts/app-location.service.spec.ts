import { appLocationStorageKey, scopedStorageKey } from '../../../common/storage-scope';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AppLocationService } from './app-location.service';
import { DialogStore } from '@fssrepository/myscoutee-components';

describe('Explicit location request', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('uses the native ten-second limit without a competing JavaScript timeout', async () => {
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

  it('waits for native permission without an early timeout and cancels the watch at the owner deadline', async () => {
    vi.useFakeTimers();
    const watchPosition = vi.fn().mockReturnValue(42), clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
    const service = Object.create(AppLocationService.prototype) as AppLocationService;
    const controller = new AbortController(), settled = vi.fn();
    const request = service.requestCurrentCoordinates(controller.signal).then(settled);
    expect(watchPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, maximumAge: 0 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).not.toHaveBeenCalled();
    controller.abort();
    await request;
    expect(settled).toHaveBeenCalledExactlyOnceWith(null);
    expect(clearWatch).toHaveBeenCalledExactlyOnceWith(42);
    watchPosition.mock.calls[0][0]({ coords: { latitude: 47, longitude: 19 } });
    expect(settled).toHaveBeenCalledOnce();
  });

  it.each([1, 2])('stops the one-shot watch on native error %s without retry', async code => {
    const watchPosition = vi.fn().mockReturnValue(42), clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
    const service = Object.create(AppLocationService.prototype) as AppLocationService;
    const controller = new AbortController();
    const request = service.requestCurrentCoordinates(controller.signal);
    watchPosition.mock.calls[0][1]({ code });
    expect(await request).toBeNull();
    controller.abort();
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(clearWatch).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('stops watching after the first coordinates and ignores later updates', async () => {
    const watchPosition = vi.fn().mockReturnValue(42), clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
    const service = Object.create(AppLocationService.prototype) as AppLocationService;
    const controller = new AbortController();
    const request = service.requestCurrentCoordinates(controller.signal);
    watchPosition.mock.calls[0][0]({ coords: { latitude: 47, longitude: 19 } });
    expect(await request).toEqual({ latitude: 47, longitude: 19 });
    controller.abort();
    expect(clearWatch).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('does not start a native request after cancellation', async () => {
    const watchPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition } });
    const service = Object.create(AppLocationService.prototype) as AppLocationService;
    const controller = new AbortController();
    controller.abort();
    expect(await service.requestCurrentCoordinates(controller.signal)).toBeNull();
    expect(watchPosition).not.toHaveBeenCalled();
  });
});

describe('Granted location background synchronization', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fixture() {
    let profile = { id: 'member', admin: false, profileStatus: 'active', locationCoordinates: undefined as { latitude: number; longitude: number } | undefined };
    const save = vi.fn().mockImplementation(async user => user);
    const service = Object.assign(Object.create(AppLocationService.prototype), {
      trackingEnabled: signal(true),
      workspace: { accountId: (id: string) => id },
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
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) } });
    return { service, save, profile: () => profile };
  }

  it('automatically saves a first location delivered by the permitted background watch', async () => {
    const { service, save, profile } = fixture();
    service.handleStreamedCoordinates('member', { latitude: 47, longitude: 19 });
    expect(profile().locationCoordinates).toBeUndefined();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(profile().locationCoordinates).toEqual({ latitude: 47, longitude: 19 });
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

  it('persists permitted demo coordinates before exposing them to the live profile', async () => {
    const { service, save, profile } = fixture();
    service.sessionService.currentSession = () => ({ kind: 'demo', userId: 'member' });
    let complete!: (user: unknown) => void;
    save.mockReturnValue(new Promise(resolve => complete = resolve));
    service.handleStreamedCoordinates('member', { latitude: 47, longitude: 19 });
    expect(profile().locationCoordinates).toBeUndefined();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    complete({ ...profile(), locationCoordinates: { latitude: 47, longitude: 19 } });
    await vi.waitFor(() => expect(profile().locationCoordinates).toEqual({ latitude: 47, longitude: 19 }));
  });

  it('updates an active demo group profile through its owning account', async () => {
    const { service, save } = fixture();
    service.workspace.accountId = () => 'account';
    service.sessionService.currentSession = () => ({ kind: 'demo', userId: 'account' });
    expect(await service.saveCurrentCoordinates({ latitude: 47, longitude: 19 })).toBe(true);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'member' }));
    service.sessionService.currentSession = () => ({ kind: 'demo', userId: 'other-account' });
    expect(await service.saveCurrentCoordinates({ latitude: 48, longitude: 20 })).toBe(false);
    expect(save).toHaveBeenCalledOnce();
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
    expect(service.isActiveMemberSession('another-profile')).toBe(false);
    service.sessionService.currentSession = () => ({ kind: 'demo', userId: 'member' });
    expect(await service.saveCurrentCoordinates(coordinates)).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    service.sessionService.currentSession = () => ({ kind: 'demo', userId: 'another-profile' });
    expect(await service.saveCurrentCoordinates(coordinates)).toBe(false);
    expect(save).toHaveBeenCalledTimes(2);
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

  it('leaves first coordinates to the profile-load flush instead of starting a competing watch', async () => {
    const { service, save, profile } = fixture();
    const watchPosition = vi.fn().mockReturnValue(42);
    const getCurrentPosition = vi.fn();
    Object.assign(navigator, { geolocation: { watchPosition, getCurrentPosition } });
    delete service.ensureCoordinateWatch;

    service.runLocationSyncFlow('member', profile());
    await Promise.resolve();
    expect(watchPosition).not.toHaveBeenCalled();
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
    expect(profile().locationCoordinates).toEqual(original);
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

  it('publishes the saved location after moving five kilometres from the last server save', async () => {
    const { service, save, profile } = fixture();
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: { latitude: 47, longitude: 19 } });
    const near = { latitude: 47.044, longitude: 19 }; // 4.89 km
    service.handleStreamedCoordinates('member', near);
    expect(profile().locationCoordinates).toEqual({ latitude: 47, longitude: 19 });
    expect(save).not.toHaveBeenCalled();

    const far = { latitude: 47.046, longitude: 19 }; // 5.11 km from server location
    service.handleStreamedCoordinates('member', far);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    expect(profile().locationCoordinates).toEqual(far);
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
    expect(profile().locationCoordinates).toEqual({ latitude: 47, longitude: 19 });

    service.runLocationSyncFlow('member', profile());
    service.handleStreamedCoordinates('member', candidate);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    expect(save).toHaveBeenCalledTimes(2);
    expect(service.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(service.dialogStore.dialog()).toBeNull();
  });

  it.each([403, 422])('preserves admitted access and the saved point when a background sample is rejected (%s)', async status => {
    const { service, save, profile } = fixture();
    const stored = { latitude: 47.4979, longitude: 19.0402 };
    const outside = { latitude: 30.2672, longitude: -97.7431 };
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: stored });
    service.userProfileStore.setUserProfile.mockClear();
    service.sessionService.logout = vi.fn();
    save.mockRejectedValueOnce(new HttpErrorResponse({ status, error: { message: 'Region unavailable' } }));

    service.handleStreamedCoordinates('member', outside);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));

    expect(save).toHaveBeenCalledOnce();
    expect(profile().locationCoordinates).toEqual(stored);
    expect(service.lastPersistedCoordinatesByUserId.get('member')).toEqual(stored);
    expect(service.userProfileStore.setUserProfile).not.toHaveBeenCalled();
    expect(service.storeCoordinates).not.toHaveBeenCalled();
    expect(service.dialogStore.dialog()).toBeNull();
    expect(service.sessionService.logout).not.toHaveBeenCalled();
    expect(service.isActiveMemberSession('member')).toBe(true);

    const supported = { latitude: 47.6, longitude: 19.1 };
    service.handleStreamedCoordinates('member', supported);
    await vi.waitFor(() => expect(service.syncingUserIds.size).toBe(0));
    expect(save).toHaveBeenCalledTimes(2);
    expect(profile().locationCoordinates).toEqual(supported);
    expect(service.storeCoordinates).toHaveBeenCalledExactlyOnceWith('member', supported);
  });

  it('does not acknowledge an empty save response or advance the movement baseline', async () => {
    const { service, save, profile } = fixture();
    const stored = { latitude: 47.4979, longitude: 19.0402 };
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: stored });
    save.mockResolvedValueOnce(null);
    expect(await service.saveCurrentCoordinates({ latitude: 47.6, longitude: 19.1 })).toBe(false);
    expect(service.lastPersistedCoordinatesByUserId.get('member')).toEqual(stored);
    expect(service.storeCoordinates).not.toHaveBeenCalled();
    expect(profile().locationCoordinates).toEqual(stored);
  });

  it('stops app tracking and ignores late coordinates without clearing the stored profile', () => {
    const { service, save, profile } = fixture();
    service.userProfileStore.setUserProfile({ ...profile(), locationCoordinates: { latitude: 47, longitude: 19 } });
    service.setTrackingEnabled(false);
    service.handleStreamedCoordinates('member', { latitude: 49, longitude: 21 });
    expect(service.stopCoordinateWatch).toHaveBeenCalled();
    expect(profile().locationCoordinates).toEqual({ latitude: 47, longitude: 19 });
    expect(save).not.toHaveBeenCalled();
  });

  it('ignores a late watch result for a user who is no longer active', () => {
    const { service, save, profile } = fixture();
    service.handleStreamedCoordinates('previous-member', { latitude: 48, longitude: 20 });
    expect(profile().locationCoordinates).toBeUndefined();
    expect(service.storeCoordinates).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('Pending login coordinates', () => {
  beforeEach(async () => {
    localStorage.clear();
    const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto');
    vi.stubGlobal('crypto', webcrypto);
  });
  afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  function fixture() {
    const keys = new Map<string, CryptoKey>();
    const db = {
      readIndexedDbTableEntry: async (key: string) => keys.get(key) ?? null,
      updateIndexedDbTableEntry: async (key: string, update: (value: CryptoKey | null) => CryptoKey) => {
        const value = structuredClone(update(keys.get(key) ?? null));
        keys.set(key, value);
        return structuredClone(value);
      }
    };
    const create = () => Object.assign(Object.create(AppLocationService.prototype), {
      injector: { get: () => db }, pendingLoginByAccount: new Map(),
      locationCacheWrites: new Map(), locationCacheKeyPromise: null, legacyLocationCacheCleared: false
    }) as AppLocationService;
    return { create, keys, db };
  }
  const point = { latitude: 47.497912, longitude: 19.040235 };
  const storageKey = (account: string) => appLocationStorageKey(`${account}:pending-login`);

  it('survives browser reload, stays account-scoped and acknowledges only the sent sample', async () => {
    const { create } = fixture();
    await create().stageLoginCoordinates('one', point);
    const restored = create();
    expect(await restored.pendingLoginCoordinates('one')).toEqual(point);
    expect(await restored.pendingLoginCoordinates('two')).toBeNull();
    const newer = { latitude: 48, longitude: 20 };
    await restored.stageLoginCoordinates('one', newer);
    await restored.confirmLoginCoordinates('one', point);
    expect(await restored.pendingLoginCoordinates('one')).toEqual(newer);
    await restored.confirmLoginCoordinates('one', newer);
    expect(await create().pendingLoginCoordinates('one')).toBeNull();
  });

  it('stores authenticated ciphertext with a persisted non-extractable key and fresh nonces', async () => {
    const { create, keys } = fixture();
    const service = create();
    await service.stageLoginCoordinates('one', point);
    const raw = localStorage.getItem(storageKey('one'))!;
    expect(raw).not.toContain('latitude');
    expect(raw).not.toContain('longitude');
    expect(raw).not.toContain(String(point.latitude));
    expect(raw).not.toContain(String(point.longitude));
    expect(keys.size).toBe(1);
    const key = [...keys.values()][0];
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    await service.stageLoginCoordinates('one', point);
    expect(JSON.parse(localStorage.getItem(storageKey('one'))!).iv).not.toEqual(JSON.parse(raw).iv);
    expect(await create().pendingLoginCoordinates('one')).toEqual(point);
  });

  it('rejects ciphertext copied to another account and modified ciphertext', async () => {
    const { create } = fixture();
    await create().stageLoginCoordinates('one', point);
    const raw = localStorage.getItem(storageKey('one'))!;
    localStorage.setItem(storageKey('two'), raw);
    expect(await create().pendingLoginCoordinates('two')).toBeNull();
    const tampered = JSON.parse(raw);
    tampered.ciphertext[0] ^= 1;
    localStorage.setItem(storageKey('one'), JSON.stringify(tampered));
    expect(await create().pendingLoginCoordinates('one')).toBeNull();
  });

  it('keeps the newest sample when writes and an older acknowledgement overlap', async () => {
    const { create } = fixture();
    const service = create();
    await service.stageLoginCoordinates('one', point);
    const acknowledge = service.confirmLoginCoordinates('one', point);
    const newer = { latitude: 48, longitude: 20 };
    const save = service.stageLoginCoordinates('one', newer);
    await Promise.all([acknowledge, save]);
    expect(await service.pendingLoginCoordinates('one')).toEqual(newer);
    expect(await create().pendingLoginCoordinates('one')).toEqual(newer);
  });

  it('retains the in-memory sample without a plaintext fallback if key storage fails', async () => {
    const { create, db } = fixture();
    vi.spyOn(db, 'readIndexedDbTableEntry').mockRejectedValue(new Error('unavailable'));
    const service = create();
    await service.stageLoginCoordinates('one', point);
    expect(await service.pendingLoginCoordinates('one')).toEqual(point);
    expect(localStorage.getItem(storageKey('one'))).toBeNull();
  });

  it('removes only the legacy coordinate cache, preserving profile and unrelated storage', async () => {
    const { create } = fixture();
    const legacyKey = scopedStorageKey('location.v1:one');
    localStorage.setItem(legacyKey, JSON.stringify(point));
    localStorage.setItem('unrelated-profile', JSON.stringify({ id: 'one' }));
    await create().pendingLoginCoordinates('one');
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(localStorage.getItem('unrelated-profile')).toBe(JSON.stringify({ id: 'one' }));
  });
});

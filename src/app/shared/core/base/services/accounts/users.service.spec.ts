import { HTTP_ADAPTER } from '../../adapter-loaders';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionService, type AppSession } from './session.service';
import { OfflineCacheService } from '../platform/offline-cache.service';
import { UsersService } from './users.service';
import { APP_STORAGE_KEYS } from '../../../common/storage-scope';
import { AppLocationService } from './app-location.service';

// Exercise the real session identity and avatar-preview update through the profile loader.
describe('Profile loads within a Firebase session', () => {
  const account: AppSession = { kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'login-a', profile: {
    id: 'member', name: 'Member', initials: 'M', email: 'member@example.test'
  } } as AppSession;
  const profile = { id: 'member', profileStatus: 'active', activities: {} };
  beforeEach(() => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify(account));
    TestBed.configureTestingModule({ providers: [SessionService,
      { provide: OfflineCacheService, useValue: { activateUser: vi.fn(), clearUser: vi.fn().mockResolvedValue(undefined) } }
    ] });
  });
  afterEach(() => { localStorage.clear(); TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  function fixture() {
    const session = TestBed.inject(SessionService);
    const adapter = { queryUserById: vi.fn(), loadProfileExtById: vi.fn() };
    const service = Object.assign(Object.create(UsersService.prototype), {
      session, profileExtLoadSession: signal(null), workspace: { revision: signal(0), switching: signal(false), accountUserId: signal('member'), active: signal(null) },
      location: { pendingLoginCoordinates: vi.fn().mockReturnValue(null), confirmLoginCoordinates: vi.fn() },
      isLocalRouteEnabled: () => false, setLoadStatus: vi.fn(),
      counterOverrideSignature: () => '', counterOverridesChangedSince: () => false,
      userProfileStore: { getActiveUserId: () => 'member', setUserProfile: vi.fn(), setActiveUserId: vi.fn(),
        clearUserFilterPreferences: vi.fn(), setProfileExt: vi.fn(), getProfileExt: () => null },
      activityStore: { clearUserCounterOverrides: vi.fn() }
    });
    Object.defineProperty(service, 'userService', { value: adapter });
    return { session, adapter, service };
  }

  it.each([true, false])('finishes avatar data loading with cached coordinates (%s) without native location calls', async saved => {
    const { adapter, service } = fixture();
    const coordinates = { latitude: 47, longitude: 19 };
    service.location = Object.assign(Object.create(AppLocationService.prototype), {
      pendingLoginByAccount: new Map(saved ? [['member', coordinates]] : []),
      locationCacheWrites: new Map(), legacyLocationCacheCleared: true
    });
    const query = vi.fn(() => new Promise<PermissionStatus>(() => {}));
    const getCurrentPosition = vi.fn(), watchPosition = vi.fn();
    vi.stubGlobal('navigator', { permissions: { query }, geolocation: { getCurrentPosition, watchPosition } });
    adapter.loadProfileExtById.mockResolvedValue({ profileExt: { profile, experienceEntries: [] } });
    expect(await service.loadProfileExtById()).not.toBeNull();
    expect(adapter.loadProfileExtById).toHaveBeenCalledExactlyOnceWith(
      undefined, undefined, undefined, saved ? coordinates : undefined);
    expect(service.setLoadStatus).toHaveBeenLastCalledWith('user-profile-ext', 'success');
    expect(query).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('uses the stored demo location even when visitor login coordinates remain cached', async () => {
    const { session, adapter, service } = fixture();
    (session as any).sessionRef.set({ kind: 'demo', userId: 'member', sessionId: 'demo-a' });
    service.location.pendingLoginCoordinates.mockResolvedValue({ latitude: 30.2672, longitude: -97.7431 });
    adapter.loadProfileExtById.mockResolvedValue({ profileExt: { profile, experienceEntries: [] } });
    expect(await service.loadProfileExtById('member')).not.toBeNull();
    expect(service.location.pendingLoginCoordinates).not.toHaveBeenCalled();
    expect(service.location.confirmLoginCoordinates).not.toHaveBeenCalled();
    expect(adapter.loadProfileExtById).toHaveBeenCalledWith('member', undefined, undefined, undefined);
  });

  it('passes the landing workspace to avatar hydration once, without starting a load at selection', async () => {
    const { adapter, service } = fixture();
    adapter.loadProfileExtById.mockResolvedValue({ profileExt: { profile, experienceEntries: [] } });
    service.stageInitialWorkspace('base-work');
    expect(adapter.loadProfileExtById).not.toHaveBeenCalled();
    await service.loadProfileExtById('member');
    expect(adapter.loadProfileExtById).toHaveBeenLastCalledWith('member', undefined, 'base-work', undefined);
    await service.loadProfileExtById('member');
    expect(adapter.loadProfileExtById).toHaveBeenLastCalledWith('member', undefined, undefined, undefined);
  });

  it('retains initial workspace selection after a failed hydration', async () => {
    const { adapter, service } = fixture();
    service.isTimeoutError = () => false;
    adapter.loadProfileExtById.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ profileExt: { profile, experienceEntries: [] } });
    service.stageInitialWorkspace(null);
    expect(await service.loadProfileExtById('member')).toBeNull();
    await service.loadProfileExtById('member');
    expect(adapter.loadProfileExtById).toHaveBeenLastCalledWith('member', undefined, null, undefined);
  });

  it('does not carry an initial workspace into a different session or override an explicit selection', async () => {
    const { session, adapter, service } = fixture();
    adapter.loadProfileExtById.mockResolvedValue({ profileExt: { profile, experienceEntries: [] } });
    service.stageInitialWorkspace('base-work');
    (session as any).sessionRef.set({ ...account, sessionId: 'login-b' });
    await service.loadProfileExtById('member');
    expect(adapter.loadProfileExtById).toHaveBeenLastCalledWith('member', undefined, undefined, undefined);
    service.stageInitialWorkspace('base-work');
    await service.loadProfileExtById('member', undefined, 'explicit-group');
    expect(adapter.loadProfileExtById).toHaveBeenLastCalledWith('member', undefined, 'explicit-group', undefined);
  });

  it('accepts the very first user response when its adapter refreshes the avatar', async () => {
    const { session, adapter, service } = fixture();
    const old = session.currentSession();
    adapter.queryUserById.mockImplementation(async () => {
      session.setSessionAvatarPreview('login-a', 'https://example.test/avatar.jpg');
      return { user: profile };
    });
    expect(await service.loadUserById()).toEqual(profile);
    expect(session.currentSession()).not.toBe(old);
    expect(service.userProfileStore.setActiveUserId).toHaveBeenCalledWith('member');
  });

  it('flushes a staged location once and releases the selector after an avatar refresh', async () => {
    const { session, adapter, service } = fixture();
    const coordinates = { latitude: 47, longitude: 19 };
    service.location.pendingLoginCoordinates.mockReturnValue(coordinates);
    adapter.loadProfileExtById.mockImplementation(async () => {
      session.setSessionAvatarPreview('login-a', 'https://example.test/avatar.jpg');
      return { profileExt: { profile, experienceEntries: [] } };
    });
    expect(await service.loadProfileExtById()).not.toBeNull();
    expect(adapter.loadProfileExtById).toHaveBeenCalledWith(undefined, undefined, undefined, coordinates);
    expect(service.location.confirmLoginCoordinates).toHaveBeenCalledWith('member', coordinates);
    expect(service.workspace.switching()).toBe(false);
  });

  it('retains staged location on failure and retries it on the next load', async () => {
    const { adapter, service } = fixture();
    service.isTimeoutError = () => false;
    const coordinates = { latitude: 47, longitude: 19 };
    service.location.pendingLoginCoordinates.mockReturnValue(coordinates);
    adapter.loadProfileExtById.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ profileExt: { profile, experienceEntries: [] } });
    expect(await service.loadProfileExtById()).toBeNull();
    expect(service.location.confirmLoginCoordinates).not.toHaveBeenCalled();
    expect(service.workspace.switching()).toBe(false);
    expect(await service.loadProfileExtById()).not.toBeNull();
    expect(service.location.confirmLoginCoordinates).toHaveBeenCalledOnce();
  });

  it('discards the profile if the session changes while the encrypted location is acknowledged', async () => {
    const { session, adapter, service } = fixture();
    service.location.pendingLoginCoordinates.mockResolvedValue({ latitude: 47, longitude: 19 });
    service.location.confirmLoginCoordinates.mockImplementation(async () => {
      (session as any).sessionRef.set({ ...account, sessionId: 'login-b' });
    });
    adapter.loadProfileExtById.mockResolvedValue({ profileExt: { profile, experienceEntries: [] } });
    expect(await service.loadProfileExtById()).toBeNull();
    expect(service.userProfileStore.setProfileExt).not.toHaveBeenCalled();
    expect(service.workspace.switching()).toBe(false);
  });

  it('discards an old response after a real session change and still releases the selector', async () => {
    const { session, adapter, service } = fixture();
    adapter.loadProfileExtById.mockImplementation(async () => {
      (session as any).sessionRef.set({ ...account, sessionId: 'login-b' });
      return { profileExt: { profile, experienceEntries: [] } };
    });
    expect(await service.loadProfileExtById()).toBeNull();
    expect(service.userProfileStore.setProfileExt).not.toHaveBeenCalled();
    expect(service.workspace.switching()).toBe(false);
  });
});

describe('Group-profile polling keeps account counters separate', () => {
  function fixture() {
    const accountId = signal('account');
    const activeId = signal('group-profile');
    let finish!: (snapshot: unknown) => void;
    const adapter = { queryUserRealtimeLongPoll: vi.fn(() => new Promise(resolve => { finish = resolve; })) };
    const token = { userId: 'account', revision: 3 };
    const activity = { captureUserCounterSyncToken: vi.fn(() => token), applyRealtimeCounterOverrides: vi.fn() };
    const service = Object.assign(Object.create(UsersService.prototype), {
      workspace: { accountUserId: accountId }, userProfileStore: { activeUserId: activeId },
      activityStore: activity, offlineCache: { writeTicketPage: vi.fn() }
    });
    Object.defineProperty(service, 'userService', { value: adapter });
    return { service, activity, accountId, activeId, token, complete: () => finish({ userId: 'group-profile',
      counters: { game: 2 }, accountCounters: { game: 8, cars: 3 } }) };
  }
  it('applies the account snapshot through the existing revision guard without overwriting the group profile', async () => {
    const f = fixture(); const pending = f.service.pollUserRealtimeSnapshot('group-profile'); f.complete();
    await pending;
    expect(f.activity.applyRealtimeCounterOverrides).toHaveBeenCalledExactlyOnceWith(f.token, { game: 8, cars: 3 });
  });
  it.each(['account', 'profile'])('ignores an old account snapshot after changing %s', async kind => {
    const f = fixture(); const pending = f.service.pollUserRealtimeSnapshot('group-profile');
    (kind === 'account' ? f.accountId : f.activeId).set('other'); f.complete(); await pending;
    expect(f.activity.applyRealtimeCounterOverrides).not.toHaveBeenCalled();
  });
});


describe('Location eligibility before account adapters are loaded', () => {
  it('loads the HTTP account adapter on demand and forwards coordinates', async () => {
    const coordinates = { latitude: 47.5, longitude: 19 };
    const result = { eligible: true };
    const checkLocationEligibility = vi.fn().mockResolvedValue(result);
    const get = vi.fn().mockResolvedValue({ checkLocationEligibility });
    const service = Object.assign(Object.create(UsersService.prototype), {
      isLocalRouteEnabled: () => false, transportAdapters: { get }
    }) as UsersService;
    expect(await service.checkLocationEligibility(coordinates)).toBe(result);
    expect(get).toHaveBeenCalledExactlyOnceWith(HTTP_ADAPTER.USERS);
    expect(checkLocationEligibility).toHaveBeenCalledExactlyOnceWith(coordinates);
  });

  it('keeps local eligibility on the local adapter without loading HTTP code', async () => {
    const result = { eligible: false };
    const checkLocationEligibility = vi.fn().mockResolvedValue(result);
    const get = vi.fn();
    const service = Object.assign(Object.create(UsersService.prototype), {
      isLocalRouteEnabled: () => true, transportAdapters: { get },
      localUsersService: { checkLocationEligibility }
    }) as UsersService;
    expect(await service.checkLocationEligibility()).toBe(result);
    expect(get).not.toHaveBeenCalled();
    expect(checkLocationEligibility).toHaveBeenCalledExactlyOnceWith(undefined);
  });
});


describe('Profile save reuses the approved Login coordinates without GPS', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fixture() {
    let identity = 'login';
    const point = { latitude: 47, longitude: 19 };
    const session = { identity: () => identity,
      currentSession: () => ({ kind: 'authenticated', profile: { id: 'firebase-account' } }) };
    const native = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('navigator', { permissions: { query: native }, geolocation: { getCurrentPosition: native, watchPosition: native } });
    const pendingLoginCoordinates = vi.fn().mockResolvedValue(point);
    const savedProfiles = { getUserProfile: () => null, setProfileExt: vi.fn(), setUserProfile: vi.fn(), emitProfileSaved: vi.fn() };
    const adapter = { saveUserProfileExt: vi.fn(async request => request.profile), saveUserProfile: vi.fn(async user => user) };
    const service = Object.assign(Object.create(UsersService.prototype), {
      session, sessionService: session, location: { pendingLoginCoordinates },
      userProfileStore: savedProfiles, profiles: savedProfiles, setLoadStatus: vi.fn(), runtime: { setStatus: vi.fn() },
      affiliateReferral: { pending: () => null, clear: vi.fn() }, isTimeoutError: () => false
    });
    Object.defineProperty(service, 'userService', { value: adapter });
    const user = { id: 'new-profile', profileStatus: 'public' };
    return { service, session, point, native, user, adapter, pendingLoginCoordinates,
      switchAccount: () => { identity = 'different-login'; } };
  }

  it('sends the checked coordinates in the profile request without waiting for native APIs', async () => {
    const f = fixture(), user = f.user;
    const saved = await f.service.saveUserProfileExt({ profile: user, experienceEntries: [] });
    expect(saved.locationCoordinates).toEqual(f.point);
    expect(f.pendingLoginCoordinates).toHaveBeenCalledExactlyOnceWith('firebase-account');
    expect(f.native).not.toHaveBeenCalled();
    expect(user).not.toHaveProperty('locationCoordinates');
  });

  it('preserves the existing profile coordinates', async () => {
    const f = fixture(), user = { ...f.user, locationCoordinates: { latitude: 48, longitude: 20 } };
    const saved = await f.service.saveUserProfileExt({ profile: user, experienceEntries: [] });
    expect(saved.locationCoordinates).toEqual(user.locationCoordinates);
    expect(f.pendingLoginCoordinates).not.toHaveBeenCalled();
    expect(f.native).not.toHaveBeenCalled();
  });

  it('does not request GPS when no pending coordinates exist', async () => {
    const f = fixture(), user = f.user;
    f.pendingLoginCoordinates.mockResolvedValue(null);
    const saved = await f.service.saveUserProfileExt({ profile: user, experienceEntries: [] });
    expect(saved).not.toHaveProperty('locationCoordinates');
    expect(f.native).not.toHaveBeenCalled();
  });

  it('does not send an old registration through a replacement session', async () => {
    const f = fixture(), user = f.user;
    f.pendingLoginCoordinates.mockImplementation(async () => { f.switchAccount(); return f.point; });
    expect(await f.service.saveUserProfileExt({ profile: user, experienceEntries: [] })).toBeNull();
    expect(f.adapter.saveUserProfileExt).not.toHaveBeenCalled();
    expect(f.adapter.saveUserProfile).not.toHaveBeenCalled();
  });
});

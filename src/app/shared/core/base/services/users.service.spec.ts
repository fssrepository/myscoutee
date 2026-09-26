import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionService, type AppSession } from './session.service';
import { OfflineCacheService } from './offline-cache.service';
import { UsersService } from './users.service';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';

// Exercise the real session identity and avatar-preview update through the profile loader.
describe('Profile loads within a Firebase session', () => {
  const account: AppSession = { kind: 'firebase', sessionId: 'login-a', profile: {
    id: 'member', name: 'Member', initials: 'M', email: 'member@example.test'
  } } as AppSession;
  const profile = { id: 'member', profileStatus: 'active', activities: {} };
  beforeEach(() => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify(account));
    TestBed.configureTestingModule({ providers: [SessionService,
      { provide: OfflineCacheService, useValue: { activateUser: vi.fn(), clearUser: vi.fn().mockResolvedValue(undefined) } }
    ] });
  });
  afterEach(() => { localStorage.clear(); TestBed.resetTestingModule(); });

  function fixture() {
    const session = TestBed.inject(SessionService);
    const adapter = { queryUserById: vi.fn(), loadProfileExtById: vi.fn() };
    const service = Object.assign(Object.create(UsersService.prototype), {
      session, workspace: { revision: signal(0), switching: signal(false), accountUserId: signal('member'), active: signal(null) },
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

  it('accepts the very first user response when its adapter refreshes the avatar', async () => {
    const { session, adapter, service } = fixture();
    const old = session.currentSession();
    adapter.queryUserById.mockImplementation(async () => {
      session.setFirebaseAvatarPreview('login-a', 'https://example.test/avatar.jpg');
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
      session.setFirebaseAvatarPreview('login-a', 'https://example.test/avatar.jpg');
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

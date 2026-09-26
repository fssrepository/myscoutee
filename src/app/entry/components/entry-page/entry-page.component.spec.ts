import { EntryPageComponent } from './entry-page.component';

describe('EntryPageComponent browser connection transitions', () => {
  function entry() {
    return Object.assign(Object.create(EntryPageComponent.prototype), {
      sessionService: { activeUserId: () => 'member', identity: () => 'session-a' },
      appLocationService: { stageLoginCoordinates: vi.fn() },
      landingContentRequestToken: 1,
      grantedLocationEligibilityRequestToken: 1,
      entryContentLoadPromise: null,
      grantedLocationEligibilityPromise: null,
      entryNetworkUnavailable: false,
      landingLoginAvailability: { eligible: false, partitionKey: null },
      locationEligibilityResolvedFromCoordinates: true,
      browserLocationAutoRequestAttempted: true,
      syncEntryAuthGateState: vi.fn(),
      synchronizeDeploymentAuthMode: vi.fn().mockResolvedValue(undefined),
      loadEntryContent: vi.fn().mockResolvedValue(undefined)
    });
  }

  it('recovers without reload and resets the country result on every online/offline cycle', () => {
    const component = entry();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      component.onBrowserOffline();
      expect(component.entryNetworkUnavailable).toBe(true);
      expect(component.locationEligibilityResolvedFromCoordinates).toBe(false);
      component.onBrowserOnline();
      expect(component.entryNetworkUnavailable).toBe(false);
      expect(component.landingLoginAvailability).toBeNull();
      expect(component.browserLocationAutoRequestAttempted).toBe(false);
    }
    expect(component.loadEntryContent).toHaveBeenCalledTimes(2);
    expect(component.synchronizeDeploymentAuthMode).toHaveBeenCalledTimes(2);
  });

  it('ignores an eligibility answer arriving after disconnection', async () => {
    const component = entry();
    let resolveEligibility!: (value: { eligible: boolean }) => void;
    const eligibility = new Promise<{ eligible: boolean }>(resolve => { resolveEligibility = resolve; });
    const requestStarted = vi.fn();
    Object.assign(component, {
      ngZone: { run: (fn: () => void) => fn() },
      queryGeolocationPermissionState: vi.fn().mockResolvedValue('granted'),
      requestCurrentLocation: vi.fn().mockResolvedValue({ latitude: 47.4979, longitude: 19.0402 }),
      usersService: { checkLocationEligibility: () => { requestStarted(); return eligibility; } }
    });
    const pending = component.resolveBrowserLocationAccess(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(requestStarted).toHaveBeenCalledOnce();
    component.onBrowserOffline();
    resolveEligibility({ eligible: true });
    await pending;
    expect(component.entryNetworkUnavailable).toBe(true);
    expect(component.landingLoginAvailability).toBeNull();
    expect(component.locationEligibilityResolvedFromCoordinates).toBe(false);
  });
});

describe('EntryPageComponent operator authentication gate', () => {
  it('bypasses consumer region and coordinate checks but still requires privacy consent', async () => {
    const component = Object.create(EntryPageComponent.prototype) as {
      entryNetworkUnavailable: boolean;
      loginEligibilityBusy: boolean;
      showFirebaseAuthPopup: boolean;
      sessionService: {
        authMode: 'firebase';
        firebaseProfile: () => null;
      };
      isLoginBlockedByLandingBundle: ReturnType<typeof vi.fn>;
      isLoginLocationRequiredByLandingBundle: ReturnType<typeof vi.fn>;
      ensureHttpLoginAccessAllowed: ReturnType<typeof vi.fn>;
      ensureEntryConsent: ReturnType<typeof vi.fn>;
      openBundledLoginUnavailableInfo: ReturnType<typeof vi.fn>;
      synchronizeDeploymentAuthMode: ReturnType<typeof vi.fn>;
      openEntryAuthPopup: (options: {
        forceAuthPopup?: boolean;
        bypassConsumerEligibility?: boolean;
      }) => Promise<void>;
    };
    component.entryNetworkUnavailable = false;
    component.loginEligibilityBusy = true;
    component.showFirebaseAuthPopup = false;
    component.sessionService = {
      authMode: 'firebase',
      firebaseProfile: () => null
    };
    component.isLoginBlockedByLandingBundle = vi.fn().mockReturnValue(true);
    component.isLoginLocationRequiredByLandingBundle = vi.fn().mockReturnValue(true);
    component.ensureHttpLoginAccessAllowed = vi.fn().mockResolvedValue(false);
    component.ensureEntryConsent = vi.fn().mockReturnValue(true);
    component.openBundledLoginUnavailableInfo = vi.fn();
    component.synchronizeDeploymentAuthMode = vi.fn().mockResolvedValue(undefined);
    Object.assign(component, { firebaseMessagingService: { entryPermissionPending: false } });

    await component.openEntryAuthPopup({
      forceAuthPopup: true,
      bypassConsumerEligibility: true
    });

    expect(component.isLoginBlockedByLandingBundle).not.toHaveBeenCalled();
    expect(component.isLoginLocationRequiredByLandingBundle).not.toHaveBeenCalled();
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    expect(component.ensureEntryConsent).toHaveBeenCalledOnce();
    expect(component.showFirebaseAuthPopup).toBe(true);
  });

  it('opens the dynamic demo selector when deployment Firebase is unavailable', async () => {
    const component = Object.create(EntryPageComponent.prototype) as {
      entryNetworkUnavailable: boolean;
      loginEligibilityBusy: boolean;
      sessionService: {
        authMode: 'selector';
        firebaseProfile: () => null;
      };
      synchronizeDeploymentAuthMode: ReturnType<typeof vi.fn>;
      isLoginBlockedByLandingBundle: ReturnType<typeof vi.fn>;
      isLoginLocationRequiredByLandingBundle: ReturnType<typeof vi.fn>;
      ensureEntryConsent: ReturnType<typeof vi.fn>;
      openDemoUserSelectorPopup: ReturnType<typeof vi.fn>;
      openEntryAuthPopup: () => Promise<void>;
    };
    component.entryNetworkUnavailable = false;
    component.loginEligibilityBusy = false;
    component.sessionService = {
      authMode: 'selector',
      firebaseProfile: () => null
    };
    component.synchronizeDeploymentAuthMode = vi.fn().mockResolvedValue(undefined);
    Object.assign(component, { firebaseMessagingService: { entryPermissionPending: false } });
    component.isLoginBlockedByLandingBundle = vi.fn().mockReturnValue(false);
    component.isLoginLocationRequiredByLandingBundle = vi.fn().mockReturnValue(false);
    component.ensureEntryConsent = vi.fn().mockReturnValue(true);
    component.openDemoUserSelectorPopup = vi.fn();

    await component.openEntryAuthPopup();

    expect(component.synchronizeDeploymentAuthMode).toHaveBeenCalledOnce();
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
  });
});

describe('EntryPageComponent browser location permission gate', () => {
  function grantedPermissionsEntry() {
    return Object.assign(Object.create(EntryPageComponent.prototype), {
      sessionService: { activeUserId: () => 'member', identity: () => 'session-a' },
      appLocationService: { stageLoginCoordinates: vi.fn() },
      locationEligibilityResolvedFromCoordinates: false,
      landingLoginAvailability: null,
      grantedLocationEligibilityRequestToken: 1,
      grantedLocationEligibilityPromise: null,
      firebaseMessagingService: { entryPermissionPending: false },
      queryGeolocationPermissionState: vi.fn().mockResolvedValue('granted'),
      requestCurrentLocation: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
      usersService: { checkLocationEligibility: vi.fn().mockResolvedValue({ eligible: true }) },
      appSetupStore: { requestForLogin: vi.fn() },
      requestLocationAccessFromDialog: vi.fn().mockResolvedValue(true),
      dialogStore: { openInfo: vi.fn() },
      ngZone: { run: (fn: () => void) => fn() },
      changeDetectorRef: { markForCheck: vi.fn() },
      syncEntryAuthGateState: vi.fn(),
      uiText: (key: string) => key
    });
  }

  it('waits for the running country check without reopening setup or requesting a second position', async () => {
    const component = grantedPermissionsEntry();
    let finish!: (result: { eligible: boolean }) => void;
    component.usersService.checkLocationEligibility.mockReturnValue(new Promise(resolve => finish = resolve));
    component.grantedLocationEligibilityPromise = component.resolveBrowserLocationAccess(1);
    const complete = vi.fn();
    const login = component.ensureHttpLoginAccessAllowed().then(complete);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.requestCurrentLocation).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
    expect(component.requestLocationAccessFromDialog).not.toHaveBeenCalled();

    finish({ eligible: true });
    await login;
    expect(complete).toHaveBeenCalledWith(true);
    expect(component.requestCurrentLocation).toHaveBeenCalledOnce();
    expect(component.loginEligibilityBusy).toBe(false);
  });

  it.each([true, false])('checks country eligibility silently when both permissions are granted (eligible: %s)', async eligible => {
    const component = grantedPermissionsEntry();
    component.usersService.checkLocationEligibility.mockResolvedValue({ eligible });
    expect(await component.ensureHttpLoginAccessAllowed()).toBe(true);
    expect(component.requestCurrentLocation).toHaveBeenCalledOnce();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
    expect(component.requestLocationAccessFromDialog).toHaveBeenCalledTimes(eligible ? 0 : 1);
    expect(component.dialogStore.openInfo).not.toHaveBeenCalled();
  });

  it('opens the retryable setup when a granted location cannot be acquired', async () => {
    const component = grantedPermissionsEntry();
    component.requestCurrentLocation.mockResolvedValue(null);
    component.requestLocationAccessFromDialog.mockResolvedValue(false);
    expect(await component.ensureHttpLoginAccessAllowed()).toBe(false);
    expect(component.requestLocationAccessFromDialog).toHaveBeenCalledOnce();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
    expect(component.usersService.checkLocationEligibility).not.toHaveBeenCalled();
    expect(component.dialogStore.openInfo).not.toHaveBeenCalled();
  });

  it('reuses completed eligibility with granted permissions without opening setup or acquiring location', async () => {
    const component = grantedPermissionsEntry();
    component.locationEligibilityResolvedFromCoordinates = true;
    component.landingLoginAvailability = { eligible: true };
    expect(await component.ensureHttpLoginAccessAllowed()).toBe(true);
    expect(component.requestCurrentLocation).not.toHaveBeenCalled();
    expect(component.requestLocationAccessFromDialog).not.toHaveBeenCalled();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'denied'])('keeps the explicit setup flow when location permission is %s', async state => {
    const component = grantedPermissionsEntry();
    component.queryGeolocationPermissionState.mockResolvedValue(state);
    await component.ensureHttpLoginAccessAllowed();
    expect(component.requestLocationAccessFromDialog).toHaveBeenCalledOnce();
    expect(component.requestCurrentLocation).not.toHaveBeenCalled();
  });

  it('reuses a successful location check when reopening setup for notifications', async () => {
    const requestForLogin = vi.fn().mockResolvedValue(true);
    const requestLocationAccessFromDialog = vi.fn();
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      locationEligibilityResolvedFromCoordinates: true,
      landingLoginAvailability: { eligible: true },
      firebaseMessagingService: { entryPermissionPending: true },
      appSetupStore: { requestForLogin },
      requestLocationAccessFromDialog
    });
    expect(await component.ensureHttpLoginAccessAllowed()).toBe(true);
    expect(requestForLogin).toHaveBeenCalledWith();
    expect(requestLocationAccessFromDialog).not.toHaveBeenCalled();
    expect(component.loginEligibilityBusy).toBe(false);
  });

  it('waits for an explicit user action while browser permission is prompt', async () => {
    const component = Object.create(EntryPageComponent.prototype) as {
      grantedLocationEligibilityRequestToken: number;
      queryGeolocationPermissionState: ReturnType<typeof vi.fn>;
      requestCurrentLocation: ReturnType<typeof vi.fn>;
      resolveBrowserLocationAccess: (requestToken: number) => Promise<void>;
    };
    Object.assign(component, { sessionService: { activeUserId: () => 'member', identity: () => 'session-a' } });
    component.grantedLocationEligibilityRequestToken = 7;
    component.queryGeolocationPermissionState = vi.fn().mockResolvedValue('prompt');
    component.requestCurrentLocation = vi.fn();

    await component.resolveBrowserLocationAccess(7);

    expect(component.queryGeolocationPermissionState).toHaveBeenCalledOnce();
    expect(component.requestCurrentLocation).not.toHaveBeenCalled();
  });
});

describe('EntryPageComponent demo session routing', () => {
  function completedOnboarding(localModeEnabled: boolean) {
    return Object.assign(Object.create(EntryPageComponent.prototype), {
      pendingRedirectAfterOnboarding: '/game',
      pendingDemoSessionUserId: 'new-demo-user',
      usersService: {
        localModeEnabled,
        loadUserById: vi.fn().mockResolvedValue({ id: 'new-demo-user' })
      },
      sessionService: {
        startDemoSession: vi.fn().mockReturnValue({ kind: 'demo', userId: 'new-demo-user' }),
        startTrackedDemoSession: vi.fn().mockResolvedValue({ kind: 'demo', userId: 'new-demo-user' }),
        logout: vi.fn().mockResolvedValue(undefined)
      },
      router: { navigateByUrl: vi.fn().mockResolvedValue(true) }
    });
  }

  it('registers the new HTTP profile session and reads it before opening game cards', async () => {
    const component = completedOnboarding(false);
    await component.onOnboardingCompleted({ id: 'new-demo-user' });
    expect(component.sessionService.startDemoSession).not.toHaveBeenCalled();
    expect(component.sessionService.startTrackedDemoSession).toHaveBeenCalledWith('new-demo-user');
    expect(component.usersService.loadUserById).toHaveBeenCalledWith('new-demo-user', 8000);
    expect(component.sessionService.startTrackedDemoSession.mock.invocationCallOrder[0])
      .toBeLessThan(component.usersService.loadUserById.mock.invocationCallOrder[0]);
    expect(component.usersService.loadUserById.mock.invocationCallOrder[0])
      .toBeLessThan(component.router.navigateByUrl.mock.invocationCallOrder[0]);
  });

  it('keeps local onboarding independent of server session registration', async () => {
    const component = completedOnboarding(true);
    await component.onOnboardingCompleted({ id: 'new-demo-user' });
    expect(component.sessionService.startDemoSession).toHaveBeenCalledWith('new-demo-user');
    expect(component.sessionService.startTrackedDemoSession).not.toHaveBeenCalled();
    expect(component.usersService.loadUserById).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
  });

  it('does not open game cards when the server rejects the new session', async () => {
    const component = completedOnboarding(false);
    component.sessionService.startTrackedDemoSession.mockResolvedValue(null);
    await component.onOnboardingCompleted({ id: 'new-demo-user' });
    expect(component.usersService.loadUserById).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('starts a local demo session without registering it through the backend', async () => {
    const startDemoSession = vi.fn().mockReturnValue({
      kind: 'demo',
      userId: 'demo-user',
      sessionId: 'local-session'
    });
    const startTrackedDemoSession = vi.fn();
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    const complete = vi.fn();
    const fail = vi.fn();
    const component = Object.create(EntryPageComponent.prototype) as {
      usersService: {
        localModeEnabled: boolean;
        peekCachedUserById: ReturnType<typeof vi.fn>;
      };
      sessionService: {
        startDemoSession: typeof startDemoSession;
        startTrackedDemoSession: typeof startTrackedDemoSession;
        firebaseNotice: ReturnType<typeof vi.fn>;
      };
      router: { navigateByUrl: typeof navigateByUrl };
      memberRedirectUrl: ReturnType<typeof vi.fn>;
      onDemoUserSelected: (selection: {
        userId: string;
        user?: { locationCoordinates: { latitude: number; longitude: number } };
        mode: 'member';
        complete: () => void;
        fail: (message?: string) => void;
      }) => Promise<void>;
    };
    component.usersService = {
      localModeEnabled: true,
      peekCachedUserById: vi.fn().mockReturnValue(null)
    };
    component.sessionService = {
      startDemoSession,
      startTrackedDemoSession,
      firebaseNotice: vi.fn().mockReturnValue('')
    };
    component.router = { navigateByUrl };
    component.memberRedirectUrl = vi.fn().mockReturnValue('/game');
    Object.assign(component, {
      usersService: {
        ...component.usersService,
        checkLocationEligibility: vi.fn().mockResolvedValue({ eligible: true })
      },
      appLocationService: { pendingLoginCoordinates: () => null }
    });

    await component.onDemoUserSelected({
      userId: 'demo-user',
      user: { locationCoordinates: { latitude: 47.4979, longitude: 19.0402 } },
      mode: 'member',
      complete,
      fail
    });

    expect(startDemoSession).toHaveBeenCalledWith('demo-user');
    expect(startTrackedDemoSession).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/game');
    expect(complete).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
  });

  it('registers an HTTP operator demo session before navigating', async () => {
    const startDemoSession = vi.fn();
    const startTrackedDemoSession = vi.fn().mockResolvedValue({
      kind: 'demo',
      userId: 'operator-demo',
      sessionId: 'tracked-session'
    });
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    const complete = vi.fn();
    const fail = vi.fn();
    const component = Object.create(EntryPageComponent.prototype) as {
      usersService: { localModeEnabled: boolean };
      sessionService: {
        startDemoSession: typeof startDemoSession;
        startTrackedDemoSession: typeof startTrackedDemoSession;
        firebaseNotice: ReturnType<typeof vi.fn>;
      };
      router: { navigateByUrl: typeof navigateByUrl };
      onDemoUserSelected: (selection: {
        userId: string;
        mode: 'operator';
        complete: () => void;
        fail: (message?: string) => void;
      }) => Promise<void>;
    };
    component.usersService = { localModeEnabled: false };
    component.sessionService = {
      startDemoSession,
      startTrackedDemoSession,
      firebaseNotice: vi.fn().mockReturnValue('')
    };
    component.router = { navigateByUrl };

    await component.onDemoUserSelected({
      userId: 'operator-demo',
      mode: 'operator',
      complete,
      fail
    });

    expect(startTrackedDemoSession).toHaveBeenCalledWith('operator-demo');
    expect(startDemoSession).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/operator');
    expect(complete).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
  });
});

describe('Demo location admission before session creation', () => {
  const accepted = { latitude: 47.4979, longitude: 19.0402 };
  const rejected = { latitude: 30.2672, longitude: -97.7431 };
  function fixture(localModeEnabled: boolean, coordinates?: typeof accepted) {
    const user = { id: 'demo-user', locationCoordinates: coordinates };
    const session = { kind: 'demo', userId: user.id };
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      usersService: {
        localModeEnabled,
        peekCachedUserById: () => user,
        checkLocationEligibility: vi.fn(async point => ({ eligible: point === accepted })),
        loadUserById: vi.fn().mockResolvedValue(user)
      },
      sessionService: {
        startDemoSession: vi.fn().mockReturnValue(session),
        startTrackedDemoSession: vi.fn().mockResolvedValue(session),
        firebaseNotice: () => ''
      },
      appLocationService: {
        pendingLoginCoordinates: vi.fn().mockReturnValue(rejected),
        stageLoginCoordinates: vi.fn()
      },
      requiresProfileOnboarding: () => false,
      requestLocationAccessFromDialog: vi.fn().mockResolvedValue(false),
      runPostSessionGate: vi.fn(),
      memberRedirectUrl: () => '/game',
      router: { navigateByUrl: vi.fn().mockResolvedValue(true) },
      uiText: (value: string) => value
    });
    const selection = { userId: user.id, user, mode: 'member', complete: vi.fn(), fail: vi.fn() };
    return { component, selection };
  }

  for (const local of [true, false]) {
    it(`uses the selected profile's eligible point before starting a ${local ? 'local' : 'HTTP'} session`, async () => {
      const { component, selection } = fixture(local, accepted);
      await component.onDemoUserSelected(selection);
      expect(component.usersService.checkLocationEligibility).toHaveBeenCalledWith(accepted);
      expect(component.usersService.checkLocationEligibility).toHaveBeenCalledOnce();
      expect(component.appLocationService.pendingLoginCoordinates).not.toHaveBeenCalled();
      expect(component.appLocationService.stageLoginCoordinates).not.toHaveBeenCalled();
      expect(component.requestLocationAccessFromDialog).not.toHaveBeenCalled();
      const start = local ? component.sessionService.startDemoSession : component.sessionService.startTrackedDemoSession;
      expect(start).toHaveBeenCalledOnce();
      expect(component.usersService.checkLocationEligibility.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]);
      expect(selection.complete).toHaveBeenCalledOnce();
    });

    for (const point of [undefined, rejected]) {
      it(`allows retry after missing/rejected coordinates without opening a ${local ? 'local' : 'HTTP'} session first`, async () => {
        const { component, selection } = fixture(local, point);
        await component.onDemoUserSelected(selection);
        expect(component.requestLocationAccessFromDialog).toHaveBeenCalledWith('demo-user');
        expect(component.sessionService.startDemoSession).not.toHaveBeenCalled();
        expect(component.sessionService.startTrackedDemoSession).not.toHaveBeenCalled();
        expect(component.usersService.loadUserById).not.toHaveBeenCalled();
        expect(component.router.navigateByUrl).not.toHaveBeenCalled();
        component.requestLocationAccessFromDialog.mockResolvedValue(true);
        await component.onDemoUserSelected(selection);
        expect(selection.complete).toHaveBeenCalledOnce();
      });
    }
  }

  it('keeps a rejected fresh point inside the setup flow and stages only the successful retry for the selected account', async () => {
    let validate: (point: typeof accepted) => Promise<boolean> = async () => false;
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      sessionService: { identity: () => 'anonymous' },
      appSetupStore: { requestForLogin: vi.fn(callback => { validate = callback; return Promise.resolve(false); }) },
      usersService: { checkLocationEligibility: vi.fn(async point => ({ eligible: point === accepted, message: 'country unavailable' })) },
      appLocationService: { stageLoginCoordinates: vi.fn() },
      syncLandingLoginAvailability: vi.fn(),
      uiText: (text: string) => text
    });
    await component.requestLocationAccessFromDialog('demo-user');
    await expect(validate(rejected)).rejects.toThrow('country unavailable');
    expect(component.appLocationService.stageLoginCoordinates).not.toHaveBeenCalled();
    await expect(validate(accepted)).resolves.toBe(true);
    expect(component.appLocationService.stageLoginCoordinates).toHaveBeenCalledWith('demo-user', accepted);
  });
});

describe('Authenticated entry location', () => {
  function entry(locationCoordinates?: { latitude: number; longitude: number }) {
    return Object.assign(Object.create(EntryPageComponent.prototype), {
      postSessionGateToken: 0,
      firebaseMessagingService: { entryPermissionPending: false },
      usersService: { loadUserById: vi.fn().mockResolvedValue({ id: 'member', locationCoordinates }) },
      sessionService: { activeUserId: () => 'member', identity: () => 'session-a' },
      appLocationService: { pendingLoginCoordinates: vi.fn().mockReturnValue(null) },
      ensureHttpLoginAccessAllowed: vi.fn().mockResolvedValue(true),
      requiresProfileOnboarding: () => false, closeOnboardingGate: vi.fn(),
      router: { navigateByUrl: vi.fn().mockResolvedValue(true) }
    });
  }
  const session = { kind: 'firebase', sessionId: 'session-a', profile: { id: 'member' } };
  it('enters on the first attempt using stored server coordinates without probing browser permission', async () => {
    const component = entry({ latitude: 47, longitude: 19 });
    await component.runPostSessionGate(session, '/game');
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
  });
  it('retains notification setup with a saved location without asking for new coordinates', async () => {
    const component = entry({ latitude: 47, longitude: 19 });
    component.firebaseMessagingService.entryPermissionPending = true;
    const requestForLogin = vi.fn().mockResolvedValue(true);
    Object.assign(component, { appSetupStore: { requestForLogin } });
    await component.runPostSessionGate(session, '/game');
    expect(requestForLogin).toHaveBeenCalledOnce();
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
  });
  it('asks for initial coordinates only if both server and pending browser values are absent', async () => {
    const component = entry();
    await component.runPostSessionGate(session, '/game');
    expect(component.ensureHttpLoginAccessAllowed).toHaveBeenCalledOnce();
    component.ensureHttpLoginAccessAllowed.mockClear();
    component.appLocationService.pendingLoginCoordinates.mockReturnValue({ latitude: 47, longitude: 19 });
    await component.runPostSessionGate(session, '/game');
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
  });
});

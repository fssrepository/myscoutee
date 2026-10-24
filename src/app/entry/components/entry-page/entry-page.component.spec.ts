import { EntryPageComponent } from './entry-page.component';
import { APP_STORAGE_KEYS } from '../../../shared/core/common/storage-scope';
import { automaticPrivacyConsentEnabled } from '../../../shared/core/base/services/help/privacy-policy.service';

// Admission tests use prototype fixtures; component creation is covered separately.
beforeEach(() => {
  const prototype = EntryPageComponent.prototype as unknown as {
    ensureFirebaseAuthPopupLoaded(): Promise<void>;
    ensureOnboardingPopupLoaded(): Promise<void>;
  };
  vi.spyOn(prototype, 'ensureFirebaseAuthPopupLoaded').mockResolvedValue(undefined);
  vi.spyOn(prototype, 'ensureOnboardingPopupLoaded').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

it('releases the admin selector when its lazy workspace cannot be initialized', async () => {
  const selection = { userId: 'admin', mode: 'admin', complete: vi.fn(), fail: vi.fn() };
  const component = Object.assign(Object.create(EntryPageComponent.prototype), {
    injector: { get: vi.fn(() => { throw new Error('Workspace initialization failed'); }) },
    sessionService: { startDemoSession: vi.fn(), startTrackedDemoSession: vi.fn() },
    router: { navigateByUrl: vi.fn() }
  });

  await component.onDemoUserSelected(selection);

  expect(selection.fail).toHaveBeenCalledOnce();
  expect(selection.complete).not.toHaveBeenCalled();
  expect(component.sessionService.startDemoSession).not.toHaveBeenCalled();
  expect(component.sessionService.startTrackedDemoSession).not.toHaveBeenCalled();
  expect(component.router.navigateByUrl).not.toHaveBeenCalled();
});

describe('nginx automatic consent switch', () => {
  beforeEach(() => {
    const flag = document.createElement('script');
    flag.id = 'myscoutee-consent-auto'; flag.textContent = '0';
    document.head.appendChild(flag);
  });
  afterEach(() => document.getElementById('myscoutee-consent-auto')?.remove());

  it('skips initial, async and login prompting without manufacturing consent', async () => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, entryPrivacyLoading: true,
      privacyPolicy: { state: () => null, activeRevision: () => ({ id: 'privacy', version: 1 }) },
      loadEntryConsentState: () => null, loadEntryContent: vi.fn(),
      entryConsentPopupOpen: false, landingContentRequestToken: 1,
      endEntryPrivacyLoadingWindow: vi.fn(), syncEntryPrivacyApprovalsForRevision: vi.fn(),
      changeDetectorRef: { markForCheck: vi.fn() }, onEntryConsentStateChanged: vi.fn()
    });
    const saved = localStorage.getItem(APP_STORAGE_KEYS.entryConsent);
    expect(component.shouldPromptEntryConsent()).toBe(false);
    component.finishEntryPrivacyLoad(1, true);
    expect(component.showEntryConsentPopup).toBe(false);
    expect(await component.ensureEntryConsent()).toBe(true);
    expect(component.loadEntryContent).not.toHaveBeenCalled();
    expect(component.hasEntryConsent).toBe(false);
    expect(component.onEntryConsentStateChanged).toHaveBeenCalledWith(false);
    expect(localStorage.getItem(APP_STORAGE_KEYS.entryConsent)).toBe(saved);
  });

  it('keeps a manually opened consent editable after the policy finishes loading', () => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, landingContentRequestToken: 1,
      privacyPolicy: { state: () => null }, loadEntryContent: vi.fn(),
      syncEntryPrivacyApprovalsForRevision: vi.fn(), endEntryPrivacyLoadingWindow: vi.fn(),
      changeDetectorRef: { markForCheck: vi.fn() }, onEntryConsentStateChanged: vi.fn(),
      loadEntryConsentState: () => null
    });
    component.openEntryConsentPopup();
    component.finishEntryPrivacyLoad(1, true);
    expect(component.showEntryConsentPopup).toBe(true);
    expect(component.entryConsentViewOnly).toBe(false);
  });

  it.each(['1', '', '<!--# echo var="myscoutee_consent_auto" -->', 'invalid'])('keeps the original behavior for %s', value => {
    document.getElementById('myscoutee-consent-auto')!.textContent = value;
    expect(automaticPrivacyConsentEnabled()).toBe(true);
  });
  it('keeps the original behavior without the nginx snapshot', () => {
    document.getElementById('myscoutee-consent-auto')!.remove();
    expect(automaticPrivacyConsentEnabled()).toBe(true);
  });
});

describe('entry consent visibility while the policy loads', () => {
  afterEach(() => localStorage.removeItem(APP_STORAGE_KEYS.entryConsent));

  it.each(['current', 'outdated', 'missing'] as const)('checks %s consent before opening the popup', async saved => {
    if (saved !== 'missing') {
      localStorage.setItem(APP_STORAGE_KEYS.entryConsent, JSON.stringify({
        version: saved === 'current' ? 'privacy:privacy:v2' : 'privacy:privacy:v1',
        accepted: true, acceptedAtIso: '2026-10-12T12:00:00Z'
      }));
    }
    let revision: { id: string; version: number } | null = null;
    let finish!: () => void;
    const content = new Promise<void>(resolve => { finish = resolve; });
    const opened: boolean[] = [];
    let visible = false;
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, entryPrivacyLoading: true, entryConsentViewOnly: false,
      privacyPolicy: { state: () => revision, activeRevision: () => revision },
      loadEntryContent: vi.fn(() => content.then(() => {
        revision = { id: 'privacy', version: 2 };
        component.entryPrivacyLoading = false;
      }))
    });
    Object.defineProperty(component, 'showEntryConsentPopup', {
      get: () => visible,
      set: (value: boolean) => { visible = value; opened.push(value); }
    });
    const pending = component.ensureEntryConsent();
    expect(visible).toBe(false);
    expect(opened).not.toContain(true);
    finish();
    expect(await pending).toBe(saved === 'current');
    expect(visible).toBe(saved !== 'current');
    if (saved === 'current') expect(opened).not.toContain(true);
  });
});

describe('Demo selector admission without visitor location', () => {
  it.each(['prompt', 'denied', 'unsupported-country'])('opens Explore directly with %s visitor location', async state => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, ensureEntryConsent: vi.fn().mockResolvedValue(true),
      appSetupStore: { explainMissingSetup: vi.fn(() => true) },
      landingGuide: { enabled: () => true },
      landingLoginAvailability: { eligible: state !== 'unsupported-country', securityGateEnabled: true },
      locationEligibilityResolvedFromCoordinates: true,
      openDemoUserSelectorPopup: vi.fn(), requestCurrentLocation: vi.fn()
    });
    await component.openEntryDemo();
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
    expect(component.appSetupStore.explainMissingSetup).not.toHaveBeenCalled();
    expect(component.requestCurrentLocation).not.toHaveBeenCalled();
  });

  it('retains privacy consent before Explore', async () => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, ensureEntryConsent: vi.fn().mockResolvedValue(false),
      openDemoUserSelectorPopup: vi.fn()
    });
    await component.openEntryDemo();
    expect(component.openDemoUserSelectorPopup).not.toHaveBeenCalled();
    expect(component.resumeExploreAfterConsent).toBe(true);
  });
});

describe('EntryPageComponent new demo registration admission', () => {
  it('opens registration without requesting device setup and retains the invitation', async () => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      buildDemoRegistrationUser: () => ({ id: 'new-demo-account' }),
      appSetupStore: { requestForLogin: vi.fn() }, pendingDemoSessionUserId: '',
      memberRedirectUrl: () => '/game?eventInvite=retained-test-invite', openOnboardingGate: vi.fn()
    });
    const request = { complete: vi.fn(), fail: vi.fn() };
    await component.onDemoNewProfileRequested(request);
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
    expect(component.pendingDemoSessionUserId).toBe('new-demo-account');
    expect(component.openOnboardingGate).toHaveBeenCalledWith(
      { id: 'new-demo-account' }, '/game?eventInvite=retained-test-invite', expect.any(Object));
    expect(request.complete).toHaveBeenCalledOnce();
    expect(request.fail).not.toHaveBeenCalled();
  });
});

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
    await vi.waitFor(() => expect(requestStarted).toHaveBeenCalledOnce());
    component.onBrowserOffline();
    resolveEligibility({ eligible: true });
    await pending;
    expect(component.entryNetworkUnavailable).toBe(true);
    expect(component.landingLoginAvailability).toBeNull();
    expect(component.locationEligibilityResolvedFromCoordinates).toBe(false);
  });
});

describe('EntryPageComponent operator authentication gate', () => {
  it.each(['prompt', 'denied', 'granted'])('opens setup directly for %s permission, otherwise Firebase', async permission => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, entryAuthUnavailable: false, loginEligibilityBusy: false,
      showFirebaseAuthPopup: false, sessionService: { authMode: 'firebase', accountProfile: () => null },
      synchronizeDeploymentAuthMode: vi.fn().mockResolvedValue(undefined), ensureEntryConsent: () => true,
      isLoginBlockedByLandingBundle: () => false,
      queryGeolocationPermissionState: vi.fn().mockResolvedValue(permission),
      landingGuide: { enabled: () => true, closePopup: vi.fn() },
      appSetupStore: { locationSetupMissing: () => permission !== 'granted', open: vi.fn(),
        explainMissingSetup: vi.fn(), requestForLogin: vi.fn(), guideRequested: { set: vi.fn() } }
    });
    await component.openEntryAuthPopup();
    expect(component.showFirebaseAuthPopup).toBe(permission === 'granted');
    expect(component.appSetupStore.open).toHaveBeenCalledTimes(permission === 'granted' ? 0 : 1);
    expect(component.landingGuide.closePopup).toHaveBeenCalledOnce();
    expect(component.appSetupStore.guideRequested.set).toHaveBeenCalledWith(false);
    expect(component.appSetupStore.explainMissingSetup).not.toHaveBeenCalled();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
    expect(component.queryGeolocationPermissionState).not.toHaveBeenCalled();
  });

  it('opens missing-location setup even when the optional guide is disabled', async () => {
    const component = Object.assign(Object.create(EntryPageComponent.prototype), {
      landingGuide: { enabled: () => false, closePopup: vi.fn() },
      appSetupStore: { locationSetupMissing: () => true, open: vi.fn(), guideRequested: { set: vi.fn() } }
    });
    expect(component.showEntryLocationSetup()).toBe(true);
    expect(component.appSetupStore.open).toHaveBeenCalledOnce();
    expect(component.appSetupStore.guideRequested.set).toHaveBeenCalledWith(false);
  });

  it('bypasses consumer region and coordinate checks but still requires privacy consent', async () => {
    const component = Object.create(EntryPageComponent.prototype) as {
      entryNetworkUnavailable: boolean;
      loginEligibilityBusy: boolean;
      showFirebaseAuthPopup: boolean;
      sessionService: {
        authMode: 'firebase';
        accountProfile: () => null;
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
      accountProfile: () => null
    };
    component.isLoginBlockedByLandingBundle = vi.fn().mockReturnValue(true);
    component.isLoginLocationRequiredByLandingBundle = vi.fn().mockReturnValue(true);
    component.ensureHttpLoginAccessAllowed = vi.fn().mockResolvedValue(false);
    component.ensureEntryConsent = vi.fn().mockReturnValue(true);
    component.openBundledLoginUnavailableInfo = vi.fn();
    component.synchronizeDeploymentAuthMode = vi.fn().mockResolvedValue(undefined);
    Object.assign(component, { firebaseMessagingService: { entryPermissionPending: false },
      landingGuide: { enabled: () => true, closePopup: vi.fn() },
      appSetupStore: { explainMissingSetup: vi.fn(() => false), guideRequested: { set: vi.fn() } } });

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
        accountProfile: () => null;
      };
      synchronizeDeploymentAuthMode: ReturnType<typeof vi.fn>;
      isLoginBlockedByLandingBundle: ReturnType<typeof vi.fn>;
      isLoginLocationRequiredByLandingBundle: ReturnType<typeof vi.fn>;
      ensureEntryConsent: ReturnType<typeof vi.fn>;
      openDemoUserSelectorPopup: ReturnType<typeof vi.fn>;
      ensureHttpLoginAccessAllowed: ReturnType<typeof vi.fn>;
      openEntryAuthPopup: () => Promise<void>;
    };
    component.entryNetworkUnavailable = false;
    component.loginEligibilityBusy = false;
    component.sessionService = {
      authMode: 'selector',
      accountProfile: () => null
    };
    component.synchronizeDeploymentAuthMode = vi.fn().mockResolvedValue(undefined);
    Object.assign(component, { firebaseMessagingService: { entryPermissionPending: false },
      landingGuide: { enabled: () => true, closePopup: vi.fn() },
      appSetupStore: { explainMissingSetup: vi.fn(() => true), guideRequested: { set: vi.fn() } } });
    component.isLoginBlockedByLandingBundle = vi.fn().mockReturnValue(false);
    component.isLoginLocationRequiredByLandingBundle = vi.fn().mockReturnValue(false);
    component.ensureEntryConsent = vi.fn().mockReturnValue(true);
    component.openDemoUserSelectorPopup = vi.fn();
    component.ensureHttpLoginAccessAllowed = vi.fn();

    await component.openEntryAuthPopup();

    expect(component.synchronizeDeploymentAuthMode).toHaveBeenCalledOnce();
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
    expect((component as any).appSetupStore.explainMissingSetup).not.toHaveBeenCalled();
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
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

  it.each(['prompt', 'denied', 'granted'])('does not wait for device setup when permission is %s', async state => {
    const component = grantedPermissionsEntry();
    component.queryGeolocationPermissionState.mockResolvedValue(state);
    component.firebaseMessagingService.entryPermissionPending = true;
    expect(await component.ensureHttpLoginAccessAllowed()).toBe(true);
    expect(component.queryGeolocationPermissionState).not.toHaveBeenCalled();
    expect(component.requestCurrentLocation).not.toHaveBeenCalled();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
  });

  it('retains an explicit regional security rejection without requesting device permissions', async () => {
    const component = grantedPermissionsEntry();
    component.locationEligibilityResolvedFromCoordinates = true;
    component.landingLoginAvailability = { eligible: false, securityGateEnabled: true };
    expect(await component.ensureHttpLoginAccessAllowed()).toBe(false);
    expect(component.dialogStore.openInfo).toHaveBeenCalledOnce();
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
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
        authNotice: ReturnType<typeof vi.fn>;
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
      authNotice: vi.fn().mockReturnValue('')
    };
    component.router = { navigateByUrl };
    component.memberRedirectUrl = vi.fn().mockReturnValue('/game');
    Object.assign(component, {
      usersService: {
        ...component.usersService,
        stageInitialWorkspace: vi.fn(),
        loadProfileExtById: vi.fn(() => new Promise(() => {})),
        checkLocationEligibility: vi.fn().mockResolvedValue({ eligible: true })
      },
      appLocationService: { pendingLoginCoordinates: () => null },
      landingContent: { mode: () => 'dating' }
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
    expect((component.usersService as any).loadProfileExtById).not.toHaveBeenCalled();
    expect((component.usersService as any).stageInitialWorkspace).toHaveBeenCalledWith(null);
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
        authNotice: ReturnType<typeof vi.fn>;
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
      authNotice: vi.fn().mockReturnValue('')
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
        stageInitialWorkspace: vi.fn(),
        loadUserById: vi.fn().mockResolvedValue(user)
      },
      sessionService: {
        startDemoSession: vi.fn().mockReturnValue(session),
        startTrackedDemoSession: vi.fn().mockResolvedValue(session),
        authNotice: () => ''
      },
      appLocationService: {
        pendingLoginCoordinates: vi.fn().mockReturnValue(rejected),
        stageLoginCoordinates: vi.fn()
      },
      requiresProfileOnboarding: () => false,
      landingContent: { mode: () => 'dating' },
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

    it(`starts a ${local ? 'local' : 'HTTP'} session without stored coordinates or a permission popup`, async () => {
      const { component, selection } = fixture(local);
      await component.onDemoUserSelected(selection);
      expect(component.usersService.checkLocationEligibility).not.toHaveBeenCalled();
      expect(component.requestLocationAccessFromDialog).not.toHaveBeenCalled();
      expect(local ? component.sessionService.startDemoSession : component.sessionService.startTrackedDemoSession).toHaveBeenCalledOnce();
      expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game', ...local ? [] : [{ state: { avatarLoading: true } }]);
      expect(component.runPostSessionGate).not.toHaveBeenCalled();
      expect(selection.complete).toHaveBeenCalledOnce();
    });

    it(`retains regional rejection for a ${local ? 'local' : 'HTTP'} profile without opening setup`, async () => {
      const { component, selection } = fixture(local, rejected);
      await component.onDemoUserSelected(selection);
      expect(component.requestLocationAccessFromDialog).not.toHaveBeenCalled();
      expect(component.sessionService.startDemoSession).not.toHaveBeenCalled();
      expect(component.sessionService.startTrackedDemoSession).not.toHaveBeenCalled();
      expect(selection.fail).toHaveBeenCalledOnce();
    });

    it.each([
      ['dating', ['dating'], null],
      ['work', ['work'], 'myscoutee-work'],
      ['community', ['community'], 'myscoutee-community'],
      ['work', ['dating'], undefined]
    ])(`leaves %s data loading to the existing load ring after ${local ? 'local' : 'HTTP'} selection`, async (mode, baseGroupTypes, httpWorkspace) => {
      const { component, selection } = fixture(local, accepted);
      component.landingContent.mode = () => mode;
      Object.assign(selection.user, { baseGroupTypes });
      component.usersService.loadProfileExtById = vi.fn().mockResolvedValue({ profile: selection.user });
      await component.onDemoUserSelected(selection);
      expect(component.usersService.loadUserById).not.toHaveBeenCalled();
      expect(component.usersService.loadProfileExtById).not.toHaveBeenCalled();
      expect(component.router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/game', ...local ? [] : [{ state: { avatarLoading: true } }]);
      const workspace = local && mode === 'work' ? 'myscoutee-work' : httpWorkspace;
      if (!local && (mode === 'dating' || workspace === undefined)) {
        expect(component.usersService.stageInitialWorkspace).not.toHaveBeenCalled();
      } else {
        expect(component.usersService.stageInitialWorkspace).toHaveBeenCalledExactlyOnceWith(workspace);
      }
      expect(selection.complete).toHaveBeenCalledOnce();
      expect(selection.fail).not.toHaveBeenCalled();
    });

    it(`keeps a rejected ${local ? 'local' : 'HTTP'} navigation unsuccessful`, async () => {
      const { component, selection } = fixture(local);
      component.router.navigateByUrl.mockResolvedValue(false);
      await component.onDemoUserSelected(selection);
      expect(selection.complete).not.toHaveBeenCalled();
      expect(selection.fail).toHaveBeenCalledOnce();
    });
  }
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
  const session = { kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'session-a', profile: { id: 'member' } };
  for (const savedLocation of [false, true]) {
    it(`continues after authentication with ${savedLocation ? 'notifications missing' : 'no saved location'}`, async () => {
      const component = entry(savedLocation ? { latitude: 47, longitude: 19 } : undefined);
      component.firebaseMessagingService.entryPermissionPending = true;
      component.appSetupStore = { requestForLogin: vi.fn() };
      await component.runPostSessionGate(session, '/game');
      expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
      expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
      expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
    });
  }
  it.each(['onFirebaseAuthRequested', 'onFirebaseSessionContinueRequested'])(
    '%s retains the busy provider popup until profile loading and navigation finish', async method => {
      const component = entry({ latitude: 47, longitude: 19 });
      let resolveProfile!: (value: unknown) => void;
      let resolveNavigation!: (value: boolean) => void;
      const profile = new Promise(resolve => { resolveProfile = resolve; });
      const navigation = new Promise<boolean>(resolve => { resolveNavigation = resolve; });
      Object.assign(component, {
        showFirebaseAuthPopup: true, firebaseEntryTransitionBusy: false,
        redirectUrl: () => '/game', firebaseEntryAccessApproved: true
      });
      Object.assign(component.sessionService, {
        authBusy: () => false,
        startAuthSession: vi.fn().mockResolvedValue(session),
        restoreAuthSession: vi.fn().mockResolvedValue(session)
      });
      component.usersService.loadUserById.mockReturnValue(profile);
      component.router.navigateByUrl.mockReturnValue(navigation);
      const pending = component[method]({ provider: 'google' });
      await vi.waitFor(() => expect(component.usersService.loadUserById).toHaveBeenCalled());
      expect(component.showFirebaseAuthPopup).toBe(true);
      expect(component.firebaseAuthIsBusy).toBe(true);
      component.closeFirebaseAuthPopup();
      expect(component.showFirebaseAuthPopup).toBe(true);
      resolveProfile({ id: 'member', locationCoordinates: { latitude: 47, longitude: 19 } });
      await vi.waitFor(() => expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game'));
      expect(component.showFirebaseAuthPopup).toBe(true);
      expect(component.firebaseAuthIsBusy).toBe(true);
      resolveNavigation(false);
      await pending;
      expect(component.showFirebaseAuthPopup).toBe(true);
      expect(component.firebaseAuthIsBusy).toBe(false);
    }
  );
  it('keeps the provider dialog open when authentication fails', async () => {
    const component = entry();
    component.showFirebaseAuthPopup = true;
    component.sessionService.startAuthSession = vi.fn().mockResolvedValue(null);
    await component.onFirebaseAuthRequested({ provider: 'google' });
    expect(component.showFirebaseAuthPopup).toBe(true);
    expect(component.usersService.loadUserById).not.toHaveBeenCalled();
  });
  it('binds the anonymous approved point to the successful Firebase account before its profile read', async () => {
    const component = entry();
    const point = { latitude: 47, longitude: 19 };
    Object.assign(component, {
      pendingFirebaseEntryCoordinates: point,
      firebaseEntryAccessApproved: true,
      redirectUrl: () => '/game',
      runPostSessionGate: vi.fn(async () => {
        expect(component.appLocationService.stageLoginCoordinates).toHaveBeenCalledWith('member', point);
      })
    });
    component.sessionService.startAuthSession = vi.fn().mockResolvedValue(session);
    component.appLocationService.stageLoginCoordinates = vi.fn();
    await component.onFirebaseAuthRequested({ provider: 'google' });
    expect(component.runPostSessionGate).toHaveBeenCalledWith(session, '/game', undefined, true);
    expect(component.pendingFirebaseEntryCoordinates).toBeNull();
  });
  it('does not reopen optional notification setup after the approved entry popup was closed', async () => {
    const component = entry({ latitude: 47, longitude: 19 });
    component.firebaseMessagingService.entryPermissionPending = true;
    component.appSetupStore = { requestForLogin: vi.fn() };
    await component.runPostSessionGate(session, '/game', undefined, true);
    expect(component.appSetupStore.requestForLogin).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
  });
  it('enters on the first attempt using stored server coordinates without probing browser permission', async () => {
    const component = entry({ latitude: 47, longitude: 19 });
    await component.runPostSessionGate(session, '/game');
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
  });
  it('keeps notifications optional with a saved location', async () => {
    const component = entry({ latitude: 47, longitude: 19 });
    component.firebaseMessagingService.entryPermissionPending = true;
    const requestForLogin = vi.fn().mockResolvedValue(true);
    Object.assign(component, { appSetupStore: { requestForLogin } });
    await component.runPostSessionGate(session, '/game');
    expect(requestForLogin).not.toHaveBeenCalled();
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    expect(component.router.navigateByUrl).toHaveBeenCalledWith('/game');
  });
  it('does not request initial device coordinates during authentication', async () => {
    const component = entry();
    await component.runPostSessionGate(session, '/game');
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    component.ensureHttpLoginAccessAllowed.mockClear();
    component.appLocationService.pendingLoginCoordinates.mockReturnValue({ latitude: 47, longitude: 19 });
    await component.runPostSessionGate(session, '/game');
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
  });
});


describe('landing diagnostics for automatic privacy gating', () => {
  it('reports the actual automatic popup transition once, including its close', () => {
    const mark = vi.fn();
    window.__myscouteeLandingDebug = { mark, error: vi.fn(), finish: vi.fn() };
    try {
      const component = Object.assign(Object.create(EntryPageComponent.prototype), {
        entryConsentPopupOpen: false, landingContentRequestToken: 1,
        entryNetworkUnavailable: false, entryConsentViewOnly: false,
        endEntryPrivacyLoadingWindow: vi.fn(), syncEntryPrivacyApprovalsForRevision: vi.fn(),
        shouldPromptEntryConsent: () => true, loadEntryConsentState: () => null,
        changeDetectorRef: { markForCheck: vi.fn() }, onEntryConsentStateChanged: vi.fn()
      });
      component.finishEntryPrivacyLoad(1, true);
      expect(component.showEntryConsentPopup).toBe(true);
      expect(mark).toHaveBeenCalledExactlyOnceWith('privacy.open');
      component.finishEntryPrivacyLoad(1, true);
      expect(mark).toHaveBeenCalledTimes(1);
      component.showEntryConsentPopup = false;
      expect(mark).toHaveBeenLastCalledWith('privacy.close');
    } finally { delete window.__myscouteeLandingDebug; }
  });
});

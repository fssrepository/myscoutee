import { EntryPageComponent } from './entry-page.component';

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
  it('waits for an explicit user action while browser permission is prompt', async () => {
    const component = Object.create(EntryPageComponent.prototype) as {
      grantedLocationEligibilityRequestToken: number;
      queryGeolocationPermissionState: ReturnType<typeof vi.fn>;
      requestCurrentLocation: ReturnType<typeof vi.fn>;
      resolveBrowserLocationAccess: (requestToken: number) => Promise<void>;
    };
    component.grantedLocationEligibilityRequestToken = 7;
    component.queryGeolocationPermissionState = vi.fn().mockResolvedValue('prompt');
    component.requestCurrentLocation = vi.fn();

    await component.resolveBrowserLocationAccess(7);

    expect(component.queryGeolocationPermissionState).toHaveBeenCalledOnce();
    expect(component.requestCurrentLocation).not.toHaveBeenCalled();
  });
});

describe('EntryPageComponent demo session routing', () => {
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

    await component.onDemoUserSelected({
      userId: 'demo-user',
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

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppLocationService } from '../../../../core/base/services/accounts/app-location.service';
import { FirebaseMessagingService } from '../../../../core/base/services/notifications/firebase-messaging.service';
import { I18nService } from '../../../../core/base/services/localization/i18n.service';
import { PwaService } from '../../../../core/base/services/platform/pwa.service';
import { UserProfileStore } from '../profile/user-profile.store';
import { AppSetupStore } from './app-setup.store';
import { APP_STORAGE_KEYS } from '../../../../core/common/storage-scope';
import { EntryPageComponent } from '../../../../../entry/components/entry-page/entry-page.component';

describe('Setup launcher counts available device choices', () => {
  afterEach(() => {
    TestBed.resetTestingModule(); vi.unstubAllGlobals();
    localStorage.removeItem(APP_STORAGE_KEYS.locationTrackingEnabled);
  });

  it.each([true, false, null])('uses the saved location choice (%s) for Login without waiting for a native result', async saved => {
    localStorage.removeItem(APP_STORAGE_KEYS.locationTrackingEnabled);
    if (saved !== null) localStorage.setItem(APP_STORAGE_KEYS.locationTrackingEnabled, String(saved));
    const query = vi.fn(() => new Promise<PermissionStatus>(() => {}));
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { permissions: { query }, geolocation: { getCurrentPosition } });
    TestBed.configureTestingModule({ providers: [
      { provide: PwaService, useValue: {} },
      { provide: AppLocationService, useValue: {
        trackingEnabled: () => saved !== false,
        hasSavedTrackingApproval: AppLocationService.prototype.hasSavedTrackingApproval
      } },
      { provide: FirebaseMessagingService, useValue: {
        deviceNotificationsEnabled: () => false, refreshNotificationPermission: vi.fn(),
        prepareNotificationConfiguration: vi.fn().mockResolvedValue(undefined)
      } },
      { provide: UserProfileStore, useValue: { activeUserId: () => '', activeUserLocationMissing: () => false } },
      { provide: I18nService, useValue: {} }
    ] });
    const store = TestBed.inject(AppSetupStore);
    expect(store.locationSetupMissing()).toBe(saved !== true);
    expect(query).not.toHaveBeenCalled();
    const entry = Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false, entryAuthUnavailable: false, loginEligibilityBusy: false,
      showFirebaseAuthPopup: false, sessionService: { authMode: 'firebase', firebaseProfile: () => null },
      synchronizeDeploymentAuthMode: vi.fn().mockResolvedValue(undefined),
      ensureEntryConsent: vi.fn().mockResolvedValue(true), isLoginBlockedByLandingBundle: () => false,
      landingGuide: { closePopup: vi.fn() }, appSetupStore: store,
      ensureFirebaseAuthPopupLoaded: vi.fn().mockResolvedValue(undefined)
    });
    await entry.openEntryAuthPopup();
    expect(entry.showFirebaseAuthPopup).toBe(saved === true);
    expect(store.isOpen()).toBe(saved !== true);
    expect(query).toHaveBeenCalledTimes(saved === true ? 0 : 1);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(localStorage.getItem(APP_STORAGE_KEYS.locationTrackingEnabled)).toBe(saved === null ? null : String(saved));
  });

  it('excludes unavailable installation and notifications, and tracks capability changes', async () => {
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockRejectedValue(new Error('Unsupported')) } });
    const installAvailable = signal(false), installActionPending = signal(false), installed = signal(false);
    const configured = signal(false), enabled = signal(false);
    TestBed.configureTestingModule({ providers: [
      { provide: PwaService, useValue: { installAvailable, installActionPending, installed } },
      { provide: AppLocationService, useValue: { trackingEnabled: () => true, hasSavedTrackingApproval: () => false } },
      { provide: FirebaseMessagingService, useValue: {
        get notificationsConfigured() { return configured(); },
        deviceNotificationsEnabled: enabled, refreshNotificationPermission: vi.fn()
      } },
      { provide: UserProfileStore, useValue: { activeUserId: () => '', activeUserLocationMissing: () => false } },
      { provide: I18nService, useValue: {} }
    ] });
    const store = TestBed.inject(AppSetupStore);
    await store.refreshPermissions();
    configured.set(true); installAvailable.set(true);
    expect(store.missingCount()).toBe(4);
    store.privacyMissing.set(false);
    expect(store.missingCount()).toBe(3);
    configured.set(false); installAvailable.set(false);
    expect(store.missingCount()).toBe(1);
    store.locationGranted.set(true);
    expect(store.missingCount()).toBe(0);
    expect(store.launcherVisible()).toBe(false);
    installAvailable.set(true);
    expect(store.missingCount()).toBe(1);
    expect(store.launcherVisible()).toBe(true);
    configured.set(true);
    expect(store.missingCount()).toBe(2);
    installAvailable.set(false);
    installActionPending.set(true);
    expect(store.missingCount()).toBe(2);
    installed.set(true);
    installActionPending.set(false);
    expect(store.missingCount()).toBe(1);
    enabled.set(true);
    expect(store.missingCount()).toBe(0);
    expect(store.launcherVisible()).toBe(false);
    store.isOpen.set(true);
    store.openPrivacy();
    expect(store.privacyRequested()).toBe(true);
    expect(store.isOpen()).toBe(true);
  });
});

describe('Setup acquisition timer starts at permission grant', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function setup(initialState: PermissionState = 'denied') {
    const permission = { state: initialState, onchange: null as (() => void) | null };
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue(permission) } });
    let finish!: (point: { latitude: number; longitude: number } | null) => void;
    let requestSignal!: AbortSignal;
    const requestCurrentCoordinates = vi.fn().mockImplementation((signal: AbortSignal) => new Promise(resolve => {
      requestSignal = signal;
      finish = resolve;
      signal.addEventListener('abort', () => resolve(null), { once: true });
    }));
    const store = Object.assign(Object.create(AppSetupStore.prototype), {
      activeControl: signal(null),
      isOpen: signal(true), loginRequested: signal(false), nativePending: signal(false), busy: signal(false),
      actionPending: () => store.nativePending() || store.busy(),
      allowDisabled: () => false, loggedIn: () => true, locationMissing: () => true,
      locationSelected: signal(true), notificationsSelected: signal(false),
      locationGranted: signal(initialState === 'granted'), locationPermission: signal(initialState),
      locationPermissionPending: signal(false), notificationConfigurationPending: signal(false),
      locationEdited: signal(true), error: signal(''), saveSucceeded: signal(false),
      generation: 1, permission: null, locationRequestPending: false,
      locationRequestAbort: null, locationRequestTimer: null, saveFeedbackTimer: null,
      completeLogin: null, checkLocation: null,
      location: { requestCurrentCoordinates, saveCurrentCoordinates: vi.fn().mockResolvedValue(true),
        trackingEnabled: () => true, setTrackingEnabled: vi.fn() },
      messaging: { refreshNotificationPermission: vi.fn(), deviceNotificationsEnabled: () => false },
      pwa: { dismissInstallPrompt: vi.fn() },
      i18n: { translate: (value: string) => value }
    });
    await store.refreshPermissions();
    const grant = () => { permission.state = 'granted'; permission.onchange?.(); };
    return { store, grant, requestCurrentCoordinates,
      finish: (point: { latitude: number; longitude: number } | null) => finish(point),
      requestSignal: () => requestSignal };
  }

  it('does not start the ring or timeout while permission is pending, then allows all ten seconds', async () => {
    const { store, grant, requestSignal, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(store.busy()).toBe(false);
    expect(requestSignal().aborted).toBe(false);
    expect(store.error()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    grant();
    expect(store.busy()).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(9999);
    expect(requestSignal().aborted).toBe(false);
    expect(store.error()).toBe('');
    await vi.advanceTimersByTimeAsync(1);
    await saving;
    expect(requestSignal().aborted).toBe(true);
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.error()).toBe('entry.permissions.location.unavailable');
    expect(store.busy()).toBe(false);
    expect(store.location.saveCurrentCoordinates).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a point nine seconds after granting permission, regardless of time spent deciding', async () => {
    const { store, grant, finish, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    await vi.advanceTimersByTimeAsync(40_000);
    grant();
    await vi.advanceTimersByTimeAsync(9000);
    finish({ latitude: 47, longitude: 19 });
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.location.saveCurrentCoordinates).toHaveBeenCalledExactlyOnceWith({ latitude: 47, longitude: 19 });
    expect(store.saveSucceeded()).toBe(true);
    expect(store.isOpen()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.error()).toBe('');
  });

  it('does not reset the running timer on focus or another permission refresh', async () => {
    const { store, grant, requestSignal } = await setup();
    const saving = store.allow();
    grant();
    await vi.advanceTimersByTimeAsync(7000);
    await store.refreshPermissions();
    await vi.advanceTimersByTimeAsync(3000);
    await saving;
    expect(requestSignal().aborted).toBe(true);
    expect(store.saveSucceeded()).toBe(false);
  });

  it('starts immediately when permission was already granted', async () => {
    const { store, requestSignal } = await setup('granted');
    const saving = store.allow();
    expect(store.busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(9999);
    expect(requestSignal().aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await saving;
    expect(requestSignal().aborted).toBe(true);
  });

  it('reports actual denial without starting a timer or retrying', async () => {
    const { store, finish, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    finish(null);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.error()).toBe('entry.permissions.location.blocked');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])('cancels acquisition on close without saving or retrying (granted: %s)', async granted => {
    const { store, grant, requestSignal, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    if (granted) grant();
    store.close();
    await saving;
    expect(requestSignal().aborted).toBe(true);
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.location.saveCurrentCoordinates).not.toHaveBeenCalled();
    expect(store.error()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Setup explicit Login action and independent Close', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(checkLocation: boolean) {
    return Object.assign(Object.create(AppSetupStore.prototype), {
      activeControl: signal(null),
      isOpen: signal(true), loginRequested: signal(false), nativePending: signal(false), busy: signal(false),
      allowDisabled: () => false, loggedIn: () => false,
      locationSelected: signal(true), notificationsSelected: signal(false),
      locationGranted: signal(true), locationPermission: signal('granted'),
      locationPermissionPending: signal(false), notificationConfigurationPending: signal(false),
      locationEdited: signal(false), error: signal(''), saveSucceeded: signal(false),
      actionPending: () => false, generation: 1, permission: null,
      saveFeedbackTimer: null,
      completeLogin: vi.fn(),
      checkLocation: checkLocation ? vi.fn().mockResolvedValue(true) : null,
      location: {
        requestCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
        setTrackingEnabled: vi.fn()
      },
      messaging: { deviceNotificationsEnabled: () => false },
      pwa: { dismissInstallPrompt: vi.fn() },
      i18n: { translate: (value: string) => value }
    });
  }

  it.each([true, false])('continues only through successful Login (location check: %s)', async checkLocation => {
    const store = setup(checkLocation);
    store.loginRequested.set(true);
    const continuation = store.completeLogin;
    await store.allow();
    expect(store.isOpen()).toBe(false);
    expect(store.loginRequested()).toBe(false);
    expect(continuation).toHaveBeenCalledExactlyOnceWith(true);
    store.close();
    expect(continuation).toHaveBeenCalledOnce();
  });

  it.each([true, false])('Close cancels Login even with location granted (location check: %s)', checkLocation => {
    const store = setup(checkLocation);
    const continuation = store.completeLogin;
    store.close();
    expect(store.isOpen()).toBe(false);
    expect(continuation).toHaveBeenCalledExactlyOnceWith(false);
    expect(store.location.requestCurrentCoordinates).not.toHaveBeenCalled();
  });

  it('does not continue after a rejected location check', async () => {
    const store = setup(true);
    const continuation = store.completeLogin;
    store.checkLocation.mockRejectedValue(new Error('Outside supported region'));
    await store.allow();
    expect(store.isOpen()).toBe(true);
    expect(store.error()).toBe('Outside supported region');
    store.close();
    expect(continuation).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('applies notification changes from the switch without requiring location', async () => {
    const store = setup(false);
    let grant!: (permission: NotificationPermission) => void;
    let registered!: () => void;
    Object.assign(store, {
      completeLogin: null, activeControl: signal(null), notificationsEdited: signal(false),
      locationSelected: signal(false), locationGranted: signal(false), notificationsSelected: signal(false),
      actionPending: () => store.nativePending() || store.busy()
    });
    Object.assign(store.messaging, { notificationsConfigured: true,
      requestEntryPermission: vi.fn().mockImplementation(() => new Promise(resolve => { grant = resolve; })),
      setDeviceNotificationsEnabled: vi.fn().mockImplementation(() => new Promise<void>(resolve => { registered = resolve; })) });
    store.toggleNotifications();
    expect(store.activeControl()).toBe('notifications');
    expect(store.nativePending()).toBe(true);
    expect(store.busy()).toBe(false);
    expect(store.messaging.setDeviceNotificationsEnabled).not.toHaveBeenCalled();
    grant('granted');
    await vi.waitFor(() => expect(store.busy()).toBe(true));
    expect(store.nativePending()).toBe(false);
    registered();
    await vi.waitFor(() => expect(store.saveSucceeded()).toBe(true));
    expect(store.messaging.requestEntryPermission).toHaveBeenCalledOnce();
    expect(store.messaging.setDeviceNotificationsEnabled).toHaveBeenCalledExactlyOnceWith(true);
    expect(store.location.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(store.location.setTrackingEnabled).not.toHaveBeenCalled();
    expect(store.isOpen()).toBe(true);
  });

  it('applies location from its switch and disables tracking without another permission request', async () => {
    const store = setup(false);
    Object.assign(store, { completeLogin: null, locationSelected: signal(false), locationGranted: signal(false),
      actionPending: () => store.nativePending() || store.busy() });
    store.toggleLocation();
    expect(store.activeControl()).toBe('location');
    await vi.waitFor(() => expect(store.saveSucceeded()).toBe(true));
    expect(store.location.requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.location.setTrackingEnabled).toHaveBeenLastCalledWith(true);
    store.toggleLocation();
    await vi.waitFor(() => expect(store.location.setTrackingEnabled).toHaveBeenLastCalledWith(false));
    expect(store.location.requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.isOpen()).toBe(true);
  });

  it('keeps settings Update open and shows save feedback', async () => {
    const store = setup(false);
    store.completeLogin = null;
    await store.allow();
    expect(store.isOpen()).toBe(true);
    expect(store.saveSucceeded()).toBe(true);
    store.close();
    expect(store.isOpen()).toBe(false);
  });

});


describe('Entry setup guidance only for missing location', () => {
  it.each([0, 1, 2])('does not request a guide for %i other missing device choices', missingCount => {
    const store = Object.assign(Object.create(AppSetupStore.prototype), {
      locationSetupMissing: () => false, missingCount: () => missingCount,
      launcherDismissed: signal(true), guideRequested: signal(false)
    });
    expect(store.explainMissingSetup()).toBe(false);
    expect(store.guideRequested()).toBe(false);
    expect(store.launcherDismissed()).toBe(true);
  });

  it('restores the setup launcher and requests a guide when location is missing', () => {
    const store = Object.assign(Object.create(AppSetupStore.prototype), {
      locationSetupMissing: () => true, missingCount: () => 1,
      launcherDismissed: signal(true), guideRequested: signal(false)
    });
    expect(store.explainMissingSetup()).toBe(true);
    expect(store.guideRequested()).toBe(true);
    expect(store.launcherDismissed()).toBe(false);
  });
});

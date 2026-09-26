import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { getToken, getMessaging, isSupported, onMessage } from 'firebase/messaging';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { FirebaseAppService } from './firebase-app.service';
import { DeviceRegistrationsService } from './device-registrations.service';
import { DeploymentConfigurationService } from './deployment-configuration.service';
import { I18nService } from './i18n.service';
import { AppLocationService } from './app-location.service';
import { PwaService } from './pwa.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { AppSetupStore } from '../../../ui/context/stores/app-setup.store';
import { AppSetupPopupComponent } from '../../../ui/components/app-setup-popup/app-setup-popup.component';

vi.mock('firebase/messaging', () => ({
  getToken: vi.fn(), getMessaging: vi.fn(), isSupported: vi.fn(),
  onMessage: vi.fn(), deleteToken: vi.fn()
}));

describe('Notification preference and background registration', () => {
  const runtime = { app: {}, config: { vapidKey: 'test-vapid' } };
  const upsert = vi.fn();
  const ensureFirebaseRuntime = vi.fn();
  const ready = vi.fn();
  const activeRuntime = vi.fn();
  const remove = vi.fn();
  const messagingConfigured = signal(true);
  const activeUserId = signal('user-1');
  const locationMissing = signal(false);
  const reloadDeployment = vi.fn();
  let setup: AppSetupStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    messagingConfigured.set(true);
    activeUserId.set('user-1');
    locationMissing.set(false);
    reloadDeployment.mockResolvedValue(undefined);
    localStorage.clear();
    localStorage.setItem(APP_STORAGE_KEYS.messagingDeviceEnabled, 'false');
    vi.stubGlobal('Notification', { permission: 'granted' });
    ready.mockReturnValue(Promise.resolve({}));
    vi.stubGlobal('navigator', {
      serviceWorker: { get ready() { return ready(); } },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) }
    });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn()
    }));
    vi.mocked(isSupported).mockResolvedValue(true);
    vi.mocked(getMessaging).mockReturnValue({} as ReturnType<typeof getMessaging>);
    vi.mocked(onMessage).mockReturnValue(() => undefined);
    upsert.mockResolvedValue(undefined);
    ensureFirebaseRuntime.mockResolvedValue(runtime);
    activeRuntime.mockReturnValue(runtime);
    TestBed.configureTestingModule({ providers: [
      FirebaseMessagingService, AppSetupStore,
      { provide: DeviceRegistrationsService, useValue: { isLocal: false, upsert, remove } },
      { provide: FirebaseAppService, useValue: { ensureFirebaseRuntime, activeRuntime } },
      { provide: DeploymentConfigurationService, useValue: {
        firebaseMessagingConfigured: messagingConfigured, reload: reloadDeployment
      } },
      { provide: I18nService, useValue: { revision: () => 0, translate: (key: string) => key } },
      { provide: AppLocationService, useValue: {
        trackingEnabled: signal(true), setTrackingEnabled: vi.fn(),
        requestCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
        saveCurrentCoordinates: vi.fn().mockResolvedValue(true),
        syncGrantedLocationForActiveUser: vi.fn().mockResolvedValue(undefined)
      } },
      { provide: PwaService, useValue: { dismissInstallPrompt: vi.fn(),
        installAvailable: () => false, installActionPending: () => false,
        installPromptVisible: () => false } },
      { provide: UserProfileStore, useValue: {
        activeUserId, activeUserLocationMissing: locationMissing, activeNotificationDevices: () => []
      } }
    ] });
    const messaging = TestBed.inject(FirebaseMessagingService);
    // Exercise the production HTTP path under the local unit-test environment.
    vi.spyOn(messaging as unknown as { enabled: boolean }, 'enabled', 'get').mockReturnValue(true);
    setup = TestBed.inject(AppSetupStore);
    setup.open();
    await vi.advanceTimersByTimeAsync(0);
    setup.toggleNotifications();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(['granted', 'prompt'] as const)('renders the initial %s location state without first rendering OFF', async state => {
    setup.close();
    let resolvePermission!: (permission: PermissionStatus) => void;
    vi.mocked(navigator.permissions.query).mockReturnValue(new Promise(resolve => resolvePermission = resolve));
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    setup.open();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-popup')).toBeNull();
    resolvePermission({ state } as PermissionStatus);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="app.setup.location"]');
    expect(button.getAttribute('aria-pressed')).toBe(String(state === 'granted'));
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('does not reopen a popup that was closed while its initial permissions were being read', async () => {
    setup.close();
    let resolvePermission!: (permission: PermissionStatus) => void;
    vi.mocked(navigator.permissions.query).mockReturnValue(new Promise(resolve => resolvePermission = resolve));
    setup.open();
    setup.close();
    resolvePermission({ state: 'granted' } as PermissionStatus);
    await vi.advanceTimersByTimeAsync(0);
    expect(setup.isOpen()).toBe(false);
  });

  it('renders success on the actual Update button after a click and keeps the popup open', async () => {
    vi.mocked(getToken).mockResolvedValue('saved-token');
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.app-setup-action button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('true');
    expect(button.classList.contains('app-menu__palette--green')).toBe(true);
    expect(button.classList.contains('app-menu__button-row-item--progress-success')).toBe(true);
    expect(button.textContent).toContain('check_circle');
    expect(fixture.nativeElement.querySelector('app-popup')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(button.classList.contains('app-menu__palette--blue')).toBe(true);
    expect(button.classList.contains('app-menu__button-row-item--progress-success')).toBe(false);
    fixture.destroy();
  });

  it('disables and clears the notification toggle without a Messaging credential even when VAPID exists', async () => {
    messagingConfigured.set(false);
    setup.close();
    setup.open();
    await vi.advanceTimersByTimeAsync(0);
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const button = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: any) => b.textContent.includes('app.setup.notifications')) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(activeRuntime()?.config.vapidKey).toBe('test-vapid');
    button.click();
    expect(setup.notificationsSelected()).toBe(false);
    expect(getToken).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('does not start background Firebase or device registration when Messaging credentials are absent', async () => {
    messagingConfigured.set(false);
    const messaging = TestBed.inject(FirebaseMessagingService);
    messaging.initialize();
    await messaging.setDeviceNotificationsEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(ensureFirebaseRuntime).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('uses the server Messaging capability independently of the VAPID runtime', async () => {
    activeRuntime.mockReturnValue(null);
    messagingConfigured.set(true);
    const messaging = TestBed.inject(FirebaseMessagingService);
    expect(messaging.notificationsConfigured).toBe(true);
    await messaging.prepareNotificationConfiguration();
    expect(reloadDeployment).toHaveBeenCalled();
    expect(ensureFirebaseRuntime).not.toHaveBeenCalled();
  });

  it('shows a one-second success indication even when Save finishes immediately', async () => {
    vi.mocked(getToken).mockResolvedValue('saved-token');
    await setup.allow();
    expect(setup.actionPending()).toBe(false);
    expect(setup.saveSucceeded()).toBe(true);
    expect(setup.isOpen()).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(setup.saveSucceeded()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(setup.saveSucceeded()).toBe(false);
  });

  it('clears success for edits and does not show it when a subsequent save fails', async () => {
    vi.mocked(getToken).mockResolvedValue('saved-token');
    await setup.allow();
    expect(setup.saveSucceeded()).toBe(true);
    setup.toggleNotifications();
    expect(setup.saveSucceeded()).toBe(false);
    vi.spyOn(TestBed.inject(FirebaseMessagingService), 'setDeviceNotificationsEnabled')
      .mockRejectedValueOnce(new Error('save failed'));
    await setup.allow();
    expect(setup.error()).toBe('save failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.actionPending()).toBe(false);
  });

  it('does not retain a previous save indication after closing and reopening settings', async () => {
    vi.mocked(getToken).mockResolvedValue('saved-token');
    await setup.allow();
    expect(setup.saveSucceeded()).toBe(true);
    setup.close();
    setup.open();
    expect(setup.saveSucceeded()).toBe(false);
  });

  it('preserves the ON draft and reports Firebase rejection without displaying success', async () => {
    vi.mocked(getToken).mockRejectedValue(new Error('Firebase error'));
    await setup.allow();
    expect(setup.isOpen()).toBe(true);
    expect(setup.error()).toBe('entry.permissions.notifications.failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.actionPending()).toBe(false);
    expect(setup.notificationsSelected()).toBe(true);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('false');
    setup.close();
    setup.open();
    expect(setup.notificationsSelected()).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reports token timeout without success or accepting its late result', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    const saving = setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    expect(setup.actionPending()).toBe(true);
    expect(setup.saveSucceeded()).toBe(false);
    await vi.advanceTimersByTimeAsync(30_001);
    await saving;
    expect(setup.error()).toBe('entry.permissions.notifications.failed');
    expect(setup.notificationsSelected()).toBe(true);
    expect(setup.saveSucceeded()).toBe(false);
    resolveToken('late-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saves notification settings without starting location synchronization', async () => {
    vi.mocked(getToken).mockResolvedValue('new-token');
    const location = TestBed.inject(AppLocationService);
    vi.mocked(location.syncGrantedLocationForActiveUser).mockReturnValue(new Promise(() => {}));
    await setup.allow();
    expect(location.syncGrantedLocationForActiveUser).not.toHaveBeenCalled();
    expect(location.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(location.saveCurrentCoordinates).not.toHaveBeenCalled();
    expect(setup.actionPending()).toBe(false);
    expect(setup.isOpen()).toBe(true);
  });

  it('requests missing member location from the avatar permission popup and waits for its save', async () => {
    locationMissing.set(true);
    setup.notificationsSelected.set(false);
    const permission = { state: 'prompt', onchange: null as (() => void) | null };
    vi.mocked(navigator.permissions.query).mockResolvedValue(permission as PermissionStatus);
    await setup.refreshPermissions();
    setup.locationSelected.set(false);
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.toggles().find(item => item.id === 'location')?.disabled).toBe(false);
    fixture.componentInstance.toggle({ id: 'location' } as any);
    const location = TestBed.inject(AppLocationService);
    let resolveCoordinates!: (value: { latitude: number; longitude: number }) => void;
    let resolveSave!: (value: boolean) => void;
    vi.mocked(location.requestCurrentCoordinates).mockReturnValue(new Promise(resolve => resolveCoordinates = resolve));
    vi.mocked(location.saveCurrentCoordinates).mockReturnValue(new Promise(resolve => resolveSave = resolve));
    const saving = setup.allow();
    expect(location.requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(setup.busy()).toBe(false);
    permission.state = 'granted';
    permission.onchange?.();
    expect(setup.busy()).toBe(true);
    resolveCoordinates({ latitude: 47, longitude: 19 });
    await vi.advanceTimersByTimeAsync(0);
    expect(location.saveCurrentCoordinates).toHaveBeenCalledWith({ latitude: 47, longitude: 19 });
    expect(setup.saveSucceeded()).toBe(false);
    resolveSave(true);
    await saving;
    expect(setup.saveSucceeded()).toBe(true);
    expect(location.requestCurrentCoordinates).toHaveBeenCalledOnce();
    fixture.destroy();
  });

  it('does not report success if the first member location cannot be saved', async () => {
    locationMissing.set(true);
    setup.notificationsSelected.set(false);
    vi.mocked(TestBed.inject(AppLocationService).saveCurrentCoordinates).mockRejectedValue(new Error('Save failed'));
    await setup.allow();
    expect(setup.error()).toBe('Save failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.isOpen()).toBe(true);
  });

  it('leaves an already granted and saved location to background synchronization', async () => {
    setup.notificationsSelected.set(false);
    const location = TestBed.inject(AppLocationService);
    await setup.allow();
    expect(location.saveCurrentCoordinates).not.toHaveBeenCalled();
    expect(location.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(setup.saveSucceeded()).toBe(true);
  });

  it('stops before native permission, worker and token when Messaging is not configured', async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    messagingConfigured.set(false);
    activeRuntime.mockReturnValue(null);
    ensureFirebaseRuntime.mockResolvedValue(null);
    setup.close();
    setup.open();
    await vi.advanceTimersByTimeAsync(0);
    setup.toggleNotifications();
    await setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(setup.notificationsSelected()).toBe(false);
    expect(TestBed.inject(FirebaseMessagingService).deviceNotificationsEnabled()).toBe(false);
    expect(ready).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(setup.actionPending()).toBe(false);
    expect(setup.isOpen()).toBe(true);
  });

  it('keeps Save pending until the token and server registration complete', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    const saving = setup.allow();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(setup.actionPending()).toBe(true);
    expect(setup.saveSucceeded()).toBe(false);
    resolveToken('new-token');
    await saving;
    expect(upsert).toHaveBeenCalledOnce();
    expect(setup.saveSucceeded()).toBe(true);
    expect(setup.actionPending()).toBe(false);
    expect(setup.isOpen()).toBe(true);
  });

  it('does not open a native permission prompt from background registration', async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    localStorage.setItem(APP_STORAGE_KEYS.messagingDeviceEnabled, 'true');
    await TestBed.inject(FirebaseMessagingService).setDeviceNotificationsEnabled(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('checks configuration before waiting for a service worker', async () => {
    ensureFirebaseRuntime.mockResolvedValue(null);
    await setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    expect(setup.error()).toBe('entry.permissions.notifications.failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(ready).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('does not display success before the server acknowledges the device write', async () => {
    let finishWrite!: () => void;
    vi.mocked(getToken).mockResolvedValue('new-token');
    upsert.mockReturnValue(new Promise<void>(resolve => { finishWrite = resolve; }));
    const saving = setup.allow();
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledOnce();
    expect(setup.actionPending()).toBe(true);
    expect(setup.saveSucceeded()).toBe(false);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingToken)).toBeNull();
    finishWrite();
    await saving;
    expect(setup.saveSucceeded()).toBe(true);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingToken)).toBe('new-token');
  });

  it('asks for native permission in the click gesture and waits before registering', async () => {
    let decide!: (permission: NotificationPermission) => void;
    const requestPermission = vi.fn(() => new Promise<NotificationPermission>(resolve => { decide = resolve; }));
    const notification = { permission: 'default', requestPermission };
    vi.stubGlobal('Notification', notification);
    vi.mocked(getToken).mockResolvedValue('new-token');
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const saving = setup.allow();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(getToken).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(setup.nativePending()).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.app-setup-action button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.classList.contains('app-menu__button-row-item--progress')).toBe(false);
    expect(button.querySelector('app-indicator')).toBeNull();
    await setup.allow();
    expect(requestPermission).toHaveBeenCalledOnce();
    notification.permission = 'granted';
    decide('granted');
    await saving;
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(setup.isOpen()).toBe(true);
    fixture.destroy();
  });

  it('can disable app location tracking while native permission remains granted and does not erase saved coordinates', async () => {
    const location = TestBed.inject(AppLocationService);
    expect(setup.locationGranted()).toBe(true);
    setup.toggleLocation();
    expect(setup.locationSelected()).toBe(false);
    await setup.allow();
    expect(location.setTrackingEnabled).toHaveBeenCalledWith(false);
    expect(location.requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(location.saveCurrentCoordinates).not.toHaveBeenCalled();
    await setup.refreshPermissions();
    expect(setup.locationSelected()).toBe(false);
  });

  it('starts the ring only after both native decisions and keeps it while acquiring coordinates', async () => {
    let allowNotifications!: (permission: NotificationPermission) => void;
    const notification = { permission: 'default', requestPermission: vi.fn(() =>
      new Promise<NotificationPermission>(resolve => { allowNotifications = resolve; })) };
    vi.stubGlobal('Notification', notification);
    const permission = { state: 'prompt', onchange: null } as unknown as PermissionStatus;
    vi.mocked(navigator.permissions.query).mockResolvedValue(permission);
    await setup.refreshPermissions();
    let finish!: (coordinates: { latitude: number; longitude: number }) => void;
    vi.mocked(TestBed.inject(AppLocationService).requestCurrentCoordinates)
      .mockReturnValue(new Promise(resolve => { finish = resolve; }));
    vi.mocked(getToken).mockResolvedValue('new-token');
    void setup.requestForLogin(vi.fn().mockResolvedValue(true));
    setup.locationSelected.set(true);
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const saving = setup.allow();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.app-setup-action button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.querySelector('app-indicator')).toBeNull();
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    notification.permission = 'granted';
    allowNotifications('granted');
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(false);
    expect(button.querySelector('app-indicator')).toBeNull();
    Object.assign(permission, { state: 'granted' });
    permission.onchange?.call(permission, new Event('change'));
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(button.classList.contains('app-menu__button-row-item--progress-loading')).toBe(true);
    expect(button.querySelector('app-indicator')).not.toBeNull();
    expect((button.querySelector('app-indicator') as HTMLElement).style.getPropertyValue('--app-indicator-duration')).toBe('10000ms');
    finish({ latitude: 47, longitude: 19 });
    await saving;
    fixture.destroy();
  });

  it('keeps Update available before location selection and explains the required choice on click', async () => {
    activeUserId.set('');
    setup.locationSelected.set(false);
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.app-setup-action button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    fixture.detectChanges();
    expect(setup.error()).toBe('entry.permissions.location.required');
    expect(button.classList.contains('app-menu__button-row-item--progress-error')).toBe(true);
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('requests only location when notifications are left off', async () => {
    activeUserId.set('');
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'prompt' } as PermissionStatus);
    setup.close();
    const checkLocation = vi.fn().mockResolvedValue(true);
    const allowed = setup.requestForLogin(checkLocation);
    await vi.advanceTimersByTimeAsync(0);
    setup.locationSelected.set(true);
    expect(setup.notificationsSelected()).toBe(false);
    await setup.allow();
    expect(await allowed).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(checkLocation).toHaveBeenCalledOnce();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('requests only notifications after reopening with location already allowed and checked', async () => {
    activeUserId.set('');
    let decide!: (permission: NotificationPermission) => void;
    const notification = { permission: 'default', requestPermission: vi.fn(() =>
      new Promise<NotificationPermission>(resolve => { decide = resolve; })) };
    vi.stubGlobal('Notification', notification);
    setup.close();
    const allowed = setup.requestForLogin();
    await vi.advanceTimersByTimeAsync(0);
    expect(setup.locationGranted()).toBe(true);
    setup.toggleNotifications();
    const saving = setup.allow();
    expect(notification.requestPermission).toHaveBeenCalledOnce();
    expect(setup.nativePending()).toBe(true);
    expect(setup.busy()).toBe(false);
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    notification.permission = 'granted';
    decide('granted');
    await saving;
    expect(await allowed).toBe(true);
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(TestBed.inject(AppLocationService).syncGrantedLocationForActiveUser).not.toHaveBeenCalled();
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('true');
    expect(setup.isOpen()).toBe(false);
  });

  it('does not refresh location or register unchanged notifications when saving existing permissions', async () => {
    vi.mocked(getToken).mockResolvedValue('saved-token');
    await setup.allow();
    expect(upsert).toHaveBeenCalledOnce();
    upsert.mockClear();
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
    setup.close();
    setup.open();
    await vi.advanceTimersByTimeAsync(0);
    await setup.allow();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(TestBed.inject(AppLocationService).syncGrantedLocationForActiveUser).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(setup.saveSucceeded()).toBe(true);
  });

  it.each(['granted', 'denied'] as const)('reports coordinate failure according to the actual %s permission', async state => {
    vi.mocked(navigator.permissions.query).mockResolvedValue({ state } as PermissionStatus);
    vi.mocked(TestBed.inject(AppLocationService).requestCurrentCoordinates).mockResolvedValue(null);
    const checkLocation = vi.fn();
    void setup.requestForLogin(checkLocation);
    await setup.allow();
    expect(setup.locationPermission()).toBe(state);
    expect(setup.error()).toBe(state === 'denied' ? 'entry.permissions.location.blocked' : 'entry.permissions.location.unavailable');
    expect(checkLocation).not.toHaveBeenCalled();
    expect(setup.actionPending()).toBe(false);
    expect(setup.isOpen()).toBe(true);
    setup.close();
  });

  it('requests native permission again after denial without starting Firebase if it remains denied', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied');
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });
    await setup.allow();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(getToken).not.toHaveBeenCalled();
    expect(setup.error()).toBe('entry.permissions.notifications.blocked');
    expect(setup.actionPending()).toBe(false);
  });

  it.each(['denied', 'default'] as const)('keeps the user ON draft after a %s decision, focus refresh and another Update', async decision => {
    const notification = { permission: 'default', requestPermission: vi.fn().mockImplementation(async () => {
      notification.permission = decision;
      return decision;
    }) };
    vi.stubGlobal('Notification', notification);
    setup.close();
    setup.open();
    await vi.advanceTimersByTimeAsync(0);
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const toggle = () => fixture.nativeElement.querySelector('button[aria-label="app.setup.notifications"]') as HTMLButtonElement;
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    toggle().click();
    fixture.detectChanges();
    const request = vi.spyOn(TestBed.inject(FirebaseMessagingService), 'requestEntryPermission');
    for (let attempt = 1; attempt <= 2; attempt++) {
      await setup.allow();
      await setup.refreshPermissions();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(request).toHaveBeenCalledTimes(attempt);
      expect(notification.requestPermission).toHaveBeenCalledTimes(attempt);
      expect(setup.isOpen()).toBe(true);
    }
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('false');
    expect(upsert).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('preserves a user OFF draft on save failure and a user ON draft after a successful save and device changes', async () => {
    vi.mocked(getToken).mockResolvedValue('saved-token');
    await setup.allow();
    await vi.advanceTimersByTimeAsync(0);
    setup.toggleNotifications();
    vi.spyOn(TestBed.inject(FirebaseMessagingService), 'setDeviceNotificationsEnabled')
      .mockRejectedValueOnce(new Error('save failed'));
    await setup.allow();
    await setup.refreshPermissions();
    await vi.advanceTimersByTimeAsync(0);
    expect(setup.notificationsSelected()).toBe(false);
    setup.toggleNotifications();
    await setup.allow();
    vi.stubGlobal('Notification', { permission: 'denied' });
    await setup.refreshPermissions();
    messagingConfigured.set(false);
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    expect(setup.notificationsSelected()).toBe(true);
  });

  it.each(['denied', 'default'] as const)('stops login after a %s notification result until the user turns notifications OFF', async decision => {
    activeUserId.set('');
    const notification = { permission: 'default', requestPermission: vi.fn().mockResolvedValue(decision) };
    vi.stubGlobal('Notification', notification);
    setup.close();
    const checkLocation = vi.fn().mockResolvedValue(true);
    const completed = vi.fn();
    const login = setup.requestForLogin(checkLocation).then(completed);
    await vi.advanceTimersByTimeAsync(0);
    setup.toggleNotifications();
    await setup.allow();
    await vi.advanceTimersByTimeAsync(0);
    expect(setup.isOpen()).toBe(true);
    expect(setup.notificationsSelected()).toBe(true);
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.error()).toBe('entry.permissions.notifications.blocked');
    expect(completed).not.toHaveBeenCalled();
    expect(checkLocation).not.toHaveBeenCalled();
    expect(TestBed.inject(AppLocationService).requestCurrentCoordinates).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    setup.toggleNotifications();
    await setup.allow();
    await login;
    expect(notification.requestPermission).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledWith(true);
    expect(checkLocation).toHaveBeenCalledOnce();
    expect(setup.notificationsSelected()).toBe(false);
    expect(setup.error()).toBe('');
  });

  it('writes opt-out without waiting for Firebase and keeps the popup open', async () => {
    const messaging = TestBed.inject(FirebaseMessagingService);
    localStorage.setItem(APP_STORAGE_KEYS.messagingUserId, 'user-1');
    localStorage.setItem(APP_STORAGE_KEYS.messagingToken, 'retained-token');
    localStorage.setItem(APP_STORAGE_KEYS.messagingDeviceId, 'device-1');
    ensureFirebaseRuntime.mockClear();
    ensureFirebaseRuntime.mockReturnValue(new Promise(() => {}));
    await messaging.setDeviceNotificationsEnabled(false);
    expect(remove).toHaveBeenCalledWith({ userId: 'user-1', deviceId: 'device-1', firebaseToken: 'retained-token' });
    expect(ensureFirebaseRuntime).not.toHaveBeenCalled();
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('false');
    expect(setup.isOpen()).toBe(true);
  });

  it('does not overwrite a newer OFF when token acquisition finishes', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    const saving = setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    await TestBed.inject(FirebaseMessagingService).setDeviceNotificationsEnabled(false);
    resolveToken('stale-token');
    await saving;
    expect(upsert).not.toHaveBeenCalled();
    expect(setup.saveSucceeded()).toBe(false);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('false');
  });

  it('still completes and closes the separate login permission gate', async () => {
    vi.mocked(getToken).mockResolvedValue('new-token');
    const allowed = setup.requestForLogin(vi.fn().mockResolvedValue(true));
    await setup.allow();
    expect(await allowed).toBe(true);
    expect(setup.isOpen()).toBe(false);
    expect(setup.actionPending()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
  });

  it('preserves the ON draft on server failure and retries without toggling again', async () => {
    vi.mocked(getToken).mockResolvedValue('new-token');
    upsert.mockRejectedValueOnce(new Error('server unavailable'));
    await setup.allow();
    expect(setup.error()).toBe('entry.permissions.notifications.failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.notificationsSelected()).toBe(true);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('false');
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingToken)).toBeNull();
    await setup.allow();
    expect(setup.error()).toBe('');
    expect(setup.saveSucceeded()).toBe(true);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingToken)).toBe('new-token');
  });

  it('does not write or remove devices when Messaging is not configured', async () => {
    messagingConfigured.set(false);
    localStorage.setItem(APP_STORAGE_KEYS.messagingUserId, 'user-1');
    localStorage.setItem(APP_STORAGE_KEYS.messagingToken, 'retained-token');
    const messaging = TestBed.inject(FirebaseMessagingService);
    await messaging.setDeviceNotificationsEnabled(true);
    await messaging.setDeviceNotificationsEnabled(false);
    expect(ensureFirebaseRuntime).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingToken)).toBe('retained-token');
  });

});

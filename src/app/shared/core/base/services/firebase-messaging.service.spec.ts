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
  const reloadDeployment = vi.fn();
  let setup: AppSetupStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    messagingConfigured.set(true);
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
        requestCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
        syncGrantedLocationForActiveUser: vi.fn().mockResolvedValue(undefined)
      } },
      { provide: PwaService, useValue: { dismissInstallPrompt: vi.fn(),
        installAvailable: () => false, installActionPending: () => false,
        installPromptVisible: () => false } },
      { provide: UserProfileStore, useValue: {
        activeUserId: () => 'user-1', activeNotificationDevices: () => []
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

  it('restores OFF and reports Firebase rejection without displaying success', async () => {
    vi.mocked(getToken).mockRejectedValue(new Error('Firebase error'));
    await setup.allow();
    expect(setup.isOpen()).toBe(true);
    expect(setup.error()).toBe('entry.permissions.notifications.failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.actionPending()).toBe(false);
    expect(setup.notificationsSelected()).toBe(false);
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
    expect(setup.notificationsSelected()).toBe(false);
    expect(setup.saveSucceeded()).toBe(false);
    resolveToken('late-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('starts location synchronization without waiting for it or closing settings', async () => {
    vi.mocked(getToken).mockResolvedValue('new-token');
    const location = TestBed.inject(AppLocationService);
    vi.mocked(location.syncGrantedLocationForActiveUser).mockReturnValue(new Promise(() => {}));
    await setup.allow();
    expect(location.syncGrantedLocationForActiveUser).toHaveBeenCalledOnce();
    expect(setup.actionPending()).toBe(false);
    expect(setup.isOpen()).toBe(true);
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
    const saving = setup.allow();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(getToken).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(setup.nativePending()).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
    notification.permission = 'granted';
    decide('granted');
    await saving;
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(setup.isOpen()).toBe(true);
  });

  it('reports a previously denied native permission without starting Firebase', async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });
    await setup.allow();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(setup.error()).toBe('entry.permissions.notifications.blocked');
    expect(setup.actionPending()).toBe(false);
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

  it('restores the preference on server failure and supports a subsequent retry', async () => {
    vi.mocked(getToken).mockResolvedValue('new-token');
    upsert.mockRejectedValueOnce(new Error('server unavailable'));
    await setup.allow();
    expect(setup.error()).toBe('entry.permissions.notifications.failed');
    expect(setup.saveSucceeded()).toBe(false);
    expect(setup.notificationsSelected()).toBe(false);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('false');
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingToken)).toBeNull();
    setup.toggleNotifications();
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

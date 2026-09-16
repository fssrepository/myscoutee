import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { TestBed } from '@angular/core/testing';
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
  let setup: AppSetupStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    localStorage.clear();
    localStorage.setItem(APP_STORAGE_KEYS.messagingDeviceEnabled, 'false');
    vi.stubGlobal('Notification', { permission: 'granted' });
    ready.mockReturnValue(Promise.resolve({}));
    vi.stubGlobal('navigator', {
      serviceWorker: { get ready() { return ready(); } },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) }
    });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
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
      { provide: DeploymentConfigurationService, useValue: {} },
      { provide: I18nService, useValue: { translate: (key: string) => key } },
      { provide: AppLocationService, useValue: {
        requestCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
        syncGrantedLocationForActiveUser: vi.fn().mockResolvedValue(undefined)
      } },
      { provide: PwaService, useValue: { dismissInstallPrompt: vi.fn() } },
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

  it('saves an allowed preference immediately despite Firebase rejection', async () => {
    vi.mocked(getToken).mockRejectedValue(new Error('Firebase internal URL/token error'));
    await setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    expect(setup.isOpen()).toBe(true);
    expect(setup.error()).toBe('');
    expect(setup.actionPending()).toBe(false);
    expect(localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled)).toBe('true');
    setup.close();
    setup.open();
    expect(setup.notificationsSelected()).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('never waits for a stalled token and does not persist a token arriving after timeout', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    await setup.allow();
    expect(setup.actionPending()).toBe(false);
    expect(setup.isOpen()).toBe(true);
    await vi.advanceTimersByTimeAsync(30_001);
    resolveToken('late-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('starts location synchronization without waiting for it or closing settings', async () => {
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

  it('accepts a slower initial token in the background after settings have returned', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    await setup.allow();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(setup.actionPending()).toBe(false);
    resolveToken('slow-first-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).toHaveBeenCalledOnce();
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
    expect(setup.error()).toBe('');
    expect(ready).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('persists registration in the background after saving the preference', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    await setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    expect(setup.isOpen()).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
    resolveToken('new-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).toHaveBeenCalledOnce();
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

  it('does not re-enable a device when background token acquisition finishes after opt-out', async () => {
    let resolveToken!: (token: string) => void;
    vi.mocked(getToken).mockReturnValue(new Promise(resolve => { resolveToken = resolve; }));
    await setup.allow();
    await vi.advanceTimersByTimeAsync(1);
    setup.open();
    setup.toggleNotifications();
    await setup.allow();
    resolveToken('stale-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(upsert).not.toHaveBeenCalled();
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

});

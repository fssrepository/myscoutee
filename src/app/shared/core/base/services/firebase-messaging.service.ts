import {
  DestroyRef,
  Injectable,
  Injector,
  effect,
  inject,
  signal,
  computed,
  untracked
} from '@angular/core';
import {
  deleteApp,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions
} from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging
} from 'firebase/messaging';

import {
  environment
} from '../../../../../environments/environment';
import {
  APP_STORAGE_KEYS
} from '../../common/storage-scope';
import { pwaNotificationRegistrationEnabled } from '../../common/pwa-runtime-policy';
import {
  FirebaseAppService,
  type FirebaseAppRuntime,
  type FirebaseConfigFile
} from './firebase-app.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { DeviceRegistrationsService } from './device-registrations.service';
import { DeploymentConfigurationService } from './deployment-configuration.service';
import { I18nService } from './i18n.service';

export interface FirebaseMessagingReadinessProof {
  token: string;
  configurationRevision: number;
  appId: string;
}

export interface FirebaseMessagingReadinessLease {
  proof: FirebaseMessagingReadinessProof;
  release: () => Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {
  private static readonly DEVICE_ID_STORAGE_KEY = APP_STORAGE_KEYS.messagingDeviceId;
  private static readonly TOKEN_STORAGE_KEY = APP_STORAGE_KEYS.messagingToken;
  private static readonly TOKEN_USER_ID_STORAGE_KEY = APP_STORAGE_KEYS.messagingUserId;
  private static readonly SERVICE_WORKER_READY_TIMEOUT_MS = 3_000;
  // Initial Push/FCM registration can include several network round trips.
  // It runs in the background and must not share the short settings-write timeout.
  private static readonly TOKEN_TIMEOUT_MS = 30_000;
  private static readinessAppSequence = 0;

  private readonly deviceRegistrations = inject(DeviceRegistrationsService);
  private readonly i18n = inject(I18nService);
  private localDeviceOperation: Promise<void> = Promise.resolve();
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly firebaseAppService = inject(FirebaseAppService);
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);
  private initialized = false;
  private nativeDenialOperation: Promise<void> | null = null;
  private readonly deviceEnabled = signal(typeof localStorage === 'undefined'
    || localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled) !== 'false');
  // The switch reflects this browser's saved preference and native permission.
  readonly deviceNotificationsEnabled = computed(() => this.deviceEnabled()
    && this.notificationsConfigured && this.notificationPermission() === 'granted');
  private deviceOperationRevision = 0;

  async setDeviceNotificationsEnabled(enabled: boolean): Promise<void> {
    if (!this.notificationsConfigured) return;
    const revision = ++this.deviceOperationRevision;
    const previousEnabled = this.deviceEnabled();
    const previousStored = localStorage.getItem(APP_STORAGE_KEYS.messagingDeviceEnabled);
    this.deviceEnabled.set(enabled);
    localStorage.setItem(APP_STORAGE_KEYS.messagingDeviceEnabled, String(enabled));
    try {
      if (enabled) {
        await this.requestAndRegisterForActiveUser(true);
      } else {
        this.unbindForegroundMessages();
        await this.unregisterStoredDevice(true);
      }
    } catch {
      if (revision === this.deviceOperationRevision) {
        this.deviceEnabled.set(previousEnabled);
        if (previousStored === null) localStorage.removeItem(APP_STORAGE_KEYS.messagingDeviceEnabled);
        else localStorage.setItem(APP_STORAGE_KEYS.messagingDeviceEnabled, previousStored);
      }
      throw new Error(this.i18n.translate('entry.permissions.notifications.failed'));
    }
  }

  private readonly notificationPermissionRef = signal<NotificationPermission | null>(
    typeof Notification === 'undefined' ? null : Notification.permission
  );
  readonly notificationPermission = this.notificationPermissionRef.asReadonly();
  private foregroundListenerApp: FirebaseApp | null = null;
  private foregroundListenerUnsubscribe: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.unbindForegroundMessages());
    if (typeof window !== 'undefined') {
      const refresh = () => this.refreshNotificationPermission();
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', refresh);
      let permissionStatus: PermissionStatus | null = null;
      void navigator.permissions?.query({ name: 'notifications' }).then(status => {
        if (this.destroyRef.destroyed) return;
        permissionStatus = status;
        status.addEventListener('change', refresh);
        refresh();
      }).catch(() => undefined);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('focus', refresh);
        document.removeEventListener('visibilitychange', refresh);
        permissionStatus?.removeEventListener('change', refresh);
      });
    }
    if (this.deviceRegistrations.isLocal) {
      this.initialize();
    }
  }

  refreshNotificationPermission(): void {
    this.notificationPermissionRef.set(typeof Notification === 'undefined' ? null : Notification.permission);
    if (this.notificationPermission() === 'denied') {
      void this.persistNativeDenial().catch(() => undefined);
    }
  }

  get notificationsConfigured(): boolean {
    return this.deploymentConfiguration.firebaseMessagingConfigured()
      && typeof Notification !== 'undefined';
  }

  async prepareNotificationConfiguration(): Promise<void> {
    await this.deploymentConfiguration.reload();
  }

  initialize(): void {
    if (this.initialized || (!this.enabled && !this.deviceRegistrations.isLocal)) {
      return;
    }
    this.initialized = true;

    effect(
      () => {
        const userId = this.userProfileStore.activeUserId().trim();
        const permission = this.notificationPermission();
        if (!this.notificationsConfigured) {
          this.unbindForegroundMessages();
          return;
        }
        if (permission === 'denied' && this.userProfileStore.activeNotificationDevices().some(
          device => device.notificationsEnabled)) {
          untracked(() => { void this.persistNativeDenial().catch(() => undefined); });
        }
        if (this.deviceRegistrations.isLocal) {
          if (userId && this.notificationPermission() === 'granted') {
            untracked(() => {
              if (this.deviceEnabled()) void this.updateLocalDevice(true).catch(() => undefined);
            });
          }
          return;
        }
        const runtime = this.firebaseAppService.activeRuntime();
        if (
          !runtime
          || !userId
          || !this.enabled
          || typeof Notification === 'undefined'
          || permission !== 'granted'
        ) {
          this.unbindForegroundMessages();
          if (
            !runtime
            && userId
            && this.enabled
            && typeof Notification !== 'undefined'
            && Notification.permission === 'granted'
          ) {
            void this.firebaseAppService.ensureFirebaseRuntime();
          }
          return;
        }
        untracked(() => { if (this.deviceEnabled()) void this.registerActiveDevice(runtime).catch(() => undefined); });
      },
      { injector: this.injector }
    );
  }

  async requestAndRegisterForActiveUser(requireRegistration = false): Promise<void> {
    if (!this.notificationsConfigured || (!this.enabled && !this.deviceRegistrations.isLocal) || !this.deviceEnabled()) {
      return;
    }
    // Native permission belongs to the explicit settings/login click only.
    // A background retry must never prompt on its own.
    if (Notification.permission !== 'granted') {
      if (Notification.permission === 'denied') await this.unregisterStoredDevice();
      return;
    }
    if (this.deviceRegistrations.isLocal) {
      await this.updateLocalDevice(true);
      return;
    }
    const registered = await this.registerActiveDevice();
    if (requireRegistration && this.userProfileStore.activeUserId().trim() && !registered) {
      throw new Error(this.i18n.translate('entry.permissions.notifications.failed'));
    }
  }

  get entryPermissionPending(): boolean {
    this.notificationPermissionRef();
    return this.notificationsConfigured && Notification.permission !== 'granted';
  }

  requestEntryPermission(): Promise<NotificationPermission | null> {
    if (!this.notificationsConfigured) return Promise.resolve(null);
    // Call synchronously from the confirmation gesture, before location or
    // network awaits consume the browser's transient user activation.
    const decision = typeof Notification === 'undefined'
      ? Promise.resolve(null)
      : Notification.permission === 'default'
        ? Notification.requestPermission().catch(() => 'denied' as const)
        : Promise.resolve(Notification.permission);
    return decision.then(permission => {
      this.refreshNotificationPermission();
      return permission;
    });
  }

  async createBrowserReadinessLease(
    configuration: FirebaseConfigFile
  ): Promise<FirebaseMessagingReadinessLease> {
    if (
      typeof window === 'undefined'
      || typeof Notification === 'undefined'
      || !configuration.vapidKey.trim()
    ) {
      throw this.browserReadinessError();
    }

    const permissionPromise = Notification.permission === 'default'
      ? Notification.requestPermission()
      : Promise.resolve(Notification.permission);
    const permission = await permissionPromise.catch(() => 'denied' as const);
    if (permission !== 'granted') {
      throw this.browserReadinessError();
    }
    const messagingSupported = await isSupported().catch(() => false);
    if (!messagingSupported) {
      throw this.browserReadinessError();
    }
    const serviceWorkerRegistration =
      await this.waitForServiceWorkerReady(
        FirebaseMessagingService.SERVICE_WORKER_READY_TIMEOUT_MS
      );
    if (!serviceWorkerRegistration) {
      throw this.browserReadinessError();
    }

    const options: FirebaseOptions = {
      apiKey: configuration.apiKey,
      authDomain: configuration.authDomain,
      projectId: configuration.projectId,
      ...(configuration.storageBucket
        ? { storageBucket: configuration.storageBucket }
        : {}),
      messagingSenderId: configuration.messagingSenderId,
      appId: configuration.appId,
      ...(configuration.measurementId
        ? { measurementId: configuration.measurementId }
        : {})
    };
    const sequence = ++FirebaseMessagingService.readinessAppSequence;
    let app: FirebaseApp;
    try {
      app = initializeApp(
        options,
        `myscoutee-messaging-readiness-${Date.now()}-${sequence}`
      );
    } catch {
      throw this.browserReadinessError();
    }
    try {
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: configuration.vapidKey,
        serviceWorkerRegistration
      });
      if (!token.trim()) {
        throw this.browserReadinessError();
      }
      let released = false;
      return {
        proof: {
          token: token.trim(),
          configurationRevision: configuration.revision,
          appId: configuration.appId
        },
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          await this.deleteReadinessApp(app);
        }
      };
    } catch {
      await this.deleteReadinessApp(app);
      throw this.browserReadinessError();
    }
  }

  private async registerActiveDevice(
    expectedRuntime?: FirebaseAppRuntime
  ): Promise<boolean> {
    await this.nativeDenialOperation;
    if (!this.notificationsConfigured || !this.enabled || !this.deviceEnabled() || this.notificationPermission() !== 'granted') {
      return false;
    }
    const revision = this.deviceOperationRevision;
    const userId = this.userProfileStore.activeUserId().trim();
    if (!userId) {
      return false;
    }
    const firebaseRuntime = expectedRuntime
      ?? await this.firebaseAppService.ensureFirebaseRuntime();
    if (!firebaseRuntime?.config.vapidKey) {
      return false;
    }
    const previousUserId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    const previousToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    if (previousUserId && previousUserId !== userId && previousToken) {
      await this.deleteDeviceRegistration(previousUserId, previousToken);
    }
    const serviceWorkerRegistration = await this.waitForServiceWorkerReady();
    if (!serviceWorkerRegistration) {
      return false;
    }
    const messagingSupported = await isSupported().catch(() => false);
    if (!messagingSupported) {
      return false;
    }
    try {
      const messaging = getMessaging(firebaseRuntime.app);
      const firebaseToken = await this.withTokenTimeout(getToken(messaging, {
        vapidKey: firebaseRuntime.config.vapidKey,
        serviceWorkerRegistration
      }));
      if (!firebaseToken) {
        return false;
      }
      if (
        !this.notificationsConfigured || revision !== this.deviceOperationRevision || !this.deviceEnabled()
        || this.firebaseAppService.activeRuntime()?.app
          !== firebaseRuntime.app
        || this.userProfileStore.activeUserId().trim() !== userId
      ) {
        return false;
      }
      await this.deviceRegistrations.upsert({
          userId,
          deviceId: this.resolveDeviceId(),
          platform: this.isStandalone() ? 'web-pwa' : 'web-browser',
          firebaseToken,
          notificationsEnabled: true
      });
      if (
        !this.notificationsConfigured || revision !== this.deviceOperationRevision || !this.deviceEnabled()
        || this.firebaseAppService.activeRuntime()?.app
          !== firebaseRuntime.app
        || this.userProfileStore.activeUserId().trim() !== userId
      ) {
        await this.deleteDeviceRegistration(userId, firebaseToken);
        return false;
      }
      this.storeToken(firebaseToken, userId);
      this.bindForegroundMessages(firebaseRuntime.app, messaging);
      return true;
    } catch {
      // Explicit Save reports failure; startup registration stays best-effort.
      return false;
    }
  }

  private async withTokenTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Notification registration timed out')),
            FirebaseMessagingService.TOKEN_TIMEOUT_MS);
        })
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private bindForegroundMessages(
    app: FirebaseApp,
    messaging: Messaging
  ): void {
    if (
      this.foregroundListenerApp === app
      && this.foregroundListenerUnsubscribe
    ) {
      return;
    }
    this.unbindForegroundMessages();
    const unsubscribe = onMessage(messaging, payload => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }
      if (!document.hidden) {
        return;
      }
      const branding = this.deploymentConfiguration.branding();
      const title = payload.notification?.title?.trim()
        || payload.data?.['title']
        || branding.productName;
      const body = payload.notification?.body?.trim() || payload.data?.['body'] || '';
      const icon = payload.notification?.icon?.trim() || branding.logoUrl;
      void this.waitForServiceWorkerReady().then(registration => {
        if (!registration) {
          return;
        }
        void registration.showNotification(title, {
          body,
          icon
        });
      });
    });
    this.foregroundListenerApp = app;
    this.foregroundListenerUnsubscribe = unsubscribe;
  }

  private unbindForegroundMessages(): void {
    const unsubscribe = this.foregroundListenerUnsubscribe;
    this.foregroundListenerApp = null;
    this.foregroundListenerUnsubscribe = null;
    try {
      unsubscribe?.();
    } catch {
      // Listener teardown must not block Firebase runtime replacement.
    }
  }

  private async unregisterStoredDevice(strict = false): Promise<void> {
    if (this.deviceRegistrations.isLocal) {
      await this.updateLocalDevice(false);
      return;
    }
    if (!this.enabled) {
      return;
    }
    const userId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    const firebaseToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    if (!userId || !firebaseToken) {
      return;
    }

    // Opt-out is a backend registration write. The browser permission and
    // shared Push subscription remain browser-owned; Firebase availability
    // must not delay disabling this member's notification delivery.
    try {
      await this.deviceRegistrations.remove({
          userId,
          deviceId: this.resolveDeviceId(),
          firebaseToken
      });
    } catch (error) {
      // Explicit device opt-out must report failure and retain the token for retry.
      if (strict) throw error;
    }
    localStorage.removeItem(FirebaseMessagingService.TOKEN_STORAGE_KEY);
    localStorage.removeItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY);
  }

  private persistNativeDenial(): Promise<void> {
    if (this.nativeDenialOperation) return this.nativeDenialOperation;
    const userId = this.userProfileStore.activeUserId().trim();
    const deviceId = localStorage.getItem(FirebaseMessagingService.DEVICE_ID_STORAGE_KEY)?.trim() ?? '';
    if (!userId || !deviceId || this.notificationPermission() !== 'denied'
      || !this.userProfileStore.activeNotificationDevices().some(device =>
        device.deviceId === deviceId && device.notificationsEnabled)) return Promise.resolve();
    const firebaseToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    const tokenUserId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    if (!this.deviceRegistrations.isLocal && (!firebaseToken || tokenUserId !== userId)) return Promise.resolve();
    this.nativeDenialOperation = this.deviceRegistrations.upsert({
      userId, deviceId, platform: this.isStandalone() ? 'web-pwa' : 'web-browser',
      ...(firebaseToken ? { firebaseToken } : {}), notificationsEnabled: false
    }).finally(() => { this.nativeDenialOperation = null; });
    return this.nativeDenialOperation;
  }

  private updateLocalDevice(enabled: boolean): Promise<void> {
    const userId = this.userProfileStore.activeUserId().trim();
    if (!userId) return Promise.resolve();
    const revision = this.deviceOperationRevision;
    const deviceId = this.resolveDeviceId();
    const operation = this.localDeviceOperation.catch(() => undefined).then(async () => {
      if (revision !== this.deviceOperationRevision || this.userProfileStore.activeUserId().trim() !== userId) return;
      if (!enabled) {
        await this.deviceRegistrations.remove({ userId, deviceId });
        return;
      }
      await this.deviceRegistrations.upsert({ userId, deviceId,
        platform: this.isStandalone() ? 'web-pwa' : 'web-browser', notificationsEnabled: true });
      if (revision !== this.deviceOperationRevision || !this.deviceEnabled()
        || this.userProfileStore.activeUserId().trim() !== userId) {
        await this.deviceRegistrations.remove({ userId, deviceId });
      }
    });
    this.localDeviceOperation = operation;
    return operation;
  }

  private resolveDeviceId(): string {
    const existing = localStorage.getItem(FirebaseMessagingService.DEVICE_ID_STORAGE_KEY)?.trim();
    if (existing) {
      return existing;
    }
    const next = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    localStorage.setItem(FirebaseMessagingService.DEVICE_ID_STORAGE_KEY, next);
    return next;
  }

  private storeToken(firebaseToken: string, userId: string): void {
    localStorage.setItem(FirebaseMessagingService.TOKEN_STORAGE_KEY, firebaseToken);
    localStorage.setItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY, userId);
  }

  private async waitForServiceWorkerReady(
    timeoutMs = FirebaseMessagingService.SERVICE_WORKER_READY_TIMEOUT_MS
  ): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(resolve => {
          timeout = setTimeout(() => resolve(null), timeoutMs);
        })
      ]);
    } catch {
      return null;
    } finally {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  }

  private async deleteReadinessApp(app: FirebaseApp): Promise<void> {
    /*
     * Firebase Messaging registrations are keyed by the browser, web-app
     * configuration, VAPID key, and service-worker registration rather than
     * by this temporary FirebaseApp name. The readiness token can therefore
     * be the active user's real token. Deleting it here would silently break
     * the persisted device registration; only the named SDK app is temporary.
     */
    try {
      await deleteApp(app);
    } catch {
      // The isolated test app must never affect the active runtime app.
    }
  }

  private browserReadinessError(): Error {
    return new Error('operator.configuration.test.failed');
  }

  private isStandalone(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(display-mode: standalone)').matches
      || ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  }

  private async deleteDeviceRegistration(userId: string, firebaseToken: string): Promise<void> {
    if (!this.enabled) {
      return;
    }
    try {
      await this.deviceRegistrations.remove({
          userId,
          deviceId: this.resolveDeviceId(),
          firebaseToken
      });
    } catch {
      // Ignore backend cleanup failures and keep the next registration attempt moving.
    }
  }

  private get enabled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return pwaNotificationRegistrationEnabled({
      activitiesDataSource: environment.activitiesDataSource,
      firebaseMessagingEnabled: environment.firebaseMessagingEnabled,
      serviceWorkerEnabled: environment.serviceWorkerEnabled
    });
  }
}

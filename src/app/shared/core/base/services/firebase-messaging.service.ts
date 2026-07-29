import {
  HttpClient
} from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  Injector,
  effect,
  inject
} from '@angular/core';
import {
  deleteApp,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions
} from 'firebase/app';
import {
  deleteToken,
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
import {
  FirebaseAppService,
  type FirebaseAppRuntime,
  type FirebaseConfigFile
} from './firebase-app.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { DeploymentConfigurationService } from './deployment-configuration.service';

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
  private static readonly SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;
  private static readinessAppSequence = 0;

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly firebaseAppService = inject(FirebaseAppService);
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private initialized = false;
  private foregroundListenerApp: FirebaseApp | null = null;
  private foregroundListenerUnsubscribe: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.unbindForegroundMessages());
  }

  initialize(): void {
    if (this.initialized || !this.enabled) {
      return;
    }
    this.initialized = true;

    effect(
      () => {
        const runtime = this.firebaseAppService.activeRuntime();
        const userId = this.userProfileStore.activeUserId().trim();
        if (
          !runtime
          || !userId
          || !this.enabled
          || typeof Notification === 'undefined'
          || Notification.permission !== 'granted'
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
        void this.registerActiveDevice(runtime);
      },
      { injector: this.injector }
    );
  }

  async requestAndRegisterForActiveUser(): Promise<void> {
    if (!this.enabled || typeof Notification === 'undefined') {
      return;
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await this.unregisterStoredDevice();
        return;
      }
    }
    if (Notification.permission !== 'granted') {
      await this.unregisterStoredDevice();
      return;
    }
    await this.registerActiveDevice();
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
      storageBucket: configuration.storageBucket,
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
    let messaging: Messaging | null = null;
    try {
      messaging = getMessaging(app);
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
          await this.deleteReadinessApp(app, messaging);
        }
      };
    } catch {
      await this.deleteReadinessApp(app, messaging);
      throw this.browserReadinessError();
    }
  }

  private async registerActiveDevice(
    expectedRuntime?: FirebaseAppRuntime
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const userId = this.userProfileStore.activeUserId().trim();
    if (!userId) {
      return;
    }
    const previousUserId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    const previousToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    if (previousUserId && previousUserId !== userId && previousToken) {
      await this.deleteDeviceRegistration(previousUserId, previousToken);
    }
    const serviceWorkerRegistration = await this.waitForServiceWorkerReady();
    if (!serviceWorkerRegistration) {
      return;
    }
    const messagingSupported = await isSupported().catch(() => false);
    if (!messagingSupported) {
      return;
    }
    const firebaseRuntime = expectedRuntime
      ?? await this.firebaseAppService.ensureFirebaseRuntime();
    if (!firebaseRuntime?.config.vapidKey) {
      return;
    }
    try {
      const messaging = getMessaging(firebaseRuntime.app);
      const firebaseToken = await getToken(messaging, {
        vapidKey: firebaseRuntime.config.vapidKey,
        serviceWorkerRegistration
      });
      if (!firebaseToken) {
        return;
      }
      if (
        this.firebaseAppService.activeRuntime()?.app
          !== firebaseRuntime.app
        || this.userProfileStore.activeUserId().trim() !== userId
      ) {
        return;
      }
      await this.http.post(
        `${this.apiBaseUrl}/activities/chats/devices`,
        {
          userId,
          deviceId: this.resolveDeviceId(),
          platform: this.isStandalone() ? 'web-pwa' : 'web-browser',
          firebaseToken,
          notificationsEnabled: true
        }
      ).toPromise();
      if (
        this.firebaseAppService.activeRuntime()?.app
          !== firebaseRuntime.app
        || this.userProfileStore.activeUserId().trim() !== userId
      ) {
        await this.deleteDeviceRegistration(userId, firebaseToken);
        return;
      }
      this.storeToken(firebaseToken, userId);
      this.bindForegroundMessages(firebaseRuntime.app, messaging);
    } catch {
      // Keep registration best-effort to avoid blocking app startup.
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

  private async unregisterStoredDevice(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const userId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    const firebaseToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    if (!userId || !firebaseToken) {
      return;
    }

    const firebaseApp = await this.firebaseAppService.ensureFirebaseApp();
    if (firebaseApp) {
      const messagingSupported = await isSupported().catch(() => false);
      if (messagingSupported) {
        try {
          await deleteToken(getMessaging(firebaseApp));
        } catch {
          // Ignore token cleanup failures and still remove backend registration.
        }
      }
    }

    try {
      await this.http.request('delete', `${this.apiBaseUrl}/activities/chats/devices`, {
        body: {
          userId,
          deviceId: this.resolveDeviceId(),
          firebaseToken
        }
      }).toPromise();
    } catch {
      // Ignore backend cleanup failures while clearing local state.
    }
    localStorage.removeItem(FirebaseMessagingService.TOKEN_STORAGE_KEY);
    localStorage.removeItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY);
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

  private async deleteReadinessApp(
    app: FirebaseApp,
    messaging: Messaging | null
  ): Promise<void> {
    if (messaging) {
      try {
        await deleteToken(messaging);
      } catch {
        // Continue deleting the isolated app even when token cleanup fails.
      }
    }
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
      await this.http.request('delete', `${this.apiBaseUrl}/activities/chats/devices`, {
        body: {
          userId,
          deviceId: this.resolveDeviceId(),
          firebaseToken
        }
      }).toPromise();
    } catch {
      // Ignore backend cleanup failures and keep the next registration attempt moving.
    }
  }

  private get enabled(): boolean {
    return environment.activitiesDataSource === 'http'
      && environment.firebaseMessagingEnabled
      && !this.isLoopbackBrowserHost();
  }

  private isLoopbackBrowserHost(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '[::1]'
      || hostname === '::1'
      || hostname.endsWith('.localhost');
  }
}

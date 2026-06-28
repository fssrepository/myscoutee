import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, effect, inject } from '@angular/core';
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';

import { environment } from '../../../../../environments/environment';
import { AppContext } from '../../../ui/context/app.context';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { FirebaseAppService } from './firebase-app.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {
  private static readonly DEVICE_ID_STORAGE_KEY = APP_STORAGE_KEYS.messagingDeviceId;
  private static readonly TOKEN_STORAGE_KEY = APP_STORAGE_KEYS.messagingToken;
  private static readonly TOKEN_USER_ID_STORAGE_KEY = APP_STORAGE_KEYS.messagingUserId;

  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  private readonly appCtx = inject(AppContext);
  private readonly firebaseAppService = inject(FirebaseAppService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private initialized = false;
  private foregroundListenerBound = false;

  initialize(): void {
    if (this.initialized || !this.enabled) {
      return;
    }
    this.initialized = true;

    effect(
      () => {
        const userId = this.appCtx.userProfileStore.activeUserId().trim();
        if (!userId || !this.enabled) {
          return;
        }
        if (typeof Notification === 'undefined') {
          return;
        }
        if (Notification.permission === 'granted') {
          void this.registerActiveDevice();
        }
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

  private async registerActiveDevice(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const userId = this.appCtx.userProfileStore.activeUserId().trim();
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
    const firebaseConfig = await this.firebaseAppService.loadFirebaseConfig();
    if (!firebaseConfig?.vapidKey) {
      return;
    }
    const firebaseApp = await this.firebaseAppService.ensureFirebaseApp();
    if (!firebaseApp) {
      return;
    }
    try {
      const messaging = getMessaging(firebaseApp);
      const firebaseToken = await getToken(messaging, {
        vapidKey: firebaseConfig.vapidKey,
        serviceWorkerRegistration
      });
      if (!firebaseToken) {
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
      this.storeToken(firebaseToken, userId);
      this.bindForegroundMessages(messaging);
    } catch {
      // Keep registration best-effort to avoid blocking app startup.
    }
  }

  private bindForegroundMessages(messaging: Messaging): void {
    if (this.foregroundListenerBound) {
      return;
    }
    this.foregroundListenerBound = true;
    onMessage(messaging, payload => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }
      if (!document.hidden) {
        return;
      }
      const title = payload.notification?.title?.trim() || payload.data?.['title'] || 'MyScoutee';
      const body = payload.notification?.body?.trim() || payload.data?.['body'] || '';
      const icon = payload.notification?.icon?.trim() || 'assets/logo/heart.png';
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

  private async waitForServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
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

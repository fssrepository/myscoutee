import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { environment } from '../../../../../environments/environment';
import { AppContext } from '../context';
import { FirebaseAuthService } from './firebase-auth.service';
import { PwaService } from './pwa.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {
  private static readonly DEVICE_ID_STORAGE_KEY = 'myscoutee.device.id';
  private static readonly TOKEN_STORAGE_KEY = 'myscoutee.messaging.token';
  private static readonly TOKEN_USER_ID_STORAGE_KEY = 'myscoutee.messaging.user-id';

  private readonly http = inject(HttpClient);
  private readonly appCtx = inject(AppContext);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly pwaService = inject(PwaService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private initialized = false;
  private foregroundListenerBound = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    effect(() => {
      const userId = this.appCtx.activeUserId().trim();
      if (!userId || !environment.firebaseMessagingEnabled) {
        return;
      }
      if (typeof Notification === 'undefined') {
        return;
      }
      if (Notification.permission === 'granted') {
        void this.registerActiveDevice();
      }
    });
  }

  async requestAndRegisterForActiveUser(): Promise<void> {
    if (!environment.firebaseMessagingEnabled || typeof Notification === 'undefined') {
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
    const userId = this.appCtx.activeUserId().trim();
    if (!userId) {
      return;
    }
    const previousUserId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    const previousToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    if (previousUserId && previousUserId !== userId && previousToken) {
      await this.deleteDeviceRegistration(previousUserId, previousToken);
    }
    const serviceWorkerRegistration = await this.pwaService.waitForServiceWorkerReady();
    if (!serviceWorkerRegistration) {
      return;
    }
    const messagingSupported = await isSupported().catch(() => false);
    if (!messagingSupported) {
      return;
    }
    const firebaseConfig = await this.firebaseAuthService.loadFirebaseConfig();
    if (!firebaseConfig?.vapidKey) {
      return;
    }
    const firebaseApp = await this.firebaseAuthService.ensureFirebaseApp();
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
          platform: this.pwaService.isStandalone() ? 'web-pwa' : 'web-browser',
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

  private bindForegroundMessages(messaging: ReturnType<typeof getMessaging>): void {
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
      void this.pwaService.waitForServiceWorkerReady().then(registration => {
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
    const userId = localStorage.getItem(FirebaseMessagingService.TOKEN_USER_ID_STORAGE_KEY)?.trim() ?? '';
    const firebaseToken = localStorage.getItem(FirebaseMessagingService.TOKEN_STORAGE_KEY)?.trim() ?? '';
    if (!userId || !firebaseToken) {
      return;
    }

    const firebaseApp = await this.firebaseAuthService.ensureFirebaseApp();
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

  private async deleteDeviceRegistration(userId: string, firebaseToken: string): Promise<void> {
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
}

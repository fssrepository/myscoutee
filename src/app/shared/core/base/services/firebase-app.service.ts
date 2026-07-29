import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  deleteApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions
} from 'firebase/app';

import { environment } from '../../../../../environments/environment';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { SessionService } from './session.service';

export interface FirebaseConfigFile {
  revision: number;
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  vapidKey: string;
}

export interface FirebaseAppRuntime {
  app: FirebaseApp;
  config: FirebaseConfigFile;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseAppService {
  private static readonly FIREBASE_CONFIG_PATH =
    '/deployment/configuration/firebase-config';
  private static readonly FIREBASE_APP_NAME =
    'myscoutee-deployment-runtime';
  private static readonly FIREBASE_CONFIG_TTL_MS = 30_000;

  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionService = inject(SessionService);
  private runtime: (FirebaseAppRuntime & { fingerprint: string }) | null = null;
  private readonly activeRuntimeRef = signal<FirebaseAppRuntime | null>(null);
  private reconciliationPromise: Promise<FirebaseAppRuntime | null> | null = null;
  private lastSuccessfulConfigCheckAt = 0;

  readonly activeRuntime = this.activeRuntimeRef.asReadonly();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    const onStorage = (event: StorageEvent): void => {
      if (
        event.storageArea !== localStorage
        || event.key !== APP_STORAGE_KEYS.firebaseConfigurationInvalidation
        || event.newValue === null
      ) {
        return;
      }
      void this.enqueueReconciliation(false);
    };
    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() =>
      window.removeEventListener('storage', onStorage)
    );
  }

  async ensureFirebaseApp(): Promise<FirebaseApp | null> {
    return (await this.ensureFirebaseRuntime())?.app ?? null;
  }

  async ensureFirebaseRuntime(): Promise<FirebaseAppRuntime | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    if (this.reconciliationPromise) {
      return this.reconciliationPromise;
    }
    if (
      this.runtime
      && Date.now() - this.lastSuccessfulConfigCheckAt
        < FirebaseAppService.FIREBASE_CONFIG_TTL_MS
    ) {
      return this.runtime;
    }
    return this.enqueueReconciliation(false);
  }

  async refreshFirebaseApp(): Promise<FirebaseApp | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    const runtime = await this.enqueueReconciliation(true);
    this.publishConfigurationInvalidation();
    return runtime?.app ?? null;
  }

  async loadFirebaseConfig(): Promise<FirebaseConfigFile | null> {
    if (
      typeof document === 'undefined'
      || this.sessionService.currentSession()?.kind === 'demo'
    ) {
      return null;
    }
    const apiBaseUrl = (environment.apiBaseUrl ?? '/api').replace(/\/+$/, '');
    const configUrl = new URL(
      `${apiBaseUrl}${FirebaseAppService.FIREBASE_CONFIG_PATH}`,
      document.baseURI
    ).toString();
    try {
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      const parsed = await response.json() as Partial<FirebaseConfigFile>;
      if (!this.isFirebaseConfigFile(parsed)) {
        return null;
      }
      return {
        revision: parsed.revision,
        apiKey: parsed.apiKey.trim(),
        authDomain: parsed.authDomain.trim(),
        projectId: parsed.projectId.trim(),
        storageBucket: parsed.storageBucket.trim(),
        messagingSenderId: parsed.messagingSenderId.trim(),
        appId: parsed.appId.trim(),
        ...(parsed.measurementId?.trim()
          ? { measurementId: parsed.measurementId.trim() }
          : {}),
        vapidKey: parsed.vapidKey.trim()
      };
    } catch {
      return null;
    }
  }

  private enqueueReconciliation(
    forceAfterCurrent: boolean
  ): Promise<FirebaseAppRuntime | null> {
    const previous = this.reconciliationPromise;
    if (previous && !forceAfterCurrent) {
      return previous;
    }
    let reconciliation: Promise<FirebaseAppRuntime | null>;
    const start = previous
      ? previous.then(() => this.reconcileFirebaseRuntime())
      : this.reconcileFirebaseRuntime();
    reconciliation = start
      .catch(async () => {
        await this.clearOwnedFirebaseApp();
        return null;
      })
      .finally(() => {
        if (this.reconciliationPromise === reconciliation) {
          this.reconciliationPromise = null;
        }
      });
    this.reconciliationPromise = reconciliation;
    return reconciliation;
  }

  private async reconcileFirebaseRuntime(): Promise<FirebaseAppRuntime | null> {
    const config = await this.loadFirebaseConfig();
    if (!config) {
      await this.clearOwnedFirebaseApp();
      return null;
    }
    const fingerprint = this.firebaseConfigFingerprint(config);
    if (this.runtime?.fingerprint === fingerprint) {
      this.lastSuccessfulConfigCheckAt = Date.now();
      return this.runtime;
    }
    await this.clearOwnedFirebaseApp();
    const firebaseOptions: FirebaseOptions = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      ...(config.measurementId
        ? { measurementId: config.measurementId }
        : {})
    };
    const app = initializeApp(
      firebaseOptions,
      FirebaseAppService.FIREBASE_APP_NAME
    );
    this.runtime = {
      app,
      config,
      fingerprint
    };
    this.lastSuccessfulConfigCheckAt = Date.now();
    this.activeRuntimeRef.set(this.runtime);
    return this.runtime;
  }

  private async clearOwnedFirebaseApp(): Promise<void> {
    const app = this.runtime?.app
      ?? getApps().find(candidate =>
        candidate.name === FirebaseAppService.FIREBASE_APP_NAME
      )
      ?? null;
    this.runtime = null;
    this.lastSuccessfulConfigCheckAt = 0;
    this.activeRuntimeRef.set(null);
    if (app) {
      try {
        await deleteApp(app);
      } catch {
        // A failed/deleted owned app must never remain cached.
      }
    }
  }

  private firebaseConfigFingerprint(config: FirebaseConfigFile): string {
    return JSON.stringify([
      config.revision,
      config.apiKey,
      config.authDomain,
      config.projectId,
      config.storageBucket,
      config.messagingSenderId,
      config.appId,
      config.measurementId ?? '',
      config.vapidKey
    ]);
  }

  private publishConfigurationInvalidation(): void {
    try {
      const nonce =
        typeof crypto !== 'undefined'
        && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(
        APP_STORAGE_KEYS.firebaseConfigurationInvalidation,
        nonce
      );
    } catch {
      // TTL reconciliation still catches missed or unavailable storage events.
    }
  }

  private isFirebaseConfigFile(
    value: Partial<FirebaseConfigFile>
  ): value is FirebaseConfigFile {
    return (
      Number.isSafeInteger(value.revision)
      && (value.revision ?? -1) >= 0
      && typeof value.apiKey === 'string'
      && value.apiKey.trim().length > 0
      && typeof value.authDomain === 'string'
      && value.authDomain.trim().length > 0
      && typeof value.projectId === 'string'
      && value.projectId.trim().length > 0
      && typeof value.storageBucket === 'string'
      && value.storageBucket.trim().length > 0
      && typeof value.messagingSenderId === 'string'
      && value.messagingSenderId.trim().length > 0
      && typeof value.appId === 'string'
      && value.appId.trim().length > 0
      && (
        value.measurementId === undefined
        || typeof value.measurementId === 'string'
      )
      && typeof value.vapidKey === 'string'
      && value.vapidKey.trim().length > 0
    );
  }
}

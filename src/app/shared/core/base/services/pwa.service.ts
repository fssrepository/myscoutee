import { Injectable, Injector, computed, inject, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { APP_CACHE_KEYS, APP_STORAGE_KEYS } from '../../common/storage-scope';
import { pwaNotificationRegistrationEnabled } from '../../common/pwa-runtime-policy';

interface BeforeInstallPromptChoice {
  outcome: 'accepted' | 'dismissed';
  platform?: string;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt(): Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

interface AppVersionPayload {
  version?: unknown;
  gitSha?: unknown;
  buildId?: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private static readonly INSTALL_DISMISSED_STORAGE_KEY = APP_STORAGE_KEYS.pwaInstallPromptDismissed;
  private static readonly UPDATE_RELOAD_ATTEMPT_STORAGE_KEY = APP_STORAGE_KEYS.pwaUpdateReloadAttempt;
  private static readonly BUILD_ID_META_NAME = 'myscoutee-build-id';
  private static readonly APP_VERSION_URL = 'app-version.json';
  private static readonly CACHE_PREFIX = APP_CACHE_KEYS.runtimePrefix;
  private static readonly WORKER_INSTALL_TIMEOUT_MS = 10_000;
  private static readonly WORKER_ACTIVATION_TIMEOUT_MS = 4_000;

  private readonly injector = inject(Injector);
  private readonly installPromptRef = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installPromptPendingRef = signal(false);
  private readonly installBusyRef = signal(false);
  private installCompleted = false;
  private readonly installDismissedRef = signal(this.loadInstallDismissed());
  private readonly registrationRef = signal<ServiceWorkerRegistration | null>(null);
  private readonly appVersionLabelRef = signal('');
  readonly appVersionLabel = this.appVersionLabelRef.asReadonly();
  private initialized = false;
  private updateCheckInFlight: Promise<void> | null = null;
  private onBeforeInstallPrompt = (event: Event) => {
    const promptEvent = event as BeforeInstallPromptEvent;
    promptEvent.preventDefault();
    this.installPromptRef.set(promptEvent);
  };
  private onAppInstalled = () => {
    this.installCompleted = true;
    this.installPromptRef.set(null);
    this.installPromptPendingRef.set(false);
    this.installBusyRef.set(false);
    this.setInstallDismissed(true);
  };
  private onApplicationForegrounded = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') {
      return;
    }
    const registration = this.registrationRef();
    if (registration) {
      void this.requestBundleUpdateCheck(registration);
    }
  };

  readonly installBusy = this.installBusyRef.asReadonly();
  readonly installActionPending = computed(() => this.installPromptPendingRef() || this.installBusyRef());
  readonly installAvailable = computed(() => this.installPromptRef() !== null && !this.isStandalone());
  readonly installPromptVisible = computed(() =>
    this.installAvailable() && !this.installDismissedRef() && !this.isStandalone()
  );
  readonly serviceWorkerRegistration = this.registrationRef.asReadonly();

  async initialize(): Promise<void> {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }
    this.initialized = true;
    void this.loadAppVersionLabel();
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    window.addEventListener('appinstalled', this.onAppInstalled);

    if (this.shouldEnableServiceWorker()) {
      await this.registerServiceWorker();
    } else {
      await this.unregisterServiceWorkers();
    }
    if (this.isStandalone()) {
      await this.requestNotificationRegistrationForActiveUser();
    }
  }

  private async loadAppVersionLabel(): Promise<void> {
    if (typeof fetch !== 'function' || typeof document === 'undefined') {
      return;
    }
    try {
      const response = await fetch(new URL(PwaService.APP_VERSION_URL, document.baseURI).toString(), {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json() as AppVersionPayload;
      const version = this.normalizeAppVersion(payload.version)
        || this.normalizeAppVersion(payload.buildId)
        || this.normalizeAppVersion(payload.gitSha);
      if (version) {
        this.appVersionLabelRef.set(version.startsWith('v') ? version : `v${version}`);
      }
    } catch {
      // The local dev server may not have a stamped version file yet.
    }
  }

  private normalizeAppVersion(value: unknown): string {
    return typeof value === 'string'
      ? value.trim().replace(/[^a-zA-Z0-9._+-]/g, '').slice(0, 48)
      : '';
  }

  isStandalone(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(display-mode: standalone)').matches
      || ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  }

  async promptInstall(): Promise<boolean> {
    const promptEvent = this.installPromptRef();
    if (!promptEvent || this.installActionPending()) {
      return false;
    }
    this.installCompleted = false;
    this.installPromptPendingRef.set(true);
    // The native dialog owns the interaction now. A consumed one-shot event
    // must not leave an uncloseable "Opening" overlay over the application.
    this.installPromptRef.set(null);
    try {
      await promptEvent.prompt();
      const outcome = await promptEvent.userChoice;
      const accepted = outcome?.outcome === 'accepted';
      // The native decision has finished. Only an accepted installation may
      // show progress, until appinstalled confirms completion. Some browsers
      // dispatch appinstalled before the userChoice continuation runs.
      this.installPromptPendingRef.set(false);
      this.installBusyRef.set(accepted && !this.installCompleted);
      this.installPromptRef.set(null);
      if (!this.installCompleted) this.setInstallDismissed(!accepted);
      return accepted;
    } catch {
      this.installBusyRef.set(false);
      return false;
    } finally {
      this.installPromptPendingRef.set(false);
    }
  }

  async requestNotificationRegistrationForActiveUser(): Promise<void> {
    if (!this.shouldEnableNotificationRegistration()
      || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }
    const { FirebaseMessagingService } = await import('./firebase-messaging.service');
    const messagingService = this.injector.get(FirebaseMessagingService);
    messagingService.initialize();
    await messagingService.requestAndRegisterForActiveUser();
  }

  dismissInstallPrompt(): void {
    this.setInstallDismissed(true);
  }

  showInstallPrompt(): void {
    if (this.installAvailable()) {
      this.setInstallDismissed(false);
    }
  }

  offerInstallAfterLogin(): void {
    if (!this.installAvailable()) {
      return;
    }
    const key = APP_STORAGE_KEYS.pwaLoginInstallPromptOffered;
    try {
      if (localStorage.getItem(key) === '1') {
        return;
      }
      localStorage.setItem(key, '1');
    } catch {
      // An unavailable preference store must not prevent use of the app.
      return;
    }
    this.showInstallPrompt();
  }

  async waitForServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    const existing = this.registrationRef();
    if (existing) {
      return existing;
    }
    if (!this.shouldEnableServiceWorker()) {
      return null;
    }
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }

  private shouldEnableServiceWorker(): boolean {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }
    return environment.serviceWorkerEnabled;
  }

  private shouldEnableNotificationRegistration(): boolean {
    return pwaNotificationRegistrationEnabled({
      activitiesDataSource: environment.activitiesDataSource,
      firebaseMessagingEnabled: environment.firebaseMessagingEnabled,
      serviceWorkerEnabled: environment.serviceWorkerEnabled
    });
  }

  private async registerServiceWorker(): Promise<void> {
    const serviceWorkerUrl = new URL('app-sw.js', document.baseURI).toString();
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      updateViaCache: 'none'
    });
    this.registrationRef.set(registration);
    window.addEventListener('pageshow', this.onApplicationForegrounded);
    window.addEventListener('focus', this.onApplicationForegrounded);
    window.addEventListener('online', this.onApplicationForegrounded);
    document.addEventListener('visibilitychange', this.onApplicationForegrounded);
    await this.requestBundleUpdateCheck(registration);
  }

  private async requestBundleUpdateCheck(
    registration: ServiceWorkerRegistration
  ): Promise<void> {
    if (!environment.production || typeof document === 'undefined') {
      return;
    }
    if (this.updateCheckInFlight) {
      return this.updateCheckInFlight;
    }

    const updateCheck = this.checkForBundleUpdate(registration);
    this.updateCheckInFlight = updateCheck;
    try {
      await updateCheck;
    } finally {
      if (this.updateCheckInFlight === updateCheck) {
        this.updateCheckInFlight = null;
      }
    }
  }

  private async checkForBundleUpdate(registration: ServiceWorkerRegistration): Promise<void> {

    const currentBuildId = this.readDocumentBuildId();
    if (!currentBuildId) {
      await registration.update().catch(() => undefined);
      return;
    }

    const latestBuildId = await this.fetchLatestBuildId();
    if (!latestBuildId || latestBuildId === currentBuildId) {
      this.clearReloadAttempt();
      await registration.update().catch(() => undefined);
      return;
    }

    const attemptKey = `${currentBuildId}->${latestBuildId}`;
    if (this.reloadWasAlreadyAttempted(attemptKey)) {
      return;
    }

    await registration.update().catch(() => undefined);
    const waitingWorker = await this.waitForWaitingWorker(registration);
    if (!waitingWorker) {
      return;
    }

    this.markReloadAttempted(attemptKey);
    await this.activateWaitingWorker(waitingWorker);
    this.reloadPage();
  }

  /** Called only after an update or rollback has completed, never when loading job history. */
  async reloadAfterDeploymentChange(): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        const registration = this.registrationRef()
          ?? await navigator.serviceWorker.getRegistration(document.baseURI);
        if (registration) {
          await registration.update();
          const worker = await this.waitForWaitingWorker(registration);
          if (worker) {
            await this.activateWaitingWorker(worker);
          }
        }
      }
    } catch {
      // A worker refresh failure must not turn a completed installation into a failed job.
      // The normal page-load build check will also reconcile the installed bundle.
    }
    this.reloadPage();
  }

  private reloadPage(): void {
    window.location.reload();
  }

  private async waitForWaitingWorker(
    registration: ServiceWorkerRegistration
  ): Promise<ServiceWorker | null> {
    if (registration.waiting) {
      return registration.waiting;
    }
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return null;
    }

    return await new Promise<ServiceWorker | null>(resolve => {
      let settled = false;
      const finish = (worker: ServiceWorker | null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        installingWorker.removeEventListener('statechange', onStateChange);
        resolve(worker);
      };
      const onStateChange = () => {
        if (registration.waiting) {
          finish(registration.waiting);
          return;
        }
        if (installingWorker.state === 'redundant' || installingWorker.state === 'activated') {
          finish(null);
        }
      };
      const timeoutId = window.setTimeout(
        () => finish(registration.waiting),
        PwaService.WORKER_INSTALL_TIMEOUT_MS
      );
      installingWorker.addEventListener('statechange', onStateChange);
      onStateChange();
    });
  }

  private async activateWaitingWorker(worker: ServiceWorker): Promise<void> {
    const controllerChanged = new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('controllerchange', finish);
        resolve();
      };
      const timeoutId = window.setTimeout(finish, PwaService.WORKER_ACTIVATION_TIMEOUT_MS);
      navigator.serviceWorker.addEventListener('controllerchange', finish);
    });

    worker.postMessage({ type: 'SKIP_WAITING' });
    await controllerChanged;
  }

  private readDocumentBuildId(): string {
    const selector = `meta[name="${PwaService.BUILD_ID_META_NAME}"]`;
    const meta = document.querySelector<HTMLMetaElement>(selector);
    return this.normalizeBuildId(meta?.content);
  }

  private async fetchLatestBuildId(): Promise<string> {
    try {
      const versionUrl = new URL(PwaService.APP_VERSION_URL, document.baseURI).toString();
      const response = await fetch(versionUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) {
        return '';
      }
      const payload = await response.json() as AppVersionPayload;
      return this.normalizeBuildId(payload.buildId);
    } catch {
      return '';
    }
  }

  private normalizeBuildId(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private reloadWasAlreadyAttempted(attemptKey: string): boolean {
    if (typeof sessionStorage === 'undefined') {
      return this.isReloadNavigation();
    }
    try {
      return sessionStorage.getItem(PwaService.UPDATE_RELOAD_ATTEMPT_STORAGE_KEY) === attemptKey;
    } catch {
      return this.isReloadNavigation();
    }
  }

  private isReloadNavigation(): boolean {
    if (typeof performance === 'undefined') {
      return false;
    }
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    return navigation?.type === 'reload';
  }

  private markReloadAttempted(attemptKey: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      sessionStorage.setItem(PwaService.UPDATE_RELOAD_ATTEMPT_STORAGE_KEY, attemptKey);
    } catch {
      // A blocked sessionStorage should not break startup.
    }
  }

  private clearReloadAttempt(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      sessionStorage.removeItem(PwaService.UPDATE_RELOAD_ATTEMPT_STORAGE_KEY);
    } catch {
      // A blocked sessionStorage should not break startup.
    }
  }

  private async unregisterServiceWorkers(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith(PwaService.CACHE_PREFIX))
          .map(name => caches.delete(name))
      );
    }
    this.registrationRef.set(null);
  }

  private loadInstallDismissed(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(PwaService.INSTALL_DISMISSED_STORAGE_KEY) === '1';
  }

  private setInstallDismissed(dismissed: boolean): void {
    this.installDismissedRef.set(dismissed);
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (dismissed) {
      localStorage.setItem(PwaService.INSTALL_DISMISSED_STORAGE_KEY, '1');
      return;
    }
    localStorage.removeItem(PwaService.INSTALL_DISMISSED_STORAGE_KEY);
  }
}

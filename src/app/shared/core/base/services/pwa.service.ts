import { Injectable, computed, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';

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
  buildId?: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private static readonly DEV_OVERRIDE_STORAGE_KEY = 'myscoutee.dev.service-worker';
  private static readonly INSTALL_DISMISSED_STORAGE_KEY = 'myscoutee.install-prompt.dismissed';
  private static readonly UPDATE_RELOAD_ATTEMPT_STORAGE_KEY = 'myscoutee.update-reload-attempt';
  private static readonly BUILD_ID_META_NAME = 'myscoutee-build-id';
  private static readonly APP_VERSION_URL = 'app-version.json';
  private static readonly CACHE_PREFIX = 'myscoutee-runtime';

  private readonly installPromptRef = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installBusyRef = signal(false);
  private readonly installDismissedRef = signal(this.loadInstallDismissed());
  private readonly registrationRef = signal<ServiceWorkerRegistration | null>(null);
  private initialized = false;
  private onBeforeInstallPrompt = (event: Event) => {
    const promptEvent = event as BeforeInstallPromptEvent;
    promptEvent.preventDefault();
    this.installPromptRef.set(promptEvent);
  };
  private onAppInstalled = () => {
    this.installPromptRef.set(null);
    this.installBusyRef.set(false);
    this.setInstallDismissed(true);
  };

  readonly installBusy = this.installBusyRef.asReadonly();
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
    this.applyDevOverrideFromQuery();
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    window.addEventListener('appinstalled', this.onAppInstalled);

    if (this.shouldEnableServiceWorker()) {
      await this.registerServiceWorker();
    } else {
      await this.unregisterServiceWorkers();
    }
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
    if (!promptEvent || this.installBusyRef()) {
      return false;
    }
    this.installBusyRef.set(true);
    try {
      await promptEvent.prompt();
      const outcome = await promptEvent.userChoice;
      const accepted = outcome?.outcome === 'accepted';
      this.installPromptRef.set(null);
      this.setInstallDismissed(!accepted);
      return accepted;
    } catch {
      return false;
    } finally {
      this.installBusyRef.set(false);
    }
  }

  dismissInstallPrompt(): void {
    this.installPromptRef.set(null);
    this.setInstallDismissed(true);
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
    if (environment.serviceWorkerEnabled) {
      return true;
    }
    return localStorage.getItem(PwaService.DEV_OVERRIDE_STORAGE_KEY) === 'enabled';
  }

  private async registerServiceWorker(): Promise<void> {
    const serviceWorkerUrl = new URL('app-sw.js', document.baseURI).toString();
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      updateViaCache: 'none'
    });
    this.registrationRef.set(registration);
    await this.checkForPageLoadBundleUpdate(registration);
  }

  private async checkForPageLoadBundleUpdate(registration: ServiceWorkerRegistration): Promise<void> {
    if (!environment.production || typeof document === 'undefined') {
      return;
    }

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

    this.markReloadAttempted(attemptKey);
    await registration.update().catch(() => undefined);
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
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

  private applyDevOverrideFromQuery(): void {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('pwa');
    if (override === 'on') {
      localStorage.setItem(PwaService.DEV_OVERRIDE_STORAGE_KEY, 'enabled');
      return;
    }
    if (override === 'off') {
      localStorage.removeItem(PwaService.DEV_OVERRIDE_STORAGE_KEY);
    }
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

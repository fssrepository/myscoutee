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

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private static readonly DEV_OVERRIDE_STORAGE_KEY = 'myscoutee.dev.service-worker';
  private static readonly INSTALL_DISMISSED_STORAGE_KEY = 'myscoutee.install-prompt.dismissed';
  private static readonly CACHE_PREFIX = 'myscoutee-runtime';

  private readonly installPromptRef = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installBusyRef = signal(false);
  private readonly installDismissedRef = signal(this.loadInstallDismissed());
  private readonly registrationRef = signal<ServiceWorkerRegistration | null>(null);
  private initialized = false;
  private controllerChangeHandled = false;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
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
    this.bindRegistrationLifecycle(registration);
    await registration.update().catch(() => undefined);
  }

  private bindRegistrationLifecycle(registration: ServiceWorkerRegistration): void {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.controllerChangeHandled) {
        return;
      }
      this.controllerChangeHandled = true;
      window.location.reload();
    });

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) {
        return;
      }
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.updateTimer = setInterval(() => {
      void registration.update().catch(() => undefined);
    }, environment.production ? 5 * 60 * 1000 : 30 * 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void registration.update().catch(() => undefined);
      }
    });
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

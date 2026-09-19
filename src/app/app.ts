import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, Type, computed, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet
} from '@angular/router';
import { Subscription } from 'rxjs';
import { AppSetupPopupComponent } from './shared/ui/components/app-setup-popup/app-setup-popup.component';
import { PwaService } from './shared/core/base/services/pwa.service';
import { I18nService } from './shared/core/base/services/i18n.service';
import { AppLocationService } from './shared/core/base/services/app-location.service';
import { DeploymentConfigurationService } from './shared/core/base/services/deployment-configuration.service';
import { PaymentAuthorizationPopupComponent } from './shared/ui/components/payment-authorization-popup/payment-authorization-popup.component';
import { SessionService } from './shared/core/base/services/session.service';
import { HomeHeaderComponent } from './home/components/home-header/home-header.component';
import { AppMenuComponent } from './shared/ui/components/core/menu/menu.component';
import type { AppMenuItem } from './shared/ui/components/core/menu/menu.types';
import { OfflineCacheService } from './shared/core/base/services/offline-cache.service';
import { AppUtils } from './shared/app-utils';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgComponentOutlet,
    AppSetupPopupComponent,
    PaymentAuthorizationPopupComponent,
    HomeHeaderComponent,
    AppMenuComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  private static readonly ROUTE_WARMUP_WATCHDOG_DELAY_MS = 6000;
  private static readonly MOBILE_RESUME_RECOVERY_DELAY_MS = 280;
  private static readonly ACTION_WAVE_TARGET_SELECTOR = [
    'button[class*="close" i]',
    'button[class*="back" i]',
    'button[aria-label*="close" i]',
    'button[aria-label*="back" i]',
    'button[aria-label*="cancel" i]',
    'button[aria-label*="dismiss" i]',
    'button[aria-label*="bezár" i]',
    'button[aria-label*="vissza" i]',
    'button[aria-label*="mégsem" i]',
    'button[title*="close" i]',
    'button[title*="cancel" i]',
    'button[data-close-action="true"]',
    'button[data-action-wave="true"]'
  ].join(',');
  private static readonly ACTION_WAVE_DURATION_MS = 520;
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly pwaService = inject(PwaService);
  private readonly i18nService = inject(I18nService);
  private readonly appLocationService = inject(AppLocationService);
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);
  private readonly routerEventsSubscription: Subscription;
  private readonly sideMenuComponentRef = signal<Type<unknown> | null>(null);
  private sideMenuComponentLoadPromise: Promise<void> | null = null;
  private routeWarmupHideTimer: ReturnType<typeof setTimeout> | null = null;
  private routeWarmupWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private mobileResumeRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private initialLandingWarmupPending = false;
  protected showSideMenu = false;
  protected readonly sideMenuComponent = this.sideMenuComponentRef.asReadonly();
  protected routeWarmupVisible = false;
  protected gameStartupVisible = false;
  protected readonly loadingAvatarItems = computed<readonly AppMenuItem[]>(() => {
    const session = this.sessionService.currentSession();
    const userId = session?.kind === 'firebase' ? session.profile.id : session?.kind === 'demo' ? session.userId : '';
    const cached = userId ? this.offlineCache.readUser(userId)?.user : null;
    // A saved login is not a restored media cookie. Before the guard completes,
    // use image bytes from this session instead of requesting a private URL.
    const imageUrl = session?.kind === 'firebase'
      ? session.avatarImageDataUrl
      : cached?.id === userId ? AppUtils.firstImageUrl(cached.images) : '';
    // Display-only preview; cached identity never enables actions or skips guards.
    return [{
      id: 'navigator-avatar', kind: 'action', layout: 'image', palette: 'neutral',
      imageUrl: AppUtils.mediaImageVariantUrl(imageUrl, 'small'),
      icon: 'schedule', disabled: true, ariaLabel: 'Loading profile', imageAlt: 'Loading profile',
      progress: { state: 'loading', shape: 'circle', durationMs: 3000 }
    }];
  });
  protected readonly deploymentBranding = this.deploymentConfiguration.branding;

  constructor() {
    const initialRouteUrl = this.resolveInitialRouteUrl();
    this.i18nService.initialize();
    this.appLocationService.initialize();
    void this.deploymentConfiguration.initialize();
    void this.pwaService.initialize();
    this.syncSideMenuVisibility(initialRouteUrl);
    // Bootstrap can finish before the initial page is ready. Keep the loading
    // surface until the outlet activates, including a fresh unsigned visit.
    this.initialLandingWarmupPending = true;
    this.routeWarmupVisible = this.initialLandingWarmupPending;
    this.syncGameStartup(initialRouteUrl);
    if (this.routeWarmupVisible) {
      this.scheduleRouteWarmupWatchdog();
    }
    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.syncSideMenuVisibility(event.url);
        this.syncGameStartup(event.url);
        if (this.initialLandingWarmupPending) {
          this.showRouteWarmup();
        } else {
          this.hideRouteWarmup(0);
        }
        return;
      }

      if (event instanceof NavigationEnd) {
        this.syncSideMenuVisibility(event.urlAfterRedirects);
        this.completeInitialLandingWarmup();
        return;
      }

      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        // Redirects continue startup; the destination's guards and lazy page
        // have not finished yet, so there is still no page to uncover.
        if (event instanceof NavigationCancel && (
          event.code === NavigationCancellationCode.Redirect
          || event.code === NavigationCancellationCode.SupersededByNewNavigation
        )) {
          return;
        }
        this.completeInitialLandingWarmup(0);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearRouteWarmupHideTimer();
    this.clearRouteWarmupWatchdogTimer();
    this.clearMobileResumeRecoveryTimer();
    this.routerEventsSubscription.unsubscribe();
  }

  @HostListener('window:pageshow')
  protected onPageShow(): void {
    this.scheduleMobileResumeRecovery();
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    this.scheduleMobileResumeRecovery();
  }

  @HostListener('document:visibilitychange')
  protected onDocumentVisibilityChange(): void {
    this.scheduleMobileResumeRecovery();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    this.showActionWave(event);
  }

  private syncSideMenuVisibility(url: string): void {
    this.showSideMenu = this.shouldShowSideMenu(url);
    this.changeDetectorRef.markForCheck();
    if (this.showSideMenu) {
      void this.ensureSideMenuComponentLoaded();
    }
  }

  private async ensureSideMenuComponentLoaded(): Promise<void> {
    if (this.sideMenuComponentRef()) {
      return;
    }
    if (this.sideMenuComponentLoadPromise) {
      return this.sideMenuComponentLoadPromise;
    }
    this.sideMenuComponentLoadPromise = import('./shared/ui/components/side-menu/side-menu.component')
      .then(module => {
        this.sideMenuComponentRef.set(module.SideMenuComponent);
      })
      .finally(() => {
        this.sideMenuComponentLoadPromise = null;
      });
    return this.sideMenuComponentLoadPromise;
  }

  private showActionWave(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>(App.ACTION_WAVE_TARGET_SELECTOR);
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
      return;
    }
    if (button.querySelector('.navigator-action-ripple, .mat-ripple, .mat-mdc-button-persistent-ripple')) {
      return;
    }
    const surface = button.querySelector<HTMLElement>('[data-action-wave-surface="true"]')
      ?? button;
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const size = Math.max(rect.width, rect.height) * 2.4;
    const ripple = document.createElement('span');
    ripple.className = 'app-global-action-wave';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    surface.appendChild(ripple);
    setTimeout(() => ripple.remove(), App.ACTION_WAVE_DURATION_MS);
  }

  private shouldShowSideMenu(url: string): boolean {
    const normalizedPath = (url || '/').split('?')[0].trim() || '/';
    return normalizedPath !== '/'
      && !normalizedPath.startsWith('/entry')
      && !normalizedPath.startsWith('/admin/help');
  }

  protected onRouteActivated(): void {
    // The protected outlet has activated. The real header now takes over from
    // the public loading shell; profile/card loaders belong to the page.
    this.completeInitialLandingWarmup(0);
  }

  private syncGameStartup(url: string): void {
    const path = url.split(/[?#]/)[0].replace(/\/$/, '') || '/';
    const session = this.sessionService.currentSession();
    this.gameStartupVisible = this.initialLandingWarmupPending
      && Boolean(session && session.kind !== 'operator-bootstrap')
      && (path === '/' || path === '/game' || path === '/home');
  }

  private completeWarmupIfNavigationSettled(): void {
    if (this.routeWarmupVisible && this.router.navigated && !this.router.getCurrentNavigation()) {
      this.completeInitialLandingWarmup();
    }
  }

  private showRouteWarmup(): void {
    this.clearRouteWarmupHideTimer();
    this.routeWarmupVisible = true;
    this.scheduleRouteWarmupWatchdog();
  }

  private completeInitialLandingWarmup(delayMs = 120): void {
    this.initialLandingWarmupPending = false;
    this.gameStartupVisible = false;
    this.hideRouteWarmup(delayMs);
  }

  private hideRouteWarmup(delayMs = 120): void {
    this.clearRouteWarmupHideTimer();
    this.clearRouteWarmupWatchdogTimer();
    if (delayMs <= 0) {
      this.routeWarmupVisible = false;
      this.changeDetectorRef.detectChanges();
      return;
    }
    this.routeWarmupHideTimer = setTimeout(() => {
      this.routeWarmupVisible = false;
      this.routeWarmupHideTimer = null;
      this.changeDetectorRef.detectChanges();
    }, delayMs);
  }

  private clearRouteWarmupHideTimer(): void {
    if (!this.routeWarmupHideTimer) {
      return;
    }
    clearTimeout(this.routeWarmupHideTimer);
    this.routeWarmupHideTimer = null;
  }

  private scheduleRouteWarmupWatchdog(): void {
    this.clearRouteWarmupWatchdogTimer();
    this.routeWarmupWatchdogTimer = setTimeout(() => {
      this.routeWarmupWatchdogTimer = null;
      this.completeWarmupIfNavigationSettled();
    }, App.ROUTE_WARMUP_WATCHDOG_DELAY_MS);
  }

  private clearRouteWarmupWatchdogTimer(): void {
    if (!this.routeWarmupWatchdogTimer) {
      return;
    }
    clearTimeout(this.routeWarmupWatchdogTimer);
    this.routeWarmupWatchdogTimer = null;
  }

  private scheduleMobileResumeRecovery(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.clearMobileResumeRecoveryTimer();
    this.mobileResumeRecoveryTimer = setTimeout(() => {
      this.mobileResumeRecoveryTimer = null;
      this.recoverAfterMobileResume();
    }, App.MOBILE_RESUME_RECOVERY_DELAY_MS);
  }

  private recoverAfterMobileResume(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.syncSideMenuVisibility(this.resolveInitialRouteUrl());
    this.completeWarmupIfNavigationSettled();
  }

  private clearMobileResumeRecoveryTimer(): void {
    if (!this.mobileResumeRecoveryTimer) {
      return;
    }
    clearTimeout(this.mobileResumeRecoveryTimer);
    this.mobileResumeRecoveryTimer = null;
  }

  private resolveInitialRouteUrl(): string {
    if (typeof window === 'undefined') {
      return this.router.url || '/';
    }
    const routePath = this.stripBasePath(window.location.pathname || '/');
    return `${routePath}${window.location.search}${window.location.hash}` || '/';
  }

  private stripBasePath(pathname: string): string {
    const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
    try {
      const basePath = new URL(baseHref, window.location.origin).pathname;
      if (basePath !== '/' && normalizedPathname.startsWith(basePath)) {
        return `/${normalizedPathname.slice(basePath.length)}`.replace('//', '/') || '/';
      }
    } catch {
      return normalizedPathname;
    }
    return normalizedPathname;
  }

}

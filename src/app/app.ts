import { Component, OnDestroy, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet
} from '@angular/router';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { NavigatorBindings, NavigatorComponent, NavigatorService } from './navigator';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from './shared/app-calendar-date-adapter';
import { Subscription } from 'rxjs';
import { AppInstallPromptComponent } from './shared/ui/components/app-install-prompt/app-install-prompt.component';
import { AppLocationService } from './shared/core/base/services/app-location.service';
import { FirebaseMessagingService } from './shared/core/base/services/firebase-messaging.service';
import { PwaService } from './shared/core/base/services/pwa.service';
import { I18nService } from './shared/i18n';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NavigatorComponent,
    AppInstallPromptComponent
],
  providers: [
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateTime }
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  private readonly router = inject(Router);
  private readonly pwaService = inject(PwaService);
  private readonly appLocationService = inject(AppLocationService);
  private readonly firebaseMessagingService = inject(FirebaseMessagingService);
  private readonly i18nService = inject(I18nService);
  protected readonly navigatorService = inject(NavigatorService);
  private readonly navigatorBindings: NavigatorBindings = {};
  private readonly routerEventsSubscription: Subscription;
  private routeWarmupHideTimer: ReturnType<typeof setTimeout> | null = null;
  private initialLandingWarmupPending = false;
  protected showNavigator = false;
  protected routeWarmupVisible = false;
  protected readonly installPromptVisible = this.pwaService.installPromptVisible;
  protected readonly installPromptBusy = this.pwaService.installBusy;

  constructor() {
    const initialRouteUrl = this.resolveInitialRouteUrl();
    this.i18nService.initialize();
    void this.pwaService.initialize();
    this.appLocationService.initialize();
    this.firebaseMessagingService.initialize();
    this.navigatorService.registerBindings(this.navigatorBindings);
    this.syncNavigatorVisibility(initialRouteUrl);
    this.initialLandingWarmupPending = this.shouldShowLandingWarmup(initialRouteUrl);
    this.routeWarmupVisible = this.initialLandingWarmupPending;
    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.syncNavigatorVisibility(event.url);
        if (this.initialLandingWarmupPending && this.shouldShowLandingWarmup(event.url)) {
          this.showRouteWarmup();
        } else {
          this.hideRouteWarmup(0);
        }
        return;
      }

      if (event instanceof NavigationEnd) {
        this.syncNavigatorVisibility(event.urlAfterRedirects);
        this.completeInitialLandingWarmup();
        return;
      }

      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.completeInitialLandingWarmup(0);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearRouteWarmupHideTimer();
    this.routerEventsSubscription.unsubscribe();
    this.navigatorService.clearBindings(this.navigatorBindings);
  }

  private syncNavigatorVisibility(url: string): void {
    this.showNavigator = this.shouldShowNavigator(url);
  }

  private shouldShowNavigator(url: string): boolean {
    const normalizedPath = (url || '/').split('?')[0].trim() || '/';
    return normalizedPath !== '/' && !normalizedPath.startsWith('/entry') && !normalizedPath.startsWith('/admin');
  }

  protected onRouteActivated(): void {
    this.completeInitialLandingWarmup();
  }

  private shouldShowLandingWarmup(url: string): boolean {
    const normalizedPath = (url || '/').split('?')[0].split('#')[0].trim() || '/';
    return normalizedPath === '/' || normalizedPath.startsWith('/entry');
  }

  private showRouteWarmup(): void {
    this.clearRouteWarmupHideTimer();
    this.routeWarmupVisible = true;
  }

  private completeInitialLandingWarmup(delayMs = 120): void {
    this.initialLandingWarmupPending = false;
    this.hideRouteWarmup(delayMs);
  }

  private hideRouteWarmup(delayMs = 120): void {
    this.clearRouteWarmupHideTimer();
    if (delayMs <= 0) {
      this.routeWarmupVisible = false;
      return;
    }
    this.routeWarmupHideTimer = setTimeout(() => {
      this.routeWarmupVisible = false;
      this.routeWarmupHideTimer = null;
    }, delayMs);
  }

  private clearRouteWarmupHideTimer(): void {
    if (!this.routeWarmupHideTimer) {
      return;
    }
    clearTimeout(this.routeWarmupHideTimer);
    this.routeWarmupHideTimer = null;
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

  protected async onInstallRequested(): Promise<void> {
    const accepted = await this.pwaService.promptInstall();
    if (accepted) {
      await this.firebaseMessagingService.requestAndRegisterForActiveUser();
    }
  }

  protected onInstallDismissed(): void {
    this.pwaService.dismissInstallPrompt();
  }
}

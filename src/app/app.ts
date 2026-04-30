
import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { NavigatorBindings, NavigatorComponent, NavigatorService } from './navigator';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from './shared/app-calendar-date-adapter';
import { Subscription, filter } from 'rxjs';
import { AppInstallPromptComponent } from './shared/ui/components/app-install-prompt/app-install-prompt.component';
import { AppLocationService } from './shared/core/base/services/app-location.service';
import { FirebaseMessagingService } from './shared/core/base/services/firebase-messaging.service';
import { PwaService } from './shared/core/base/services/pwa.service';

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
  protected readonly navigatorService = inject(NavigatorService);
  private readonly navigatorBindings: NavigatorBindings = {};
  private readonly routerEventsSubscription: Subscription;
  protected showNavigator = false;
  protected readonly installPromptVisible = this.pwaService.installPromptVisible;
  protected readonly installPromptBusy = this.pwaService.installBusy;

  constructor() {
    void this.pwaService.initialize();
    this.appLocationService.initialize();
    this.firebaseMessagingService.initialize();
    this.navigatorService.registerBindings(this.navigatorBindings);
    this.syncNavigatorVisibility(this.router.url);
    this.routerEventsSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.syncNavigatorVisibility(event.urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
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

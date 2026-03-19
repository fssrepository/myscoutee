import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { NavigatorBindings, NavigatorComponent, NavigatorService } from './navigator';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from './shared/app-calendar-date-adapter';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    NavigatorComponent
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
  protected readonly navigatorService = inject(NavigatorService);
  private readonly navigatorBindings: NavigatorBindings = {};
  private readonly routerEventsSubscription: Subscription;
  protected showNavigator = false;

  constructor() {
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
    return normalizedPath !== '/' && !normalizedPath.startsWith('/entry');
  }
}

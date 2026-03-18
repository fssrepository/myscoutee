import { CommonModule } from '@angular/common';
import { Component, OnDestroy, Type, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  styleUrl: './app-shell.component.scss',
  template: `
    <ng-container *ngIf="showNavigator && navigatorComponent() as navigatorComponent">
      <ng-container *ngComponentOutlet="navigatorComponent"></ng-container>
    </ng-container>
    <router-outlet></router-outlet>
  `
})
export class AppShellComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly navigatorComponentRef = signal<Type<unknown> | null>(null);
  private readonly routerEventsSubscription: Subscription;

  protected readonly navigatorComponent = this.navigatorComponentRef.asReadonly();
  protected showNavigator = false;

  constructor() {
    this.syncNavigatorVisibility(this.router.url);
    this.routerEventsSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.syncNavigatorVisibility(event.urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
  }

  private syncNavigatorVisibility(url: string): void {
    const shouldShowNavigator = this.shouldShowNavigator(url);
    this.showNavigator = shouldShowNavigator;
    if (shouldShowNavigator) {
      void this.ensureNavigatorLoaded();
    }
  }

  private shouldShowNavigator(url: string): boolean {
    const normalizedPath = (url || '/').split('?')[0].trim() || '/';
    return normalizedPath !== '/' && !normalizedPath.startsWith('/entry');
  }

  private async ensureNavigatorLoaded(): Promise<void> {
    if (this.navigatorComponentRef()) {
      return;
    }
    const module = await import('./navigator/components/navigator/navigator.component');
    this.navigatorComponentRef.set(module.NavigatorComponent);
  }
}

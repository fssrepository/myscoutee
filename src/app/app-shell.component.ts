import { Component, Type, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AssetPopupService } from './asset/asset-popup.service';
import { ActivitiesDbContextService } from './shared/activities-db-context.service';
import { EventEditorService } from './shared/event-editor.service';
import { AppContext, USER_BY_ID_LOAD_CONTEXT_KEY } from './shared/core';
import { UserMenuShellService } from './shared/user-menu-shell.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatButtonModule, MatIconModule],
  styleUrl: './app-shell.component.scss',
  template: `
    <button
      *ngIf="showShellUserMenuButton()"
      mat-icon-button
      type="button"
      class="user-selector-btn-global"
      [class.is-loading]="isShellUserMenuLoading()"
      [class.is-error]="hasShellUserMenuLoadError()"
      [class.is-open]="userMenuOpen()"
      [disabled]="!canToggleShellUserMenu()"
      [attr.aria-label]="shellUserMenuAriaLabel()"
      [attr.aria-busy]="isShellUserMenuLoading()"
      [title]="shellUserMenuTitle()"
      (click)="toggleShellUserMenu()"
    >
      <span class="user-selector-load-ring" *ngIf="showShellUserMenuLoadRing()" aria-hidden="true">
        <svg viewBox="0 0 58 58" class="user-selector-load-ring-svg">
          <defs>
            <linearGradient id="user-menu-load-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="rgb(235, 147, 33)"></stop>
              <stop offset="100%" stop-color="rgb(247, 190, 52)"></stop>
            </linearGradient>
            <linearGradient id="user-menu-load-gradient-overdue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="rgb(213, 54, 68)"></stop>
              <stop offset="100%" stop-color="rgb(196, 29, 42)"></stop>
            </linearGradient>
          </defs>
          <circle class="user-selector-load-ring-track" cx="29" cy="29" r="26"></circle>
          <circle
            class="user-selector-load-ring-progress"
            [class.is-loading]="isShellUserMenuLoading() && !hasShellUserMenuLoadError()"
            [class.is-overdue]="hasShellUserMenuLoadError()"
            cx="29"
            cy="29"
            r="26"
            [attr.stroke-dasharray]="shellUserMenuRingCircumference"
            [attr.stroke-dashoffset]="hasShellUserMenuLoadError() ? 0 : shellUserMenuRingCircumference"
          ></circle>
        </svg>
      </span>
      <span
        class="user-initial"
        [ngClass]="shellUserMenuAvatarClassList()"
        [style.backgroundImage]="shellUserMenuAvatarBackgroundImage()"
      >
        <mat-icon *ngIf="isShellUserMenuLoading()">schedule</mat-icon>
        <mat-icon *ngIf="!isShellUserMenuLoading() && hasShellUserMenuLoadError()">person_off</mat-icon>
        <ng-container *ngIf="canToggleShellUserMenu() && !shellUserMenuAvatarState().imageUrl">
          {{ shellUserMenuAvatarState().initials }}
        </ng-container>
      </span>
      <span class="badge-dot" *ngIf="canToggleShellUserMenu() && shellUserMenuAvatarState().badgeCount > 0">
        {{ shellUserMenuAvatarState().badgeCount }}
      </span>
    </button>
    <router-outlet></router-outlet>
    <ng-container *ngIf="activitiesPopupComponent() as activitiesComponent">
      <ng-container *ngComponentOutlet="activitiesComponent"></ng-container>
    </ng-container>
    <ng-container *ngIf="assetPopupComponent() as assetComponent">
      <ng-container *ngComponentOutlet="assetComponent"></ng-container>
    </ng-container>
    <ng-container *ngIf="eventEditorPopupComponent() as popupComponent">
      <ng-container *ngComponentOutlet="popupComponent"></ng-container>
    </ng-container>
  `
})
export class AppShellComponent {
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;
  private static readonly USER_MENU_RING_RADIUS = 26;
  private static readonly USER_MENU_RING_CIRCUMFERENCE = 2 * Math.PI * AppShellComponent.USER_MENU_RING_RADIUS;

  private readonly router = inject(Router);
  private readonly appCtx = inject(AppContext);
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly eventEditorService = inject(EventEditorService);
  private readonly userMenuShellService = inject(UserMenuShellService);
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly currentUrlRef = signal(this.normalizeRouteUrl(this.router.url));
  private readonly userMenuLoadOverdueRef = signal(false);
  private readonly activeUserLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();
  protected readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  protected readonly assetPopupComponent = this.assetPopupComponentRef.asReadonly();
  protected readonly shellUserMenuAvatarState = this.userMenuShellService.avatarState;
  protected readonly userMenuOpen = this.userMenuShellService.menuOpen;
  protected readonly shellUserMenuRingCircumference = AppShellComponent.USER_MENU_RING_CIRCUMFERENCE;
  protected readonly showShellUserMenuButton = computed(() => this.isInternalRoute(this.currentUrlRef()));
  protected readonly isShellUserMenuLoading = computed(() => {
    const status = this.activeUserLoadState().status;
    return this.showShellUserMenuButton() && (status === 'idle' || status === 'loading');
  });
  protected readonly hasShellUserMenuLoadError = computed(() => {
    const status = this.activeUserLoadState().status;
    return this.showShellUserMenuButton() && (
      status === 'error'
      || status === 'timeout'
      || this.userMenuLoadOverdueRef()
    );
  });
  protected readonly canToggleShellUserMenu = computed(() =>
    this.showShellUserMenuButton() && this.activeUserLoadState().status === 'success'
  );
  protected readonly showShellUserMenuLoadRing = computed(() =>
    this.showShellUserMenuButton() && !this.canToggleShellUserMenu()
  );

  constructor() {
    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) {
        return;
      }
      this.currentUrlRef.set(this.normalizeRouteUrl(event.urlAfterRedirects));
    });

    // Event editor popup lazy loading
    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      if (isOpen && !this.eventEditorPopupComponentRef()) {
        void this.ensureEventEditorPopupLoaded();
      }
    });
    
    // Activities popup lazy loading
    effect(() => {
      const isActivitiesOpen = this.activitiesContext.activitiesOpen();
      const navigationRequest = this.activitiesContext.activitiesNavigationRequest();
      const hasInternalActivitiesRequest = navigationRequest?.type === 'members'
        || navigationRequest?.type === 'chatResource'
        || navigationRequest?.type === 'eventEditorMembers';
      const hasEventEditorResourceRequest = this.eventEditorService.subEventResourcePopupRequest() !== null;
      const shouldLoadActivitiesPopup = isActivitiesOpen || hasInternalActivitiesRequest || hasEventEditorResourceRequest;
      if (shouldLoadActivitiesPopup && !this.activitiesPopupComponentRef()) {
        void this.ensureActivitiesPopupLoaded();
      }
      // Warm-load editor chunk while activities is open to avoid first-click flash.
      if (shouldLoadActivitiesPopup && !this.eventEditorPopupComponentRef()) {
        //requestIdleCallback(() => {
          void this.ensureEventEditorPopupLoaded();
        //});
      }
    });

    effect(() => {
      const isAssetPopupVisible = this.assetPopupService.visible();
      if (isAssetPopupVisible && !this.assetPopupComponentRef()) {
        void this.ensureAssetPopupLoaded();
      }
    });

    effect(() => {
      const isInternal = this.showShellUserMenuButton();
      const status = this.activeUserLoadState().status;

      if (!isInternal) {
        this.userMenuShellService.setMenuOpen(false);
        this.clearUserMenuLoadState();
        return;
      }

      if (status === 'loading' || status === 'idle') {
        this.beginUserMenuLoadWindow();
        return;
      }

      if (status === 'success') {
        this.clearUserMenuLoadState();
        return;
      }

      this.markUserMenuLoadOverdue();
    });
  }

  protected toggleShellUserMenu(): void {
    if (!this.canToggleShellUserMenu()) {
      return;
    }
    this.userMenuShellService.toggleMenu();
  }

  protected shellUserMenuAvatarClassList(): Record<string, boolean> {
    const state = this.shellUserMenuAvatarState();
    const isSuccess = this.canToggleShellUserMenu();
    return {
      [`user-color-${state.gender}`]: isSuccess,
      'has-photo': isSuccess && !!state.imageUrl,
      'is-placeholder': !isSuccess
    };
  }

  protected shellUserMenuAvatarBackgroundImage(): string | null {
    if (!this.canToggleShellUserMenu()) {
      return null;
    }
    const imageUrl = this.shellUserMenuAvatarState().imageUrl?.trim() ?? '';
    return imageUrl ? `url(${imageUrl})` : null;
  }

  protected shellUserMenuAriaLabel(): string {
    if (this.canToggleShellUserMenu()) {
      return this.userMenuOpen() ? 'Close user menu' : 'Open user menu';
    }
    if (this.hasShellUserMenuLoadError()) {
      return 'Profile failed to load';
    }
    return 'Loading profile';
  }

  protected shellUserMenuTitle(): string {
    if (this.canToggleShellUserMenu()) {
      return this.userMenuOpen() ? 'Close profile menu' : 'Open profile menu';
    }
    if (this.hasShellUserMenuLoadError()) {
      return 'Profile was not able to load';
    }
    return 'Loading profile';
  }

  private async ensureEventEditorPopupLoaded(): Promise<void> {
    if (this.eventEditorPopupComponentRef()) {
      return;
    }
    const module = await import('./activity/components/event-editor-popup/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }
  
  private async ensureActivitiesPopupLoaded(): Promise<void> {
    if (this.activitiesPopupComponentRef()) {
      return;
    }
    const module = await import('./activity/components/event-activities-popup/event-activities-popup.component');
    this.activitiesPopupComponentRef.set(module.EventActivitiesPopupComponent);
  }

  private async ensureAssetPopupLoaded(): Promise<void> {
    if (this.assetPopupComponentRef()) {
      return;
    }
    const module = await import('./asset/components/asset-popup/asset-popup.component');
    this.assetPopupComponentRef.set(module.AssetPopupComponent);
  }

  private beginUserMenuLoadWindow(): void {
    if (this.userMenuLoadOverdueTimer || this.userMenuLoadOverdueRef()) {
      return;
    }
    this.userMenuLoadOverdueRef.set(false);
    this.userMenuLoadOverdueTimer = setTimeout(() => {
      this.userMenuLoadOverdueTimer = null;
      this.userMenuLoadOverdueRef.set(true);
    }, AppShellComponent.USER_MENU_LOAD_DURATION_MS);
  }

  private clearUserMenuLoadState(): void {
    if (this.userMenuLoadOverdueTimer) {
      clearTimeout(this.userMenuLoadOverdueTimer);
      this.userMenuLoadOverdueTimer = null;
    }
    this.userMenuLoadOverdueRef.set(false);
  }

  private markUserMenuLoadOverdue(): void {
    if (this.userMenuLoadOverdueTimer) {
      clearTimeout(this.userMenuLoadOverdueTimer);
      this.userMenuLoadOverdueTimer = null;
    }
    this.userMenuLoadOverdueRef.set(true);
  }

  private isInternalRoute(url: string): boolean {
    return url !== '/' && !url.startsWith('/entry');
  }

  private normalizeRouteUrl(url: string): string {
    const [pathOnly] = url.split('?');
    const [withoutHash] = (pathOnly || '').split('#');
    const trimmed = withoutHash.trim();
    if (!trimmed || trimmed === '/') {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}

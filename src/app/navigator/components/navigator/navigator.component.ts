import { CommonModule } from '@angular/common';
import { Component, HostListener, Type, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AssetPopupService } from '../../../asset/asset-popup.service';
import { ActivitiesDbContextService } from '../../../shared/activities-db-context.service';
import { AppContext, USER_BY_ID_LOAD_CONTEXT_KEY } from '../../../shared/core';
import { EventEditorService } from '../../../shared/event-editor.service';
import { NavigatorMenubarComponent } from '../navigator-menubar/navigator-menubar.component';
import { NavigatorMenuComponent } from '../navigator-menu/navigator-menu.component';
import { NavigatorActiveUser, NavigatorBindings, NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator',
  standalone: true,
  imports: [CommonModule, NavigatorMenubarComponent, NavigatorMenuComponent],
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent {
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;
  private static readonly USER_MENU_RING_RADIUS = 26;
  private static readonly USER_MENU_RING_CIRCUMFERENCE = 2 * Math.PI * NavigatorComponent.USER_MENU_RING_RADIUS;
  private static readonly FALLBACK_ACTIVE_USER: NavigatorActiveUser = {
    initials: '',
    gender: 'woman',
    name: '',
    age: 0,
    city: '',
    profileStatus: 'Public'
  };

  private readonly router = inject(Router);
  private readonly appCtx = inject(AppContext);
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly eventEditorService = inject(EventEditorService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly currentUrlRef = signal(this.normalizeRouteUrl(this.router.url));
  private readonly userMenuLoadOverdueRef = signal(false);
  private readonly activeUserLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly bindings = this.navigatorService.bindings;
  protected readonly userMenuOpen = this.navigatorService.menuOpen;
  protected readonly showUserMenuButton = computed(() => this.isInternalRoute(this.currentUrlRef()));
  protected readonly hasBindings = computed(() => this.bindings() !== null);
  protected readonly isUserMenuLoading = computed(() => {
    if (!this.showUserMenuButton()) {
      return false;
    }
    if (!this.hasBindings()) {
      return true;
    }
    const status = this.activeUserLoadState().status;
    return status === 'idle' || status === 'loading';
  });
  protected readonly hasUserMenuLoadError = computed(() => {
    if (!this.showUserMenuButton() || !this.hasBindings()) {
      return false;
    }
    const status = this.activeUserLoadState().status;
    return status === 'error' || status === 'timeout' || this.userMenuLoadOverdueRef();
  });
  protected readonly canToggleUserMenu = computed(() =>
    this.showUserMenuButton() && this.hasBindings() && this.activeUserLoadState().status === 'success'
  );
  protected readonly showUserMenuLoadRing = computed(() =>
    this.showUserMenuButton() && !this.canToggleUserMenu()
  );
  protected readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();
  protected readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  protected readonly assetPopupComponent = this.assetPopupComponentRef.asReadonly();
  protected readonly userMenuRingCircumference = NavigatorComponent.USER_MENU_RING_CIRCUMFERENCE;

  constructor() {
    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) {
        return;
      }
      this.currentUrlRef.set(this.normalizeRouteUrl(event.urlAfterRedirects));
    });

    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      if (isOpen && !this.eventEditorPopupComponentRef()) {
        void this.ensureEventEditorPopupLoaded();
      }
    });

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
    });

    effect(() => {
      const isAssetPopupVisible = this.assetPopupService.visible();
      if (isAssetPopupVisible && !this.assetPopupComponentRef()) {
        void this.ensureAssetPopupLoaded();
      }
    });

    effect(() => {
      const isInternal = this.showUserMenuButton();
      const hasBindings = this.hasBindings();
      const status = this.activeUserLoadState().status;

      if (!isInternal) {
        this.navigatorService.closeMenu();
        this.clearUserMenuLoadState();
        return;
      }

      if (!hasBindings || status === 'loading' || status === 'idle') {
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

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.navigatorService.isSettingsMenuOpen()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('.user-settings-menu') || target.closest('.user-menu-settings-btn')) {
      return;
    }
    this.closeUserSettingsMenu();
  }

  protected get showUserMenu(): boolean {
    return this.navigatorService.isMenuOpen();
  }

  protected get showUserSettingsMenu(): boolean {
    return this.navigatorService.isSettingsMenuOpen();
  }

  protected get activeUser(): NavigatorActiveUser {
    return this.bindings()?.activeUser() ?? NavigatorComponent.FALLBACK_ACTIVE_USER;
  }

  protected get featuredImagePreview(): string | null {
    return this.bindings()?.featuredImagePreview() ?? null;
  }

  protected get userBadgeCount(): number {
    return this.bindings()?.userBadgeCount() ?? 0;
  }

  protected get profileCompletionPercent(): number {
    return this.bindings()?.profileCompletionPercent() ?? 0;
  }

  protected get activeHostTier(): string {
    return this.bindings()?.activeHostTier() ?? '';
  }

  protected get hostImpressionsBadge(): number {
    return this.bindings()?.hostImpressionsBadge() ?? 0;
  }

  protected get activeMemberTrait(): string {
    return this.bindings()?.activeMemberTrait() ?? '';
  }

  protected get memberImpressionsBadge(): number {
    return this.bindings()?.memberImpressionsBadge() ?? 0;
  }

  protected get memberImpressionTitle(): string {
    return this.bindings()?.memberImpressionTitle() ?? '';
  }

  protected get gameBadge(): number {
    return this.bindings()?.gameBadge() ?? 0;
  }

  protected get chatBadge(): number {
    return this.bindings()?.chatBadge() ?? 0;
  }

  protected get invitationsBadge(): number {
    return this.bindings()?.invitationsBadge() ?? 0;
  }

  protected get eventsBadge(): number {
    return this.bindings()?.eventsBadge() ?? 0;
  }

  protected get hostingBadge(): number {
    return this.bindings()?.hostingBadge() ?? 0;
  }

  protected get assetTicketsBadge(): number {
    return this.bindings()?.assetTicketsBadge() ?? 0;
  }

  protected get eventFeedbackBadge(): number {
    return this.bindings()?.eventFeedbackBadge() ?? 0;
  }

  protected toggleUserMenu(): void {
    if (!this.canToggleUserMenu()) {
      return;
    }
    this.navigatorService.toggleMenu();
  }

  protected closeUserMenu(): void {
    this.navigatorService.closeMenu();
  }

  protected toggleUserSettingsMenu(): void {
    this.navigatorService.toggleSettingsMenu();
  }

  protected closeUserSettingsMenu(): void {
    this.navigatorService.closeSettingsMenu();
  }

  protected userMenuAriaLabel(): string {
    if (this.canToggleUserMenu()) {
      return this.showUserMenu ? 'Close user menu' : 'Open user menu';
    }
    if (this.hasUserMenuLoadError()) {
      return 'Profile failed to load';
    }
    return 'Loading profile';
  }

  protected userMenuTitle(): string {
    if (this.canToggleUserMenu()) {
      return this.showUserMenu ? 'Close profile menu' : 'Open profile menu';
    }
    if (this.hasUserMenuLoadError()) {
      return 'Profile was not able to load';
    }
    return 'Loading profile';
  }

  private async ensureEventEditorPopupLoaded(): Promise<void> {
    if (this.eventEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-editor-popup/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }

  private async ensureActivitiesPopupLoaded(): Promise<void> {
    if (this.activitiesPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-activities-popup/event-activities-popup.component');
    this.activitiesPopupComponentRef.set(module.EventActivitiesPopupComponent);
  }

  private async ensureAssetPopupLoaded(): Promise<void> {
    if (this.assetPopupComponentRef()) {
      return;
    }
    const module = await import('../../../asset/components/asset-popup/asset-popup.component');
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
    }, NavigatorComponent.USER_MENU_LOAD_DURATION_MS);
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

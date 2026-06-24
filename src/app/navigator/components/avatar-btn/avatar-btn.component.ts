import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import { HelpCenterService, USER_BY_ID_LOAD_CONTEXT_KEY, USER_PROFILE_SAVE_CONTEXT_KEY, type UserDto } from '../../../shared/core';
import {
  AppContext,
  AppMenuComponent,
  type ActivityCounterKey,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui';
import { NavigatorService } from '../../navigator.service';

interface NavigatorAvatarState {
  badgeCount: number;
  imageUrl: string | null;
}

type NavigatorAvatarMenuItemId = 'navigator-avatar';
type NavigatorAvatarMenuContext = { kind: 'toggle-menu' };

@Component({
  selector: 'app-avatar-btn',
  standalone: true,
  imports: [CommonModule, AppMenuComponent],
  templateUrl: './avatar-btn.component.html',
  styleUrl: './avatar-btn.component.scss'
})
export class AvatarBtnComponent implements OnDestroy {
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;

  private readonly router = inject(Router);
  private readonly appCtx = inject(AppContext);
  private readonly helpCenterService = inject(HelpCenterService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly currentUrlRef = signal(this.normalizeRouteUrl(this.router.url));
  private readonly userMenuLoadOverdueRef = signal(false);
  private readonly activeUserLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
  private readonly profileSaveLoadState = this.appCtx.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  private readonly routerEventsSubscription: Subscription;
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly bindings = this.navigatorService.bindings;
  protected readonly activeUser = this.appCtx.activeUserProfile;
  protected readonly avatarState = computed<NavigatorAvatarState>(() => {
    const user = this.activeUser();
    return {
      badgeCount: user ? this.resolveUserBadgeCount(user) : 0,
      imageUrl: this.resolveUserImageUrl(user)
    };
  });
  protected readonly menuUiState = this.navigatorService.menuUiState;
  protected readonly isCoveredByAssetPopup = this.navigatorService.navigatorCoveredByAssetPopup;
  protected readonly visible = computed(() => this.isInternalRoute(this.currentUrlRef()));
  protected readonly hasBindings = computed(() => this.bindings() !== null);
  protected readonly isOpen = computed(() => this.menuUiState().open);
  protected readonly hasOfflineProfile = computed(() =>
    !this.appCtx.isOnline() && this.activeUser() !== null
  );
  protected readonly canToggle = computed(() =>
    this.visible()
    && this.hasBindings()
    && (this.activeUserLoadState().status === 'success' || this.hasOfflineProfile())
  );
  protected readonly isProfileSaving = computed(() => this.profileSaveLoadState().status === 'loading');
  protected readonly hasProfileSaveError = computed(() => {
    const status = this.profileSaveLoadState().status;
    return status === 'error' || status === 'timeout';
  });
  protected readonly isLoading = computed(() => {
    if (!this.visible()) {
      return false;
    }
    if (!this.hasBindings()) {
      return true;
    }
    if (this.hasOfflineProfile()) {
      return this.isProfileSaving();
    }
    const status = this.activeUserLoadState().status;
    return status === 'idle' || status === 'loading' || this.isProfileSaving();
  });
  protected readonly hasLoadError = computed(() => {
    if (!this.visible() || !this.hasBindings()) {
      return false;
    }
    if (this.hasOfflineProfile()) {
      return this.hasProfileSaveError();
    }
    const status = this.activeUserLoadState().status;
    return status === 'error' || status === 'timeout' || this.userMenuLoadOverdueRef() || this.hasProfileSaveError();
  });
  protected readonly showLoadRing = computed(() =>
    this.visible() && (!this.canToggle() || this.isProfileSaving() || this.hasProfileSaveError())
  );
  protected readonly badgeCount = computed(() =>
    this.canToggle() ? this.avatarState().badgeCount : 0
  );
  protected readonly ariaLabel = computed(() => {
    if (this.canToggle() && this.isProfileSaving()) {
      return 'Saving profile';
    }
    if (this.canToggle() && this.hasProfileSaveError()) {
      return 'Profile save failed';
    }
    if (this.canToggle()) {
      return this.isOpen() ? 'Close user menu' : 'Open user menu';
    }
    if (this.hasLoadError()) {
      return 'Profile failed to load';
    }
    return 'Loading profile';
  });
  protected readonly title = computed(() => {
    if (this.canToggle() && this.isProfileSaving()) {
      return 'Saving profile';
    }
    if (this.canToggle() && this.hasProfileSaveError()) {
      return this.profileSaveLoadState().status === 'timeout'
        ? 'Profile save timed out'
        : 'Profile was not able to save';
    }
    if (this.canToggle()) {
      if (this.hasOfflineProfile()) {
        return this.isOpen() ? 'Close profile menu (offline)' : 'Open profile menu (offline)';
      }
      return this.isOpen() ? 'Close profile menu' : 'Open profile menu';
    }
    if (this.hasLoadError()) {
      return 'Profile was not able to load';
    }
    return 'Loading profile';
  });
  protected readonly avatarMenuItems = computed<readonly AppMenuItem<NavigatorAvatarMenuItemId, NavigatorAvatarMenuContext>[]>(() => {
    const user = this.activeUser();
    const canToggle = this.canToggle();
    const isLoading = this.isLoading();
    const hasLoadError = this.hasLoadError();
    const badgeCount = this.badgeCount();
    const imageUrl = canToggle ? this.avatarState().imageUrl ?? '' : '';
    const icon = isLoading ? 'schedule' : hasLoadError ? 'person_off' : '';
    return [{
      id: 'navigator-avatar',
      kind: 'action',
      layout: 'image',
      palette: canToggle && user?.gender === 'man' ? 'blue' : canToggle ? 'pink' : 'neutral',
      imageUrl,
      imageAlt: this.ariaLabel(),
      imageFallback: !imageUrl && canToggle ? user?.initials ?? '' : '',
      icon,
      ariaLabel: this.ariaLabel(),
      disabled: !canToggle,
      counter: canToggle && badgeCount > 0 ? { value: badgeCount, max: 9 } : null,
      progress: this.showLoadRing()
        ? {
            state: hasLoadError ? 'error' : 'loading',
            shape: 'circle',
            durationMs: AvatarBtnComponent.USER_MENU_LOAD_DURATION_MS
          }
        : null,
      context: { kind: 'toggle-menu' }
    }];
  });

  constructor() {
    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) {
        return;
      }
      this.currentUrlRef.set(this.normalizeRouteUrl(event.urlAfterRedirects));
    });

    effect(() => {
      const isInternal = this.visible();
      const hasBindings = this.hasBindings();
      const status = this.activeUserLoadState().status;

      if (!isInternal) {
        this.navigatorService.closeMenu();
        this.clearUserMenuLoadState();
        return;
      }

      if (!hasBindings || status === 'loading' || status === 'idle') {
        void this.helpCenterService.preloadAll();
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

  protected onToggleMenu(): void {
    if (!this.canToggle()) {
      return;
    }
    this.navigatorService.toggleMenu();
  }

  protected onAvatarMenuSelect(
    event: AppMenuItemSelectEvent<NavigatorAvatarMenuItemId, NavigatorAvatarMenuContext>
  ): void {
    if (event.context?.kind === 'toggle-menu') {
      this.onToggleMenu();
    }
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
    this.clearUserMenuLoadState();
  }

  private beginUserMenuLoadWindow(): void {
    if (this.userMenuLoadOverdueTimer || this.userMenuLoadOverdueRef()) {
      return;
    }
    this.userMenuLoadOverdueRef.set(false);
    this.userMenuLoadOverdueTimer = setTimeout(() => {
      this.userMenuLoadOverdueTimer = null;
      this.userMenuLoadOverdueRef.set(true);
    }, AvatarBtnComponent.USER_MENU_LOAD_DURATION_MS);
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

  private resolveUserBadgeCount(user: UserDto): number {
    if (this.isAdminProfile(user)) {
      return (
        this.resolveActivityBadge(user, 'game') +
        this.resolveActivityBadge(user, 'chat') +
        this.resolveActivityBadge(user, 'feedback') +
        this.resolveActivityBadge(user, 'adminJobs') +
        this.resolveActivityBadge(user, 'adminMetrics')
      );
    }
    const impressionFlags = this.appCtx.getUserImpressionChangeFlags(user.id);
    return (
      (impressionFlags.host ? 1 : 0) +
      (impressionFlags.member ? 1 : 0) +
      this.resolveActivityBadge(user, 'game') +
      this.resolveActivityBadge(user, 'chat') +
      this.resolveActivityBadge(user, 'invitations') +
      this.resolveActivityBadge(user, 'events') +
      this.resolveActivityBadge(user, 'hosting') +
      this.resolveActivityBadge(user, 'cars') +
      this.resolveActivityBadge(user, 'accommodation') +
      this.resolveActivityBadge(user, 'supplies') +
      this.resolveActivityBadge(user, 'tickets') +
      this.resolveActivityBadge(user, 'contacts') +
      this.resolveActivityBadge(user, 'feedback')
    );
  }

  private resolveActivityBadge(user: UserDto, key: ActivityCounterKey): number {
    const override = this.appCtx.getUserCounterOverride(user.id, key);
    if (override !== null) {
      return override;
    }
    return user.activities?.[key] ?? 0;
  }

  private isAdminProfile(user: UserDto): boolean {
    return user.hostTier === 'Admin'
      || user.statusText === 'Admin workspace'
      || user.id === 'admin'
      || user.id.startsWith('admin-');
  }

  private resolveUserImageUrl(user: UserDto | null): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import { AppContext, USER_BY_ID_LOAD_CONTEXT_KEY, type UserDto } from '../../../shared/core';
import { NavigatorActiveUser, NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-avatar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './navigator-menubar.component.html',
  styleUrl: './navigator-menubar.component.scss'
})
export class NavigatorAvatarComponent implements OnDestroy {
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;
  private static readonly USER_MENU_RING_RADIUS = 26;
  private static readonly USER_MENU_RING_CIRCUMFERENCE = 2 * Math.PI * NavigatorAvatarComponent.USER_MENU_RING_RADIUS;
  private static readonly FALLBACK_ACTIVE_USER: NavigatorActiveUser = {
    initials: '',
    gender: 'woman',
    name: '',
    age: 0,
    city: '',
    profileStatus: 'public'
  };

  private readonly router = inject(Router);
  private readonly appCtx = inject(AppContext);
  private readonly navigatorService = inject(NavigatorService);
  private readonly currentUrlRef = signal(this.normalizeRouteUrl(this.router.url));
  private readonly userMenuLoadOverdueRef = signal(false);
  private readonly activeUserLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
  private readonly routerEventsSubscription: Subscription;
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly ringCircumference = NavigatorAvatarComponent.USER_MENU_RING_CIRCUMFERENCE;
  protected readonly bindings = this.navigatorService.bindings;
  protected readonly hydratedUser = this.navigatorService.hydratedUser;
  protected readonly isOpen = this.navigatorService.menuOpen;
  protected readonly visible = computed(() => this.isInternalRoute(this.currentUrlRef()));
  protected readonly hasBindings = computed(() => this.bindings() !== null);
  protected readonly activeUser = computed(() => this.resolveActiveUser());
  protected readonly imageUrl = computed(() => this.resolveImageUrl());
  protected readonly canToggle = computed(() =>
    this.visible() && this.hasBindings() && this.activeUserLoadState().status === 'success'
  );
  protected readonly isLoading = computed(() => {
    if (!this.visible()) {
      return false;
    }
    if (!this.hasBindings()) {
      return true;
    }
    const status = this.activeUserLoadState().status;
    return status === 'idle' || status === 'loading';
  });
  protected readonly hasLoadError = computed(() => {
    if (!this.visible() || !this.hasBindings()) {
      return false;
    }
    const status = this.activeUserLoadState().status;
    return status === 'error' || status === 'timeout' || this.userMenuLoadOverdueRef();
  });
  protected readonly showLoadRing = computed(() => this.visible() && !this.canToggle());
  protected readonly badgeCount = computed(() =>
    this.canToggle() ? (this.bindings()?.userBadgeCount() ?? 0) : 0
  );
  protected readonly ariaLabel = computed(() => {
    if (this.canToggle()) {
      return this.isOpen() ? 'Close user menu' : 'Open user menu';
    }
    if (this.hasLoadError()) {
      return 'Profile failed to load';
    }
    return 'Loading profile';
  });
  protected readonly title = computed(() => {
    if (this.canToggle()) {
      return this.isOpen() ? 'Close profile menu' : 'Open profile menu';
    }
    if (this.hasLoadError()) {
      return 'Profile was not able to load';
    }
    return 'Loading profile';
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

  protected avatarClassList(): Record<string, boolean> {
    const activeUser = this.activeUser();
    const canToggle = this.canToggle();
    const imageUrl = this.imageUrl();
    return {
      [`user-color-${activeUser.gender}`]: canToggle,
      'has-photo': canToggle && !!imageUrl,
      'is-placeholder': !canToggle
    };
  }

  protected avatarBackgroundImage(): string | null {
    if (!this.canToggle()) {
      return null;
    }
    const trimmedImageUrl = this.imageUrl()?.trim() ?? '';
    return trimmedImageUrl ? `url(${trimmedImageUrl})` : null;
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
    this.clearUserMenuLoadState();
  }

  private resolveActiveUser(): NavigatorActiveUser {
    const hydratedUser = this.hydratedUser();
    if (hydratedUser) {
      return this.toNavigatorActiveUser(hydratedUser);
    }
    return this.bindings()?.activeUser() ?? NavigatorAvatarComponent.FALLBACK_ACTIVE_USER;
  }

  private resolveImageUrl(): string | null {
    const hydratedUser = this.hydratedUser();
    const hydratedImage = hydratedUser?.images?.find(image => image.trim().length > 0) ?? null;
    if (hydratedImage) {
      return hydratedImage;
    }
    return this.bindings()?.featuredImagePreview() ?? null;
  }

  private toNavigatorActiveUser(user: UserDto): NavigatorActiveUser {
    return {
      initials: (user.initials ?? '').trim(),
      gender: user.gender === 'man' ? 'man' : 'woman',
      name: (user.name ?? '').trim(),
      age: Number.isFinite(user.age) ? Math.max(0, Math.trunc(Number(user.age))) : 0,
      city: (user.city ?? '').trim(),
      profileStatus: user.profileStatus ?? 'public'
    };
  }

  private beginUserMenuLoadWindow(): void {
    if (this.userMenuLoadOverdueTimer || this.userMenuLoadOverdueRef()) {
      return;
    }
    this.userMenuLoadOverdueRef.set(false);
    this.userMenuLoadOverdueTimer = setTimeout(() => {
      this.userMenuLoadOverdueTimer = null;
      this.userMenuLoadOverdueRef.set(true);
    }, NavigatorAvatarComponent.USER_MENU_LOAD_DURATION_MS);
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

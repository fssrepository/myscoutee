import { Injectable, effect, inject, signal } from '@angular/core';
import { AppContext, SessionService, UsersService, type UserDto } from '../shared/core';

export interface NavigatorActiveUser {
  initials: string;
  gender: 'woman' | 'man';
  name: string;
  age: number;
  city: string;
  profileStatus: string;
}

export interface NavigatorBindings {
  activeUser(): NavigatorActiveUser;
  featuredImagePreview(): string | null;
  userBadgeCount(): number;
  syncHydratedUser?(user: UserDto): void;
  profileCompletionPercent(): number;
  activeHostTier(): string;
  hostImpressionsBadge(): number;
  activeMemberTrait(): string;
  memberImpressionsBadge(): number;
  memberImpressionTitle(): string;
  gameBadge(): number;
  chatBadge(): number;
  invitationsBadge(): number;
  eventsBadge(): number;
  hostingBadge(): number;
  assetTicketsBadge(): number;
  eventFeedbackBadge(): number;
  profileStatusClass(status: string): string;
  completionBadgeStyle(percent: number): Record<string, string> | null;
  getHostTierToneClass(tier: string): string;
  getHostTierColorClass(tier: string): string;
  getHostTierIcon(tier: string): string;
  getTraitToneClass(trait: string): string;
  getTraitColorClass(trait: string): string;
  getTraitIcon(trait: string): string;
  openProfileEditor(): void;
  openHostImpressions(): void;
  openMemberImpressions(): void;
  openRatesShortcut(): void;
  openChatShortcut(): void;
  openInvitationShortcut(): void;
  openEventShortcut(): void;
  openHostingShortcut(): void;
  openAssetCarPopup(): void;
  openAssetAccommodationPopup(): void;
  openAssetSuppliesPopup(): void;
  openAssetTicketsPopup(): void;
  openEventFeedbackPopup(event?: Event): void;
  openReportUserFromFeedback(event?: Event): void;
  openHelpPopup(): void;
  openSendFeedbackPopup(): void;
  openGdprPopup(): void;
  openDeleteAccountConfirm(): void;
  openLogoutConfirm(): void;
}

@Injectable({
  providedIn: 'root'
})
export class NavigatorService {
  private readonly usersService = inject(UsersService);
  private readonly sessionService = inject(SessionService);
  private readonly appCtx = inject(AppContext);
  private readonly bindingsRef = signal<NavigatorBindings | null>(null);
  private readonly hydratedUserRef = signal<UserDto | null>(null);
  private readonly hydrationRequestKeyRef = signal('');
  private readonly menuOpenRef = signal(false);
  private readonly settingsMenuOpenRef = signal(false);
  private hydrationRequestVersion = 0;

  readonly bindings = this.bindingsRef.asReadonly();
  readonly hydratedUser = this.hydratedUserRef.asReadonly();
  readonly menuOpen = this.menuOpenRef.asReadonly();
  readonly settingsMenuOpen = this.settingsMenuOpenRef.asReadonly();

  constructor() {
    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.appCtx.activeUserId().trim();

      if (!session) {
        this.clearHydratedUser();
        return;
      }

      const requestKey = session.kind === 'firebase'
        ? `firebase:${session.profile.id}`
        : (activeUserId ? `demo:${activeUserId}` : '');

      if (!requestKey || this.hydrationRequestKeyRef() === requestKey) {
        return;
      }

      this.hydrationRequestKeyRef.set(requestKey);
      void this.hydrateUserAfterLogin(activeUserId || undefined);
    });
  }

  registerBindings(bindings: NavigatorBindings): void {
    this.bindingsRef.set(bindings);
  }

  clearBindings(bindings?: NavigatorBindings): void {
    if (bindings && this.bindingsRef() !== bindings) {
      return;
    }
    this.bindingsRef.set(null);
    this.closeMenu();
  }

  async hydrateUserAfterLogin(userId?: string): Promise<UserDto | null> {
    const requestVersion = ++this.hydrationRequestVersion;
    const isFirebaseSession = this.sessionService.currentSession()?.kind === 'firebase';
    const loadedUser = await this.usersService.loadUserById(isFirebaseSession ? undefined : userId);
    if (!loadedUser || requestVersion !== this.hydrationRequestVersion) {
      return null;
    }

    const normalizedUser = this.cloneUser(loadedUser);
    this.hydratedUserRef.set(normalizedUser);
    this.syncHydratedUserIntoAppContext(normalizedUser);
    this.bindingsRef()?.syncHydratedUser?.(normalizedUser);
    return normalizedUser;
  }

  clearHydratedUser(): void {
    this.hydrationRequestVersion += 1;
    this.hydrationRequestKeyRef.set('');
    this.hydratedUserRef.set(null);
  }

  isMenuOpen(): boolean {
    return this.menuOpenRef();
  }

  isSettingsMenuOpen(): boolean {
    return this.settingsMenuOpenRef();
  }

  openMenu(): void {
    this.menuOpenRef.set(true);
  }

  closeMenu(): void {
    this.menuOpenRef.set(false);
    this.settingsMenuOpenRef.set(false);
  }

  toggleMenu(): void {
    if (this.menuOpenRef()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  closeSettingsMenu(): void {
    this.settingsMenuOpenRef.set(false);
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpenRef.update(open => !open);
  }

  private syncHydratedUserIntoAppContext(user: UserDto): void {
    const normalizedUserId = user.id.trim();
    if (!normalizedUserId) {
      return;
    }

    this.appCtx.setActiveUserId(normalizedUserId);
    this.appCtx.patchUserCounterOverrides(normalizedUserId, {
      game: user.activities?.game,
      chat: user.activities?.chat,
      invitations: user.activities?.invitations,
      events: user.activities?.events,
      hosting: user.activities?.hosting
    });

    if (user.impressions) {
      this.appCtx.setUserImpressions(normalizedUserId, user.impressions);
      return;
    }
    this.appCtx.clearUserImpressions(normalizedUserId);
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0
      },
      impressions: user.impressions
        ? {
            host: user.impressions.host ? { ...user.impressions.host } : undefined,
            member: user.impressions.member ? { ...user.impressions.member } : undefined
          }
        : undefined
    };
  }
}

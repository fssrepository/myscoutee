import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AppContext, SessionService, UsersService, type UserDto } from '../shared/core';

export interface NavigatorMenuUiState {
  open: boolean;
  settingsOpen: boolean;
}

export type NavigatorSettingsPopup = 'help' | 'feedback' | 'privacy';

export interface NavigatorBindings {
  syncHydratedUser?(user: UserDto): void;
  getHostTierToneClass(tier: string): string;
  getHostTierColorClass(tier: string): string;
  getHostTierIcon(tier: string): string;
  getTraitToneClass(trait: string): string;
  getTraitColorClass(trait: string): string;
  getTraitIcon(trait: string): string;
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
  private readonly hydrationRequestKeyRef = signal('');
  private readonly menuOpenRef = signal(false);
  private readonly settingsMenuOpenRef = signal(false);
  private readonly settingsPopupRef = signal<NavigatorSettingsPopup | null>(null);
  private readonly profileEditorOpenRef = signal(false);
  private hydrationRequestVersion = 0;

  readonly bindings = this.bindingsRef.asReadonly();
  readonly profileEditorOpen = this.profileEditorOpenRef.asReadonly();
  readonly settingsPopup = this.settingsPopupRef.asReadonly();
  readonly menuUiState = computed<NavigatorMenuUiState>(() => ({
    open: this.menuOpenRef(),
    settingsOpen: this.settingsMenuOpenRef()
  }));

  constructor() {
    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.appCtx.activeUserId().trim();

      if (!session) {
        this.clearHydrationState();
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
    this.closeSettingsPopup();
    this.closeProfileEditor();
  }

  async hydrateUserAfterLogin(userId?: string): Promise<UserDto | null> {
    const requestVersion = ++this.hydrationRequestVersion;
    const isFirebaseSession = this.sessionService.currentSession()?.kind === 'firebase';
    const loadedUser = await this.usersService.loadUserById(isFirebaseSession ? undefined : userId);
    if (!loadedUser || requestVersion !== this.hydrationRequestVersion) {
      return null;
    }

    this.syncHydratedUserIntoAppContext(loadedUser);
    this.bindingsRef()?.syncHydratedUser?.(loadedUser);
    return loadedUser;
  }

  clearHydrationState(): void {
    this.hydrationRequestVersion += 1;
    this.hydrationRequestKeyRef.set('');
  }

  clearHydratedUser(): void {
    this.clearHydrationState();
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

  openProfileEditor(): void {
    this.profileEditorOpenRef.set(true);
  }

  closeProfileEditor(): void {
    this.profileEditorOpenRef.set(false);
  }

  closeSettingsMenu(): void {
    this.settingsMenuOpenRef.set(false);
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpenRef.update(open => !open);
  }

  openSettingsPopup(popup: NavigatorSettingsPopup): void {
    this.settingsPopupRef.set(popup);
    this.closeSettingsMenu();
  }

  closeSettingsPopup(): void {
    this.settingsPopupRef.set(null);
  }

  private syncHydratedUserIntoAppContext(user: UserDto): void {
    const normalizedUserId = user.id.trim();
    if (!normalizedUserId) {
      return;
    }

    this.appCtx.setUserProfile(user);
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
}

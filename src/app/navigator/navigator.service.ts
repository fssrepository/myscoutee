import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AppContext,
  SessionService,
  UsersService,
  type ActivityMemberOwnerType,
  type ActivityCounterKey,
  type UserDto,
  type UserImpressionsSectionDto,
  type UserRealtimeLongPollResponseDto
} from '../shared/core';
import { ConfirmationDialogService } from '../shared/ui/services/confirmation-dialog.service';
import { AssetPopupStateService } from '../asset/asset-popup-state.service';

export interface NavigatorMenuUiState {
  open: boolean;
  settingsOpen: boolean;
}

export type NavigatorSettingsPopup = 'help' | 'feedback' | 'privacy' | 'report-user';

export interface NavigatorReportUserContext {
  targetUserId: string;
  targetName: string;
  memberEntryId?: string | null;
  eventId: string;
  eventTitle?: string | null;
  eventStartAtIso?: string | null;
  eventTimeframe?: string | null;
  ownerType?: ActivityMemberOwnerType;
}

export interface NavigatorBindings {
  syncHydratedUser?(user: UserDto): void;
}

@Injectable({
  providedIn: 'root'
})
export class NavigatorService {
  private static readonly USER_REALTIME_LONG_POLL_INTERVAL_MS = 30000;
  private static readonly DEMO_USER_REALTIME_LONG_POLL_INTERVAL_MS = 10000;
  private static readonly ACCOUNT_REACTIVATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

  private readonly usersService = inject(UsersService);
  private readonly sessionService = inject(SessionService);
  private readonly appCtx = inject(AppContext);
  private readonly router = inject(Router);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly assetPopupService = inject(AssetPopupStateService);
  private readonly bindingsRef = signal<NavigatorBindings | null>(null);
  private readonly hydrationRequestKeyRef = signal('');
  private readonly menuOpenRef = signal(false);
  private readonly settingsMenuOpenRef = signal(false);
  private readonly settingsPopupRef = signal<NavigatorSettingsPopup | null>(null);
  private readonly reportUserContextRef = signal<NavigatorReportUserContext | null>(null);
  private readonly deletedAccountReactivationPendingRef = signal(false);
  private readonly profileEditorOpenRef = signal(false);
  private readonly impressionsPopupOpenRef = signal(false);
  private readonly impressionsPopupUserIdRef = signal('');
  private hydrationRequestVersion = 0;
  private userRealtimeLongPollTimer: ReturnType<typeof setInterval> | null = null;
  private userRealtimeLongPollInFlight = false;
  private userRealtimeLongPollActiveIntervalMs = NavigatorService.USER_REALTIME_LONG_POLL_INTERVAL_MS;
  private reactivationPromptUserId = '';
  private readonly userRealtimeLongPollCursorByUserId: Record<string, string> = {};
  private readonly userSeenImpressionsCursorByUserId: Record<string, string> = {};
  private readonly userIgnoreNextImpressionsSnapshotByUserId: Record<string, boolean> = {};
  private readonly userRealtimeBaseCountersByUserId: Record<string, Record<ActivityCounterKey, number>> = {};

  readonly bindings = this.bindingsRef.asReadonly();
  readonly profileEditorOpen = this.profileEditorOpenRef.asReadonly();
  readonly settingsPopup = this.settingsPopupRef.asReadonly();
  readonly reportUserContext = this.reportUserContextRef.asReadonly();
  readonly deletedAccountReactivationPending = this.deletedAccountReactivationPendingRef.asReadonly();
  readonly impressionsPopupOpen = this.impressionsPopupOpenRef.asReadonly();
  readonly impressionsPopupUserId = this.impressionsPopupUserIdRef.asReadonly();
  readonly menuUiState = computed<NavigatorMenuUiState>(() => ({
    open: this.menuOpenRef(),
    settingsOpen: this.settingsMenuOpenRef()
  }));
  readonly navigatorCoveredByAssetPopup = computed(() => this.assetPopupService.visible());

  constructor() {
    effect(() => {
      const session = this.sessionService.session();
      if (!session) {
        return;
      }
      if (this.appCtx.activeUserId().trim()) {
        return;
      }
      const bootstrapUserId = session.kind === 'firebase'
        ? session.profile.id.trim()
        : session.userId.trim();
      if (!bootstrapUserId) {
        return;
      }
      this.appCtx.setActiveUserId(bootstrapUserId);
    });

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

    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.appCtx.activeUserId().trim();

      if (!session || !activeUserId) {
        this.stopUserRealtimeLongPoll();
        this.impressionsPopupOpenRef.set(false);
        return;
      }

      this.activateUserRealtimeLongPoll(activeUserId);
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
    this.closeImpressionsPopup();
    this.closeProfileEditor();
  }

  async hydrateUserAfterLogin(userId?: string): Promise<UserDto | null> {
    const requestVersion = ++this.hydrationRequestVersion;
    const isFirebaseSession = this.sessionService.currentSession()?.kind === 'firebase';
    const loadedUser = await this.usersService.loadUserById(isFirebaseSession ? undefined : userId);
    if (!loadedUser || requestVersion !== this.hydrationRequestVersion) {
      return null;
    }
    if (this.shouldPromptDeletedAccountReactivation(loadedUser)) {
      this.deletedAccountReactivationPendingRef.set(true);
      this.openDeletedAccountReactivationPrompt(loadedUser, requestVersion);
      return loadedUser;
    }

    this.syncHydratedUser(loadedUser);
    return loadedUser;
  }

  private shouldPromptDeletedAccountReactivation(user: UserDto): boolean {
    if (user.profileStatus !== 'deleted') {
      return false;
    }
    const deletedAtMs = Date.parse(`${user.deletedAtIso ?? ''}`.trim());
    if (!Number.isFinite(deletedAtMs)) {
      return true;
    }
    return Date.now() - deletedAtMs <= NavigatorService.ACCOUNT_REACTIVATION_WINDOW_MS;
  }

  private openDeletedAccountReactivationPrompt(user: UserDto, requestVersion: number): void {
    const userId = user.id.trim();
    if (!userId || this.reactivationPromptUserId === userId) {
      return;
    }
    this.reactivationPromptUserId = userId;
    this.confirmationDialogService.open({
      title: 'Reactivate account?',
      message: 'This account is scheduled for deletion. You can reactivate it within 30 days and continue using MyScoutee normally.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Reactivate',
      busyConfirmLabel: 'Reactivating...',
      confirmTone: 'accent',
      allowBackdropClose: false,
      allowEscapeClose: false,
      failureMessage: 'Unable to reactivate account.',
      onCancel: async () => {
        this.reactivationPromptUserId = '';
        this.deletedAccountReactivationPendingRef.set(false);
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      },
      onConfirm: async () => {
        const reactivatedUser: UserDto = {
          ...user,
          profileStatus: 'public',
          deletedAtIso: null
        };
        const saved = await this.usersService.saveUserProfile(reactivatedUser, {
          minimumDurationMs: this.usersService.demoModeEnabled ? 1500 : 0,
          returnFallbackOnFailure: false
        });
        if (!saved) {
          throw new Error('Unable to reactivate account.');
        }
        this.reactivationPromptUserId = '';
        setTimeout(() => {
          if (requestVersion === this.hydrationRequestVersion) {
            this.syncHydratedUser(saved);
          }
          this.deletedAccountReactivationPendingRef.set(false);
        }, 0);
      }
    });
  }

  syncHydratedUser(user: UserDto): void {
    this.syncHydratedUserIntoAppContext(user);
    this.bindingsRef()?.syncHydratedUser?.(user);
  }

  clearHydrationState(): void {
    this.hydrationRequestVersion += 1;
    this.hydrationRequestKeyRef.set('');
    this.deletedAccountReactivationPendingRef.set(false);
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
    if (popup !== 'report-user') {
      this.reportUserContextRef.set(null);
    }
    this.settingsPopupRef.set(popup);
    this.closeSettingsMenu();
  }

  closeSettingsPopup(): void {
    if (this.settingsPopupRef() === 'report-user') {
      this.reportUserContextRef.set(null);
    }
    this.settingsPopupRef.set(null);
  }

  openReportUserPopup(context: NavigatorReportUserContext): void {
    const targetUserId = `${context.targetUserId ?? ''}`.trim();
    const eventId = `${context.eventId ?? ''}`.trim();
    const targetName = `${context.targetName ?? ''}`.trim();
    if (!targetUserId || !eventId || !targetName) {
      return;
    }
    this.reportUserContextRef.set({
      targetUserId,
      targetName,
      memberEntryId: `${context.memberEntryId ?? ''}`.trim() || null,
      eventId,
      eventTitle: `${context.eventTitle ?? ''}`.trim() || null,
      eventStartAtIso: `${context.eventStartAtIso ?? ''}`.trim() || null,
      eventTimeframe: `${context.eventTimeframe ?? ''}`.trim() || null,
      ownerType: context.ownerType
    });
    this.openSettingsPopup('report-user');
  }

  openImpressionsPopup(userId?: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim() || this.appCtx.activeUserId().trim();
    const activeUserId = this.appCtx.activeUserId().trim();
    const cachedUser = normalizedUserId
      ? (this.appCtx.getUserProfile(normalizedUserId)
        ?? (normalizedUserId === activeUserId ? this.appCtx.activeUserProfile() : null))
      : null;
    this.impressionsPopupUserIdRef.set(normalizedUserId);
    if (normalizedUserId && !cachedUser) {
      void this.usersService.loadUserById(normalizedUserId);
    }
    this.impressionsPopupOpenRef.set(true);
  }

  openDeleteAccountConfirm(): void {
    const activeUserName = this.appCtx.activeUserProfile()?.name?.trim() || 'this account';
    this.confirmationDialogService.open({
      title: 'Delete account?',
      message: activeUserName,
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.closeMenu();
        this.closeSettingsPopup();
        this.closeProfileEditor();
        this.closeImpressionsPopup();
        const activeUserId = this.appCtx.activeUserId().trim();
        if (activeUserId) {
          const result = await this.usersService.deleteUser(activeUserId);
          if (!result.submitted) {
            this.confirmationDialogService.openInfo(
              result.message ?? 'Unable to delete account.',
              {
                title: 'Delete account',
                confirmLabel: 'OK',
                confirmTone: 'danger'
              }
            );
            return;
          }
        }
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      }
    });
  }

  openLogoutConfirm(): void {
    const activeUserName = this.appCtx.activeUserProfile()?.name?.trim() || '';
    this.confirmationDialogService.open({
      title: 'Biztosan kilép?',
      message: activeUserName,
      cancelLabel: 'Mégsem',
      confirmLabel: 'Kilépés',
      confirmTone: 'accent',
      onConfirm: async () => {
        this.closeMenu();
        this.closeSettingsPopup();
        this.closeProfileEditor();
        this.closeImpressionsPopup();
        const activeUserId = this.appCtx.activeUserId().trim();
        if (activeUserId) {
          const result = await this.usersService.logoutUser(activeUserId);
          if (!result.submitted) {
            this.confirmationDialogService.openInfo(
              result.message ?? 'Unable to log out.',
              {
                title: 'Logout',
                confirmLabel: 'OK',
                confirmTone: 'neutral'
              }
            );
            return;
          }
        }
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      }
    });
  }

  closeImpressionsPopup(): void {
    const userId = this.impressionsPopupUserIdRef().trim() || this.appCtx.activeUserId().trim();
    const cursor = userId ? (this.userRealtimeLongPollCursorByUserId[userId] ?? '') : '';
    if (userId && cursor) {
      this.userSeenImpressionsCursorByUserId[userId] = cursor;
    }
    if (userId && this.userRealtimeLongPollInFlight) {
      this.userIgnoreNextImpressionsSnapshotByUserId[userId] = true;
    }
    this.impressionsPopupOpenRef.set(false);
    this.impressionsPopupUserIdRef.set('');
  }

  private syncHydratedUserIntoAppContext(user: UserDto): void {
    const normalizedUserId = user.id.trim();
    if (!normalizedUserId) {
      return;
    }

    this.appCtx.setUserProfile(user);
    this.appCtx.setActiveUserId(normalizedUserId);

    if (user.impressions) {
      this.appCtx.setUserImpressions(normalizedUserId, user.impressions);
      return;
    }
    this.appCtx.clearUserImpressions(normalizedUserId);
  }

  private activateUserRealtimeLongPoll(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.appCtx.activeUserId().trim() !== normalizedUserId) {
      return;
    }
    this.captureUserRealtimeBaseCounters(normalizedUserId);
    this.startUserRealtimeLongPoll();
  }

  private startUserRealtimeLongPoll(): void {
    const intervalMs = this.resolveUserRealtimeLongPollIntervalMs();
    if (this.userRealtimeLongPollTimer && this.userRealtimeLongPollActiveIntervalMs === intervalMs) {
      return;
    }
    if (this.userRealtimeLongPollTimer) {
      clearInterval(this.userRealtimeLongPollTimer);
      this.userRealtimeLongPollTimer = null;
    }
    this.userRealtimeLongPollActiveIntervalMs = intervalMs;
    this.userRealtimeLongPollTimer = setInterval(() => {
      void this.runUserRealtimeLongPollTick();
    }, intervalMs);
  }

  private stopUserRealtimeLongPoll(): void {
    if (this.userRealtimeLongPollTimer) {
      clearInterval(this.userRealtimeLongPollTimer);
      this.userRealtimeLongPollTimer = null;
    }
    this.userRealtimeLongPollInFlight = false;
    this.userRealtimeLongPollActiveIntervalMs = NavigatorService.USER_REALTIME_LONG_POLL_INTERVAL_MS;
  }

  private resolveUserRealtimeLongPollIntervalMs(): number {
    return this.usersService.demoModeEnabled
      ? NavigatorService.DEMO_USER_REALTIME_LONG_POLL_INTERVAL_MS
      : NavigatorService.USER_REALTIME_LONG_POLL_INTERVAL_MS;
  }

  private captureUserRealtimeBaseCounters(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const user = this.appCtx.getUserProfile(normalizedUserId) ?? this.appCtx.activeUserProfile();
    const overrides = this.appCtx.getUserCounterOverrides(normalizedUserId);
    this.userRealtimeBaseCountersByUserId[normalizedUserId] = {
      game: this.normalizeRealtimeCounterValue(overrides.game ?? user?.activities?.game),
      chat: this.normalizeRealtimeCounterValue(overrides.chat ?? user?.activities?.chat),
      invitations: this.normalizeRealtimeCounterValue(overrides.invitations ?? user?.activities?.invitations),
      events: this.normalizeRealtimeCounterValue(overrides.events ?? user?.activities?.events),
      hosting: this.normalizeRealtimeCounterValue(overrides.hosting ?? user?.activities?.hosting),
      tickets: this.normalizeRealtimeCounterValue(overrides.tickets),
      feedback: this.normalizeRealtimeCounterValue(overrides.feedback)
    };
  }

  private async runUserRealtimeLongPollTick(): Promise<void> {
    if (this.userRealtimeLongPollInFlight) {
      return;
    }
    const userId = this.appCtx.activeUserId().trim();
    if (!userId) {
      return;
    }
    this.userRealtimeLongPollInFlight = true;
    try {
      const cursor = this.userRealtimeLongPollCursorByUserId[userId] ?? null;
      const snapshot = await this.usersService.pollUserRealtimeSnapshot(userId, cursor);
      if (!snapshot || this.appCtx.activeUserId().trim() !== userId) {
        return;
      }
      this.applyPolledUserRealtimeSnapshot(userId, snapshot);
    } finally {
      this.userRealtimeLongPollInFlight = false;
    }
  }

  private applyPolledUserRealtimeSnapshot(
    userId: string,
    snapshot: UserRealtimeLongPollResponseDto
  ): void {
    const previousImpressions = this.appCtx.getUserImpressions(userId);
    const nextCursor = typeof snapshot.cursor === 'string' ? snapshot.cursor.trim() : '';
    const shouldIgnoreNextImpressionsSnapshot = this.userIgnoreNextImpressionsSnapshotByUserId[userId] === true;
    const isSeenCursor = nextCursor.length > 0 && this.userSeenImpressionsCursorByUserId[userId] === nextCursor;
    const shouldSuppressImpressionBadges = shouldIgnoreNextImpressionsSnapshot || isSeenCursor;
    const rawCounterPatch = this.normalizePolledCounterPatch(snapshot.counters);
    const counterPatch = this.usersService.demoModeEnabled
      ? this.resolveDemoPolledCounterPatch(userId, rawCounterPatch)
      : rawCounterPatch;
    const nextImpressions = snapshot.impressions
      ? (shouldSuppressImpressionBadges ? this.normalizeSeenImpressions(snapshot.impressions) : snapshot.impressions)
      : undefined;

    this.appCtx.patchUserCounterOverrides(userId, counterPatch);
    if (nextImpressions) {
      this.appCtx.setUserImpressions(userId, nextImpressions);
    } else {
      this.appCtx.clearUserImpressions(userId);
    }

    const currentUser = this.appCtx.getUserProfile(userId) ?? this.appCtx.activeUserProfile();
    if (currentUser) {
      this.appCtx.setUserProfile({
        ...currentUser,
        activities: {
          ...currentUser.activities,
          ...(counterPatch.game !== undefined ? { game: counterPatch.game } : {}),
          ...(counterPatch.chat !== undefined ? { chat: counterPatch.chat } : {}),
          ...(counterPatch.invitations !== undefined ? { invitations: counterPatch.invitations } : {}),
          ...(counterPatch.events !== undefined ? { events: counterPatch.events } : {}),
          ...(counterPatch.hosting !== undefined ? { hosting: counterPatch.hosting } : {})
        },
        impressions: nextImpressions
          ? {
              host: nextImpressions.host ? { ...nextImpressions.host } : undefined,
              member: nextImpressions.member ? { ...nextImpressions.member } : undefined
            }
          : undefined
      });
    }

    if (shouldSuppressImpressionBadges) {
      this.appCtx.clearUserImpressionChangeFlags(userId);
    } else {
      this.applyImpressionsChangeFlags(userId, previousImpressions, snapshot);
    }
    if (nextCursor.length > 0) {
      this.userRealtimeLongPollCursorByUserId[userId] = nextCursor;
      if (shouldIgnoreNextImpressionsSnapshot) {
        this.userSeenImpressionsCursorByUserId[userId] = nextCursor;
      }
    }
    delete this.userIgnoreNextImpressionsSnapshotByUserId[userId];
  }

  private normalizeSeenImpressions(
    impressions: NonNullable<UserRealtimeLongPollResponseDto['impressions']>
  ): NonNullable<UserRealtimeLongPollResponseDto['impressions']> {
    return {
      host: impressions.host
        ? {
            ...impressions.host,
            unreadCount: 0
          }
        : undefined,
      member: impressions.member
        ? {
            ...impressions.member,
            unreadCount: 0
          }
        : undefined
    };
  }

  private resolveDemoPolledCounterPatch(
    userId: string,
    pendingPatch: Partial<Record<ActivityCounterKey, number>>
  ): Partial<Record<ActivityCounterKey, number>> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return pendingPatch;
    }
    const base = this.resolveUserRealtimeBaseCounters(normalizedUserId);
    const next: Partial<Record<ActivityCounterKey, number>> = {};
    const keys: ActivityCounterKey[] = ['game', 'chat', 'invitations', 'events', 'hosting', 'tickets', 'feedback'];
    for (const key of keys) {
      if (pendingPatch[key] === undefined) {
        continue;
      }
      next[key] = this.normalizeRealtimeCounterValue(base[key] + (pendingPatch[key] ?? 0));
    }
    return next;
  }

  private resolveUserRealtimeBaseCounters(userId: string): Record<ActivityCounterKey, number> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        tickets: 0,
        feedback: 0
      };
    }
    const existing = this.userRealtimeBaseCountersByUserId[normalizedUserId];
    if (existing) {
      return {
        game: this.normalizeRealtimeCounterValue(existing.game),
        chat: this.normalizeRealtimeCounterValue(existing.chat),
        invitations: this.normalizeRealtimeCounterValue(existing.invitations),
        events: this.normalizeRealtimeCounterValue(existing.events),
        hosting: this.normalizeRealtimeCounterValue(existing.hosting),
        tickets: this.normalizeRealtimeCounterValue(existing.tickets),
        feedback: this.normalizeRealtimeCounterValue(existing.feedback)
      };
    }
    this.captureUserRealtimeBaseCounters(normalizedUserId);
    return this.resolveUserRealtimeBaseCounters(normalizedUserId);
  }

  private normalizeRealtimeCounterValue(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private normalizePolledCounterPatch(
    counters: UserRealtimeLongPollResponseDto['counters'] | undefined
  ): Partial<Record<ActivityCounterKey, number>> {
    const normalize = (value: unknown): number | undefined => {
      if (!Number.isFinite(value)) {
        return undefined;
      }
      return Math.max(0, Math.trunc(Number(value)));
    };
    const patch: Partial<Record<ActivityCounterKey, number>> = {};
    const game = normalize(counters?.game);
    const chat = normalize(counters?.chat);
    const invitations = normalize(counters?.invitations);
    const events = normalize(counters?.events);
    const hosting = normalize(counters?.hosting);
    const tickets = normalize(counters?.tickets);
    const feedback = normalize(counters?.feedback);
    if (game !== undefined) {
      patch.game = game;
    }
    if (chat !== undefined) {
      patch.chat = chat;
    }
    if (invitations !== undefined) {
      patch.invitations = invitations;
    }
    if (events !== undefined) {
      patch.events = events;
    }
    if (hosting !== undefined) {
      patch.hosting = hosting;
    }
    if (tickets !== undefined) {
      patch.tickets = tickets;
    }
    if (feedback !== undefined) {
      patch.feedback = feedback;
    }
    return patch;
  }

  private applyImpressionsChangeFlags(
    userId: string,
    previousImpressions: UserDto['impressions'] | null,
    snapshot: UserRealtimeLongPollResponseDto
  ): void {
    const current = this.appCtx.getUserImpressionChangeFlags(userId);
    const hostChangedByCounter = snapshot.counters.impressionsHostChanged === true;
    const memberChangedByCounter = snapshot.counters.impressionsMemberChanged === true;
    const hostChangedByDiff = this.hasImpressionsSectionChanged(previousImpressions?.host, snapshot.impressions?.host);
    const memberChangedByDiff = this.hasImpressionsSectionChanged(previousImpressions?.member, snapshot.impressions?.member);
    this.appCtx.setUserImpressionChangeFlags(userId, {
      host: current.host || hostChangedByCounter || hostChangedByDiff,
      member: current.member || memberChangedByCounter || memberChangedByDiff
    });
  }

  private hasImpressionsSectionChanged(
    previous: UserImpressionsSectionDto | undefined,
    next: UserImpressionsSectionDto | undefined
  ): boolean {
    if (!previous && !next) {
      return false;
    }
    if (!previous || !next) {
      return true;
    }
    return (
      this.impressionSectionCounter(previous.unreadCount) !== this.impressionSectionCounter(next.unreadCount)
      || (this.impressionSectionRating(previous.averageRating) ?? -1) !== (this.impressionSectionRating(next.averageRating) ?? -1)
      || (this.impressionSectionMetric(previous.peopleMet) ?? -1) !== (this.impressionSectionMetric(next.peopleMet) ?? -1)
      || (this.impressionSectionMetric(previous.totalEvents) ?? -1) !== (this.impressionSectionMetric(next.totalEvents) ?? -1)
      || (this.impressionSectionMetric(previous.repeatCount) ?? -1) !== (this.impressionSectionMetric(next.repeatCount) ?? -1)
      || (this.impressionSectionMetric(previous.noShowCount) ?? -1) !== (this.impressionSectionMetric(next.noShowCount) ?? -1)
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.vibeBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.vibeBadges ?? []))
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.personalityBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.personalityBadges ?? []))
      || JSON.stringify(this.normalizeImpressionTraits(previous.personalityTraits))
      !== JSON.stringify(this.normalizeImpressionTraits(next.personalityTraits))
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.categoryBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.categoryBadges ?? []))
    );
  }

  private normalizeImpressionTraits(
    traits: UserImpressionsSectionDto['personalityTraits'] | undefined
  ): Array<{ id: string; percent: number; evidenceCount: number; lastRatedAtIso: string | null }> {
    return [...(traits ?? [])]
      .map(trait => ({
        id: `${trait.id ?? trait.label ?? ''}`.trim(),
        percent: Math.max(0, Math.trunc(Number(trait.percent) || 0)),
        evidenceCount: Math.max(0, Math.trunc(Number(trait.evidenceCount) || 0)),
        lastRatedAtIso: trait.lastRatedAtIso?.trim() || null
      }))
      .filter(trait => trait.id.length > 0)
      .sort((left, right) => right.percent - left.percent || left.id.localeCompare(right.id));
  }

  private impressionSectionCounter(value: number | undefined): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private impressionSectionMetric(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private impressionSectionRating(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.min(5, Number(value)));
  }

  private sortImpressionsBadgeItems(items: readonly string[]): string[] {
    const parsed = items.map(item => this.parseImpressionsBadgeItem(item));
    parsed.sort((left, right) => {
      if (left.percent !== null && right.percent !== null && left.percent !== right.percent) {
        return right.percent - left.percent;
      }
      if (left.percent !== null && right.percent === null) {
        return -1;
      }
      if (left.percent === null && right.percent !== null) {
        return 1;
      }
      return left.label.localeCompare(right.label);
    });
    return parsed.map(entry => entry.original);
  }

  private parseImpressionsBadgeItem(item: string): { original: string; label: string; percent: number | null } {
    const original = item.trim();
    const percentMatch = original.match(/^(.*?)(\d{1,3})%$/);
    if (!percentMatch) {
      return {
        original,
        label: original.toLowerCase(),
        percent: null
      };
    }
    return {
      original,
      label: percentMatch[1].trim().toLowerCase(),
      percent: Math.max(0, Math.min(100, Number.parseInt(percentMatch[2], 10) || 0))
    };
  }
}

import { Injectable, effect, inject, signal } from '@angular/core';
import { type ActivityCounters } from '../shared/ui';
import { NavigationEnd, Router } from '@angular/router';
import { AppContext } from '../shared/ui';
import { AppUtils } from '../shared/app-utils';
import { HelpCenterService, PrivacyPolicyService, RouteIntervalSchedulerService, SessionService, TermsPolicyService, UsersService, type EntryConsentStateDto, type HelpCenterRevisionDto, type PrivacyConsentDto, type UserDto, type UserImpressionsSectionDto, type UserRealtimeLongPollResponseDto } from '../shared/core';
import { APP_STORAGE_KEYS } from '../shared/core/common/storage-scope';
import { ConfirmationDialogStore } from '../shared/ui/context/stores/confirmation-dialog.store';
import { NavigatorStore, type NavigatorSettingsPopup } from '../shared/ui/context/stores/navigator.store';

@Injectable({
  providedIn: 'root'
})
export class NavigatorService {
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private static readonly USER_REALTIME_LONG_POLL_INTERVAL_MS = 30000;
  private static readonly DEMO_USER_REALTIME_LONG_POLL_INTERVAL_MS = 10000;
  private static readonly ACCOUNT_REACTIVATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  private static readonly ENTRY_CONSENT_KEY = APP_STORAGE_KEYS.entryConsent;
  private static readonly OPTIONAL_PRIVACY_APPROVAL_KEY = APP_STORAGE_KEYS.optionalPrivacyApprovals;
  private static readonly ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;

  private readonly usersService = inject(UsersService);
  private readonly helpCenterService = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly sessionService = inject(SessionService);
  private readonly appCtx = inject(AppContext);
  private readonly router = inject(Router);
  private readonly routeIntervalScheduler = inject(RouteIntervalSchedulerService);
  private readonly confirmationDialogStore = inject(ConfirmationDialogStore);
  private readonly navigatorStore = inject(NavigatorStore);
  private readonly currentRouteUrlRef = signal(AppUtils.normalizeRoutePath(this.router.url));
  private readonly hydrationRequestKeyRef = signal('');
  private readonly privacyConsentCheckKeyRef = signal('');
  private hydrationRequestVersion = 0;
  private stopUserRealtimeLongPollInterval: (() => void) | null = null;
  private userRealtimeLongPollInFlight = false;
  private userRealtimeLongPollActiveIntervalKey = '';
  private reactivationPromptUserId = '';
  private privacyConsentCheckToken = 0;
  private readonly userRealtimeLongPollCursorByUserId: Record<string, string> = {};
  private readonly userSeenImpressionsCursorByUserId: Record<string, string> = {};
  private readonly userIgnoreNextImpressionsSnapshotByUserId: Record<string, boolean> = {};

  constructor() {
    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) {
        return;
      }
      this.currentRouteUrlRef.set(AppUtils.normalizeRoutePath(event.urlAfterRedirects));
    });

    effect(() => {
      const session = this.sessionService.session();
      if (!session) {
        return;
      }
      if (this.appCtx.userProfileStore.activeUserId().trim()) {
        return;
      }
      const bootstrapUserId = session.kind === 'firebase'
        ? session.profile.id.trim()
        : session.userId.trim();
      if (!bootstrapUserId) {
        return;
      }
      this.appCtx.userProfileStore.setActiveUserId(bootstrapUserId);
    });

    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
      const routeUrl = this.currentRouteUrlRef();

      if (!session) {
        this.clearHydrationState();
        return;
      }
      if (this.isAdminWorkspaceRoute(routeUrl) || !this.isNavigatorHydrationRoute(routeUrl)) {
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
      const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();

      if (!session || !activeUserId) {
        this.stopUserRealtimeLongPoll();
        this.navigatorStore.closeImpressionsPopup();
        this.navigatorStore.closeContactsPopup();
        return;
      }
      if (this.isAdminWorkspaceRoute() || this.appCtx.userProfileStore.activeUserIsAdmin()) {
        this.navigatorStore.closeImpressionsPopup();
        this.navigatorStore.closeContactsPopup();
        this.activateUserRealtimeLongPoll(activeUserId);
        return;
      }

      this.activateUserRealtimeLongPoll(activeUserId);
    });

    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
      const revision = this.privacyPolicy.activeRevision();
      const shouldCheckPrivacyConsent = Boolean(activeUserId)
        && (Boolean(session) || this.isAdminWorkspaceRoute());

      if (!shouldCheckPrivacyConsent) {
        this.privacyConsentCheckKeyRef.set('');
        this.navigatorStore.clearPrivacyConsentRequirement();
        return;
      }
      if (!revision) {
        void this.privacyPolicy.prepareOpen();
        return;
      }

      const checkKey = this.privacyConsentKey(activeUserId, revision);
      if (this.privacyConsentCheckKeyRef() === checkKey) {
        return;
      }

      this.privacyConsentCheckKeyRef.set(checkKey);
      void this.ensureActivePrivacyConsent(activeUserId, revision, checkKey);
    });
  }

  async hydrateUserAfterLogin(userId?: string): Promise<UserDto | null> {
    if (this.isAdminWorkspaceRoute()) {
      return null;
    }
    const requestVersion = ++this.hydrationRequestVersion;
    const isFirebaseSession = this.sessionService.currentSession()?.kind === 'firebase';
    const loadedProfileExt = await this.usersService.loadProfileExtById(isFirebaseSession ? undefined : userId);
    const loadedUser = loadedProfileExt?.profile ?? null;
    if (!loadedUser || requestVersion !== this.hydrationRequestVersion) {
      return null;
    }
    if (this.shouldPromptDeletedAccountReactivation(loadedUser)) {
      this.navigatorStore.setDeletedAccountReactivationPending(true);
      this.openDeletedAccountReactivationPrompt(loadedUser, requestVersion);
      return loadedUser;
    }

    this.syncHydratedUser(loadedUser);
    void this.helpCenterService.preload('help');
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
    this.confirmationDialogStore.open({
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
        this.navigatorStore.setDeletedAccountReactivationPending(false);
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      },
      onConfirm: async () => {
        const restoredProfileStatus = this.resolveReactivatedProfileStatus(user);
        const reactivatedUser: UserDto = {
          ...user,
          profileStatus: restoredProfileStatus,
          previousProfileStatus: null,
          deletedAtIso: null
        };
        const saved = await this.usersService.saveUserProfile(reactivatedUser);
        if (!saved) {
          throw new Error('Unable to reactivate account.');
        }
        this.reactivationPromptUserId = '';
        setTimeout(() => {
          if (requestVersion === this.hydrationRequestVersion) {
            this.syncHydratedUser(saved);
          }
          this.navigatorStore.setDeletedAccountReactivationPending(false);
        }, 0);
      }
    });
  }

  private async ensureActivePrivacyConsent(userId: string, revision: HelpCenterRevisionDto, checkKey: string): Promise<void> {
    const requestToken = ++this.privacyConsentCheckToken;
    try {
      const existingConsent = await this.privacyPolicy.loadConsent(userId, revision.id, revision.version);
      if (!this.isCurrentPrivacyConsentCheck(checkKey, requestToken)) {
        return;
      }
      if (this.isPrivacyConsentCurrent(existingConsent, revision)) {
        this.navigatorStore.clearPrivacyConsentRequirement();
        return;
      }

      const syncedAnonymousConsent = await this.syncAnonymousEntryConsent(userId, revision);
      if (!this.isCurrentPrivacyConsentCheck(checkKey, requestToken)) {
        return;
      }
      if (syncedAnonymousConsent) {
        this.navigatorStore.clearPrivacyConsentRequirement();
        return;
      }

      this.navigatorStore.setPrivacyConsentRequiredKey(checkKey);
      this.openSettingsPopup('privacy');
    } catch {
      if (this.isCurrentPrivacyConsentCheck(checkKey, requestToken)) {
        this.navigatorStore.setPrivacyConsentRequiredKey(checkKey);
        this.openSettingsPopup('privacy');
      }
    }
  }

  private async syncAnonymousEntryConsent(userId: string, revision: HelpCenterRevisionDto): Promise<boolean> {
    const entryConsent = this.loadAnonymousEntryConsent(revision);
    if (!entryConsent) {
      return false;
    }
    await this.privacyPolicy.saveConsent({
      userId,
      revisionId: revision.id,
      revisionVersion: revision.version,
      approvedOptionalSectionIds: this.loadAnonymousOptionalApprovalIds(revision),
      source: 'entry'
    });
    return true;
  }

  private loadAnonymousEntryConsent(revision: HelpCenterRevisionDto): EntryConsentStateDto | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(NavigatorService.ENTRY_CONSENT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<EntryConsentStateDto>;
      if (
        parsed.version !== this.entryConsentVersion(revision) ||
        parsed.accepted !== true ||
        typeof parsed.acceptedAtIso !== 'string' ||
        parsed.acceptedAtIso.trim().length === 0
      ) {
        return null;
      }
      return {
        version: parsed.version,
        accepted: true,
        acceptedAtIso: parsed.acceptedAtIso
      };
    } catch {
      return null;
    }
  }

  private loadAnonymousOptionalApprovalIds(revision: HelpCenterRevisionDto): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = localStorage.getItem(NavigatorService.OPTIONAL_PRIVACY_APPROVAL_KEY);
      const parsed = raw
        ? JSON.parse(raw) as { revisionKey?: unknown; approvedSectionIds?: unknown }
        : null;
      if (
        !parsed ||
        parsed.revisionKey !== this.optionalPrivacyRevisionKey(revision) ||
        !Array.isArray(parsed.approvedSectionIds)
      ) {
        return [];
      }
      const optionalSectionIds = new Set(
        revision.sections
          .filter(section => section.optional === true)
          .map(section => section.id)
      );
      return Array.from(new Set(
        parsed.approvedSectionIds
          .map(sectionId => `${sectionId ?? ''}`.trim())
          .filter(sectionId => optionalSectionIds.has(sectionId))
      )).sort();
    } catch {
      return [];
    }
  }

  private isCurrentPrivacyConsentCheck(checkKey: string, requestToken: number): boolean {
    return this.privacyConsentCheckToken === requestToken
      && this.privacyConsentCheckKeyRef() === checkKey;
  }

  private isPrivacyConsentCurrent(consent: PrivacyConsentDto | null, revision: HelpCenterRevisionDto): boolean {
    if (!consent) {
      return false;
    }
    const consentRevisionId = `${consent.revisionId ?? ''}`.trim();
    const consentVersion = Math.trunc(Number(consent.revisionVersion) || 0);
    const currentVersion = Math.trunc(Number(revision.version) || 0);
    return consentRevisionId === revision.id && consentVersion >= currentVersion && currentVersion > 0;
  }

  private privacyConsentKey(userId: string, revision: HelpCenterRevisionDto): string {
    return `${userId.trim()}::${revision.id}:v${revision.version}`;
  }

  private isActivePrivacyConsentRequired(): boolean {
    const requiredKey = this.navigatorStore.privacyConsentRequiredKey();
    const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
    const revision = this.privacyPolicy.activeRevision();
    if (!requiredKey || !activeUserId || !revision) {
      return false;
    }
    return requiredKey === this.privacyConsentKey(activeUserId, revision);
  }

  private entryConsentVersion(revision: HelpCenterRevisionDto): string {
    return `privacy:${revision.id}:v${revision.version}`;
  }

  private optionalPrivacyRevisionKey(revision: HelpCenterRevisionDto): string {
    return `${revision.id}:v${revision.version}`;
  }

  private resolveReactivatedProfileStatus(user: UserDto): UserDto['profileStatus'] {
    switch (user.previousProfileStatus) {
      case 'blocked':
      case 'friends only':
      case 'host only':
      case 'inactive':
      case 'public':
        return user.previousProfileStatus;
      default:
        return 'public';
    }
  }

  syncHydratedUser(user: UserDto): void {
    this.syncHydratedUserIntoAppContext(user);
    this.navigatorStore.bindings()?.syncHydratedUser?.(user);
  }

  clearHydrationState(): void {
    this.hydrationRequestVersion += 1;
    this.hydrationRequestKeyRef.set('');
    this.navigatorStore.setDeletedAccountReactivationPending(false);
  }

  clearHydratedUser(): void {
    this.clearHydrationState();
  }

  openSettingsPopup(popup: NavigatorSettingsPopup): void {
    if (popup === 'privacy') {
      void this.privacyPolicy.prepareOpen();
    }
    if (popup === 'terms') {
      void this.termsPolicy.prepareOpen();
    }
    if (popup === 'help') {
      void this.helpCenterService.preload('help');
    }
    this.navigatorStore.openSettingsPopup(popup);
  }

  closeSettingsPopup(): void {
    this.navigatorStore.closeSettingsPopup({
      keepPrivacyOpen: this.isActivePrivacyConsentRequired()
    });
  }

  markActivePrivacyConsentApproved(): void {
    if (this.isActivePrivacyConsentRequired()) {
      this.navigatorStore.clearPrivacyConsentRequirement();
    }
  }

  openImpressionsPopup(userId?: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim() || this.appCtx.userProfileStore.activeUserId().trim();
    const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
    const cachedUser = normalizedUserId
      ? (this.appCtx.userProfileStore.getUserProfile(normalizedUserId)
        ?? (normalizedUserId === activeUserId ? this.appCtx.userProfileStore.activeUserProfile() : null))
      : null;
    if (normalizedUserId && !cachedUser) {
      void this.usersService.loadUserById(normalizedUserId);
    }
    this.navigatorStore.openImpressionsPopup(normalizedUserId);
  }

  openDeleteAccountConfirm(): void {
    const activeUserName = this.appCtx.userProfileStore.activeUserProfile()?.name?.trim() || 'this account';
    this.confirmationDialogStore.open({
      title: 'Delete account?',
      message: activeUserName,
      warningMessage: 'You can reactivate within 30 days. After that, the account is permanently purged.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.navigatorStore.closeMenu();
        this.closeSettingsPopup();
        this.navigatorStore.closeProfileEditor();
        this.closeImpressionsPopup();
        this.navigatorStore.closeContactsPopup();
        if (AppUtils.normalizeRoutePath(this.router.url).startsWith('/admin')) {
          this.clearHydratedUser();
          localStorage.removeItem(NavigatorService.ADMIN_SESSION_STORAGE_KEY);
          window.dispatchEvent(new CustomEvent('adminLogoutRequested'));
          await this.sessionService.logout().finally(() => this.router.navigate(['/admin']));
          return;
        }
        const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
        if (activeUserId) {
          const result = await this.usersService.deleteUser(activeUserId);
          if (!result.submitted) {
            this.confirmationDialogStore.openInfo(
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
    const activeUserName = this.appCtx.userProfileStore.activeUserProfile()?.name?.trim() || '';
    this.confirmationDialogStore.open({
      title: 'Biztosan kilép?',
      message: activeUserName,
      cancelLabel: 'Mégsem',
      confirmLabel: 'Kilépés',
      confirmTone: 'accent',
      onConfirm: async () => {
        this.navigatorStore.closeMenu();
        this.closeSettingsPopup();
        this.navigatorStore.closeProfileEditor();
        this.closeImpressionsPopup();
        this.navigatorStore.closeContactsPopup();
        const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
        if (AppUtils.normalizeRoutePath(this.router.url).startsWith('/admin')) {
          if (activeUserId) {
            const result = await this.usersService.logoutUser(activeUserId);
            if (!result.submitted) {
              this.confirmationDialogStore.openInfo(
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
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(NavigatorService.ADMIN_SESSION_STORAGE_KEY);
          }
          window.dispatchEvent(new CustomEvent('adminLogoutRequested'));
          await this.sessionService.logout().finally(() => this.router.navigate(['/admin']));
          return;
        }
        if (activeUserId) {
          const result = await this.usersService.logoutUser(activeUserId);
          if (!result.submitted) {
            this.confirmationDialogStore.openInfo(
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
    const userId = this.navigatorStore.impressionsPopupUserId().trim() || this.appCtx.userProfileStore.activeUserId().trim();
    const cursor = userId ? (this.userRealtimeLongPollCursorByUserId[userId] ?? '') : '';
    if (userId && cursor) {
      this.userSeenImpressionsCursorByUserId[userId] = cursor;
    }
    if (userId && this.userRealtimeLongPollInFlight) {
      this.userIgnoreNextImpressionsSnapshotByUserId[userId] = true;
    }
    this.navigatorStore.closeImpressionsPopup();
  }

  private syncHydratedUserIntoAppContext(user: UserDto): void {
    const normalizedUserId = user.id.trim();
    if (!normalizedUserId) {
      return;
    }

    this.appCtx.userProfileStore.setUserProfile(user);
    this.appCtx.userProfileStore.setActiveUserId(normalizedUserId);

    if (user.impressions) {
      this.appCtx.userProfileStore.setUserImpressions(normalizedUserId, user.impressions);
      return;
    }
    this.appCtx.userProfileStore.clearUserImpressions(normalizedUserId);
  }

  private activateUserRealtimeLongPoll(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.appCtx.userProfileStore.activeUserId().trim() !== normalizedUserId) {
      return;
    }
    this.startUserRealtimeLongPoll();
  }

  private startUserRealtimeLongPoll(): void {
    const fallbackIntervalMs = this.resolveUserRealtimeLongPollIntervalMs();
    const intervalKey = `${NavigatorService.USER_REALTIME_LONG_POLL_ROUTE}:${fallbackIntervalMs}`;
    if (this.stopUserRealtimeLongPollInterval && this.userRealtimeLongPollActiveIntervalKey === intervalKey) {
      return;
    }
    this.stopUserRealtimeLongPollInterval?.();
    this.userRealtimeLongPollActiveIntervalKey = intervalKey;
    this.stopUserRealtimeLongPollInterval = this.routeIntervalScheduler.startInterval(
      NavigatorService.USER_REALTIME_LONG_POLL_ROUTE,
      () => this.runUserRealtimeLongPollTick(),
      { fallbackIntervalMs }
    );
  }

  private stopUserRealtimeLongPoll(): void {
    this.stopUserRealtimeLongPollInterval?.();
    this.stopUserRealtimeLongPollInterval = null;
    this.userRealtimeLongPollInFlight = false;
    this.userRealtimeLongPollActiveIntervalKey = '';
  }

  private resolveUserRealtimeLongPollIntervalMs(): number {
    return this.usersService.localModeEnabled
      ? NavigatorService.DEMO_USER_REALTIME_LONG_POLL_INTERVAL_MS
      : NavigatorService.USER_REALTIME_LONG_POLL_INTERVAL_MS;
  }

  private isAdminWorkspaceRoute(routeUrl = this.currentRouteUrlRef()): boolean {
    const path = AppUtils.normalizeRoutePath(routeUrl);
    return path === '/admin'
      || path === '/admin/'
      || path === '/admin/workspace'
      || path === '/admin/workspace/';
  }

  private isNavigatorHydrationRoute(routeUrl = this.currentRouteUrlRef()): boolean {
    const path = AppUtils.normalizeRoutePath(routeUrl);
    return path !== '/' && !path.startsWith('/entry') && !path.startsWith('/admin');
  }

  private async runUserRealtimeLongPollTick(): Promise<void> {
    if (this.userRealtimeLongPollInFlight) {
      return;
    }
    const userId = this.appCtx.userProfileStore.activeUserId().trim();
    if (!userId) {
      return;
    }
    this.userRealtimeLongPollInFlight = true;
    try {
      const cursor = this.userRealtimeLongPollCursorByUserId[userId] ?? null;
      const snapshot = await this.usersService.pollUserRealtimeSnapshot(userId, cursor);
      if (!snapshot || this.appCtx.userProfileStore.activeUserId().trim() !== userId) {
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
    const previousImpressions = this.appCtx.userProfileStore.getUserImpressions(userId);
    const nextCursor = typeof snapshot.cursor === 'string' ? snapshot.cursor.trim() : '';
    const shouldIgnoreNextImpressionsSnapshot = this.userIgnoreNextImpressionsSnapshotByUserId[userId] === true;
    const isSeenCursor = nextCursor.length > 0 && this.userSeenImpressionsCursorByUserId[userId] === nextCursor;
    const shouldSuppressImpressionBadges = shouldIgnoreNextImpressionsSnapshot || isSeenCursor;
    const counterPatch = this.normalizePolledCounterPatch(snapshot.counters);
    const nextImpressions = snapshot.impressions
      ? (shouldSuppressImpressionBadges ? this.normalizeSeenImpressions(snapshot.impressions) : snapshot.impressions)
      : undefined;

    this.appCtx.activityStore.patchUserCounterOverrides(userId, counterPatch);
    if (nextImpressions) {
      this.appCtx.userProfileStore.setUserImpressions(userId, nextImpressions);
    } else {
      this.appCtx.userProfileStore.clearUserImpressions(userId);
    }

    const currentUser = this.appCtx.userProfileStore.getUserProfile(userId) ?? this.appCtx.userProfileStore.activeUserProfile();
    if (currentUser) {
      this.appCtx.userProfileStore.setUserProfile({
        ...currentUser,
        activities: {
          ...currentUser.activities,
          ...(counterPatch.game !== undefined ? { game: counterPatch.game } : {}),
          ...(counterPatch.chat !== undefined ? { chat: counterPatch.chat } : {}),
          ...(counterPatch.invitations !== undefined ? { invitations: counterPatch.invitations } : {}),
          ...(counterPatch.events !== undefined ? { events: counterPatch.events } : {}),
          ...(counterPatch.hosting !== undefined ? { hosting: counterPatch.hosting } : {}),
          ...(counterPatch.cars !== undefined ? { cars: counterPatch.cars } : {}),
          ...(counterPatch.accommodation !== undefined ? { accommodation: counterPatch.accommodation } : {}),
          ...(counterPatch.supplies !== undefined ? { supplies: counterPatch.supplies } : {}),
          ...(counterPatch.tickets !== undefined ? { tickets: counterPatch.tickets } : {}),
          ...(counterPatch.contacts !== undefined ? { contacts: counterPatch.contacts } : {}),
          ...(counterPatch.feedback !== undefined ? { feedback: counterPatch.feedback } : {}),
          ...(counterPatch.adminJobs !== undefined ? { adminJobs: counterPatch.adminJobs } : {}),
          ...(counterPatch.adminMetrics !== undefined ? { adminMetrics: counterPatch.adminMetrics } : {})
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
      this.appCtx.userProfileStore.clearUserImpressionChangeFlags(userId);
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

  private normalizePolledCounterPatch(
    counters: UserRealtimeLongPollResponseDto['counters'] | undefined
  ): Partial<ActivityCounters> {
    const normalize = (value: unknown): number | undefined => {
      if (!Number.isFinite(value)) {
        return undefined;
      }
      return Math.max(0, Math.trunc(Number(value)));
    };
    const patch: Partial<ActivityCounters> = {};
    const game = normalize(counters?.game);
    const chat = normalize(counters?.chat);
    const invitations = normalize(counters?.invitations);
    const events = normalize(counters?.events);
    const hosting = normalize(counters?.hosting);
    const cars = normalize(counters?.cars);
    const accommodation = normalize(counters?.accommodation);
    const supplies = normalize(counters?.supplies);
    const tickets = normalize(counters?.tickets);
    const contacts = normalize(counters?.contacts);
    const feedback = normalize(counters?.feedback);
    const adminJobs = normalize(counters?.adminJobs);
    const adminMetrics = normalize(counters?.adminMetrics);
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
    if (cars !== undefined) {
      patch.cars = cars;
    }
    if (accommodation !== undefined) {
      patch.accommodation = accommodation;
    }
    if (supplies !== undefined) {
      patch.supplies = supplies;
    }
    if (tickets !== undefined) {
      patch.tickets = tickets;
    }
    if (contacts !== undefined) {
      patch.contacts = contacts;
    }
    if (feedback !== undefined) {
      patch.feedback = feedback;
    }
    if (adminJobs !== undefined) {
      patch.adminJobs = adminJobs;
    }
    if (adminMetrics !== undefined) {
      patch.adminMetrics = adminMetrics;
    }
        if (counters?.event) {
      patch.event = {
        all: normalize(counters.event.all) ?? 0,
        active: normalize(counters.event.active) ?? 0,
        pending: normalize(counters.event.pending) ?? 0,
        invitations: normalize(counters.event.invitations) ?? 0,
        hosting: normalize(counters.event.hosting) ?? 0,
        drafts: normalize(counters.event.drafts) ?? 0,
        trash: normalize(counters.event.trash) ?? 0
      };
    }
    if (counters?.asset) {
      patch.asset = {
        cars: normalize(counters.asset.cars) ?? 0,
        accommodation: normalize(counters.asset.accommodation) ?? 0,
        supplies: normalize(counters.asset.supplies) ?? 0,
        tickets: normalize(counters.asset.tickets) ?? 0
      };
    }
    if (counters?.eventFeedback) {
      patch.eventFeedback = {
        ownEvents: normalize(counters.eventFeedback.ownEvents) ?? 0,
        pending: normalize(counters.eventFeedback.pending) ?? 0,
        feedbacked: normalize(counters.eventFeedback.feedbacked) ?? 0,
        removed: normalize(counters.eventFeedback.removed) ?? 0
      };
    }
return patch;
  }

  private applyImpressionsChangeFlags(
    userId: string,
    previousImpressions: UserDto['impressions'] | null,
    snapshot: UserRealtimeLongPollResponseDto
  ): void {
    const current = this.appCtx.userProfileStore.getUserImpressionChangeFlags(userId);
    const hostChangedByCounter = snapshot.counters.impressionsHostChanged === true;
    const memberChangedByCounter = snapshot.counters.impressionsMemberChanged === true;
    const hostChangedByDiff = this.hasImpressionsSectionChanged(previousImpressions?.host, snapshot.impressions?.host);
    const memberChangedByDiff = this.hasImpressionsSectionChanged(previousImpressions?.member, snapshot.impressions?.member);
    this.appCtx.userProfileStore.setUserImpressionChangeFlags(userId, {
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

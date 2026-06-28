import {
  HttpErrorResponse
} from '@angular/common/http';
import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import {
  USER_BY_ID_LOAD_CONTEXT_KEY,
  type AdminDashboardDto,
  type AdminFeedbackDto,
  type AdminModerationUserPatch,
  type AdminReportedUserDto,
  type AdminUserDto,
  type UserDto
} from '../../../core';
import {
  APP_STORAGE_KEYS
} from '../../../core/common/storage-scope';
import {
  AdminPopupStore
} from './admin-popup.store';
import { UserProfileStore } from './user-profile.store';
import { AppRuntimeStore } from './app-runtime.store';
import { ActivityStore } from './activity.store';

const ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;

@Injectable({
  providedIn: 'root'
})
export class AdminWorkspaceStore {
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly adminPopupStore = inject(AdminPopupStore);
  private readonly dashboardRef = signal<AdminDashboardDto | null>(null);
  private readonly busyRef = signal(false);
  private readonly errorRef = signal('');
  private readonly accessDeniedRef = signal(false);

  readonly dashboard = this.dashboardRef.asReadonly();
  readonly busy = this.busyRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly accessDenied = this.accessDeniedRef.asReadonly();

  setBusy(busy: boolean): void {
    this.busyRef.set(busy);
  }

  setError(error: string): void {
    this.errorRef.set(error);
  }

  clearError(): void {
    this.errorRef.set('');
  }

  setAccessDenied(accessDenied: boolean): void {
    this.accessDeniedRef.set(accessDenied);
  }

  prepareSelectedAdminSession(adminUserId: string): string {
    const normalizedAdminUserId = adminUserId.trim();
    if (normalizedAdminUserId) {
      this.persistAdminSession(normalizedAdminUserId);
    }
    return normalizedAdminUserId;
  }

  applyDashboard(dashboard: AdminDashboardDto): AdminDashboardDto {
    const normalized = this.normalizeDashboard(dashboard);
    this.dashboardRef.set(normalized);
    this.activateAdminProfile(normalized);
    return normalized;
  }

  applyReportedUsers(users: readonly AdminReportedUserDto[]): AdminReportedUserDto[] {
    const normalized = users.map(user => this.normalizeReportedUser(user));
    this.patchDashboard({ reportedUsers: normalized });
    return normalized;
  }

  applyBlockedUsers(users: readonly AdminReportedUserDto[]): AdminReportedUserDto[] {
    const normalized = users.map(user => this.normalizeReportedUser(user, true));
    this.patchDashboard({ blockedUsers: normalized });
    return normalized;
  }

  applyFeedback(feedback: readonly AdminFeedbackDto[]): AdminFeedbackDto[] {
    const normalized = feedback.map(item => this.normalizeFeedback(item));
    this.patchDashboard({ feedback: normalized });
    return normalized;
  }

  applyAdminMenuCounters(adminUserId: string, counters: { adminJobs: number; adminMetrics: number }): void {
    const normalizedAdminUserId = `${adminUserId ?? ''}`.trim();
    if (!normalizedAdminUserId) {
      return;
    }
    this.activityStore.patchUserCounterOverrides(normalizedAdminUserId, counters);
    const currentUser = this.userProfileStore.getUserProfile(normalizedAdminUserId);
    if (!currentUser) {
      return;
    }
    this.userProfileStore.setUserProfile({
      ...currentUser,
      activities: {
        ...currentUser.activities,
        adminJobs: counters.adminJobs,
        adminMetrics: counters.adminMetrics
      }
    });
  }

  patchModerationUser(patch: AdminModerationUserPatch | null | undefined): AdminReportedUserDto | null {
    const dashboard = this.dashboardRef();
    const normalizedUserId = `${patch?.userId ?? ''}`.trim();
    if (!dashboard || !normalizedUserId) {
      return null;
    }

    const currentUser = dashboard.reportedUsers.find(user => user.userId === normalizedUserId)
      ?? dashboard.blockedUsers.find(user => user.userId === normalizedUserId)
      ?? null;
    if (!currentUser) {
      return null;
    }
    const patchedUser = this.normalizeReportedUser({
      ...currentUser,
      profileStatus: patch?.profileStatus ?? currentUser.profileStatus,
      blockedAtIso: patch?.blockedAtIso !== undefined ? patch.blockedAtIso : currentUser.blockedAtIso,
      hasSupportChat: patch?.hasSupportChat !== undefined ? patch.hasSupportChat : currentUser.hasSupportChat,
      supportChatUnread: patch?.supportChatUnread !== undefined ? patch.supportChatUnread : currentUser.supportChatUnread
    });

    const reportedUsers = dashboard.reportedUsers.map(user =>
      user.userId === normalizedUserId ? patchedUser : user
    );
    let blockedUsers = dashboard.blockedUsers.map(user =>
      user.userId === normalizedUserId ? patchedUser : user
    );

    if (patchedUser.profileStatus === 'blocked') {
      if (!blockedUsers.some(user => user.userId === normalizedUserId)) {
        blockedUsers = this.sortReportedUsersByDate([...blockedUsers, patchedUser]);
      }
    } else {
      blockedUsers = blockedUsers.filter(user => user.userId !== normalizedUserId);
    }

    const nextDashboard = {
      ...dashboard,
      reportedUsers,
      blockedUsers
    };
    this.dashboardRef.set(nextDashboard);
    this.activateAdminProfile(nextDashboard);
    return patchedUser;
  }

  clearAdminSessionState(): void {
    this.dashboardRef.set(null);
    this.adminPopupStore.clear();
    this.accessDeniedRef.set(false);
    this.userProfileStore.setActiveUserId('');
    this.clearStoredAdminSession();
  }

  handleAdminAccessDeniedState(sessionUserId = ''): void {
    this.dashboardRef.set(null);
    this.adminPopupStore.clear();
    this.accessDeniedRef.set(true);
    this.errorRef.set('This account does not have admin access.');
    this.clearStoredAdminSession();
    this.userProfileStore.setActiveUserId(sessionUserId.trim());
  }

  currentAdminUserId(): string | undefined {
    return this.dashboardRef()?.activeAdmin.id ?? this.readStoredAdminId() ?? undefined;
  }

  persistAdminSession(adminUserId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ adminUserId }));
  }

  readStoredAdminId(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) {
      return '';
    }
    try {
      const parsed = JSON.parse(raw) as { adminUserId?: unknown };
      return typeof parsed.adminUserId === 'string' ? parsed.adminUserId.trim() : '';
    } catch {
      return '';
    }
  }

  clearStoredAdminSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  }

  adminErrorMessage(error: unknown): string {
    if (this.isAdminAccessDenied(error)) {
      return 'This account does not have admin access.';
    }
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message.trim();
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'Admin workspace is unavailable.';
  }

  isAdminAccessDenied(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }

  private normalizeDashboard(dashboard: AdminDashboardDto): AdminDashboardDto {
    return {
      activeAdmin: {
        ...dashboard.activeAdmin,
        headline: `${dashboard.activeAdmin.headline ?? ''}`.trim() || null,
        about: `${dashboard.activeAdmin.about ?? ''}`.trim() || null,
        images: [...(dashboard.activeAdmin.images ?? [])]
      },
      activeAdminProfile: dashboard.activeAdminProfile
        ? {
            ...dashboard.activeAdminProfile,
            headline: `${dashboard.activeAdminProfile.headline ?? ''}`.trim(),
            about: `${dashboard.activeAdminProfile.about ?? ''}`.trim(),
            images: [...(dashboard.activeAdminProfile.images ?? [])]
          }
        : null,
      reportedUsers: (dashboard.reportedUsers ?? []).map(user => this.normalizeReportedUser(user)),
      blockedUsers: (dashboard.blockedUsers ?? []).map(user => this.normalizeReportedUser(user, true)),
      feedback: (dashboard.feedback ?? []).map(item => this.normalizeFeedback(item))
    };
  }

  private patchDashboard(patch: Partial<Pick<AdminDashboardDto, 'reportedUsers' | 'blockedUsers' | 'feedback'>>): void {
    const dashboard = this.dashboardRef();
    if (!dashboard) {
      return;
    }
    const nextDashboard = {
      ...dashboard,
      ...patch
    };
    this.dashboardRef.set(nextDashboard);
    this.activateAdminProfile(nextDashboard);
  }

  private normalizeFeedback(item: AdminFeedbackDto): AdminFeedbackDto {
    return {
      ...item,
      userImageUrl: `${item.userImageUrl ?? ''}`.trim() || null
    };
  }

  private normalizeReportedUser(user: AdminReportedUserDto, blockedFallback = false): AdminReportedUserDto {
    return {
      ...user,
      imageUrl: `${user.imageUrl ?? ''}`.trim() || null,
      blockedAtIso: `${user.blockedAtIso ?? (blockedFallback ? user.lastReportedAtIso : '') ?? ''}`.trim() || null,
      hasSupportChat: user.hasSupportChat === true,
      supportChatUnread: Math.max(0, Math.trunc(Number(user.supportChatUnread) || 0)),
      reports: (user.reports ?? []).map(report => ({
        ...report,
        reporterImageUrl: `${report.reporterImageUrl ?? ''}`.trim() || null,
        chatMessages: [...(report.chatMessages ?? [])]
      }))
    };
  }

  private sortReportedUsersByDate(users: readonly AdminReportedUserDto[]): AdminReportedUserDto[] {
    return [...users].sort((first, second) =>
      Date.parse(`${second.lastReportedAtIso ?? second.blockedAtIso ?? ''}`)
        - Date.parse(`${first.lastReportedAtIso ?? first.blockedAtIso ?? ''}`)
    );
  }

  private activateAdminProfile(dashboard: AdminDashboardDto): void {
    const admin = dashboard.activeAdmin;
    const user = this.buildAdminProfile(admin, dashboard);
    const chatUnread = this.adminChatUnreadCount(dashboard);
    this.userProfileStore.setUserProfile(user);
    this.userProfileStore.setActiveUserId(user.id);
    this.runtimeStore.setStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
    this.activityStore.patchUserCounterOverrides(user.id, {
      game: dashboard.reportedUsers.reduce((total, item) => total + item.reportCount, 0),
      chat: chatUnread,
      events: dashboard.reportedUsers.length,
      hosting: 0,
      invitations: 0,
      tickets: 0,
      feedback: dashboard.feedback.length,
      adminJobs: user.activities.adminJobs ?? 0,
      adminMetrics: user.activities.adminMetrics ?? 0
    });
  }

  private adminChatUnreadCount(dashboard: AdminDashboardDto): number {
    const unreadByUserId = new Map<string, number>();
    for (const user of [...(dashboard.reportedUsers ?? []), ...(dashboard.blockedUsers ?? [])]) {
      const userId = `${user.userId ?? ''}`.trim();
      if (!userId) {
        continue;
      }
      const unread = Math.max(0, Math.trunc(Number(user.supportChatUnread) || 0));
      unreadByUserId.set(userId, Math.max(unreadByUserId.get(userId) ?? 0, unread));
    }
    return [...unreadByUserId.values()].reduce((total, unread) => total + unread, 0);
  }

  private buildAdminProfile(admin: AdminUserDto, dashboard: AdminDashboardDto): UserDto {
    const existingAdminProfile = this.userProfileStore.getUserProfile(admin.id) ?? dashboard.activeAdminProfile ?? null;
    const name = `${existingAdminProfile?.name ?? admin.name}`.trim() || admin.name;
    const initials = `${existingAdminProfile?.initials ?? admin.initials}`.trim() || this.initialsFromName(name, admin.initials);
    const headline = `${existingAdminProfile?.headline ?? admin.headline ?? ''}`.trim() || 'Moderation workspace';
    const about = `${existingAdminProfile?.about ?? admin.about ?? ''}`.trim() || 'Reviews reports, feedback, and support chats.';
    const images = (existingAdminProfile?.images?.length ? existingAdminProfile.images : admin.images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .filter(image => image.length > 0);
    return {
      id: admin.id,
      name,
      age: 0,
      birthday: '',
      city: 'Admin',
      height: '',
      physique: '',
      languages: ['English'],
      horoscope: '',
      initials,
      gender: admin.id.includes('noel') ? 'man' : 'woman',
      statusText: 'Admin workspace',
      hostTier: 'Admin',
      traitLabel: 'Safety',
      completion: 100,
      headline,
      about,
      images,
      profileStatus: 'public',
      admin: true,
      activities: {
        game: dashboard.reportedUsers.reduce((total, item) => total + item.reportCount, 0),
        chat: this.adminChatUnreadCount(dashboard),
        invitations: 0,
        events: dashboard.reportedUsers.length,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: dashboard.feedback.length,
        adminJobs: Math.max(0, Math.trunc(Number(existingAdminProfile?.activities?.adminJobs) || 0)),
        adminMetrics: Math.max(0, Math.trunc(Number(existingAdminProfile?.activities?.adminMetrics) || 0))
      }
    };
  }

  private initialsFromName(name: string, fallback: string): string {
    const initials = name.trim().split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || fallback;
  }
}

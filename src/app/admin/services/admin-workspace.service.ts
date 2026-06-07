import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import {
  AppContext,
  AdminWorkspaceDataService,
  HelpCenterService,
  SessionService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  type AdminModerationUserPatch,
  type UserDto,
  type UserSelectorListItemDto
} from '../../shared/core';
import { APP_STORAGE_KEYS } from '../../shared/core/base/storage-scope';
import type { AdminDashboardDto } from '../models/admin-dashboard.model';
import type { AdminReportedUserDto } from '../models/admin-moderation.model';
import type { AdminUserDto } from '../models/admin-profile.model';
import type { AdminBootstrapProcessState } from '../models/admin-shell.model';
import { AdminShellService } from './admin-shell.service';

const ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;

@Injectable({
  providedIn: 'root'
})
export class AdminWorkspaceService {
  private readonly appCtx = inject(AppContext);
  private readonly workspaceData = inject(AdminWorkspaceDataService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly sessionService = inject(SessionService);
  private readonly shell = inject(AdminShellService);
  private readonly dashboardRef = signal<AdminDashboardDto | null>(null);
  private readonly busyRef = signal(false);
  private readonly errorRef = signal('');
  private readonly accessDeniedRef = signal(false);

  readonly dashboard = this.dashboardRef.asReadonly();
  readonly busy = this.busyRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly accessDenied = this.accessDeniedRef.asReadonly();
  readonly adminUsers = this.workspaceData.adminUsers;

  get isFirebaseAdminMode(): boolean {
    return this.workspaceData.isFirebaseAdminMode;
  }

  prepareSelectedAdminSession(adminUserId: string): void {
    this.workspaceData.prepareSelectedAdminSession(adminUserId);
  }

  applyDashboard(dashboard: AdminDashboardDto): void {
    const normalized = this.normalizeDashboard(dashboard);
    this.dashboardRef.set(normalized);
    this.activateAdminProfile(normalized);
  }

  async prepareDemoAdminSelector(
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<UserSelectorListItemDto[]> {
    return await this.workspaceData.prepareAdminSelector(onProgress);
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

  async restoreAdminSession(): Promise<boolean> {
    const adminId = this.readStoredAdminId();
    if (!adminId) {
      return false;
    }
    try {
      if (this.isFirebaseAdminMode) {
        const session = await this.sessionService.ensureSession();
        if (session?.kind !== 'firebase') {
          this.clearAdminSession();
          return false;
        }
      }
      this.prepareSelectedAdminSession(adminId);
      return Boolean(await this.bootstrapAdmin(adminId));
    } catch {
      this.clearAdminSession();
      return false;
    }
  }

  restoreAdminPreview(): UserSelectorListItemDto | null {
    const adminId = this.readStoredAdminId();
    if (!adminId) {
      return null;
    }
    return this.adminUsers().find(user => user.id === adminId) ?? null;
  }

  async bootstrapAdmin(
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<AdminDashboardDto | null> {
    if (this.busyRef()) {
      return this.dashboardRef();
    }
    this.busyRef.set(true);
    this.errorRef.set('');
    this.accessDeniedRef.set(false);
    try {
      const dashboard = this.normalizeDashboard(await this.workspaceData.loadDashboard(adminUserId, onProgress));
      this.dashboardRef.set(dashboard);
      this.activateAdminProfile(dashboard);
      await this.refreshAdminMenuCountersFromUserRecord(dashboard.activeAdmin.id);
      void this.helpCenter.preloadAll();
      this.persistAdminSession(dashboard.activeAdmin.id);
      return dashboard;
    } catch (error) {
      if (this.isAdminAccessDenied(error)) {
        this.handleAdminAccessDenied();
        return null;
      }
      this.errorRef.set(this.errorMessage(error));
      return null;
    } finally {
      this.busyRef.set(false);
    }
  }

  clearAdminSession(): void {
    this.dashboardRef.set(null);
    this.shell.clear();
    this.accessDeniedRef.set(false);
    this.appCtx.setActiveUserId('');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  }

  handleAdminAccessDenied(): void {
    this.dashboardRef.set(null);
    this.shell.clear();
    this.accessDeniedRef.set(true);
    this.errorRef.set('This account does not have admin access.');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    const session = this.sessionService.currentSession();
    if (session?.kind === 'firebase') {
      this.appCtx.setActiveUserId(session.profile.id.trim());
    } else {
      this.appCtx.setActiveUserId('');
    }
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
      feedback: (dashboard.feedback ?? []).map(item => ({
        ...item,
        userImageUrl: `${item.userImageUrl ?? ''}`.trim() || null
      }))
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
    this.appCtx.setUserProfile(user);
    this.appCtx.setActiveUserId(user.id);
    this.appCtx.setStatus(USER_BY_ID_LOAD_CONTEXT_KEY, 'success');
    this.appCtx.patchUserCounterOverrides(user.id, {
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

  private async refreshAdminMenuCountersFromUserRecord(adminUserId: string): Promise<void> {
    try {
      const counters = await this.workspaceData.loadDashboardMenuCounters(adminUserId);
      if (!counters) {
        return;
      }
      const normalizedAdminUserId = `${adminUserId ?? ''}`.trim();
      this.appCtx.patchUserCounterOverrides(normalizedAdminUserId, counters);
      const currentUser = this.appCtx.getUserProfile(normalizedAdminUserId);
      if (!currentUser) {
        return;
      }
      this.appCtx.setUserProfile({
        ...currentUser,
        activities: {
          ...currentUser.activities,
          adminJobs: counters.adminJobs,
          adminMetrics: counters.adminMetrics
        }
      });
    } catch {
      // The periodic user counter poll keeps the admin menu in sync if the first read is unavailable.
    }
  }

  private buildAdminProfile(admin: AdminUserDto, dashboard: AdminDashboardDto): UserDto {
    const existingAdminProfile = this.appCtx.getUserProfile(admin.id) ?? dashboard.activeAdminProfile ?? null;
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

  private persistAdminSession(adminUserId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ adminUserId }));
  }

  private readStoredAdminId(): string {
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

  private initialsFromName(name: string, fallback: string): string {
    const initials = name.trim().split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || fallback;
  }

  private errorMessage(error: unknown): string {
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

  private isAdminAccessDenied(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }
}

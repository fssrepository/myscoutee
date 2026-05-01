import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';

import { APP_STATIC_DATA } from '../../shared/app-static-data';
import { AppUtils } from '../../shared/app-utils';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../shared/ui';
import type { ChatMenuItem } from '../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../shared/core/base/interfaces/user.interface';
import { toActivityChatRow } from '../../shared/core/base/converters/activities-chat.converter';
import type { ActivityListRow } from '../../shared/core/base/models';
import { ConfirmationDialogService } from '../../shared/ui/services/confirmation-dialog.service';
import { AdminService, type AdminReportedUserDto, type AdminReportDto } from '../admin.service';

interface AdminReportListItem {
  id: string;
  user: AdminReportedUserDto;
  report: AdminReportDto;
  row: ActivityListRow;
}

interface AdminReportListFilters {
  revision?: number;
}

interface AdminBlockedUserListItem {
  id: string;
  user: AdminReportedUserDto;
  row: ActivityListRow;
}

interface AdminBlockedUserListFilters {
  revision?: number;
}

@Component({
  selector: 'app-admin-reports-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent],
  templateUrl: './admin-reports-popup.component.html',
  styleUrl: './admin-popups.scss'
})
export class AdminReportsPopupComponent {
  protected readonly admin = inject(AdminService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly location = inject(Location);
  protected reportDetail: AdminReportListItem | null = null;
  protected reportDetailMenuOpen = false;
  protected blockedUsersOpen = false;
  protected blockedUserMenuId = '';

  protected reportItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminReportListItem, AdminReportListFilters>
  >;
  protected blockedUserItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminBlockedUserListItem, AdminBlockedUserListFilters>
  >;

  @ViewChild('reportItemTemplate', { read: TemplateRef })
  private set reportItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminReportListItem, AdminReportListFilters>> | undefined
  ) {
    this.reportItemTemplateRef = value;
  }

  @ViewChild('blockedUserItemTemplate', { read: TemplateRef })
  private set blockedUserItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminBlockedUserListItem, AdminBlockedUserListFilters>> | undefined
  ) {
    this.blockedUserItemTemplateRef = value;
  }

  protected readonly reportsSmartListConfig: SmartListConfig<AdminReportListItem, AdminReportListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    loadingDelayMs: 0,
    defaultView: 'day',
    emptyLabel: 'No reports',
    emptyDescription: 'No moderation reports are waiting for review.',
    showStickyHeader: true,
    showFirstGroupMarker: false,
    showGroupMarker: ({ groupIndex }) => groupIndex > 0,
    groupBy: item => AppUtils.activityGroupLabel(item.row, 'day', APP_STATIC_DATA.activityGroupLabels),
    listLayout: 'stack',
    snapMode: 'none',
    scrollPaddingTop: '2.6rem',
    headerProgress: {
      enabled: true
    },
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'admin-simple-smart-list': true
    },
    trackBy: (_index, item) => item.id
  };

  protected readonly reportsSmartListLoadPage: SmartListLoadPage<AdminReportListItem, AdminReportListFilters> = (
    query
  ) => of(this.loadReportsPage(query));

  protected readonly blockedUsersSmartListConfig: SmartListConfig<AdminBlockedUserListItem, AdminBlockedUserListFilters> = {
    pageSize: 12,
    initialPageSize: 12,
    loadingDelayMs: 0,
    defaultView: 'day',
    emptyLabel: 'No blocked users',
    emptyDescription: 'No profiles are currently blocked by moderation.',
    showStickyHeader: true,
    showFirstGroupMarker: true,
    showGroupMarker: () => true,
    groupBy: item => AppUtils.activityGroupLabel(item.row, 'day', APP_STATIC_DATA.activityGroupLabels),
    listLayout: 'card-grid',
    desktopColumns: 4,
    snapMode: 'none',
    scrollPaddingTop: '2.6rem',
    headerProgress: {
      enabled: true
    },
    containerClass: {
      'experience-card-list': true,
      'admin-blocked-smart-list': true
    },
    trackBy: (_index, item) => item.id
  };

  protected readonly blockedUsersSmartListLoadPage: SmartListLoadPage<AdminBlockedUserListItem, AdminBlockedUserListFilters> = (
    query
  ) => of(this.loadBlockedUsersPage(query));

  protected selectUser(user: AdminReportedUserDto): void {
    const firstReport = user.reports[0];
    if (firstReport) {
      this.openReportDetails(this.buildReportListItem(user, firstReport));
    }
  }

  protected selectReport(user: AdminReportedUserDto, report: AdminReportDto): void {
    this.openReportDetails(this.buildReportListItem(user, report));
  }

  protected openReportDetails(item: AdminReportListItem): void {
    this.reportDetail = item;
    this.reportDetailMenuOpen = false;
    this.admin.openReportDetail(item.user, item.report);
  }

  protected closeReportDetails(): void {
    this.reportDetail = null;
    this.reportDetailMenuOpen = false;
  }

  protected openBlockedUsers(event?: Event): void {
    event?.stopPropagation();
    this.blockedUsersOpen = true;
    this.blockedUserMenuId = '';
  }

  protected closeBlockedUsers(): void {
    this.blockedUsersOpen = false;
    this.blockedUserMenuId = '';
  }

  protected reviewReport(report: AdminReportDto): void {
    if (report.sourceType === 'chat' || report.chatId) {
      this.admin.openChatReview(report);
      return;
    }
    this.admin.openItemPreview(report);
  }

  protected warnUser(user: AdminReportedUserDto): void {
    this.reportDetailMenuOpen = false;
    this.admin.openWarnChat(user);
  }

  protected blockUser(user: AdminReportedUserDto): void {
    this.reportDetailMenuOpen = false;
    this.confirmationDialog.open({
      title: `Block ${user.name}?`,
      message: 'The user will be blocked and a support chat message will be sent.',
      confirmLabel: 'Block',
      busyConfirmLabel: 'Blocking...',
      confirmTone: 'danger',
      onConfirm: () => this.admin.blockUser(
        user.userId,
        'Your account has been blocked after moderation review. You can reply here to contact MyScoutee support and ask for a review.'
      )
    });
  }

  protected toggleReportDetailMenu(event: Event): void {
    event.stopPropagation();
    this.reportDetailMenuOpen = !this.reportDetailMenuOpen;
  }

  protected closeReportDetailMenu(): void {
    this.reportDetailMenuOpen = false;
  }

  protected blockedUsers(): AdminReportedUserDto[] {
    return this.admin.dashboard()?.blockedUsers ?? [];
  }

  protected blockedUsersCount(): number {
    return this.blockedUsers().length;
  }

  protected toggleBlockedUserMenu(user: AdminReportedUserDto, event: Event): void {
    event.stopPropagation();
    this.blockedUserMenuId = this.blockedUserMenuId === user.userId ? '' : user.userId;
  }

  protected isBlockedUserMenuOpen(user: AdminReportedUserDto): boolean {
    return this.blockedUserMenuId === user.userId;
  }

  protected warnBlockedUser(user: AdminReportedUserDto, event?: Event): void {
    event?.stopPropagation();
    this.blockedUserMenuId = '';
    this.warnUser(user);
  }

  protected viewBlockedUserChat(user: AdminReportedUserDto, event?: Event): void {
    event?.stopPropagation();
    this.blockedUserMenuId = '';
    this.closeBlockedUsers();
    this.closeReportDetails();
    this.admin.openBlockedUserChat(user);
  }

  protected unblockUser(user: AdminReportedUserDto, event?: Event): void {
    event?.stopPropagation();
    this.blockedUserMenuId = '';
    this.confirmationDialog.open({
      title: `Unblock ${user.name}?`,
      message: 'The user profile status will be restored and they can use MyScoutee again.',
      confirmLabel: 'Unblock',
      busyConfirmLabel: 'Unblocking...',
      confirmTone: 'accent',
      onConfirm: () => this.admin.unblockUser(user.userId)
    });
  }

  protected isUserBlocked(user: AdminReportedUserDto): boolean {
    return this.admin.isUserBlocked(user);
  }

  protected hasSupportChat(user: AdminReportedUserDto): boolean {
    return this.admin.hasSupportChat(user);
  }

  protected isSelectedUser(user: AdminReportedUserDto): boolean {
    return this.admin.selectedReportedUser()?.userId === user.userId;
  }

  protected isSelectedReport(report: AdminReportDto): boolean {
    return this.admin.selectedReport()?.id === report.id;
  }

  protected reportRows(): AdminReportListItem[] {
    return (this.admin.dashboard()?.reportedUsers ?? []).flatMap(user =>
      user.reports.map(report => this.buildReportListItem(user, report))
    ).sort((first, second) =>
      Date.parse(second.report.createdDate) - Date.parse(first.report.createdDate)
    );
  }

  protected reportListTitle(item: AdminReportListItem): string {
    return this.reportTitle(item.user, item.report);
  }

  protected reportListMeta(item: AdminReportListItem): string {
    return this.reportMeta(item.report);
  }

  protected reporterInitial(report: AdminReportDto): string {
    return (report.reporterName || 'R').trim().charAt(0).toUpperCase() || 'R';
  }

  protected reporterImageUrl(report: AdminReportDto): string {
    return `${report.reporterImageUrl ?? ''}`.trim();
  }

  protected reportSourceIcon(report: AdminReportDto): string {
    if (report.sourceType === 'chat' || report.chatId) {
      return 'forum';
    }
    if (report.sourceType === 'asset' || report.assetId) {
      return 'inventory_2';
    }
    return 'event';
  }

  protected reportSourceLabel(report: AdminReportDto): string {
    if (report.sourceType === 'chat' || report.chatId) {
      return report.chatTitle || 'Reported chat';
    }
    if (report.sourceType === 'asset' || report.assetId) {
      return [report.assetType, report.sourceText].filter(Boolean).join(' · ') || 'Reported asset';
    }
    return report.eventTitle || 'Reported event';
  }

  protected reportBadgeLabel(report: AdminReportDto): string {
    return `${report.reason ?? ''}`.trim() || 'Report';
  }

  protected reportReasonToneClass(report: AdminReportDto): string {
    const sourceTone = `${report.sourceType ?? ''}`.trim().toLowerCase();
    if (sourceTone === 'chat') {
      return 'admin-report-tone-chat';
    }
    if (sourceTone === 'asset') {
      return 'admin-report-tone-asset';
    }
    return `admin-report-tone-${this.reportBadgeLabel(report)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'general'}`;
  }

  protected reportTime(value: string | null | undefined): string {
    const date = new Date(`${value ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return `${value ?? ''}`.trim();
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  protected reportedHandle(item: AdminReportListItem): string {
    return `${item.report.handle ?? ''}`.trim() || item.user.name;
  }

  protected memberImageUrl(user: AdminReportedUserDto): string {
    return `${user.imageUrl ?? ''}`.trim();
  }

  protected memberDescription(user: AdminReportedUserDto): string {
    return [
      user.city,
      this.isUserBlocked(user) ? 'blocked' : user.profileStatus,
      `${user.reportCount} report${user.reportCount === 1 ? '' : 's'}`
    ].filter(Boolean).join(' · ');
  }

  protected blockedDate(user: AdminReportedUserDto): string {
    return `${user.blockedAtIso ?? user.lastReportedAtIso ?? ''}`.trim();
  }

  protected memberAge(user: AdminReportedUserDto): string {
    return this.estimatedMemberAge(user);
  }

  protected memberCardTitle(user: AdminReportedUserDto, fallbackName?: string): string {
    return [
      `${fallbackName ?? user.name ?? ''}`.trim() || 'Member',
      this.memberAge(user)
    ].filter(Boolean).join(', ');
  }

  protected eventContextLabel(report: AdminReportDto): string {
    const eventTitle = `${report.eventTitle ?? ''}`.trim();
    return eventTitle;
  }

  protected eventDateLabel(report: AdminReportDto): string {
    const date = new Date(`${report.eventStartAtIso ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  protected sourceTypeLabel(report: AdminReportDto): string {
    switch (`${report.sourceType ?? ''}`.trim()) {
      case 'chat':
        return 'Chat';
      case 'asset':
        return 'Asset';
      case 'subEvent':
        return 'Sub-event';
      case 'group':
        return 'Group';
      case 'event':
        return 'Event';
      default:
        return report.chatId ? 'Chat' : report.assetId ? 'Asset' : 'Event';
    }
  }

  protected sourceIdsLabel(report: AdminReportDto): string {
    return [
      report.sourceId ? `source ${report.sourceId}` : '',
      report.chatId ? `chat ${report.chatId}` : '',
      report.messageId ? `message ${report.messageId}` : '',
      report.assetId ? `asset ${report.assetId}` : '',
      report.memberEntryId ? `member ${report.memberEntryId}` : ''
    ].filter(Boolean).join(' · ');
  }

  protected sourceCardTitle(report: AdminReportDto): string {
    if (report.sourceType === 'chat' || report.chatId) {
      return report.chatTitle || 'Reported chat message';
    }
    if (report.sourceType === 'asset' || report.assetId) {
      return report.assetType ? `${report.assetType} resource` : 'Reported asset';
    }
    return report.eventTitle || 'Reported event';
  }

  protected sourceCardSubtitle(report: AdminReportDto): string {
    if (report.sourceType === 'chat' || report.chatId) {
      return report.sourceText || 'Open chat at the reported message.';
    }
    return report.sourceText || this.eventContextLabel(report) || 'Open shared source context.';
  }

  protected sourceCardMeta(report: AdminReportDto): string {
    return [this.sourceTypeLabel(report), this.eventContextLabel(report)].filter(Boolean).join(' · ');
  }

  protected reportMemberUrl(item: AdminReportListItem): string {
    const params = new URLSearchParams();
    params.set('supportTarget', 'member');
    params.set('memberUserId', item.user.userId);
    if (item.report.eventId) {
      params.set('ownerId', item.report.eventId);
      params.set('ownerType', 'event');
    }
    return this.adminHelpUrl(item.report.reporterUserId, `/game?${params.toString()}`);
  }

  protected reportSourceUrl(report: AdminReportDto): string {
    return this.adminHelpUrl(report.reporterUserId, this.reportSourceTargetUrl(report));
  }

  protected openSharedUrl(url: string, event?: Event): void {
    event?.stopPropagation();
    const normalized = `${url ?? ''}`.trim();
    if (!normalized || typeof window === 'undefined') {
      return;
    }
    window.open(normalized, '_blank', 'noopener,noreferrer');
  }

  protected shortDate(value: string | null | undefined): string {
    const date = new Date(`${value ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return value ?? '';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private loadReportsPage(query: ListQuery<AdminReportListFilters>): PageResult<AdminReportListItem> {
    const rows = this.reportRows();
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 24));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      nextCursor: start + pageSize < rows.length ? String(page + 1) : null
    };
  }

  private loadBlockedUsersPage(query: ListQuery<AdminBlockedUserListFilters>): PageResult<AdminBlockedUserListItem> {
    const rows = this.blockedUserRows();
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 12));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      nextCursor: start + pageSize < rows.length ? String(page + 1) : null
    };
  }

  private blockedUserRows(): AdminBlockedUserListItem[] {
    return this.blockedUsers().map(user => ({
      id: user.userId,
      user,
      row: this.buildBlockedUserActivityRow(user)
    })).sort((first, second) =>
      Date.parse(this.blockedDate(second.user)) - Date.parse(this.blockedDate(first.user))
    );
  }

  private buildBlockedUserActivityRow(user: AdminReportedUserDto): ActivityListRow {
    const source: ChatMenuItem = {
      id: user.userId,
      avatar: user.initials,
      title: user.name,
      lastMessage: this.memberDescription(user),
      lastSenderId: user.userId,
      memberIds: [user.userId],
      unread: user.reportCount,
      dateIso: this.blockedDate(user) || user.lastReportedAtIso || new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: 'notification'
    };
    return toActivityChatRow(source, {
      activeUserId: 'admin',
      users: [this.chatUser(user.userId, user.name, user.initials, user.gender)]
    });
  }

  private buildReportListItem(user: AdminReportedUserDto, report: AdminReportDto): AdminReportListItem {
    return {
      id: `${user.userId}:${report.id}`,
      user,
      report,
      row: this.buildReportActivityRow(user, report)
    };
  }

  private buildReportActivityRow(user: AdminReportedUserDto, report: AdminReportDto): ActivityListRow {
    const source: ChatMenuItem = {
      id: report.id,
      avatar: this.reporterInitial(report),
      title: this.reportTitle(user, report),
      lastMessage: report.sourceText || report.details,
      lastSenderId: report.reporterUserId,
      memberIds: [report.reporterUserId, user.userId].filter(Boolean),
      unread: 0,
      dateIso: report.createdDate,
      channelType: 'serviceEvent',
      serviceContext: 'notification'
    };
    return toActivityChatRow(source, {
      activeUserId: 'admin',
      users: [
        this.chatUser(report.reporterUserId, report.reporterName, this.reporterInitial(report), 'woman'),
        this.chatUser(user.userId, user.name, user.initials, user.gender)
      ]
    });
  }

  private reportTitle(user: AdminReportedUserDto, report: AdminReportDto): string {
    return `${report.reporterName} reported ${user.name}`;
  }

  private estimatedMemberAge(user: AdminReportedUserDto): string {
    const seed = AppUtils.hashText(`admin-member-age:${user.userId}:${user.name}`);
    return String(24 + (seed % 12));
  }

  private reportMeta(report: AdminReportDto): string {
    return [
      report.reason,
      this.reportSourceLabel(report),
      this.shortDate(report.createdDate)
    ].filter(Boolean).join(' · ');
  }

  private reportSourceTargetUrl(report: AdminReportDto): string {
    if (report.sourceType === 'chat' || report.chatId) {
      const params = new URLSearchParams();
      params.set('supportTarget', 'chat-message');
      if (report.chatId) {
        params.set('chatId', report.chatId);
      }
      if (report.messageId) {
        params.set('messageId', report.messageId);
      }
      return `/game?${params.toString()}`;
    }
    if (report.sourceType === 'asset' || report.assetId) {
      const params = new URLSearchParams();
      params.set('supportTarget', 'asset');
      const assetType = `${report.assetType ?? ''}`.trim();
      if (assetType) {
        params.set('assetFilter', assetType);
      }
      if (report.assetId || report.sourceId) {
        params.set('assetId', report.assetId || report.sourceId || '');
      }
      if (report.sourceText) {
        params.set('assetTitle', report.sourceText);
      }
      if (report.eventTitle) {
        params.set('assetSubtitle', report.eventTitle);
      }
      const assetCity = this.assetCityFromEventTitle(report.eventTitle);
      if (assetCity) {
        params.set('assetCity', assetCity);
      }
      if (report.details) {
        params.set('assetDetails', report.details);
      }
      return `/game?${params.toString()}`;
    }
    const params = new URLSearchParams();
    params.set('supportTarget', 'event');
    if (report.eventId || report.sourceId) {
      params.set('eventId', report.eventId || report.sourceId || '');
    }
    return `/game?${params.toString()}`;
  }

  private adminHelpUrl(ownerUserId: string, targetUrl: string): string {
    const safeOwner = this.tokenSegment(ownerUserId || 'user');
    const encodedTarget = this.encodeTokenPayload(targetUrl || '/game');
    const token = `myscoutee:token:admin-report:${safeOwner}:${encodedTarget}`;
    return this.location.prepareExternalUrl(`/admin/help/${encodeURIComponent(token)}`);
  }

  private tokenSegment(value: string): string {
    return `${value ?? ''}`.trim().replace(/[^A-Za-z0-9-]/g, '-') || 'user';
  }

  private assetCityFromEventTitle(value: string | null | undefined): string {
    const title = `${value ?? ''}`.trim();
    if (!title) {
      return '';
    }
    const parts = title.split(/[-·]/).map(part => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private encodeTokenPayload(value: string): string {
    try {
      const bytes = new TextEncoder().encode(value);
      let binary = '';
      bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch {
      return '';
    }
  }

  private chatUser(
    id: string,
    name: string,
    initials: string,
    gender: string
  ): DemoUser {
    return {
      id: id || 'admin',
      name: name || 'Admin',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: initials || 'AD',
      gender: gender === 'man' ? 'man' : 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 100,
      headline: '',
      about: '',
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      }
    };
  }
}

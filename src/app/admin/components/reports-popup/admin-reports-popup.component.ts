import {
  CommonModule
} from '@angular/common';
import {
  Location
} from '@angular/common';
import {
  Component,
  TemplateRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from
} from 'rxjs';

import {
  ActivitiesPopupStore,
  eventChatHeaderStateFromChat,
  eventChatPopupRequestFromChat
} from '../../../shared/ui/context/stores/activities-popup.store';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  AdminModerationService,
  AdminWorkspaceDataService,
  type AdminModerationActionResult,
  type AdminReportedUserDto,
  type AdminReportDto
} from '../../../shared/core';
import {
  AppMenuDispatcher,
  AppMenuOutletComponent,
  ActivityChatSingleRowConverter,
  ImageCardComponent,
  SingleRowComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger,
  type ImageCardData,
  type ListQuery,
  type PageResult,
  type SingleRowData,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';
import {
  AdminWorkspaceStore
} from '../../../shared/ui/context/stores/admin-workspace.store';
import {
  AdminChatReviewPopupComponent
} from '../chat-review-popup/admin-chat-review-popup.component';
import {
  AdminItemPreviewPopupComponent
} from '../item-preview-popup/admin-item-preview-popup.component';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';

interface AdminReportListItem {
  id: string;
  user: AdminReportedUserDto;
  report: AdminReportDto;
  row: SingleRowData;
}

interface AdminReportListFilters {
  revision?: number;
}

interface AdminBlockedUserListItem {
  id: string;
  user: AdminReportedUserDto;
  row: SingleRowData;
}

interface AdminBlockedUserListFilters {
  revision?: number;
}

type AdminReportMenuAction = 'warn' | 'block' | 'unblock' | 'view-chat';
type AdminReportMenuSource = 'report-detail' | 'blocked-user';
type AdminReportActionsMenuItemId =
  | `report-detail:${string}`
  | `blocked-user:${string}`;

interface AdminReportActionsMenuContext {
  action: AdminReportMenuAction;
  source: AdminReportMenuSource;
  user: AdminReportedUserDto;
}

@Component({
  selector: 'app-admin-reports-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuOutletComponent,
    ImageCardComponent,
    SingleRowComponent,
    SmartListComponent,
    AdminChatReviewPopupComponent,
    AdminItemPreviewPopupComponent,
    PopupComponent
  ],
  templateUrl: './admin-reports-popup.component.html',
  styleUrl: './admin-reports-popup.component.scss',
  providers: [AppMenuDispatcher]
})
export class AdminReportsPopupComponent {
  protected readonly admin = inject(AdminMenuStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly workspace = inject(AdminWorkspaceStore);
  private readonly workspaceData = inject(AdminWorkspaceDataService);
  private readonly moderationData = inject(AdminModerationService);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly location = inject(Location);
  private readonly warnedUserIdsRef = signal<Set<string>>(new Set());
  protected reportDetail: AdminReportListItem | null = null;
  protected blockedUsersOpen = false;

  protected reportItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminReportListItem, AdminReportListFilters>
  >;
  protected blockedUserItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminBlockedUserListItem, AdminBlockedUserListFilters>
  >;

  @ViewChild('reportItemTemplate', { read: TemplateRef })
  protected set reportItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminReportListItem, AdminReportListFilters>> | undefined
  ) {
    this.reportItemTemplateRef = value;
  }

  @ViewChild('blockedUserItemTemplate', { read: TemplateRef })
  protected set blockedUserItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminBlockedUserListItem, AdminBlockedUserListFilters>> | undefined
  ) {
    this.blockedUserItemTemplateRef = value;
  }

  protected readonly reportsSmartListConfig: SmartListConfig<AdminReportListItem, AdminReportListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
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
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
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
  ) => from(this.loadReportsPage(query));

  protected readonly blockedUsersSmartListConfig: SmartListConfig<AdminBlockedUserListItem, AdminBlockedUserListFilters> = {
    pageSize: 12,
    initialPageSize: 12,
    defaultView: 'day',
    emptyLabel: 'No blocked users',
    emptyDescription: 'No profiles are currently blocked by moderation.',
    showStickyHeader: true,
    showFirstGroupMarker: false,
    showGroupMarker: ({ groupIndex }) => groupIndex > 0,
    groupBy: item => AppUtils.activityGroupLabel(item.row, 'day', APP_STATIC_DATA.activityGroupLabels),
    listLayout: 'card-grid',
    desktopColumns: 4,
    snapMode: 'none',
    scrollPaddingTop: '2.6rem',
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
    },
    containerClass: {
      'experience-card-list': true,
      'admin-blocked-smart-list': true
    },
    trackBy: (_index, item) => item.id
  };

  protected readonly blockedUsersSmartListLoadPage: SmartListLoadPage<AdminBlockedUserListItem, AdminBlockedUserListFilters> = (
    query
  ) => from(this.loadBlockedUsersPage(query));

  protected reportsPopupModel(): PopupModel {
    return {
      title: 'reported.users',
      subtitle: 'Only users with moderation reports are visible here.',
      ariaLabel: 'reported.users',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerActions: [
        {
          id: 'blocked-users',
          icon: 'person_off',
          label: 'Blocked users',
          ariaLabel: 'open.blocked.users',
          palette: 'danger',
          counter: this.blockedUsersCount(),
          disabled: this.blockedUsersCount() === 0,
          compactOnMobile: true
        }
      ],
      onClose: () => this.admin.closePopup(),
      onAction: event => this.onReportsPopupAction(event)
    };
  }

  protected reportDetailPopupModel(item: AdminReportListItem): PopupModel {
    return {
      title: 'Report details',
      subtitle: this.reportListTitle(item),
      ariaLabel: 'Report details',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'auto',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: () => this.closeReportDetails()
    };
  }

  protected blockedUsersPopupModel(): PopupModel {
    return {
      title: 'Blocked users',
      subtitle: 'Profiles currently blocked by moderation.',
      ariaLabel: 'Blocked users',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: () => this.closeBlockedUsers()
    };
  }

  private onReportsPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'blocked-users') {
      this.openBlockedUsers(event.sourceEvent);
    }
  }

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
    this.admin.openReportDetail(item.user, item.report);
  }

  protected reportSingleRow(item: AdminReportListItem, groupLabel: string | null): SingleRowData {
    const report = item.report;
    return {
      id: item.id,
      groupLabel,
      title: report.reporterName || 'Reporter',
      subtitle: `${report.reporterName || 'Reporter'} reported ${this.reportedHandle(item)}`,
      detail: report.details || this.reportListMeta(item),
      avatarInitials: this.reporterInitial(report),
      avatarUrl: this.reporterImageUrl(report) || null,
      avatarToneClass: `user-color-${item.user.gender}`,
      avatarAriaLabel: report.reporterName || 'Reporter',
      surfaceTone: this.reportSingleRowTone(report),
      badges: [
        {
          label: this.reportTime(report.createdDate),
          tone: 'muted',
          position: 'side'
        },
        {
          label: this.reportBadgeLabel(report),
          tone: this.reportReasonBadgeTone(report),
          position: 'side'
        }
      ],
      clickable: true,
      eagerDetail: item
    };
  }

  protected closeReportDetails(): void {
    this.reportDetail = null;
  }

  protected openBlockedUsers(event?: Event): void {
    event?.stopPropagation();
    this.blockedUsersOpen = true;
  }

  protected closeBlockedUsers(): void {
    this.blockedUsersOpen = false;
  }

  protected reviewReport(report: AdminReportDto): void {
    if (report.sourceType === 'chat' || report.chatId) {
      this.admin.openChatReview(report);
      return;
    }
    this.admin.openItemPreview(report);
  }

  protected warnUser(user: AdminReportedUserDto): void {
    this.admin.openWarnChat(user);
  }

  protected blockUser(user: AdminReportedUserDto): void {
    this.dialogStore.open({
      title: `Block ${user.name}?`,
      message: 'The user will be blocked and a support chat message will be sent.',
      confirmLabel: 'Block',
      busyConfirmLabel: 'Blocking...',
      confirmTone: 'danger',
      onConfirm: () => this.blockModerationUser(
        user.userId,
        'Your account has been blocked after moderation review. You can reply here to contact MyScoutee support and ask for a review.'
      )
    });
  }

  protected reportedUserImageCard(
    user: AdminReportedUserDto,
    options: { idPrefix?: string; title?: string | null } = {}
  ): ImageCardData<AdminReportedUserDto> {
    const blocked = this.isUserBlocked(user);
    return {
      id: `${options.idPrefix ?? 'reported-user'}-${user.userId || user.name || 'member'}`,
      title: `${options.title ?? this.memberCardTitle(user)}`.trim() || 'Member',
      subtitle: this.memberDescription(user),
      imageUrl: this.memberImageUrl(user) || null,
      placeholderIcon: blocked ? 'person_off' : 'person',
      placeholderLabel: user.initials,
      layout: 'overlay',
      toneClass: [
        'admin-reported-user-image-card',
        blocked ? 'admin-reported-user-image-card--blocked' : 'admin-reported-user-image-card--reported'
      ].join(' '),
      statusChip: {
        icon: blocked ? 'person_off' : 'person',
        title: blocked ? 'Blocked user' : 'Reported user',
        ariaLabel: blocked ? 'Blocked user' : 'Reported user',
        palette: blocked ? 'danger' : 'green'
      },
      menuBadgeCount: this.visibleSupportChatUnread(user),
      eagerDetail: user
    };
  }

  protected reportedUserMenuTrigger(
    user: AdminReportedUserDto,
    source: AdminReportMenuSource
  ): AppMenuTrigger {
    const unread = source === 'blocked-user' ? this.visibleSupportChatUnread(user) : null;
    return {
      icon: 'more_horiz',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: 'default',
      counter: unread,
      ariaLabel: source === 'blocked-user' ? 'Blocked user actions' : 'Member moderation actions'
    };
  }

  protected reportedUserMenuItems(
    user: AdminReportedUserDto,
    source: AdminReportMenuSource
  ): readonly AppMenuItem<string, unknown>[] {
    return this.reportActionItems(user, source) as readonly AppMenuItem<string, unknown>[];
  }

  protected onReportActionsMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as AdminReportActionsMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.action) {
      case 'warn':
        this.warnBlockedUser(context.user, event.sourceEvent);
        break;
      case 'block':
        event.sourceEvent.preventDefault();
        event.sourceEvent.stopPropagation();
        this.blockUser(context.user);
        break;
      case 'unblock':
        this.unblockUser(context.user, event.sourceEvent);
        break;
      case 'view-chat':
        this.viewBlockedUserChat(context.user, event.sourceEvent);
        break;
    }
  }

  protected blockedUsers(): AdminReportedUserDto[] {
    return this.workspace.dashboard()?.blockedUsers ?? [];
  }

  protected blockedUsersCount(): number {
    return this.blockedUsers().length;
  }

  protected warnBlockedUser(user: AdminReportedUserDto, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.warnUser(user);
  }

  protected viewBlockedUserChat(user: AdminReportedUserDto, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeBlockedUsers();
    this.closeReportDetails();
    this.openBlockedUserChat(user);
  }

  protected unblockUser(user: AdminReportedUserDto, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.dialogStore.open({
      title: `Unblock ${user.name}?`,
      message: 'The user profile status will be restored and they can use MyScoutee again.',
      confirmLabel: 'Unblock',
      busyConfirmLabel: 'Unblocking...',
      confirmTone: 'accent',
      onConfirm: () => this.unblockModerationUser(user.userId)
    });
  }

  private reportActionItems(
    user: AdminReportedUserDto,
    source: AdminReportMenuSource
  ): AppMenuItem<AdminReportActionsMenuItemId, AdminReportActionsMenuContext>[] {
    if (source === 'blocked-user' || this.isUserBlocked(user)) {
      return [
        this.reportActionItem(user, source, 'unblock', 'Unblock user', 'lock_open'),
        this.reportActionItem(user, source, 'view-chat', 'View chat', 'forum', undefined, this.visibleSupportChatUnread(user))
      ];
    }
    if (this.hasSupportChat(user)) {
      return [
        this.reportActionItem(user, source, 'view-chat', 'View chat', 'forum', undefined, this.visibleSupportChatUnread(user)),
        this.reportActionItem(user, source, 'block', 'Block user', 'block', 'danger')
      ];
    }
    return [
      this.reportActionItem(user, source, 'warn', 'Warn in chat', 'chat'),
      this.reportActionItem(user, source, 'block', 'Block user', 'block', 'danger')
    ];
  }

  private reportActionItem(
    user: AdminReportedUserDto,
    source: AdminReportMenuSource,
    action: AdminReportMenuAction,
    label: string,
    icon: string,
    palette?: 'danger',
    counter?: number | null
  ): AppMenuItem<AdminReportActionsMenuItemId, AdminReportActionsMenuContext> {
    return {
      id: `${source}:${user.userId || 'member'}:${action}` as AdminReportActionsMenuItemId,
      label,
      icon,
      palette,
      counter,
      context: { action, source, user }
    };
  }

  private visibleSupportChatUnread(user: AdminReportedUserDto): number | null {
    const unread = this.supportChatUnread(user);
    return unread > 0 ? unread : null;
  }

  protected isUserBlocked(user: AdminReportedUserDto): boolean {
    const resolved = user?.userId ? this.resolveDashboardReportedUser(user.userId) : null;
    return `${resolved?.profileStatus ?? user?.profileStatus ?? ''}`.trim() === 'blocked';
  }

  protected hasSupportChat(user: AdminReportedUserDto): boolean {
    const userId = `${user.userId ?? ''}`.trim();
    const resolved = this.resolveDashboardReportedUser(userId) ?? user;
    return Boolean(resolved.hasSupportChat) || this.warnedUserIdsRef().has(userId);
  }

  protected supportChatUnread(user: AdminReportedUserDto): number {
    const userId = `${user.userId ?? ''}`.trim();
    const resolved = this.resolveDashboardReportedUser(userId) ?? user;
    return Math.max(0, Math.trunc(Number(resolved.supportChatUnread) || 0));
  }

  protected isSelectedUser(user: AdminReportedUserDto): boolean {
    return this.admin.selectedReportedUser()?.userId === user.userId;
  }

  protected isSelectedReport(report: AdminReportDto): boolean {
    return this.admin.selectedReport()?.id === report.id;
  }

  protected reportRows(): AdminReportListItem[] {
    return this.reportRowsForUsers(this.workspace.dashboard()?.reportedUsers ?? []);
  }

  private reportRowsForUsers(users: readonly AdminReportedUserDto[]): AdminReportListItem[] {
    return users.flatMap(user =>
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

  protected reportSingleRowTone(report: AdminReportDto): NonNullable<SingleRowData['surfaceTone']> {
    if (report.sourceType === 'chat' || report.chatId) {
      return 'info';
    }
    if (report.sourceType === 'asset' || report.assetId) {
      return 'warning';
    }
    const label = this.reportBadgeLabel(report).toLowerCase();
    if (label.includes('harassment') || label.includes('abuse') || label.includes('safety')) {
      return 'danger';
    }
    return 'accent';
  }

  protected reportReasonBadgeTone(report: AdminReportDto): NonNullable<SingleRowData['sideLabelTone']> {
    return this.reportSingleRowTone(report);
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

  private async blockModerationUser(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.blockUser(
      normalizedUserId,
      this.userProfileStore.activeAdminUser(),
      message
    );
    this.applyModerationActionResult(normalizedUserId, result, { markWarned: true });
  }

  private async unblockModerationUser(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.unblockUser(
      normalizedUserId,
      this.userProfileStore.activeAdminUser()
    );
    this.applyModerationActionResult(normalizedUserId, result);
  }

  private applyModerationActionResult(
    userId: string,
    result: AdminModerationActionResult | null | undefined,
    options: { markWarned?: boolean } = {}
  ): void {
    if (!result) {
      return;
    }
    if (result.dashboard) {
      this.workspace.applyDashboard(result.dashboard);
    }
    if (result.userPatch) {
      this.workspace.patchModerationUser(result.userPatch);
    }
    if (options.markWarned === true) {
      this.markUserWarned(userId);
    }
    this.refreshSelectedReportedUser(userId);
  }

  private resolveDashboardReportedUser(userId: string): AdminReportedUserDto | null {
    const dashboard = this.workspace.dashboard();
    if (!dashboard) {
      return null;
    }
    const normalizedUserId = userId.trim();
    return [
      ...(dashboard.reportedUsers ?? []),
      ...(dashboard.blockedUsers ?? [])
    ].find(user => user.userId === normalizedUserId) ?? null;
  }

  private markUserWarned(userId: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return;
    }
    this.warnedUserIdsRef.update(current => {
      const next = new Set(current);
      next.add(normalizedUserId);
      return next;
    });
  }

  private refreshSelectedReportedUser(userId: string): void {
    const selected = this.admin.selectedReportedUser();
    if (!selected || selected.userId !== userId) {
      return;
    }
    this.admin.setSelectedReportedUser(this.resolveDashboardReportedUser(userId) ?? selected);
  }

  private openBlockedUserChat(user: AdminReportedUserDto): void {
    const chat = this.buildAdminSupportChat(user);
    if (!chat) {
      return;
    }
    this.admin.closePopup();
    this.activitiesStore.openEventChat(
      eventChatPopupRequestFromChat(chat),
      eventChatHeaderStateFromChat(chat)
    );
  }

  private buildAdminSupportChat(user: AdminReportedUserDto): (ChatDTO & { ownerUserId?: string }) | null {
    const admin = this.userProfileStore.activeAdminUser();
    if (!admin) {
      return null;
    }
    return {
      id: `c-support-admin-${user.userId}`,
      avatar: user.initials || 'U',
      title: `MyScoutee Support · ${user.name}`,
      lastMessage: user.profileStatus === 'blocked'
        ? 'Your account has been blocked after moderation review.'
        : 'MyScoutee support conversation.',
      lastSenderId: admin.id,
      memberIds: [user.userId, admin.id],
      unread: this.supportChatUnread(user),
      dateIso: user.lastReportedAtIso || new Date().toISOString(),
      channelType: 'appSupport',
      ownerUserId: admin.id
    };
  }

  private async loadReportsPage(query: ListQuery<AdminReportListFilters>): Promise<PageResult<AdminReportListItem>> {
    const rows = this.reportRowsForUsers(await this.loadReportedUsers());
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 24));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      nextCursor: start + pageSize < rows.length ? String(page + 1) : null
    };
  }

  private async loadBlockedUsersPage(query: ListQuery<AdminBlockedUserListFilters>): Promise<PageResult<AdminBlockedUserListItem>> {
    const rows = this.blockedUserRowsForUsers(await this.loadBlockedUsers());
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 12));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      nextCursor: start + pageSize < rows.length ? String(page + 1) : null
    };
  }

  private async loadReportedUsers(): Promise<AdminReportedUserDto[]> {
    return this.workspace.applyReportedUsers(
      await this.workspaceData.loadReportedUsers(this.workspace.currentAdminUserId())
    );
  }

  private async loadBlockedUsers(): Promise<AdminReportedUserDto[]> {
    return this.workspace.applyBlockedUsers(
      await this.workspaceData.loadBlockedUsers(this.workspace.currentAdminUserId())
    );
  }

  private blockedUserRowsForUsers(users: readonly AdminReportedUserDto[]): AdminBlockedUserListItem[] {
    return users.map(user => ({
      id: user.userId,
      user,
      row: this.buildBlockedUserActivityRow(user)
    })).sort((first, second) =>
      Date.parse(this.blockedDate(second.user)) - Date.parse(this.blockedDate(first.user))
    );
  }

  private buildBlockedUserActivityRow(user: AdminReportedUserDto): SingleRowData {
    const source: ChatDTO = {
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
    const activeUser = this.chatUser('admin', 'Admin', 'AD', 'woman');
    const usersById = new Map([
      [activeUser.id, activeUser],
      [user.userId, this.chatUser(user.userId, user.name, user.initials, user.gender)]
    ]);
    return ActivityChatSingleRowConverter.convert(source, {
      activeUser,
      resolveUserById: userId => usersById.get(userId) ?? null
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

  private buildReportActivityRow(user: AdminReportedUserDto, report: AdminReportDto): SingleRowData {
    const source: ChatDTO = {
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
    const activeUser = this.chatUser('admin', 'Admin', 'AD', 'woman');
    const usersById = new Map([
      [activeUser.id, activeUser],
      [report.reporterUserId, this.chatUser(report.reporterUserId, report.reporterName, this.reporterInitial(report), 'woman')],
      [user.userId, this.chatUser(user.userId, user.name, user.initials, user.gender)]
    ]);
    return ActivityChatSingleRowConverter.convert(source, {
      activeUser,
      resolveUserById: userId => usersById.get(userId) ?? null
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
      params.set('assetCategory', this.assetCategoryFromReport(report));
      params.set('assetPreview', this.assetPreviewUrl(report));
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

  private assetCategoryFromReport(report: AdminReportDto): string {
    const text = [
      report.sourceText,
      report.details,
      report.eventTitle
    ].join(' ').toLowerCase();
    if (text.includes('game') || text.includes('box') || text.includes('card')) {
      return 'Games';
    }
    if (text.includes('speaker') || text.includes('audio')) {
      return 'Audio';
    }
    if (text.includes('first aid') || text.includes('safety')) {
      return 'Safety';
    }
    if (text.includes('camp') || text.includes('tent')) {
      return 'Camping';
    }
    return 'Games';
  }

  private assetPreviewUrl(report: AdminReportDto): string {
    const seed = encodeURIComponent([
      `${report.assetType ?? report.sourceType ?? 'asset'}`.toLowerCase(),
      report.assetId || report.sourceId || report.sourceText || report.eventTitle || 'reported-asset'
    ].filter(Boolean).join('-'));
    return `https://picsum.photos/seed/${seed}/1200/700`;
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
  ): UserDto {
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

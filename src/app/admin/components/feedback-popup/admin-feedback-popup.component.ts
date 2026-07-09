import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { AdminWorkspaceDataService, type AdminDashboardDto, type AdminFeedbackDto } from '../../../shared/core';
import {
  SingleRowComponent,
  SmartListComponent,
  type AppMenuItemSelectEvent,
  type ListQuery,
  type PageResult,
  type SingleRowData,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage,
  ActivityChatSingleRowConverter
} from '../../../shared/ui';
import type {
  AppMenuModel,
  AppMenuPalette
} from '../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import type { AdminReviewStatusFilter } from '../../../shared/core/base/services/admin-workspace-data.service';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import { AdminMenuStore } from '../../../shared/ui/context/stores/admin-menu.store';
import { AdminWorkspaceStore } from '../../../shared/ui/context/stores/admin-workspace.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';

interface AdminFeedbackListFilters {
  revision?: number;
  status?: AdminReviewStatusFilter;
}

interface AdminFeedbackListItem {
  id: string;
  feedback: AdminFeedbackDto;
  row: SingleRowData;
}

type AdminReviewStatusMenuItemId = 'review-status-filter' | `review-status:${AdminReviewStatusFilter}`;

interface AdminReviewStatusMenuContext {
  status: AdminReviewStatusFilter;
}

interface AdminFeedbackRowMenuContext extends Record<string, unknown> {
  feedbackItem: AdminFeedbackListItem;
}

@Component({
  selector: 'app-admin-feedback-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent, SingleRowComponent, PopupComponent],
  templateUrl: './admin-feedback-popup.component.html',
  styleUrl: './admin-feedback-popup.component.scss'
})
export class AdminFeedbackPopupComponent {
  protected readonly admin = inject(AdminMenuStore);
  private readonly workspace = inject(AdminWorkspaceStore);
  private readonly workspaceData = inject(AdminWorkspaceDataService);
  private readonly dialogStore = inject(DialogStore);
  private readonly feedbackCategories = new Set(APP_STATIC_DATA.feedbackCategories);
  protected feedbackDetail: AdminFeedbackDto | null = null;
  protected feedbackStatusFilter: AdminReviewStatusFilter = 'unresolved';
  protected feedbackSmartListQuery: Partial<ListQuery<AdminFeedbackListFilters>> = {
    filters: { status: 'unresolved' }
  };
  protected feedbackStatusCounts: Record<AdminReviewStatusFilter, number> = {
    unresolved: 0,
    resolved: 0
  };

  protected feedbackItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminFeedbackListItem, AdminFeedbackListFilters>
  >;

  @ViewChild('feedbackItemTemplate', { read: TemplateRef })
  protected set feedbackItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminFeedbackListItem, AdminFeedbackListFilters>> | undefined
  ) {
    this.feedbackItemTemplateRef = value;
  }

  @ViewChild('feedbackSmartList')
  private feedbackSmartList?: SmartListComponent<AdminFeedbackListItem, AdminFeedbackListFilters>;

  protected readonly feedbackSmartListConfig: SmartListConfig<AdminFeedbackListItem, AdminFeedbackListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    defaultView: 'day',
    emptyLabel: 'No feedback',
    emptyDescription: 'No application feedback has been submitted.',
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

  protected readonly feedbackSmartListLoadPage: SmartListLoadPage<AdminFeedbackListItem, AdminFeedbackListFilters> = (
    query
  ) => from(this.loadFeedbackPage(query));

  protected feedbackPopupModel(): PopupModel<AdminReviewStatusMenuContext> {
    return {
      title: 'application.feedback',
      subtitle: 'feedback.submitted.from.the.app',
      ariaLabel: 'application.feedback',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      toolbarControls: [
        this.feedbackStatusToolbarControl()
      ],
      onClose: () => this.admin.closePopup(),
      onMenuSelect: event => this.onFeedbackPopupMenuSelect(event)
    };
  }

  protected feedbackDetailPopupModel(item: AdminFeedbackDto): PopupModel {
    return {
      title: 'feedback.details',
      subtitle: `${item.userName} · ${this.feedbackListMeta(item)}`,
      ariaLabel: 'feedback.details',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'auto',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: () => this.closeFeedbackDetails()
    };
  }

  private onFeedbackPopupMenuSelect(event: PopupMenuSelectEvent<AdminReviewStatusMenuContext>): void {
    const status = event.itemSelect.context?.status;
    if (!status) {
      return;
    }
    this.selectFeedbackStatus(status, event.itemSelect.sourceEvent);
  }

  private selectFeedbackStatus(status: AdminReviewStatusFilter, event?: Event): void {
    event?.stopPropagation();
    if (this.feedbackStatusFilter === status) {
      return;
    }
    this.feedbackStatusFilter = status;
    this.closeFeedbackDetails();
    this.feedbackSmartListQuery = {
      filters: { status }
    };
  }

  private feedbackStatusToolbarControl(): PopupControl<AdminReviewStatusMenuContext> {
    return {
      kind: 'menu',
      id: 'feedback-review-status-filter',
      align: 'end',
      menuKind: 'inline',
      model: this.feedbackStatusMenuModel(),
      panelAlign: 'end'
    };
  }

  private feedbackStatusMenuModel(): AppMenuModel<AdminReviewStatusMenuItemId, AdminReviewStatusMenuContext> {
    return {
      nodes: [
        {
          id: 'feedback-review-status-root',
          items: [
            {
              id: 'review-status-filter',
              kind: 'select-trigger',
              label: this.reviewStatusLabel(this.feedbackStatusFilter),
              icon: this.reviewStatusIcon(this.feedbackStatusFilter),
              palette: this.reviewStatusPalette(this.feedbackStatusFilter),
              counter: this.feedbackStatusCount(this.feedbackStatusFilter),
              ariaLabel: 'Feedback status filter',
              items: (['unresolved', 'resolved'] satisfies AdminReviewStatusFilter[]).map(status => ({
                id: `review-status:${status}`,
                kind: 'radio',
                label: this.reviewStatusLabel(status),
                icon: this.reviewStatusIcon(status),
                palette: this.reviewStatusPalette(status),
                surface: 'tinted',
                checked: this.feedbackStatusFilter === status,
                counter: this.feedbackStatusCount(status),
                context: { status }
              }))
            }
          ]
        }
      ]
    };
  }

  private reviewStatusLabel(status: AdminReviewStatusFilter): string {
    return status === 'resolved' ? 'Resolved' : 'Unresolved';
  }

  private reviewStatusIcon(status: AdminReviewStatusFilter): string {
    return status === 'resolved' ? 'task_alt' : 'pending_actions';
  }

  private reviewStatusPalette(status: AdminReviewStatusFilter): AppMenuPalette {
    return status === 'resolved' ? 'success' : 'warning';
  }

  private feedbackStatusCount(status: AdminReviewStatusFilter): number {
    return Math.max(0, Math.trunc(Number(this.feedbackStatusCounts[status]) || 0));
  }

  protected selectFeedback(item: AdminFeedbackListItem): void {
    this.feedbackDetail = item.feedback;
  }

  protected feedbackSingleRow(item: AdminFeedbackListItem, groupLabel: string | null): SingleRowData {
    const feedback = item.feedback;
    return {
      id: item.id,
      groupLabel,
      title: feedback.userName || 'Feedback',
      subtitle: feedback.subject || this.feedbackCategoryLabel(feedback),
      detail: feedback.details || this.feedbackListMeta(feedback),
      avatarInitials: this.feedbackInitial(feedback),
      avatarUrl: this.feedbackAvatarUrl(feedback) || null,
      avatarAriaLabel: feedback.userName || 'Feedback author',
      surfaceTone: this.feedbackSingleRowTone(feedback),
      badges: [
        {
          label: this.feedbackCategoryLabel(feedback),
          title: this.feedbackCategoryLabel(feedback),
          ariaLabel: this.feedbackCategoryLabel(feedback),
          tone: this.feedbackCategoryBadgeTone(feedback),
          position: 'top-right'
        }
      ],
      menuActions: [
        this.isFeedbackResolved(feedback) ? 'markUnresolved' : 'markSolved'
      ],
      clickable: true,
      eagerDetail: feedback
    };
  }

  protected feedbackRowMenuContext(item: AdminFeedbackListItem): AdminFeedbackRowMenuContext {
    return { feedbackItem: item };
  }

  protected onFeedbackRowMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as (AdminFeedbackRowMenuContext & { action?: { id?: string } }) | undefined;
    const actionId = `${context?.action?.id ?? ''}`.trim();
    const item = context?.feedbackItem ?? null;
    if (!item || (actionId !== 'markSolved' && actionId !== 'markUnresolved')) {
      return;
    }
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    this.confirmFeedbackResolved(item, actionId === 'markSolved');
  }

  protected closeFeedbackDetails(): void {
    this.feedbackDetail = null;
  }

  private confirmFeedbackResolved(item: AdminFeedbackListItem, resolved: boolean): void {
    this.dialogStore.open({
      title: resolved ? 'Mark feedback solved?' : 'Mark feedback unresolved?',
      message: resolved
        ? `${item.feedback.userName || 'The user'} will receive a support message saying the feedback was reviewed.`
        : 'The feedback will return to the unresolved list.',
      confirmLabel: resolved ? 'Mark solved' : 'Mark unresolved',
      busyConfirmLabel: resolved ? 'Marking solved...' : 'Reopening...',
      confirmTone: resolved ? 'accent' : 'warning',
      ringPerimeter: 112,
      onConfirm: () => this.setFeedbackResolved(item, resolved)
    });
  }

  private async setFeedbackResolved(item: AdminFeedbackListItem, resolved: boolean): Promise<void> {
    const dashboard = await this.workspaceData.setFeedbackResolved(
      item.feedback.id,
      resolved,
      this.workspace.currentAdminUserId()
    );
    this.applyFeedbackDashboard(dashboard);
    this.closeFeedbackDetails();
    this.feedbackSmartList?.removeVisibleItemByIdentity(item.id, { totalDelta: -1 });
  }

  protected isSelectedFeedback(item: AdminFeedbackDto): boolean {
    return this.feedbackDetail?.id === item.id;
  }

  protected feedbackListMeta(item: AdminFeedbackDto): string {
    return [item.category, this.shortDate(item.createdDate)].filter(Boolean).join(' · ');
  }

  protected feedbackInitial(item: AdminFeedbackDto): string {
    return (item.userName || 'F').trim().charAt(0).toUpperCase() || 'F';
  }

  protected feedbackAvatarUrl(item: AdminFeedbackDto): string {
    return `${item.userImageUrl ?? ''}`.trim();
  }

  protected feedbackCategoryLabel(item: AdminFeedbackDto): string {
    const category = `${item.category ?? ''}`.trim();
    if (this.feedbackCategories.has(category)) {
      return category;
    }
    if (category === 'Safety') {
      return 'UX improvement';
    }
    if (category === 'Events') {
      return 'Feature request';
    }
    return 'General';
  }

  protected feedbackCategoryToneClass(item: AdminFeedbackDto): string {
    return `admin-feedback-tone-${this.feedbackCategoryLabel(item)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'general'}`;
  }

  protected feedbackSingleRowTone(item: AdminFeedbackDto): NonNullable<SingleRowData['surfaceTone']> {
    switch (this.feedbackCategoryLabel(item)) {
      case 'Bug report':
        return 'danger';
      case 'Feature request':
        return 'success';
      case 'UX improvement':
        return 'accent';
      case 'Performance':
        return 'warning';
      default:
        return 'info';
    }
  }

  protected feedbackCategoryBadgeTone(item: AdminFeedbackDto): NonNullable<SingleRowData['sideLabelTone']> {
    return this.feedbackSingleRowTone(item);
  }

  protected isFeedbackResolved(item: AdminFeedbackDto): boolean {
    return `${item.resolvedAtIso ?? ''}`.trim().length > 0;
  }

  protected feedbackReviewStatus(item: AdminFeedbackDto): AdminReviewStatusFilter {
    return this.isFeedbackResolved(item) ? 'resolved' : 'unresolved';
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

  protected feedbackTime(value: string | null | undefined): string {
    const date = new Date(`${value ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return `${value ?? ''}`.trim();
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private async loadFeedbackPage(query: ListQuery<AdminFeedbackListFilters>): Promise<PageResult<AdminFeedbackListItem>> {
    const rows = [...(await this.loadFeedback(query.filters?.status ?? this.feedbackStatusFilter))].sort((first, second) =>
      Date.parse(second.createdDate) - Date.parse(first.createdDate)
    ).map(feedback => ({
      id: feedback.id,
      feedback,
      row: this.buildFeedbackActivityRow(feedback)
    }));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 24));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      nextCursor: start + pageSize < rows.length ? String(page + 1) : null
    };
  }

  private async loadFeedback(status: AdminReviewStatusFilter): Promise<AdminFeedbackDto[]> {
    return this.applyFeedbackDashboard(
      await this.workspaceData.loadFeedbackDashboard(this.workspace.currentAdminUserId(), status)
    ).feedback;
  }

  private applyFeedbackDashboard(dashboard: AdminDashboardDto): AdminDashboardDto {
    const normalized = this.workspace.applyDashboard(dashboard);
    this.applyFeedbackStatusCounts(normalized);
    return normalized;
  }

  private applyFeedbackStatusCounts(dashboard: AdminDashboardDto): void {
    this.feedbackStatusCounts = {
      unresolved: Math.max(0, Math.trunc(Number(dashboard.reviewCounts?.feedbackUnresolved) || 0)),
      resolved: Math.max(0, Math.trunc(Number(dashboard.reviewCounts?.feedbackResolved) || 0))
    };
  }

  private buildFeedbackActivityRow(feedback: AdminFeedbackDto): SingleRowData {
    const source: ChatDTO = {
      id: feedback.id,
      avatar: this.feedbackInitial(feedback),
      title: feedback.userName,
      lastMessage: feedback.details,
      lastSenderId: feedback.userId,
      memberIds: [feedback.userId, 'admin'].filter(Boolean),
      unread: 0,
      dateIso: feedback.createdDate,
      channelType: 'serviceEvent',
      serviceContext: 'notification'
    };
    const activeUser = this.chatUser('admin', 'Admin', 'AD', 'woman');
    const usersById = new Map([
      [activeUser.id, activeUser],
      [feedback.userId, this.chatUser(feedback.userId, feedback.userName, this.feedbackInitial(feedback), 'woman')]
    ]);
    return ActivityChatSingleRowConverter.convert(source, {
      activeUser,
      resolveUserById: userId => usersById.get(userId) ?? null
    });
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

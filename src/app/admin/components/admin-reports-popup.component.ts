import { CommonModule } from '@angular/common';
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
import { ActivitiesChatTemplateComponent, type ActivitiesChatTemplateContext } from '../../activity/components/activities-popup/templates/chat/activities-chat-template.component';
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

@Component({
  selector: 'app-admin-reports-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent, ActivitiesChatTemplateComponent],
  templateUrl: './admin-reports-popup.component.html',
  styleUrl: './admin-popups.scss'
})
export class AdminReportsPopupComponent {
  protected readonly admin = inject(AdminService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  protected reportDetail: AdminReportListItem | null = null;

  protected reportItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminReportListItem, AdminReportListFilters>
  >;

  @ViewChild('reportItemTemplate', { read: TemplateRef })
  private set reportItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminReportListItem, AdminReportListFilters>> | undefined
  ) {
    this.reportItemTemplateRef = value;
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

  protected readonly reportChatTemplateContext: ActivitiesChatTemplateContext = {
    getActiveUserInitials: () => 'AD',
    getChatLastSender: (chat) => this.chatUserFromChat(chat),
    getChatMemberCount: (chat) => chat.memberIds.length,
    getChatChannelType: () => 'serviceEvent'
  };

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

  protected closeReportDetails(): void {
    this.reportDetail = null;
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

  private reportMeta(report: AdminReportDto): string {
    return [
      report.reason,
      this.reportSourceLabel(report),
      this.shortDate(report.createdDate)
    ].filter(Boolean).join(' · ');
  }

  private chatUserFromChat(chat: ChatMenuItem): DemoUser {
    return this.chatUser(chat.lastSenderId || chat.id, chat.title, chat.avatar, 'woman');
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

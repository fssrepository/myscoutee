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
import { AdminService, type AdminFeedbackDto } from '../admin.service';

interface AdminFeedbackListFilters {
  revision?: number;
}

interface AdminFeedbackListItem {
  id: string;
  feedback: AdminFeedbackDto;
  row: ActivityListRow;
}

@Component({
  selector: 'app-admin-feedback-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent, ActivitiesChatTemplateComponent],
  templateUrl: './admin-feedback-popup.component.html',
  styleUrl: './admin-popups.scss'
})
export class AdminFeedbackPopupComponent {
  protected readonly admin = inject(AdminService);
  protected feedbackDetail: AdminFeedbackDto | null = null;

  protected feedbackItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AdminFeedbackListItem, AdminFeedbackListFilters>
  >;

  @ViewChild('feedbackItemTemplate', { read: TemplateRef })
  private set feedbackItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AdminFeedbackListItem, AdminFeedbackListFilters>> | undefined
  ) {
    this.feedbackItemTemplateRef = value;
  }

  protected readonly feedbackSmartListConfig: SmartListConfig<AdminFeedbackListItem, AdminFeedbackListFilters> = {
    pageSize: 10,
    initialPageSize: 20,
    loadingDelayMs: 0,
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
  ) => of(this.loadFeedbackPage(query));

  protected readonly feedbackChatTemplateContext: ActivitiesChatTemplateContext = {
    getActiveUserInitials: () => 'AD',
    getChatLastSender: (chat) => this.chatUserFromChat(chat),
    getChatMemberCount: (chat) => chat.memberIds.length,
    getChatChannelType: () => 'serviceEvent'
  };

  protected selectFeedback(item: AdminFeedbackListItem): void {
    this.feedbackDetail = item.feedback;
  }

  protected closeFeedbackDetails(): void {
    this.feedbackDetail = null;
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

  private loadFeedbackPage(query: ListQuery<AdminFeedbackListFilters>): PageResult<AdminFeedbackListItem> {
    const rows = [...(this.admin.dashboard()?.feedback ?? [])].sort((first, second) =>
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

  private buildFeedbackActivityRow(feedback: AdminFeedbackDto): ActivityListRow {
    const source: ChatMenuItem = {
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
    return toActivityChatRow(source, {
      activeUserId: 'admin',
      users: [
        this.chatUser(feedback.userId, feedback.userName, this.feedbackInitial(feedback), 'woman')
      ]
    });
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

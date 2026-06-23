import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import type { AdminFeedbackDto } from '../../../shared/core';
import {
  SingleRowComponent,
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SingleRowData,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage,
  ActivityChatSingleRowConverter
} from '../../../shared/ui';
import type { ChatRecord } from '../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import { AdminShellService } from '../../services/admin-shell.service';
import { AdminWorkspaceService } from '../../services/admin-workspace.service';

interface AdminFeedbackListFilters {
  revision?: number;
}

interface AdminFeedbackListItem {
  id: string;
  feedback: AdminFeedbackDto;
  row: SingleRowData;
}

@Component({
  selector: 'app-admin-feedback-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent, SingleRowComponent],
  templateUrl: './admin-feedback-popup.component.html',
  styleUrl: '../admin-popups.scss'
})
export class AdminFeedbackPopupComponent {
  protected readonly admin = inject(AdminShellService);
  private readonly workspace = inject(AdminWorkspaceService);
  private readonly feedbackCategories = new Set(APP_STATIC_DATA.feedbackCategories);
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
          label: this.feedbackTime(feedback.createdDate),
          tone: 'muted',
          position: 'side'
        },
        {
          label: this.feedbackCategoryLabel(feedback),
          tone: this.feedbackCategoryBadgeTone(feedback),
          position: 'side'
        }
      ],
      clickable: true,
      eagerDetail: feedback
    };
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
    const rows = [...(await this.workspace.loadFeedback())].sort((first, second) =>
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

  private buildFeedbackActivityRow(feedback: AdminFeedbackDto): SingleRowData {
    const source: ChatRecord = {
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
    return ActivityChatSingleRowConverter.convert(source, {
      activeUserId: 'admin',
      users: [
        this.chatUser(feedback.userId, feedback.userName, this.feedbackInitial(feedback), 'woman')
      ]
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

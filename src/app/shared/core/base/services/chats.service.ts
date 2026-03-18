import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../app-types';
import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesPageRequest } from '../../../activities-models';
import type { ChatMenuItem, DemoUser } from '../../../demo-data';
import type { PageResult } from '../../../ui';
import { activityChatContextFilterKey, buildActivityChatRows } from '../converters';
import type { DemoChatRecord } from '../../demo/models/chats.model';
import { DemoChatsService } from '../../demo';
import { HttpChatsService } from '../../http';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class ChatsService {
  private readonly demoChatsService = inject(DemoChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get chatsService(): DemoChatsService | HttpChatsService {
    return this.demoModeEnabled ? this.demoChatsService : this.httpChatsService;
  }

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    return this.chatsService.queryChatItemsByUser(userId);
  }

  async loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    return this.chatsService.loadChatMessages(chat);
  }

  async queryActivitiesChatPage(
    userId: string,
    request: ActivitiesPageRequest,
    options: {
      chatItems?: readonly ChatMenuItem[];
      users?: readonly DemoUser[];
    } = {}
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    const items = options.chatItems
      ? options.chatItems.map(item => ({
          ...item,
          ownerUserId: 'ownerUserId' in item && typeof item.ownerUserId === 'string' ? item.ownerUserId : userId
        }))
      : await this.queryChatItemsByUser(userId);
    const filteredItems = items.filter(item =>
      request.chatContextFilter === 'all'
        ? true
        : activityChatContextFilterKey(item) === request.chatContextFilter
    );
    const rows = buildActivityChatRows(filteredItems, {
      users: options.users ?? AppDemoGenerators.buildExpandedDemoUsers(50),
      activeUserId: userId
    });
    const sorted = this.sortActivitiesChatRows(rows, request);
    const startIndex = request.page * request.pageSize;
    return {
      items: sorted.slice(startIndex, startIndex + request.pageSize),
      total: sorted.length
    };
  }

  private sortActivitiesChatRows(
    rows: readonly AppTypes.ActivityListRow[],
    request: ActivitiesPageRequest
  ): AppTypes.ActivityListRow[] {
    const sorted = [...rows];
    if (request.view === 'distance') {
      return sorted.sort((left, right) => this.activityRowDistanceOrderValue(left) - this.activityRowDistanceOrderValue(right));
    }
    if (request.secondaryFilter === 'past') {
      return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
    }
    if (request.secondaryFilter === 'relevant') {
      return sorted.sort((left, right) =>
        right.metricScore - left.metricScore
        || AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso)
      );
    }
    return sorted.sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
  }

  private activityRowDistanceOrderValue(row: AppTypes.ActivityListRow): number {
    if (Number.isFinite(row.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(row.distanceMetersExact)));
    }
    return Math.max(0, Math.round((Number(row.distanceKm) || 0) * 1000));
  }
}

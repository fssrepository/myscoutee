import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { ChatMenuItem } from '../interfaces/activity-feed.interface';
import type { DemoUser } from '../interfaces/user.interface';
import type { PageResult } from '../../../ui';
import { activityChatContextFilterKey, buildActivityChatRows } from '../converters';
import type { DemoChatRecord } from '../../demo/models/chats.model';
import { DemoChatsService } from '../../demo';
import { HttpChatsService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { DemoUsersRepository } from '../../demo';

@Injectable({
  providedIn: 'root'
})
export class ChatsService extends BaseRouteModeService {
  private readonly demoChatsService = inject(DemoChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly demoUsersRepository = inject(DemoUsersRepository);


  private get chatsService(): DemoChatsService | HttpChatsService {
    return this.resolveRouteService('/activities/chats', this.demoChatsService, this.httpChatsService);
  }

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    return this.chatsService.queryChatItemsByUser(userId);
  }

  peekChatItemsByUser(userId: string): DemoChatRecord[] {
    return this.chatsService.peekChatItemsByUser(userId);
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
      users: options.users ?? this.demoUsersRepository.queryAllUsers(),
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

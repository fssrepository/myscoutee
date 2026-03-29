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
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly demoChatsService = inject(DemoChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly demoUsersRepository = inject(DemoUsersRepository);

  private get chatsService(): DemoChatsService | HttpChatsService {
    return this.resolveRouteService(ChatsService.CHAT_ROUTE, this.demoChatsService, this.httpChatsService);
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

  async sendChatMessage(chat: ChatMenuItem, text: string): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessage(chat, text);
  }

  async watchChatMessages(
    chat: ChatMenuItem,
    onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatMessages(chat, onMessage);
  }

  async watchChatEvents(
    chat: ChatMenuItem,
    onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatEvents(chat, onEvent);
  }

  async sendChatTyping(chat: ChatMenuItem, typing: boolean): Promise<void> {
    return this.chatsService.sendChatTyping(chat, typing);
  }

  async markChatRead(chat: ChatMenuItem, messageIds: readonly string[]): Promise<void> {
    return this.chatsService.markChatRead(chat, messageIds);
  }

  async queryActivitiesChatPage(
    userId: string,
    request: ActivitiesPageRequest,
    options: {
      chatItems?: readonly ChatMenuItem[];
      users?: readonly DemoUser[];
    } = {}
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    if (!this.isDemoModeEnabled(ChatsService.CHAT_ROUTE)) {
      const users = options.users ?? this.demoUsersRepository.queryAllUsers();
      const page = await this.httpChatsService.queryActivitiesChatPage(userId, request);
      return {
        items: buildActivityChatRows(page.items, {
          users,
          activeUserId: userId
        }),
        total: page.total,
        nextCursor: page.nextCursor ?? null
      };
    }

    const users = options.users ?? this.demoUsersRepository.queryAllUsers();
    const items = options.chatItems && options.chatItems.length > 0
      ? options.chatItems
      : await this.queryChatItemsByUser(userId);
    const filteredItems = items.filter(item =>
      request.chatContextFilter === 'all'
        ? true
        : activityChatContextFilterKey(item) === request.chatContextFilter
    );
    const sorted = this.sortActivitiesChatItems(filteredItems, request, users, userId);
    const startIndex = request.page * request.pageSize;
    return {
      items: buildActivityChatRows(sorted.slice(startIndex, startIndex + request.pageSize), {
        users,
        activeUserId: userId
      }),
      total: sorted.length
    };
  }

  private sortActivitiesChatItems(
    items: readonly ChatMenuItem[],
    request: ActivitiesPageRequest,
    users: readonly DemoUser[],
    activeUserId: string
  ): ChatMenuItem[] {
    const sorted = [...items];
    const userById = this.buildUserById(users);
    const hasFallbackUser = userById.has(activeUserId) || users.length > 0;
    if (request.secondaryFilter === 'past') {
      return sorted.sort(
        (left, right) => AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
      );
    }
    if (request.secondaryFilter === 'relevant') {
      return sorted.sort((left, right) =>
        this.chatMetricScore(right, userById, hasFallbackUser) - this.chatMetricScore(left, userById, hasFallbackUser)
        || AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
      );
    }
    return sorted.sort(
      (left, right) => AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
    );
  }

  private chatMetricScore(
    item: Pick<ChatMenuItem, 'unread' | 'memberIds'>,
    userById: ReadonlyMap<string, DemoUser>,
    hasFallbackUser: boolean
  ): number {
    const unread = Math.max(0, Math.trunc(Number(item.unread) || 0));
    return unread * 10 + this.chatMemberCount(item, userById, hasFallbackUser);
  }

  private chatMemberCount(
    item: Pick<ChatMenuItem, 'memberIds'>,
    userById: ReadonlyMap<string, DemoUser>,
    hasFallbackUser: boolean
  ): number {
    const memberIds = item.memberIds ?? [];
    if (memberIds.length === 0) {
      return hasFallbackUser ? 1 : 0;
    }

    const uniqueIds = new Set<string>();
    for (const memberId of memberIds) {
      if (userById.has(memberId)) {
        uniqueIds.add(memberId);
      }
    }
    if (uniqueIds.size > 0) {
      return uniqueIds.size;
    }
    return hasFallbackUser ? 1 : 0;
  }

  private buildUserById(users: readonly DemoUser[]): ReadonlyMap<string, DemoUser> {
    const userById = new Map<string, DemoUser>();
    for (const user of users) {
      userById.set(user.id, user);
    }
    return userById;
  }
}

import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { ChatRecord } from '../models/chat.model';
import type { DemoUser } from '../interfaces/user.interface';
import type { PageResult } from '../../../ui';
import { buildActivityChatRows } from '../converters';
import type { DemoChatRecord } from '../../demo/models/chats.model';
import { DemoChatsService } from '../../demo';
import { HttpChatsService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { ActivityMembersService } from './activity-members.service';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class ChatsService extends BaseRouteModeService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly demoChatsService = inject(DemoChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly usersService = inject(UsersService);

  private get chatsService(): DemoChatsService | HttpChatsService {
    return this.resolveRouteService(ChatsService.CHAT_ROUTE, this.demoChatsService, this.httpChatsService);
  }

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    return this.chatsService.queryChatItemsByUser(userId);
  }

  peekChatItemsByUser(userId: string): DemoChatRecord[] {
    return this.chatsService.peekChatItemsByUser(userId);
  }

  async loadChatMessages(chat: ChatRecord): Promise<AppTypes.ChatPopupMessage[]> {
    return this.chatsService.loadChatMessages(chat);
  }

  async loadChatMessagesResult(
    chat: ChatRecord
  ): Promise<PageResult<AppTypes.ChatPopupMessage, AppTypes.PopupHeaderContext>> {
    const items = await this.loadChatMessages(chat);
    return {
      items,
      total: items.length,
      context: this.buildChatPopupHeaderContext(chat, { includeThumbs: true })
    };
  }

  buildChatPopupHeaderContext(
    chat: ChatRecord,
    options: { includeThumbs?: boolean } = {}
  ): AppTypes.PopupHeaderContext {
    const chatId = `${chat.id ?? ''}`.trim();
    const title = `${chat.title ?? ''}`.trim() || 'Chat';
    const memberIds = this.resolveChatMemberIds(chat);
    const controls: AppTypes.PopupHeaderControl[] = [];
    if (chatId && memberIds.length > 0) {
      const maxVisibleThumbs = 4;
      const thumbs = options.includeThumbs === true
        ? this.buildChatHeaderThumbs(memberIds, maxVisibleThumbs)
        : [];
      const hiddenThumbCount = thumbs.length > 0 ? Math.max(0, memberIds.length - thumbs.length) : 0;
      controls.push({
        id: 'members',
        label: 'Members',
        summary: this.memberCountLabel(memberIds.length),
        visual: thumbs.length > 0
          ? { kind: 'thumbStack', thumbs, maxVisible: maxVisibleThumbs }
          : { kind: 'icon', icon: 'groups' },
        badge: hiddenThumbCount > 0 ? { value: hiddenThumbCount, tone: 'danger' } : null,
        lookup: {
          type: 'chat',
          id: chatId
        }
      });
    }
    return {
      revision: this.chatHeaderRevision(chatId, title, memberIds),
      title,
      controls
    };
  }

  async queryChatMemberEntries(chatId: string): Promise<AppTypes.ActivityMemberEntry[]> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return [];
    }
    return this.chatsService.queryChatMembers(normalizedChatId);
  }

  async sendChatMessage(chat: ChatRecord, text: string, clientId?: string): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessage(chat, text, clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatRecord,
    text: string,
    attachments: readonly AppTypes.ChatMessageAttachment[],
    clientId?: string,
    replyTo?: AppTypes.ChatPopupMessage['replyTo']
  ): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessageWithAttachments(chat, text, attachments, clientId, replyTo);
  }

  async updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: AppTypes.ChatMessageMutation
  ): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.updateChatMessage(chat, messageId, mutation);
  }

  async watchChatMessages(
    chat: ChatRecord,
    onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatMessages(chat, onMessage);
  }

  async watchChatEvents(
    chat: ChatRecord,
    onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatEvents(chat, onEvent);
  }

  async sendChatTyping(chat: ChatRecord, typing: boolean): Promise<void> {
    return this.chatsService.sendChatTyping(chat, typing);
  }

  async markChatRead(chat: ChatRecord, messageIds: readonly string[]): Promise<void> {
    return this.chatsService.markChatRead(chat, messageIds);
  }

  async updateSupportCase(chat: ChatRecord, action: AppTypes.SupportCaseAction): Promise<DemoChatRecord | null> {
    return this.chatsService.updateSupportCase(chat, action);
  }

  async resolveEventServiceChat(input: {
    activeUserId: string;
    eventId: string;
    ownerId: string;
    title: string;
    actionLabel: string;
    creatorName?: string | null;
    acceptedMemberUserIds?: readonly string[] | null;
    pendingMemberUserIds?: readonly string[] | null;
    hosting?: boolean;
    notification: boolean;
  }): Promise<(ChatRecord & { ownerUserId?: string }) | null> {
    const activeUserId = input.activeUserId.trim();
    const eventId = input.eventId.trim();
    const ownerId = input.ownerId.trim();
    const title = input.title.trim() || 'Event';
    if (!activeUserId || !eventId || !ownerId) {
      return null;
    }

    const existingChat = this.resolveExistingEventServiceChat(
      await this.queryChatItemsByUser(activeUserId),
      {
        activeUserId,
        eventId,
        notification: input.notification
      }
    );
    if (existingChat) {
      return existingChat;
    }

    const memberSummary = input.notification
      ? await this.activityMembersService.querySummaryByOwnerId(eventId)
      : null;
    return this.buildActivityServiceChat({
      activeUserId,
      eventId,
      ownerId,
      title,
      actionLabel: input.actionLabel,
      creatorName: input.creatorName,
      hosting: input.hosting === true,
      notification: input.notification,
      acceptedMemberUserIds: input.acceptedMemberUserIds ?? memberSummary?.acceptedMemberUserIds ?? [],
      pendingMemberUserIds: input.pendingMemberUserIds ?? memberSummary?.pendingMemberUserIds ?? []
    });
  }

  private resolveExistingEventServiceChat(
    chats: readonly ChatRecord[],
    input: {
      activeUserId: string;
      eventId: string;
      notification: boolean;
    }
  ): (ChatRecord & { ownerUserId?: string }) | null {
    const expectedId = `c-service-event-${input.eventId}-${input.activeUserId}`;
    const expectedServiceContext = input.notification ? 'notification' : 'event';
    const match = chats.find(chat => chat.id === expectedId)
      ?? chats.find(chat =>
        chat.channelType === 'serviceEvent'
        && chat.serviceContext === expectedServiceContext
        && chat.eventId === input.eventId
      );
    return match
      ? {
          ...match,
          memberIds: [...(match.memberIds ?? [])]
        }
      : null;
  }

  buildActivityServiceChat(input: {
    activeUserId: string;
    eventId: string;
    ownerId: string;
    title: string;
    actionLabel: string;
    creatorName?: string | null;
    acceptedMemberUserIds?: readonly string[] | null;
    pendingMemberUserIds?: readonly string[] | null;
    hosting: boolean;
    notification: boolean;
  }): ChatRecord & { ownerUserId?: string } {
    const acceptedMemberUserIds = Array.isArray(input.acceptedMemberUserIds)
      ? input.acceptedMemberUserIds
      : [];
    const pendingMemberUserIds = Array.isArray(input.pendingMemberUserIds)
      ? input.pendingMemberUserIds
      : [];
    const acceptedAdmins = input.hosting
      ? this.uniqueUserIds([input.ownerId, input.activeUserId])
      : this.uniqueUserIds([input.ownerId]);
    const memberIds = this.uniqueUserIds([
      input.activeUserId,
      ...acceptedAdmins,
      ...(input.notification ? acceptedMemberUserIds : []),
      ...(input.notification ? pendingMemberUserIds : [])
    ]);
    const creatorName = `${input.creatorName ?? ''}`.trim();

    return {
      id: `c-service-event-${input.eventId}-${input.activeUserId}`,
      avatar: AppUtils.initialsFromText(creatorName || input.title),
      title: `${input.actionLabel.trim() || 'Contact Organizer'} · ${input.title}`,
      lastMessage: input.notification
        ? 'Notification channel for cancellations, postponements, and urgent event updates.'
        : `Service chat with the organizer for ${input.title}.`,
      lastSenderId: input.ownerId || input.activeUserId,
      memberIds: memberIds.length > 0 ? memberIds : [input.activeUserId],
      unread: 0,
      dateIso: new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: input.notification ? 'notification' : 'event',
      eventId: input.eventId,
      ownerUserId: input.activeUserId
    };
  }

  async resolveRepositoryEventServiceChat(chat: ChatRecord): Promise<(ChatRecord & { ownerUserId?: string }) | null> {
    if (chat.channelType !== 'serviceEvent') {
      return null;
    }
    const eventId = `${chat.eventId ?? ''}`.trim();
    const activeUserId = this.resolveChatOwnerUserId(chat, eventId);
    if (!eventId || !activeUserId) {
      return null;
    }
    return this.resolveExistingEventServiceChat(
      await this.queryChatItemsByUser(activeUserId),
      {
        activeUserId,
        eventId,
        notification: chat.serviceContext === 'notification'
      }
    );
  }

  async queryActivitiesChatPage(
    userId: string,
    request: ActivitiesPageRequest,
    options: {
      chatItems?: readonly ChatRecord[];
      users?: readonly DemoUser[];
    } = {}
  ): Promise<PageResult<AppTypes.ActivityListRow>> {
    const users = options.users ?? this.usersService.peekCachedUsers();
    const page = await this.chatsService.queryActivitiesChatPage(userId, request, options.chatItems);

    return {
      items: buildActivityChatRows(page.items, {
        users,
        activeUserId: userId
      }),
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }

  private uniqueUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds.map(userId => userId.trim()).filter(Boolean))];
  }

  private resolveChatMemberIds(chat: Pick<ChatRecord, 'memberIds'>): string[] {
    return this.uniqueUserIds(chat.memberIds ?? []);
  }

  private buildChatHeaderThumbs(memberIds: readonly string[], maxVisible: number): AppTypes.PopupHeaderThumb[] {
    return memberIds.slice(0, Math.max(0, Math.trunc(maxVisible))).flatMap(memberId => {
      const user = this.usersService.peekCachedUserById(memberId);
      if (!user) {
        return [];
      }
      const label = user.name.trim() || memberId;
      return [{
        id: memberId,
        label,
        initials: user.initials.trim() || AppUtils.initialsFromText(label),
        imageUrl: AppUtils.firstImageUrl(user.images)
      }];
    });
  }

  private memberCountLabel(count: number): string {
    return count === 1 ? '1 member' : `${count} members`;
  }

  private chatHeaderRevision(chatId: string, title: string, memberIds: readonly string[]): string {
    return ['chat-header', chatId, title, ...memberIds].join(':');
  }

  private resolveChatOwnerUserId(chat: ChatRecord, eventId: string): string {
    const ownerUserId = `${(chat as { ownerUserId?: string | null }).ownerUserId ?? ''}`.trim();
    if (ownerUserId) {
      return ownerUserId;
    }
    const chatId = `${chat.id ?? ''}`.trim();
    const prefix = `c-service-event-${eventId}-`;
    return chatId.startsWith(prefix) ? chatId.slice(prefix.length).trim() : '';
  }

}

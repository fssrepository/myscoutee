import { Injectable, inject } from '@angular/core';

import type * as ContractTypes from '../../contracts';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesFeedFilters, ListQuery, PageResult } from '../../contracts';
import type { ChatDTO } from '../../contracts/chat.interface';
import type { IChatsService } from '../../contracts/activity.interface';

import { LocalChatsService } from '../../local';
import { HttpChatsService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { ActivityMembersService } from './activity-members.service';
import type * as ActivityContracts from '../../contracts/activity.interface';

type ChatMessagesLoadContext = {
  readReceipt?: ContractTypes.ChatReadReceipt | null;
};

@Injectable({
  providedIn: 'root'
})
export class ChatsService extends BaseRouteModeService implements IChatsService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly localChatsService = inject(LocalChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly activityMembersService = inject(ActivityMembersService);

  private get chatsService(): LocalChatsService | HttpChatsService {
    return this.resolveRouteService(ChatsService.CHAT_ROUTE, this.localChatsService, this.httpChatsService);
  }

  async loadChatMessagesResult(
    chat: ChatDTO,
    query: ListQuery = { page: 0, pageSize: Number.MAX_SAFE_INTEGER }
  ): Promise<PageResult<ContractTypes.ChatMessageDto, ChatMessagesLoadContext>> {
    const page = await this.queryChatMessagesPage(chat, query);
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      context: page.readReceipt ? { readReceipt: page.readReceipt } : undefined
    };
  }

  async queryChatMessagesPage(
    chat: ChatDTO,
    query: ListQuery
  ): Promise<ContractTypes.ChatMessagesPageResultDTO> {
    const page = await this.chatsService.queryChatMessagesPage(chat, query);
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      readReceipt: page.readReceipt ?? null
    };
  }

  async queryChatMemberEntries(chatId: string): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return [];
    }
    return this.chatsService.queryChatMembers(normalizedChatId);
  }

  async sendChatMessage(chat: ChatDTO, text: string, clientId?: string): Promise<ContractTypes.ChatMessageDto | null> {
    return this.chatsService.sendChatMessage(chat, text, clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatDTO,
    text: string,
    attachments: readonly ContractTypes.ChatMessageAttachment[],
    clientId?: string,
    replyTo?: ContractTypes.ChatMessageDto['replyTo']
  ): Promise<ContractTypes.ChatMessageDto | null> {
    return this.chatsService.sendChatMessageWithAttachments(chat, text, attachments, clientId, replyTo);
  }

  async updateChatMessage(
    chat: ChatDTO,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): Promise<ContractTypes.ChatMessageDto | null> {
    return this.chatsService.updateChatMessage(chat, messageId, mutation);
  }

  async watchChatMessages(
    chat: ChatDTO,
    onMessage: (message: ContractTypes.ChatMessageDto) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatMessages(chat, onMessage);
  }

  async watchChatEvents(
    chat: ChatDTO,
    onEvent: (event: ContractTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatEvents(chat, onEvent);
  }

  async sendChatTyping(chat: ChatDTO, typing: boolean): Promise<void> {
    return this.chatsService.sendChatTyping(chat, typing);
  }

  async markChatRead(chat: ChatDTO, messageIds: readonly string[]): Promise<ContractTypes.ChatReadReceipt | null> {
    return this.chatsService.markChatRead(chat, messageIds);
  }

  async updateSupportCase(chat: ChatDTO, action: ContractTypes.SupportCaseAction): Promise<ChatDTO | null> {
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
  }): Promise<ChatDTO | null> {
    const activeUserId = input.activeUserId.trim();
    const eventId = input.eventId.trim();
    const ownerId = input.ownerId.trim();
    const title = input.title.trim() || 'Event';
    if (!activeUserId || !eventId || !ownerId) {
      return null;
    }

    const existingChat = await this.resolveExistingEventServiceChat({
      activeUserId,
      eventId,
      notification: input.notification
    });
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

  private async resolveExistingEventServiceChat(
    input: {
      activeUserId: string;
      eventId: string;
      notification: boolean;
    }
  ): Promise<ChatDTO | null> {
    const expectedId = `c-service-event-${input.eventId}-${input.activeUserId}`;
    const expectedServiceContext = input.notification ? 'notification' : 'event';
    let cursor: string | null = null;
    do {
      const page = await this.queryActivitiesChatPage(input.activeUserId, {
        page: 0,
        pageSize: 25,
        cursor,
        sort: 'date',
        direction: 'desc',
        filters: { primaryFilter: 'chats', chatContextFilter: 'service' }
      });
      const match = page.items.find(chat => chat.id === expectedId)
        ?? page.items.find(chat =>
          chat.channelType === 'serviceEvent'
          && chat.serviceContext === expectedServiceContext
          && chat.ownerId === input.eventId
        );
      if (match) {
        return {
          ...match,
          memberIds: [...(match.memberIds ?? [])],
          members: (match.members ?? []).map(member => ({ ...member }))
        };
      }
      cursor = page.nextCursor ?? null;
    } while (cursor);
    return null;
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
  }): ChatDTO {
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
      ownerId: input.eventId,
      ownerUserId: input.activeUserId
    };
  }

  async queryActivitiesChatPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>
  ): Promise<PageResult<ChatDTO>> {
    const page = await this.chatsService.queryActivitiesChatPage(userId, query);
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }

  private uniqueUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds.map(userId => userId.trim()).filter(Boolean))];
  }

}

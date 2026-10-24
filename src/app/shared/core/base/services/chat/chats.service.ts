import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';

import type * as ContractTypes from '../../../contracts';
import { AppUtils } from '../../app-utils';
import type { ListQuery, PageResult } from '@fssrepository/myscoutee-components';
import type { ChatFeedFilters } from '../../../contracts';
import type {
  ChatDTO,
  ChatHeaderSyncResponseDTO,
  ChatServiceEnsureInput
} from '../../../contracts/chat/chat.interface';
import type { IChatsService } from '../../../contracts/common/activity.interface';

import { BaseRouteModeService } from '../platform/base-route-mode.service';
import { ActivityMembersService } from '../events/activity-members.service';
import { RouteDelayService } from '../platform/route-delay.service';
import type * as ActivityContracts from '../../../contracts/common/activity.interface';
import type { ChatCallRequest } from '../../../contracts/chat/chat-call.interface';

type ChatMessagesLoadContext = {
  readReceipt?: ContractTypes.ChatReadReceipt | null;
  notificationUnread?: number | null;
};

@Injectable({
  providedIn: 'root'
})
export class ChatsService extends BaseRouteModeService implements IChatsService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly localChatsService = this.transportAdapters.reference(LOCAL_ADAPTER.CHATS);
  private readonly httpChatsService = this.transportAdapters.reference(HTTP_ADAPTER.CHATS);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly routeDelay = inject(RouteDelayService);

  private get chatsService(): AdapterInstance<typeof LOCAL_ADAPTER.CHATS> | AdapterInstance<typeof HTTP_ADAPTER.CHATS> {
    return this.resolveRouteService(ChatsService.CHAT_ROUTE, this.localChatsService, this.httpChatsService);
  }

  async ensureContactChat(targetUserId: string): Promise<ChatDTO> {
    return this.chatsService.ensureContactChat(targetUserId);
  }

  async addContactChatMembers(chatId: string, userIds: readonly string[]): Promise<ChatDTO> {
    return this.chatsService.addContactChatMembers(chatId, userIds);
  }

  async queryChatById(chatId: string): Promise<ChatDTO | null> {
    return this.chatsService.queryChatById(chatId);
  }

  async loadChatMessagesResult(
    chat: ChatDTO,
    query?: ListQuery
  ): Promise<PageResult<ContractTypes.ChatMessageDto, ChatMessagesLoadContext>> {
    query ??= { page: 0, pageSize: Number.MAX_SAFE_INTEGER };
    const page = await this.queryChatMessagesPage(chat, query);
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      context: page.readReceipt || Number.isFinite(page.notificationUnread)
        ? {
            readReceipt: page.readReceipt ?? null,
            notificationUnread: page.notificationUnread ?? null
          }
        : undefined
    };
  }

  async queryChatSharedMessages(chat: ChatDTO, kind: 'event' | 'asset'): Promise<ContractTypes.ChatMessageDto[]> {
    return this.chatsService.queryChatSharedMessages(chat, kind);
  }

  async queryChatMessagesPage(
    chat: ChatDTO,
    query: ListQuery
  ): Promise<ContractTypes.ChatMessagesPageResultDTO> {
    const page = await this.routeDelay.withRequestTimeout(
      ChatsService.CHAT_ROUTE, this.chatsService.queryChatMessagesPage(chat, query)
    );
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      readReceipt: page.readReceipt ?? null,
      notificationUnread: page.notificationUnread ?? null
    };
  }

  async queryChatMemberEntries(chatId: string): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return [];
    }
    return this.chatsService.queryChatMembers(normalizedChatId);
  }

  async syncChatHeader(
    chatId: string,
    knownRevision: number,
    signal?: AbortSignal
  ): Promise<ChatHeaderSyncResponseDTO> {
    return this.chatsService.syncChatHeader(chatId, knownRevision, signal);
  }

  pollIntervalMs(): number {
    return this.routeDelay.resolveIntervalMs(ChatsService.CHAT_ROUTE, 30_000);
  }

  async queryChatMemberEntriesPage(
    chatId: string,
    query: ListQuery
  ): Promise<ActivityContracts.ActivityMembersPageResultDTO> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return { items: [], total: 0, nextCursor: null };
    }
    return this.chatsService.queryChatMembersPage(normalizedChatId, query);
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

  chatCallsSupported(): boolean {
    return !this.isLocalRouteEnabled(ChatsService.CHAT_ROUTE);
  }

  async sendChatCall(chat: ChatDTO, request: ChatCallRequest): Promise<void> {
    return this.chatsService.sendChatCall(chat, request);
  }

  async markChatRead(chat: ChatDTO, messageIds: readonly string[]): Promise<ContractTypes.ChatReadReceipt | null> {
    return this.chatsService.markChatRead(chat, messageIds);
  }

  async updateSupportCase(chat: ChatDTO, action: ContractTypes.SupportCaseAction): Promise<ChatDTO | null> {
    return this.chatsService.updateSupportCase(chat, action);
  }

  async ensureServiceChat(input: ChatServiceEnsureInput): Promise<ChatDTO | null> {
    return this.routeDelay.withRequestTimeout(
      ChatsService.CHAT_ROUTE, this.chatsService.ensureServiceChat(input)
    );
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
    const serviceChat = this.buildActivityServiceChat({
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
    if (input.notification) {
      return serviceChat;
    }
    return this.ensureServiceChat({
      serviceContext: 'event',
      eventId,
      targetUserId: ownerId,
      title: serviceChat.title,
      lastMessage: serviceChat.lastMessage,
      avatarSource: input.creatorName ?? title
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
    const chat = await this.chatsService.queryChatById(expectedId);
    if (
      chat?.channelType !== 'serviceEvent'
      || chat.serviceContext !== expectedServiceContext
      || chat.ownerId !== input.eventId
    ) {
      return null;
    }
    return {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])],
      members: (chat.members ?? []).map(member => ({ ...member }))
    };
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
    query: ListQuery<ChatFeedFilters>,
    signal?: AbortSignal
  ): Promise<PageResult<ChatDTO, {
    chats?: number;
    chatCounters?: ContractTypes.UserChatCountersDto;
  }>> {
    const page = await this.chatsService.queryActivitiesChatPage(userId, query, signal);
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      context: {
        chats: page.chats,
        chatCounters: page.chatCounters
      }
    };
  }

  private uniqueUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds.map(userId => userId.trim()).filter(Boolean))];
  }

}

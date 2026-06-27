import { Injectable, inject } from '@angular/core';

import type * as AppUiTypes from '../../../ui/models';
import type * as ContractTypes from '../../contracts';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesFeedFilters, ListQuery, PageResult } from '../../contracts';
import type { ChatDTO } from '../../contracts/chat.interface';
import type { IChatsService } from '../../contracts/activity.interface';

import { LocalChatsService } from '../../local';
import { HttpChatsService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { ActivityMembersService } from './activity-members.service';
import { UsersService } from './users.service';
import type * as ActivityContracts from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatsService extends BaseRouteModeService implements IChatsService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly localChatsService = inject(LocalChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly usersService = inject(UsersService);

  private get chatsService(): LocalChatsService | HttpChatsService {
    return this.resolveRouteService(ChatsService.CHAT_ROUTE, this.localChatsService, this.httpChatsService);
  }

  async queryChatItemsByUser(userId: string): Promise<ChatDTO[]> {
    return this.chatsService.queryChatItemsByUser(userId);
  }

  peekChatItemsByUser(userId: string): ChatDTO[] {
    return this.chatsService.peekChatItemsByUser(userId);
  }

  async loadChatMessages(chat: ChatDTO): Promise<ContractTypes.ChatPopupMessage[]> {
    return this.chatsService.loadChatMessages(chat);
  }

  async loadChatMessagesResult(
    chat: ChatDTO
  ): Promise<PageResult<ContractTypes.ChatPopupMessage, AppUiTypes.PopupHeaderContext>> {
    const items = await this.loadChatMessages(chat);
    return {
      items,
      total: items.length,
      context: this.buildChatPopupHeaderContext(chat, { includeThumbs: true })
    };
  }

  buildChatPopupHeaderContext(
    chat: ChatDTO,
    options: { includeThumbs?: boolean } = {}
  ): AppUiTypes.PopupHeaderContext {
    const chatId = `${chat.id ?? ''}`.trim();
    const title = `${chat.title ?? ''}`.trim() || 'Chat';
    const memberIds = this.resolveChatMemberIds(chat);
    const controls: AppUiTypes.PopupHeaderControl[] = [];
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

  async queryChatMemberEntries(chatId: string): Promise<ActivityContracts.ActivityMemberEntry[]> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return [];
    }
    return this.chatsService.queryChatMembers(normalizedChatId);
  }

  async sendChatMessage(chat: ChatDTO, text: string, clientId?: string): Promise<ContractTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessage(chat, text, clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatDTO,
    text: string,
    attachments: readonly ContractTypes.ChatMessageAttachment[],
    clientId?: string,
    replyTo?: ContractTypes.ChatPopupMessage['replyTo']
  ): Promise<ContractTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessageWithAttachments(chat, text, attachments, clientId, replyTo);
  }

  async updateChatMessage(
    chat: ChatDTO,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): Promise<ContractTypes.ChatPopupMessage | null> {
    return this.chatsService.updateChatMessage(chat, messageId, mutation);
  }

  async watchChatMessages(
    chat: ChatDTO,
    onMessage: (message: ContractTypes.ChatPopupMessage) => void
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

  async markChatRead(chat: ChatDTO, messageIds: readonly string[]): Promise<void> {
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
    chats: readonly ChatDTO[],
    input: {
      activeUserId: string;
      eventId: string;
      notification: boolean;
    }
  ): ChatDTO | null {
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
      eventId: input.eventId,
      ownerUserId: input.activeUserId
    };
  }

  async resolveRepositoryEventServiceChat(chat: ChatDTO): Promise<ChatDTO | null> {
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
    query: ListQuery<ActivitiesFeedFilters>,
    options: {
      chatItems?: readonly ChatDTO[];
    } = {}
  ): Promise<PageResult<ChatDTO>> {
    const page = await this.chatsService.queryActivitiesChatPage(userId, query, options);
    return {
      items: page.items,
      total: page.total,
      nextCursor: page.nextCursor ?? null
    };
  }

  private uniqueUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds.map(userId => userId.trim()).filter(Boolean))];
  }

  private resolveChatMemberIds(chat: Pick<ChatDTO, 'memberIds'>): string[] {
    return this.uniqueUserIds(chat.memberIds ?? []);
  }

  private buildChatHeaderThumbs(memberIds: readonly string[], maxVisible: number): AppUiTypes.PopupHeaderThumb[] {
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

  private resolveChatOwnerUserId(chat: ChatDTO, eventId: string): string {
    const ownerUserId = `${(chat as { ownerUserId?: string | null }).ownerUserId ?? ''}`.trim();
    if (ownerUserId) {
      return ownerUserId;
    }
    const chatId = `${chat.id ?? ''}`.trim();
    const prefix = `c-service-event-${eventId}-`;
    return chatId.startsWith(prefix) ? chatId.slice(prefix.length).trim() : '';
  }

}

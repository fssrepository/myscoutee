import type { ChatThreadRecord } from '../entity/chat.entity';
import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../base/models';
import { AppUtils } from '../../../../app-utils';
import type { ChatRecord } from '../../../base/models/chat.model';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalUsersRepository } from '../repositories/users.repository';

import type * as ActivityContracts from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalChatsService extends LocalRouteDelayService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);

  async queryChatItemsByUser(userId: string): Promise<ChatThreadRecord[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  async querySupportCaseItemsForAdmin(
    userId: string,
    filter: AppTypes.SupportCaseFilter = 'all'
  ): Promise<ChatThreadRecord[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.querySupportCaseItemsForAdmin(userId, filter);
  }

  async queryActivitiesChatPage(
    userId: string,
    request: AppTypes.ActivitiesPageRequest,
    _cachedChatItems: readonly ChatRecord[] = []
  ): Promise<{ items: ChatThreadRecord[]; total: number; nextCursor?: string | null }> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryActivitiesChatPage(this.resolveDemoActivityUserId(userId), request);
  }

  peekChatItemsByUser(userId: string): ChatThreadRecord[] {
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  async loadChatMessages(chat: ChatRecord): Promise<AppTypes.ChatPopupMessage[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMessages(chat);
  }

  async queryChatMembers(chatId: string): Promise<ActivityContracts.ActivityMemberEntry[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMembers(chatId);
  }

  async sendChatMessage(chat: ChatRecord, text: string, clientId?: string): Promise<AppTypes.ChatPopupMessage | null> {
    return this.sendChatMessageWithAttachments(chat, text, [], clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatRecord,
    text: string,
    attachments: readonly AppTypes.ChatMessageAttachment[] = [],
    clientId?: string,
    replyTo?: AppTypes.ChatPopupMessage['replyTo']
  ): Promise<AppTypes.ChatPopupMessage | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) {
      return null;
    }
    const sentAt = new Date();
    return this.chatsRepository.appendChatMessage(chat, {
      id: `${clientId ?? `${chat.id}:${sentAt.getTime()}`}`,
      sender: 'You',
      senderAvatar: {
        id: 'self',
        initials: 'ME',
        gender: 'man'
      },
      text: trimmedText,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      mine: true,
      readBy: [],
      clientId: `${clientId ?? ''}`.trim() || undefined,
      replyTo: replyTo ? { ...replyTo } : null,
      attachments: attachments.map(attachment => ({ ...attachment }))
    });
  }

  async updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: AppTypes.ChatMessageMutation
  ): Promise<AppTypes.ChatPopupMessage | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.updateChatMessage(chat, messageId, mutation);
  }

  async watchChatMessages(
    _chat: ChatRecord,
    _onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return () => {};
  }

  async watchChatEvents(
    _chat: ChatRecord,
    _onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return () => {};
  }

  async sendChatTyping(_chat: ChatRecord, _typing: boolean): Promise<void> {
    return;
  }

  async markChatRead(_chat: ChatRecord, _messageIds: readonly string[]): Promise<void> {
    return;
  }

  async updateSupportCase(chat: ChatRecord, action: AppTypes.SupportCaseAction): Promise<ChatThreadRecord | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.updateSupportCase(chat, action);
  }

  private resolveDemoActivityUserId(userId: string): string {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return normalizedUserId;
    }
    return this.usersRepository.queryAllUsers()[0]?.id ?? '';
  }
}

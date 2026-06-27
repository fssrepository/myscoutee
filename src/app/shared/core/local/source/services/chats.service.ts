import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../base/models';
import type * as ContractTypes from '../../../contracts';
import { AppUtils } from '../../../../app-utils';
import type { ActivitiesChatPageResultDTO, ChatDTO } from '../../../contracts/chat.interface';
import type { IChatsService } from '../../../contracts/activity.interface';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalChatThreadMapper } from '../mappers';

import type * as ActivityContracts from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalChatsService extends LocalRouteDelayService implements IChatsService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);

  async queryChatItemsByUser(userId: string): Promise<ChatDTO[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return LocalChatThreadMapper.toDtoList(this.chatsRepository.queryChatItemsByUser(userId));
  }

  async querySupportCaseItemsForAdmin(
    userId: string,
    filter: ContractTypes.SupportCaseFilter = 'all'
  ): Promise<ChatDTO[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return LocalChatThreadMapper.toDtoList(this.chatsRepository.querySupportCaseItemsForAdmin(userId, filter));
  }

  async queryActivitiesChatPage(
    userId: string,
    request: ContractTypes.ActivitiesPageRequest,
    _options: { chatItems?: readonly ChatDTO[] } = {}
  ): Promise<ActivitiesChatPageResultDTO> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return LocalChatThreadMapper.toDtoPage(
      this.chatsRepository.queryActivitiesChatPage(this.resolveDemoActivityUserId(userId), request)
    );
  }

  peekChatItemsByUser(userId: string): ChatDTO[] {
    return LocalChatThreadMapper.toDtoList(this.chatsRepository.queryChatItemsByUser(userId));
  }

  async loadChatMessages(chat: ChatDTO): Promise<ContractTypes.ChatPopupMessage[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMessages(chat);
  }

  async queryChatMembers(chatId: string): Promise<ActivityContracts.ActivityMemberEntry[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMembers(chatId);
  }

  async sendChatMessage(chat: ChatDTO, text: string, clientId?: string): Promise<ContractTypes.ChatPopupMessage | null> {
    return this.sendChatMessageWithAttachments(chat, text, [], clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatDTO,
    text: string,
    attachments: readonly ContractTypes.ChatMessageAttachment[] = [],
    clientId?: string,
    replyTo?: ContractTypes.ChatPopupMessage['replyTo']
  ): Promise<ContractTypes.ChatPopupMessage | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const trimmedText = AppUtils.convertAsciiEmojis(text.trim());
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
    chat: ChatDTO,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): Promise<ContractTypes.ChatPopupMessage | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const normalizedMutation = typeof mutation.text === 'string'
      ? {
          ...mutation,
          text: AppUtils.convertAsciiEmojis(mutation.text.trim())
        }
      : mutation;
    return this.chatsRepository.updateChatMessage(chat, messageId, normalizedMutation);
  }

  async watchChatMessages(
    _chat: ChatDTO,
    _onMessage: (message: ContractTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return () => {};
  }

  async watchChatEvents(
    _chat: ChatDTO,
    _onEvent: (event: ContractTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return () => {};
  }

  async sendChatTyping(_chat: ChatDTO, _typing: boolean): Promise<void> {
    return;
  }

  async markChatRead(_chat: ChatDTO, _messageIds: readonly string[]): Promise<void> {
    return;
  }

  async updateSupportCase(chat: ChatDTO, action: ContractTypes.SupportCaseAction): Promise<ChatDTO | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const record = this.chatsRepository.updateSupportCase(chat, action);
    return record ? LocalChatThreadMapper.toDto(record) : null;
  }

  private resolveDemoActivityUserId(userId: string): string {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return normalizedUserId;
    }
    return this.usersRepository.queryAllUsers()[0]?.id ?? '';
  }
}

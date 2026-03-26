import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoChatsRepository } from '../repositories/chats.repository';
import type { DemoChatRecord } from '../models/chats.model';

@Injectable({
  providedIn: 'root'
})
export class DemoChatsService extends DemoRouteDelayService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly chatsRepository = inject(DemoChatsRepository);

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    await this.waitForRouteDelay(DemoChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  peekChatItemsByUser(userId: string): DemoChatRecord[] {
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  async loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    await this.waitForRouteDelay(DemoChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMessages(chat);
  }

  async sendChatMessage(chat: ChatMenuItem, text: string): Promise<AppTypes.ChatPopupMessage | null> {
    await this.waitForRouteDelay(DemoChatsService.CHAT_ROUTE);
    const trimmedText = text.trim();
    if (!trimmedText) {
      return null;
    }
    const sentAt = new Date();
    return this.chatsRepository.appendChatMessage(chat, {
      id: `${chat.id}:${sentAt.getTime()}`,
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
      readBy: []
    });
  }

  async watchChatMessages(
    _chat: ChatMenuItem,
    _onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return () => {};
  }

  async watchChatEvents(
    _chat: ChatMenuItem,
    _onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return () => {};
  }

  async sendChatTyping(_chat: ChatMenuItem, _typing: boolean): Promise<void> {
    return;
  }

  async markChatRead(_chat: ChatMenuItem, _messageIds: readonly string[]): Promise<void> {
    return;
  }
}

import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoChatsRepository } from '../repositories/chats.repository';
import type { DemoChatRecord } from '../models/chats.model';

@Injectable({
  providedIn: 'root'
})
export class DemoChatsService extends DemoRouteDelayService {
  private static readonly CHATS_ROUTE = '/activities/chats';
  private readonly chatsRepository = inject(DemoChatsRepository);

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    await this.waitForRouteDelay(DemoChatsService.CHATS_ROUTE);
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  peekChatItemsByUser(userId: string): DemoChatRecord[] {
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  async loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    await this.waitForRouteDelay(DemoChatsService.CHATS_ROUTE);
    return this.chatsRepository.queryChatMessages(chat);
  }

}

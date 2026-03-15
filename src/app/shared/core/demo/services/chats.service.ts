import { Injectable, inject } from '@angular/core';

import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoChatsRepository } from '../repositories/chats.repository';
import type { DemoChatRecord } from '../models/chats.model';

@Injectable({
  providedIn: 'root'
})
export class DemoChatsService {
  private static readonly CHATS_ROUTE = '/activities/chats';
  private readonly chatsRepository = inject(DemoChatsRepository);

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    await this.waitForRouteDelay(DemoChatsService.CHATS_ROUTE);
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  private async waitForRouteDelay(route: string): Promise<void> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(route);
    if (additionalDelayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), additionalDelayMs);
    });
  }
}

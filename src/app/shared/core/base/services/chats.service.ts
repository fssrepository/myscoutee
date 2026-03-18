import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { DemoChatRecord } from '../../demo/models/chats.model';
import { DemoChatsService } from '../../demo';
import { HttpChatsService } from '../../http';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class ChatsService {
  private readonly demoChatsService = inject(DemoChatsService);
  private readonly httpChatsService = inject(HttpChatsService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get chatsService(): DemoChatsService | HttpChatsService {
    return this.demoModeEnabled ? this.demoChatsService : this.httpChatsService;
  }

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    return this.chatsService.queryChatItemsByUser(userId);
  }
}

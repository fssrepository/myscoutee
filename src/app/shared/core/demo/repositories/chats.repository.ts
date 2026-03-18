import { Injectable, inject } from '@angular/core';

import { DEMO_CHAT_BY_USER } from '../../../demo-data';
import { AppMemoryDb } from '../../base/db';
import { DemoChatsRepositoryBuilder } from '../builders';
import { CHATS_TABLE_NAME, type DemoChatRecord } from '../models/chats.model';

@Injectable({
  providedIn: 'root'
})
export class DemoChatsRepository {
  private readonly memoryDb = inject(AppMemoryDb);
  private initialized = false;

  init(): void {
    if (this.initialized) {
      return;
    }
    const state = this.memoryDb.read();
    if (state[CHATS_TABLE_NAME].ids.length > 0) {
      this.initialized = true;
      return;
    }
    const records = DemoChatsRepositoryBuilder.buildRecordCollection(DEMO_CHAT_BY_USER);
    this.memoryDb.write(currentState => ({
      ...currentState,
      [CHATS_TABLE_NAME]: records
    }));
    this.initialized = true;
  }

  queryChatItemsByUser(userId: string): DemoChatRecord[] {
    this.init();
    return this.queryUserRecords(userId);
  }

  private queryUserRecords(userId: string): DemoChatRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoChatRecord => Boolean(record))
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => DemoChatsRepositoryBuilder.cloneRecord(record));
  }
}

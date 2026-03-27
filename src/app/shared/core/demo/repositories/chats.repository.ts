import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import { AppMemoryDb } from '../../base/db';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
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
      const needsMigration = state[CHATS_TABLE_NAME].ids.some(id => {
        const record = state[CHATS_TABLE_NAME].byId[id];
        return !record
          || !AppUtils.hasText(record.dateIso ?? '')
          || !Array.isArray(record.messages);
      });
      if (!needsMigration) {
        this.initialized = true;
        return;
      }
    }
    const records = DemoChatsRepositoryBuilder.buildSeedRecordCollection();
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

  seedContextualRecordsForUser(userId: string, eventRecords: readonly import('../models/events.model').DemoEventRecord[]): boolean {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const seeded = DemoChatsRepositoryBuilder.buildContextualRecordCollectionForUser(normalizedUserId, eventRecords);
    if (seeded.ids.length === 0) {
      return false;
    }
    const currentTable = this.memoryDb.read()[CHATS_TABLE_NAME];
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    let changed = false;
    for (const id of seeded.ids) {
      const seededRecord = seeded.byId[id];
      if (!seededRecord) {
        continue;
      }
      const existing = currentTable.byId[id];
      if (existing && Array.isArray(existing.messages) && existing.messages.length > 0) {
        continue;
      }
      nextById[id] = DemoChatsRepositoryBuilder.cloneRecord(seededRecord);
      if (!existing) {
        nextIds.push(id);
      }
      changed = true;
    }
    if (!changed) {
      return false;
    }
    this.memoryDb.write(currentState => ({
      ...currentState,
      [CHATS_TABLE_NAME]: {
        byId: nextById,
        ids: nextIds
      }
    }));
    return true;
  }

  queryChatMessages(chat: ChatMenuItem): AppTypes.ChatPopupMessage[] {
    this.init();
    const record = this.resolveChatRecord(chat);
    return record ? DemoChatsRepositoryBuilder.cloneMessages(record.messages ?? []) : [];
  }

  appendChatMessage(chat: ChatMenuItem, message: AppTypes.ChatPopupMessage): AppTypes.ChatPopupMessage | null {
    this.init();
    const record = this.resolveChatRecord(chat);
    if (!record) {
      return null;
    }
    const messageClone = DemoChatsRepositoryBuilder.cloneMessages([message])[0] ?? null;
    if (!messageClone) {
      return null;
    }
    const recordKey = DemoChatsRepositoryBuilder.buildRecordKey(record.ownerUserId, record.id);
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          ...currentTable,
          byId: {
            ...currentTable.byId,
            [recordKey]: {
              ...existingRecord,
              lastMessage: messageClone.text,
              lastSenderId: messageClone.senderAvatar.id,
              dateIso: messageClone.sentAtIso,
              messages: [
                ...DemoChatsRepositoryBuilder.cloneMessages(existingRecord.messages ?? []),
                messageClone
              ]
            }
          }
        }
      };
    });
    return messageClone;
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
      .map(record => DemoChatsRepositoryBuilder.cloneRecord(record, { includeMessages: false }));
  }

  private resolveChatRecord(chat: ChatMenuItem): DemoChatRecord | null {
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!sourceId) {
      return null;
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    const ownerUserId = typeof (chat as { ownerUserId?: unknown }).ownerUserId === 'string'
      ? `${(chat as { ownerUserId?: string }).ownerUserId ?? ''}`.trim()
      : '';
    if (ownerUserId) {
      const record = table.byId[DemoChatsRepositoryBuilder.buildRecordKey(ownerUserId, sourceId)];
      if (record) {
        return record;
      }
    }
    const matchId = table.ids.find(id => table.byId[id]?.id === sourceId);
    return matchId ? table.byId[matchId] ?? null : null;
  }
}

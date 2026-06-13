import { CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import type { ChatThreadRecord } from '../../source/entity/chat.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { UserProfileStateBuilder } from '../../../base/builders';
import { ChatThreadBuilder } from '../../common/builders';
import { LocalMemoryDb } from '../../../base/db';
import type { ChatPopupMessage, ChatRecord } from '../../../base/models/chat.model';

import type { ActivityEventRecord } from '../../../base/models/events.model';

import { SeedChatsBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedChatsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  seedDefaults(): void {
    if (this.initialized) {
      return;
    }
    const state = this.memoryDb.read();
    if (state[CHATS_TABLE_NAME].ids.length > 0) {
      const needsMigration = state[CHATS_TABLE_NAME].ids.some(id => {
        const record = state[CHATS_TABLE_NAME].byId[id];
        return !record
          || !AppUtils.hasText(record.dateIso ?? '')
          || !Array.isArray(record.messages)
          || (this.isSupportCaseRecord(record) && record.messages.length === 0)
          || this.supportCaseRecordNeedsAvatarRefresh(record);
      });
      if (!needsMigration) {
        this.initialized = true;
        return;
      }
    }
    const records = SeedChatsBuilder.buildSeedRecordCollection();
    this.memoryDb.write(currentState => ({
      ...currentState,
      [CHATS_TABLE_NAME]: records
    }));
    this.initialized = true;
  }

  seedContextualRecordsForUser(userId: string, eventRecords: readonly ActivityEventRecord[]): boolean {
    this.seedDefaults();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return false;
    }
    const seeded = SeedChatsBuilder.buildContextualRecordCollectionForUser(normalizedUserId, eventRecords);
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
      nextById[id] = ChatThreadBuilder.cloneRecord(seededRecord);
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

  queryChatItemsByUser(userId: string): ChatThreadRecord[] {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ChatThreadRecord => Boolean(record))
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => ChatThreadBuilder.cloneRecord(record, { includeMessages: false }));
  }

  queryChatMessages(chat: ChatRecord): ChatPopupMessage[] {
    const record = this.resolveChatRecord(chat, { createServiceChat: false });
    return record ? ChatThreadBuilder.cloneMessages(record.messages ?? []) : [];
  }

  appendChatMessage(chat: ChatRecord, message: ChatPopupMessage): ChatPopupMessage | null {
    const record = this.resolveChatRecord(chat);
    if (!record) {
      return null;
    }
    const messageClone = ChatThreadBuilder.cloneMessages([message])[0] ?? null;
    if (!messageClone) {
      return null;
    }
    const recordKey = ChatThreadBuilder.buildRecordKey(record.ownerUserId, record.id);
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
              lastMessage: messageClone.text || this.chatAttachmentSummary(messageClone),
              lastSenderId: messageClone.senderAvatar.id,
              dateIso: messageClone.sentAtIso,
              messages: [
                ...ChatThreadBuilder.cloneMessages(existingRecord.messages ?? []),
                messageClone
              ]
            }
          }
        }
      };
    });
    return messageClone;
  }

  updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: { attachments: ChatPopupMessage['attachments'] }
  ): ChatPopupMessage | null {
    const record = this.resolveChatRecord(chat, { createServiceChat: false });
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!record || !normalizedMessageId) {
      return null;
    }
    const recordKey = ChatThreadBuilder.buildRecordKey(record.ownerUserId, record.id);
    let updatedMessage: ChatPopupMessage | null = null;
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      const nextMessages = ChatThreadBuilder.cloneMessages(existingRecord.messages ?? []).map(message => {
        if (message.id !== normalizedMessageId) {
          return message;
        }
        updatedMessage = {
          ...message,
          attachments: mutation.attachments?.map(attachment => ({ ...attachment })) ?? []
        };
        return updatedMessage;
      });
      if (!updatedMessage) {
        return currentState;
      }
      const latest = nextMessages[nextMessages.length - 1] ?? null;
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          ...currentTable,
          byId: {
            ...currentTable.byId,
            [recordKey]: {
              ...existingRecord,
              lastMessage: latest
                ? (latest.text || this.chatAttachmentSummary(latest))
                : existingRecord.lastMessage,
              lastSenderId: latest?.senderAvatar.id ?? existingRecord.lastSenderId,
              dateIso: latest?.sentAtIso ?? existingRecord.dateIso,
              messages: nextMessages
            }
          }
        }
      };
    });
    return updatedMessage ? ChatThreadBuilder.cloneMessages([updatedMessage])[0] ?? null : null;
  }

  private isSupportCaseRecord(record: ChatRecord): boolean {
    return `${record.id ?? ''}`.trim().startsWith('c-support-admin-') || Boolean(record.supportCaseStatus);
  }

  private resolveChatRecord(
    chat: ChatRecord,
    options: { createServiceChat?: boolean } = {}
  ): ChatThreadRecord | null {
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!sourceId) {
      return null;
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    const ownerUserId = typeof (chat as { ownerUserId?: unknown }).ownerUserId === 'string'
      ? `${(chat as { ownerUserId?: string }).ownerUserId ?? ''}`.trim()
      : '';
    if (ownerUserId) {
      const record = table.byId[ChatThreadBuilder.buildRecordKey(ownerUserId, sourceId)];
      if (record) {
        return record;
      }
      if (options.createServiceChat !== false && chat.channelType === 'serviceEvent') {
        return this.createServiceChatRecord(ownerUserId, chat);
      }
    }
    const matchId = table.ids.find(id => table.byId[id]?.id === sourceId);
    if (matchId) {
      return table.byId[matchId] ?? null;
    }
    if (options.createServiceChat !== false && chat.channelType === 'serviceEvent') {
      const fallbackOwnerUserId = (chat.memberIds ?? [])[0]?.trim() ?? '';
      return fallbackOwnerUserId ? this.createServiceChatRecord(fallbackOwnerUserId, chat) : null;
    }
    return null;
  }

  private createServiceChatRecord(ownerUserId: string, chat: ChatRecord): ChatThreadRecord | null {
    const normalizedOwnerUserId = `${ownerUserId ?? ''}`.trim();
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!normalizedOwnerUserId || !sourceId) {
      return null;
    }
    const recordKey = ChatThreadBuilder.buildRecordKey(normalizedOwnerUserId, sourceId);
    const existing = this.memoryDb.read()[CHATS_TABLE_NAME].byId[recordKey];
    if (existing) {
      return existing;
    }
    const record: ChatThreadRecord = {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])],
      ownerUserId: normalizedOwnerUserId,
      dateIso: chat.dateIso ?? new Date().toISOString(),
      messages: []
    };
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      if (currentTable.byId[recordKey]) {
        return currentState;
      }
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          byId: {
            ...currentTable.byId,
            [recordKey]: record
          },
          ids: [...currentTable.ids, recordKey]
        }
      };
    });
    return record;
  }

  private chatAttachmentSummary(message: ChatPopupMessage): string {
    const firstAttachment = message.attachments?.[0];
    if (!firstAttachment) {
      return '';
    }
    if (firstAttachment.type === 'image') {
      return 'Sent an image';
    }
    if (firstAttachment.type === 'event') {
      return 'Shared an event';
    }
    if (firstAttachment.type === 'asset') {
      return 'Shared an asset';
    }
    return firstAttachment.title || 'Shared an attachment';
  }

  private supportCaseRecordNeedsAvatarRefresh(record: ChatThreadRecord): boolean {
    if (!this.isSupportCaseRecord(record) || !Array.isArray(record.messages) || record.messages.length === 0) {
      return false;
    }
    return record.messages.some(message => {
      const senderId = `${message.senderAvatar?.id ?? ''}`.trim();
      const imageUrl = `${message.senderAvatar?.imageUrl ?? ''}`.trim();
      return senderId.length > 0 && senderId !== 'deleted' && imageUrl.length === 0;
    });
  }

  private isSetupRequiredDemoProfile(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId] ?? null;
    return user
      ? UserProfileStateBuilder.isEmptyOnboardingProfile(user)
      : UserProfileStateBuilder.isEmptyOnboardingProfileUserId(normalizedUserId);
  }
}

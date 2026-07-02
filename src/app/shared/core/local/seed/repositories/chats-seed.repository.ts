import { CHAT_MESSAGES_TABLE_NAME, CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import type { ChatMessageRecord, ChatRecord, ChatThreadRecord } from '../../source/entity/chat.entity';
import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import type { AppMemorySchema } from '../../common/memory.schema';
import { LocalChatMessageMapper, LocalChatThreadMapper } from '../../source/mappers';
import { LocalMemoryDb } from '../../../common/app.db';
import type { ChatMessageDto, ChatReadAvatar } from '../../../contracts/chat.interface';

import type { ActivityEventRecord } from '../../../contracts/activity.interface';

import { SeedChatsBuilder } from '../builders';
import type { SeedChatRecordCollection } from '../builders/chats-seed.builder';

@Injectable({
  providedIn: 'root'
})
export class SeedChatsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;
  private seedRecords: SeedChatRecordCollection | null = null;

  seedDefaults(): void {
    if (this.initialized) {
      return;
    }
    const records = SeedChatsBuilder.buildSeedRecordCollection();
    this.seedRecords = this.cloneSeedRecords(records);
    this.memoryDb.write(currentState => ({
      ...currentState,
      [CHATS_TABLE_NAME]: records.chats,
      [CHAT_MESSAGES_TABLE_NAME]: records.chatMessages
    }));
    this.initialized = true;
  }

  seedContextualRecordsForUser(userId: string, eventRecords: readonly ActivityEventRecord[]): boolean {
    this.seedDefaults();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const seeded = SeedChatsBuilder.buildContextualRecordCollectionForUser(normalizedUserId, eventRecords);
    if (seeded.chats.ids.length === 0) {
      return false;
    }
    this.mergeSeedRecords(seeded);
    this.memoryDb.write(currentState => ({
      ...currentState,
      [CHATS_TABLE_NAME]: this.mergeChatTable(currentState[CHATS_TABLE_NAME], seeded.chats),
      [CHAT_MESSAGES_TABLE_NAME]: this.mergeChatMessagesTable(currentState[CHAT_MESSAGES_TABLE_NAME], seeded.chatMessages)
    }));
    return true;
  }

  seedChatMessages(chat: ChatRecord & { ownerUserId?: string }, messages: readonly ChatMessageDto[]): void {
    const ownerUserId = `${chat.ownerUserId ?? ''}`.trim();
    const chatId = `${chat.id ?? ''}`.trim();
    if (!ownerUserId || !chatId || messages.length === 0) {
      return;
    }
    const normalizedMessages = this.applySeedUnreadState(chat, ownerUserId, messages);
    const unread = this.countUnreadMessages(normalizedMessages, ownerUserId);
    const messageRecords = normalizedMessages.map(message => LocalChatMessageMapper.toRecord(ownerUserId, chatId, message));
    const latest = [...normalizedMessages].sort((left, right) =>
      AppUtils.toSortableDate(right.sentAtIso) - AppUtils.toSortableDate(left.sentAtIso)
      || `${right.id ?? ''}`.localeCompare(`${left.id ?? ''}`)
    )[0] ?? null;
    const recordKey = LocalChatThreadMapper.buildRecordKey(ownerUserId, chatId);
    const chatRecord: ChatThreadRecord = {
      ...chat,
      id: chatId,
      memberIds: [...(chat.memberIds ?? [])],
      unread,
      lastMessage: latest ? (latest.text || this.chatAttachmentSummary(latest) || chat.lastMessage) : chat.lastMessage,
      lastSenderId: latest?.senderAvatar.id ?? chat.lastSenderId,
      dateIso: latest?.sentAtIso ?? chat.dateIso,
      ownerUserId
    };
    const records: SeedChatRecordCollection = {
      chats: {
        byId: {
          [recordKey]: chatRecord
        },
        ids: [recordKey]
      },
      chatMessages: {
        byId: Object.fromEntries(messageRecords.map(message => [message.recordId, message])),
        ids: messageRecords.map(message => message.recordId),
        idsByChatKey: {
          [LocalChatMessageMapper.chatKey(ownerUserId, chatId)]: messageRecords.map(message => message.recordId)
        }
      }
    };
    this.mergeSeedRecords(records);
    this.memoryDb.write(currentState => ({
      ...currentState,
      [CHATS_TABLE_NAME]: this.mergeChatTable(currentState[CHATS_TABLE_NAME], records.chats),
      [CHAT_MESSAGES_TABLE_NAME]: this.mergeChatMessagesTable(currentState[CHAT_MESSAGES_TABLE_NAME], records.chatMessages)
    }));
  }

  private applySeedUnreadState(
    chat: ChatRecord,
    ownerUserId: string,
    messages: readonly ChatMessageDto[]
  ): ChatMessageDto[] {
    const unreadTarget = Math.max(0, Math.trunc(Number(chat.unread) || 0));
    const incomingIndexes = messages
      .map((message, index) => ({ message, index }))
      .filter(entry => !entry.message.mine && `${entry.message.senderAvatar?.id ?? ''}`.trim() !== ownerUserId)
      .sort((left, right) =>
        AppUtils.toSortableDate(right.message.sentAtIso) - AppUtils.toSortableDate(left.message.sentAtIso)
        || `${right.message.id ?? ''}`.localeCompare(`${left.message.id ?? ''}`)
      )
      .map(entry => entry.index);
    const unreadIndexes = new Set(incomingIndexes.slice(0, unreadTarget));
    const reader = this.seedReader(ownerUserId, messages);
    return messages.map((message, index) => {
      if (message.mine || `${message.senderAvatar?.id ?? ''}`.trim() === ownerUserId) {
        return message;
      }
      return unreadIndexes.has(index)
        ? this.withoutMessageReader(message, ownerUserId)
        : this.withMessageReader(message, reader);
    });
  }

  private seedReader(ownerUserId: string, messages: readonly ChatMessageDto[]): ChatReadAvatar {
    const avatar = messages
      .map(message => message.senderAvatar)
      .find(candidate => `${candidate?.id ?? ''}`.trim() === ownerUserId)
      ?? messages
        .flatMap(message => message.readBy ?? [])
        .find(candidate => `${candidate?.id ?? ''}`.trim() === ownerUserId)
      ?? null;
    return {
      id: ownerUserId,
      initials: `${avatar?.initials ?? ''}`.trim() || AppUtils.initialsFromText(ownerUserId),
      gender: avatar?.gender ?? 'man',
      imageUrl: avatar?.imageUrl ?? null
    };
  }

  private withoutMessageReader(message: ChatMessageDto, ownerUserId: string): ChatMessageDto {
    const readBy = (message.readBy ?? []).filter(reader => `${reader.id ?? ''}`.trim() !== ownerUserId);
    return readBy.length === (message.readBy ?? []).length
      ? message
      : {
          ...message,
          readBy
        };
  }

  private withMessageReader(message: ChatMessageDto, reader: ChatReadAvatar): ChatMessageDto {
    if ((message.readBy ?? []).some(entry => `${entry.id ?? ''}`.trim() === reader.id)) {
      return message;
    }
    return {
      ...message,
      readBy: [...(message.readBy ?? []), reader]
    };
  }

  private countUnreadMessages(messages: readonly ChatMessageDto[], ownerUserId: string): number {
    return messages.filter(message =>
      !message.mine
      && `${message.senderAvatar?.id ?? ''}`.trim() !== ownerUserId
      && !(message.readBy ?? []).some(reader => `${reader.id ?? ''}`.trim() === ownerUserId)
    ).length;
  }

  queryChatItemsByUser(userId: string): ChatThreadRecord[] {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.seedRecords?.chats;
    if (!table) {
      return [];
    }
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ChatThreadRecord => Boolean(record))
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => LocalChatThreadMapper.cloneRecord(record));
  }

  queryChatMessages(chat: ChatRecord): ChatMessageDto[] {
    const ownerUserId = typeof (chat as { ownerUserId?: unknown }).ownerUserId === 'string'
      ? `${(chat as { ownerUserId?: string }).ownerUserId ?? ''}`.trim()
      : '';
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!ownerUserId || !sourceId || !this.seedRecords) {
      return [];
    }
    const record = this.seedRecords.chats.byId[LocalChatThreadMapper.buildRecordKey(ownerUserId, sourceId)];
    return record ? LocalChatMessageMapper.toDtoList(this.selectChatMessageRecordsFromSnapshot(this.seedRecords.chatMessages, record)) : [];
  }

  private selectChatMessageRecordsFromSnapshot(
    snapshot: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME],
    chat: ChatThreadRecord
  ): ChatMessageRecord[] {
    const chatKey = LocalChatMessageMapper.chatKey(chat.ownerUserId, chat.id);
    const ids = snapshot.idsByChatKey[chatKey] ?? snapshot.ids.filter(id => {
      const record = snapshot.byId[id];
      return record?.ownerUserId === chat.ownerUserId && record?.chatId === chat.id;
    });
    return ids
      .map(id => snapshot.byId[id])
      .filter((record): record is ChatMessageRecord => Boolean(record))
      .sort((left, right) => AppUtils.toSortableDate(left.sentAtIso) - AppUtils.toSortableDate(right.sentAtIso)
        || `${left.messageId ?? ''}`.localeCompare(`${right.messageId ?? ''}`));
  }

  private upsertMessageRecord(
    table: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME],
    message: ChatMessageRecord
  ): AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME] {
    if (!message.recordId) {
      return table;
    }
    const chatKey = LocalChatMessageMapper.chatKey(message.ownerUserId, message.chatId);
    const nextById = {
      ...table.byId,
      [message.recordId]: message
    };
    const nextIds = table.ids.includes(message.recordId)
      ? [...table.ids]
      : [...table.ids, message.recordId];
    const nextChatIds = table.idsByChatKey[chatKey]?.includes(message.recordId)
      ? [...table.idsByChatKey[chatKey]]
      : [...(table.idsByChatKey[chatKey] ?? []), message.recordId];
    nextChatIds.sort((leftId, rightId) => {
      const left = nextById[leftId];
      const right = nextById[rightId];
      return left && right
        ? AppUtils.toSortableDate(left.sentAtIso) - AppUtils.toSortableDate(right.sentAtIso)
          || `${left.messageId ?? ''}`.localeCompare(`${right.messageId ?? ''}`)
        : left ? -1 : right ? 1 : 0;
    });
    return {
      byId: nextById,
      ids: nextIds,
      idsByChatKey: {
        ...table.idsByChatKey,
        [chatKey]: nextChatIds
      }
    };
  }

  private chatAttachmentSummary(message: ChatMessageDto): string {
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

  private mergeSeedRecords(records: SeedChatRecordCollection): void {
    const current = this.seedRecords ?? {
      chats: { byId: {}, ids: [] },
      chatMessages: { byId: {}, ids: [], idsByChatKey: {} }
    };
    this.seedRecords = {
      chats: this.mergeChatTable(current.chats, records.chats),
      chatMessages: this.mergeChatMessagesTable(current.chatMessages, records.chatMessages)
    };
  }

  private mergeChatTable(
    current: AppMemorySchema[typeof CHATS_TABLE_NAME],
    incoming: AppMemorySchema[typeof CHATS_TABLE_NAME]
  ): AppMemorySchema[typeof CHATS_TABLE_NAME] {
    const byId = { ...current.byId };
    const ids = [...current.ids];
    for (const id of incoming.ids) {
      const record = incoming.byId[id];
      if (!record) {
        continue;
      }
      byId[id] = LocalChatThreadMapper.cloneRecord(record);
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }
    return { byId, ids };
  }

  private mergeChatMessagesTable(
    current: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME],
    incoming: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME]
  ): AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME] {
    let next = current;
    for (const id of incoming.ids) {
      const record = incoming.byId[id];
      if (record) {
        next = this.upsertMessageRecord(next, record);
      }
    }
    return next;
  }

  private cloneSeedRecords(records: SeedChatRecordCollection): SeedChatRecordCollection {
    return {
      chats: this.mergeChatTable({ byId: {}, ids: [] }, records.chats),
      chatMessages: this.mergeChatMessagesTable({ byId: {}, ids: [], idsByChatKey: {} }, records.chatMessages)
    };
  }
}

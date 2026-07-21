import { CHAT_MESSAGES_TABLE_NAME, CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import type { ChatMessageRecord, ChatRecord, ChatThreadRecord } from '../../source/entity/chat.entity';
import { USERS_TABLE_NAME, type UserChatCountersRecord } from '../../source/entity/user.entity';
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
      [CHAT_MESSAGES_TABLE_NAME]: this.mergeChatMessagesTable(currentState[CHAT_MESSAGES_TABLE_NAME], seeded.chatMessages),
      [USERS_TABLE_NAME]: this.applyStoredChatCounterChanges(currentState, normalizedUserId, seeded.chats)
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

  queryChatItemById(userId: string, chatId: string): ChatThreadRecord | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedChatId) {
      return null;
    }
    const record = this.seedRecords?.chats.byId[LocalChatThreadMapper.buildRecordKey(normalizedUserId, normalizedChatId)];
    return record ? LocalChatThreadMapper.cloneRecord(record) : null;
  }

  queryChatMessagesPage(chat: ChatRecord, page: number, pageSize: number): ChatMessageDto[] {
    const ownerUserId = typeof (chat as { ownerUserId?: unknown }).ownerUserId === 'string'
      ? `${(chat as { ownerUserId?: string }).ownerUserId ?? ''}`.trim()
      : '';
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!ownerUserId || !sourceId || !this.seedRecords) {
      return [];
    }
    const record = this.seedRecords.chats.byId[LocalChatThreadMapper.buildRecordKey(ownerUserId, sourceId)];
    if (!record) {
      return [];
    }
    const normalizedPage = Math.max(0, Math.trunc(Number(page) || 0));
    const normalizedPageSize = Math.max(1, Math.trunc(Number(pageSize) || 20));
    const start = normalizedPage * normalizedPageSize;
    const chatKey = LocalChatMessageMapper.chatKey(ownerUserId, sourceId);
    const snapshot = this.seedRecords.chatMessages;
    const orderedIds = snapshot.idsByChatKey[chatKey] ?? [];
    const pageRecords = orderedIds
      .slice()
      .reverse()
      .slice(start, start + normalizedPageSize)
      .map(id => snapshot.byId[id])
      .filter((message): message is ChatMessageRecord => Boolean(message));
    return LocalChatMessageMapper.toDtoList(pageRecords);
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

  private applyStoredChatCounterChanges(
    state: AppMemorySchema,
    userId: string,
    incoming: AppMemorySchema[typeof CHATS_TABLE_NAME]
  ): AppMemorySchema[typeof USERS_TABLE_NAME] {
    const users = state[USERS_TABLE_NAME];
    const user = users.byId[userId];
    if (!user) {
      return users;
    }
    const normalize = (value: unknown): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    };
    const counters: Required<UserChatCountersRecord> = {
      all: normalize(user.activities.chat?.all ?? user.activities.chats),
      event: normalize(user.activities.chat?.event),
      subEvent: normalize(user.activities.chat?.subEvent),
      group: normalize(user.activities.chat?.group),
      service: normalize(user.activities.chat?.service),
      appSupport: normalize(user.activities.chat?.appSupport)
    };
    for (const id of incoming.ids) {
      const previous = state[CHATS_TABLE_NAME].byId[id];
      const next = incoming.byId[id];
      if (previous) {
        this.addChatUnread(counters, previous, -1);
      }
      if (next) {
        this.addChatUnread(counters, next, 1);
      }
    }
    const nextUser = {
      ...user,
      activities: {
        ...user.activities,
        chats: counters.all,
        chat: counters
      }
    };
    return {
      byId: { ...users.byId, [userId]: nextUser },
      ids: [...users.ids]
    };
  }

  private addChatUnread(
    counters: Required<UserChatCountersRecord>,
    chat: ChatThreadRecord,
    direction: -1 | 1
  ): void {
    const delta = direction * Math.max(0, Math.trunc(Number(chat.unread) || 0));
    counters.all = Math.max(0, counters.all + delta);
    const key = this.chatCounterKey(chat.channelType);
    if (key) {
      counters[key] = Math.max(0, counters[key] + delta);
    }
  }

  private chatCounterKey(channelType: ChatThreadRecord['channelType']): Exclude<keyof UserChatCountersRecord, 'all'> | null {
    switch (channelType) {
      case 'mainEvent': return 'event';
      case 'optionalSubEvent': return 'subEvent';
      case 'groupSubEvent': return 'group';
      case 'serviceEvent': return 'service';
      case 'appSupport':
      case 'supportCase': return 'appSupport';
      default: return null;
    }
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

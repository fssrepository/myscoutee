import { CHAT_MESSAGES_TABLE_NAME, CHATS_TABLE_NAME } from '../entity/chat.entity';
import type { ChatMessageRecord } from '../entity/chat.entity';
import type { ChatRecord, ChatThreadRecord } from '../entity/chat.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { Injectable, inject } from '@angular/core';

import type * as ContractTypes from '../../../contracts';
import { AppUtils } from '../../../../app-utils';
import type { AppMemorySchema } from '../../common/memory.schema';
import { LocalMemoryDb } from '../../../common/app.db';
import { UserProfileState } from '../../../common/user-profile-state';
import { LocalChatMessageMapper, LocalChatThreadMapper } from '../mappers';
import type * as ActivityContracts from '../../../contracts/activity.interface';
import type { ActivitiesFeedFilters, ListQuery } from '../../../contracts';

@Injectable({
  providedIn: 'root'
})
export class LocalChatsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryChatItemsByUser(userId: string): ChatThreadRecord[] {
    return this.withLatestMessageSummaries(this.queryUserRecords(userId));
  }

  queryActivitiesChatPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>
  ): { items: ChatThreadRecord[]; total: number; nextCursor: string | null } {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }

    const rangeStartMs = this.parseRangeDateMs(query.rangeStart, Number.NEGATIVE_INFINITY);
    const rangeEndMs = this.parseRangeDateMs(query.rangeEnd, Number.POSITIVE_INFINITY);
    if (rangeStartMs > rangeEndMs) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }

    const source = this.withLatestMessageSummaries(query.filters?.adminServiceOnly === true && this.activitiesChatContextFilter(query) === 'service'
      ? this.querySupportCaseRecordsForAdmin(normalizedUserId, this.activitiesSupportCaseFilter(query))
      : this.queryUserRecordsForPage(normalizedUserId, query))
      .filter(record => this.matchesDateRange(record, rangeStartMs, rangeEndMs));
    const sorted = this.sortChatPageRecords(source, query);
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const startIndex = this.resolvePageStartIndex(query, pageSize);
    const endIndex = Math.min(sorted.length, startIndex + pageSize);
    return {
      items: sorted
        .slice(startIndex, endIndex)
        .map(record => LocalChatThreadMapper.cloneRecord(record)),
      total: sorted.length,
      nextCursor: endIndex < sorted.length ? String(endIndex) : null
    };
  }

  queryChatMembers(chatId: string): ActivityContracts.ActivityMemberDTO[] {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return [];
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    const recordId = table.ids.find(id => table.byId[id]?.id === normalizedChatId) ?? '';
    const record = recordId ? table.byId[recordId] : null;
    if (!record) {
      return [];
    }
    const userIds = [...new Set(
      (record.memberIds ?? [])
        .map(userId => `${userId ?? ''}`.trim())
        .filter(userId => userId.length > 0)
    )];
    return userIds.map((userId, index) => this.toChatMemberEntry(normalizedChatId, userId, index));
  }

  querySupportCaseItemsForAdmin(userId: string, filter: ContractTypes.SupportCaseFilter = 'all'): ChatThreadRecord[] {
    const normalizedUserId = userId.trim();
    return this.withLatestMessageSummaries(this.querySupportCaseRecordsForAdmin(normalizedUserId, filter))
      .map(record => LocalChatThreadMapper.cloneRecord(record));
  }

  private querySupportCaseRecordsForAdmin(
    normalizedUserId: string,
    filter: ContractTypes.SupportCaseFilter = 'all'
  ): ChatThreadRecord[] {
    if (!this.isDemoAdminUser(normalizedUserId)) {
      return [];
    }
    const normalizedFilter = this.normalizeSupportCaseFilter(filter);
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    const byChatId = new Map<string, ChatThreadRecord>();
    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || !this.isSupportCaseRecord(record)) {
        continue;
      }
      const chatId = `${record.id ?? ''}`.trim();
      if (!chatId) {
        continue;
      }
      const current = byChatId.get(chatId);
      if (!current || record.ownerUserId === normalizedUserId) {
        byChatId.set(chatId, record);
      }
    }
    return [...byChatId.values()]
      .filter(record => normalizedFilter === 'all' || record.supportCase?.status === normalizedFilter)
      .map(record => ({
        ...record,
        supportCase: this.cloneSupportCase(record.supportCase),
        ownerUserId: normalizedUserId
      }));
  }

  queryChatMessages(chat: ChatRecord): ContractTypes.ChatMessageDto[] {
    const record = this.resolveChatRecord(chat, { createServiceChat: false });
    return record ? LocalChatMessageMapper.toDtoList(this.queryChatMessageRecords(record)).map(message => ({
      ...message,
      readBy: message.readBy.filter(reader => `${reader.id ?? ''}`.trim() !== `${message.senderAvatar.id ?? ''}`.trim())
    })) : [];
  }

  queryChatMessagesPage(
    chat: ChatRecord,
    query: ListQuery
  ): { items: ContractTypes.ChatMessageDto[]; total: number; nextCursor: string | null } {
    const messages = this.sortChatMessagesForThread(this.queryChatMessages(chat));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const startIndex = this.resolveMessagePageStartIndex(query, pageSize);
    const endIndex = Math.min(messages.length, startIndex + pageSize);
    return {
      items: messages.slice(startIndex, endIndex),
      total: messages.length,
      nextCursor: endIndex < messages.length ? String(endIndex) : null
    };
  }

  appendChatMessage(chat: ChatRecord, message: ContractTypes.ChatMessageDto): ContractTypes.ChatMessageDto | null {
    const record = this.resolveChatRecord(chat);
    if (!record) {
      return null;
    }
    const recordKey = LocalChatThreadMapper.buildRecordKey(record.ownerUserId, record.id);
    let savedMessageRecord: ChatMessageRecord | null = null;
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const currentMessagesTable = currentState[CHAT_MESSAGES_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      const storedMessage = this.withAppendTimeline(message, existingRecord, currentMessagesTable);
      const messageRecord = LocalChatMessageMapper.toRecord(record.ownerUserId, record.id, storedMessage);
      savedMessageRecord = messageRecord;
      const nextMessagesTable = this.upsertMessageRecord(currentMessagesTable, messageRecord);
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          ...currentTable,
          byId: {
            ...currentTable.byId,
            [recordKey]: {
              ...existingRecord,
              lastMessage: storedMessage.text || this.chatAttachmentSummary(storedMessage),
              lastSenderId: storedMessage.senderAvatar.id,
              dateIso: storedMessage.sentAtIso
            }
          }
        },
        [CHAT_MESSAGES_TABLE_NAME]: nextMessagesTable
      };
    });
    return savedMessageRecord ? LocalChatMessageMapper.toDto(savedMessageRecord) : null;
  }

  upsertSupportChatMessage(chat: ChatThreadRecord, message: ContractTypes.ChatMessageDto, unreadForOwner: boolean): void {
    const sourceId = `${chat.id ?? ''}`.trim();
    const ownerUserId = `${chat.ownerUserId ?? ''}`.trim();
    if (!sourceId || !ownerUserId) {
      return;
    }
    const recordKey = LocalChatThreadMapper.buildRecordKey(ownerUserId, sourceId);
    const messageRecord = LocalChatMessageMapper.toRecord(ownerUserId, sourceId, message);
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const currentMessagesTable = currentState[CHAT_MESSAGES_TABLE_NAME];
      const existing = currentTable.byId[recordKey];
      const nextRecord: ChatThreadRecord = {
        ...(existing ?? chat),
        ...chat,
        unread: unreadForOwner ? Math.max(1, (existing?.unread ?? 0) + 1) : 0
      };
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          byId: {
            ...currentTable.byId,
            [recordKey]: nextRecord
          },
          ids: currentTable.ids.includes(recordKey)
            ? [...currentTable.ids]
            : [...currentTable.ids, recordKey]
        },
        [CHAT_MESSAGES_TABLE_NAME]: this.upsertMessageRecord(currentMessagesTable, messageRecord)
      };
    });
  }

  updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): ContractTypes.ChatMessageDto | null {
    const record = this.resolveChatRecord(chat, { createServiceChat: false });
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!record || !normalizedMessageId) {
      return null;
    }
    const actorId = 'self';
    const actorName = 'You';
    const actorInitials = 'ME';
    const actorGender: 'woman' | 'man' = 'man';
    const nowIso = new Date().toISOString();
    let updatedMessage: ContractTypes.ChatMessageDto | null = null;
    const recordKey = LocalChatThreadMapper.buildRecordKey(record.ownerUserId, record.id);
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const currentMessagesTable = currentState[CHAT_MESSAGES_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      const existingMessageRecord = this.findMessageRecord(currentMessagesTable, existingRecord, normalizedMessageId);
      if (!existingMessageRecord) {
        return currentState;
      }
      const nextMessage = this.applyMessageMutation(LocalChatMessageMapper.toDto(existingMessageRecord), mutation, {
        actorId,
        actorName,
        actorInitials,
        actorGender,
        nowIso
      });
      updatedMessage = nextMessage;
      const nextMessageRecord = LocalChatMessageMapper.toRecord(existingRecord.ownerUserId, existingRecord.id, nextMessage);
      const nextMessagesTable = this.upsertMessageRecord(currentMessagesTable, nextMessageRecord);
      const latest = this.latestMessage(LocalChatMessageMapper.toDtoList(this.selectChatMessageRecordsFromSnapshot(nextMessagesTable, existingRecord)));
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          ...currentTable,
          byId: {
            ...currentTable.byId,
            [recordKey]: {
              ...existingRecord,
              lastMessage: latest ? (latest.text || this.chatAttachmentSummary(latest) || this.deletedMessageSummary(latest)) : existingRecord.lastMessage,
              lastSenderId: latest?.senderAvatar.id ?? existingRecord.lastSenderId,
              dateIso: latest?.sentAtIso ?? existingRecord.dateIso
            }
          }
        },
        [CHAT_MESSAGES_TABLE_NAME]: nextMessagesTable
      };
    });
    return updatedMessage;
  }

  markChatRead(
    chat: ChatRecord,
    ownerUserId: string,
    messageIds: readonly string[]
  ): { messageIds: string[]; unread: number; reader: ContractTypes.ChatReadAvatar; readAtIso: string } | null {
    const normalizedOwnerUserId = `${ownerUserId ?? ''}`.trim();
    const targetIds = [...new Set(
      (messageIds ?? [])
        .map(messageId => `${messageId ?? ''}`.trim())
        .filter(Boolean)
    )];
    const sourceId = `${chat.id ?? ''}`.trim();
    const channelOwnerId = `${chat.ownerId ?? ''}`.trim();
    const channelType = `${chat.channelType ?? ''}`.trim();
    if (!normalizedOwnerUserId || (!sourceId && !channelOwnerId) || targetIds.length === 0) {
      return null;
    }
    const recordsTable = this.memoryDb.read()[CHATS_TABLE_NAME];
    const recordKey = this.findChatRecordKey(recordsTable, normalizedOwnerUserId, sourceId, channelOwnerId, channelType);
    if (!recordKey) {
      return null;
    }
    const record = recordsTable.byId[recordKey] ?? null;
    if (!record) {
      return null;
    }

    const reader = this.readAvatarForUser(normalizedOwnerUserId);
    const readAtIso = new Date().toISOString();
    const changedIds: string[] = [];
    const previousUnread = Math.max(0, Math.trunc(Number(record.unread) || 0));
    let unread = previousUnread;
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const currentMessagesTable = currentState[CHAT_MESSAGES_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      let nextMessagesTable = currentMessagesTable;
      const targetIdSet = new Set(targetIds);
      const messageRecords = this.selectChatMessageRecordsFromSnapshot(currentMessagesTable, existingRecord);
      for (const messageRecord of messageRecords) {
        if (
          !targetIdSet.has(messageRecord.messageId)
          || messageRecord.mine
          || (messageRecord.readBy ?? []).some(existingReader => existingReader.userId === normalizedOwnerUserId)
        ) {
          continue;
        }
        const nextMessageRecord: ChatMessageRecord = {
          ...messageRecord,
          readBy: [
            ...(messageRecord.readBy ?? []),
            {
              userId: reader.id,
              initials: reader.initials,
              gender: reader.gender,
              imageUrl: reader.imageUrl ?? null
            }
          ]
        };
        changedIds.push(messageRecord.messageId);
        nextMessagesTable = this.upsertMessageRecord(nextMessagesTable, nextMessageRecord);
      }
      if (changedIds.length === 0) {
        return currentState;
      }
      unread = this.normalizeCounter(previousUnread - changedIds.length);
      const unreadDelta = unread - previousUnread;
      const currentUsersTable = currentState[USERS_TABLE_NAME];
      const currentUser = currentUsersTable.byId[normalizedOwnerUserId] ?? null;
      const nextUsersTable = currentUser && unreadDelta !== 0
        ? {
            ...currentUsersTable,
            byId: {
              ...currentUsersTable.byId,
              [normalizedOwnerUserId]: {
                ...currentUser,
                activities: {
                  ...currentUser.activities,
                  chat: this.normalizeCounter((currentUser.activities?.chat ?? 0) + unreadDelta)
                }
              }
            }
          }
        : currentUsersTable;
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          ...currentTable,
          byId: {
            ...currentTable.byId,
            [recordKey]: {
              ...existingRecord,
              unread
            }
          }
        },
        [CHAT_MESSAGES_TABLE_NAME]: nextMessagesTable,
        [USERS_TABLE_NAME]: nextUsersTable
      };
    });
    return changedIds.length > 0
      ? {
          messageIds: changedIds,
          unread,
          reader,
          readAtIso
        }
      : null;
  }

  updateSupportCase(chat: ChatRecord, action: ContractTypes.SupportCaseAction): ChatThreadRecord | null {
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!sourceId) {
      return null;
    }
    const actor = this.resolveDemoAdminActor(
      typeof (chat as { ownerUserId?: unknown }).ownerUserId === 'string'
        ? `${(chat as { ownerUserId?: string }).ownerUserId ?? ''}`.trim()
        : ''
    );
    const state = this.nextSupportCaseState(action, actor);
    if (!state) {
      return null;
    }
    let updated: ChatThreadRecord | null = null;
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const nextById = { ...currentTable.byId };
      let changed = false;
      for (const id of currentTable.ids) {
        const record = currentTable.byId[id];
        if (!record || record.id !== sourceId || !this.isSupportCaseRecord(record)) {
          continue;
        }
        const nextRecord: ChatThreadRecord = {
          ...record,
          channelType: 'supportCase',
          ownerId: `${record.ownerId ?? record.id ?? ''}`.trim(),
          supportCase: {
            status: state.status,
            assignee: state.assigneeUserId
              ? {
                  userId: state.assigneeUserId,
                  name: state.assigneeName ?? '',
                  initials: state.assigneeInitials ?? ''
                }
              : null,
            updatedAtIso: state.updatedAtIso
          }
        };
        nextById[id] = nextRecord;
        updated = record.ownerUserId === actor.id ? nextRecord : (updated ?? nextRecord);
        changed = true;
      }
      if (!changed) {
        return currentState;
      }
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          ...currentTable,
          byId: nextById
        }
      };
    });
    return updated ? LocalChatThreadMapper.cloneRecord(updated) : null;
  }

  private queryUserRecords(userId: string): ChatThreadRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return [];
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ChatThreadRecord => Boolean(record))
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => LocalChatThreadMapper.cloneRecord(record));
  }

  private queryUserRecordsForPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>
  ): ChatThreadRecord[] {
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ChatThreadRecord => Boolean(record))
      .filter(record => record.ownerUserId === userId)
      .filter(record => this.matchesChatContextFilter(record, this.activitiesChatContextFilter(query)))
      .filter(record => this.matchesSupportCaseFilter(record, this.activitiesSupportCaseFilter(query)));
  }

  private matchesChatContextFilter(
    record: ChatRecord,
    filter: ContractTypes.ActivitiesChatContextFilter
  ): boolean {
    return filter === 'all' || this.activityChatContextFilterKey(record) === filter;
  }

  private activityChatContextFilterKey(
    record: Pick<ChatRecord, 'channelType' | 'serviceContext'>
  ): ContractTypes.ActivitiesChatContextFilter {
    if (record.channelType === 'appSupport' || record.channelType === 'supportCase') {
      return 'appSupport';
    }
    if (record.channelType === 'serviceEvent' || record.serviceContext) {
      return 'service';
    }
    if (record.channelType === 'groupSubEvent') {
      return 'group';
    }
    if (record.channelType === 'optionalSubEvent') {
      return 'subEvent';
    }
    if (record.channelType === 'mainEvent') {
      return 'event';
    }
    return 'all';
  }

  private activitiesSecondaryFilter(query: ListQuery<ActivitiesFeedFilters>): ContractTypes.ActivitiesSecondaryFilter {
    const value = query.filters?.secondaryFilter;
    return value === 'relevant' || value === 'past' ? value : 'recent';
  }

  private activitiesChatContextFilter(query: ListQuery<ActivitiesFeedFilters>): ContractTypes.ActivitiesChatContextFilter {
    const value = query.filters?.chatContextFilter;
    return value === 'event' || value === 'subEvent' || value === 'group' || value === 'service' || value === 'appSupport'
      ? value
      : 'all';
  }

  private activitiesSupportCaseFilter(query: ListQuery<ActivitiesFeedFilters>): ContractTypes.SupportCaseFilter {
    const value = query.filters?.supportCaseFilter;
    return value === 'pending' || value === 'picked' || value === 'solved' || value === 'blocked' ? value : 'all';
  }

  private matchesSupportCaseFilter(record: ChatRecord, filter: ContractTypes.SupportCaseFilter | undefined): boolean {
    const normalizedFilter = this.normalizeSupportCaseFilter(filter ?? 'all');
    return normalizedFilter === 'all' || record.supportCase?.status === normalizedFilter;
  }

  private sortChatPageRecords(
    records: readonly ChatThreadRecord[],
    query: ListQuery<ActivitiesFeedFilters>
  ): ChatThreadRecord[] {
    const direction = query.direction === 'asc' ? 1 : -1;
    const sorted = [...records];
    if (this.activitiesSecondaryFilter(query) === 'relevant') {
      return sorted.sort((left, right) =>
        this.chatMetricScore(right) - this.chatMetricScore(left)
        || direction * (
          AppUtils.toSortableDate(left.dateIso ?? '') - AppUtils.toSortableDate(right.dateIso ?? '')
        )
      );
    }
    return sorted.sort((left, right) =>
      direction * (AppUtils.toSortableDate(left.dateIso ?? '') - AppUtils.toSortableDate(right.dateIso ?? ''))
    );
  }

  private chatMetricScore(record: Pick<ChatRecord, 'unread' | 'memberIds'>): number {
    const unread = Math.max(0, Math.trunc(Number(record.unread) || 0));
    const memberCount = new Set(
      (record.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    ).size;
    return unread * 10 + memberCount;
  }

  private normalizeCounter(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  }

  private withLatestMessageSummaries(records: readonly ChatThreadRecord[]): ChatThreadRecord[] {
    if (records.length === 0) {
      return [];
    }
    const messagesSnapshot = this.memoryDb.read()[CHAT_MESSAGES_TABLE_NAME];
    return records.map(record => this.withLatestMessageSummary(record, messagesSnapshot));
  }

  private withLatestMessageSummary(
    record: ChatThreadRecord,
    messagesSnapshot: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME]
  ): ChatThreadRecord {
    const latest = this.latestMessage(
      LocalChatMessageMapper.toDtoList(this.selectChatMessageRecordsFromSnapshot(messagesSnapshot, record))
    );
    if (!latest) {
      return LocalChatThreadMapper.cloneRecord(record);
    }
    return {
      ...LocalChatThreadMapper.cloneRecord(record),
      lastMessage: this.chatMessageSummary(latest) || record.lastMessage,
      lastSenderId: `${latest.senderAvatar?.id ?? ''}`.trim() || record.lastSenderId,
      dateIso: `${latest.sentAtIso ?? ''}`.trim() || record.dateIso
    };
  }

  private chatMessageSummary(message: ContractTypes.ChatMessageDto): string {
    return message.text || this.chatAttachmentSummary(message) || this.deletedMessageSummary(message);
  }

  private withAppendTimeline(
    message: ContractTypes.ChatMessageDto,
    chat: ChatThreadRecord,
    messagesTable: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME]
  ): ContractTypes.ChatMessageDto {
    const records = this.selectChatMessageRecordsFromSnapshot(messagesTable, chat);
    const latestRecord = records[records.length - 1] ?? null;
    const latestMs = latestRecord ? AppUtils.toSortableDate(latestRecord.sentAtIso) : Number.NaN;
    const messageMs = AppUtils.toSortableDate(message.sentAtIso ?? '');
    if (!Number.isFinite(latestMs) || (Number.isFinite(messageMs) && messageMs > latestMs)) {
      return message;
    }

    const sentAt = new Date(latestMs + 60 * 1000);
    return {
      ...message,
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  }

  private findChatRecordKey(
    table: AppMemorySchema[typeof CHATS_TABLE_NAME],
    ownerUserId: string,
    chatId: string,
    ownerId: string,
    channelType: string
  ): string | null {
    const normalizedOwnerUserId = `${ownerUserId ?? ''}`.trim();
    const normalizedChatId = `${chatId ?? ''}`.trim();
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    const normalizedChannelType = `${channelType ?? ''}`.trim();
    if (normalizedOwnerUserId && normalizedOwnerId) {
      const ownerMatch = table.ids.find(id => {
        const record = table.byId[id];
        return record?.ownerUserId === normalizedOwnerUserId
          && `${record.ownerId ?? ''}`.trim() === normalizedOwnerId
          && (!normalizedChannelType || `${record.channelType ?? ''}`.trim() === normalizedChannelType);
      });
      if (ownerMatch) {
        return ownerMatch;
      }
    }
    if (normalizedOwnerUserId && normalizedChatId) {
      const key = LocalChatThreadMapper.buildRecordKey(normalizedOwnerUserId, normalizedChatId);
      if (table.byId[key]) {
        return key;
      }
    }
    return null;
  }

  private readAvatarForUser(userId: string): ContractTypes.ChatReadAvatar {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const user = normalizedUserId ? this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId] ?? null : null;
    const label = user?.name?.trim() || normalizedUserId || 'You';
    return {
      id: normalizedUserId,
      initials: user?.initials?.trim() || AppUtils.initialsFromText(label),
      gender: user?.gender ?? 'man',
      imageUrl: AppUtils.firstImageUrl(user?.images)
    };
  }

  private resolvePageStartIndex(query: ListQuery<ActivitiesFeedFilters>, pageSize: number): number {
    const cursorIndex = Number(query.cursor);
    if (Number.isFinite(cursorIndex)) {
      return Math.max(0, Math.trunc(cursorIndex));
    }
    return Math.max(0, Math.trunc(Number(query.page) || 0)) * pageSize;
  }

  private resolveMessagePageStartIndex(query: ListQuery, pageSize: number): number {
    const cursorIndex = Number(query.cursor);
    if (Number.isFinite(cursorIndex)) {
      return Math.max(0, Math.trunc(cursorIndex));
    }
    return Math.max(0, Math.trunc(Number(query.page) || 0)) * pageSize;
  }

  private queryChatMessageRecords(chat: ChatThreadRecord): ChatMessageRecord[] {
    return this.selectChatMessageRecordsFromSnapshot(this.memoryDb.read()[CHAT_MESSAGES_TABLE_NAME], chat);
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
      .sort((left, right) => this.compareMessageRecordsAsc(left, right));
  }

  private findMessageRecord(
    table: AppMemorySchema[typeof CHAT_MESSAGES_TABLE_NAME],
    chat: ChatThreadRecord,
    messageId: string
  ): ChatMessageRecord | null {
    const recordId = LocalChatMessageMapper.recordKey(chat.ownerUserId, chat.id, messageId);
    return table.byId[recordId] ?? this.selectChatMessageRecordsFromSnapshot(table, chat)
      .find(record => record.messageId === messageId) ?? null;
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
      return left && right ? this.compareMessageRecordsAsc(left, right) : left ? -1 : right ? 1 : 0;
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

  private compareMessageRecordsAsc(left: ChatMessageRecord, right: ChatMessageRecord): number {
    return AppUtils.toSortableDate(left.sentAtIso) - AppUtils.toSortableDate(right.sentAtIso)
      || `${left.messageId ?? ''}`.localeCompare(`${right.messageId ?? ''}`);
  }

  private sortChatMessagesForThread(
    messages: readonly ContractTypes.ChatMessageDto[]
  ): ContractTypes.ChatMessageDto[] {
    return [...messages].sort((left, right) =>
      AppUtils.toSortableDate(right.sentAtIso) - AppUtils.toSortableDate(left.sentAtIso)
      || `${right.id ?? ''}`.localeCompare(`${left.id ?? ''}`)
    );
  }

  private matchesDateRange(record: ChatRecord, rangeStartMs: number, rangeEndMs: number): boolean {
    const dateMs = AppUtils.toSortableDate(record.dateIso ?? '');
    return dateMs >= rangeStartMs && dateMs <= rangeEndMs;
  }

  private parseRangeDateMs(value: string | null | undefined, fallback: number): number {
    const text = `${value ?? ''}`.trim();
    if (!text) {
      return fallback;
    }
    const dateMs = AppUtils.toSortableDate(text);
    return Number.isFinite(dateMs) ? dateMs : fallback;
  }

  private isDemoAdminUser(userId: string): boolean {
    return userId === 'admin-demo-ava' || userId === 'admin-demo-noel';
  }

  private isSupportCaseRecord(record: ChatRecord): boolean {
    return record.channelType === 'supportCase'
      || `${record.id ?? ''}`.trim().startsWith('c-support-admin-')
      || Boolean(record.supportCase);
  }

  private cloneSupportCase<T extends ContractTypes.ChatSupportCase | null | undefined>(supportCase: T): T {
    return supportCase
      ? {
          ...supportCase,
          assignee: supportCase.assignee ? { ...supportCase.assignee } : supportCase.assignee
        } as T
      : supportCase;
  }

  private normalizeSupportCaseFilter(filter: ContractTypes.SupportCaseFilter): ContractTypes.SupportCaseFilter {
    return filter === 'pending' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
      ? filter
      : 'all';
  }

  private resolveDemoAdminActor(ownerUserId: string): { id: string; name: string; initials: string } {
    if (ownerUserId === 'admin-demo-noel') {
      return {
        id: 'admin-demo-noel',
        name: 'Noel',
        initials: 'NO'
      };
    }
    return {
      id: 'admin-demo-ava',
      name: 'Ava',
      initials: 'AV'
    };
  }

  private nextSupportCaseState(
    action: ContractTypes.SupportCaseAction,
    actor: { id: string; name: string; initials: string }
  ): {
    status: ContractTypes.SupportCaseStatus;
    assigneeUserId: string | null;
    assigneeName: string | null;
    assigneeInitials: string | null;
    updatedAtIso: string;
  } | null {
    const updatedAtIso = new Date().toISOString();
    if (action === 'unpick' || action === 'reopen') {
      return {
        status: 'pending',
        assigneeUserId: null,
        assigneeName: null,
        assigneeInitials: null,
        updatedAtIso
      };
    }
    if (action === 'pick' || action === 'solve' || action === 'block') {
      return {
        status: action === 'solve' ? 'solved' : action === 'block' ? 'blocked' : 'picked',
        assigneeUserId: actor.id,
        assigneeName: actor.name,
        assigneeInitials: actor.initials,
        updatedAtIso
      };
    }
    return null;
  }

  private isSetupRequiredDemoProfile(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedUserId] ?? null;
    return user ? UserProfileState.isEmptyOnboardingProfile(user) : false;
  }

  private toChatMemberEntry(chatId: string, userId: string, index: number): ActivityContracts.ActivityMemberDTO {
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId] ?? null;
    const label = user?.name?.trim() || userId;
    const when = AppUtils.addDays(new Date(), -Math.max(0, index));
    return {
      id: `chat:${chatId}:${userId}`,
      userId,
      name: label,
      initials: user?.initials?.trim() || AppUtils.initialsFromText(label),
      gender: user?.gender ?? 'man',
      city: user?.city ?? '',
      statusText: user?.statusText?.trim() || 'Chat member',
      role: 'Member',
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      invitedByActiveUser: false,
      invitedByUserId: null,
      metAtIso: AppUtils.toIsoDateTime(when),
      actionAtIso: AppUtils.toIsoDateTime(when),
      metWhere: 'Chat',
      avatarUrl: AppUtils.firstImageUrl(user?.images),
      profile: user ? { ...user, images: [...(user.images ?? [])] } : null
    };
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
      const record = table.byId[LocalChatThreadMapper.buildRecordKey(ownerUserId, sourceId)];
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
    const normalizedOwnerUserId = ownerUserId.trim();
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!normalizedOwnerUserId || !sourceId) {
      return null;
    }
    const recordKey = LocalChatThreadMapper.buildRecordKey(normalizedOwnerUserId, sourceId);
    const existing = this.memoryDb.read()[CHATS_TABLE_NAME].byId[recordKey];
    if (existing) {
      return existing;
    }
    const record: ChatThreadRecord = {
      ...chat,
      memberIds: [...(chat.memberIds ?? [])],
      ownerUserId: normalizedOwnerUserId,
      dateIso: chat.dateIso ?? new Date().toISOString()
    };
    const initialMessageRecords = this.buildInitialServiceMessages(chat)
      .map(message => LocalChatMessageMapper.toRecord(normalizedOwnerUserId, sourceId, message));
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      if (currentTable.byId[recordKey]) {
        return currentState;
      }
      const nextMessagesTable = initialMessageRecords.reduce(
        (table, messageRecord) => this.upsertMessageRecord(table, messageRecord),
        currentState[CHAT_MESSAGES_TABLE_NAME]
      );
      return {
        ...currentState,
        [CHATS_TABLE_NAME]: {
          byId: {
            ...currentTable.byId,
            [recordKey]: record
          },
          ids: [...currentTable.ids, recordKey]
        },
        [CHAT_MESSAGES_TABLE_NAME]: nextMessagesTable
      };
    });
    return record;
  }

  private buildInitialServiceMessages(chat: ChatRecord): ContractTypes.ChatMessageDto[] {
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!sourceId.startsWith('c-support-blocked-')) {
      return [];
    }
    const sentAtIso = chat.dateIso ?? new Date().toISOString();
    return [{
      id: `m-${sourceId}-admin`,
      sender: 'MyScoutee Admin',
      senderAvatar: {
        id: 'myscoutee-admin',
        initials: 'MS',
        gender: 'woman'
      },
      text: 'Your account is blocked. You can reply here to contact MyScoutee support and ask for a review.',
      time: 'Now',
      sentAtIso,
      mine: false,
      readBy: []
    }];
  }

  private chatAttachmentSummary(message: ContractTypes.ChatMessageDto): string {
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

  private applyMessageMutation(
    message: ContractTypes.ChatMessageDto,
    mutation: ContractTypes.ChatMessageMutation,
    actor: {
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorGender: 'woman' | 'man';
      nowIso: string;
    }
  ): ContractTypes.ChatMessageDto {
    if (mutation.deleted === true) {
      return {
        ...message,
        text: '',
        deletedAtIso: actor.nowIso,
        deletedByUserId: actor.actorId,
        deletedByName: actor.actorName,
        reactions: [],
        readBy: []
      };
    }
    if (typeof mutation.text === 'string') {
      const nextText = mutation.text.trim();
      if (nextText && message.mine && !message.deletedAtIso) {
        return {
          ...message,
          text: nextText,
          editedAtIso: actor.nowIso
        };
      }
    }
    if (typeof mutation.pinned === 'boolean') {
      return {
        ...message,
        pinnedAtIso: mutation.pinned ? actor.nowIso : null,
        pinnedByUserId: mutation.pinned ? actor.actorId : null
      };
    }
    if (Object.prototype.hasOwnProperty.call(mutation, 'reactionEmoji')) {
      const emoji = `${mutation.reactionEmoji ?? ''}`.trim();
      const withoutMine = (message.reactions ?? []).filter(reaction => reaction.userId !== actor.actorId);
      return {
        ...message,
        reactions: emoji
          ? [
              ...withoutMine,
              {
                emoji,
                userId: actor.actorId,
                userName: actor.actorName,
                userInitials: actor.actorInitials,
                userGender: actor.actorGender,
                reactedAtIso: actor.nowIso
              }
            ]
          : withoutMine
      };
    }
    if (mutation.attachments) {
      return {
        ...message,
        attachments: mutation.attachments.map(attachment => ({ ...attachment }))
      };
    }
    return message;
  }

  private latestMessage(messages: readonly ContractTypes.ChatMessageDto[]): ContractTypes.ChatMessageDto | null {
    return [...messages].sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso))[0] ?? null;
  }

  private deletedMessageSummary(message: ContractTypes.ChatMessageDto): string {
    return message.deletedAtIso ? `${message.deletedByName || message.sender} deleted a message` : '';
  }
}

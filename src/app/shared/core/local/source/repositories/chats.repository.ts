import { CHATS_TABLE_NAME } from '../entity/chat.entity';
import type { ChatThreadRecord } from '../entity/chat.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../base/models';
import type * as ContractTypes from '../../../contracts';
import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../common/db';
import { activityChatContextFilterKey } from '../../../base/converters';
import { UserProfileStateBuilder } from '../../../base/builders';
import { LocalChatThreadMapper } from '../mappers';
import type { ChatRecord } from '../../../contracts/chat.interface';


import type * as ActivityContracts from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalChatsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryChatItemsByUser(userId: string): ChatThreadRecord[] {
    return this.queryUserRecords(userId);
  }

  queryActivitiesChatPage(
    userId: string,
    request: ContractTypes.ActivitiesPageRequest
  ): { items: ChatThreadRecord[]; total: number; nextCursor: string | null } {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }

    const rangeStartMs = this.parseRangeDateMs(request.rangeStart, Number.NEGATIVE_INFINITY);
    const rangeEndMs = this.parseRangeDateMs(request.rangeEnd, Number.POSITIVE_INFINITY);
    if (rangeStartMs > rangeEndMs) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }

    const source = (request.adminServiceOnly === true && request.chatContextFilter === 'service'
      ? this.querySupportCaseRecordsForAdmin(normalizedUserId, request.supportCaseFilter ?? 'all')
      : this.queryUserRecordsForPage(normalizedUserId, request))
      .filter(record => this.matchesDateRange(record, rangeStartMs, rangeEndMs));
    const sorted = this.sortChatPageRecords(source, request);
    const pageSize = Math.max(1, Math.trunc(Number(request.pageSize) || 10));
    const startIndex = this.resolvePageStartIndex(request, pageSize);
    const endIndex = Math.min(sorted.length, startIndex + pageSize);
    return {
      items: sorted
        .slice(startIndex, endIndex)
        .map(record => LocalChatThreadMapper.cloneRecord(record, { includeMessages: false })),
      total: sorted.length,
      nextCursor: endIndex < sorted.length ? String(endIndex) : null
    };
  }

  queryChatMembers(chatId: string): ActivityContracts.ActivityMemberEntry[] {
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
    return this.querySupportCaseRecordsForAdmin(normalizedUserId, filter)
      .map(record => LocalChatThreadMapper.cloneRecord(record, { includeMessages: false }));
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
      .filter(record => normalizedFilter === 'all' || record.supportCaseStatus === normalizedFilter)
      .map(record => ({
        ...record,
        ownerUserId: normalizedUserId
      }));
  }

  queryChatMessages(chat: ChatRecord): ContractTypes.ChatPopupMessage[] {
    const record = this.resolveChatRecord(chat, { createServiceChat: false });
    return record ? LocalChatThreadMapper.cloneMessages(record.messages ?? []).map(message => ({
      ...message,
      readBy: message.readBy.filter(reader => `${reader.id ?? ''}`.trim() !== `${message.senderAvatar.id ?? ''}`.trim())
    })) : [];
  }

  appendChatMessage(chat: ChatRecord, message: ContractTypes.ChatPopupMessage): ContractTypes.ChatPopupMessage | null {
    const record = this.resolveChatRecord(chat);
    if (!record) {
      return null;
    }
    const messageClone = LocalChatThreadMapper.cloneMessages([message])[0] ?? null;
    if (!messageClone) {
      return null;
    }
    const recordKey = LocalChatThreadMapper.buildRecordKey(record.ownerUserId, record.id);
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
                ...LocalChatThreadMapper.cloneMessages(existingRecord.messages ?? []),
                messageClone
              ]
            }
          }
        }
      };
    });
    return messageClone;
  }

  upsertSupportChatMessage(chat: ChatThreadRecord, message: ContractTypes.ChatPopupMessage, unreadForOwner: boolean): void {
    const sourceId = `${chat.id ?? ''}`.trim();
    const ownerUserId = `${chat.ownerUserId ?? ''}`.trim();
    if (!sourceId || !ownerUserId) {
      return;
    }
    const recordKey = LocalChatThreadMapper.buildRecordKey(ownerUserId, sourceId);
    const messageClone = LocalChatThreadMapper.cloneMessages([message])[0] ?? null;
    if (!messageClone) {
      return;
    }
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const existing = currentTable.byId[recordKey];
      const existingMessages = existing?.messages ?? [];
      const nextRecord: ChatThreadRecord = {
        ...(existing ?? chat),
        ...chat,
        unread: unreadForOwner ? Math.max(1, (existing?.unread ?? 0) + 1) : 0,
        messages: [
          ...LocalChatThreadMapper.cloneMessages(existingMessages).map(item => ({
            ...item,
            readBy: item.readBy
              .filter(reader => `${reader.id ?? ''}`.trim() !== `${item.senderAvatar.id ?? ''}`.trim())
              .map(reader => ({ ...reader }))
          })),
          messageClone
        ]
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
        }
      };
    });
  }

  updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): ContractTypes.ChatPopupMessage | null {
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
    let updatedMessage: ContractTypes.ChatPopupMessage | null = null;
    const recordKey = LocalChatThreadMapper.buildRecordKey(record.ownerUserId, record.id);
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      const nextMessages = LocalChatThreadMapper.cloneMessages(existingRecord.messages ?? []).map(message => {
        if (message.id !== normalizedMessageId) {
          return message;
        }
        const nextMessage = this.applyMessageMutation(message, mutation, {
          actorId,
          actorName,
          actorInitials,
          actorGender,
          nowIso
        });
        updatedMessage = nextMessage;
        return nextMessage;
      });
      if (!updatedMessage) {
        return currentState;
      }
      const latest = this.latestMessage(nextMessages);
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
              dateIso: latest?.sentAtIso ?? existingRecord.dateIso,
              messages: nextMessages
            }
          }
        }
      };
    });
    return updatedMessage ? LocalChatThreadMapper.cloneMessages([updatedMessage])[0] ?? null : null;
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
          supportCaseStatus: state.status,
          supportCaseAssigneeUserId: state.assigneeUserId,
          supportCaseAssigneeName: state.assigneeName,
          supportCaseAssigneeInitials: state.assigneeInitials,
          supportCaseUpdatedAtIso: state.updatedAtIso
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
    return updated ? LocalChatThreadMapper.cloneRecord(updated, { includeMessages: false }) : null;
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
      .map(record => LocalChatThreadMapper.cloneRecord(record, { includeMessages: false }));
  }

  private queryUserRecordsForPage(
    userId: string,
    request: ContractTypes.ActivitiesPageRequest
  ): ChatThreadRecord[] {
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is ChatThreadRecord => Boolean(record))
      .filter(record => record.ownerUserId === userId)
      .filter(record => this.matchesChatContextFilter(record, request.chatContextFilter))
      .filter(record => this.matchesSupportCaseFilter(record, request.supportCaseFilter));
  }

  private matchesChatContextFilter(
    record: ChatRecord,
    filter: ContractTypes.ActivitiesChatContextFilter
  ): boolean {
    return filter === 'all' || activityChatContextFilterKey(record) === filter;
  }

  private matchesSupportCaseFilter(record: ChatRecord, filter: ContractTypes.SupportCaseFilter | undefined): boolean {
    const normalizedFilter = this.normalizeSupportCaseFilter(filter ?? 'all');
    return normalizedFilter === 'all' || record.supportCaseStatus === normalizedFilter;
  }

  private sortChatPageRecords(
    records: readonly ChatThreadRecord[],
    request: ContractTypes.ActivitiesPageRequest
  ): ChatThreadRecord[] {
    const direction = request.direction === 'asc' ? 1 : -1;
    const sorted = [...records];
    if (request.secondaryFilter === 'relevant') {
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

  private resolvePageStartIndex(request: ContractTypes.ActivitiesPageRequest, pageSize: number): number {
    const cursorIndex = Number(request.cursor);
    if (Number.isFinite(cursorIndex)) {
      return Math.max(0, Math.trunc(cursorIndex));
    }
    return Math.max(0, Math.trunc(Number(request.page) || 0)) * pageSize;
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
    return `${record.id ?? ''}`.trim().startsWith('c-support-admin-') || Boolean(record.supportCaseStatus);
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
    return user
      ? UserProfileStateBuilder.isEmptyOnboardingProfile(user)
      : UserProfileStateBuilder.isEmptyOnboardingProfileUserId(normalizedUserId);
  }

  private toChatMemberEntry(chatId: string, userId: string, index: number): ActivityContracts.ActivityMemberEntry {
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
      dateIso: chat.dateIso ?? new Date().toISOString(),
      messages: this.buildInitialServiceMessages(chat)
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

  private buildInitialServiceMessages(chat: ChatRecord): ContractTypes.ChatPopupMessage[] {
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

  private chatAttachmentSummary(message: ContractTypes.ChatPopupMessage): string {
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
    message: ContractTypes.ChatPopupMessage,
    mutation: ContractTypes.ChatMessageMutation,
    actor: {
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorGender: 'woman' | 'man';
      nowIso: string;
    }
  ): ContractTypes.ChatPopupMessage {
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

  private latestMessage(messages: readonly ContractTypes.ChatPopupMessage[]): ContractTypes.ChatPopupMessage | null {
    return [...messages].sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso))[0] ?? null;
  }

  private deletedMessageSummary(message: ContractTypes.ChatPopupMessage): string {
    return message.deletedAtIso ? `${message.deletedByName || message.sender} deleted a message` : '';
  }
}

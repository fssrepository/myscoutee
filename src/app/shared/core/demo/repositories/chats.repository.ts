import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import { AppMemoryDb } from '../../base/db';
import type { ChatRecord } from '../../base/models/chat.model';
import { DemoChatsRepositoryBuilder, DemoUserSeedBuilder } from '../builders';
import { CHATS_TABLE_NAME, type DemoChatRecord } from '../models/chats.model';
import { USERS_TABLE_NAME } from '../models/users.model';

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
          || !Array.isArray(record.messages)
          || (this.isSupportCaseRecord(record) && record.messages.length === 0)
          || this.supportCaseRecordNeedsAvatarRefresh(record);
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

  querySupportCaseItemsForAdmin(userId: string, filter: AppTypes.SupportCaseFilter = 'all'): DemoChatRecord[] {
    this.init();
    const normalizedUserId = userId.trim();
    if (!this.isDemoAdminUser(normalizedUserId)) {
      return [];
    }
    const normalizedFilter = this.normalizeSupportCaseFilter(filter);
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    const byChatId = new Map<string, DemoChatRecord>();
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
      .map(record => DemoChatsRepositoryBuilder.cloneRecord({
        ...record,
        ownerUserId: normalizedUserId
      }, { includeMessages: false }));
  }

  seedContextualRecordsForUser(userId: string, eventRecords: readonly import('../models/events.model').DemoEventRecord[]): boolean {
    this.init();
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
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

  queryChatMessages(chat: ChatRecord): AppTypes.ChatPopupMessage[] {
    this.init();
    const record = this.resolveChatRecord(chat, { createServiceChat: false });
    return record ? DemoChatsRepositoryBuilder.cloneMessages(record.messages ?? []).map(message => ({
      ...message,
      readBy: message.readBy.filter(reader => `${reader.id ?? ''}`.trim() !== `${message.senderAvatar.id ?? ''}`.trim())
    })) : [];
  }

  appendChatMessage(chat: ChatRecord, message: AppTypes.ChatPopupMessage): AppTypes.ChatPopupMessage | null {
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
              lastMessage: messageClone.text || this.chatAttachmentSummary(messageClone),
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

  updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: AppTypes.ChatMessageMutation
  ): AppTypes.ChatPopupMessage | null {
    this.init();
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
    let updatedMessage: AppTypes.ChatPopupMessage | null = null;
    const recordKey = DemoChatsRepositoryBuilder.buildRecordKey(record.ownerUserId, record.id);
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const existingRecord = currentTable.byId[recordKey];
      if (!existingRecord) {
        return currentState;
      }
      const nextMessages = DemoChatsRepositoryBuilder.cloneMessages(existingRecord.messages ?? []).map(message => {
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
    return updatedMessage ? DemoChatsRepositoryBuilder.cloneMessages([updatedMessage])[0] ?? null : null;
  }

  updateSupportCase(chat: ChatRecord, action: AppTypes.SupportCaseAction): DemoChatRecord | null {
    this.init();
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
    let updated: DemoChatRecord | null = null;
    this.memoryDb.write(currentState => {
      const currentTable = currentState[CHATS_TABLE_NAME];
      const nextById = { ...currentTable.byId };
      let changed = false;
      for (const id of currentTable.ids) {
        const record = currentTable.byId[id];
        if (!record || record.id !== sourceId || !this.isSupportCaseRecord(record)) {
          continue;
        }
        const nextRecord: DemoChatRecord = {
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
    return updated ? DemoChatsRepositoryBuilder.cloneRecord(updated, { includeMessages: false }) : null;
  }

  private queryUserRecords(userId: string): DemoChatRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.isSetupRequiredDemoProfile(normalizedUserId)) {
      return [];
    }
    const table = this.memoryDb.read()[CHATS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoChatRecord => Boolean(record))
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => DemoChatsRepositoryBuilder.cloneRecord(record, { includeMessages: false }));
  }

  private isDemoAdminUser(userId: string): boolean {
    return userId === 'admin-demo-ava' || userId === 'admin-demo-noel';
  }

  private isSupportCaseRecord(record: ChatRecord): boolean {
    return `${record.id ?? ''}`.trim().startsWith('c-support-admin-') || Boolean(record.supportCaseStatus);
  }

  private supportCaseRecordNeedsAvatarRefresh(record: DemoChatRecord): boolean {
    if (!this.isSupportCaseRecord(record) || !Array.isArray(record.messages) || record.messages.length === 0) {
      return false;
    }
    return record.messages.some(message => {
      const senderId = `${message.senderAvatar?.id ?? ''}`.trim();
      const imageUrl = `${message.senderAvatar?.imageUrl ?? ''}`.trim();
      return senderId.length > 0 && senderId !== 'deleted' && imageUrl.length === 0;
    });
  }

  private normalizeSupportCaseFilter(filter: AppTypes.SupportCaseFilter): AppTypes.SupportCaseFilter {
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
    action: AppTypes.SupportCaseAction,
    actor: { id: string; name: string; initials: string }
  ): {
    status: AppTypes.SupportCaseStatus;
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
      ? DemoUserSeedBuilder.isEmptyOnboardingProfile(user)
      : DemoUserSeedBuilder.isEmptyOnboardingProfileUserId(normalizedUserId);
  }

  private resolveChatRecord(
    chat: ChatRecord,
    options: { createServiceChat?: boolean } = {}
  ): DemoChatRecord | null {
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

  private createServiceChatRecord(ownerUserId: string, chat: ChatRecord): DemoChatRecord | null {
    const normalizedOwnerUserId = ownerUserId.trim();
    const sourceId = `${chat.id ?? ''}`.trim();
    if (!normalizedOwnerUserId || !sourceId) {
      return null;
    }
    const recordKey = DemoChatsRepositoryBuilder.buildRecordKey(normalizedOwnerUserId, sourceId);
    const existing = this.memoryDb.read()[CHATS_TABLE_NAME].byId[recordKey];
    if (existing) {
      return existing;
    }
    const record: DemoChatRecord = {
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

  private buildInitialServiceMessages(chat: ChatRecord): AppTypes.ChatPopupMessage[] {
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

  private chatAttachmentSummary(message: AppTypes.ChatPopupMessage): string {
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
    message: AppTypes.ChatPopupMessage,
    mutation: AppTypes.ChatMessageMutation,
    actor: {
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorGender: 'woman' | 'man';
      nowIso: string;
    }
  ): AppTypes.ChatPopupMessage {
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

  private latestMessage(messages: readonly AppTypes.ChatPopupMessage[]): AppTypes.ChatPopupMessage | null {
    return [...messages].sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso))[0] ?? null;
  }

  private deletedMessageSummary(message: AppTypes.ChatPopupMessage): string {
    return message.deletedAtIso ? `${message.deletedByName || message.sender} deleted a message` : '';
  }
}

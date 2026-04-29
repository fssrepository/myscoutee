import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { ActivitiesPageRequest } from '../../base/models';
import { AppContext } from '../../base/context';
import { FirebaseAuthService } from '../../base/services/firebase-auth.service';
import type { DemoChatRecord } from '../../demo/models/chats.model';

interface HttpChatSummaryDto {
  id: string;
  avatar: string;
  title: string;
  lastMessage: string;
  lastSenderId: string;
  memberIds: string[];
  unread: number;
  dateIso?: string;
  channelType?: 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent' | 'serviceEvent';
  serviceContext?: 'event' | 'asset' | 'notification';
  eventId?: string;
  subEventId?: string;
  groupId?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
}

interface HttpChatMessageDto {
  id: string;
  clientId?: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderGender: 'woman' | 'man';
  text: string;
  sentAtIso: string;
  mine?: boolean;
  readBy?: Array<{
    id: string;
    initials: string;
    gender: 'woman' | 'man';
  }>;
  deletedAtIso?: string | null;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
  editedAtIso?: string | null;
  pinnedAtIso?: string | null;
  pinnedByUserId?: string | null;
  replyTo?: HttpChatMessageReplyDto | null;
  reactions?: HttpChatMessageReactionDto[] | null;
  attachments?: HttpChatMessageAttachmentDto[] | null;
}

interface HttpChatMessageReplyDto {
  id: string;
  sender: string;
  text: string;
}

interface HttpChatMessageReactionDto {
  emoji: string;
  userId: string;
  userName: string;
  userInitials: string;
  userGender: 'woman' | 'man';
  reactedAtIso: string;
}

interface HttpChatMessageAttachmentDto {
  id: string;
  type: AppTypes.ChatMessageAttachmentType;
  title: string;
  url?: string | null;
  previewUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

interface HttpChatSocketRequestDto {
  type: 'message' | 'typing' | 'read';
  clientId?: string;
  text?: string;
  attachments?: HttpChatMessageAttachmentDto[];
  replyTo?: HttpChatMessageReplyDto | null;
  typing?: boolean;
  messageIds?: string[];
}

interface HttpChatTypingDto {
  userId: string;
  userName: string;
  userInitials: string;
  userGender: 'woman' | 'man';
  typing: boolean;
}

interface HttpChatReadReceiptDto {
  userId: string;
  userInitials: string;
  userGender: 'woman' | 'man';
  messageIds: string[];
  readAtIso: string;
}

interface HttpChatSocketEventDto {
  type: 'message' | 'typing' | 'read';
  chatId: string;
  message?: HttpChatMessageDto | null;
  typing?: HttpChatTypingDto | null;
  read?: HttpChatReadReceiptDto | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpChatsService {
  private static readonly SOCKET_RECONNECT_BASE_DELAY_MS = 750;
  private static readonly SOCKET_RECONNECT_MAX_DELAY_MS = 8000;
  private static readonly SOCKET_MESSAGE_ACK_TIMEOUT_MS = 12000;

  private readonly http = inject(HttpClient);
  private readonly appCtx = inject(AppContext);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly chatItemsByUserId = new Map<string, DemoChatRecord[]>();
  private socket: WebSocket | null = null;
  private socketChatId: string | null = null;
  private socketPromise: Promise<WebSocket | null> | null = null;
  private readonly socketListeners = new Set<(event: AppTypes.ChatLiveEvent) => void>();
  private readonly intentionalSocketClosures = new Set<WebSocket>();
  private readonly pendingSocketMessageIds = new Set<string>();
  private readonly pendingSocketMessageTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingSocketAckResolvers = new Map<
    string,
    {
      resolve: (message: AppTypes.ChatPopupMessage | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private socketReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private socketReconnectAttempt = 0;
  private shouldEmitReconnectEvent = false;
  private socketMessageSequence = 0;

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<HttpChatSummaryDto[] | null>(`${this.apiBaseUrl}/activities/chats`, {
          params: this.withUserId(new HttpParams(), normalizedUserId)
        })
        .toPromise();
      const records = this.deduplicateChatRecords(
        Array.isArray(response)
          ? response.map(item => this.mapChatRecord(item, normalizedUserId))
          : []
      );
      this.chatItemsByUserId.set(normalizedUserId, records.map(record => this.cloneChatRecord(record)));
      return records.map(record => this.cloneChatRecord(record));
    } catch {
      return this.peekChatItemsByUser(normalizedUserId);
    }
  }

  async queryActivitiesChatPage(
    userId: string,
    request: ActivitiesPageRequest
  ): Promise<{ items: DemoChatRecord[]; total: number; nextCursor?: string | null }> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }

    let params = new HttpParams()
      .set('userId', normalizedUserId)
      .set('limit', String(Math.max(1, Math.trunc(request.pageSize || 10))))
      .set('sort', request.sort ?? 'date');
    if (request.direction) {
      params = params.set('sortDirection', request.direction);
    }
    if (request.secondaryFilter === 'recent' || request.secondaryFilter === 'past' || request.secondaryFilter === 'relevant') {
      params = params.set('secondaryFilter', request.secondaryFilter);
    }
    if (request.chatContextFilter && request.chatContextFilter !== 'all') {
      params = params.set('contextFilter', request.chatContextFilter);
    }
    if (request.cursor) {
      params = params.set('cursor', request.cursor);
    }
    if (request.rangeStart) {
      params = params.set('rangeStartIso', request.rangeStart);
    }
    if (request.rangeEnd) {
      params = params.set('rangeEndIso', request.rangeEnd);
    }

    try {
      const response = await this.http.get<{
        items?: HttpChatSummaryDto[] | null;
        total?: number | null;
        nextCursor?: string | null;
      } | null>(`${this.apiBaseUrl}/activities/chats/page`, { params }).toPromise();

      return {
        items: this.deduplicateChatRecords(
          Array.isArray(response?.items)
            ? response.items.map(item => this.mapChatRecord(item, normalizedUserId))
            : []
        ),
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : 0,
        nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
          ? response.nextCursor.trim()
          : null
      };
    } catch {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
  }

  peekChatItemsByUser(userId: string): DemoChatRecord[] {
    const normalizedUserId = userId.trim();
    const records = this.chatItemsByUserId.get(normalizedUserId) ?? [];
    return records.map(record => this.cloneChatRecord(record));
  }

  async loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    const response = await this.http
      .get<HttpChatMessageDto[]>(`${this.apiBaseUrl}/activities/chats/${encodeURIComponent(chat.id)}/messages`, {
        params: this.activeUserParams()
      })
      .toPromise();

    const messages = (response ?? []).map(message => this.mapChatMessage(message));
    const cachedMessages = this.resolveCachedChatMessages(chat);

    return this.mergeCachedChatMessages(messages, cachedMessages)
      .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
  }

  async sendChatMessage(chat: ChatMenuItem, text: string, clientId?: string): Promise<AppTypes.ChatPopupMessage | null> {
    return this.sendChatMessageWithAttachments(chat, text, [], clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatMenuItem,
    text: string,
    attachments: readonly AppTypes.ChatMessageAttachment[] = [],
    clientId?: string,
    replyTo?: AppTypes.ChatPopupMessage['replyTo']
  ): Promise<AppTypes.ChatPopupMessage | null> {
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) {
      return null;
    }

    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!normalizedChatId) {
      return null;
    }

    const outboundClientId = `${clientId ?? ''}`.trim() || this.buildSocketClientMessageId(normalizedChatId);
    this.trackPendingSocketMessage(outboundClientId);

    try {
      const socket = await this.ensureSocket(chat);
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        this.clearPendingSocketMessage(outboundClientId);
        this.closeSocketIfIdle();
        return null;
      }

      const payload: HttpChatSocketRequestDto = {
        type: 'message',
        clientId: outboundClientId,
        text: trimmedText,
        attachments: attachments.map(attachment => this.toHttpChatAttachment(attachment)),
        replyTo: this.toHttpChatReply(replyTo)
      };
      socket.send(JSON.stringify(payload));
      return this.waitForSocketMessageAck(outboundClientId);
    } catch {
      this.clearPendingSocketMessage(outboundClientId);
      this.resolvePendingSocketAck(outboundClientId, null);
      this.closeSocketIfIdle();
      return null;
    }
  }

  async sendChatTyping(chat: ChatMenuItem, typing: boolean): Promise<void> {
    const socket = await this.ensureSocket(chat);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload: HttpChatSocketRequestDto = {
      type: 'typing',
      typing
    };
    socket.send(JSON.stringify(payload));
  }

  async markChatRead(chat: ChatMenuItem, messageIds: readonly string[]): Promise<void> {
    const normalizedIds = messageIds
      .map(messageId => `${messageId ?? ''}`.trim())
      .filter(messageId => messageId.length > 0);
    if (normalizedIds.length === 0) {
      return;
    }
    const socket = await this.ensureSocket(chat);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload: HttpChatSocketRequestDto = {
      type: 'read',
      messageIds: normalizedIds
    };
    socket.send(JSON.stringify(payload));
  }

  async updateChatMessage(
    chat: ChatMenuItem,
    messageId: string,
    mutation: AppTypes.ChatMessageMutation
  ): Promise<AppTypes.ChatPopupMessage | null> {
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedChatId || !normalizedMessageId) {
      return null;
    }
    const body: Record<string, unknown> = {};
    let action = '';
    if (typeof mutation.text === 'string') {
      action = 'edit';
      body['text'] = mutation.text;
    } else if (mutation.deleted === true) {
      action = 'delete';
    } else if (typeof mutation.pinned === 'boolean') {
      action = 'pin';
      body['pinned'] = mutation.pinned;
    } else if (Object.prototype.hasOwnProperty.call(mutation, 'reactionEmoji')) {
      action = 'reaction';
      body['emoji'] = mutation.reactionEmoji ?? '';
    }
    if (!action) {
      return null;
    }
    const response = await this.http
      .post<HttpChatMessageDto | null>(
        `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(normalizedChatId)}/messages/${encodeURIComponent(normalizedMessageId)}/${action}`,
        body,
        { params: this.activeUserParams() }
      )
      .toPromise();
    if (!response) {
      return null;
    }
    const message = this.mapChatMessage(response);
    this.updateCachedChatSummaryAfterMessage(chat, message);
    return message;
  }

  async watchChatEvents(
    chat: ChatMenuItem,
    onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!normalizedChatId) {
      return () => {};
    }

    this.socketListeners.add(onEvent);
    const socket = await this.ensureSocket(chat);
    if (!socket && this.socketListeners.has(onEvent) && this.socketChatId === normalizedChatId) {
      this.scheduleSocketReconnect(normalizedChatId);
    }

    return () => {
      this.socketListeners.delete(onEvent);
      if (this.socketListeners.size === 0) {
        this.closeSocketIfIdle();
      }
    };
  }

  async watchChatMessages(
    chat: ChatMenuItem,
    onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return this.watchChatEvents(chat, event => {
      if (event.type === 'message') {
        onMessage(event.message);
      }
    });
  }

  private mapChatRecord(item: HttpChatSummaryDto, ownerUserId: string): DemoChatRecord {
    const distanceKm = Number.isFinite(Number(item.distanceKm))
      ? Math.max(0, Number(item.distanceKm))
      : undefined;
    const distanceMetersExact = Number.isFinite(Number(item.distanceMetersExact))
      ? Math.max(0, Math.trunc(Number(item.distanceMetersExact)))
      : Number.isFinite(distanceKm)
        ? Math.max(0, Math.round(Number(distanceKm) * 1000))
        : undefined;
    return {
      id: `${item.id ?? ''}`.trim(),
      avatar: `${item.avatar ?? ''}`.trim(),
      title: `${item.title ?? ''}`.trim(),
      lastMessage: `${item.lastMessage ?? ''}`.trim(),
      lastSenderId: `${item.lastSenderId ?? ''}`.trim(),
      memberIds: [...(item.memberIds ?? [])],
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0)),
      dateIso: item.dateIso,
      channelType: item.channelType,
      serviceContext: item.serviceContext,
      eventId: item.eventId,
      subEventId: item.subEventId,
      groupId: item.groupId,
      distanceKm,
      distanceMetersExact,
      ownerUserId
    } satisfies DemoChatRecord;
  }

  private cloneChatRecord(record: DemoChatRecord): DemoChatRecord {
    return {
      ...record,
      memberIds: [...(record.memberIds ?? [])],
      messages: record.messages?.map(message => ({
        ...message,
        readBy: [...(message.readBy ?? [])],
        attachments: message.attachments?.map(attachment => ({ ...attachment }))
      }))
    };
  }

  private deduplicateChatRecords(records: readonly DemoChatRecord[]): DemoChatRecord[] {
    const uniqueById = new Map<string, DemoChatRecord>();
    for (const record of records) {
      const chatId = `${record?.id ?? ''}`.trim();
      if (!chatId) {
        continue;
      }
      if (!uniqueById.has(chatId)) {
        uniqueById.set(chatId, record);
      }
    }
    return [...uniqueById.values()];
  }

  private mapChatMessage(message: HttpChatMessageDto): AppTypes.ChatPopupMessage {
    const sentAt = new Date(message.sentAtIso);
    const activeUserId = this.activeUserId();
    const deleted = typeof message.deletedAtIso === 'string' && message.deletedAtIso.trim().length > 0;
    return {
      id: message.id,
      clientId: `${message.clientId ?? ''}`.trim() || undefined,
      sender: message.senderName,
      senderAvatar: {
        id: message.senderId,
        initials: message.senderInitials,
        gender: message.senderGender
      },
      text: deleted ? '' : message.text,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: message.sentAtIso,
      mine: message.mine === true || (!!activeUserId && message.senderId === activeUserId),
      readBy: deleted ? [] : (message.readBy ?? []).map(reader => ({
        id: reader.id,
        initials: reader.initials,
        gender: reader.gender
      })),
      deletedAtIso: message.deletedAtIso ?? null,
      deletedByUserId: message.deletedByUserId ?? null,
      deletedByName: message.deletedByName ?? null,
      editedAtIso: deleted ? null : message.editedAtIso ?? null,
      pinnedAtIso: deleted ? null : message.pinnedAtIso ?? null,
      pinnedByUserId: deleted ? null : message.pinnedByUserId ?? null,
      replyTo: deleted ? null : message.replyTo ? { ...message.replyTo } : null,
      reactions: deleted ? [] : (message.reactions ?? []).map(reaction => ({ ...reaction })),
      attachments: deleted ? [] : (message.attachments ?? []).map(attachment => this.mapChatAttachment(attachment))
    } satisfies AppTypes.ChatPopupMessage;
  }

  private toHttpChatReply(replyTo: AppTypes.ChatPopupMessage['replyTo']): HttpChatMessageReplyDto | null {
    if (!replyTo) {
      return null;
    }
    const id = `${replyTo.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    return {
      id,
      sender: `${replyTo.sender ?? ''}`.trim(),
      text: `${replyTo.text ?? ''}`.trim()
    };
  }

  private mapChatAttachment(attachment: HttpChatMessageAttachmentDto): AppTypes.ChatMessageAttachment {
    return {
      id: `${attachment.id ?? ''}`.trim(),
      type: attachment.type,
      title: `${attachment.title ?? ''}`.trim(),
      url: typeof attachment.url === 'string' ? attachment.url.trim() : null,
      previewUrl: typeof attachment.previewUrl === 'string' ? attachment.previewUrl.trim() : null,
      mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType.trim() : null,
      sizeBytes: Number.isFinite(Number(attachment.sizeBytes)) ? Math.max(0, Math.trunc(Number(attachment.sizeBytes))) : null
    };
  }

  private toHttpChatAttachment(attachment: AppTypes.ChatMessageAttachment): HttpChatMessageAttachmentDto {
    return {
      id: `${attachment.id ?? ''}`.trim(),
      type: attachment.type,
      title: `${attachment.title ?? ''}`.trim(),
      url: attachment.url ?? null,
      previewUrl: attachment.previewUrl ?? null,
      mimeType: attachment.mimeType ?? null,
      sizeBytes: Number.isFinite(Number(attachment.sizeBytes)) ? Math.max(0, Math.trunc(Number(attachment.sizeBytes))) : null
    };
  }

  private updateCachedChatSummaryAfterMessage(
    chat: ChatMenuItem,
    message: AppTypes.ChatPopupMessage
  ): void {
    const ownerUserId = this.activeUserId();
    if (!ownerUserId) {
      return;
    }
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!normalizedChatId) {
      return;
    }
    const currentRecords = (this.chatItemsByUserId.get(ownerUserId) ?? []).map(record => this.cloneChatRecord(record));
    const existingIndex = currentRecords.findIndex(record => record.id === normalizedChatId);
    const existingRecord = existingIndex >= 0 ? currentRecords[existingIndex] : null;
    const nextRecord = this.buildCachedChatRecordFromMessage(chat, ownerUserId, message, existingRecord);
    if (existingIndex >= 0) {
      currentRecords[existingIndex] = nextRecord;
    } else {
      currentRecords.push(nextRecord);
    }
    this.chatItemsByUserId.set(ownerUserId, this.sortCachedChatRecords(currentRecords));
  }

  private buildCachedChatRecordFromMessage(
    chat: ChatMenuItem,
    ownerUserId: string,
    message: AppTypes.ChatPopupMessage,
    existingRecord: DemoChatRecord | null
  ): DemoChatRecord {
    const sanitizedDistanceKm = Number.isFinite(Number(chat.distanceKm))
      ? Math.max(0, Number(chat.distanceKm))
      : existingRecord?.distanceKm;
    const sanitizedDistanceMetersExact = Number.isFinite(Number(chat.distanceMetersExact))
      ? Math.max(0, Math.trunc(Number(chat.distanceMetersExact)))
      : existingRecord?.distanceMetersExact;
    return {
      id: `${chat.id ?? existingRecord?.id ?? ''}`.trim(),
      avatar: `${chat.avatar ?? existingRecord?.avatar ?? ''}`.trim(),
      title: `${chat.title ?? existingRecord?.title ?? ''}`.trim(),
      lastMessage: `${message.text ?? ''}`.trim() || this.chatAttachmentSummary(message) || `${existingRecord?.lastMessage ?? ''}`.trim(),
      lastSenderId: `${message.senderAvatar?.id ?? existingRecord?.lastSenderId ?? ''}`.trim(),
      memberIds: [...((chat.memberIds?.length ? chat.memberIds : existingRecord?.memberIds) ?? [])],
      unread: message.mine ? 0 : Math.max(0, Math.trunc(Number(existingRecord?.unread) || 0)),
      dateIso: `${message.sentAtIso ?? existingRecord?.dateIso ?? ''}`.trim() || undefined,
      channelType: chat.channelType ?? existingRecord?.channelType,
      eventId: chat.eventId ?? existingRecord?.eventId,
      subEventId: chat.subEventId ?? existingRecord?.subEventId,
      groupId: chat.groupId ?? existingRecord?.groupId,
      distanceKm: sanitizedDistanceKm,
      distanceMetersExact: sanitizedDistanceMetersExact,
      ownerUserId,
      messages: this.mergeCachedChatMessages(existingRecord?.messages ?? [], [message])
    } satisfies DemoChatRecord;
  }

  private resolveCachedChatMessages(chat: ChatMenuItem): AppTypes.ChatPopupMessage[] {
    const ownerUserId = this.activeUserId();
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!ownerUserId || !normalizedChatId) {
      return [];
    }
    const records = this.chatItemsByUserId.get(ownerUserId) ?? [];
    const existingRecord = records.find(record => record.id === normalizedChatId) ?? null;
    return existingRecord?.messages?.map(message => ({
      ...message,
      readBy: [...(message.readBy ?? [])],
      replyTo: message.replyTo ? { ...message.replyTo } : message.replyTo,
      reactions: message.reactions?.map(reaction => ({ ...reaction })),
      attachments: message.attachments?.map(attachment => ({ ...attachment }))
    })) ?? [];
  }

  private mergeCachedChatMessages(
    baseMessages: readonly AppTypes.ChatPopupMessage[],
    extraMessages: readonly AppTypes.ChatPopupMessage[]
  ): AppTypes.ChatPopupMessage[] {
    const mergedById = new Map<string, AppTypes.ChatPopupMessage>();
    for (const message of [...baseMessages, ...extraMessages]) {
      const identity = this.chatMessageIdentity(message);
      if (!identity) {
        continue;
      }
      mergedById.set(identity, {
        ...message,
        readBy: [...(message.readBy ?? [])],
        replyTo: message.replyTo ? { ...message.replyTo } : message.replyTo,
        reactions: message.reactions?.map(reaction => ({ ...reaction })),
        attachments: message.attachments?.map(attachment => ({ ...attachment }))
      });
    }
    return [...mergedById.values()];
  }

  private chatMessageIdentity(message: AppTypes.ChatPopupMessage | null | undefined): string {
    const normalizedId = `${message?.id ?? ''}`.trim();
    if (normalizedId) {
      return normalizedId;
    }
    const normalizedClientId = `${message?.clientId ?? ''}`.trim();
    if (normalizedClientId) {
      return `client:${normalizedClientId}`;
    }
    const senderId = `${message?.senderAvatar?.id ?? ''}`.trim();
    const sentAtIso = `${message?.sentAtIso ?? ''}`.trim();
    const text = `${message?.text ?? ''}`.trim();
    if (!sentAtIso && !text) {
      return '';
    }
    return `fallback:${senderId}:${sentAtIso}:${text}`;
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

  private sortCachedChatRecords(records: readonly DemoChatRecord[]): DemoChatRecord[] {
    return this.deduplicateChatRecords(records)
      .map(record => this.cloneChatRecord(record))
      .sort((left, right) =>
        AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
        || left.id.localeCompare(right.id)
      );
  }

  private mapSocketEvent(
    payload: HttpChatMessageDto | HttpChatSocketEventDto,
    fallbackChatId: string
  ): AppTypes.ChatLiveEvent | null {
    if ('senderId' in payload) {
      return {
        type: 'message',
        chatId: fallbackChatId,
        message: this.mapChatMessage(payload)
      };
    }

    const type = payload.type ?? 'message';
    const chatId = `${payload.chatId ?? fallbackChatId}`.trim() || fallbackChatId;
    if (type === 'typing' && payload.typing) {
      return {
        type: 'typing',
        chatId,
        typing: {
          userId: `${payload.typing.userId ?? ''}`.trim(),
          userName: `${payload.typing.userName ?? ''}`.trim(),
          userInitials: `${payload.typing.userInitials ?? ''}`.trim(),
          userGender: payload.typing.userGender === 'woman' ? 'woman' : 'man',
          typing: payload.typing.typing === true
        }
      };
    }
    if (type === 'read' && payload.read) {
      return {
        type: 'read',
        chatId,
        read: {
          userId: `${payload.read.userId ?? ''}`.trim(),
          userInitials: `${payload.read.userInitials ?? ''}`.trim(),
          userGender: payload.read.userGender === 'woman' ? 'woman' : 'man',
          messageIds: (payload.read.messageIds ?? []).map(messageId => `${messageId ?? ''}`.trim()).filter(Boolean),
          readAtIso: `${payload.read.readAtIso ?? ''}`.trim()
        }
      };
    }
    if (payload.message) {
      return {
        type: 'message',
        chatId,
        message: this.mapChatMessage(payload.message)
      };
    }
    return null;
  }

  private async ensureSocket(chat: ChatMenuItem): Promise<WebSocket | null> {
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!normalizedChatId || typeof WebSocket === 'undefined' || typeof window === 'undefined') {
      return null;
    }
    if (
      this.socket &&
      this.socketChatId === normalizedChatId &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      if (this.socket.readyState === WebSocket.OPEN) {
        return this.socket;
      }
      return this.socketPromise ?? Promise.resolve(this.socket);
    }
    if (this.socketPromise && this.socketChatId === normalizedChatId) {
      return this.socketPromise;
    }

    this.clearSocketReconnectTimer();
    this.closeSocket(false, false);
    this.socketChatId = normalizedChatId;
    this.socketPromise = this.createSocket(normalizedChatId);
    const socket = await this.socketPromise;
    this.socketPromise = null;
    return socket;
  }

  private async createSocket(chatId: string): Promise<WebSocket | null> {
    const socketUrl = await this.buildSocketUrl(chatId);
    if (!socketUrl) {
      return null;
    }

    return new Promise<WebSocket | null>(resolve => {
      const socket = new WebSocket(socketUrl);
      let resolved = false;
      const finalize = (value: WebSocket | null) => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
      };

      socket.onopen = () => {
        const emitReconnect = this.shouldEmitReconnectEvent;
        this.socket = socket;
        this.clearSocketReconnectTimer();
        this.socketReconnectAttempt = 0;
        this.shouldEmitReconnectEvent = false;
        finalize(socket);
        if (emitReconnect) {
          this.emitSocketEvent({
            type: 'reconnected',
            chatId
          });
        }
      };
      socket.onmessage = event => {
        try {
          const parsed = JSON.parse(`${event.data ?? ''}`) as HttpChatMessageDto | HttpChatSocketEventDto;
          const liveEvent = this.mapSocketEvent(parsed, chatId);
          if (!liveEvent) {
            return;
          }
          this.emitSocketEvent(liveEvent);
        } catch {
          // Ignore malformed live chat payloads and keep the socket open.
        }
      };
      socket.onerror = () => {
        if (this.intentionalSocketClosures.delete(socket)) {
          finalize(null);
          return;
        }
        this.handleUnexpectedSocketDisconnect(chatId);
        finalize(null);
      };
      socket.onclose = () => {
        if (this.intentionalSocketClosures.delete(socket)) {
          finalize(null);
          return;
        }
        this.handleUnexpectedSocketDisconnect(chatId);
        finalize(null);
      };
    });
  }

  private async buildSocketUrl(chatId: string): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    const baseUrl = new URL(`${this.apiBaseUrl.replace(/\/+$/, '')}/activities/chats/ws`, window.location.origin);
    baseUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    baseUrl.searchParams.set('chatId', chatId);
    const activeUserId = this.activeUserId();
    if (activeUserId) {
      baseUrl.searchParams.set('userId', activeUserId);
    }
    if (this.firebaseAuthService.enabled) {
      const token = await this.firebaseAuthService.getIdToken();
      if (!token) {
        return null;
      }
      baseUrl.searchParams.set('token', token);
    }
    return baseUrl.toString();
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
  }

  private activeUserParams(): HttpParams {
    return this.withUserId(new HttpParams(), this.activeUserId());
  }

  private withUserId(params: HttpParams, userId: string): HttpParams {
    const normalizedUserId = userId.trim();
    return normalizedUserId ? params.set('userId', normalizedUserId) : params;
  }

  private closeSocket(clearListeners = true, clearPending = true): void {
    this.clearSocketReconnectTimer();
    if (clearPending) {
      this.clearPendingSocketMessages();
    }
    const currentSocket = this.socket;
    this.socket = null;
    this.socketChatId = null;
    this.socketPromise = null;
    this.socketReconnectAttempt = 0;
    this.shouldEmitReconnectEvent = false;
    if (clearListeners) {
      this.socketListeners.clear();
    }
    if (currentSocket && (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)) {
      this.intentionalSocketClosures.add(currentSocket);
      currentSocket.close();
    }
  }

  private emitSocketEvent(event: AppTypes.ChatLiveEvent): void {
    if (event.type === 'message') {
      const normalizedClientId = `${event.message.clientId ?? ''}`.trim();
      this.clearPendingSocketMessage(normalizedClientId);
      this.resolvePendingSocketAck(normalizedClientId, event.message);
      this.updateCachedChatSummaryFromSocketEvent(event.chatId, event.message);
    }
    for (const listener of this.socketListeners) {
      listener(event);
    }
    this.closeSocketIfIdle();
  }

  private updateCachedChatSummaryFromSocketEvent(
    chatId: string,
    message: AppTypes.ChatPopupMessage
  ): void {
    const ownerUserId = this.activeUserId();
    if (!ownerUserId) {
      return;
    }
    const currentRecords = this.chatItemsByUserId.get(ownerUserId) ?? [];
    const existingRecord = currentRecords.find(record => record.id === chatId) ?? null;
    if (!existingRecord) {
      return;
    }
    this.updateCachedChatSummaryAfterMessage(existingRecord, message);
  }

  private handleUnexpectedSocketDisconnect(chatId: string): void {
    if (this.socketChatId && this.socketChatId !== chatId) {
      return;
    }
    this.clearPendingSocketMessages();
    this.socket = null;
    this.socketPromise = null;
    this.socketChatId = chatId;
    if (this.socketListeners.size === 0) {
      this.shouldEmitReconnectEvent = false;
      return;
    }
    this.shouldEmitReconnectEvent = true;
    this.scheduleSocketReconnect(chatId);
  }

  private scheduleSocketReconnect(chatId: string): void {
    if (!chatId || this.socketListeners.size === 0 || this.socketReconnectTimer || this.socketChatId !== chatId) {
      return;
    }
    this.socketReconnectAttempt += 1;
    const delayMs = Math.min(
      HttpChatsService.SOCKET_RECONNECT_MAX_DELAY_MS,
      HttpChatsService.SOCKET_RECONNECT_BASE_DELAY_MS * Math.pow(2, Math.max(0, this.socketReconnectAttempt - 1))
    );
    this.socketReconnectTimer = setTimeout(() => {
      this.socketReconnectTimer = null;
      if (this.socketListeners.size === 0 || this.socketChatId !== chatId || this.socket || this.socketPromise) {
        return;
      }
      void this.reconnectSocket(chatId);
    }, delayMs);
  }

  private async reconnectSocket(chatId: string): Promise<void> {
    if (this.socketListeners.size === 0 || this.socketChatId !== chatId || this.socket || this.socketPromise) {
      return;
    }
    this.socketPromise = this.createSocket(chatId);
    const socket = await this.socketPromise;
    this.socketPromise = null;
    if (!socket && this.socketListeners.size > 0 && this.socketChatId === chatId) {
      this.scheduleSocketReconnect(chatId);
    }
  }

  private clearSocketReconnectTimer(): void {
    if (!this.socketReconnectTimer) {
      return;
    }
    clearTimeout(this.socketReconnectTimer);
    this.socketReconnectTimer = null;
  }

  private closeSocketIfIdle(): void {
    if (this.socketListeners.size > 0 || this.pendingSocketMessageIds.size > 0) {
      return;
    }
    this.closeSocket();
  }

  private buildSocketClientMessageId(chatId: string): string {
    const activeUserId = this.activeUserId() || 'self';
    this.socketMessageSequence += 1;
    return `ws:${chatId}:${activeUserId}:${Date.now()}:${this.socketMessageSequence}`;
  }

  private trackPendingSocketMessage(clientId: string): void {
    const normalizedClientId = `${clientId ?? ''}`.trim();
    if (!normalizedClientId) {
      return;
    }
    this.clearPendingSocketMessage(normalizedClientId);
    this.pendingSocketMessageIds.add(normalizedClientId);
    this.pendingSocketMessageTimers.set(normalizedClientId, setTimeout(() => {
      this.clearPendingSocketMessage(normalizedClientId);
      this.closeSocketIfIdle();
    }, HttpChatsService.SOCKET_MESSAGE_ACK_TIMEOUT_MS));
  }

  private clearPendingSocketMessage(clientId: string): void {
    const normalizedClientId = `${clientId ?? ''}`.trim();
    if (!normalizedClientId) {
      return;
    }
    const timer = this.pendingSocketMessageTimers.get(normalizedClientId);
    if (timer) {
      clearTimeout(timer);
      this.pendingSocketMessageTimers.delete(normalizedClientId);
    }
    this.pendingSocketMessageIds.delete(normalizedClientId);
  }

  private clearPendingSocketMessages(): void {
    for (const timer of this.pendingSocketMessageTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingSocketMessageTimers.clear();
    this.pendingSocketMessageIds.clear();
    for (const [clientId, pending] of this.pendingSocketAckResolvers.entries()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
      this.pendingSocketAckResolvers.delete(clientId);
    }
  }

  private waitForSocketMessageAck(clientId: string): Promise<AppTypes.ChatPopupMessage | null> {
    const normalizedClientId = `${clientId ?? ''}`.trim();
    if (!normalizedClientId) {
      return Promise.resolve(null);
    }
    const existingPending = this.pendingSocketAckResolvers.get(normalizedClientId);
    if (existingPending) {
      clearTimeout(existingPending.timer);
      this.pendingSocketAckResolvers.delete(normalizedClientId);
      existingPending.resolve(null);
    }
    return new Promise<AppTypes.ChatPopupMessage | null>(resolve => {
      const timer = setTimeout(() => {
        this.pendingSocketAckResolvers.delete(normalizedClientId);
        this.clearPendingSocketMessage(normalizedClientId);
        resolve(null);
        this.closeSocketIfIdle();
      }, HttpChatsService.SOCKET_MESSAGE_ACK_TIMEOUT_MS);
      this.pendingSocketAckResolvers.set(normalizedClientId, { resolve, timer });
    });
  }

  private resolvePendingSocketAck(
    clientId: string,
    message: AppTypes.ChatPopupMessage | null
  ): void {
    const normalizedClientId = `${clientId ?? ''}`.trim();
    if (!normalizedClientId) {
      return;
    }
    const pending = this.pendingSocketAckResolvers.get(normalizedClientId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingSocketAckResolvers.delete(normalizedClientId);
    pending.resolve(message);
  }
}

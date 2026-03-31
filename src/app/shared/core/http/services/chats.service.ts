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
  channelType?: 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent';
  eventId?: string;
  subEventId?: string;
  groupId?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
}

interface HttpChatMessageDto {
  id: string;
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
}

interface HttpChatSocketRequestDto {
  type: 'message' | 'typing' | 'read';
  text?: string;
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
  private socketReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private socketReconnectAttempt = 0;
  private shouldEmitReconnectEvent = false;

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
      const records = Array.isArray(response)
        ? response.map(item => this.mapChatRecord(item, normalizedUserId))
        : [];
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
        items: Array.isArray(response?.items)
          ? response.items.map(item => this.mapChatRecord(item, normalizedUserId))
          : [],
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

    return messages.sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
  }

  async sendChatMessage(chat: ChatMenuItem, text: string): Promise<AppTypes.ChatPopupMessage | null> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return null;
    }

    const socket = await this.ensureSocket(chat);
    if (socket && socket.readyState === WebSocket.OPEN) {
      const payload: HttpChatSocketRequestDto = {
        type: 'message',
        text: trimmedText
      };
      socket.send(JSON.stringify(payload));
      return null;
    }

    try {
      const response = await this.http
        .post<HttpChatMessageDto | null>(
          `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(chat.id)}/messages`,
          { text: trimmedText },
          { params: this.activeUserParams() }
        )
        .toPromise();
      return response ? this.mapChatMessage(response) : null;
    } catch {
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
        this.closeSocket();
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
        readBy: [...(message.readBy ?? [])]
      }))
    };
  }

  private mapChatMessage(message: HttpChatMessageDto): AppTypes.ChatPopupMessage {
    const sentAt = new Date(message.sentAtIso);
    const activeUserId = this.activeUserId();
    return {
      id: message.id,
      sender: message.senderName,
      senderAvatar: {
        id: message.senderId,
        initials: message.senderInitials,
        gender: message.senderGender
      },
      text: message.text,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: message.sentAtIso,
      mine: message.mine === true || (!!activeUserId && message.senderId === activeUserId),
      readBy: (message.readBy ?? []).map(reader => ({
        id: reader.id,
        initials: reader.initials,
        gender: reader.gender
      }))
    } satisfies AppTypes.ChatPopupMessage;
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
    this.closeSocket(false);
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
          return;
        }
        this.handleUnexpectedSocketDisconnect(chatId);
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

  private closeSocket(clearListeners = true): void {
    this.clearSocketReconnectTimer();
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
    for (const listener of this.socketListeners) {
      listener(event);
    }
  }

  private handleUnexpectedSocketDisconnect(chatId: string): void {
    if (this.socketChatId && this.socketChatId !== chatId) {
      return;
    }
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
}

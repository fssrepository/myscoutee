import {
  HttpClient,
  HttpParams
} from '@angular/common/http';
import {
  Injectable,
  inject
} from '@angular/core';

import {
  environment
} from '../../../../../environments/environment';
import type * as ContractTypes from '../../contracts';
import {
  AppUtils
} from '../../../app-utils';
import type {
  ActivitiesChatPageResultDTO,
  ChatDTO,
  ChatMemberSummaryDto,
  ChatMetricsDTO,
  ChatMessagesPageResultDTO
} from '../../contracts/chat.interface';
import type { IChatsService } from '../../contracts/activity.interface';
import type { ActivitiesFeedFilters, ListQuery } from '../../contracts';
import {
  SessionService
} from '../../base/services/session.service';

import type * as ActivityContracts from '../../contracts/activity.interface';

import type * as AppConstants from '../../common/constants';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';

interface HttpChatDto {
  id: string;
  avatar: string;
  title: string;
  lastMessage: string;
  lastSenderId: string;
  memberIds: string[];
  members?: ChatMemberSummaryDto[] | null;
  unread: number;
  dateIso?: string;
  channelType?: ContractTypes.ChatChannelType;
  serviceContext?: 'event' | 'asset' | 'notification';
  ownerId?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
  metrics?: ChatMetricsDTO | null;
  supportCase?: {
    status?: ContractTypes.SupportCaseStatus | string | null;
    assignee?: {
      userId?: string | null;
      name?: string | null;
      initials?: string | null;
    } | null;
    updatedAtIso?: string | null;
  } | null;
}

interface HttpChatSenderAvatarDto {
  id?: string | null;
  initials?: string | null;
  gender?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  url?: string | null;
}

interface HttpChatMessageDto {
  id?: string | null;
  clientId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderInitials?: string | null;
  senderGender?: string | null;
  senderImageUrl?: string | null;
  sender?: string | null;
  senderAvatar?: HttpChatSenderAvatarDto | null;
  text?: string | null;
  time?: string | null;
  sentAtIso?: string | null;
  mine?: boolean;
  readBy?: Array<{
    id: string;
    initials: string;
    gender: ContractTypes.ChatUserGender;
    imageUrl?: string | null;
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
  userGender: ContractTypes.ChatUserGender;
  reactedAtIso: string;
}

interface HttpChatMessageAttachmentDto {
  id: string;
  type: ContractTypes.ChatMessageAttachmentType;
  title: string;
  entityId?: string | null;
  assetType?: AppConstants.AssetType | null;
  ownerUserId?: string | null;
  status?: ContractTypes.ChatMessageAttachment['status'];
  unavailableReason?: string | null;
  subtitle?: string | null;
  description?: string | null;
  url?: string | null;
  previewUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

interface HttpChatSocketRequestDto {
  type: 'message' | 'typing' | 'read' | 'edit' | 'delete' | 'pin' | 'reaction' | 'attachments';
  messageId?: string;
  clientId?: string;
  text?: string;
  attachments?: HttpChatMessageAttachmentDto[];
  replyTo?: HttpChatMessageReplyDto | null;
  pinned?: boolean;
  emoji?: string;
  typing?: boolean;
  messageIds?: string[];
}

interface HttpChatTypingDto {
  userId: string;
  userName: string;
  userInitials: string;
  userGender: ContractTypes.ChatUserGender;
  typing: boolean;
}

interface HttpChatReadReceiptDto {
  userId: string;
  userInitials: string;
  userGender: ContractTypes.ChatUserGender;
  messageIds: string[];
  readAtIso: string;
  unread?: number | null;
}

interface HttpChatMessagesPageResponseDto {
  items?: HttpChatMessageDto[] | null;
  total?: number | null;
  nextCursor?: string | null;
  read?: HttpChatReadReceiptDto | null;
}

interface HttpChatMemberDto {
  userId?: string | null;
  id?: string | null;
  name?: string | null;
  initials?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  city?: string | null;
  statusText?: string | null;
  role?: string | null;
  status?: string | null;
  pendingSource?: string | null;
  requestKind?: string | null;
  invitedByActiveUser?: boolean | null;
  invitedByUserId?: string | null;
  metAtIso?: string | null;
  actionAtIso?: string | null;
  metWhere?: string | null;
  profile?: ActivityContracts.ActivityMemberDTO['profile'];
}

interface HttpChatSocketEventDto {
  type: 'message' | 'ack' | 'typing' | 'read' | 'error';
  chatId: string;
  message?: HttpChatMessageDto | null;
  typing?: HttpChatTypingDto | null;
  read?: HttpChatReadReceiptDto | null;
  messageId?: string | null;
  clientId?: string | null;
  error?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpChatsService implements IChatsService {
  private static readonly SOCKET_RECONNECT_BASE_DELAY_MS = 750;
  private static readonly SOCKET_RECONNECT_MAX_DELAY_MS = 8000;
  private static readonly SOCKET_MESSAGE_ACK_TIMEOUT_MS = 3000;

  private readonly http = inject(HttpClient);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly sessionService = inject(SessionService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly chatItemsByUserId = new Map<string, ChatDTO[]>();
  private readonly chatMessagesByOwnerChatKey = new Map<string, ContractTypes.ChatMessageDto[]>();
  private socket: WebSocket | null = null;
  private socketChatId: string | null = null;
  private socketPromise: Promise<WebSocket | null> | null = null;
  private readonly socketListeners = new Set<(event: ContractTypes.ChatLiveEvent) => void>();
  private readonly intentionalSocketClosures = new Set<WebSocket>();
  private readonly pendingSocketMessageIds = new Set<string>();
  private readonly pendingSocketMessageTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingSocketAckResolvers = new Map<
    string,
    {
      resolve: (message: ContractTypes.ChatMessageDto | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly pendingSocketUpdateResolvers = new Map<
    string,
    {
      resolve: (message: ContractTypes.ChatMessageDto | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly pendingSocketReadResolvers = new Map<
    string,
    {
      chatId: string;
      messageIds: ReadonlySet<string>;
      resolve: (read: ContractTypes.ChatReadReceipt | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private socketReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private socketReconnectAttempt = 0;
  private shouldEmitReconnectEvent = false;
  private socketMessageSequence = 0;

  async queryChatItemsByUser(userId: string): Promise<ChatDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<HttpChatDto[] | null>(`${this.apiBaseUrl}/activities/chats`, {
          params: this.withUserId(new HttpParams(), normalizedUserId)
        })
        .toPromise();
      const items = this.deduplicateChatDTOs(
        Array.isArray(response)
          ? response.map(item => this.mapChatDTO(item, normalizedUserId))
          : []
      );
      this.chatItemsByUserId.set(normalizedUserId, items.map(item => this.cloneChatDTO(item)));
      return items.map(item => this.cloneChatDTO(item));
    } catch {
      return this.peekChatItemsByUser(normalizedUserId);
    }
  }

  async queryActivitiesChatPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    options: { chatItems?: readonly ChatDTO[] } = {}
  ): Promise<ActivitiesChatPageResultDTO> {
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
      .set('limit', String(Math.max(1, Math.trunc(query.pageSize || 10))))
      .set('sort', query.sort ?? 'date');
    if (query.direction) {
      params = params.set('sortDirection', query.direction);
    }
    const secondaryFilter = this.activitiesSecondaryFilter(query);
    if (secondaryFilter === 'recent' || secondaryFilter === 'past' || secondaryFilter === 'relevant') {
      params = params.set('secondaryFilter', secondaryFilter);
    }
    const chatContextFilter = this.activitiesChatContextFilter(query);
    if (chatContextFilter !== 'all') {
      params = params.set('contextFilter', chatContextFilter);
    }
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }
    if (query.rangeStart) {
      params = params.set('rangeStartIso', query.rangeStart);
    }
    if (query.rangeEnd) {
      params = params.set('rangeEndIso', query.rangeEnd);
    }
    if (query.filters?.adminServiceOnly === true) {
      params = params.set('adminServiceOnly', 'true');
    }
    const supportCaseFilter = this.activitiesSupportCaseFilter(query);
    if (supportCaseFilter !== 'all') {
      params = params.set('supportCaseFilter', supportCaseFilter);
    }

    try {
      const response = await this.http.get<{
        items?: HttpChatDto[] | null;
        total?: number | null;
        nextCursor?: string | null;
      } | null>(`${this.apiBaseUrl}/activities/chats/page`, { params }).toPromise();

      const page = {
        items: this.deduplicateChatDTOs(
          Array.isArray(response?.items)
            ? response.items.map(item => this.mapChatDTO(item, normalizedUserId))
            : []
        ),
        total: Number.isFinite(response?.total) ? Math.max(0, Math.trunc(Number(response?.total))) : 0,
        nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
          ? response.nextCursor.trim()
          : null
      };
      const resultPage = this.shouldUseCachedActivitiesChatPage(page, normalizedUserId, options.chatItems ?? [])
        ? this.buildCachedActivitiesChatPage(normalizedUserId, query, options.chatItems ?? [])
        : page;
      return this.toActivitiesChatPageDTO(resultPage);
    } catch {
      return this.toActivitiesChatPageDTO(
        this.buildCachedActivitiesChatPage(normalizedUserId, query, options.chatItems ?? [])
      );
    }
  }

  peekChatItemsByUser(userId: string): ChatDTO[] {
    const normalizedUserId = userId.trim();
    const items = this.chatItemsByUserId.get(normalizedUserId) ?? [];
    return items.map(item => this.cloneChatDTO(item));
  }

  async loadChatMessages(chat: ChatDTO): Promise<ContractTypes.ChatMessageDto[]> {
    try {
      const messages: ContractTypes.ChatMessageDto[] = [];
      let cursor: string | null = null;
      let pageIndex = 0;
      do {
        let params = this.activeUserParams().set('limit', '100');
        if (cursor) {
          params = params.set('cursor', cursor);
        }
        const response = await this.http
          .get<HttpChatMessagesPageResponseDto | HttpChatMessageDto[] | null>(
            `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(chat.id)}/messages`,
            { params }
          )
          .toPromise();
        if (Array.isArray(response)) {
          messages.push(...response.map((message, index) => this.mapChatMessage(message, chat.id, messages.length + index)));
          cursor = null;
        } else {
          const pageMessages = Array.isArray(response?.items)
            ? response.items.map((message, index) => this.mapChatMessage(message, chat.id, messages.length + index))
            : [];
          messages.push(...pageMessages);
          cursor = typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
            ? response.nextCursor.trim()
            : null;
        }
        pageIndex += 1;
      } while (cursor && pageIndex < 100);

      const cachedMessages = this.resolveCachedChatMessages(chat);
      const mergedMessages = this.mergeCachedChatMessages(messages, cachedMessages)
        .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
      this.cacheChatMessages(chat, mergedMessages);

      return mergedMessages;
    } catch {
      return this.resolveCachedChatMessages(chat);
    }
  }

  async queryChatMessagesPage(
    chat: ChatDTO,
    query: ListQuery
  ): Promise<ChatMessagesPageResultDTO> {
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    let params = this.activeUserParams()
      .set('limit', String(pageSize));
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }

    try {
      const response = await this.http
        .get<HttpChatMessagesPageResponseDto | HttpChatMessageDto[] | null>(
          `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(chat.id)}/messages`,
          { params }
        )
        .toPromise();

      if (Array.isArray(response)) {
        const messages = response.map((message, index) => this.mapChatMessage(message, chat.id, index));
        this.cacheChatMessages(chat, messages);
        return this.buildChatMessagesPage(
          messages,
          query
        );
      }

      const messages = Array.isArray(response?.items)
        ? response.items.map((message, index) => this.mapChatMessage(message, chat.id, index))
        : [];
      const readReceipt = this.mapChatReadReceipt(response?.read ?? null);
      if (readReceipt) {
        this.updateCachedChatUnread(chat.id, readReceipt);
      }
      this.cacheChatMessages(chat, messages);
      return {
        items: this.sortChatMessagesForThread(messages),
        total: Number.isFinite(response?.total)
          ? Math.max(0, Math.trunc(Number(response?.total)))
          : messages.length,
        nextCursor: typeof response?.nextCursor === 'string' && response.nextCursor.trim().length > 0
          ? response.nextCursor.trim()
          : null,
        readReceipt
      };
    } catch {
      return this.buildChatMessagesPage(this.resolveCachedChatMessages(chat), query);
    }
  }

  async queryChatMembers(chatId: string): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId) {
      return [];
    }
    try {
      const response = await this.http
        .get<HttpChatMemberDto[] | null>(
          `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(normalizedChatId)}/members`,
          { params: this.activeUserParams() }
        )
        .toPromise();
      return Array.isArray(response)
        ? response.map((member, index) => this.mapChatMember(member, normalizedChatId, index))
        : [];
    } catch {
      return [];
    }
  }

  async sendChatMessage(chat: ChatDTO, text: string, clientId?: string): Promise<ContractTypes.ChatMessageDto | null> {
    return this.sendChatMessageWithAttachments(chat, text, [], clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatDTO,
    text: string,
    attachments: readonly ContractTypes.ChatMessageAttachment[] = [],
    clientId?: string,
    replyTo?: ContractTypes.ChatMessageDto['replyTo']
  ): Promise<ContractTypes.ChatMessageDto | null> {
    const trimmedText = AppUtils.convertAsciiEmojis(text.trim());
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

  async sendChatTyping(chat: ChatDTO, typing: boolean): Promise<void> {
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

  async markChatRead(chat: ChatDTO, messageIds: readonly string[]): Promise<ContractTypes.ChatReadReceipt | null> {
    const normalizedIds = messageIds
      .map(messageId => `${messageId ?? ''}`.trim())
      .filter(messageId => messageId.length > 0);
    if (normalizedIds.length === 0) {
      return null;
    }
    const socket = await this.ensureSocket(chat);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return null;
    }
    const payload: HttpChatSocketRequestDto = {
      type: 'read',
      messageIds: normalizedIds
    };
    const pendingRead = this.waitForSocketRead(chat.id, normalizedIds);
    socket.send(JSON.stringify(payload));
    return pendingRead;
  }

  async updateSupportCase(chat: ChatDTO, action: ContractTypes.SupportCaseAction): Promise<ChatDTO | null> {
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    const userId = this.activeUserId();
    if (!normalizedChatId || !userId) {
      return null;
    }
    try {
      const response = await this.http
        .post<HttpChatDto | null>(
          `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(normalizedChatId)}/support-case`,
          { userId, action },
          { params: this.withUserId(new HttpParams(), userId) }
        )
        .toPromise();
      return response ? this.cloneChatDTO(this.mapChatDTO(response, userId)) : null;
    } catch {
      return null;
    }
  }

  async updateChatMessage(
    chat: ChatDTO,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): Promise<ContractTypes.ChatMessageDto | null> {
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedChatId || !normalizedMessageId) {
      return null;
    }
    let action = '';
    const payload: HttpChatSocketRequestDto = {
      type: 'message',
      messageId: normalizedMessageId
    };
    if (typeof mutation.text === 'string') {
      action = 'edit';
      payload.text = AppUtils.convertAsciiEmojis(mutation.text.trim());
    } else if (mutation.deleted === true) {
      action = 'delete';
    } else if (typeof mutation.pinned === 'boolean') {
      action = 'pin';
      payload.pinned = mutation.pinned;
    } else if (Object.prototype.hasOwnProperty.call(mutation, 'reactionEmoji')) {
      action = 'reaction';
      payload.emoji = mutation.reactionEmoji ?? '';
    } else if (mutation.attachments) {
      action = 'attachments';
      payload.attachments = mutation.attachments.map(attachment => this.toHttpChatAttachment(attachment));
    }
    if (!action) {
      return null;
    }
    payload.type = action as HttpChatSocketRequestDto['type'];

    try {
      const socket = await this.ensureSocket(chat);
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return null;
      }
      const pendingUpdate = this.waitForSocketMessageUpdate(normalizedMessageId);
      socket.send(JSON.stringify(payload));
      const updatedMessage = await pendingUpdate;
      if (updatedMessage) {
        this.updateCachedChatSummaryAfterMessage(chat, updatedMessage);
      }
      return updatedMessage;
    } catch {
      this.resolvePendingSocketUpdate(normalizedMessageId, null);
      return null;
    }
  }

  async watchChatEvents(
    chat: ChatDTO,
    onEvent: (event: ContractTypes.ChatLiveEvent) => void
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
    chat: ChatDTO,
    onMessage: (message: ContractTypes.ChatMessageDto) => void
  ): Promise<() => void> {
    return this.watchChatEvents(chat, event => {
      if (event.type === 'message') {
        onMessage(event.message);
      }
    });
  }

  private mapChatDTO(item: HttpChatDto, ownerUserId: string): ChatDTO {
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
      members: this.resolveChatMembers(item.members, item.memberIds),
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0)),
      dateIso: item.dateIso,
      channelType: item.channelType,
      serviceContext: item.serviceContext,
      ownerId: this.normalizeHttpText(item.ownerId) || undefined,
      distanceKm,
      distanceMetersExact,
      supportCase: this.mapSupportCase(item.supportCase),
      ownerUserId,
      metrics: this.cloneMetrics(item.metrics)
    };
  }

  private cloneChatDTO(item: ChatDTO): ChatDTO {
    return {
      ...item,
      memberIds: [...(item.memberIds ?? [])],
      members: this.cloneChatMembers(item.members),
      supportCase: this.cloneSupportCase(item.supportCase),
      metrics: this.cloneMetrics(item.metrics)
    };
  }

  private mapSupportCase(supportCase: HttpChatDto['supportCase']): ContractTypes.ChatSupportCase | null {
    const status = this.normalizeSupportCaseStatus(supportCase?.status);
    if (!status) {
      return null;
    }
    const assigneeUserId = this.normalizeHttpText(supportCase?.assignee?.userId);
    return {
      status,
      assignee: assigneeUserId
        ? {
            userId: assigneeUserId,
            name: this.normalizeHttpText(supportCase?.assignee?.name),
            initials: this.normalizeHttpText(supportCase?.assignee?.initials)
          }
        : null,
      updatedAtIso: this.normalizeHttpText(supportCase?.updatedAtIso) || null
    };
  }

  private cloneSupportCase<T extends ContractTypes.ChatSupportCase | null | undefined>(supportCase: T): T {
    return supportCase
      ? {
          ...supportCase,
          assignee: supportCase.assignee ? { ...supportCase.assignee } : supportCase.assignee
        } as T
      : supportCase;
  }

  private deduplicateChatDTOs(items: readonly ChatDTO[]): ChatDTO[] {
    const uniqueById = new Map<string, ChatDTO>();
    for (const item of items) {
      const chatId = `${item?.id ?? ''}`.trim();
      if (!chatId) {
        continue;
      }
      if (!uniqueById.has(chatId)) {
        uniqueById.set(chatId, item);
      }
    }
    return [...uniqueById.values()];
  }

  private buildChatMessagesPage(
    messages: readonly ContractTypes.ChatMessageDto[],
    query: ListQuery
  ): ChatMessagesPageResultDTO {
    const sorted = this.sortChatMessagesForThread(messages);
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const startIndex = this.resolveChatMessagesPageStartIndex(query, pageSize);
    const endIndex = Math.min(sorted.length, startIndex + pageSize);
    return {
      items: sorted.slice(startIndex, endIndex),
      total: sorted.length,
      nextCursor: endIndex < sorted.length ? String(endIndex) : null
    };
  }

  private resolveChatMessagesPageStartIndex(query: ListQuery, pageSize: number): number {
    const cursorIndex = Number(query.cursor);
    if (Number.isFinite(cursorIndex)) {
      return Math.max(0, Math.trunc(cursorIndex));
    }
    return Math.max(0, Math.trunc(Number(query.page) || 0)) * pageSize;
  }

  private sortChatMessagesForThread(
    messages: readonly ContractTypes.ChatMessageDto[]
  ): ContractTypes.ChatMessageDto[] {
    return [...messages].sort((left, right) =>
      AppUtils.toSortableDate(right.sentAtIso) - AppUtils.toSortableDate(left.sentAtIso)
      || `${right.id ?? ''}`.localeCompare(`${left.id ?? ''}`)
    );
  }

  private shouldUseCachedActivitiesChatPage(
    page: { items: readonly ChatDTO[]; total: number; nextCursor?: string | null },
    userId: string,
    cachedChatItems: readonly ChatDTO[]
  ): boolean {
    return page.items.length === 0
      && page.total === 0
      && this.resolveCachedActivitiesChatItems(userId, cachedChatItems).length > 0;
  }

  private buildCachedActivitiesChatPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    cachedChatItems: readonly ChatDTO[]
  ): { items: ChatDTO[]; total: number; nextCursor: null } {
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const pageIndex = Math.max(0, Math.trunc(Number(query.page) || 0));
    const filtered = this.resolveCachedActivitiesChatItems(userId, cachedChatItems).filter(item =>
      this.matchesActivitiesChatContextFilter(item, this.activitiesChatContextFilter(query))
      && this.matchesSupportCaseFilter(item, this.activitiesSupportCaseFilter(query))
    );
    const sorted = this.sortActivitiesChatPageDTOs(filtered, query);
    const startIndex = pageIndex * pageSize;
    return {
      items: sorted.slice(startIndex, startIndex + pageSize).map(item => this.cloneChatDTO(item)),
      total: sorted.length,
      nextCursor: null
    };
  }

  private resolveCachedActivitiesChatItems(
    userId: string,
    cachedChatItems: readonly ChatDTO[]
  ): ChatDTO[] {
    const source = cachedChatItems.length > 0
      ? cachedChatItems
      : this.peekChatItemsByUser(userId);
    return this.deduplicateChatDTOs(source.map(item => this.toCachedDemoChatDTO(item, userId)));
  }

  private toCachedDemoChatDTO(item: ChatDTO, ownerUserId: string): ChatDTO {
    return {
      id: `${item.id ?? ''}`.trim(),
      avatar: `${item.avatar ?? ''}`.trim(),
      title: `${item.title ?? ''}`.trim(),
      lastMessage: `${item.lastMessage ?? ''}`.trim(),
      lastSenderId: `${item.lastSenderId ?? ''}`.trim(),
      memberIds: [...(item.memberIds ?? [])],
      members: this.cloneChatMembers(item.members),
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0)),
      dateIso: item.dateIso,
      distanceKm: item.distanceKm,
      distanceMetersExact: item.distanceMetersExact,
      channelType: item.channelType,
      serviceContext: item.serviceContext,
      ownerId: item.ownerId,
      supportCase: this.cloneSupportCase(item.supportCase),
      ownerUserId,
      metrics: this.cloneMetrics(item.metrics)
    };
  }

  private toActivitiesChatPageDTO(page: {
    items: readonly ChatDTO[];
    total: number;
    nextCursor?: string | null;
  }): ActivitiesChatPageResultDTO {
    return {
      items: page.items.map(item => this.cloneChatDTO(item)),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: page.nextCursor ?? null
    };
  }

  private cloneMetrics(metrics: ChatMetricsDTO | null | undefined): ChatMetricsDTO | null {
    return metrics
      ? {
          members: metrics.members ? { ...metrics.members } : null,
          car: metrics.car ? { ...metrics.car } : null,
          accommodation: metrics.accommodation ? { ...metrics.accommodation } : null,
          supplies: metrics.supplies ? { ...metrics.supplies } : null,
          groupsCount: metrics.groupsCount ?? null,
          pendingTotal: Math.max(0, Math.trunc(Number(metrics.pendingTotal) || 0))
        }
      : null;
  }

  private resolveChatMembers(
    members: readonly ChatMemberSummaryDto[] | null | undefined,
    memberIds: readonly string[] | null | undefined
  ): ChatMemberSummaryDto[] {
    const explicitMembers = this.cloneChatMembers(members);
    if (explicitMembers.length > 0) {
      return explicitMembers;
    }
    return (memberIds ?? [])
      .map(memberId => `${memberId ?? ''}`.trim())
      .filter((memberId, index, source) => memberId.length > 0 && source.indexOf(memberId) === index)
      .flatMap(memberId => {
        const user = this.userProfileStore.getUserProfile(memberId);
        if (!user || user.id !== memberId) {
          return [];
        }
        const label = `${user.name ?? ''}`.trim() || memberId;
        return [{
          id: memberId,
          name: label,
          initials: `${user.initials ?? ''}`.trim() || AppUtils.initialsFromText(label),
          gender: this.normalizeHttpGender(user.gender),
          imageUrl: AppUtils.firstImageUrl(user.images)
        }];
      });
  }

  private cloneChatMembers(members: readonly ChatMemberSummaryDto[] | null | undefined): ChatMemberSummaryDto[] {
    return (members ?? []).map(member => ({
      ...member,
      name: `${member.name ?? ''}`.trim() || null,
      imageUrl: `${member.imageUrl ?? ''}`.trim() || null
    }));
  }

  private matchesActivitiesChatContextFilter(
    item: ChatDTO,
    filter: ContractTypes.ActivitiesChatContextFilter
  ): boolean {
    const normalizedFilter = filter === 'event' || filter === 'subEvent' || filter === 'group' || filter === 'service' || filter === 'appSupport'
      ? filter
      : 'all';
    return normalizedFilter === 'all' || this.activityChatContextFilterKey(item) === normalizedFilter;
  }

  private activityChatContextFilterKey(
    item: Pick<ContractTypes.ChatDTO, 'channelType' | 'serviceContext'>
  ): ContractTypes.ActivitiesChatContextFilter {
    if (item.channelType === 'appSupport' || item.channelType === 'supportCase') {
      return 'appSupport';
    }
    if (item.channelType === 'serviceEvent' || item.serviceContext) {
      return 'service';
    }
    if (item.channelType === 'groupSubEvent') {
      return 'group';
    }
    if (item.channelType === 'optionalSubEvent') {
      return 'subEvent';
    }
    if (item.channelType === 'mainEvent') {
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

  private matchesSupportCaseFilter(
    item: Pick<ChatDTO, 'supportCase'>,
    filter?: ContractTypes.SupportCaseFilter
  ): boolean {
    const normalizedFilter = filter === 'pending' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
      ? filter
      : 'all';
    return normalizedFilter === 'all' || item.supportCase?.status === normalizedFilter;
  }

  private sortActivitiesChatPageDTOs(
    items: readonly ChatDTO[],
    query: ListQuery<ActivitiesFeedFilters>
  ): ChatDTO[] {
    const sorted = items.map(item => this.cloneChatDTO(item));
    if (this.activitiesSecondaryFilter(query) === 'relevant') {
      return sorted.sort((left, right) =>
        this.chatMetricScore(right) - this.chatMetricScore(left)
        || AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
        || left.id.localeCompare(right.id)
      );
    }
    return sorted.sort((left, right) =>
      AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
      || left.id.localeCompare(right.id)
    );
  }

  private chatMetricScore(item: Pick<ChatDTO, 'unread' | 'memberIds'>): number {
    const unread = Math.max(0, Math.trunc(Number(item.unread) || 0));
    const memberCount = new Set(
      (item.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    ).size;
    return unread * 10 + memberCount;
  }

  private mapChatMessage(
    message: HttpChatMessageDto,
    chatId = '',
    _fallbackIndex: number | null = null
  ): ContractTypes.ChatMessageDto {
    const senderAvatar = message.senderAvatar ?? null;
    const senderId = this.normalizeHttpText(message.senderId) || this.normalizeHttpText(senderAvatar?.id);
    const senderName = this.normalizeHttpText(message.senderName) || this.normalizeHttpText(message.sender) || senderId || 'User';
    const senderInitials = this.normalizeHttpText(message.senderInitials)
      || this.normalizeHttpText(senderAvatar?.initials)
      || AppUtils.initialsFromText(senderName || senderId || 'User');
    const senderGender = this.normalizeHttpGender(message.senderGender ?? senderAvatar?.gender);
    const senderImageUrl = this.normalizeHttpMediaUrl(message.senderImageUrl, 'small')
      ?? this.resolveHttpChatAvatarImageUrl(senderId, senderAvatar);
    const text = this.normalizeHttpText(message.text);
    const sentAtIso = this.normalizeHttpText(message.sentAtIso) || new Date().toISOString();
    const sentAt = new Date(sentAtIso);
    const activeUserId = this.activeUserId();
    const deleted = typeof message.deletedAtIso === 'string' && message.deletedAtIso.trim().length > 0;
    const id = this.resolveHttpChatMessageId(message, {
      chatId,
      senderId,
      sentAtIso,
      text
    });
    return {
      id,
      clientId: this.normalizeHttpText(message.clientId) || undefined,
      sender: senderName,
      senderAvatar: {
        id: senderId,
        initials: senderInitials,
        gender: senderGender,
        imageUrl: senderImageUrl
      },
      text: deleted ? '' : text,
      time: Number.isNaN(sentAt.getTime())
        ? this.normalizeHttpText(message.time)
        : sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso,
      mine: message.mine === true || (!!activeUserId && senderId === activeUserId),
      readBy: deleted ? [] : (message.readBy ?? [])
        .filter(reader => `${reader.id ?? ''}`.trim() !== senderId)
        .map(reader => ({
          id: `${reader.id ?? ''}`.trim(),
          initials: `${reader.initials ?? ''}`.trim(),
          gender: this.normalizeHttpGender(reader.gender),
          imageUrl: this.normalizeHttpMediaUrl(reader.imageUrl, 'small')
            ?? this.resolveHttpChatAvatarImageUrl(`${reader.id ?? ''}`.trim(), null)
        })),
      deletedAtIso: message.deletedAtIso ?? null,
      deletedByUserId: message.deletedByUserId ?? null,
      deletedByName: message.deletedByName ?? null,
      editedAtIso: deleted ? null : message.editedAtIso ?? null,
      pinnedAtIso: deleted ? null : message.pinnedAtIso ?? null,
      pinnedByUserId: deleted ? null : message.pinnedByUserId ?? null,
      replyTo: deleted ? null : message.replyTo ? { ...message.replyTo } : null,
      reactions: deleted ? [] : (message.reactions ?? []).map(reaction => ({
        ...reaction,
        userGender: this.normalizeHttpGender(reaction.userGender)
      })),
      attachments: deleted ? [] : (message.attachments ?? []).map(attachment => this.mapChatAttachment(attachment))
    } satisfies ContractTypes.ChatMessageDto;
  }

  private resolveHttpChatMessageId(
    message: HttpChatMessageDto,
    context: {
      chatId: string;
      senderId: string;
      sentAtIso: string;
      text: string;
    }
  ): string {
    const id = this.normalizeHttpText(message.id);
    if (id) {
      return id;
    }
    const clientId = this.normalizeHttpText(message.clientId);
    if (clientId) {
      return `client:${clientId}`;
    }
    const attachmentKey = (message.attachments ?? [])
      .map(attachment => [
        this.normalizeHttpText(attachment.id),
        this.normalizeHttpText(attachment.type),
        this.normalizeHttpText(attachment.title)
      ].join(':'))
      .join(',');
    const seed = [
      this.normalizeHttpText(context.chatId),
      context.senderId,
      context.sentAtIso,
      context.text,
      attachmentKey
    ].join('|');
    return `http-message:${AppUtils.hashText(seed)}`;
  }

  private normalizeHttpText(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private normalizeHttpGender(value: unknown): ContractTypes.ChatUserGender {
    const normalized = this.normalizeHttpText(value).toLowerCase();
    if (normalized === 'deleted' || normalized === 'du') {
      return 'deleted';
    }
    return normalized === 'woman' || normalized.startsWith('w') || normalized.startsWith('f')
      ? 'woman'
      : 'man';
  }

  private normalizeSupportCaseStatus(value: unknown): ContractTypes.SupportCaseStatus | null {
    const normalized = this.normalizeHttpText(value).toLowerCase();
    return normalized === 'pending' || normalized === 'picked' || normalized === 'solved' || normalized === 'blocked'
      ? normalized
      : null;
  }

  private resolveHttpChatAvatarImageUrl(
    userId: string,
    avatar: HttpChatSenderAvatarDto | null
  ): string | null {
    void userId;
    return this.normalizeHttpMediaUrl(avatar?.imageUrl ?? avatar?.avatarUrl ?? avatar?.url, 'small');
  }

  private normalizeHttpMediaUrl(value: unknown, variant?: 'small' | 'medium' | 'large'): string | null {
    const url = this.normalizeHttpText(value);
    if (!url) {
      return null;
    }
    let resolvedUrl: string;
    if (/^(?:https?:|data:|blob:|indexeddb:)/i.test(url) || url.startsWith('/api/')) {
      resolvedUrl = url;
    } else {
      const baseUrl = this.apiBaseUrl.replace(/\/+$/, '');
      if (url.startsWith('/media/')) {
        resolvedUrl = `${baseUrl}${url}`;
      } else if (url.startsWith('media/')) {
        resolvedUrl = `${baseUrl}/${url}`;
      } else {
        resolvedUrl = url;
      }
    }
    return variant ? AppUtils.mediaImageVariantUrl(resolvedUrl, variant) : resolvedUrl;
  }

  private toHttpChatReply(replyTo: ContractTypes.ChatMessageDto['replyTo']): HttpChatMessageReplyDto | null {
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

  private mapChatMember(
    member: HttpChatMemberDto,
    chatId: string,
    index: number
  ): ActivityContracts.ActivityMemberDTO {
    const userId = this.normalizeHttpText(member.userId) || this.normalizeHttpText(member.id) || `chat-member-${index + 1}`;
    const name = this.normalizeHttpText(member.name) || userId;
    const initials = this.normalizeHttpText(member.initials) || AppUtils.initialsFromText(name);
    const gender = member.gender === 'woman' || member.gender === 'man' ? member.gender : 'man';
    const status = member.status === 'pending' || member.status === 'disqualified' ? member.status : 'accepted';
    const pendingSource = member.pendingSource === 'admin' || member.pendingSource === 'member' ? member.pendingSource : null;
    const requestKind = member.requestKind === 'invite'
      || member.requestKind === 'join'
      || member.requestKind === 'waitlist'
      || member.requestKind === 'waitlist-invite'
      ? member.requestKind
      : null;
    const avatarUrl = this.normalizeHttpMediaUrl(member.avatarUrl ?? member.imageUrl, 'small') ?? '';
    const nowIso = this.normalizeHttpText(member.actionAtIso)
      || this.normalizeHttpText(member.metAtIso)
      || new Date().toISOString();
    return {
      id: this.normalizeHttpText(member.id) || `chat:${chatId}:${userId}`,
      userId,
      name,
      initials,
      gender,
      city: this.normalizeHttpText(member.city),
      statusText: this.normalizeHttpText(member.statusText) || 'Chat member',
      role: member.role === 'Admin' || member.role === 'Manager' ? member.role : 'Member',
      status,
      pendingSource,
      requestKind,
      invitedByActiveUser: member.invitedByActiveUser === true,
      invitedByUserId: this.normalizeHttpText(member.invitedByUserId) || null,
      metAtIso: this.normalizeHttpText(member.metAtIso) || nowIso,
      actionAtIso: nowIso,
      metWhere: this.normalizeHttpText(member.metWhere) || 'Chat',
      avatarUrl,
      profile: member.profile ?? null
    };
  }

  private mapChatAttachment(attachment: HttpChatMessageAttachmentDto): ContractTypes.ChatMessageAttachment {
    return {
      id: `${attachment.id ?? ''}`.trim(),
      type: attachment.type,
      title: `${attachment.title ?? ''}`.trim(),
      entityId: typeof attachment.entityId === 'string' ? attachment.entityId.trim() : null,
      assetType: this.normalizeAssetType(attachment.assetType),
      ownerUserId: typeof attachment.ownerUserId === 'string' ? attachment.ownerUserId.trim() : null,
      status: this.normalizeAttachmentStatus(attachment.status),
      unavailableReason: typeof attachment.unavailableReason === 'string' ? attachment.unavailableReason.trim() : null,
      subtitle: typeof attachment.subtitle === 'string' ? attachment.subtitle.trim() : null,
      description: typeof attachment.description === 'string' ? attachment.description.trim() : null,
      url: this.normalizeHttpMediaUrl(attachment.url),
      previewUrl: this.normalizeHttpMediaUrl(attachment.previewUrl, 'medium'),
      mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType.trim() : null,
      sizeBytes: Number.isFinite(Number(attachment.sizeBytes)) ? Math.max(0, Math.trunc(Number(attachment.sizeBytes))) : null
    };
  }

  private mapChatReadReceipt(read: HttpChatReadReceiptDto | null | undefined): ContractTypes.ChatReadReceipt | null {
    const userId = this.normalizeHttpText(read?.userId);
    if (!userId) {
      return null;
    }
    return {
      userId,
      userInitials: this.normalizeHttpText(read?.userInitials),
      userGender: this.normalizeHttpGender(read?.userGender),
      messageIds: (read?.messageIds ?? [])
        .map(messageId => this.normalizeHttpText(messageId))
        .filter(Boolean),
      readAtIso: this.normalizeHttpText(read?.readAtIso) || AppUtils.toIsoDateTime(new Date()),
      unread: read?.unread === undefined || read.unread === null
        ? null
        : Math.max(0, Math.trunc(Number(read.unread) || 0))
    };
  }

  private toHttpChatAttachment(attachment: ContractTypes.ChatMessageAttachment): HttpChatMessageAttachmentDto {
    return {
      id: `${attachment.id ?? ''}`.trim(),
      type: attachment.type,
      title: `${attachment.title ?? ''}`.trim(),
      entityId: attachment.entityId ?? null,
      assetType: attachment.assetType ?? null,
      ownerUserId: attachment.ownerUserId ?? null,
      status: attachment.status ?? null,
      unavailableReason: attachment.unavailableReason ?? null,
      subtitle: attachment.subtitle ?? null,
      description: attachment.description ?? null,
      url: attachment.url ?? null,
      previewUrl: attachment.previewUrl ?? null,
      mimeType: attachment.mimeType ?? null,
      sizeBytes: Number.isFinite(Number(attachment.sizeBytes)) ? Math.max(0, Math.trunc(Number(attachment.sizeBytes))) : null
    };
  }

  private normalizeAssetType(value: unknown): AppConstants.AssetType | null {
    return value === 'Car' || value === 'Accommodation' || value === 'Supplies' ? value : null;
  }

  private normalizeAttachmentStatus(value: unknown): ContractTypes.ChatMessageAttachment['status'] {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'available' || normalized === 'unavailable') {
      return normalized;
    }
    return null;
  }

  private updateCachedChatSummaryAfterMessage(
    chat: ChatDTO,
    message: ContractTypes.ChatMessageDto
  ): void {
    const ownerUserId = this.activeUserId();
    if (!ownerUserId) {
      return;
    }
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!normalizedChatId) {
      return;
    }
    this.cacheChatMessagesFor(ownerUserId, normalizedChatId, [message]);
    const currentItems = (this.chatItemsByUserId.get(ownerUserId) ?? []).map(item => this.cloneChatDTO(item));
    const existingIndex = currentItems.findIndex(item => item.id === normalizedChatId);
    const existingItem = existingIndex >= 0 ? currentItems[existingIndex] : null;
    const nextItem = this.buildCachedChatDTOFromMessage(chat, ownerUserId, message, existingItem);
    if (existingIndex >= 0) {
      currentItems[existingIndex] = nextItem;
    } else {
      currentItems.push(nextItem);
    }
    this.chatItemsByUserId.set(ownerUserId, this.sortCachedChatDTOs(currentItems));
  }

  private buildCachedChatDTOFromMessage(
    chat: ChatDTO,
    ownerUserId: string,
    message: ContractTypes.ChatMessageDto,
    existingItem: ChatDTO | null
  ): ChatDTO {
    const sanitizedDistanceKm = Number.isFinite(Number(chat.distanceKm))
      ? Math.max(0, Number(chat.distanceKm))
      : existingItem?.distanceKm;
    const sanitizedDistanceMetersExact = Number.isFinite(Number(chat.distanceMetersExact))
      ? Math.max(0, Math.trunc(Number(chat.distanceMetersExact)))
      : existingItem?.distanceMetersExact;
    return {
      id: `${chat.id ?? existingItem?.id ?? ''}`.trim(),
      avatar: `${chat.avatar ?? existingItem?.avatar ?? ''}`.trim(),
      title: `${chat.title ?? existingItem?.title ?? ''}`.trim(),
      lastMessage: `${message.text ?? ''}`.trim() || this.chatAttachmentSummary(message) || `${existingItem?.lastMessage ?? ''}`.trim(),
      lastSenderId: `${message.senderAvatar?.id ?? existingItem?.lastSenderId ?? ''}`.trim(),
      memberIds: [...((chat.memberIds?.length ? chat.memberIds : existingItem?.memberIds) ?? [])],
      members: this.cloneChatMembers(chat.members?.length ? chat.members : existingItem?.members),
      unread: message.mine ? 0 : Math.max(0, Math.trunc(Number(existingItem?.unread) || 0)),
      dateIso: `${message.sentAtIso ?? existingItem?.dateIso ?? ''}`.trim() || undefined,
      channelType: chat.channelType ?? existingItem?.channelType,
      serviceContext: chat.serviceContext ?? existingItem?.serviceContext,
      ownerId: chat.ownerId ?? existingItem?.ownerId,
      supportCase: this.cloneSupportCase(chat.supportCase ?? existingItem?.supportCase),
      distanceKm: sanitizedDistanceKm,
      distanceMetersExact: sanitizedDistanceMetersExact,
      ownerUserId,
      metrics: this.cloneMetrics(chat.metrics ?? existingItem?.metrics)
    } satisfies ChatDTO;
  }

  private resolveCachedChatMessages(chat: ChatDTO): ContractTypes.ChatMessageDto[] {
    const ownerUserId = this.activeUserId();
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!ownerUserId || !normalizedChatId) {
      return [];
    }
    const key = this.chatMessageCacheKey(ownerUserId, normalizedChatId);
    return (this.chatMessagesByOwnerChatKey.get(key) ?? []).map(message => ({
      ...message,
      readBy: [...(message.readBy ?? [])],
      replyTo: message.replyTo ? { ...message.replyTo } : message.replyTo,
      reactions: message.reactions?.map(reaction => ({ ...reaction })),
      attachments: message.attachments?.map(attachment => ({ ...attachment }))
    }));
  }

  private cacheChatMessages(chat: ChatDTO, messages: readonly ContractTypes.ChatMessageDto[]): void {
    const ownerUserId = this.activeUserId();
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    if (!ownerUserId || !normalizedChatId || messages.length === 0) {
      return;
    }
    this.cacheChatMessagesFor(ownerUserId, normalizedChatId, messages);
  }

  private cacheChatMessagesFor(
    ownerUserId: string,
    chatId: string,
    messages: readonly ContractTypes.ChatMessageDto[]
  ): void {
    const key = this.chatMessageCacheKey(ownerUserId, chatId);
    if (!key || messages.length === 0) {
      return;
    }
    const existingMessages = this.chatMessagesByOwnerChatKey.get(key) ?? [];
    this.chatMessagesByOwnerChatKey.set(
      key,
      this.mergeCachedChatMessages(existingMessages, messages)
    );
  }

  private chatMessageCacheKey(ownerUserId: string, chatId: string): string {
    const normalizedOwnerUserId = `${ownerUserId ?? ''}`.trim();
    const normalizedChatId = `${chatId ?? ''}`.trim();
    return normalizedOwnerUserId && normalizedChatId ? `${normalizedOwnerUserId}:${normalizedChatId}` : '';
  }

  private mergeCachedChatMessages(
    baseMessages: readonly ContractTypes.ChatMessageDto[],
    extraMessages: readonly ContractTypes.ChatMessageDto[]
  ): ContractTypes.ChatMessageDto[] {
    const mergedById = new Map<string, ContractTypes.ChatMessageDto>();
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

  private chatMessageIdentity(message: ContractTypes.ChatMessageDto | null | undefined): string {
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

  private sortCachedChatDTOs(items: readonly ChatDTO[]): ChatDTO[] {
    return this.deduplicateChatDTOs(items)
      .map(item => this.cloneChatDTO(item))
      .sort((left, right) =>
        AppUtils.toSortableDate(right.dateIso ?? '') - AppUtils.toSortableDate(left.dateIso ?? '')
        || left.id.localeCompare(right.id)
      );
  }

  private mapSocketEvent(
    payload: HttpChatMessageDto | HttpChatSocketEventDto,
    fallbackChatId: string
  ): ContractTypes.ChatLiveEvent | null {
    if (this.isHttpChatMessagePayload(payload)) {
      return {
        type: 'message',
        chatId: fallbackChatId,
        message: this.mapChatMessage(payload, fallbackChatId)
      };
    }

    const type = payload.type ?? 'message';
    const chatId = `${payload.chatId ?? fallbackChatId}`.trim() || fallbackChatId;
    if (type === 'ack') {
      return {
        type: 'ack',
        chatId,
        message: payload.message ? this.mapChatMessage(payload.message, chatId) : undefined,
        messageId: `${payload.messageId ?? payload.message?.id ?? ''}`.trim() || undefined,
        clientId: `${payload.clientId ?? payload.message?.clientId ?? ''}`.trim() || undefined
      };
    }
    if (type === 'typing' && payload.typing) {
      return {
        type: 'typing',
        chatId,
        typing: {
          userId: `${payload.typing.userId ?? ''}`.trim(),
          userName: `${payload.typing.userName ?? ''}`.trim(),
          userInitials: `${payload.typing.userInitials ?? ''}`.trim(),
          userGender: this.normalizeHttpGender(payload.typing.userGender),
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
          userGender: this.normalizeHttpGender(payload.read.userGender),
          messageIds: (payload.read.messageIds ?? []).map((messageId: unknown) => `${messageId ?? ''}`.trim()).filter(Boolean),
          readAtIso: `${payload.read.readAtIso ?? ''}`.trim(),
          unread: payload.read.unread === null || payload.read.unread === undefined
            ? null
            : Math.max(0, Math.trunc(Number(payload.read.unread) || 0))
        }
      };
    }
    if (type === 'error') {
      return {
        type: 'error',
        chatId,
        messageId: `${payload.messageId ?? ''}`.trim() || undefined,
        clientId: `${payload.clientId ?? ''}`.trim() || undefined,
        error: `${payload.error ?? ''}`.trim() || undefined
      };
    }
    if (payload.message) {
      return {
        type: 'message',
        chatId,
        message: this.mapChatMessage(payload.message, chatId)
      };
    }
    return null;
  }

  private isHttpChatMessagePayload(
    payload: HttpChatMessageDto | HttpChatSocketEventDto
  ): payload is HttpChatMessageDto {
    return !Object.prototype.hasOwnProperty.call(payload, 'type')
      || Object.prototype.hasOwnProperty.call(payload, 'senderId')
      || Object.prototype.hasOwnProperty.call(payload, 'senderName')
      || Object.prototype.hasOwnProperty.call(payload, 'senderAvatar')
      || Object.prototype.hasOwnProperty.call(payload, 'sentAtIso');
  }

  private async ensureSocket(chat: ChatDTO): Promise<WebSocket | null> {
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
          const raw = `${event.data ?? ''}`;
          const parsed = JSON.parse(raw) as HttpChatMessageDto | HttpChatSocketEventDto;
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
    if (this.sessionService.currentSession()?.kind === 'demo') {
      baseUrl.searchParams.set('sessionKind', 'demo');
    }
    if (this.sessionService.currentSession()?.kind === 'firebase') {
      const token = await this.sessionService.getFirebaseIdToken();
      if (!token) {
        return null;
      }
      baseUrl.searchParams.set('token', token);
    }
    return baseUrl.toString();
  }

  private activeUserId(): string {
    return this.userProfileStore.activeUserId().trim();
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

  private emitSocketEvent(event: ContractTypes.ChatLiveEvent): void {
    if (event.type === 'message') {
      const normalizedClientId = `${event.message.clientId ?? ''}`.trim();
      const normalizedMessageId = `${event.message.id ?? ''}`.trim();
      this.clearPendingSocketMessage(normalizedClientId);
      this.resolvePendingSocketAck(normalizedClientId, event.message);
      this.resolvePendingSocketUpdate(normalizedMessageId, event.message);
      this.updateCachedChatSummaryFromSocketEvent(event.chatId, event.message);
    }
    if (event.type === 'ack') {
      const normalizedClientId = `${event.clientId ?? event.message?.clientId ?? ''}`.trim();
      const normalizedMessageId = `${event.messageId ?? event.message?.id ?? ''}`.trim();
      this.clearPendingSocketMessage(normalizedClientId);
      this.resolvePendingSocketAck(normalizedClientId, event.message ?? null);
      this.resolvePendingSocketUpdate(normalizedMessageId, event.message ?? null);
      if (event.message) {
        this.updateCachedChatSummaryFromSocketEvent(event.chatId, event.message);
      }
    }
    if (event.type === 'read') {
      this.updateCachedChatUnread(event.chatId, event.read);
      this.resolvePendingSocketReads(event.chatId, event.read);
    }
    if (event.type === 'error') {
      const normalizedClientId = `${event.clientId ?? ''}`.trim();
      const normalizedMessageId = `${event.messageId ?? ''}`.trim();
      this.clearPendingSocketMessage(normalizedClientId);
      this.resolvePendingSocketAck(normalizedClientId, null);
      this.resolvePendingSocketUpdate(normalizedMessageId, null);
    }
    for (const listener of this.socketListeners) {
      listener(event);
    }
    this.closeSocketIfIdle();
  }

  private updateCachedChatSummaryFromSocketEvent(
    chatId: string,
    message: ContractTypes.ChatMessageDto
  ): void {
    const ownerUserId = this.activeUserId();
    if (!ownerUserId) {
      return;
    }
    const currentItems = this.chatItemsByUserId.get(ownerUserId) ?? [];
    const existingItem = currentItems.find(item => item.id === chatId) ?? null;
    if (!existingItem) {
      return;
    }
    this.updateCachedChatSummaryAfterMessage(existingItem, message);
  }

  private updateCachedChatUnread(
    chatId: string,
    read: ContractTypes.ChatReadReceipt
  ): void {
    const ownerUserId = this.activeUserId();
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!ownerUserId || !normalizedChatId || read.userId !== ownerUserId || read.unread === undefined || read.unread === null) {
      return;
    }
    const unread = Math.max(0, Math.trunc(Number(read.unread) || 0));
    const currentItems = this.chatItemsByUserId.get(ownerUserId) ?? [];
    let changed = false;
    const nextItems = currentItems.map(item => {
      if (`${item.id ?? ''}`.trim() !== normalizedChatId || Math.max(0, Math.trunc(Number(item.unread) || 0)) === unread) {
        return item;
      }
      changed = true;
      return {
        ...item,
        unread
      };
    });
    if (changed) {
      this.chatItemsByUserId.set(ownerUserId, nextItems);
    }
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
    if (
      this.socketListeners.size > 0
      || this.pendingSocketMessageIds.size > 0
      || this.pendingSocketUpdateResolvers.size > 0
      || this.pendingSocketReadResolvers.size > 0
    ) {
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
    for (const [messageId, pending] of this.pendingSocketUpdateResolvers.entries()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
      this.pendingSocketUpdateResolvers.delete(messageId);
    }
    for (const [key, pending] of this.pendingSocketReadResolvers.entries()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
      this.pendingSocketReadResolvers.delete(key);
    }
  }

  private waitForSocketMessageAck(clientId: string): Promise<ContractTypes.ChatMessageDto | null> {
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
    return new Promise<ContractTypes.ChatMessageDto | null>(resolve => {
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
    message: ContractTypes.ChatMessageDto | null
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

  private waitForSocketMessageUpdate(messageId: string): Promise<ContractTypes.ChatMessageDto | null> {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedMessageId) {
      return Promise.resolve(null);
    }
    const existingPending = this.pendingSocketUpdateResolvers.get(normalizedMessageId);
    if (existingPending) {
      clearTimeout(existingPending.timer);
      this.pendingSocketUpdateResolvers.delete(normalizedMessageId);
      existingPending.resolve(null);
    }
    return new Promise<ContractTypes.ChatMessageDto | null>(resolve => {
      const timer = setTimeout(() => {
        this.pendingSocketUpdateResolvers.delete(normalizedMessageId);
        resolve(null);
        this.closeSocketIfIdle();
      }, HttpChatsService.SOCKET_MESSAGE_ACK_TIMEOUT_MS);
      this.pendingSocketUpdateResolvers.set(normalizedMessageId, { resolve, timer });
    });
  }

  private resolvePendingSocketUpdate(
    messageId: string,
    message: ContractTypes.ChatMessageDto | null
  ): void {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedMessageId) {
      return;
    }
    const pending = this.pendingSocketUpdateResolvers.get(normalizedMessageId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingSocketUpdateResolvers.delete(normalizedMessageId);
    pending.resolve(message);
  }

  private waitForSocketRead(
    chatId: string,
    messageIds: readonly string[]
  ): Promise<ContractTypes.ChatReadReceipt | null> {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    const normalizedMessageIds = new Set(
      (messageIds ?? [])
        .map(messageId => `${messageId ?? ''}`.trim())
        .filter(Boolean)
    );
    if (!normalizedChatId || normalizedMessageIds.size === 0) {
      return Promise.resolve(null);
    }
    const key = `read:${normalizedChatId}:${Date.now()}:${++this.socketMessageSequence}`;
    return new Promise<ContractTypes.ChatReadReceipt | null>(resolve => {
      const timer = setTimeout(() => {
        this.pendingSocketReadResolvers.delete(key);
        resolve(null);
        this.closeSocketIfIdle();
      }, HttpChatsService.SOCKET_MESSAGE_ACK_TIMEOUT_MS);
      this.pendingSocketReadResolvers.set(key, {
        chatId: normalizedChatId,
        messageIds: normalizedMessageIds,
        resolve,
        timer
      });
    });
  }

  private resolvePendingSocketReads(
    chatId: string,
    read: ContractTypes.ChatReadReceipt
  ): void {
    const normalizedChatId = `${chatId ?? ''}`.trim();
    if (!normalizedChatId || read.userId !== this.activeUserId()) {
      return;
    }
    const readMessageIds = new Set((read.messageIds ?? []).map(messageId => `${messageId ?? ''}`.trim()).filter(Boolean));
    for (const [key, pending] of this.pendingSocketReadResolvers.entries()) {
      if (pending.chatId !== normalizedChatId || !this.pendingSocketReadMatches(pending.messageIds, readMessageIds)) {
        continue;
      }
      clearTimeout(pending.timer);
      this.pendingSocketReadResolvers.delete(key);
      pending.resolve(read);
    }
  }

  private pendingSocketReadMatches(
    pendingMessageIds: ReadonlySet<string>,
    readMessageIds: ReadonlySet<string>
  ): boolean {
    if (pendingMessageIds.size === 0 || readMessageIds.size === 0) {
      return false;
    }
    for (const messageId of pendingMessageIds) {
      if (readMessageIds.has(messageId)) {
        return true;
      }
    }
    return false;
  }

}

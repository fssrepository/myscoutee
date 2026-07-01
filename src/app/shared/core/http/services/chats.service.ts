import type { ChatThreadRecord } from '../../local/source/entity/chat.entity';
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
  ChatDTO
} from '../../contracts/chat.interface';
import type { IChatsService } from '../../contracts/activity.interface';
import type { ActivitiesFeedFilters, ListQuery } from '../../contracts';
import {
  SessionService
} from '../../base/services/session.service';

import type * as ActivityContracts from '../../contracts/activity.interface';

import type * as AppDTOs from '../../contracts';
import type * as AppConstants from '../../common/constants';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';

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
  supportCaseStatus?: ContractTypes.SupportCaseStatus | string | null;
  supportCaseAssigneeUserId?: string | null;
  supportCaseAssigneeName?: string | null;
  supportCaseAssigneeInitials?: string | null;
  supportCaseUpdatedAtIso?: string | null;
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
  private readonly chatItemsByUserId = new Map<string, ChatThreadRecord[]>();
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
      resolve: (message: ContractTypes.ChatPopupMessage | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly pendingSocketUpdateResolvers = new Map<
    string,
    {
      resolve: (message: ContractTypes.ChatPopupMessage | null) => void;
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
      return records.map(record => this.toChatDTO(record));
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
        items?: HttpChatSummaryDto[] | null;
        total?: number | null;
        nextCursor?: string | null;
      } | null>(`${this.apiBaseUrl}/activities/chats/page`, { params }).toPromise();

      const page = {
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
    const records = this.chatItemsByUserId.get(normalizedUserId) ?? [];
    return records.map(record => this.toChatDTO(record));
  }

  async loadChatMessages(chat: ChatDTO): Promise<ContractTypes.ChatPopupMessage[]> {
    try {
      const response = await this.http
        .get<HttpChatMessageDto[]>(`${this.apiBaseUrl}/activities/chats/${encodeURIComponent(chat.id)}/messages`, {
          params: this.activeUserParams()
        })
        .toPromise();

      const messages = (response ?? []).map((message, index) => this.mapChatMessage(message, chat.id, index));
      const cachedMessages = this.resolveCachedChatMessages(chat);

      return this.mergeCachedChatMessages(messages, cachedMessages)
        .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
    } catch {
      return this.resolveCachedChatMessages(chat);
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

  async sendChatMessage(chat: ChatDTO, text: string, clientId?: string): Promise<ContractTypes.ChatPopupMessage | null> {
    return this.sendChatMessageWithAttachments(chat, text, [], clientId);
  }

  async sendChatMessageWithAttachments(
    chat: ChatDTO,
    text: string,
    attachments: readonly ContractTypes.ChatMessageAttachment[] = [],
    clientId?: string,
    replyTo?: ContractTypes.ChatPopupMessage['replyTo']
  ): Promise<ContractTypes.ChatPopupMessage | null> {
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

  async markChatRead(chat: ChatDTO, messageIds: readonly string[]): Promise<void> {
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

  async updateSupportCase(chat: ChatDTO, action: ContractTypes.SupportCaseAction): Promise<ChatDTO | null> {
    const normalizedChatId = `${chat.id ?? ''}`.trim();
    const userId = this.activeUserId();
    if (!normalizedChatId || !userId) {
      return null;
    }
    try {
      const response = await this.http
        .post<HttpChatSummaryDto | null>(
          `${this.apiBaseUrl}/activities/chats/${encodeURIComponent(normalizedChatId)}/support-case`,
          { userId, action },
          { params: this.withUserId(new HttpParams(), userId) }
        )
        .toPromise();
      return response ? this.toChatDTO(this.mapChatRecord(response, userId)) : null;
    } catch {
      return null;
    }
  }

  async updateChatMessage(
    chat: ChatDTO,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): Promise<ContractTypes.ChatPopupMessage | null> {
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
    onMessage: (message: ContractTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return this.watchChatEvents(chat, event => {
      if (event.type === 'message') {
        onMessage(event.message);
      }
    });
  }

  private mapChatRecord(item: HttpChatSummaryDto, ownerUserId: string): ChatThreadRecord {
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
      supportCaseStatus: this.normalizeSupportCaseStatus(item.supportCaseStatus),
      supportCaseAssigneeUserId: this.normalizeHttpText(item.supportCaseAssigneeUserId) || null,
      supportCaseAssigneeName: this.normalizeHttpText(item.supportCaseAssigneeName) || null,
      supportCaseAssigneeInitials: this.normalizeHttpText(item.supportCaseAssigneeInitials) || null,
      supportCaseUpdatedAtIso: this.normalizeHttpText(item.supportCaseUpdatedAtIso) || null,
      ownerUserId
    } satisfies ChatThreadRecord;
  }

  private cloneChatRecord(record: ChatThreadRecord): ChatThreadRecord {
    return {
      ...record,
      memberIds: [...(record.memberIds ?? [])],
      messages: record.messages?.map(message => ({
        ...message,
        readBy: [...(message.readBy ?? [])],
        replyTo: message.replyTo ? { ...message.replyTo } : message.replyTo,
        reactions: message.reactions?.map(reaction => ({ ...reaction })),
        attachments: message.attachments?.map(attachment => ({ ...attachment }))
      }))
    };
  }

  private deduplicateChatRecords(records: readonly ChatThreadRecord[]): ChatThreadRecord[] {
    const uniqueById = new Map<string, ChatThreadRecord>();
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

  private shouldUseCachedActivitiesChatPage(
    page: { items: readonly ChatThreadRecord[]; total: number; nextCursor?: string | null },
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
  ): { items: ChatThreadRecord[]; total: number; nextCursor: null } {
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const pageIndex = Math.max(0, Math.trunc(Number(query.page) || 0));
    const filtered = this.resolveCachedActivitiesChatItems(userId, cachedChatItems).filter(item =>
      this.matchesActivitiesChatContextFilter(item, this.activitiesChatContextFilter(query))
      && this.matchesSupportCaseFilter(item, this.activitiesSupportCaseFilter(query))
    );
    const sorted = this.sortActivitiesChatPageRecords(filtered, query);
    const startIndex = pageIndex * pageSize;
    return {
      items: sorted.slice(startIndex, startIndex + pageSize).map(item => this.cloneChatRecord(item)),
      total: sorted.length,
      nextCursor: null
    };
  }

  private resolveCachedActivitiesChatItems(
    userId: string,
    cachedChatItems: readonly ChatDTO[]
  ): ChatThreadRecord[] {
    const source = cachedChatItems.length > 0
      ? cachedChatItems
      : this.peekChatItemsByUser(userId);
    return this.deduplicateChatRecords(source.map(item => this.toCachedDemoChatRecord(item, userId)));
  }

  private toCachedDemoChatRecord(item: ChatDTO, ownerUserId: string): ChatThreadRecord {
    return {
      id: `${item.id ?? ''}`.trim(),
      avatar: `${item.avatar ?? ''}`.trim(),
      title: `${item.title ?? ''}`.trim(),
      lastMessage: `${item.lastMessage ?? ''}`.trim(),
      lastSenderId: `${item.lastSenderId ?? ''}`.trim(),
      memberIds: [...(item.memberIds ?? [])],
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0)),
      dateIso: item.dateIso,
      distanceKm: item.distanceKm,
      distanceMetersExact: item.distanceMetersExact,
      channelType: item.channelType,
      serviceContext: item.serviceContext,
      eventId: item.eventId,
      subEventId: item.subEventId,
      groupId: item.groupId,
      supportCaseStatus: item.supportCaseStatus ?? null,
      supportCaseAssigneeUserId: item.supportCaseAssigneeUserId ?? null,
      supportCaseAssigneeName: item.supportCaseAssigneeName ?? null,
      supportCaseAssigneeInitials: item.supportCaseAssigneeInitials ?? null,
      supportCaseUpdatedAtIso: item.supportCaseUpdatedAtIso ?? null,
      ownerUserId
    };
  }

  private toActivitiesChatPageDTO(page: {
    items: readonly ChatThreadRecord[];
    total: number;
    nextCursor?: string | null;
  }): ActivitiesChatPageResultDTO {
    return {
      items: page.items.map(item => this.toChatDTO(item)),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: page.nextCursor ?? null
    };
  }

  private toChatDTO(item: ChatThreadRecord): ChatDTO {
    return {
      id: item.id,
      avatar: item.avatar,
      title: item.title,
      lastMessage: item.lastMessage,
      lastSenderId: item.lastSenderId,
      memberIds: [...(item.memberIds ?? [])],
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0)),
      dateIso: item.dateIso,
      distanceKm: item.distanceKm,
      distanceMetersExact: item.distanceMetersExact,
      channelType: item.channelType,
      serviceContext: item.serviceContext,
      eventId: item.eventId,
      subEventId: item.subEventId,
      groupId: item.groupId,
      supportCaseStatus: item.supportCaseStatus ?? null,
      supportCaseAssigneeUserId: item.supportCaseAssigneeUserId ?? null,
      supportCaseAssigneeName: item.supportCaseAssigneeName ?? null,
      supportCaseAssigneeInitials: item.supportCaseAssigneeInitials ?? null,
      supportCaseUpdatedAtIso: item.supportCaseUpdatedAtIso ?? null,
      ownerUserId: item.ownerUserId
    };
  }

  private matchesActivitiesChatContextFilter(
    item: ChatThreadRecord,
    filter: ContractTypes.ActivitiesChatContextFilter
  ): boolean {
    const normalizedFilter = filter === 'event' || filter === 'subEvent' || filter === 'group' || filter === 'service'
      ? filter
      : 'all';
    return normalizedFilter === 'all' || this.activityChatContextFilterKey(item) === normalizedFilter;
  }

  private activityChatContextFilterKey(
    item: Pick<ContractTypes.ChatDTO, 'channelType' | 'serviceContext'>
  ): ContractTypes.ActivitiesChatContextFilter {
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
    return value === 'event' || value === 'subEvent' || value === 'group' || value === 'service' ? value : 'all';
  }

  private activitiesSupportCaseFilter(query: ListQuery<ActivitiesFeedFilters>): ContractTypes.SupportCaseFilter {
    const value = query.filters?.supportCaseFilter;
    return value === 'pending' || value === 'picked' || value === 'solved' || value === 'blocked' ? value : 'all';
  }

  private matchesSupportCaseFilter(
    item: Pick<ChatThreadRecord, 'supportCaseStatus'>,
    filter?: ContractTypes.SupportCaseFilter
  ): boolean {
    const normalizedFilter = filter === 'pending' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
      ? filter
      : 'all';
    return normalizedFilter === 'all' || item.supportCaseStatus === normalizedFilter;
  }

  private sortActivitiesChatPageRecords(
    records: readonly ChatThreadRecord[],
    query: ListQuery<ActivitiesFeedFilters>
  ): ChatThreadRecord[] {
    const sorted = records.map(record => this.cloneChatRecord(record));
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

  private chatMetricScore(item: Pick<ChatThreadRecord, 'unread' | 'memberIds'>): number {
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
    fallbackIndex: number | null = null
  ): ContractTypes.ChatPopupMessage {
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
    } satisfies ContractTypes.ChatPopupMessage;
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

  private toHttpChatReply(replyTo: ContractTypes.ChatPopupMessage['replyTo']): HttpChatMessageReplyDto | null {
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
    message: ContractTypes.ChatPopupMessage
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
    chat: ChatDTO,
    ownerUserId: string,
    message: ContractTypes.ChatPopupMessage,
    existingRecord: ChatThreadRecord | null
  ): ChatThreadRecord {
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
    } satisfies ChatThreadRecord;
  }

  private resolveCachedChatMessages(chat: ChatDTO): ContractTypes.ChatPopupMessage[] {
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
    baseMessages: readonly ContractTypes.ChatPopupMessage[],
    extraMessages: readonly ContractTypes.ChatPopupMessage[]
  ): ContractTypes.ChatPopupMessage[] {
    const mergedById = new Map<string, ContractTypes.ChatPopupMessage>();
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

  private chatMessageIdentity(message: ContractTypes.ChatPopupMessage | null | undefined): string {
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

  private sortCachedChatRecords(records: readonly ChatThreadRecord[]): ChatThreadRecord[] {
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
          readAtIso: `${payload.read.readAtIso ?? ''}`.trim()
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
    message: ContractTypes.ChatPopupMessage
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
    if (this.socketListeners.size > 0 || this.pendingSocketMessageIds.size > 0 || this.pendingSocketUpdateResolvers.size > 0) {
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
  }

  private waitForSocketMessageAck(clientId: string): Promise<ContractTypes.ChatPopupMessage | null> {
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
    return new Promise<ContractTypes.ChatPopupMessage | null>(resolve => {
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
    message: ContractTypes.ChatPopupMessage | null
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

  private waitForSocketMessageUpdate(messageId: string): Promise<ContractTypes.ChatPopupMessage | null> {
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
    return new Promise<ContractTypes.ChatPopupMessage | null>(resolve => {
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
    message: ContractTypes.ChatPopupMessage | null
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

}

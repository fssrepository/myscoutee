import { Injectable, inject } from '@angular/core';

import type * as ContractTypes from '../../../contracts';
import { AppUtils } from '../../../../app-utils';
import type { AssetType } from '../../../common/constants';
import type { ActivitiesFeedFilters, ListQuery } from '../../../contracts';
import type {
  ActivitiesChatPageResultDTO,
  ChatDTO,
  ChatMemberSummaryDto,
  ChatMetricBucketDTO,
  ChatMetricsDTO,
  ChatMessagesPageResultDTO
} from '../../../contracts/chat.interface';
import type { IChatsService } from '../../../contracts/activity.interface';
import { ActivityResourceBuilder } from '../../../base/builders';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalChatThreadMapper } from '../mappers';
import { UserProfileStore } from '../../../../ui/context/stores/user-profile.store';
import type { ChatThreadRecord } from '../entity/chat.entity';
import type {
  ActivityMemberRecord,
  ActivitySubEventResourceRecord
} from '../entity/activity.entity';

import type * as ActivityContracts from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalChatsService extends LocalRouteDelayService implements IChatsService {
  private static readonly CHAT_ROUTE = '/activities/chats';

  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly activityResourcesRepository = inject(LocalActivityResourcesRepository);
  private readonly activitySubEventStageRuntimeRepository = inject(LocalActivitySubEventStageRuntimeRepository);

  async queryChatItemsByUser(userId: string): Promise<ChatDTO[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const records = this.chatsRepository.queryChatItemsByUser(userId);
    return this.chatDtosWithMetrics(records);
  }

  async querySupportCaseItemsForAdmin(
    userId: string,
    filter: ContractTypes.SupportCaseFilter = 'all'
  ): Promise<ChatDTO[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const records = this.chatsRepository.querySupportCaseItemsForAdmin(userId, filter);
    return this.chatDtosWithMetrics(records);
  }

  async queryActivitiesChatPage(
    userId: string,
    query: ListQuery<ActivitiesFeedFilters>,
    _options: { chatItems?: readonly ChatDTO[] } = {}
  ): Promise<ActivitiesChatPageResultDTO> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const page = this.chatsRepository.queryActivitiesChatPage(this.resolveDemoActivityUserId(userId), query);
    return {
      ...LocalChatThreadMapper.toDtoPage(page),
      items: this.chatDtosWithMetrics(page.items)
    };
  }

  peekChatItemsByUser(userId: string): ChatDTO[] {
    const records = this.chatsRepository.queryChatItemsByUser(userId);
    return this.chatDtosWithMetrics(records);
  }

  async loadChatMessages(chat: ChatDTO): Promise<ContractTypes.ChatMessageDto[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMessages(chat);
  }

  async queryChatMessagesPage(
    chat: ChatDTO,
    query: ListQuery
  ): Promise<ChatMessagesPageResultDTO> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMessagesPage(chat, query);
  }

  async queryChatMembers(chatId: string): Promise<ActivityContracts.ActivityMemberDTO[]> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    return this.chatsRepository.queryChatMembers(chatId);
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
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const trimmedText = AppUtils.convertAsciiEmojis(text.trim());
    if (!trimmedText && attachments.length === 0) {
      return null;
    }
    const sentAt = new Date();
    return this.chatsRepository.appendChatMessage(chat, {
      id: `${clientId ?? `${chat.id}:${sentAt.getTime()}`}`,
      sender: 'You',
      senderAvatar: {
        id: 'self',
        initials: 'ME',
        gender: 'man'
      },
      text: trimmedText,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      mine: true,
      readBy: [],
      clientId: `${clientId ?? ''}`.trim() || undefined,
      replyTo: replyTo ? { ...replyTo } : null,
      attachments: attachments.map(attachment => ({ ...attachment }))
    });
  }

  async updateChatMessage(
    chat: ChatDTO,
    messageId: string,
    mutation: ContractTypes.ChatMessageMutation
  ): Promise<ContractTypes.ChatMessageDto | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const normalizedMutation = typeof mutation.text === 'string'
      ? {
          ...mutation,
          text: AppUtils.convertAsciiEmojis(mutation.text.trim())
        }
      : mutation;
    return this.chatsRepository.updateChatMessage(chat, messageId, normalizedMutation);
  }

  async watchChatMessages(
    _chat: ChatDTO,
    _onMessage: (message: ContractTypes.ChatMessageDto) => void
  ): Promise<() => void> {
    return () => {};
  }

  async watchChatEvents(
    _chat: ChatDTO,
    _onEvent: (event: ContractTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return () => {};
  }

  async sendChatTyping(_chat: ChatDTO, _typing: boolean): Promise<void> {
    return;
  }

  async markChatRead(chat: ChatDTO, messageIds: readonly string[]): Promise<ContractTypes.ChatReadReceipt | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const ownerUserId = `${chat.ownerUserId ?? ''}`.trim()
      || this.resolveDemoActivityUserId(this.userProfileStore.activeUserId().trim());
    const chatId = `${chat.id ?? ''}`.trim();
    const ownerId = `${chat.ownerId ?? ''}`.trim();
    if (!ownerUserId || (!chatId && !ownerId)) {
      return null;
    }
    const update = this.chatsRepository.markChatRead(chat, ownerUserId, messageIds);
    if (!update || update.messageIds.length === 0) {
      return null;
    }
    return {
      userId: update.reader.id,
      userInitials: update.reader.initials,
      userGender: update.reader.gender,
      messageIds: update.messageIds,
      readAtIso: update.readAtIso,
      unread: update.unread
    };
  }

  async updateSupportCase(chat: ChatDTO, action: ContractTypes.SupportCaseAction): Promise<ChatDTO | null> {
    await this.waitForRouteDelay(LocalChatsService.CHAT_ROUTE);
    const record = this.chatsRepository.updateSupportCase(chat, action);
    return record ? (this.chatDtosWithMetrics([record])[0] ?? LocalChatThreadMapper.toDto(record)) : null;
  }

  private chatDtosWithMetrics(records: readonly ChatThreadRecord[]): ChatDTO[] {
    const metricRecords = records.filter(record => this.metricChatRecord(record));
    const dtoByOwnerId = LocalChatThreadMapper.toMap(metricRecords);
    this.patchChatDtosWithMetrics(metricRecords, dtoByOwnerId);
    const usersById = new Map(this.usersRepository.queryAllUsers().map(user => [user.id, user]));
    return LocalChatThreadMapper.toDtoList(records).map(dto => {
      const ownerId = `${dto.ownerId ?? ''}`.trim();
      const metricsDto = ownerId && this.supportsChatMetrics(this.chatChannelType(dto))
        ? dtoByOwnerId.get(ownerId) ?? dto
        : dto;
      return {
        ...metricsDto,
        memberIds: [...(metricsDto.memberIds ?? [])],
        members: this.chatMemberSummaries(metricsDto.memberIds, usersById)
      };
    });
  }

  private chatMemberSummaries(
    memberIds: readonly string[],
    usersById: ReadonlyMap<string, UserDto>
  ): ChatMemberSummaryDto[] {
    return [...new Set((memberIds ?? []).map(memberId => `${memberId ?? ''}`.trim()).filter(Boolean))]
      .flatMap(memberId => {
        const user = usersById.get(memberId);
        if (!user) {
          return [];
        }
        const label = `${user.name ?? ''}`.trim() || memberId;
        return [{
          id: memberId,
          name: label,
          initials: `${user.initials ?? ''}`.trim() || AppUtils.initialsFromText(label),
          gender: this.normalizeChatUserGender(user.gender),
          imageUrl: AppUtils.firstImageUrl(user.images)
        }];
      });
  }

  private normalizeChatUserGender(value: unknown): ContractTypes.ChatUserGender {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized === 'woman' ? 'woman' : 'man';
  }

  private patchChatDtosWithMetrics(records: readonly ChatThreadRecord[], dtoByOwnerId: Map<string, ChatDTO>): void {
    const lookupByOwnerId = new Map<string, {
      channelType: ContractTypes.ChatChannelType;
      ownerId: string;
      parts: { eventId: string; subEventId: string; groupId: string };
    }>();
    const memberOwnersByKey = new Map<string, ActivityContracts.ActivityMemberOwnerRef>();
    const resourceOwnerIds = new Set<string>();
    const stageRuntimeOwnerIds = new Set<string>();
    for (const record of records) {
      const channelType = this.chatChannelType(record);
      const ownerId = `${record.ownerId ?? ''}`.trim();
      if (!ownerId || !dtoByOwnerId.has(ownerId) || !this.supportsChatMetrics(channelType)) {
        continue;
      }
      const parts = this.chatOwnerParts(record);
      lookupByOwnerId.set(ownerId, { channelType, ownerId, parts });
      const memberOwnerType = this.memberOwnerType(channelType);
      if (memberOwnerType) {
        memberOwnersByKey.set(`${memberOwnerType}:${ownerId}`, { ownerType: memberOwnerType, ownerId });
      }
      if ((channelType === 'optionalSubEvent' || channelType === 'groupSubEvent') && parts.subEventId) {
        if (parts.eventId) {
          resourceOwnerIds.add(parts.eventId);
          stageRuntimeOwnerIds.add(parts.eventId);
        }
        resourceOwnerIds.add(ownerId);
        stageRuntimeOwnerIds.add(ownerId);
      }
    }

    const membersByOwnerKey = this.activityMembersRepository.queryRecordsByOwners([...memberOwnersByKey.values()]);
    const resourcesByMetricKey = this.resourceRecordsByMetricKey(
      this.activityResourcesRepository.queryRecordsByOwnerIds([...resourceOwnerIds])
    );
    const stageRuntimeByMetricKey = new Map(
      this.activitySubEventStageRuntimeRepository.queryRecordsByOwnerIds([...stageRuntimeOwnerIds])
        .map(record => [`${record.ownerId}:${record.subEventId}`, record] as const)
    );

    for (const [ownerIdKey, lookup] of lookupByOwnerId.entries()) {
      const { channelType, ownerId, parts } = lookup;
      const memberOwnerType = this.memberOwnerType(channelType);
      const members = memberOwnerType
        ? this.memberBucket(membersByOwnerKey.get(`${memberOwnerType}:${ownerId}`) ?? [])
        : null;
      const metrics: ChatMetricsDTO = {
        members,
        pendingTotal: members?.pending ?? 0
      };
      if ((channelType === 'optionalSubEvent' || channelType === 'groupSubEvent') && parts.subEventId) {
        const resourceRecords = this.metricResourceRecords(resourcesByMetricKey, parts.eventId, ownerId, parts.subEventId);
        metrics.car = this.assetBucket(resourceRecords, 'Car');
        metrics.accommodation = this.assetBucket(resourceRecords, 'Accommodation');
        metrics.supplies = this.assetBucket(resourceRecords, 'Supplies');
        metrics.groupsCount = this.countValue(
          stageRuntimeByMetricKey.get(`${parts.eventId}:${parts.subEventId}`)?.groupsCount
            ?? stageRuntimeByMetricKey.get(`${ownerId}:${parts.subEventId}`)?.groupsCount
        );
        metrics.pendingTotal = this.countValue(metrics.members?.pending)
          + this.countValue(metrics.car?.pending)
          + this.countValue(metrics.accommodation?.pending)
          + this.countValue(metrics.supplies?.pending);
      }
      const dto = dtoByOwnerId.get(ownerIdKey);
      if (dto) {
        dtoByOwnerId.set(ownerIdKey, LocalChatThreadMapper.withMetrics(dto, metrics));
      }
    }
  }

  private metricChatRecord(record: Pick<ChatThreadRecord, 'channelType' | 'ownerId'>): boolean {
    const ownerId = `${record.ownerId ?? ''}`.trim();
    return !!ownerId && this.supportsChatMetrics(this.chatChannelType(record));
  }

  private resourceRecordsByMetricKey(records: readonly ActivitySubEventResourceRecord[]): Map<string, ActivitySubEventResourceRecord[]> {
    const result = new Map<string, ActivitySubEventResourceRecord[]>();
    for (const record of records) {
      const key = `${record.ownerId}:${record.subEventId}`;
      const bucket = result.get(key) ?? [];
      bucket.push(record);
      result.set(key, bucket);
    }
    return result;
  }

  private metricResourceRecords(
    recordsByKey: ReadonlyMap<string, ActivitySubEventResourceRecord[]>,
    eventId: string,
    ownerId: string,
    subEventId: string
  ): ActivitySubEventResourceRecord[] {
    const byId = new Map<string, ActivitySubEventResourceRecord>();
    const keys = [
      eventId ? `${eventId}:${subEventId}` : '',
      ownerId ? `${ownerId}:${subEventId}` : ''
    ].filter(Boolean);
    for (const key of keys) {
      for (const record of recordsByKey.get(key) ?? []) {
        byId.set(record.id, record);
      }
    }
    return [...byId.values()];
  }

  private memberBucket(records: readonly ActivityMemberRecord[]): ChatMetricBucketDTO {
    const accepted = records.filter(record => record.status === 'accepted').length;
    const pending = records.filter(record => record.status === 'pending').length;
    return {
      accepted,
      pending,
      capacityMin: 0,
      capacityMax: Math.max(accepted, accepted + pending)
    };
  }

  private assetBucket(records: readonly ActivitySubEventResourceRecord[], type: AssetType): ChatMetricBucketDTO {
    let accepted = 0;
    let capacityMin = 0;
    let capacityMax = 0;
    for (const record of records) {
      const settings = ActivityResourceBuilder.cloneAssetSettingsByType(record.assetSettingsByType)[type] ?? {};
      for (const item of Object.values(settings)) {
        capacityMin += this.countValue(item.capacityMin);
        capacityMax += this.countValue(item.capacityMax);
      }
      if (type === 'Supplies') {
        for (const entries of Object.values(record.supplyContributionEntriesByAssetId ?? {})) {
          accepted += (entries ?? []).reduce((sum, entry) => sum + this.countValue(entry.quantity), 0);
        }
      }
    }
    return {
      accepted,
      pending: 0,
      capacityMin,
      capacityMax: Math.max(capacityMin, capacityMax, accepted)
    };
  }

  private memberOwnerType(channelType: ContractTypes.ChatChannelType): ActivityContracts.ActivityMemberOwnerRef['ownerType'] | null {
    if (channelType === 'mainEvent') {
      return 'event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'subEvent';
    }
    if (channelType === 'groupSubEvent') {
      return 'group';
    }
    return null;
  }

  private supportsChatMetrics(channelType: ContractTypes.ChatChannelType): boolean {
    return channelType === 'mainEvent'
      || channelType === 'optionalSubEvent'
      || channelType === 'groupSubEvent';
  }

  private chatChannelType(record: Pick<ChatThreadRecord, 'channelType' | 'ownerId'>): ContractTypes.ChatChannelType {
    if (
      record.channelType === 'mainEvent'
      || record.channelType === 'optionalSubEvent'
      || record.channelType === 'groupSubEvent'
      || record.channelType === 'serviceEvent'
      || record.channelType === 'appSupport'
      || record.channelType === 'supportCase'
    ) {
      return record.channelType;
    }
    const parts = this.splitOwnerId(record.ownerId);
    if (parts.length >= 3) {
      return 'groupSubEvent';
    }
    if (parts.length === 2) {
      return 'optionalSubEvent';
    }
    return parts.length === 1 ? 'mainEvent' : 'general';
  }

  private chatOwnerParts(record: Pick<ChatThreadRecord, 'channelType' | 'ownerId'>): { eventId: string; subEventId: string; groupId: string } {
    const channelType = this.chatChannelType(record);
    const parts = this.splitOwnerId(record.ownerId);
    if (channelType === 'groupSubEvent') {
      return { eventId: parts[0] ?? '', subEventId: parts[1] ?? '', groupId: parts.slice(2).join(':') };
    }
    if (channelType === 'optionalSubEvent') {
      return { eventId: parts[0] ?? '', subEventId: parts.slice(1).join(':'), groupId: '' };
    }
    if (channelType === 'mainEvent') {
      return { eventId: `${record.ownerId ?? ''}`.trim(), subEventId: '', groupId: '' };
    }
    return { eventId: '', subEventId: '', groupId: '' };
  }

  private splitOwnerId(ownerId: string | null | undefined): string[] {
    return `${ownerId ?? ''}`.split(':').map(part => part.trim()).filter(Boolean);
  }

  private countValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private resolveDemoActivityUserId(userId: string): string {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      return normalizedUserId;
    }
    return this.usersRepository.queryAllUsers()[0]?.id ?? '';
  }
}

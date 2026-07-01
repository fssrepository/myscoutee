import type { ChatChannelType, ChatDTO } from '../../core/contracts/chat.interface';
import type { UserDto } from '../../core/contracts/user.interface';
import type { SingleRowData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityChatSingleRowConverterOptions {
  users: readonly UserDto[];
  activeUserId: string;
}

interface ResolvedActivityChatSingleRowConverterOptions extends ActivityChatSingleRowConverterOptions {
  userById: ReadonlyMap<string, UserDto>;
  fallbackUser: UserDto | null;
}

export class ActivityChatSingleRowConverter {
  static convert(
    dto: ChatDTO,
    options: ActivityChatSingleRowConverterOptions
  ): SingleRowData {
    return this.convertWithResolvedOptions(dto, this.resolveOptions(options));
  }

  static convertList(
    dtos: readonly ChatDTO[],
    options: ActivityChatSingleRowConverterOptions
  ): SingleRowData[] {
    const resolvedOptions = this.resolveOptions(options);
    return dtos.map(dto => this.convertWithResolvedOptions(dto, resolvedOptions));
  }

  private static convertWithResolvedOptions(
    dto: ChatDTO,
    options: ResolvedActivityChatSingleRowConverterOptions
  ): SingleRowData {
    const lastSender = this.resolveLastSender(dto, options);
    const unread = Math.max(0, Math.trunc(Number(dto.unread) || 0));
    const memberCount = this.resolveMemberCount(dto, options);
    const distanceMetersExact = Number.isFinite(Number(dto.distanceMetersExact))
      ? Math.max(0, Math.trunc(Number(dto.distanceMetersExact)))
      : undefined;

    return {
      id: dto.id,
      smartListKey: `chats:${dto.id}`,
      status: dto.supportCaseStatus ?? this.normalizeChannelType(dto),
      dateIso: dto.dateIso ?? '2026-02-21T09:00:00',
      distanceMetersExact,
      badgeCount: unread,
      sortScore: unread * 10 + memberCount,
      title: lastSender?.name ?? dto.title,
      subtitle: dto.title,
      detail: dto.lastMessage?.trim() || '',
      unread,
      avatarInitials: dto.avatar,
      avatarToneClass: lastSender ? `user-color-${lastSender.gender}` : null,
      memberCount,
      toneClass: this.toneClass(dto),
      sideLabel: dto.supportCaseAssigneeName ?? null
    };
  }

  private static normalizeChannelType(dto: Pick<ChatDTO, 'channelType'>): ChatChannelType {
    if (
      dto.channelType === 'mainEvent'
      || dto.channelType === 'optionalSubEvent'
      || dto.channelType === 'groupSubEvent'
      || dto.channelType === 'serviceEvent'
    ) {
      return dto.channelType;
    }
    return 'general';
  }

  private static toneClass(dto: ChatDTO): string {
    const channelType = this.normalizeChannelType(dto);
    if (channelType === 'mainEvent') {
      return 'activities-card-chat-main-event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'activities-card-chat-optional-sub-event';
    }
    if (channelType === 'groupSubEvent') {
      return 'activities-card-chat-group-sub-event';
    }
    if (channelType === 'serviceEvent') {
      return this.serviceChatToneClass(dto);
    }
    return '';
  }

  private static serviceChatToneClass(dto: ChatDTO): string {
    if (
      dto.serviceContext === 'notification'
      || dto.title.startsWith('Notify Participants')
      || dto.lastMessage.toLowerCase().includes('notification channel')
    ) {
      return 'activities-card-chat-service-notification';
    }
    if (dto.serviceContext === 'asset' || dto.id.startsWith('c-service-asset-') || dto.title.startsWith('Asset Service')) {
      return 'activities-card-chat-service-asset';
    }
    return 'activities-card-chat-service-event';
  }

  private static resolveLastSender(
    dto: ChatDTO,
    options: ResolvedActivityChatSingleRowConverterOptions
  ): UserDto | null {
    const lastSender = options.userById.get(dto.lastSenderId) ?? null;
    if (lastSender) {
      return lastSender;
    }
    const members = this.resolveMembers(dto, options);
    return members[0] ?? null;
  }

  private static resolveMemberCount(
    dto: ChatDTO,
    options: ResolvedActivityChatSingleRowConverterOptions
  ): number {
    const explicitMemberCount = new Set(
      (dto.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    ).size;
    if (explicitMemberCount > 0) {
      return explicitMemberCount;
    }
    return this.resolveMembers(dto, options).length;
  }

  private static resolveMembers(
    dto: ChatDTO,
    options: ResolvedActivityChatSingleRowConverterOptions
  ): UserDto[] {
    const members = (dto.memberIds ?? [])
      .map(memberId => options.userById.get(memberId) ?? null)
      .filter((user): user is UserDto => Boolean(user));
    if (members.length > 0) {
      return this.uniqueUsersById(members);
    }
    return options.fallbackUser ? [options.fallbackUser] : [];
  }

  private static resolveOptions(
    options: ActivityChatSingleRowConverterOptions
  ): ResolvedActivityChatSingleRowConverterOptions {
    const userById = new Map<string, UserDto>();
    for (const user of options.users) {
      userById.set(user.id, user);
    }
    return {
      ...options,
      userById,
      fallbackUser: userById.get(options.activeUserId) ?? options.users[0] ?? null
    };
  }

  private static uniqueUsersById(users: readonly UserDto[]): UserDto[] {
    const seen = new Set<string>();
    const unique: UserDto[] = [];
    for (const user of users) {
      if (seen.has(user.id)) {
        continue;
      }
      seen.add(user.id);
      unique.push(user);
    }
    return unique;
  }
}

export const activityChatSingleRowConverter =
  ActivityChatSingleRowConverter satisfies UiListConverter<
    ChatDTO,
    SingleRowData,
    ActivityChatSingleRowConverterOptions
  >;

import type { ChatChannelType, ChatDTO, SupportCaseStatus } from '../../core/contracts/chat.interface';
import type { UserDto } from '../../core/contracts/user.interface';
import type { SingleRowData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityChatSingleRowConverterOptions {
  activeUser: UserDto;
  resolveUserById?: (userId: string) => UserDto | null;
  adminServiceMode?: boolean;
  translate?: (key: string) => string;
}

interface ResolvedActivityChatSingleRowConverterOptions extends ActivityChatSingleRowConverterOptions {
  fallbackUser: UserDto;
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
    const supportStatus = this.supportStatus(dto.supportCase?.status);
    const supportAssigneeName = dto.supportCase?.assignee?.name ?? null;
    const showSupportControls = options.adminServiceMode === true && Boolean(supportStatus);
    const avatar = `${dto.avatar ?? ''}`.trim();
    const channelType = supportStatus ? 'supportCase' : this.normalizeChannelType(dto);
    const ownerId = `${dto.ownerId ?? ''}`.trim();
    const rowIdentity = ownerId ? `${channelType}:${ownerId}` : `${dto.id ?? ''}`.trim();

    return {
      id: dto.id,
      ownerId: ownerId || null,
      smartListKey: `chats:${rowIdentity || dto.id}`,
      status: supportStatus ?? channelType,
      dateIso: dto.dateIso ?? '2026-02-21T09:00:00',
      distanceMetersExact,
      badgeCount: showSupportControls ? 0 : unread,
      sortScore: unread * 10 + memberCount,
      title: lastSender?.name ?? dto.title,
      subtitle: dto.title,
      detail: dto.lastMessage?.trim() || '',
      unread: showSupportControls ? 0 : unread,
      avatarInitials: avatar ? avatar.slice(0, 2).toUpperCase() : options.activeUser.initials,
      avatarToneClass: lastSender ? `user-color-${lastSender.gender}` : null,
      memberCount: showSupportControls ? 0 : memberCount,
      toneClass: this.toneClass(dto),
      surfaceTone: showSupportControls
        ? this.supportCaseSurfaceTone(supportStatus)
        : this.chatSurfaceTone(dto),
      sideLabel: null,
      badges: showSupportControls
        ? [{
          label: this.supportCaseBadgeLabel(supportStatus, supportAssigneeName, options.translate),
          title: this.supportCaseBadgeLabel(supportStatus, supportAssigneeName, options.translate),
          tone: this.supportCaseBadgeTone(supportStatus),
          position: 'top-right'
        }]
        : [],
      menuActions: showSupportControls
        ? this.supportCaseMenuActionIds(supportStatus)
        : [],
      clickable: true
    };
  }

  private static supportStatus(status: string | null | undefined): SupportCaseStatus | null {
    if (status === 'pending' || status === 'picked' || status === 'solved' || status === 'blocked') {
      return status;
    }
    return null;
  }

  private static supportCaseLabelKey(status: string | null | undefined): string {
    if (status === 'picked') {
      return 'activities.support.case.status.picked';
    }
    if (status === 'solved') {
      return 'activities.support.case.status.solved';
    }
    if (status === 'blocked') {
      return 'activities.support.case.status.blocked';
    }
    return 'activities.support.case.status.pending';
  }

  private static supportCaseBadgeLabel(
    status: SupportCaseStatus | null,
    assigneeName: string | null | undefined,
    translate: ((key: string) => string) | undefined
  ): string {
    const resolvedAssigneeName = `${assigneeName ?? ''}`.trim();
    const t = translate ?? ((key: string) => key);
    if (resolvedAssigneeName) {
      return `${t('activities.support.case.assignee.by')} ${resolvedAssigneeName}`.trim();
    }
    return t(this.supportCaseLabelKey(status));
  }

  private static supportCaseBadgeTone(status: SupportCaseStatus | null): NonNullable<SingleRowData['surfaceTone']> {
    switch (status) {
      case 'picked':
        return 'info';
      case 'solved':
        return 'success';
      case 'blocked':
        return 'danger';
      default:
        return 'warning';
    }
  }

  private static supportCaseSurfaceTone(status: SupportCaseStatus | null): SingleRowData['surfaceTone'] {
    return this.supportCaseBadgeTone(status);
  }

  private static supportCaseMenuActionIds(status: SupportCaseStatus | null): readonly string[] {
    if (status === 'solved' || status === 'blocked') {
      return ['supportReopen'];
    }
    if (status === 'picked') {
      return ['supportUnpick', 'supportSolve', 'supportBlock'];
    }
    return ['supportPick', 'supportSolve', 'supportBlock'];
  }

  private static chatSurfaceTone(dto: ChatDTO): SingleRowData['surfaceTone'] {
    const toneClass = this.toneClass(dto);
    if (toneClass.includes('activities-card-chat-group-sub-event')) {
      return 'success';
    }
    if (toneClass.includes('activities-card-chat-optional-sub-event')) {
      return 'warning';
    }
    if (toneClass.includes('activities-card-chat-service-notification')) {
      return 'danger';
    }
    if (
      toneClass.includes('activities-card-chat-service-event')
      || toneClass.includes('activities-card-chat-service-asset')
    ) {
      return 'neutral';
    }
    if (toneClass.includes('activities-card-chat-main-event')) {
      return 'info';
    }
    return 'default';
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
    const lastSender = this.resolveUserById(dto.lastSenderId, options);
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
      .map(memberId => this.resolveUserById(memberId, options))
      .filter((user): user is UserDto => Boolean(user));
    if (members.length > 0) {
      return this.uniqueUsersById(members);
    }
    return [options.fallbackUser];
  }

  private static resolveOptions(
    options: ActivityChatSingleRowConverterOptions
  ): ResolvedActivityChatSingleRowConverterOptions {
    return {
      ...options,
      fallbackUser: options.activeUser
    };
  }

  private static resolveUserById(
    userId: string | undefined,
    options: ActivityChatSingleRowConverterOptions
  ): UserDto | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return null;
    }
    if (normalizedUserId === options.activeUser.id) {
      return options.activeUser;
    }
    return options.resolveUserById?.(normalizedUserId) ?? null;
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

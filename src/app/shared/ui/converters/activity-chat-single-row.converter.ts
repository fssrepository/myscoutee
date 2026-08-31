import type {
  ChatChannelType,
  ChatDTO,
  ChatMemberSummaryDto,
  SupportCaseStatus
} from '../../core/contracts/chat.interface';
import type { UserDto } from '../../core/contracts/user.interface';
import { AppUtils } from '../../app-utils';
import type { SingleRowData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityChatSingleRowData extends SingleRowData {
  chatRevision: number;
  chatOwnerStatus?: import('../../core/contracts/activity.interface').ActivityEventStatus | null;
}

export interface ActivityChatSingleRowConverterOptions {
  activeUser: UserDto;
  resolveUserById?: (userId: string) => UserDto | null;
  adminServiceMode?: boolean;
  translate?: (key: string) => string;
}

interface ResolvedActivityChatSingleRowConverterOptions extends ActivityChatSingleRowConverterOptions {
  fallbackUser: UserDto;
}

type ActivityChatPerson = Pick<UserDto, 'id' | 'name' | 'initials' | 'gender'> & {
  avatarUrl?: string | null;
  images?: readonly string[];
};

export class ActivityChatSingleRowConverter {
  static convert(
    dto: ChatDTO,
    options: ActivityChatSingleRowConverterOptions
  ): ActivityChatSingleRowData {
    return this.convertWithResolvedOptions(dto, this.resolveOptions(options));
  }

  static convertList(
    dtos: readonly ChatDTO[],
    options: ActivityChatSingleRowConverterOptions
  ): ActivityChatSingleRowData[] {
    const resolvedOptions = this.resolveOptions(options);
    return dtos.map(dto => this.convertWithResolvedOptions(dto, resolvedOptions));
  }

  private static convertWithResolvedOptions(
    dto: ChatDTO,
    options: ResolvedActivityChatSingleRowConverterOptions
  ): ActivityChatSingleRowData {
    const systemSender = this.isSystemGeneratedRoomSender(dto);
    const systemAvatarUrl = systemSender ? this.systemAvatarUrl(dto.avatar) : null;
    const lastSender = systemSender ? null : this.resolveLastSender(dto, options);
    const unread = Math.max(0, Math.trunc(Number(dto.unread) || 0));
    const memberCount = this.resolveMemberCount(dto, options);
    const distanceMetersExact = Number.isFinite(Number(dto.distanceMetersExact))
      ? Math.max(0, Math.trunc(Number(dto.distanceMetersExact)))
      : undefined;
    const supportStatus = this.supportStatus(dto.supportCase?.status);
    const supportAssigneeName = dto.supportCase?.assignee?.name ?? null;
    const showSupportControls = options.adminServiceMode === true && Boolean(supportStatus);
    const channelType = supportStatus ? 'supportCase' : this.normalizeChannelType(dto);
    const eventUnderReview = dto.ownerStatus === 'DR';
    const ownerId = `${dto.ownerId ?? ''}`.trim();
    const groupChannelLabel = channelType === 'groupSubEvent' ? this.groupChannelLabel(dto) : '';
    const groupParentLabel = channelType === 'groupSubEvent' ? this.groupParentLabel(dto) : '';
    const lastMessage = dto.lastMessage?.trim() || '';

    return {
      id: dto.id,
      chatRevision: Math.max(1, Math.trunc(Number(dto.revision) || 1)),
      chatOwnerStatus: dto.ownerStatus ?? null,
      ownerId: ownerId || null,
      smartListKey: this.smartListKeyForIdentity(channelType, ownerId, dto.id),
      status: supportStatus ?? channelType,
      dateIso: dto.dateIso ?? '2026-02-21T09:00:00',
      distanceMetersExact,
      badgeCount: unread,
      sortScore: unread * 10 + memberCount,
      title: systemSender ? 'MyScoutee System' : lastSender?.name ?? dto.title,
      subtitle: groupChannelLabel || dto.title,
      detail: groupParentLabel || lastMessage,
      metaRows: groupParentLabel && lastMessage ? [lastMessage] : [],
      unread,
      avatarUrl: systemSender ? systemAvatarUrl : this.personAvatarUrl(lastSender),
      avatarInitials: systemSender
        ? null
        : lastSender?.initials || AppUtils.initialsFromText(lastSender?.name ?? dto.title),
      avatarToneClass: systemSender && !systemAvatarUrl
        ? 'notification-system-avatar'
        : lastSender ? `user-color-${lastSender.gender}` : null,
      avatarAriaLabel: systemSender ? 'MyScoutee System' : lastSender?.name ?? dto.title,
      icon: systemSender && !systemAvatarUrl ? 'auto_awesome' : null,
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
        : eventUnderReview
          ? [{
            label: options.translate?.('activities.chat.event.status.underReview') ?? 'Under review',
            title: options.translate?.('activities.chat.event.status.underReview') ?? 'Under review',
            tone: 'warning',
            position: 'inline',
            className: 'event-chat-owner-status-badge'
          }]
          : [],
      menuActions: showSupportControls
        ? this.supportCaseMenuActionIds(supportStatus)
        : [],
      clickable: true
    };
  }

  static smartListKeyForIdentity(
    channelType: ChatChannelType | null | undefined,
    ownerId: string | null | undefined,
    fallbackId: string | null | undefined
  ): string {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    const normalizedFallbackId = `${fallbackId ?? ''}`.trim();
    const normalizedChannelType = this.normalizeSmartListChannelType(channelType);
    const usesOwnerIdentity = normalizedChannelType === 'mainEvent'
      || normalizedChannelType === 'optionalSubEvent'
      || normalizedChannelType === 'groupSubEvent';
    const identity = usesOwnerIdentity
      ? normalizedOwnerId || normalizedFallbackId
      : normalizedFallbackId || normalizedOwnerId;
    const rowIdentity = identity ? `${normalizedChannelType}:${identity}` : '';
    return `chats:${rowIdentity || normalizedFallbackId}`;
  }

  private static groupChannelLabel(dto: ChatDTO): string {
    const configured = `${dto.navigationContext?.group?.name ?? ''}`.trim();
    if (configured) {
      return configured;
    }
    const title = `${dto.title ?? ''}`.trim();
    return title
      .replace(/\s*[·-]\s*group channel\s*$/i, '')
      .trim() || 'Group';
  }

  private static groupParentLabel(dto: ChatDTO): string {
    const navigation = dto.navigationContext;
    if (!navigation) {
      return '';
    }
    const timeframe = AppUtils.dateTimeRangeLabel(
      navigation.subEvent?.startAt,
      navigation.subEvent?.endAt,
      ''
    );
    const parts = [
      `${navigation.eventTitle ?? ''}`.trim(),
      `${navigation.subEvent?.name ?? ''}`.trim(),
      timeframe
    ].filter(Boolean);
    return parts.filter((part, index) => (
      parts.findIndex(candidate => candidate.toLocaleLowerCase('en-US') === part.toLocaleLowerCase('en-US')) === index
    )).join(' · ');
  }

  private static supportStatus(status: string | null | undefined): SupportCaseStatus | null {
    if (status === 'pending' || status === 'warned' || status === 'picked' || status === 'solved' || status === 'blocked') {
      return status;
    }
    return null;
  }

  private static supportCaseLabelKey(status: string | null | undefined): string {
    if (status === 'picked') {
      return 'activities.support.case.status.picked';
    }
    if (status === 'warned') {
      return 'activities.support.case.status.warned';
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
      case 'warned':
        return 'warning';
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
    if (status === 'picked' || status === 'warned') {
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
      || dto.channelType === 'appSupport'
    ) {
      return dto.channelType;
    }
    return 'general';
  }

  private static normalizeSmartListChannelType(channelType: ChatChannelType | null | undefined): ChatChannelType {
    if (
      channelType === 'mainEvent'
      || channelType === 'optionalSubEvent'
      || channelType === 'groupSubEvent'
      || channelType === 'serviceEvent'
      || channelType === 'appSupport'
      || channelType === 'supportCase'
      || channelType === 'general'
    ) {
      return channelType;
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
    if (channelType === 'appSupport') {
      return 'activities-card-chat-service-notification';
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
  ): ActivityChatPerson | null {
    const lastSender = this.resolveUserById(dto.lastSenderId, dto, options);
    if (lastSender) {
      return lastSender;
    }
    const members = this.resolveMembers(dto, options);
    return members[0] ?? null;
  }

  private static isSystemGeneratedRoomSender(dto: ChatDTO): boolean {
    const eventId = `${dto.eventId ?? dto.ownerId ?? ''}`.trim();
    return this.normalizeChannelType(dto) === 'mainEvent'
      && eventId.startsWith('random-room:')
      && !`${dto.lastSenderId ?? ''}`.trim();
  }

  private static systemAvatarUrl(value: string | null | undefined): string | null {
    const normalized = `${value ?? ''}`.trim();
    return /^(?:https?:\/\/|\/|data:image\/)/i.test(normalized) ? normalized : null;
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
  ): ActivityChatPerson[] {
    const memberIds = new Set([
      ...(dto.memberIds ?? []),
      ...(dto.members ?? []).map(member => member.id)
    ].map(memberId => `${memberId ?? ''}`.trim()).filter(Boolean));
    const members = [...memberIds]
      .map(memberId => this.resolveUserById(memberId, dto, options))
      .filter((user): user is ActivityChatPerson => Boolean(user));
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
    dto: Pick<ChatDTO, 'members'>,
    options: ActivityChatSingleRowConverterOptions
  ): ActivityChatPerson | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return null;
    }
    if (normalizedUserId === options.activeUser.id) {
      return options.activeUser;
    }
    const resolvedUser = options.resolveUserById?.(normalizedUserId) ?? null;
    if (resolvedUser) {
      return resolvedUser;
    }
    const member = (dto.members ?? []).find(candidate => `${candidate.id ?? ''}`.trim() === normalizedUserId);
    return member ? this.memberSummaryPerson(member) : null;
  }

  private static memberSummaryPerson(member: ChatMemberSummaryDto): ActivityChatPerson {
    const name = `${member.name ?? ''}`.trim() || member.id;
    return {
      id: member.id,
      name,
      initials: `${member.initials ?? ''}`.trim() || AppUtils.initialsFromText(name),
      gender: member.gender === 'woman' ? 'woman' : 'man',
      avatarUrl: `${member.imageUrl ?? ''}`.trim() || null
    };
  }

  private static personAvatarUrl(person: ActivityChatPerson | null): string | null {
    if (!person) {
      return null;
    }
    return `${person.avatarUrl ?? ''}`.trim()
      || AppUtils.firstImageUrl(person.images)
      || null;
  }

  private static uniqueUsersById(users: readonly ActivityChatPerson[]): ActivityChatPerson[] {
    const seen = new Set<string>();
    const unique: ActivityChatPerson[] = [];
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

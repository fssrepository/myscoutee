import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import type * as ContractTypes from '../../contracts';
import type { ChatRecord } from '../../contracts/chat.interface';
import type { UserDto } from '../../contracts/user.interface';

interface BuildActivityChatRowsOptions {
  users: readonly UserDto[];
  activeUserId: string;
}

interface ResolvedBuildActivityChatRowsOptions extends BuildActivityChatRowsOptions {
  userById: ReadonlyMap<string, UserDto>;
  fallbackUser: UserDto | null;
}

export function buildActivityChatRows(
  items: readonly ChatRecord[],
  options: BuildActivityChatRowsOptions
): AppTypes.ActivityListRow[] {
  const resolvedOptions = resolveBuildActivityChatRowsOptions(options);
  return items.map(item => toActivityChatRowWithResolvedOptions(item, resolvedOptions));
}

export function toActivityChatRow(
  item: ChatRecord,
  options: BuildActivityChatRowsOptions
): AppTypes.ActivityListRow {
  return toActivityChatRowWithResolvedOptions(item, resolveBuildActivityChatRowsOptions(options));
}

function toActivityChatRowWithResolvedOptions(
  item: ChatRecord,
  options: ResolvedBuildActivityChatRowsOptions
): AppTypes.ActivityListRow {
  const lastSender = resolveChatLastSender(item, options);
  const unread = Math.max(0, Math.trunc(Number(item.unread) || 0));
  const distanceMetersExact = Number.isFinite(Number(item.distanceMetersExact))
    ? Math.max(0, Math.trunc(Number(item.distanceMetersExact)))
    : undefined;
  const memberCount = resolveChatMemberCount(item, options);
  return {
    id: item.id,
    type: 'chats',
    status: item.supportCaseStatus ?? normalizeActivityChatChannelType(item),
    title: lastSender?.name ?? item.title,
    subtitle: item.title,
    detail: item.lastMessage?.trim() || '',
    dateIso: item.dateIso ?? '2026-02-21T09:00:00',
    distanceMetersExact,
    unread,
    badgeCount: unread,
    metricScore: unread * 10 + memberCount,
    sortScore: unread * 10 + memberCount,
    avatarInitials: item.avatar,
    avatarToneClass: lastSender ? `user-color-${lastSender.gender}` : null,
    memberCount,
    toneClass: activityChatToneClass(item),
    sideLabel: item.supportCaseAssigneeName ?? null
  };
}

export function normalizeActivityChatChannelType(item: Pick<ChatRecord, 'channelType'>): ContractTypes.ChatChannelType {
  if (
    item.channelType === 'mainEvent'
    || item.channelType === 'optionalSubEvent'
    || item.channelType === 'groupSubEvent'
    || item.channelType === 'serviceEvent'
  ) {
    return item.channelType;
  }
  return 'general';
}

export function activityChatContextFilterKey(
  item: Pick<ChatRecord, 'channelType'>
): ContractTypes.ActivitiesChatContextFilter | null {
  const channelType = normalizeActivityChatChannelType(item);
  if (channelType === 'mainEvent') {
    return 'event';
  }
  if (channelType === 'optionalSubEvent') {
    return 'subEvent';
  }
  if (channelType === 'groupSubEvent') {
    return 'group';
  }
  if (channelType === 'serviceEvent') {
    return 'service';
  }
  return null;
}

function resolveChatLastSender(
  item: ChatRecord,
  options: ResolvedBuildActivityChatRowsOptions
): UserDto | null {
  const lastSender = options.userById.get(item.lastSenderId) ?? null;
  if (lastSender) {
    return lastSender;
  }
  const members = resolveChatMembers(item, options);
  return members[0] ?? null;
}

function resolveChatMemberCount(
  item: ChatRecord,
  options: ResolvedBuildActivityChatRowsOptions
): number {
  const explicitMemberCount = new Set(
    (item.memberIds ?? [])
      .map(memberId => `${memberId ?? ''}`.trim())
      .filter(Boolean)
  ).size;
  if (explicitMemberCount > 0) {
    return explicitMemberCount;
  }
  return resolveChatMembers(item, options).length;
}

function resolveChatMembers(
  item: ChatRecord,
  options: ResolvedBuildActivityChatRowsOptions
): UserDto[] {
  const members = (item.memberIds ?? [])
    .map(memberId => options.userById.get(memberId) ?? null)
    .filter((user): user is UserDto => Boolean(user));
  if (members.length > 0) {
    return uniqueUsersById(members);
  }
  return options.fallbackUser ? [options.fallbackUser] : [];
}

function activityChatToneClass(item: ChatRecord): string {
  const channelType = normalizeActivityChatChannelType(item);
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
    return serviceChatToneClass(item);
  }
  return '';
}

function serviceChatToneClass(item: ChatRecord): string {
  if (
    item.serviceContext === 'notification'
    || item.title.startsWith('Notify Participants')
    || item.lastMessage.toLowerCase().includes('notification channel')
  ) {
    return 'activities-card-chat-service-notification';
  }
  if (item.serviceContext === 'asset' || item.id.startsWith('c-service-asset-') || item.title.startsWith('Asset Service')) {
    return 'activities-card-chat-service-asset';
  }
  return 'activities-card-chat-service-event';
}

function resolveBuildActivityChatRowsOptions(
  options: BuildActivityChatRowsOptions
): ResolvedBuildActivityChatRowsOptions {
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

function uniqueUsersById(users: readonly UserDto[]): UserDto[] {
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

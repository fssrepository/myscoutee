import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import type { ChatMenuItem } from '../interfaces/activity-feed.interface';
import type { DemoUser } from '../interfaces/user.interface';

interface BuildActivityChatRowsOptions {
  users: readonly DemoUser[];
  activeUserId: string;
}

interface ResolvedBuildActivityChatRowsOptions extends BuildActivityChatRowsOptions {
  userById: ReadonlyMap<string, DemoUser>;
  fallbackUser: DemoUser | null;
}

export function buildActivityChatRows(
  items: readonly ChatMenuItem[],
  options: BuildActivityChatRowsOptions
): AppTypes.ActivityListRow[] {
  const resolvedOptions = resolveBuildActivityChatRowsOptions(options);
  return items.map(item => toActivityChatRowWithResolvedOptions(item, resolvedOptions));
}

export function toActivityChatRow(
  item: ChatMenuItem,
  options: BuildActivityChatRowsOptions
): AppTypes.ActivityListRow {
  return toActivityChatRowWithResolvedOptions(item, resolveBuildActivityChatRowsOptions(options));
}

function toActivityChatRowWithResolvedOptions(
  item: ChatMenuItem,
  options: ResolvedBuildActivityChatRowsOptions
): AppTypes.ActivityListRow {
  const lastSender = resolveChatLastSender(item, options);
  const unread = Math.max(0, Math.trunc(Number(item.unread) || 0));
  const distanceKm = Number.isFinite(Number(item.distanceKm)) ? Math.max(0, Number(item.distanceKm)) : 0;
  const distanceMetersExact = Number.isFinite(Number(item.distanceMetersExact))
    ? Math.max(0, Math.trunc(Number(item.distanceMetersExact)))
    : Number.isFinite(Number(item.distanceKm))
      ? Math.max(0, Math.round(Number(item.distanceKm) * 1000))
      : undefined;
  return {
    id: item.id,
    type: 'chats',
    title: lastSender?.name ?? item.title,
    subtitle: item.title,
    detail: item.lastMessage?.trim() || '',
    dateIso: item.dateIso ?? '2026-02-21T09:00:00',
    distanceKm,
    distanceMetersExact,
    unread,
    metricScore: unread * 10 + resolveChatMemberCount(item, options),
    source: normalizeChatRecord(item)
  };
}

export function normalizeActivityChatChannelType(item: Pick<ChatMenuItem, 'channelType'>): AppTypes.ChatChannelType {
  if (item.channelType === 'mainEvent' || item.channelType === 'optionalSubEvent' || item.channelType === 'groupSubEvent') {
    return item.channelType;
  }
  return 'general';
}

export function activityChatContextFilterKey(
  item: Pick<ChatMenuItem, 'channelType'>
): AppTypes.ActivitiesChatContextFilter | null {
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
  return null;
}

function normalizeChatRecord(item: ChatMenuItem): ChatMenuItem {
  return {
    ...item,
    memberIds: [...(item.memberIds ?? [])],
    channelType: normalizeActivityChatChannelType(item)
  };
}

function resolveChatLastSender(
  item: ChatMenuItem,
  options: ResolvedBuildActivityChatRowsOptions
): DemoUser | null {
  const lastSender = options.userById.get(item.lastSenderId) ?? null;
  if (lastSender) {
    return lastSender;
  }
  const members = resolveChatMembers(item, options);
  return members[0] ?? null;
}

function resolveChatMemberCount(
  item: ChatMenuItem,
  options: ResolvedBuildActivityChatRowsOptions
): number {
  return resolveChatMembers(item, options).length;
}

function resolveChatMembers(
  item: ChatMenuItem,
  options: ResolvedBuildActivityChatRowsOptions
): DemoUser[] {
  const members = (item.memberIds ?? [])
    .map(memberId => options.userById.get(memberId) ?? null)
    .filter((user): user is DemoUser => Boolean(user));
  if (members.length > 0) {
    return uniqueUsersById(members);
  }
  return options.fallbackUser ? [options.fallbackUser] : [];
}

function resolveBuildActivityChatRowsOptions(
  options: BuildActivityChatRowsOptions
): ResolvedBuildActivityChatRowsOptions {
  const userById = new Map<string, DemoUser>();
  for (const user of options.users) {
    userById.set(user.id, user);
  }
  return {
    ...options,
    userById,
    fallbackUser: userById.get(options.activeUserId) ?? options.users[0] ?? null
  };
}

function uniqueUsersById(users: readonly DemoUser[]): DemoUser[] {
  const seen = new Set<string>();
  const unique: DemoUser[] = [];
  for (const user of users) {
    if (seen.has(user.id)) {
      continue;
    }
    seen.add(user.id);
    unique.push(user);
  }
  return unique;
}

import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import { APP_DEMO_DATA, type ChatMenuItem, type DemoUser } from '../../../demo-data';
import type { DemoChatRecord } from '../../demo/models/chats.model';

interface BuildActivityChatRowsOptions {
  users: readonly DemoUser[];
  activeUserId: string;
}

export function buildActivityChatRows(
  items: readonly DemoChatRecord[],
  options: BuildActivityChatRowsOptions
): AppTypes.ActivityListRow[] {
  return items.map(item => toActivityChatRow(item, options));
}

export function toActivityChatRow(
  item: DemoChatRecord,
  options: BuildActivityChatRowsOptions
): AppTypes.ActivityListRow {
  const lastSender = resolveChatLastSender(item, options.users, options.activeUserId);
  const unread = Math.max(0, Math.trunc(Number(item.unread) || 0));
  return {
    id: item.id,
    type: 'chats',
    title: lastSender?.name ?? item.title,
    subtitle: item.title,
    detail: item.lastMessage?.trim() || '',
    dateIso: APP_DEMO_DATA.chatDatesById[item.id] ?? '2026-02-21T09:00:00',
    distanceKm: APP_DEMO_DATA.chatDistanceById[item.id] ?? 5,
    distanceMetersExact: Math.max(0, Math.round((APP_DEMO_DATA.chatDistanceById[item.id] ?? 5) * 1000)),
    unread,
    metricScore: unread * 10 + resolveChatMemberCount(item, options.users, options.activeUserId),
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

function normalizeChatRecord(item: DemoChatRecord): ChatMenuItem {
  return {
    ...item,
    memberIds: [...(item.memberIds ?? [])],
    channelType: normalizeActivityChatChannelType(item)
  };
}

function resolveChatLastSender(
  item: DemoChatRecord,
  users: readonly DemoUser[],
  activeUserId: string
): DemoUser | null {
  const lastSender = users.find(user => user.id === item.lastSenderId) ?? null;
  if (lastSender) {
    return lastSender;
  }
  const members = resolveChatMembers(item, users, activeUserId);
  return members[0] ?? null;
}

function resolveChatMemberCount(
  item: DemoChatRecord,
  users: readonly DemoUser[],
  activeUserId: string
): number {
  return resolveChatMembers(item, users, activeUserId).length;
}

function resolveChatMembers(
  item: DemoChatRecord,
  users: readonly DemoUser[],
  activeUserId: string
): DemoUser[] {
  const members = (item.memberIds ?? [])
    .map(memberId => users.find(user => user.id === memberId) ?? null)
    .filter((user): user is DemoUser => Boolean(user));
  if (members.length > 0) {
    return uniqueUsersById(members);
  }
  const fallback = users.find(user => user.id === activeUserId) ?? users[0] ?? null;
  return fallback ? [fallback] : [];
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

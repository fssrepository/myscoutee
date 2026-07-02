import type {
  ChatMessageRecord,
  ChatMessageRecordCollection,
  ChatThreadRecord,
  ChatThreadRecordCollection
} from '../../source/entity/chat.entity';
import { environment } from '../../../../../../environments/environment';
import { AppUtils } from '../../../../app-utils';
import type { ChatSupportCase } from '../../../contracts/chat.interface';
import type { ChatRecord } from '../../source/entity/chat.entity';
import type { UserDto } from '../../../contracts/user.interface';

import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { SeedEventBuilder } from './event-seed.builder';
import { SeedUserBuilder } from './user-seed.builder';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../seed-constants';

type ChatSeedUser = Pick<UserDto, 'id' | 'name' | 'initials' | 'gender' | 'images'>;
export interface SeedChatRecordCollection {
  chats: ChatThreadRecordCollection;
  chatMessages: ChatMessageRecordCollection;
}
type ChatSeedSubEvent = {
  id: string;
  name: string;
  description?: string;
  optional?: boolean;
  startAt: string;
  endAt?: string;
  location?: string;
  capacityMin?: number | null;
  capacityMax?: number | null;
  groupsCount?: number | null;
  tournamentGroupCapacityMin?: number | null;
  tournamentGroupCapacityMax?: number | null;
  tournamentLeaderboardType?: string | null;
  tournamentAdvancePerGroup?: number | null;
  membersAccepted?: number | null;
  membersPending?: number | null;
  carsPending?: number | null;
  accommodationPending?: number | null;
  suppliesPending?: number | null;
};

const SEED_CHAT_ITEMS_BY_USER: Record<string, ChatRecord[]> = {
  'admin-demo-ava': [
    {
      id: 'c-support-admin-u1',
      avatar: 'FA',
      title: 'MyScoutee Support · Farkas Anna',
      lastMessage: 'Please check this shared asset screen.',
      lastSenderId: 'u1',
      memberIds: ['u1', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 1,
      channelType: 'supportCase',
      ownerId: 'c-support-admin-u1',
      supportCase: {
        status: 'pending',
        assignee: null,
        updatedAtIso: '2026-05-13T01:18:00.000Z'
      }
    },
    {
      id: 'c-support-admin-u2',
      avatar: 'KB',
      title: 'MyScoutee Support · Kiss Balázs',
      lastMessage: 'I am looking into the blocked-event report.',
      lastSenderId: 'admin-demo-noel',
      memberIds: ['u2', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'supportCase',
      ownerId: 'c-support-admin-u2',
      supportCase: {
        status: 'picked',
        assignee: {
          userId: 'admin-demo-noel',
          name: 'Noel',
          initials: 'NO'
        },
        updatedAtIso: '2026-05-13T01:32:00.000Z'
      }
    },
    {
      id: 'c-support-admin-u3',
      avatar: 'NE',
      title: 'MyScoutee Support · Nagy Eszter',
      lastMessage: 'Case closed after moderation review.',
      lastSenderId: 'admin-demo-ava',
      memberIds: ['u3', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'supportCase',
      ownerId: 'c-support-admin-u3',
      supportCase: {
        status: 'solved',
        assignee: {
          userId: 'admin-demo-ava',
          name: 'Ava',
          initials: 'AV'
        },
        updatedAtIso: '2026-05-13T01:40:00.000Z'
      }
    }
  ],
  'admin-demo-noel': [
    {
      id: 'c-support-admin-u1',
      avatar: 'FA',
      title: 'MyScoutee Support · Farkas Anna',
      lastMessage: 'Please check this shared asset screen.',
      lastSenderId: 'u1',
      memberIds: ['u1', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 1,
      channelType: 'supportCase',
      ownerId: 'c-support-admin-u1',
      supportCase: {
        status: 'pending',
        assignee: null,
        updatedAtIso: '2026-05-13T01:18:00.000Z'
      }
    },
    {
      id: 'c-support-admin-u2',
      avatar: 'KB',
      title: 'MyScoutee Support · Kiss Balázs',
      lastMessage: 'I am looking into the blocked-event report.',
      lastSenderId: 'admin-demo-noel',
      memberIds: ['u2', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'supportCase',
      ownerId: 'c-support-admin-u2',
      supportCase: {
        status: 'picked',
        assignee: {
          userId: 'admin-demo-noel',
          name: 'Noel',
          initials: 'NO'
        },
        updatedAtIso: '2026-05-13T01:32:00.000Z'
      }
    },
    {
      id: 'c-support-admin-u3',
      avatar: 'NE',
      title: 'MyScoutee Support · Nagy Eszter',
      lastMessage: 'Case closed after moderation review.',
      lastSenderId: 'admin-demo-ava',
      memberIds: ['u3', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'supportCase',
      ownerId: 'c-support-admin-u3',
      supportCase: {
        status: 'solved',
        assignee: {
          userId: 'admin-demo-ava',
          name: 'Ava',
          initials: 'AV'
        },
        updatedAtIso: '2026-05-13T01:40:00.000Z'
      }
    }
  ],
  u1: [
    {
      id: 'c-support-admin-u1',
      avatar: 'MS',
      title: 'MyScoutee Support',
      lastMessage: 'Please check this shared asset screen.',
      lastSenderId: 'u1',
      memberIds: ['u1', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'appSupport',
      ownerId: 'c-support-admin-u1',
      serviceContext: 'notification'
    },
    {
      id: 'c1',
      avatar: 'MS',
      title: 'Driver Split - Alpine Weekend',
      lastMessage: 'I can take one extra seat from downtown pickup.',
      lastSenderId: 'u5',
      memberIds: ['u5', 'u4', 'u10', 'u7'],
      unread: 5
    },
    {
      id: 'c2',
      avatar: 'NH',
      title: 'Padel Night Pair Room',
      lastMessage: 'Pair mode starts in 20 mins.',
      lastSenderId: 'u7',
      memberIds: ['u7', 'u6', 'u10', 'u3', 'u11'],
      unread: 2
    },
    {
      id: 'c3',
      avatar: 'LH',
      title: 'Host Circle Ops',
      lastMessage: '2 invites timed out. Should we rerun now?',
      lastSenderId: 'u10',
      memberIds: ['u10', 'u12', 'u8'],
      unread: 1
    }
  ],
  u2: [
    {
      id: 'c4',
      avatar: 'IB',
      title: 'City Brunch - Main Room',
      lastMessage: 'Table booked for 12:30.',
      lastSenderId: 'u6',
      memberIds: ['u6', 'u4', 'u1'],
      unread: 2
    }
  ],
  u3: [
    {
      id: 'c-app-support-u3',
      avatar: 'MS',
      title: 'MyScoutee Support',
      lastMessage: 'Share your workspace here when something looks wrong.',
      lastSenderId: 'admin-demo-ava',
      memberIds: ['u3', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 1,
      channelType: 'appSupport',
      ownerId: 'c-app-support-u3',
      serviceContext: 'notification'
    },
    {
      id: 'c5',
      avatar: 'LP',
      title: 'Trail Group - Transport',
      lastMessage: 'Need one more car seat.',
      lastSenderId: 'u5',
      memberIds: ['u5', 'u7', 'u10', 'u1'],
      unread: 4
    }
  ]
};

export class SeedChatsBuilder {
  private static readonly DEFAULT_USER_COUNT = 50;
  private static readonly FALLBACK_TIME = '2026-02-21T09:00:00';
  private static readonly USERS_BY_ID = new Map(
    SeedUserBuilder.buildExpandedDemoUsers(SeedChatsBuilder.DEFAULT_USER_COUNT)
      .map(user => [user.id, user] as const)
  );
  private static readonly ADMIN_USERS_BY_ID = new Map<string, ChatSeedUser>([
    ['admin-demo-ava', { id: 'admin-demo-ava', name: 'Ava', initials: 'AV', gender: 'woman', images: ['https://randomuser.me/api/portraits/women/65.jpg'] }],
    ['admin-demo-noel', { id: 'admin-demo-noel', name: 'Noel', initials: 'NO', gender: 'man', images: ['https://randomuser.me/api/portraits/men/32.jpg'] }]
  ]);

  static buildSeedRecordCollection(): SeedChatRecordCollection {
    return this.buildRecordCollection(
      Object.fromEntries(
        Object.entries(SEED_CHAT_ITEMS_BY_USER).map(([ownerUserId, items]) => [
          ownerUserId,
          items.map(item => ({
            ...item,
            memberIds: [...item.memberIds]
          }))
        ])
      )
    );
  }

  static buildContextualRecordCollectionForUser(
    ownerUserId: string,
    eventRecords: readonly ActivityEventRecord[]
  ): SeedChatRecordCollection {
    return this.buildRecordCollection({
      [ownerUserId]: this.buildContextualChatItemsForUser(ownerUserId, eventRecords)
    });
  }

  static buildContextualChatItemsForUser(
    ownerUserId: string,
    eventRecords: readonly ActivityEventRecord[]
  ): ChatRecord[] {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return [];
    }
    const records = eventRecords
      .filter(record => (record.type === 'events' || record.type === 'hosting') && record.status !== 'T');
    if (records.length === 0) {
      return [];
    }
    const items: ChatRecord[] = [];
    for (const record of records) {
      items.push(this.buildServiceContextChat(normalizedOwnerUserId, record));
      items.push(this.buildMainContextChat(normalizedOwnerUserId, record));
      const subEvents = this.sortSubEventsByStartAsc(this.contextSubEvents(record));
      for (const [index, subEvent] of subEvents.entries()) {
        const stageLabel = `Stage ${index + 1}`;
        if (subEvent.optional) {
          const optionalChat = this.buildOptionalContextChat(normalizedOwnerUserId, record, subEvent, stageLabel);
          if (optionalChat) {
            items.push(optionalChat);
          }
        }
        const groupChat = this.buildGroupContextChat(normalizedOwnerUserId, record, subEvent, stageLabel);
        if (groupChat) {
          items.push(groupChat);
        }
      }
    }
    return items;
  }

  static buildRecordCollection(itemsByUser: Record<string, readonly ChatRecord[]>): SeedChatRecordCollection {
    const byId: Record<string, ChatThreadRecord> = {};
    const ids: string[] = [];
    const messageById: Record<string, ChatMessageRecord> = {};
    const messageIds: string[] = [];
    const messageIdsByChatKey: Record<string, string[]> = {};
    for (const [ownerUserId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(ownerUserId, item.id);
        const dateIso = this.buildDateIso(ownerUserId, item);
        const messageRecords = this.buildMessageRecords(ownerUserId, item, dateIso);
        byId[recordKey] = {
          ...item,
          supportCase: this.rebaseSupportCase(item.supportCase),
          memberIds: [...item.memberIds],
          unread: this.countUnreadMessageRecords(messageRecords, ownerUserId),
          ownerUserId,
          dateIso
        };
        ids.push(recordKey);
        const chatKey = this.buildChatMessageChatKey(ownerUserId, item.id);
        for (const message of messageRecords) {
          messageById[message.recordId] = message;
          messageIds.push(message.recordId);
          messageIdsByChatKey[chatKey] = [...(messageIdsByChatKey[chatKey] ?? []), message.recordId];
        }
      }
    }
    return {
      chats: { byId, ids },
      chatMessages: {
        byId: messageById,
        ids: messageIds,
        idsByChatKey: messageIdsByChatKey
      }
    };
  }

  static cloneRecord(record: ChatThreadRecord): ChatThreadRecord {
    return {
      ...record,
      memberIds: [...record.memberIds],
      supportCase: this.cloneSupportCase(record.supportCase)
    };
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }

  static buildChatMessageChatKey(ownerUserId: string, chatId: string): string {
    return `${ownerUserId.trim()}:${chatId.trim()}`;
  }

  static buildChatMessageRecordKey(ownerUserId: string, chatId: string, messageId: string): string {
    return `${ownerUserId.trim()}:${chatId.trim()}:${messageId.trim()}`;
  }

  private static buildMainContextChat(ownerUserId: string, record: ActivityEventRecord): ChatRecord {
    const eventTitle = record.title.trim() || 'Event';
    const memberIds = this.seedEventMemberIds(ownerUserId, record, Math.max(4, record.acceptedMembers || 0));
    return this.createContextChatItem({
      id: `c-context-main-${record.id}`,
      title: `${eventTitle} · Main Event`,
      lastMessage: `Main event channel for ${eventTitle}.`,
      ownerId: record.id,
      channelType: 'mainEvent',
      memberIds,
      dateIso: record.startAtIso,
      unread: Math.max(0, Math.trunc(Number(record.pendingMembers) || 0))
    }, ownerUserId);
  }

  private static buildServiceContextChat(ownerUserId: string, record: ActivityEventRecord): ChatRecord {
    const eventTitle = record.title.trim() || 'Event';
    const organizerUserId = `${record.creatorUserId ?? ''}`.trim();
    const memberIds = this.uniqueUserIds([
      ownerUserId,
      organizerUserId,
      ...(record.type === 'hosting'
        ? this.seedEventMemberIds(ownerUserId, record, Math.max(record.acceptedMembers + record.pendingMembers, 1))
        : [])
    ]);
    return {
      ...this.createContextChatItem({
        id: `c-service-event-${record.id}-${ownerUserId}`,
        title: `${record.type === 'hosting' ? 'Notify Participants' : 'Contact Organizer'} · ${eventTitle}`,
        lastMessage: record.type === 'hosting'
          ? 'Notification channel for cancellations, postponements, and urgent event updates.'
          : `Service chat with the organizer for ${eventTitle}.`,
        ownerId: record.id,
        channelType: 'serviceEvent',
        memberIds: memberIds.length > 0 ? memberIds : [ownerUserId],
        dateIso: record.startAtIso,
        unread: 0
      }, ownerUserId),
      serviceContext: record.type === 'hosting' ? 'notification' : 'event'
    };
  }

  private static buildOptionalContextChat(
    ownerUserId: string,
    record: ActivityEventRecord,
    subEvent: ChatSeedSubEvent,
    stageLabel: string
  ): ChatRecord | null {
    const acceptedTarget = this.contextChatMemberTarget(record, subEvent);
    if (acceptedTarget <= 0) {
      return null;
    }
    const eventTitle = record.title.trim() || 'Event';
    const memberIds = this.uniqueUserIds([
      ownerUserId,
      ...SeedEventBuilder.seededEventMemberIds(
        `chat-optional:${record.id}:${subEvent.id}`,
        Math.max(acceptedTarget, 4),
        [...this.USERS_BY_ID.values()],
        ownerUserId
      )
    ]).slice(0, Math.max(1, acceptedTarget));
    return this.createContextChatItem({
      id: `c-context-optional-${record.id}-${subEvent.id}`,
      title: `${subEvent.name || 'Optional Sub Event'} · Optional`,
      lastMessage: `${stageLabel} optional channel in ${eventTitle}.`,
      ownerId: this.subEventOwnerId(record.id, subEvent.id),
      channelType: 'optionalSubEvent',
      memberIds,
      dateIso: subEvent.startAt || record.startAtIso,
      unread: this.sumSubEventPending(subEvent, true)
    }, ownerUserId);
  }

  private static buildGroupContextChat(
    ownerUserId: string,
    record: ActivityEventRecord,
    subEvent: ChatSeedSubEvent,
    stageLabel: string
  ): ChatRecord | null {
    if (!this.hasTournamentGroupContext(subEvent)) {
      return null;
    }
    const eventTitle = record.title.trim() || 'Event';
    const groupId = `${subEvent.id}-group-1`;
    const groupCapacity = Math.max(
      this.countValue(subEvent.tournamentGroupCapacityMax),
      this.countValue(subEvent.tournamentGroupCapacityMin),
      4
    );
    const acceptedTarget = Math.max(1, Math.min(this.contextChatMemberTarget(record, subEvent), groupCapacity));
    const memberIds = this.uniqueUserIds([
      ownerUserId,
      ...SeedEventBuilder.seededEventMemberIds(
        `chat-group:${record.id}:${subEvent.id}:${groupId}`,
        Math.max(acceptedTarget, 4),
        [...this.USERS_BY_ID.values()],
        ownerUserId
      )
    ]).slice(0, Math.max(1, acceptedTarget));
    return this.createContextChatItem({
      id: `c-context-group-${record.id}-${subEvent.id}-${groupId}`,
      title: `Group A · ${subEvent.name || stageLabel}`,
      lastMessage: `${stageLabel} group channel in ${eventTitle}.`,
      ownerId: this.groupOwnerId(record.id, subEvent.id, groupId),
      channelType: 'groupSubEvent',
      memberIds,
      dateIso: subEvent.startAt || record.startAtIso,
      unread: this.sumSubEventPending(subEvent, true)
    }, ownerUserId);
  }

  private static createContextChatItem(input: {
    id: string;
    title: string;
    lastMessage: string;
    ownerId: string;
    channelType: 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent' | 'serviceEvent';
    memberIds: string[];
    dateIso: string;
    unread: number;
  }, ownerUserId: string): ChatRecord {
    const memberIds = this.uniqueUserIds(input.memberIds);
    const senderCandidates = memberIds.filter(id => id !== ownerUserId);
    const lastSenderId = senderCandidates[0] ?? memberIds[0] ?? ownerUserId;
    return {
      id: input.id,
      avatar: AppUtils.initialsFromText(input.title),
      title: input.title,
      lastMessage: input.lastMessage,
      lastSenderId,
      memberIds,
      unread: Math.max(0, Math.trunc(Number(input.unread) || 0)),
      dateIso: input.dateIso,
      channelType: input.channelType,
      ownerId: input.ownerId
    };
  }

  private static seedEventMemberIds(ownerUserId: string, record: ActivityEventRecord, targetCount: number): string[] {
    const explicit = this.uniqueUserIds([ownerUserId]);
    if (explicit.length >= Math.max(1, targetCount)) {
      return explicit.slice(0, Math.max(1, targetCount));
    }
    return this.uniqueUserIds([
      ...explicit,
      ...SeedEventBuilder.seededEventMemberIds(
        record.id,
        Math.max(Math.max(4, targetCount), explicit.length),
        [...this.USERS_BY_ID.values()],
        ownerUserId
      )
    ]);
  }

  private static sumSubEventPending(
    subEvent: ChatSeedSubEvent,
    includeMembers: boolean
  ): number {
    return (includeMembers ? this.countValue(subEvent.membersPending) : 0)
      + this.countValue(subEvent.carsPending)
      + this.countValue(subEvent.accommodationPending)
      + this.countValue(subEvent.suppliesPending);
  }

  private static contextChatMemberTarget(
    record: ActivityEventRecord,
    subEvent: ChatSeedSubEvent
  ): number {
    return Math.max(
      1,
      this.countValue(subEvent.membersAccepted),
      Math.min(
        Math.max(1, this.countValue(subEvent.capacityMax)),
        Math.max(1, this.countValue(record.acceptedMembers))
      )
    );
  }

  private static hasTournamentGroupContext(subEvent: ChatSeedSubEvent): boolean {
    return subEvent.optional !== true
      && (
        this.countValue(subEvent.tournamentGroupCapacityMin) > 0
        || this.countValue(subEvent.tournamentGroupCapacityMax) > 0
        || this.countValue(subEvent.groupsCount) > 0
      );
  }

  private static countValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private static uniqueUserIds(ids: readonly string[]): string[] {
    const unique: string[] = [];
    for (const id of ids) {
      const normalizedId = `${id ?? ''}`.trim();
      if (!normalizedId || unique.includes(normalizedId)) {
        continue;
      }
      unique.push(normalizedId);
    }
    return unique;
  }

  private static contextSubEvents(record: ActivityEventRecord): ChatSeedSubEvent[] {
    return (record.subEvents ?? []).map((item, index) => ({
      id: `${item.id ?? ''}`.trim() || `subevent-${index + 1}`,
      name: `${item.name ?? ''}`.trim() || `Sub Event ${index + 1}`,
      description: `${item.description ?? ''}`.trim(),
      optional: item.optional === true,
      startAt: `${item.startAt ?? ''}`.trim() || record.startAtIso,
      endAt: `${item.endAt ?? ''}`.trim() || record.endAtIso,
      location: `${item.location ?? ''}`.trim(),
      capacityMin: item.capacityMin ?? null,
      capacityMax: item.capacityMax ?? item.tournamentGroupCapacityMax ?? null,
      groupsCount: item.groupsCount ?? null,
      tournamentGroupCapacityMin: item.tournamentGroupCapacityMin ?? null,
      tournamentGroupCapacityMax: item.tournamentGroupCapacityMax ?? null,
      tournamentLeaderboardType: item.tournamentLeaderboardType ?? null,
      tournamentAdvancePerGroup: item.tournamentAdvancePerGroup ?? null,
      membersAccepted: item.membersAccepted ?? 0,
      membersPending: item.membersPending ?? 0,
      carsPending: item.carsPending ?? 0,
      accommodationPending: item.accommodationPending ?? 0,
      suppliesPending: item.suppliesPending ?? 0
    }));
  }

  private static sortSubEventsByStartAsc(items: readonly ChatSeedSubEvent[]): ChatSeedSubEvent[] {
    return [...items].sort((left, right) => AppUtils.toSortableDate(left.startAt) - AppUtils.toSortableDate(right.startAt));
  }

  private static buildDateIso(ownerUserId: string, item: ChatRecord): string {
    const seed = AppUtils.hashText(`chat-date:${ownerUserId}:${item.id}:${item.title}`);
    const value = AppUtils.shiftDate(
      new Date(this.FALLBACK_TIME),
      SEED_SCHEDULE_REFERENCE_DATE,
      environment.bootstrapOffsetInDays
    );
    value.setDate(value.getDate() + (seed % 9));
    value.setHours(8 + (seed % 11), (seed % 4) * 15, 0, 0);
    return AppUtils.toIsoDateTime(value);
  }

  private static buildMessageRecords(ownerUserId: string, item: ChatRecord, anchorIso: string): ChatMessageRecord[] {
    const me = this.resolveUser(ownerUserId);
    if (!me) {
      return [];
    }
    const members = this.resolveMembers(item, me);
    const sender = this.resolveSender(item, members, me);
    const anchor = new Date(anchorIso || this.rebaseDateIso(this.FALLBACK_TIME));
    const at = (minutesBefore: number): Date => new Date(anchor.getTime() - (minutesBefore * 60 * 1000));
    const mk = (
      id: string,
      author: ChatSeedUser,
      text: string,
      sentAt: Date,
      readBy: readonly ChatSeedUser[]
    ): ChatMessageRecord => ({
      recordId: this.buildChatMessageRecordKey(ownerUserId, item.id, id),
      ownerUserId,
      chatId: item.id,
      messageId: id,
      senderName: author.name,
      senderAvatar: {
        userId: author.id,
        initials: author.initials,
        gender: author.gender,
        imageUrl: this.seedAvatarImageUrl(author)
      },
      bodyText: text,
      timeLabel: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      mine: author.id === me.id,
      readBy: readBy.map(user => ({
        userId: user.id,
        initials: user.initials,
        gender: user.gender,
        imageUrl: this.seedAvatarImageUrl(user)
      })),
      reactions: [],
      attachments: []
    });

    const memberA = members[0] ?? me;
    const memberB = members[1] ?? sender;
    const memberC = members[2] ?? me;
    const chatTopic = item.title.trim() || 'Event';
    const lastLine = item.lastMessage.trim() || `Update shared in ${chatTopic}.`;

    if (this.isSupportCaseChat(item)) {
      return this.applySeedUnreadState(
        item,
        me,
        this.buildSupportCaseMessages(item, me, members, sender, anchor, mk)
      );
    }

    const seed = AppUtils.hashText(`${ownerUserId}:${item.id}:${chatTopic}`);
    const olderPool = [
      'Shared updated ETA for everyone.',
      'Pinned the checklist in this room.',
      'Confirmed who can bring supplies.',
      'Noted backup plan if weather changes.',
      'Added the new member to transport.',
      'Assigned table and seat groups.',
      'Synced on arrival windows.',
      'Collected final confirmations.'
    ];
    const olderMessages: ChatMessageRecord[] = [];
    const olderCount = 36;
    const olderBaseStart = new Date(anchor.getTime() - ((olderCount + 12) * 40 * 60 * 1000));
    for (let index = olderCount - 1; index >= 0; index -= 1) {
      const senderCycle = index % 3;
      const author = senderCycle === 0 ? memberA : (senderCycle === 1 ? me : memberB);
      const baseText = olderPool[(seed + index) % olderPool.length];
      const sequenceFromOldest = (olderCount - 1) - index;
      const sentAt = new Date(olderBaseStart.getTime() + (sequenceFromOldest * 40 * 60 * 1000));
      const readers = author.id === me.id ? [memberA, memberB] : [me, memberC];
      olderMessages.push(mk(`${item.id}-older-${index}`, author, baseText, sentAt, readers));
    }

    const recentMessages: ChatMessageRecord[] = [
      mk(`${item.id}-1`, memberA, `Let us align the plan for ${chatTopic}.`, at(180), [memberB, memberC]),
      mk(`${item.id}-2`, memberB, 'I can bring two more people.', at(140), [memberA, memberC]),
      mk(`${item.id}-3`, memberC, 'Route and timing look good on my side.', at(95), [memberA, memberB]),
      mk(`${item.id}-4`, sender, lastLine, at(48), [memberA, memberB, memberC]),
      mk(`${item.id}-5`, me, 'Perfect, locking this in.', at(12), [memberA, memberB])
    ];

    return this.applySeedUnreadState(
      item,
      me,
      [...olderMessages, ...recentMessages]
        .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso))
    );
  }

  private static applySeedUnreadState(
    item: ChatRecord,
    owner: ChatSeedUser,
    messages: readonly ChatMessageRecord[]
  ): ChatMessageRecord[] {
    const unreadTarget = this.countValue(item.unread);
    const incomingIndexes = messages
      .map((message, index) => ({ message, index }))
      .filter(entry => !entry.message.mine && entry.message.senderAvatar.userId !== owner.id)
      .sort((left, right) => AppUtils.toSortableDate(right.message.sentAtIso) - AppUtils.toSortableDate(left.message.sentAtIso))
      .map(entry => entry.index);
    const unreadIndexes = new Set(incomingIndexes.slice(0, unreadTarget));
    return messages.map((message, index) => {
      if (message.mine || message.senderAvatar.userId === owner.id) {
        return message;
      }
      return unreadIndexes.has(index)
        ? this.withoutMessageReader(message, owner.id)
        : this.withMessageReader(message, owner);
    });
  }

  private static withoutMessageReader(message: ChatMessageRecord, userId: string): ChatMessageRecord {
    const nextReadBy = (message.readBy ?? []).filter(reader => reader.userId !== userId);
    return nextReadBy.length === message.readBy.length
      ? message
      : {
          ...message,
          readBy: nextReadBy
        };
  }

  private static withMessageReader(message: ChatMessageRecord, user: ChatSeedUser): ChatMessageRecord {
    if ((message.readBy ?? []).some(reader => reader.userId === user.id)) {
      return message;
    }
    return {
      ...message,
      readBy: [
        ...(message.readBy ?? []),
        {
          userId: user.id,
          initials: user.initials,
          gender: user.gender,
          imageUrl: this.seedAvatarImageUrl(user)
        }
      ]
    };
  }

  private static countUnreadMessageRecords(messages: readonly ChatMessageRecord[], ownerUserId: string): number {
    return messages.filter(message =>
      !message.mine
      && message.senderAvatar.userId !== ownerUserId
      && !(message.readBy ?? []).some(reader => reader.userId === ownerUserId)
    ).length;
  }

  private static rebaseOptionalDateIso(value: string | null | undefined): string | undefined {
    const normalizedValue = `${value ?? ''}`.trim();
    if (!normalizedValue) {
      return undefined;
    }
    return this.rebaseDateIso(normalizedValue);
  }

  private static rebaseDateIso(value: string): string {
    return AppUtils.rebaseDateTime(value, SEED_SCHEDULE_REFERENCE_DATE, environment.bootstrapOffsetInDays) ?? value;
  }

  private static rebaseSupportCase(supportCase: ChatSupportCase | null | undefined): ChatSupportCase | null | undefined {
    if (!supportCase) {
      return supportCase;
    }
    return {
      ...supportCase,
      assignee: supportCase.assignee ? { ...supportCase.assignee } : supportCase.assignee,
      updatedAtIso: this.rebaseOptionalDateIso(supportCase.updatedAtIso)
    };
  }

  private static cloneSupportCase(supportCase: ChatSupportCase | null | undefined): ChatSupportCase | null | undefined {
    if (!supportCase) {
      return supportCase;
    }
    return {
      ...supportCase,
      assignee: supportCase.assignee ? { ...supportCase.assignee } : supportCase.assignee
    };
  }

  private static subEventOwnerId(eventId: string, subEventId: string): string {
    return `${eventId}:${subEventId}`;
  }

  private static groupOwnerId(eventId: string, subEventId: string, groupId: string): string {
    return `${eventId}:${subEventId}:${groupId}`;
  }

  private static buildSupportCaseMessages(
    item: ChatRecord,
    me: ChatSeedUser,
    members: readonly ChatSeedUser[],
    sender: ChatSeedUser,
    anchor: Date,
    mk: (
      id: string,
      author: ChatSeedUser,
      text: string,
      sentAt: Date,
      readBy: readonly ChatSeedUser[]
    ) => ChatMessageRecord
  ): ChatMessageRecord[] {
    const at = (minutesBefore: number): Date => new Date(anchor.getTime() - (minutesBefore * 60 * 1000));
    const requester = members.find(user => !this.isAdminSeedUser(user.id)) ?? sender;
    const assignedAdmin = this.resolveUser(item.supportCase?.assignee?.userId ?? '')
      ?? members.find(user => this.isAdminSeedUser(user.id) && user.id !== requester.id)
      ?? me;
    const reviewer = members.find(user => this.isAdminSeedUser(user.id) && user.id !== assignedAdmin.id)
      ?? assignedAdmin;
    const readByAdmins = this.uniqueSeedUsers([assignedAdmin, reviewer]);
    const readByRequesterAndReviewer = this.uniqueSeedUsers([requester, reviewer]);
    const lastLine = item.lastMessage.trim() || 'Please check this support case.';

    const messages: ChatMessageRecord[] = [
      mk(
        `${item.id}-support-1`,
        requester,
        this.supportCaseOpeningLine(item),
        at(160),
        readByAdmins
      ),
      mk(
        `${item.id}-support-2`,
        assignedAdmin,
        'Thanks, I can see the case. I am checking the related records now.',
        at(124),
        readByRequesterAndReviewer
      )
    ];

    if (item.supportCase?.status === 'picked') {
      messages.push(
        mk(
          `${item.id}-support-3`,
          assignedAdmin,
          'I picked this up so the rest of the admin team can see it is being handled.',
          at(82),
          readByRequesterAndReviewer
        ),
        mk(`${item.id}-support-4`, assignedAdmin, lastLine, at(42), readByRequesterAndReviewer)
      );
    } else if (item.supportCase?.status === 'solved') {
      messages.push(
        mk(
          `${item.id}-support-3`,
          requester,
          'That explains it, thanks for checking.',
          at(76),
          readByAdmins
        ),
        mk(`${item.id}-support-4`, assignedAdmin, lastLine, at(34), readByRequesterAndReviewer)
      );
    } else if (item.supportCase?.status === 'blocked') {
      messages.push(
        mk(
          `${item.id}-support-3`,
          assignedAdmin,
          'This case is blocked while moderation checks the account and linked content.',
          at(48),
          readByRequesterAndReviewer
        )
      );
    } else {
      messages.push(
        mk(`${item.id}-support-3`, requester, lastLine, at(44), readByAdmins)
      );
    }

    return messages.sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
  }

  private static supportCaseOpeningLine(item: ChatRecord): string {
    if (item.id === 'c-support-admin-u1') {
      return 'Hi, I shared an asset screen and something looks wrong with the visible action.';
    }
    if (item.id === 'c-support-admin-u2') {
      return 'Can you review why my event is blocked? I think the status changed after the report.';
    }
    if (item.id === 'c-support-admin-u3') {
      return 'Thanks for looking at the moderation review. I just want to know whether anything else is needed.';
    }
    return 'Hi, I need help with this support case.';
  }

  private static isSupportCaseChat(item: ChatRecord): boolean {
    return item.channelType === 'supportCase'
      || `${item.id ?? ''}`.trim().startsWith('c-support-admin-')
      || Boolean(item.supportCase);
  }

  private static uniqueSeedUsers(users: readonly ChatSeedUser[]): ChatSeedUser[] {
    const unique: ChatSeedUser[] = [];
    for (const user of users) {
      if (!user.id || unique.some(item => item.id === user.id)) {
        continue;
      }
      unique.push(user);
    }
    return unique;
  }

  private static isAdminSeedUser(userId: string): boolean {
    return this.ADMIN_USERS_BY_ID.has(userId.trim());
  }

  private static resolveUser(userId: string): ChatSeedUser | null {
    const normalized = userId.trim();
    return this.USERS_BY_ID.get(normalized) ?? this.ADMIN_USERS_BY_ID.get(normalized) ?? null;
  }

  private static resolveMembers(item: ChatRecord, fallback: ChatSeedUser): ChatSeedUser[] {
    const resolved = (item.memberIds ?? [])
      .map(id => this.resolveUser(id))
      .filter((entry): entry is ChatSeedUser => Boolean(entry));
    if (resolved.length > 0) {
      return resolved;
    }
    return [fallback, ...[...this.USERS_BY_ID.values()].filter(user => user.id !== fallback.id).slice(0, 2)];
  }

  private static resolveSender(item: ChatRecord, members: readonly ChatSeedUser[], fallback: ChatSeedUser): ChatSeedUser {
    const explicit = item.lastSenderId ? this.resolveUser(item.lastSenderId) : null;
    if (explicit) {
      return explicit;
    }
    return members[0] ?? fallback;
  }

  private static seedAvatarImageUrl(user: ChatSeedUser): string | null {
    return user.images?.map(image => `${image ?? ''}`.trim()).find(Boolean) ?? null;
  }
}

import { AppUtils } from '../../../app-utils';
import type { ChatPopupMessage } from '../../base/models/chat.model';
import type { ChatRecord } from '../../base/models/chat.model';
import type { UserDto } from '../../base/interfaces/user.interface';
import type { ChatThreadRecord, ChatThreadRecordCollection } from '../../base/models/chats.model';
import type { ActivityEventRecord } from '../../base/models/events.model';
import { LocalEventSeedBuilder } from './event-seed.builder';
import { LocalSeedScheduleBuilder } from './seed-schedule.builder';
import { LocalUserSeedBuilder } from './user-seed.builder';

type ChatSeedUser = Pick<UserDto, 'id' | 'name' | 'initials' | 'gender' | 'images'>;

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
      channelType: 'serviceEvent',
      supportCaseStatus: 'pending',
      supportCaseAssigneeUserId: null,
      supportCaseAssigneeName: null,
      supportCaseAssigneeInitials: null,
      supportCaseUpdatedAtIso: '2026-05-13T01:18:00.000Z'
    },
    {
      id: 'c-support-admin-u2',
      avatar: 'KB',
      title: 'MyScoutee Support · Kiss Balázs',
      lastMessage: 'I am looking into the blocked-event report.',
      lastSenderId: 'admin-demo-noel',
      memberIds: ['u2', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'serviceEvent',
      supportCaseStatus: 'picked',
      supportCaseAssigneeUserId: 'admin-demo-noel',
      supportCaseAssigneeName: 'Noel',
      supportCaseAssigneeInitials: 'NO',
      supportCaseUpdatedAtIso: '2026-05-13T01:32:00.000Z'
    },
    {
      id: 'c-support-admin-u3',
      avatar: 'NE',
      title: 'MyScoutee Support · Nagy Eszter',
      lastMessage: 'Case closed after moderation review.',
      lastSenderId: 'admin-demo-ava',
      memberIds: ['u3', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'serviceEvent',
      supportCaseStatus: 'solved',
      supportCaseAssigneeUserId: 'admin-demo-ava',
      supportCaseAssigneeName: 'Ava',
      supportCaseAssigneeInitials: 'AV',
      supportCaseUpdatedAtIso: '2026-05-13T01:40:00.000Z'
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
      channelType: 'serviceEvent',
      supportCaseStatus: 'pending',
      supportCaseAssigneeUserId: null,
      supportCaseAssigneeName: null,
      supportCaseAssigneeInitials: null,
      supportCaseUpdatedAtIso: '2026-05-13T01:18:00.000Z'
    },
    {
      id: 'c-support-admin-u2',
      avatar: 'KB',
      title: 'MyScoutee Support · Kiss Balázs',
      lastMessage: 'I am looking into the blocked-event report.',
      lastSenderId: 'admin-demo-noel',
      memberIds: ['u2', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'serviceEvent',
      supportCaseStatus: 'picked',
      supportCaseAssigneeUserId: 'admin-demo-noel',
      supportCaseAssigneeName: 'Noel',
      supportCaseAssigneeInitials: 'NO',
      supportCaseUpdatedAtIso: '2026-05-13T01:32:00.000Z'
    },
    {
      id: 'c-support-admin-u3',
      avatar: 'NE',
      title: 'MyScoutee Support · Nagy Eszter',
      lastMessage: 'Case closed after moderation review.',
      lastSenderId: 'admin-demo-ava',
      memberIds: ['u3', 'admin-demo-ava', 'admin-demo-noel'],
      unread: 0,
      channelType: 'serviceEvent',
      supportCaseStatus: 'solved',
      supportCaseAssigneeUserId: 'admin-demo-ava',
      supportCaseAssigneeName: 'Ava',
      supportCaseAssigneeInitials: 'AV',
      supportCaseUpdatedAtIso: '2026-05-13T01:40:00.000Z'
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
      channelType: 'serviceEvent',
      supportCaseStatus: 'pending',
      supportCaseAssigneeUserId: null,
      supportCaseAssigneeName: null,
      supportCaseAssigneeInitials: null,
      supportCaseUpdatedAtIso: '2026-05-13T01:18:00.000Z'
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

export class LocalChatsRepositoryBuilder {
  private static readonly DEFAULT_USER_COUNT = 50;
  private static readonly FALLBACK_TIME = '2026-02-21T09:00:00';
  private static readonly USERS_BY_ID = new Map(
    LocalUserSeedBuilder.buildExpandedDemoUsers(LocalChatsRepositoryBuilder.DEFAULT_USER_COUNT)
      .map(user => [user.id, user] as const)
  );
  private static readonly ADMIN_USERS_BY_ID = new Map<string, ChatSeedUser>([
    ['admin-demo-ava', { id: 'admin-demo-ava', name: 'Ava', initials: 'AV', gender: 'woman', images: ['https://randomuser.me/api/portraits/women/65.jpg'] }],
    ['admin-demo-noel', { id: 'admin-demo-noel', name: 'Noel', initials: 'NO', gender: 'man', images: ['https://randomuser.me/api/portraits/men/32.jpg'] }]
  ]);

  static buildSeedRecordCollection(): ChatThreadRecordCollection {
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
  ): ChatThreadRecordCollection {
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
      .filter(record => (record.type === 'events' || record.type === 'hosting') && !record.isTrashed);
    if (records.length === 0) {
      return [];
    }
    const items: ChatRecord[] = [];
    for (const record of records) {
      items.push(this.buildServiceContextChat(normalizedOwnerUserId, record));
      items.push(this.buildMainContextChat(normalizedOwnerUserId, record));
      const subEvents = this.sortSubEventsByStartAsc(record.subEvents ?? []);
      for (const [index, subEvent] of subEvents.entries()) {
        const stageLabel = `Stage ${index + 1}`;
        if (subEvent.optional) {
          const optionalChat = this.buildOptionalContextChat(normalizedOwnerUserId, record, subEvent, stageLabel);
          if (optionalChat) {
            items.push(optionalChat);
          }
          continue;
        }
        const groupChat = this.buildGroupContextChat(normalizedOwnerUserId, record, subEvent, stageLabel);
        if (groupChat) {
          items.push(groupChat);
        }
      }
    }
    return items;
  }

  static buildRecordCollection(itemsByUser: Record<string, readonly ChatRecord[]>): ChatThreadRecordCollection {
    const byId: Record<string, ChatThreadRecord> = {};
    const ids: string[] = [];
    for (const [ownerUserId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(ownerUserId, item.id);
        const dateIso = this.buildDateIso(ownerUserId, item);
        byId[recordKey] = {
          ...item,
          supportCaseUpdatedAtIso: this.rebaseOptionalDateIso(item.supportCaseUpdatedAtIso),
          memberIds: [...item.memberIds],
          ownerUserId,
          dateIso,
          messages: this.buildMessages(ownerUserId, item, dateIso)
        };
        ids.push(recordKey);
      }
    }
    return { byId, ids };
  }

  static cloneRecord(record: ChatThreadRecord, options: { includeMessages?: boolean } = {}): ChatThreadRecord {
    return {
      ...record,
      memberIds: [...record.memberIds],
      messages: options.includeMessages === false
        ? undefined
        : this.cloneMessages(record.messages ?? [])
    };
  }

  static cloneMessages(messages: readonly ChatPopupMessage[]): ChatPopupMessage[] {
    return messages.map(message => ({
      ...message,
      senderAvatar: { ...message.senderAvatar },
      readBy: message.readBy.map(reader => ({ ...reader })),
      attachments: message.attachments?.map(attachment => ({ ...attachment })),
      replyTo: message.replyTo ? { ...message.replyTo } : message.replyTo,
      reactions: message.reactions?.map(reaction => ({ ...reaction }))
    }));
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }

  private static buildMainContextChat(ownerUserId: string, record: ActivityEventRecord): ChatRecord {
    const eventTitle = record.title.trim() || 'Event';
    const memberIds = this.seedEventMemberIds(ownerUserId, record, Math.max(4, record.acceptedMembers || 0));
    return this.createContextChatItem({
      id: `c-context-main-${record.id}`,
      title: `${eventTitle} · Main Event`,
      lastMessage: `Main event channel for ${eventTitle}.`,
      eventId: record.id,
      subEventId: '',
      groupId: '',
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
        eventId: record.id,
        subEventId: '',
        groupId: '',
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
    subEvent: NonNullable<ActivityEventRecord['subEvents']>[number],
    stageLabel: string
  ): ChatRecord | null {
    const acceptedTarget = this.countValue(subEvent.membersAccepted);
    if (acceptedTarget <= 0) {
      return null;
    }
    const eventTitle = record.title.trim() || 'Event';
    const memberIds = this.uniqueUserIds([
      ownerUserId,
      ...LocalEventSeedBuilder.seededEventMemberIds(
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
      eventId: record.id,
      subEventId: subEvent.id,
      groupId: '',
      channelType: 'optionalSubEvent',
      memberIds,
      dateIso: subEvent.startAt || record.startAtIso,
      unread: this.sumSubEventPending(subEvent, true)
    }, ownerUserId);
  }

  private static buildGroupContextChat(
    ownerUserId: string,
    record: ActivityEventRecord,
    subEvent: NonNullable<ActivityEventRecord['subEvents']>[number],
    stageLabel: string
  ): ChatRecord | null {
    const groups = [...(subEvent.groups ?? [])];
    if (groups.length === 0) {
      return null;
    }
    const groupId = LocalEventSeedBuilder.seededTournamentGroupIdForUser(record.id, subEvent.id, groups, ownerUserId);
    const group = groups.find(entry => entry.id === groupId) ?? groups[0] ?? null;
    if (!group) {
      return null;
    }
    const targetAccepted = this.estimateGroupAcceptedCount(subEvent, group, groups);
    const seededMembers = this.seedEventMemberIds(ownerUserId, record, Math.max(this.countValue(record.acceptedMembers), groups.length * 2))
      .filter(userId => LocalEventSeedBuilder.seededTournamentGroupIdForUser(record.id, subEvent.id, groups, userId) === group.id);
    const memberIds = this.uniqueUserIds([ownerUserId, ...seededMembers]).slice(0, Math.max(1, targetAccepted));
    const eventTitle = record.title.trim() || 'Event';
    return this.createContextChatItem({
      id: `c-context-group-${record.id}-${subEvent.id}-${group.id}`,
      title: `${group.name} · Group Channel`,
      lastMessage: `${stageLabel} group channel in ${eventTitle}.`,
      eventId: record.id,
      subEventId: subEvent.id,
      groupId: group.id,
      channelType: 'groupSubEvent',
      memberIds,
      dateIso: subEvent.startAt || record.startAtIso,
      unread: this.estimateGroupPendingCount(subEvent, group, groups)
    }, ownerUserId);
  }

  private static createContextChatItem(input: {
    id: string;
    title: string;
    lastMessage: string;
    eventId: string;
    subEventId: string;
    groupId: string;
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
      eventId: input.eventId,
      subEventId: input.subEventId || undefined,
      groupId: input.groupId || undefined
    };
  }

  private static seedEventMemberIds(ownerUserId: string, record: ActivityEventRecord, targetCount: number): string[] {
    const explicit = this.uniqueUserIds([ownerUserId]);
    if (explicit.length >= Math.max(1, targetCount)) {
      return explicit.slice(0, Math.max(1, targetCount));
    }
    return this.uniqueUserIds([
      ...explicit,
      ...LocalEventSeedBuilder.seededEventMemberIds(
        record.id,
        Math.max(Math.max(4, targetCount), explicit.length),
        [...this.USERS_BY_ID.values()],
        ownerUserId
      )
    ]);
  }

  private static estimateGroupAcceptedCount(
    subEvent: NonNullable<ActivityEventRecord['subEvents']>[number],
    group: NonNullable<NonNullable<ActivityEventRecord['subEvents']>[number]['groups']>[number],
    groups: NonNullable<NonNullable<ActivityEventRecord['subEvents']>[number]['groups']>
  ): number {
    const acceptedBase = this.countValue(subEvent.membersAccepted);
    const stageCapacity = Math.max(
      1,
      this.countValue(subEvent.capacityMax),
      groups.reduce((sum, item) => sum + this.countValue(item.capacityMax), 0),
      acceptedBase
    );
    const groupCapacity = Math.max(1, this.countValue(group.capacityMax));
    return Math.max(1, Math.min(groupCapacity, Math.round(acceptedBase * (groupCapacity / stageCapacity))));
  }

  private static estimateGroupPendingCount(
    subEvent: NonNullable<ActivityEventRecord['subEvents']>[number],
    group: NonNullable<NonNullable<ActivityEventRecord['subEvents']>[number]['groups']>[number],
    groups: NonNullable<NonNullable<ActivityEventRecord['subEvents']>[number]['groups']>
  ): number {
    const pendingBase = this.countValue(subEvent.membersPending);
    const stageCapacity = Math.max(
      1,
      this.countValue(subEvent.capacityMax),
      groups.reduce((sum, item) => sum + this.countValue(item.capacityMax), 0),
      pendingBase
    );
    const groupCapacity = Math.max(1, this.countValue(group.capacityMax));
    const sharedPending = Math.round(pendingBase * (groupCapacity / stageCapacity));
    return Math.max(0, sharedPending);
  }

  private static sumSubEventPending(
    subEvent: NonNullable<ActivityEventRecord['subEvents']>[number],
    includeMembers: boolean
  ): number {
    return (includeMembers ? this.countValue(subEvent.membersPending) : 0)
      + this.countValue(subEvent.carsPending)
      + this.countValue(subEvent.accommodationPending)
      + this.countValue(subEvent.suppliesPending);
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

  private static sortSubEventsByStartAsc(items: readonly NonNullable<ActivityEventRecord['subEvents']>[number][]): NonNullable<ActivityEventRecord['subEvents']>[number][] {
    return [...items].sort((left, right) => AppUtils.toSortableDate(left.startAt) - AppUtils.toSortableDate(right.startAt));
  }

  private static buildDateIso(ownerUserId: string, item: ChatRecord): string {
    const seed = AppUtils.hashText(`chat-date:${ownerUserId}:${item.id}:${item.title}`);
    const value = LocalSeedScheduleBuilder.shiftDate(new Date(this.FALLBACK_TIME));
    value.setDate(value.getDate() + (seed % 9));
    value.setHours(8 + (seed % 11), (seed % 4) * 15, 0, 0);
    return AppUtils.toIsoDateTime(value);
  }

  private static buildMessages(ownerUserId: string, item: ChatRecord, anchorIso: string): ChatPopupMessage[] {
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
    ): ChatPopupMessage => ({
      id,
      sender: author.name,
      senderAvatar: {
        id: author.id,
        initials: author.initials,
        gender: author.gender,
        imageUrl: this.seedAvatarImageUrl(author)
      },
      text,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      mine: author.id === me.id,
      readBy: readBy.map(user => ({
        id: user.id,
        initials: user.initials,
        gender: user.gender,
        imageUrl: this.seedAvatarImageUrl(user)
      }))
    });

    const memberA = members[0] ?? me;
    const memberB = members[1] ?? sender;
    const memberC = members[2] ?? me;
    const chatTopic = item.title.trim() || 'Event';
    const lastLine = item.lastMessage.trim() || `Update shared in ${chatTopic}.`;

    if (this.isSupportCaseChat(item)) {
      return this.buildSupportCaseMessages(item, me, members, sender, anchor, mk);
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
    const olderMessages: ChatPopupMessage[] = [];
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

    const recentMessages: ChatPopupMessage[] = [
      mk(`${item.id}-1`, memberA, `Let us align the plan for ${chatTopic}.`, at(180), [memberB, memberC]),
      mk(`${item.id}-2`, memberB, 'I can bring two more people.', at(140), [memberA, memberC]),
      mk(`${item.id}-3`, memberC, 'Route and timing look good on my side.', at(95), [memberA, memberB]),
      mk(`${item.id}-4`, sender, lastLine, at(48), [memberA, memberB, memberC]),
      mk(`${item.id}-5`, me, 'Perfect, locking this in.', at(12), [memberA, memberB])
    ];

    return [...olderMessages, ...recentMessages]
      .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
  }

  private static rebaseOptionalDateIso(value: string | null | undefined): string | undefined {
    const normalizedValue = `${value ?? ''}`.trim();
    if (!normalizedValue) {
      return undefined;
    }
    return this.rebaseDateIso(normalizedValue);
  }

  private static rebaseDateIso(value: string): string {
    return LocalSeedScheduleBuilder.rebaseDateTime(value) ?? value;
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
    ) => ChatPopupMessage
  ): ChatPopupMessage[] {
    const at = (minutesBefore: number): Date => new Date(anchor.getTime() - (minutesBefore * 60 * 1000));
    const requester = members.find(user => !this.isAdminSeedUser(user.id)) ?? sender;
    const assignedAdmin = this.resolveUser(item.supportCaseAssigneeUserId ?? '')
      ?? members.find(user => this.isAdminSeedUser(user.id) && user.id !== requester.id)
      ?? me;
    const reviewer = members.find(user => this.isAdminSeedUser(user.id) && user.id !== assignedAdmin.id)
      ?? assignedAdmin;
    const readByAdmins = this.uniqueSeedUsers([assignedAdmin, reviewer]);
    const readByRequesterAndReviewer = this.uniqueSeedUsers([requester, reviewer]);
    const lastLine = item.lastMessage.trim() || 'Please check this support case.';

    const messages: ChatPopupMessage[] = [
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

    if (item.supportCaseStatus === 'picked') {
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
    } else if (item.supportCaseStatus === 'solved') {
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
    } else if (item.supportCaseStatus === 'blocked') {
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
    return `${item.id ?? ''}`.trim().startsWith('c-support-admin-') || Boolean(item.supportCaseStatus);
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

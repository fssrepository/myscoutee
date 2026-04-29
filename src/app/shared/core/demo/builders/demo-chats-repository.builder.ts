import { AppUtils } from '../../../app-utils';
import type { ChatPopupMessage } from '../../base/models/chat.model';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import type { DemoChatRecord, DemoChatRecordCollection } from '../models/chats.model';
import type { DemoEventRecord } from '../models/events.model';
import { DemoEventSeedBuilder } from './demo-event-seed.builder';
import { DemoUserSeedBuilder } from './demo-user-seed.builder';

const SEED_CHAT_ITEMS_BY_USER: Record<string, ChatMenuItem[]> = {
  u1: [
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

export class DemoChatsRepositoryBuilder {
  private static readonly DEFAULT_USER_COUNT = 50;
  private static readonly FALLBACK_TIME = '2026-02-21T09:00:00';
  private static readonly USERS_BY_ID = new Map(
    DemoUserSeedBuilder.buildExpandedDemoUsers(DemoChatsRepositoryBuilder.DEFAULT_USER_COUNT)
      .map(user => [user.id, user] as const)
  );

  static buildSeedRecordCollection(): DemoChatRecordCollection {
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
    eventRecords: readonly DemoEventRecord[]
  ): DemoChatRecordCollection {
    return this.buildRecordCollection({
      [ownerUserId]: this.buildContextualChatItemsForUser(ownerUserId, eventRecords)
    });
  }

  static buildContextualChatItemsForUser(
    ownerUserId: string,
    eventRecords: readonly DemoEventRecord[]
  ): ChatMenuItem[] {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return [];
    }
    const records = eventRecords
      .filter(record => (record.type === 'events' || record.type === 'hosting') && !record.isTrashed);
    if (records.length === 0) {
      return [];
    }
    const items: ChatMenuItem[] = [];
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

  static buildRecordCollection(itemsByUser: Record<string, readonly ChatMenuItem[]>): DemoChatRecordCollection {
    const byId: Record<string, DemoChatRecord> = {};
    const ids: string[] = [];
    for (const [ownerUserId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(ownerUserId, item.id);
        const dateIso = this.buildDateIso(ownerUserId, item);
        byId[recordKey] = {
          ...item,
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

  static cloneRecord(record: DemoChatRecord, options: { includeMessages?: boolean } = {}): DemoChatRecord {
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
      readBy: message.readBy.map(reader => ({ ...reader }))
    }));
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }

  private static buildMainContextChat(ownerUserId: string, record: DemoEventRecord): ChatMenuItem {
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

  private static buildServiceContextChat(ownerUserId: string, record: DemoEventRecord): ChatMenuItem {
    const eventTitle = record.title.trim() || 'Event';
    const organizerUserId = `${record.creatorUserId ?? ''}`.trim();
    const memberIds = this.uniqueUserIds([
      ownerUserId,
      organizerUserId,
      ...(record.type === 'hosting' ? (record.acceptedMemberUserIds ?? []).slice(0, 6) : [])
    ]);
    return this.createContextChatItem({
      id: `c-service-event-${record.id}-${ownerUserId}`,
      title: `${record.type === 'hosting' ? 'Service Chat' : 'Contact Organizer'} · ${eventTitle}`,
      lastMessage: record.type === 'hosting'
        ? 'Service requests and participant questions arrive here.'
        : `Service chat with the organizer for ${eventTitle}.`,
      eventId: record.id,
      subEventId: '',
      groupId: '',
      channelType: 'serviceEvent',
      memberIds: memberIds.length > 0 ? memberIds : [ownerUserId],
      dateIso: record.startAtIso,
      unread: 0
    }, ownerUserId);
  }

  private static buildOptionalContextChat(
    ownerUserId: string,
    record: DemoEventRecord,
    subEvent: NonNullable<DemoEventRecord['subEvents']>[number],
    stageLabel: string
  ): ChatMenuItem | null {
    const acceptedTarget = this.countValue(subEvent.membersAccepted);
    if (acceptedTarget <= 0) {
      return null;
    }
    const eventTitle = record.title.trim() || 'Event';
    const memberIds = this.uniqueUserIds([
      ownerUserId,
      ...DemoEventSeedBuilder.seededEventMemberIds(
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
    record: DemoEventRecord,
    subEvent: NonNullable<DemoEventRecord['subEvents']>[number],
    stageLabel: string
  ): ChatMenuItem | null {
    const groups = [...(subEvent.groups ?? [])];
    if (groups.length === 0) {
      return null;
    }
    const groupId = DemoEventSeedBuilder.seededTournamentGroupIdForUser(record.id, subEvent.id, groups, ownerUserId);
    const group = groups.find(entry => entry.id === groupId) ?? groups[0] ?? null;
    if (!group) {
      return null;
    }
    const targetAccepted = this.estimateGroupAcceptedCount(subEvent, group, groups);
    const seededMembers = this.seedEventMemberIds(ownerUserId, record, Math.max(this.countValue(record.acceptedMembers), groups.length * 2))
      .filter(userId => DemoEventSeedBuilder.seededTournamentGroupIdForUser(record.id, subEvent.id, groups, userId) === group.id);
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
  }, ownerUserId: string): ChatMenuItem {
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

  private static seedEventMemberIds(ownerUserId: string, record: DemoEventRecord, targetCount: number): string[] {
    const explicit = this.uniqueUserIds([ownerUserId, ...(record.acceptedMemberUserIds ?? [])]);
    if (explicit.length >= Math.max(1, targetCount)) {
      return explicit.slice(0, Math.max(1, targetCount));
    }
    return this.uniqueUserIds([
      ...explicit,
      ...DemoEventSeedBuilder.seededEventMemberIds(
        record.id,
        Math.max(Math.max(4, targetCount), explicit.length),
        [...this.USERS_BY_ID.values()],
        ownerUserId
      )
    ]);
  }

  private static estimateGroupAcceptedCount(
    subEvent: NonNullable<DemoEventRecord['subEvents']>[number],
    group: NonNullable<NonNullable<DemoEventRecord['subEvents']>[number]['groups']>[number],
    groups: NonNullable<NonNullable<DemoEventRecord['subEvents']>[number]['groups']>
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
    subEvent: NonNullable<DemoEventRecord['subEvents']>[number],
    group: NonNullable<NonNullable<DemoEventRecord['subEvents']>[number]['groups']>[number],
    groups: NonNullable<NonNullable<DemoEventRecord['subEvents']>[number]['groups']>
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
    subEvent: NonNullable<DemoEventRecord['subEvents']>[number],
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

  private static sortSubEventsByStartAsc(items: readonly NonNullable<DemoEventRecord['subEvents']>[number][]): NonNullable<DemoEventRecord['subEvents']>[number][] {
    return [...items].sort((left, right) => AppUtils.toSortableDate(left.startAt) - AppUtils.toSortableDate(right.startAt));
  }

  private static buildDateIso(ownerUserId: string, item: ChatMenuItem): string {
    const seed = AppUtils.hashText(`chat-date:${ownerUserId}:${item.id}:${item.title}`);
    const value = new Date('2026-02-21T09:00:00');
    value.setDate(value.getDate() + (seed % 9));
    value.setHours(8 + (seed % 11), (seed % 4) * 15, 0, 0);
    return AppUtils.toIsoDateTime(value);
  }

  private static buildMessages(ownerUserId: string, item: ChatMenuItem, anchorIso: string): ChatPopupMessage[] {
    const me = this.resolveUser(ownerUserId);
    if (!me) {
      return [];
    }
    const members = this.resolveMembers(item, me);
    const sender = this.resolveSender(item, members, me);
    const anchor = new Date(anchorIso || this.FALLBACK_TIME);
    const at = (minutesBefore: number): Date => new Date(anchor.getTime() - (minutesBefore * 60 * 1000));
    const mk = (
      id: string,
      author: UserDto,
      text: string,
      sentAt: Date,
      readBy: readonly UserDto[]
    ): ChatPopupMessage => ({
      id,
      sender: author.name,
      senderAvatar: {
        id: author.id,
        initials: author.initials,
        gender: author.gender
      },
      text,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      mine: author.id === me.id,
      readBy: readBy.map(user => ({
        id: user.id,
        initials: user.initials,
        gender: user.gender
      }))
    });

    const memberA = members[0] ?? me;
    const memberB = members[1] ?? sender;
    const memberC = members[2] ?? me;
    const chatTopic = item.title.trim() || 'Event';
    const lastLine = item.lastMessage.trim() || `Update shared in ${chatTopic}.`;

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

  private static resolveUser(userId: string): UserDto | null {
    return this.USERS_BY_ID.get(userId.trim()) ?? null;
  }

  private static resolveMembers(item: ChatMenuItem, fallback: UserDto): UserDto[] {
    const resolved = (item.memberIds ?? [])
      .map(id => this.resolveUser(id))
      .filter((entry): entry is UserDto => Boolean(entry));
    if (resolved.length > 0) {
      return resolved;
    }
    return [fallback, ...[...this.USERS_BY_ID.values()].filter(user => user.id !== fallback.id).slice(0, 2)];
  }

  private static resolveSender(item: ChatMenuItem, members: readonly UserDto[], fallback: UserDto): UserDto {
    const explicit = item.lastSenderId ? this.resolveUser(item.lastSenderId) : null;
    if (explicit) {
      return explicit;
    }
    return members[0] ?? fallback;
  }
}

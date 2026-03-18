import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppDemoGenerators } from '../../../app-demo-generators';
import type * as AppTypes from '../../../app-types';
import { AppUtils } from '../../../app-utils';
import { APP_DEMO_DATA, type DemoUser, type EventMenuItem, type HostingMenuItem, type InvitationMenuItem } from '../../../demo-data';
import type { LocationCoordinates } from '../../base/interfaces';
import type {
  DemoEventRecord,
  DemoEventRecordCollection,
  DemoRepositoryEventItemType
} from '../models/events.model';

const DEMO_EVENT_MEMBER_USERS = AppDemoGenerators.buildExpandedDemoUsers(50);

interface DemoEventSeedOverrides {
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  visibility?: DemoEventRecord['visibility'];
  blindMode?: DemoEventRecord['blindMode'];
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  capacityMin?: number | null;
  capacityMax?: number | null;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  topics?: string[];
  rating?: number;
  relevance?: number;
  affinity?: number;
}

export class DemoEventsRepositoryBuilder {
  static buildRecordCollection(options: {
    invitationsByUser: Record<string, readonly InvitationMenuItem[]>;
    eventsByUser: Record<string, readonly EventMenuItem[]>;
    hostingByUser: Record<string, readonly HostingMenuItem[]>;
    publishedById?: Record<string, boolean>;
  }): DemoEventRecordCollection {
    const byId: Record<string, DemoEventRecord> = {};
    const ids: string[] = [];
    const creatorUserIdByEventId = this.buildCreatorUserIdByEventId(options);

    for (const [userId, items] of Object.entries(options.invitationsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'invitations', item.id);
        byId[recordKey] = this.buildRecord({
          id: item.id,
          userId,
          type: 'invitations',
          avatar: item.avatar,
          title: item.description,
          subtitle: item.inviter,
          timeframe: item.when,
          inviter: item.inviter,
          unread: item.unread,
          activity: 0,
          isAdmin: false,
          isInvitation: true,
          isHosting: false,
          isTrashed: false,
          published: true,
          trashedAtIso: null,
          creatorUserId: creatorUserIdByEventId.get(item.id) ?? userId
        });
        ids.push(recordKey);
      }
    }

    for (const [userId, items] of Object.entries(options.eventsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'events', item.id);
        byId[recordKey] = this.buildRecord({
          id: item.id,
          userId,
          type: 'events',
          avatar: item.avatar,
          title: item.title,
          subtitle: item.shortDescription,
          timeframe: item.timeframe,
          inviter: null,
          unread: 0,
          activity: item.activity,
          isAdmin: item.isAdmin,
          isInvitation: false,
          isHosting: false,
          isTrashed: false,
          published: item.published ?? (options.publishedById?.[item.id] !== false),
          trashedAtIso: null,
          creatorUserId: creatorUserIdByEventId.get(item.id) ?? userId,
          seed: this.extractSeedOverrides(item)
        });
        ids.push(recordKey);
      }
    }

    for (const [userId, items] of Object.entries(options.hostingByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'hosting', item.id);
        byId[recordKey] = this.buildRecord({
          id: item.id,
          userId,
          type: 'hosting',
          avatar: item.avatar,
          title: item.title,
          subtitle: item.shortDescription,
          timeframe: item.timeframe,
          inviter: null,
          unread: 0,
          activity: item.activity,
          isAdmin: true,
          isInvitation: false,
          isHosting: true,
          isTrashed: false,
          published: item.published ?? (options.publishedById?.[item.id] !== false),
          trashedAtIso: null,
          creatorUserId: creatorUserIdByEventId.get(item.id) ?? userId,
          seed: this.extractSeedOverrides(item)
        });
        ids.push(recordKey);
      }
    }

    return { byId, ids };
  }

  static cloneRecord(record: DemoEventRecord): DemoEventRecord {
    return {
      ...record,
      locationCoordinates: this.cloneLocationCoordinates(record.locationCoordinates),
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      topics: [...record.topics]
    };
  }

  static buildRecordKey(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): string {
    return `${userId}:${type}:${sourceId}`;
  }

  private static buildCreatorUserIdByEventId(options: {
    invitationsByUser: Record<string, readonly InvitationMenuItem[]>;
    eventsByUser: Record<string, readonly EventMenuItem[]>;
    hostingByUser: Record<string, readonly HostingMenuItem[]>;
  }): Map<string, string> {
    const map = new Map<string, string>();
    for (const [userId, items] of Object.entries(options.hostingByUser)) {
      for (const item of items) {
        map.set(item.id, item.creatorUserId?.trim() || userId);
      }
    }
    for (const [userId, items] of Object.entries(options.eventsByUser)) {
      for (const item of items) {
        const explicitCreatorUserId = item.creatorUserId?.trim() || '';
        if (explicitCreatorUserId) {
          map.set(item.id, explicitCreatorUserId);
          continue;
        }
        if (item.isAdmin && !map.has(item.id)) {
          map.set(item.id, userId);
        }
      }
    }
    return map;
  }

  private static buildRecord(record: Pick<
    DemoEventRecord,
    | 'id'
    | 'userId'
    | 'type'
    | 'avatar'
    | 'title'
    | 'subtitle'
    | 'timeframe'
    | 'inviter'
    | 'unread'
    | 'activity'
    | 'isAdmin'
    | 'isInvitation'
    | 'isHosting'
    | 'isTrashed'
    | 'published'
    | 'trashedAtIso'
    | 'creatorUserId'
  > & {
    seed?: DemoEventSeedOverrides;
  }): DemoEventRecord {
    return {
      ...record,
      ...this.buildRecordDecorations(record)
    };
  }

  private static buildRecordDecorations(record: Pick<
    DemoEventRecord,
    | 'id'
    | 'title'
    | 'subtitle'
    | 'type'
    | 'userId'
    | 'activity'
    | 'isAdmin'
    | 'isInvitation'
    | 'published'
    | 'creatorUserId'
  > & {
    seed?: DemoEventSeedOverrides;
  }): Omit<
    DemoEventRecord,
    | 'id'
    | 'userId'
    | 'type'
    | 'avatar'
    | 'title'
    | 'subtitle'
    | 'timeframe'
    | 'inviter'
    | 'unread'
    | 'activity'
    | 'isAdmin'
    | 'isInvitation'
    | 'isHosting'
    | 'isTrashed'
    | 'published'
    | 'trashedAtIso'
  > {
    const creator = this.resolveCreatorUser(record.creatorUserId, record.title);
    const startAtIso = record.seed?.startAt?.trim() || this.resolveStartAtIso(record.id, record.type);
    const endAtIso = record.seed?.endAt?.trim() || this.resolveEndAtIso(record.id, startAtIso);
    const distanceKm = Number.isFinite(record.seed?.distanceKm)
      ? Math.max(0, Number(record.seed?.distanceKm))
      : this.resolveDistanceKm(record.id, record.type);
    const visibility = record.seed?.visibility
      ?? APP_DEMO_DATA.eventVisibilityById[record.id]
      ?? (record.type === 'hosting' ? 'Invitation only' : 'Public');
    const blindMode = record.seed?.blindMode ?? APP_DEMO_DATA.eventBlindModeById[record.id] ?? 'Open Event';
    const capacityRange = AppDemoGenerators.seededEventCapacityRange(record.id, APP_DEMO_DATA.activityCapacityById);
    const seededMembers = this.buildSeededMemberIds(record, startAtIso, distanceKm, creator);
    const acceptedMemberUserIds = this.normalizeUserIds(record.seed?.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeUserIds(record.seed?.pendingMemberUserIds);
    const members = {
      acceptedMemberUserIds: acceptedMemberUserIds.length > 0
        ? acceptedMemberUserIds
        : seededMembers.acceptedMemberUserIds,
      pendingMemberUserIds: pendingMemberUserIds.length > 0
        ? pendingMemberUserIds
        : seededMembers.pendingMemberUserIds
    };
    const acceptedMembers = members.acceptedMemberUserIds.length;
    const pendingMembers = members.pendingMemberUserIds.length;
    const capacityMin = this.normalizeCount(record.seed?.capacityMin) ?? this.normalizeCount(capacityRange.min);
    const capacityMax = this.normalizeCount(record.seed?.capacityMax) ?? this.normalizeCount(capacityRange.max);
    const capacityTotal = Math.max(
      acceptedMembers,
      capacityMax ?? acceptedMembers
    );
    const topics = this.normalizeTopics(record.seed?.topics).length > 0
      ? this.normalizeTopics(record.seed?.topics)
      : this.buildSeededTopics(record.id, record.title, record.subtitle);
    const rating = Number.isFinite(record.seed?.rating)
      ? Number(record.seed?.rating)
      : this.buildSeededRating(record.id, record.title, record.type);
    const acceptedUsers = members.acceptedMemberUserIds
      .map(userId => DEMO_EVENT_MEMBER_USERS.find(user => user.id === userId) ?? null)
      .filter((user): user is DemoUser => Boolean(user));
    return {
      creatorUserId: creator.id,
      creatorName: creator.name,
      creatorInitials: creator.initials,
      creatorGender: creator.gender,
      creatorCity: creator.city,
      visibility,
      blindMode,
      startAtIso,
      endAtIso,
      distanceKm,
      imageUrl: record.seed?.imageUrl?.trim()
        || APP_DEMO_DATA.activityImageById[record.id]
        || `https://picsum.photos/seed/event-explore-${record.id}/1200/700`,
      sourceLink: record.seed?.sourceLink?.trim() || (APP_DEMO_DATA.activitySourceLinkById[record.id] ?? ''),
      location: record.seed?.location?.trim() || '',
      locationCoordinates: this.cloneLocationCoordinates(record.seed?.locationCoordinates)
        ?? this.cloneLocationCoordinates(creator.locationCoordinates)
        ?? this.resolveLocationCoordinatesFromCreator(creator),
      capacityMin,
      capacityMax,
      capacityTotal,
      acceptedMembers,
      pendingMembers,
      acceptedMemberUserIds: members.acceptedMemberUserIds,
      pendingMemberUserIds: members.pendingMemberUserIds,
      topics,
      rating,
      relevance: Number.isFinite(record.seed?.relevance)
        ? Number(record.seed?.relevance)
        : this.buildSeededRelevance(record.id, record.title, record.type),
      affinity: Number.isFinite(record.seed?.affinity)
        ? Math.max(0, Math.trunc(Number(record.seed?.affinity)))
        : AppDemoGenerators.resolveEventAffinity({
          id: record.id,
          title: record.title,
          subtitle: record.subtitle,
          topics,
          visibility,
          blindMode,
          creator,
          acceptedUsers,
          rating,
          acceptedMembers,
          capacityTotal
        })
    };
  }

  private static resolveCreatorUser(userId: string, fallbackTitle: string): DemoUser {
    return DEMO_EVENT_MEMBER_USERS.find(user => user.id === userId)
      ?? DEMO_EVENT_MEMBER_USERS[0]
      ?? {
        id: userId,
        name: fallbackTitle || 'Unknown Host',
        age: 30,
        birthday: '1996-01-01',
        city: 'Austin',
        height: '175 cm',
        physique: 'Athletic',
        languages: ['English'],
        horoscope: 'Aries',
        initials: AppUtils.initialsFromText(fallbackTitle || 'Unknown Host'),
        gender: 'man',
        statusText: 'Recently Active',
        hostTier: 'Host',
        traitLabel: 'Reliable',
        completion: 60,
        headline: '',
        about: '',
        profileStatus: 'public',
        activities: { game: 0, chat: 0, invitations: 0, events: 0, hosting: 0 }
      };
  }

  private static resolveStartAtIso(id: string, type: DemoRepositoryEventItemType): string {
    if (type === 'hosting') {
      return APP_DEMO_DATA.hostingDatesById[id]
        ?? APP_DEMO_DATA.eventDatesById[id]
        ?? this.defaultStartIso(id);
    }
    if (type === 'invitations') {
      return APP_DEMO_DATA.invitationDatesById[id] ?? this.defaultStartIso(id);
    }
    return APP_DEMO_DATA.eventDatesById[id]
      ?? APP_DEMO_DATA.hostingDatesById[id]
      ?? this.defaultStartIso(id);
  }

  private static resolveEndAtIso(id: string, startAtIso: string): string {
    const explicit = APP_DEMO_DATA.activityDateTimeRangeById[id]?.endIso;
    if (explicit?.trim()) {
      return explicit;
    }
    const startAt = new Date(startAtIso);
    if (Number.isNaN(startAt.getTime())) {
      return new Date().toISOString();
    }
    return new Date(startAt.getTime() + (2 * 60 * 60 * 1000)).toISOString();
  }

  private static resolveDistanceKm(id: string, type: DemoRepositoryEventItemType): number {
    if (type === 'hosting') {
      return APP_DEMO_DATA.hostingDistanceById[id] ?? APP_DEMO_DATA.eventDistanceById[id] ?? 0;
    }
    if (type === 'invitations') {
      return APP_DEMO_DATA.invitationDistanceById[id] ?? 0;
    }
    return APP_DEMO_DATA.eventDistanceById[id] ?? APP_DEMO_DATA.hostingDistanceById[id] ?? 0;
  }

  private static buildSeededMemberIds(
    record: Pick<DemoEventRecord, 'id' | 'type' | 'title' | 'subtitle' | 'activity' | 'isAdmin'>,
    startAtIso: string,
    distanceKm: number,
    creator: DemoUser
  ): { acceptedMemberUserIds: string[]; pendingMemberUserIds: string[] } {
    if (record.type === 'invitations') {
      return {
        acceptedMemberUserIds: [],
        pendingMemberUserIds: []
      };
    }
    const row: AppTypes.ActivityListRow = {
      id: record.id,
      type: record.type === 'hosting' ? 'hosting' : 'events',
      title: record.title,
      subtitle: record.subtitle,
      detail: startAtIso,
      dateIso: startAtIso,
      distanceKm,
      unread: record.activity,
      metricScore: record.activity,
      isAdmin: record.type === 'hosting' ? true : record.isAdmin,
      source: {
        id: record.id,
        avatar: creator.initials,
        title: record.title,
        shortDescription: record.subtitle,
        timeframe: startAtIso,
        activity: record.activity,
        isAdmin: record.type === 'hosting' ? true : record.isAdmin
      } as AppTypes.ActivityListRow['source']
    };
    const rowKey = `${row.type}:${row.id}`;
    const members = AppDemoGenerators.generateActivityMembersForRow(
      row,
      rowKey,
      DEMO_EVENT_MEMBER_USERS,
      creator,
      APP_DEMO_DATA.activityMemberMetPlaces
    );
    return {
      acceptedMemberUserIds: members
        .filter(member => member.status === 'accepted')
        .map(member => member.userId),
      pendingMemberUserIds: members
        .filter(member => member.status === 'pending')
        .map(member => member.userId)
    };
  }

  private static buildSeededTopics(id: string, title: string, subtitle: string): string[] {
    const pool = Array.from(new Set(APP_STATIC_DATA.interestOptionGroups.flatMap(group => group.options)));
    if (pool.length === 0) {
      return [];
    }
    const seed = AppDemoGenerators.hashText(`${id}:${title}:${subtitle}`);
    const count = 2 + (seed % 2);
    const topics: string[] = [];
    for (let index = 0; index < pool.length && topics.length < count; index += 1) {
      const candidate = pool[(seed + (index * 3)) % pool.length];
      if (!topics.includes(candidate)) {
        topics.push(candidate);
      }
    }
    return topics;
  }

  private static buildSeededRating(id: string, title: string, type: DemoRepositoryEventItemType): number {
    const seed = AppDemoGenerators.hashText(`${type}:${id}:${title}`);
    return 6 + ((seed % 35) / 10);
  }

  private static buildSeededRelevance(id: string, title: string, type: DemoRepositoryEventItemType): number {
    const seed = AppDemoGenerators.hashText(`${type}:${id}:${title}`);
    return 50 + (seed % 51);
  }

  private static defaultStartIso(id: string): string {
    const day = 10 + (AppDemoGenerators.hashText(id) % 12);
    return new Date(Date.UTC(2026, 1, day, 12, 0, 0)).toISOString();
  }

  private static extractSeedOverrides(item: EventMenuItem | HostingMenuItem): DemoEventSeedOverrides | undefined {
    const overrides: DemoEventSeedOverrides = {
      startAt: item.startAt,
      endAt: item.endAt,
      distanceKm: item.distanceKm,
      visibility: item.visibility,
      blindMode: item.blindMode,
      imageUrl: item.imageUrl,
      sourceLink: item.sourceLink,
      location: item.location,
      locationCoordinates: this.cloneLocationCoordinates(item.locationCoordinates) ?? undefined,
      capacityMin: item.capacityMin,
      capacityMax: item.capacityMax,
      topics: item.topics,
      rating: item.rating,
      relevance: item.relevance,
      affinity: item.affinity
    };
    if (Object.values(overrides).every(value => value === undefined)) {
      return undefined;
    }
    return overrides;
  }

  private static normalizeTopics(topics: readonly string[] | undefined): string[] {
    if (!Array.isArray(topics)) {
      return [];
    }
    return Array.from(new Set(topics
      .map(topic => `${topic ?? ''}`.trim())
      .filter(topic => topic.length > 0)));
  }

  private static normalizeUserIds(userIds: readonly string[] | undefined): string[] {
    if (!Array.isArray(userIds)) {
      return [];
    }
    return Array.from(new Set(userIds
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private static normalizeCount(value: number | null | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private static resolveLocationCoordinatesFromCreator(creator: DemoUser): LocationCoordinates {
    return AppDemoGenerators.resolveDemoLocationCoordinates(creator.city, creator.id);
  }

  private static cloneLocationCoordinates(
    value: LocationCoordinates | null | undefined
  ): LocationCoordinates | null {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }
}

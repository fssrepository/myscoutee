import {
  DEMO_ACTIVITY_MEMBER_DEFAULTS,
  DEMO_ACTIVITY_MEMBER_MET_PLACES,
  DEMO_USERS,
  type DemoUser,
  type EventMenuItem,
  type HostingMenuItem
} from './demo-data';
import type {
  ActivityListRow,
  ActivityMemberEntry,
  ActivityMemberStatus,
  ActivityPendingSource,
  AssetCard,
  AssetMemberRequest,
  AssetRequestStatus,
  AssetType,
  EventExploreCard,
  ExperienceEntry
} from './app-types';
import { AppUtils } from './app-utils';

export class AppDemoGenerators {
  static hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }

  static buildExpandedDemoUsers(totalCount: number, baseUsers: DemoUser[] = DEMO_USERS): DemoUser[] {
    if (baseUsers.length >= totalCount) {
      return baseUsers.slice(0, totalCount);
    }
    const expanded: DemoUser[] = [...baseUsers];
    const firstNamesWomen = ['Emma', 'Sophia', 'Olivia', 'Mia', 'Lina', 'Nora', 'Chloe', 'Ivy', 'Ava', 'Zoe'];
    const firstNamesMen = ['Liam', 'Noah', 'Ethan', 'Mason', 'Lucas', 'Owen', 'Elijah', 'Leo', 'Ryan', 'Alex'];
    const lastNames = ['Parker', 'Reed', 'Stone', 'Lane', 'Baker', 'Hale', 'Rivera', 'Turner', 'Brooks', 'Grant'];
    const cities = ['Austin', 'Seattle', 'Chicago', 'Denver', 'Miami', 'Boston', 'Phoenix', 'Nashville', 'San Diego', 'Portland'];

    for (let index = baseUsers.length; index < totalCount; index += 1) {
      const id = `u${index + 1}`;
      const template = baseUsers[index % baseUsers.length];
      const gender = index % 2 === 0 ? 'woman' : 'man';
      const firstNamePool = gender === 'woman' ? firstNamesWomen : firstNamesMen;
      const firstName = firstNamePool[index % firstNamePool.length];
      const lastName = lastNames[(index * 3) % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const initials = `${firstName[0] ?? 'U'}${lastName[0] ?? 'S'}`.toUpperCase();
      const age = 24 + (index % 12);
      const birthday = new Date(1990 + (index % 11), index % 12, 1 + (index % 27));
      const portraitFolder = gender === 'woman' ? 'women' : 'men';
      const portraitIndex = (index * 7) % 100;
      expanded.push({
        ...template,
        id,
        name,
        age,
        birthday: birthday.toISOString().slice(0, 10),
        city: cities[index % cities.length],
        initials,
        gender,
        images: [`https://randomuser.me/api/portraits/${portraitFolder}/${portraitIndex}.jpg`]
      });
    }
    return expanded;
  }

  static defaultAssetImage(type: AssetType, seed = type.toLowerCase()): string {
    const flavor = type === 'Car'
      ? 'road'
      : type === 'Accommodation'
        ? 'stay'
        : 'gear';
    const normalizedSeed = encodeURIComponent(`${type.toLowerCase()}-${flavor}-${seed || type.toLowerCase()}`);
    return `https://picsum.photos/seed/${normalizedSeed}/1200/700`;
  }

  static defaultAssetSubtitle(type: AssetType): string {
    if (type === 'Car') {
      return 'Seats + luggage capacity';
    }
    if (type === 'Accommodation') {
      return 'Rooms + sleeping spots';
    }
    return 'Packed items + delivery window';
  }

  static defaultAssetDetails(type: AssetType): string {
    if (type === 'Car') {
      return 'Route, pickup time, and luggage constraints are confirmed.';
    }
    if (type === 'Accommodation') {
      return 'Check-in details, room setup, and stay notes are confirmed.';
    }
    return 'Item condition, handoff location, and timing are confirmed.';
  }

  static buildSampleAssetCards(users: DemoUser[]): AssetCard[] {
    return [
      {
        id: 'asset-car-1',
        type: 'Car',
        title: 'City-to-Lake SUV',
        subtitle: 'Hyundai Tucson · Automatic',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Pickup from Downtown at 17:30. Luggage: 2 cabin bags.',
        imageUrl: this.defaultAssetImage('Car', 'car-1'),
        sourceLink: this.defaultAssetImage('Car', 'car-1'),
        routes: ['Austin Downtown', 'Round Rock', 'Lake Travis'],
        requests: [
          this.buildAssetRequest('asset-member-1', 'u4', 'pending', 'Needs one medium suitcase slot.', users),
          this.buildAssetRequest('asset-member-2', 'u8', 'accepted', 'Can meet at 6th Street.', users),
          this.buildAssetRequest('asset-member-7', 'u2', 'accepted', 'Travels light with backpack only.', users)
        ]
      },
      {
        id: 'asset-car-2',
        type: 'Car',
        title: 'Airport Shuttle Hatchback',
        subtitle: 'Volkswagen Golf · Manual',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Airport run before midnight, fuel split evenly.',
        imageUrl: this.defaultAssetImage('Car', 'car-2'),
        sourceLink: this.defaultAssetImage('Car', 'car-2'),
        routes: ['Austin Airport', 'Domain Northside'],
        requests: [this.buildAssetRequest('asset-member-3', 'u6', 'pending', 'Landing at 22:40.', users)]
      },
      {
        id: 'asset-acc-1',
        type: 'Accommodation',
        title: 'South Congress Loft',
        subtitle: '2 bedrooms · 1 living room',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Check-in after 15:00. Quiet building, no smoking.',
        imageUrl: this.defaultAssetImage('Accommodation', 'acc-1'),
        sourceLink: this.defaultAssetImage('Accommodation', 'acc-1'),
        routes: ['101 South Congress Ave, Austin'],
        requests: [
          this.buildAssetRequest('asset-member-4', 'u3', 'pending', 'Staying for 2 nights.', users),
          this.buildAssetRequest('asset-member-5', 'u10', 'accepted', 'Can share room.', users)
        ]
      },
      {
        id: 'asset-acc-2',
        type: 'Accommodation',
        title: 'Eastside Guest Room',
        subtitle: 'Private room · Shared bathroom',
        city: 'Austin',
        capacityTotal: 2,
        details: 'Ideal for early risers. Parking available.',
        imageUrl: this.defaultAssetImage('Accommodation', 'acc-2'),
        sourceLink: this.defaultAssetImage('Accommodation', 'acc-2'),
        routes: ['East 6th Street, Austin'],
        requests: [this.buildAssetRequest('asset-member-6', 'u11', 'pending', 'Arrives Friday evening.', users)]
      },
      {
        id: 'asset-sup-1',
        type: 'Supplies',
        title: 'Camping Gear Kit',
        subtitle: 'Tent + lamps + first aid',
        city: 'Austin',
        capacityTotal: 6,
        details: 'Packed and ready in the garage. Pickup only.',
        imageUrl: this.defaultAssetImage('Supplies', 'sup-1'),
        sourceLink: this.defaultAssetImage('Supplies', 'sup-1'),
        requests: []
      },
      {
        id: 'asset-sup-2',
        type: 'Supplies',
        title: 'Game Night Box',
        subtitle: 'Board games + cards + speakers',
        city: 'Austin',
        capacityTotal: 4,
        details: 'Can deliver to venue before 19:00.',
        imageUrl: this.defaultAssetImage('Supplies', 'sup-2'),
        sourceLink: this.defaultAssetImage('Supplies', 'sup-2'),
        requests: []
      }
    ];
  }

  static buildSampleExperienceEntries(): ExperienceEntry[] {
    return [
      {
        id: 'exp-1',
        type: 'School',
        title: 'BSc Computer Science',
        org: 'State University',
        city: 'Austin',
        dateFrom: '2014-09',
        dateTo: '2018-06',
        description: 'Software engineering and distributed systems.'
      },
      {
        id: 'exp-2',
        type: 'Additional Project',
        title: 'Community Event Platform',
        org: 'Independent Project',
        city: 'Austin',
        dateFrom: '2018-09',
        dateTo: '2019-05',
        description: 'Built MVP with profile, event, and chat modules.'
      },
      {
        id: 'exp-3',
        type: 'Workspace',
        title: 'Community Lead',
        org: 'Studio Tide',
        city: 'Chicago',
        dateFrom: '2019-06',
        dateTo: '2021-08',
        description: 'Owned member engagement and host onboarding.'
      },
      {
        id: 'exp-4',
        type: 'Online Session',
        title: 'Remote Product Sprint',
        org: 'Northwind Labs',
        city: 'Online',
        dateFrom: '2021-10',
        dateTo: '2022-02',
        description: 'Cross-functional delivery for profile editor v2.'
      },
      {
        id: 'exp-5',
        type: 'Workspace',
        title: 'Product Manager',
        org: 'Northwind Labs',
        city: 'Austin',
        dateFrom: '2022-03',
        dateTo: 'Present',
        description: 'Leads social graph and trust product areas.'
      }
    ];
  }

  static toEventExploreCard(
    source: EventMenuItem | HostingMenuItem,
    sourceType: 'event' | 'hosting',
    nowEpochMs: number,
    options: {
      eventDatesById: Record<string, string>;
      hostingDatesById: Record<string, string>;
      eventDistanceById: Record<string, number>;
      hostingDistanceById: Record<string, number>;
      activityImageById: Record<string, string>;
      defaultStartIso: string;
    }
  ): EventExploreCard {
    const startIso = sourceType === 'event'
      ? (options.eventDatesById[source.id] ?? options.defaultStartIso)
      : (options.hostingDatesById[source.id] ?? options.defaultStartIso);
    const startSort = AppUtils.toSortableDate(startIso);
    const seed = this.hashText(`${sourceType}:${source.id}:${source.title}`);
    const rating = 6 + ((seed % 35) / 10);
    const relevance = 50 + (seed % 51);
    const distanceKm = sourceType === 'event'
      ? (options.eventDistanceById[source.id] ?? (5 + (seed % 35)))
      : (options.hostingDistanceById[source.id] ?? (5 + (seed % 35)));
    return {
      id: source.id,
      title: source.title,
      subtitle: source.shortDescription,
      timeframe: source.timeframe,
      imageUrl: options.activityImageById[source.id] ?? `https://picsum.photos/seed/event-explore-${source.id}/1200/700`,
      distanceKm,
      relevance,
      rating,
      startSort,
      isPast: startSort < nowEpochMs,
      sourceType
    };
  }

  static resolveSectionBadge(values: number[], itemCount: number): number {
    const positiveTotal = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
    if (positiveTotal > 0) {
      return positiveTotal;
    }
    return itemCount;
  }

  static seededMetric(
    user: Pick<DemoUser, 'id' | 'name' | 'city'>,
    offset: number,
    min: number,
    max: number
  ): number {
    const source = `${user.id}-${user.name}-${user.city}-${offset}`;
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return min + (hash % (max - min + 1));
  }

  static seededTournamentGroupIdForUser<TGroup extends { id: string }>(
    eventId: string,
    subEventId: string,
    groups: TGroup[],
    userId: string
  ): string {
    if (groups.length === 0) {
      return '';
    }
    const index = this.hashText(`group-chat-member:${eventId}:${subEventId}:${userId}`) % groups.length;
    return groups[index]?.id ?? groups[0]?.id ?? '';
  }

  static seededEventMemberIds(
    eventId: string,
    targetCount: number,
    users: DemoUser[],
    activeUserId: string
  ): string[] {
    const count = Math.max(4, Math.min(Math.max(4, targetCount), users.length));
    const others = users.filter(user => user.id !== activeUserId);
    const seeded: string[] = [activeUserId];
    if (others.length === 0) {
      return seeded;
    }
    const seed = this.hashText(`event-members:${eventId}`);
    for (let index = 0; index < others.length && seeded.length < count; index += 1) {
      const candidate = others[(seed + (index * 3)) % others.length];
      if (!seeded.includes(candidate.id)) {
        seeded.push(candidate.id);
      }
    }
    return seeded;
  }

  static isFriendOfActiveUser(userId: string, activeUserId: string): boolean {
    if (!userId || userId === activeUserId) {
      return false;
    }
    const seed = this.hashText(`${activeUserId}:friend:${userId}`);
    return (seed % 100) < 45;
  }

  static toActivityMemberEntry(
    user: DemoUser,
    row: ActivityListRow,
    rowKey: string,
    activeUserId: string,
    defaults: { status: ActivityMemberStatus; pendingSource: ActivityPendingSource; invitedByActiveUser: boolean },
    metPlaces: string[] = DEMO_ACTIVITY_MEMBER_MET_PLACES
  ): ActivityMemberEntry {
    const seed = this.hashText(`${rowKey}:${user.id}`);
    const metAt = AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((seed % 220) + 1));
    const place = metPlaces.length > 0 ? metPlaces[seed % metPlaces.length] : DEMO_ACTIVITY_MEMBER_DEFAULTS.forcedMetWhere;
    return {
      id: `${rowKey}:${user.id}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: user.statusText,
      role: row.isAdmin && user.id === activeUserId ? 'Admin' : 'Member',
      status: defaults.status,
      pendingSource: defaults.pendingSource,
      requestKind: defaults.status === 'pending' ? 'invite' : null,
      invitedByActiveUser: defaults.invitedByActiveUser,
      metAtIso: AppUtils.toIsoDateTime(metAt),
      actionAtIso: AppUtils.toIsoDateTime(metAt),
      metWhere: place,
      relevance: 40 + (seed % 61),
      avatarUrl: `https://i.pravatar.cc/1200?img=${(seed % 70) + 1}`
    };
  }

  static buildForcedAcceptedMembers(
    row: ActivityListRow,
    rowKey: string,
    count: number,
    users: DemoUser[],
    activeUser: DemoUser,
    forcedMetWhere = DEMO_ACTIVITY_MEMBER_DEFAULTS.forcedMetWhere
  ): ActivityMemberEntry[] {
    const templates = users.length > 0 ? users : [activeUser];
    const members: ActivityMemberEntry[] = [];
    const cappedCount = Math.max(1, count);
    for (let index = 0; index < cappedCount; index += 1) {
      const template = templates[index % templates.length];
      const ordinal = Math.floor(index / templates.length);
      const isSelf = index === 0;
      const userId = isSelf ? activeUser.id : `${template.id}-force-${ordinal + 1}-${index + 1}`;
      const when = AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((index % 30) + 1));
      members.push({
        id: `${rowKey}:${userId}`,
        userId,
        name: isSelf ? activeUser.name : template.name,
        initials: template.initials,
        gender: template.gender,
        city: template.city,
        statusText: template.statusText,
        role: isSelf && row.isAdmin ? 'Admin' : 'Member',
        status: 'accepted',
        pendingSource: null,
        requestKind: null,
        invitedByActiveUser: false,
        metAtIso: AppUtils.toIsoDateTime(when),
        actionAtIso: AppUtils.toIsoDateTime(when),
        metWhere: forcedMetWhere,
        relevance: 60 + ((index * 7) % 40),
        avatarUrl: `https://i.pravatar.cc/1200?img=${(this.hashText(`${rowKey}:${userId}`) % 70) + 1}`
      });
    }
    return members;
  }

  static generateActivityMembersForRow(
    row: ActivityListRow,
    rowKey: string,
    users: DemoUser[],
    activeUser: DemoUser,
    metPlaces: string[] = DEMO_ACTIVITY_MEMBER_MET_PLACES
  ): ActivityMemberEntry[] {
    const others = users.filter(user => user.id !== activeUser.id);
    if (others.length === 0) {
      return [this.toActivityMemberEntry(
        activeUser,
        row,
        rowKey,
        activeUser.id,
        { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
        metPlaces
      )];
    }
    const seed = this.hashText(`${row.type}:${row.id}`);
    const acceptedTarget = row.type === 'invitations' ? 2 + (seed % 3) : 4 + (seed % 3);
    const pendingTarget = row.type === 'invitations' ? 1 + ((seed >> 2) % 2) : 1 + ((seed >> 3) % 3);
    const picked: DemoUser[] = [activeUser];
    const offsets = [0, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
    for (const offset of offsets) {
      const candidate = others[(seed + offset) % others.length];
      if (!picked.some(item => item.id === candidate.id)) {
        picked.push(candidate);
      }
      if (picked.length >= acceptedTarget) {
        break;
      }
    }
    const accepted = picked.map(user => this.toActivityMemberEntry(
      user,
      row,
      rowKey,
      activeUser.id,
      { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
      metPlaces
    ));
    const acceptedIds = new Set(accepted.map(item => item.userId));
    const pendingPool = others.filter(user => !acceptedIds.has(user.id));
    const pendingCount = Math.min(pendingTarget, pendingPool.length);
    for (let index = 0; index < pendingCount; index += 1) {
      const user = pendingPool[index];
      const isJoinRequest = ((seed + index) % 3) === 0;
      const pendingSource: ActivityPendingSource = row.isAdmin ? 'admin' : 'member';
      const baseEntry = this.toActivityMemberEntry(
        user,
        row,
        rowKey,
        activeUser.id,
        {
          status: 'pending',
          pendingSource: isJoinRequest ? 'member' : pendingSource,
          invitedByActiveUser: !isJoinRequest
        },
        metPlaces
      );
      accepted.push({
        ...baseEntry,
        requestKind: isJoinRequest ? 'join' : 'invite'
      });
    }
    return accepted;
  }

  private static buildAssetRequest(
    id: string,
    userId: string,
    status: AssetRequestStatus,
    note: string,
    users: DemoUser[]
  ): AssetMemberRequest {
    const user = users.find(item => item.id === userId) ?? users[0] ?? DEMO_USERS[0] ?? null;
    if (!user) {
      return {
        id,
        userId,
        name: 'Unknown User',
        initials: 'UN',
        gender: 'man',
        status,
        note
      };
    }
    return {
      id,
      userId,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      status,
      note
    };
  }
}

import { buildDemoPortraitStack, DEMO_USERS, type DemoUser, type EventMenuItem, type HostingMenuItem } from './demo-data';
import { APP_STATIC_DATA } from './app-static-data';
import type { LocationCoordinates } from './core/base/interfaces';
import type {
  ActivityDateTimeRange,
  ActivityListRow,
  ActivityMemberEntry,
  ActivityMemberStatus,
  ActivityPendingSource,
  AssetCard,
  AssetMemberRequest,
  AssetRequestStatus,
  AssetType,
  EventCapacityRange,
  EventFeedbackCard,
  EventFeedbackOption,
  EventExploreCard,
  ExperienceEntry,
  SubEventFormItem,
  SubEventGroupItem,
  SubEventsDisplayMode
} from './core/base/models';
import { AppUtils } from './app-utils';

export class AppDemoGenerators {
  private static readonly CITY_LOCATION_COORDINATES_BY_NAME: Record<string, LocationCoordinates> = {
    Austin: { latitude: 30.2672, longitude: -97.7431 },
    Seattle: { latitude: 47.6062, longitude: -122.3321 },
    Chicago: { latitude: 41.8781, longitude: -87.6298 },
    Denver: { latitude: 39.7392, longitude: -104.9903 },
    Miami: { latitude: 25.7617, longitude: -80.1918 },
    Boston: { latitude: 42.3601, longitude: -71.0589 },
    Phoenix: { latitude: 33.4484, longitude: -112.0740 },
    Nashville: { latitude: 36.1627, longitude: -86.7816 },
    'San Diego': { latitude: 32.7157, longitude: -117.1611 },
    Portland: { latitude: 45.5152, longitude: -122.6784 }
  };

  static hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }

  static firstImageUrl(images: readonly string[] | undefined | null): string {
    return (images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .find(image => image.length > 0) ?? '';
  }

  static resolveUserAffinity(
    user: Pick<
      DemoUser,
      | 'id'
      | 'name'
      | 'age'
      | 'city'
      | 'height'
      | 'physique'
      | 'languages'
      | 'horoscope'
      | 'gender'
      | 'hostTier'
      | 'traitLabel'
      | 'completion'
    >
  ): number {
    const tokens = this.uniqueAffinityTokens([
      user.name,
      user.city,
      user.physique,
      ...(user.languages ?? []),
      user.horoscope,
      user.gender,
      user.hostTier,
      user.traitLabel
    ]);
    const heightCm = this.parseHeightCm(user.height) ?? 170;
    return (
      this.resolveAffinityTokenScore(tokens, `user:${user.id}`) * 97
      + Math.max(18, Math.trunc(Number(user.age) || 30)) * 17
      + heightCm * 11
      + Math.max(0, Math.trunc(Number(user.completion) || 0)) * 13
    );
  }

  static resolveEventAffinity(options: {
    id: string;
    title: string;
    subtitle?: string | null;
    topics: readonly string[];
    visibility: string;
    blindMode: string;
    creator?: Partial<DemoUser> | null;
    acceptedUsers?: ReadonlyArray<Partial<DemoUser> | null | undefined>;
    rating?: number | null;
    acceptedMembers?: number | null;
    capacityTotal?: number | null;
  }): number {
    const participantUsers = [
      options.creator ?? null,
      ...(options.acceptedUsers ?? [])
    ].filter((user): user is Partial<DemoUser> => Boolean(user));
    const participantAffinities = participantUsers
      .filter(user => typeof user.id === 'string' && user.id.trim().length > 0)
      .map(user => this.resolveUserAffinity({
        id: `${user.id}`,
        name: `${user.name ?? 'Unknown User'}`,
        age: Math.max(18, Math.trunc(Number(user.age) || 30)),
        city: `${user.city ?? ''}`,
        height: `${user.height ?? '170 cm'}`,
        physique: `${user.physique ?? ''}`,
        languages: [...(user.languages ?? [])],
        horoscope: `${user.horoscope ?? ''}`,
        gender: user.gender === 'woman' ? 'woman' : 'man',
        hostTier: `${user.hostTier ?? ''}`,
        traitLabel: `${user.traitLabel ?? ''}`,
        completion: Math.max(0, Math.trunc(Number(user.completion) || 0))
      }));
    const averageParticipantAffinity = participantAffinities.length > 0
      ? Math.round(participantAffinities.reduce((total, value) => total + value, 0) / participantAffinities.length)
      : 0;
    const tokens = this.uniqueAffinityTokens([
      options.title,
      options.subtitle ?? '',
      ...options.topics,
      options.visibility,
      options.blindMode,
      ...participantUsers.flatMap(user => [
        `${user.city ?? ''}`,
        `${user.physique ?? ''}`,
        ...((user.languages ?? []) as string[]),
        `${user.horoscope ?? ''}`,
        `${user.gender ?? ''}`,
        `${user.hostTier ?? ''}`,
        `${user.traitLabel ?? ''}`
      ])
    ]);
    return (
      this.resolveAffinityTokenScore(tokens, `event:${options.id}`) * 89
      + averageParticipantAffinity
      + Math.round(AppUtils.clampNumber(Number(options.rating) || 0, 0, 10) * 100) * 29
      + Math.max(0, Math.trunc(Number(options.acceptedMembers) || 0)) * 19
      + Math.max(0, Math.trunc(Number(options.capacityTotal) || 0)) * 7
    );
  }

  static buildExpandedDemoUsers(totalCount: number, baseUsers: DemoUser[] = DEMO_USERS): DemoUser[] {
    const normalizedBaseUsers = baseUsers.map(user => this.withResolvedLocationCoordinates(user));
    if (baseUsers.length >= totalCount) {
      return normalizedBaseUsers.slice(0, totalCount);
    }
    const expanded: DemoUser[] = [...normalizedBaseUsers];
    const firstNamesWomen = ['Emma', 'Sophia', 'Olivia', 'Mia', 'Lina', 'Nora', 'Chloe', 'Ivy', 'Ava', 'Zoe'];
    const firstNamesMen = ['Liam', 'Noah', 'Ethan', 'Mason', 'Lucas', 'Owen', 'Elijah', 'Leo', 'Ryan', 'Alex'];
    const lastNames = ['Parker', 'Reed', 'Stone', 'Lane', 'Baker', 'Hale', 'Rivera', 'Turner', 'Brooks', 'Grant'];
    const cities = ['Austin', 'Seattle', 'Chicago', 'Denver', 'Miami', 'Boston', 'Phoenix', 'Nashville', 'San Diego', 'Portland'];

    for (let index = baseUsers.length; index < totalCount; index += 1) {
      const id = `u${index + 1}`;
      const template = normalizedBaseUsers[index % normalizedBaseUsers.length];
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
      expanded.push(this.withResolvedLocationCoordinates({
        ...template,
        id,
        name,
        age,
        birthday: birthday.toISOString().slice(0, 10),
        city: cities[index % cities.length],
        initials,
        gender,
        images: buildDemoPortraitStack(gender, portraitIndex)
      }));
    }
    return expanded;
  }

  static resolveDemoLocationCoordinates(city: string, seedKey: string): LocationCoordinates {
    const base = this.CITY_LOCATION_COORDINATES_BY_NAME[city] ?? this.CITY_LOCATION_COORDINATES_BY_NAME['Austin'];
    const normalizedSeedKey = seedKey.trim() || city.trim() || 'demo-user';
    const seed = this.hashText(normalizedSeedKey);
    const latitudeOffset = (((seed % 29) - 14) * 0.0012);
    const longitudeOffset = (((Math.floor(seed / 29) % 29) - 14) * 0.0012);
    return {
      latitude: this.roundCoordinate(base.latitude + latitudeOffset),
      longitude: this.roundCoordinate(base.longitude + longitudeOffset)
    };
  }

  private static withResolvedLocationCoordinates(user: DemoUser): DemoUser {
    const nextUser = {
      ...user,
      locationCoordinates: this.cloneLocationCoordinates(user.locationCoordinates)
        ?? this.resolveDemoLocationCoordinates(user.city, user.id)
    };
    return {
      ...nextUser,
      affinity: Number.isFinite(nextUser.affinity)
        ? Number(nextUser.affinity)
        : this.resolveUserAffinity(nextUser)
    };
  }

  private static cloneLocationCoordinates(
    value: LocationCoordinates | undefined | null
  ): LocationCoordinates | null {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: this.roundCoordinate(value.latitude),
      longitude: this.roundCoordinate(value.longitude)
    };
  }

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((this.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
  }

  private static parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private static roundCoordinate(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  private static friendAffinityScore<T extends Pick<DemoUser, 'id' | 'city' | 'gender'>>(
    activeUser: T | null,
    candidate: T
  ): number {
    const normalizedCandidateId = candidate.id.trim();
    if (!normalizedCandidateId) {
      return Number.NEGATIVE_INFINITY;
    }
    const normalizedActiveUserId = activeUser?.id?.trim() ?? '';
    const [firstId, secondId] = [normalizedActiveUserId, normalizedCandidateId].sort();
    const pairSeed = this.hashText(`friend-pair:${firstId}:${secondId}`);
    const cityBonus = activeUser?.city?.trim() && activeUser.city === candidate.city ? 220 : 0;
    const genderBonus = activeUser?.gender && activeUser.gender === candidate.gender ? 40 : 0;
    return 10_000 - pairSeed + cityBonus + genderBonus;
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

  static buildEventFeedbackCards(options: {
    eventItems: EventMenuItem[];
    users: DemoUser[];
    activeUser: DemoUser;
    eventDatesById: Record<string, string>;
    activityImageById: Record<string, string>;
    eventFeedbackUnlockDelayMs: number;
    eventOverallOptions: EventFeedbackOption[];
    hostImproveOptions: EventFeedbackOption[];
    attendeeCollabOptions: EventFeedbackOption[];
    attendeeRejoinOptions: EventFeedbackOption[];
  }): EventFeedbackCard[] {
    const nowMs = Date.now();
    const eventCards: EventFeedbackCard[] = [];
    for (const item of options.eventItems) {
      if (item.isAdmin) {
        continue;
      }
      const startMs = this.eventStartAtMs(item.id, options.eventDatesById);
      if (startMs === null || nowMs < startMs + options.eventFeedbackUnlockDelayMs) {
        continue;
      }
      const eventLabel = this.eventFeedbackWhenLabel(item.id, options.eventDatesById);
      const host = this.feedbackHostUserForEvent(item.id, options.users, options.activeUser);
      const attendees = this.feedbackAttendeesForEvent(item.id, host.id, options.users, options.activeUser.id);
      eventCards.push({
        id: `feedback-event-${item.id}`,
        eventId: item.id,
        kind: 'event',
        targetUserId: host.id,
        targetRole: 'Admin',
        icon: 'event_available',
        imageUrl: options.activityImageById[item.id] ?? `https://picsum.photos/seed/event-feedback-card-${item.id}/1200/700`,
        toneClass: 'feedback-card-tone-event feedback-role-admin',
        heading: item.title,
        subheading: `${eventLabel} · ${item.shortDescription}`,
        identityTitle: `${host.name} · Host`,
        identitySubtitle: `Admin · ${host.city}`,
        identityStatusClass: 'member-status-admin',
        identityStatusIcon: 'admin_panel_settings',
        questionPrimary: `How did ${item.title} feel for you overall?`,
        questionSecondary: `What should ${host.name} improve next time?`,
        primaryOptions: options.eventOverallOptions,
        secondaryOptions: options.hostImproveOptions,
        answerPrimary: '',
        answerSecondary: ''
      });
      for (const attendee of attendees) {
        const attendeeRole = this.feedbackRoleForAttendee(item.id, attendee.id);
        eventCards.push({
          id: `feedback-attendee-${item.id}-${attendee.id}`,
          eventId: item.id,
          kind: 'attendee',
          attendeeUserId: attendee.id,
          targetUserId: attendee.id,
          targetRole: attendeeRole,
          icon: 'groups',
          imageUrl: this.firstImageUrl(attendee.images),
          toneClass: `feedback-card-tone-attendee ${this.feedbackRoleToneClass(attendeeRole)}`,
          heading: `${attendee.name} · ${item.title}`,
          subheading: `Attendee feedback · ${eventLabel}`,
          identityTitle: `${attendee.name}, ${attendee.age}`,
          identitySubtitle: `${attendeeRole} · ${attendee.city}`,
          identityStatusClass: this.feedbackRoleStatusClass(attendeeRole),
          identityStatusIcon: this.feedbackRoleStatusIcon(attendeeRole),
          questionPrimary: `How was collaboration with ${attendee.name} (${attendee.traitLabel}) during this event?`,
          questionSecondary: `Would you team up with ${attendee.name} again in a future event?`,
          primaryOptions: options.attendeeCollabOptions,
          secondaryOptions: options.attendeeRejoinOptions,
          answerPrimary: '',
          answerSecondary: ''
        });
      }
    }
    return eventCards;
  }

  static resolveSectionBadge(values: number[], itemCount: number): number {
    const positiveTotal = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
    if (positiveTotal > 0) {
      return positiveTotal;
    }
    return itemCount;
  }

  static syntheticEventActivityTotal(existingCount: number, minEventsPerUser: number): number {
    const normalizedExistingCount = Math.max(0, Math.trunc(existingCount));
    const normalizedMinimum = Math.max(0, Math.trunc(minEventsPerUser));
    const needed = Math.max(0, normalizedMinimum - normalizedExistingCount);
    let total = 0;
    for (let index = 0; index < needed; index += 1) {
      total += (index % 5) + 1;
    }
    return total;
  }

  static syntheticPendingEventFeedbackCount(
    existingCount: number,
    minEventsPerUser: number,
    nowMs: number,
    unlockDelayMs: number
  ): number {
    const normalizedExistingCount = Math.max(0, Math.trunc(existingCount));
    const normalizedMinimum = Math.max(0, Math.trunc(minEventsPerUser));
    const normalizedNowMs = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const normalizedUnlockDelayMs = Math.max(0, Math.trunc(unlockDelayMs));
    const needed = Math.max(0, normalizedMinimum - normalizedExistingCount);
    let total = 0;

    for (let index = 0; index < needed; index += 1) {
      const sequence = normalizedExistingCount + index + 1;
      if ((sequence % 4) === 0) {
        continue;
      }
      const startMs = new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0).getTime();
      if (normalizedNowMs >= startMs + normalizedUnlockDelayMs) {
        total += 1;
      }
    }

    return total;
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

  static seededEventCapacityRange(
    eventId: string,
    activityCapacityById: Record<string, string>
  ): EventCapacityRange {
    const source = activityCapacityById[eventId];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        const min = Math.max(0, Math.min(parts[0], parts[1]));
        const max = Math.max(min, parts[1]);
        return { min, max };
      }
    }
    const seed = this.hashText(`event-capacity:${eventId}`);
    const max = 10 + (seed % 24);
    const min = Math.max(0, Math.floor(max * 0.45));
    return { min, max };
  }

  static buildSeededSubEventsForEvent(
    source: EventMenuItem | HostingMenuItem,
    options: {
      isHosting: boolean;
      activityDateTimeRangeById: Record<string, ActivityDateTimeRange>;
      hostingDatesById: Record<string, string>;
      eventDatesById: Record<string, string>;
      eventCapacityById: Record<string, EventCapacityRange>;
      activityCapacityById: Record<string, string>;
      defaultStartIso: string;
      activeUserId: string;
    }
  ): SubEventFormItem[] {
    const dateSource = options.activityDateTimeRangeById[source.id];
    const fallbackStartIso = options.isHosting
      ? (options.hostingDatesById[source.id] ?? options.defaultStartIso)
      : (options.eventDatesById[source.id] ?? options.defaultStartIso);
    const start = new Date(dateSource?.startIso ?? fallbackStartIso);
    const end = new Date(
      dateSource?.endIso
      ?? new Date(start.getTime() + (4 * 60 * 60 * 1000)).toISOString().slice(0, 19)
    );
    const startMs = Number.isNaN(start.getTime()) ? Date.now() : start.getTime();
    const endMs = Number.isNaN(end.getTime()) || end.getTime() <= startMs
      ? (startMs + (4 * 60 * 60 * 1000))
      : end.getTime();
    const seed = this.hashText(`event-subevents:${source.id}:${source.title}:${source.shortDescription}`);
    const tournamentMode = (seed % 3) === 0;
    const eventCapacity = options.eventCapacityById[source.id]
      ?? this.seededEventCapacityRange(source.id, options.activityCapacityById);
    const eventMax = this.normalizedEventCapacityValue(eventCapacity.max) ?? 0;
    if (tournamentMode) {
      return this.buildSeededTournamentSubEvents(source, startMs, endMs, seed, options.activeUserId, eventMax);
    }
    return this.buildSeededCasualSubEvents(source, startMs, endMs, seed, options.activeUserId, eventMax);
  }

  static inferredSubEventsDisplayMode(items: SubEventFormItem[]): SubEventsDisplayMode {
    if (items.some(item => !item.optional && (item.groups?.length ?? 0) > 0)) {
      return 'Tournament';
    }
    return 'Casual';
  }

  static isFriendOfActiveUser(userId: string, activeUserId: string): boolean {
    if (!userId || userId === activeUserId) {
      return false;
    }
    const [firstId, secondId] = [activeUserId.trim(), userId.trim()].sort();
    const seed = this.hashText(`friend-pair:${firstId}:${secondId}`);
    return (seed % 100) < 32;
  }

  static friendUsersForActiveUser<T extends Pick<DemoUser, 'id' | 'city' | 'gender'>>(
    users: readonly T[],
    activeUserId: string,
    limit = 12
  ): T[] {
    const normalizedActiveUserId = activeUserId.trim();
    if (!normalizedActiveUserId || limit <= 0) {
      return [];
    }
    const activeUser = users.find(user => user.id === normalizedActiveUserId) ?? null;
    return users
      .filter(user => user.id.trim().length > 0 && user.id !== normalizedActiveUserId)
      .map(user => ({
        user,
        score: this.friendAffinityScore(activeUser, user)
      }))
      .sort((left, right) => right.score - left.score || left.user.id.localeCompare(right.user.id))
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map(entry => entry.user);
  }

  static toActivityMemberEntry(
    user: DemoUser,
    row: ActivityListRow,
    rowKey: string,
    activeUserId: string,
    defaults: { status: ActivityMemberStatus; pendingSource: ActivityPendingSource; invitedByActiveUser: boolean },
    metPlaces: string[] = APP_STATIC_DATA.activityMemberMetPlaces
  ): ActivityMemberEntry {
    const seed = this.hashText(`${rowKey}:${user.id}`);
    const metAt = AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((seed % 220) + 1));
    const place = metPlaces.length > 0 ? metPlaces[seed % metPlaces.length] : APP_STATIC_DATA.activityMemberDefaults.forcedMetWhere;
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
      avatarUrl: this.firstImageUrl(user.images)
    };
  }

  static buildForcedAcceptedMembers(
    row: ActivityListRow,
    rowKey: string,
    count: number,
    users: DemoUser[],
    activeUser: DemoUser,
    forcedMetWhere = APP_STATIC_DATA.activityMemberDefaults.forcedMetWhere
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
        avatarUrl: this.firstImageUrl(template.images)
      });
    }
    return members;
  }

  static generateActivityMembersForRow(
    row: ActivityListRow,
    rowKey: string,
    users: DemoUser[],
    activeUser: DemoUser,
    metPlaces: string[] = APP_STATIC_DATA.activityMemberMetPlaces
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

  private static buildSeededCasualSubEvents(
    source: EventMenuItem | HostingMenuItem,
    startMs: number,
    endMs: number,
    seed: number,
    activeUserId: string,
    eventMax: number
  ): SubEventFormItem[] {
    const count = 2 + (seed % 3);
    const totalMs = Math.max(2 * 60 * 60 * 1000, endMs - startMs);
    const slotMs = Math.max(45 * 60 * 1000, Math.floor(totalMs / count));
    const names = ['Kickoff', 'Main Session', 'Side Activity', 'Wrap-up'];
    const items: SubEventFormItem[] = [];
    for (let index = 0; index < count; index += 1) {
      const optional = index > 0 && ((seed + index) % 2 === 0);
      const stageStartMs = startMs + (index * slotMs);
      const stageEndMs = index === count - 1 ? endMs : Math.min(endMs, stageStartMs + slotMs);
      const slice = 0.45 + (((seed + index) % 4) * 0.12);
      const capacityMax = Math.max(0, Math.round(eventMax * slice));
      const capacityMin = optional ? 0 : Math.max(0, Math.min(capacityMax, Math.floor(capacityMax * 0.55)));
      const accepted = Math.min(capacityMax, Math.max(0, Math.floor(capacityMin * 0.7)));
      items.push({
        id: `seed-${source.id}-casual-${index + 1}`,
        name: `${names[index] ?? `Session ${index + 1}`}`,
        description: `${source.shortDescription} (${index + 1}/${count})`,
        startAt: AppUtils.toIsoDateTimeLocal(new Date(stageStartMs)),
        endAt: AppUtils.toIsoDateTimeLocal(new Date(Math.max(stageStartMs + (30 * 60 * 1000), stageEndMs))),
        createdByUserId: activeUserId,
        groups: [],
        optional,
        capacityMin,
        capacityMax,
        membersAccepted: accepted,
        membersPending: Math.max(0, capacityMax - accepted),
        carsPending: (seed + index) % 3,
        accommodationPending: (seed + index + 1) % 3,
        suppliesPending: (seed + index + 2) % 4
      });
    }
    return this.sortSubEventsByStartAsc(items);
  }

  private static buildSeededTournamentSubEvents(
    source: EventMenuItem | HostingMenuItem,
    startMs: number,
    endMs: number,
    seed: number,
    activeUserId: string,
    eventMax: number
  ): SubEventFormItem[] {
    const stageNames = ['Qualifiers', 'Semifinals', 'Finals'];
    const stageCount = 3;
    const totalMs = Math.max(3 * 60 * 60 * 1000, endMs - startMs);
    const slotMs = Math.max(60 * 60 * 1000, Math.floor(totalMs / stageCount));
    const items: SubEventFormItem[] = [];

    for (let index = 0; index < stageCount; index += 1) {
      const groupCount = Math.max(1, 4 >> index);
      const basePerGroupMax = Math.max(2, Math.ceil(Math.max(2, eventMax) / Math.max(1, groupCount * (index + 1))));
      const groups: SubEventGroupItem[] = [];
      for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
        const groupMax = Math.max(2, basePerGroupMax - (groupIndex % 2));
        const groupMin = Math.max(0, Math.floor(groupMax * 0.6));
        groups.push({
          id: `seed-${source.id}-s${index + 1}-g${groupIndex + 1}`,
          name: `Group ${String.fromCharCode(65 + groupIndex)}`,
          capacityMin: groupMin,
          capacityMax: groupMax,
          source: 'generated'
        });
      }
      const totals = this.groupCapacityTotals(groups);
      const stageStartMs = startMs + (index * slotMs);
      const stageEndMs = index === stageCount - 1 ? endMs : Math.min(endMs, stageStartMs + slotMs);
      const accepted = Math.min(totals.max, Math.max(0, Math.floor(totals.min * 0.7)));
      items.push({
        id: `seed-${source.id}-tournament-${index + 1}`,
        name: `${stageNames[index]}`,
        description: `${source.shortDescription} (${stageNames[index]})`,
        startAt: AppUtils.toIsoDateTimeLocal(new Date(stageStartMs)),
        endAt: AppUtils.toIsoDateTimeLocal(new Date(Math.max(stageStartMs + (45 * 60 * 1000), stageEndMs))),
        createdByUserId: activeUserId,
        groups,
        tournamentGroupCount: groups.length,
        tournamentGroupCapacityMin: Math.max(0, ...groups.map(group => Number(group.capacityMin) || 0)),
        tournamentGroupCapacityMax: Math.max(0, ...groups.map(group => Number(group.capacityMax) || 0)),
        tournamentLeaderboardType: (seed + index) % 2 === 0 ? 'Score' : 'Fifa',
        tournamentAdvancePerGroup: index === stageCount - 1 ? 0 : Math.max(1, 2 - index),
        optional: false,
        capacityMin: totals.min,
        capacityMax: totals.max,
        membersAccepted: accepted,
        membersPending: Math.max(0, totals.max - accepted),
        carsPending: (seed + index) % 2,
        accommodationPending: (seed + index + 1) % 2,
        suppliesPending: (seed + index + 2) % 3
      });
    }
    return this.sortSubEventsByStartAsc(items);
  }

  private static sortSubEventsByStartAsc(items: SubEventFormItem[]): SubEventFormItem[] {
    return [...items].sort((a, b) => AppUtils.toSortableDate(a.startAt) - AppUtils.toSortableDate(b.startAt));
  }

  private static normalizedEventCapacityValue(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private static groupCapacityTotals(groups: SubEventGroupItem[]): { min: number; max: number } {
    let min = 0;
    let max = 0;
    for (const group of groups) {
      const groupMin = Number(group.capacityMin);
      const groupMax = Number(group.capacityMax);
      const normalizedMin = Number.isFinite(groupMin) ? Math.max(0, Math.trunc(groupMin)) : 0;
      const normalizedMax = Number.isFinite(groupMax) ? Math.max(normalizedMin, Math.trunc(groupMax)) : normalizedMin;
      min += normalizedMin;
      max += normalizedMax;
    }
    return { min, max };
  }

  private static eventStartAtMs(eventId: string, eventDatesById: Record<string, string>): number | null {
    const iso = eventDatesById[eventId];
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  private static eventFeedbackWhenLabel(eventId: string, eventDatesById: Record<string, string>): string {
    const startMs = this.eventStartAtMs(eventId, eventDatesById);
    if (startMs === null) {
      return 'Recent event';
    }
    const parsed = new Date(startMs);
    const day = parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  }

  private static feedbackHostUserForEvent(eventId: string, users: DemoUser[], activeUser: DemoUser): DemoUser {
    const candidates = users.filter(user => user.id !== activeUser.id);
    if (candidates.length === 0) {
      return activeUser;
    }
    const index = this.hashText(`feedback-host:${eventId}`) % candidates.length;
    return candidates[index] ?? candidates[0];
  }

  private static feedbackAttendeesForEvent(
    eventId: string,
    hostId: string,
    users: DemoUser[],
    activeUserId: string
  ): DemoUser[] {
    const candidates = users.filter(user => user.id !== activeUserId && user.id !== hostId);
    if (candidates.length === 0) {
      return [];
    }
    const seed = this.hashText(`feedback-attendees:${eventId}`);
    const desired = Math.min(candidates.length, 3 + (seed % 4));
    const picked: DemoUser[] = [];
    for (let index = 0; index < candidates.length && picked.length < desired; index += 1) {
      const candidate = candidates[(seed + (index * 3)) % candidates.length];
      if (!candidate || candidate.id === activeUserId || picked.some(item => item.id === candidate.id)) {
        continue;
      }
      picked.push(candidate);
    }
    return picked;
  }

  private static feedbackRoleForAttendee(eventId: string, attendeeUserId: string): 'Admin' | 'Manager' | 'Member' {
    const seed = this.hashText(`feedback-role:${eventId}:${attendeeUserId}`);
    if (seed % 11 === 0) {
      return 'Admin';
    }
    if (seed % 4 === 0) {
      return 'Manager';
    }
    return 'Member';
  }

  private static feedbackRoleToneClass(role: 'Admin' | 'Manager' | 'Member'): string {
    if (role === 'Admin') {
      return 'feedback-role-admin';
    }
    if (role === 'Manager') {
      return 'feedback-role-manager';
    }
    return 'feedback-role-member';
  }

  private static feedbackRoleStatusClass(role: 'Admin' | 'Manager' | 'Member'): string {
    if (role === 'Admin') {
      return 'member-status-admin';
    }
    if (role === 'Manager') {
      return 'member-status-manager';
    }
    return 'member-status-member';
  }

  private static feedbackRoleStatusIcon(role: 'Admin' | 'Manager' | 'Member'): string {
    if (role === 'Admin') {
      return 'admin_panel_settings';
    }
    if (role === 'Manager') {
      return 'manage_accounts';
    }
    return 'person';
  }
}

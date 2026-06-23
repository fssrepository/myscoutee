import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserRealtimeCountersDto,
  UserRealtimeLongPollResponseDto
} from '../../contracts/user.interface';

type RealtimeFlatCounterKey =
  | 'game'
  | 'chat'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'cars'
  | 'accommodation'
  | 'supplies'
  | 'tickets'
  | 'contacts'
  | 'feedback';

const USER_REALTIME_FLAT_COUNTER_KEYS: readonly RealtimeFlatCounterKey[] = [
  'game',
  'chat',
  'invitations',
  'events',
  'hosting',
  'cars',
  'accommodation',
  'supplies',
  'tickets',
  'contacts',
  'feedback'
];

interface RealtimeCounterOptions {
  includeNestedCounters?: boolean;
}

interface RealtimeSnapshotOptions extends RealtimeCounterOptions {
  serverTsIso?: string;
  userId?: string;
}

type RealtimeSnapshotInput = {
  userId?: string | null;
  counters?: UserRealtimeCountersDto | null;
  impressions?: UserImpressionsDto;
  cursor?: string | null;
  serverTsIso?: string;
};

export class UserRealtimeSnapshotMapper {
  static snapshotFromUser(
    user: UserDto,
    cursor: string | null = null,
    options: RealtimeSnapshotOptions = {}
  ): UserRealtimeLongPollResponseDto {
    const fallbackUserId = options.userId?.trim() || user.id.trim();
    return this.snapshot(
      {
        userId: fallbackUserId,
        counters: this.countersFromActivities(user.activities, options),
        impressions: user.impressions,
        cursor,
        serverTsIso: options.serverTsIso
      },
      fallbackUserId,
      cursor,
      options
    );
  }

  static countersFromActivities(
    activities: UserDto['activities'] | undefined,
    options: RealtimeCounterOptions = {}
  ): UserRealtimeCountersDto {
    return this.counters(
      {
        game: activities?.game,
        chat: activities?.chat,
        invitations: activities?.invitations,
        events: activities?.events,
        hosting: activities?.hosting,
        cars: activities?.cars,
        accommodation: activities?.accommodation,
        supplies: activities?.supplies,
        tickets: activities?.tickets,
        contacts: activities?.contacts,
        feedback: activities?.feedback,
        event: activities?.event,
        asset: activities?.asset,
        eventFeedback: activities?.eventFeedback,
        adminJobs: activities?.adminJobs,
        adminMetrics: activities?.adminMetrics,
        impressionsHostChanged: false,
        impressionsMemberChanged: false
      },
      options
    );
  }

  static snapshot(
    snapshot: RealtimeSnapshotInput,
    fallbackUserId: string,
    fallbackCursor: string | null = null,
    options: RealtimeCounterOptions = {}
  ): UserRealtimeLongPollResponseDto {
    const normalizedFallbackUserId = fallbackUserId.trim();
    const normalizedUserId = `${snapshot.userId ?? normalizedFallbackUserId}`.trim() || normalizedFallbackUserId;
    return {
      userId: normalizedUserId,
      counters: this.counters(snapshot.counters, options),
      impressions: this.impressions(snapshot.impressions),
      cursor: typeof snapshot.cursor === 'string'
        ? snapshot.cursor.trim()
        : fallbackCursor,
      serverTsIso: typeof snapshot.serverTsIso === 'string'
        ? snapshot.serverTsIso
        : new Date().toISOString()
    };
  }

  static counters(
    counters: UserRealtimeCountersDto | null | undefined,
    options: RealtimeCounterOptions = {}
  ): UserRealtimeCountersDto {
    const normalized: UserRealtimeCountersDto = {};
    for (const key of USER_REALTIME_FLAT_COUNTER_KEYS) {
      const value = this.normalizeCounter(counters?.[key]);
      if (value !== undefined) {
        normalized[key] = value;
      }
    }

    const adminJobs = this.normalizeCounter(counters?.adminJobs);
    const adminMetrics = this.normalizeCounter(counters?.adminMetrics);
    if (adminJobs !== undefined) {
      normalized.adminJobs = adminJobs;
    }
    if (adminMetrics !== undefined) {
      normalized.adminMetrics = adminMetrics;
    }

    const includeNestedCounters = options.includeNestedCounters !== false;
    if (includeNestedCounters || counters?.event) {
      normalized.event = {
        all: this.counterValue(counters?.event?.all),
        active: this.counterValue(counters?.event?.active),
        pending: this.counterValue(counters?.event?.pending),
        invitations: this.counterValue(counters?.event?.invitations),
        hosting: this.counterValue(counters?.event?.hosting),
        drafts: this.counterValue(counters?.event?.drafts),
        trash: this.counterValue(counters?.event?.trash)
      };
    }

    if (includeNestedCounters || counters?.asset) {
      normalized.asset = {
        cars: this.counterValue(counters?.asset?.cars),
        accommodation: this.counterValue(counters?.asset?.accommodation),
        supplies: this.counterValue(counters?.asset?.supplies),
        tickets: this.counterValue(counters?.asset?.tickets)
      };
    }

    if (includeNestedCounters || counters?.eventFeedback) {
      normalized.eventFeedback = {
        ownEvents: this.counterValue(counters?.eventFeedback?.ownEvents),
        pending: this.counterValue(counters?.eventFeedback?.pending),
        feedbacked: this.counterValue(counters?.eventFeedback?.feedbacked),
        removed: this.counterValue(counters?.eventFeedback?.removed)
      };
    }

    normalized.impressionsHostChanged = counters?.impressionsHostChanged === true;
    normalized.impressionsMemberChanged = counters?.impressionsMemberChanged === true;

    return normalized;
  }

  static impressions(impressions: UserImpressionsDto | undefined): UserImpressionsDto | undefined {
    if (!impressions) {
      return undefined;
    }
    return {
      host: this.impressionsSection(impressions.host),
      member: this.impressionsSection(impressions.member)
    };
  }

  static counterValue(value: unknown): number {
    const normalized = this.normalizeCounter(value);
    return normalized ?? 0;
  }

  private static normalizeCounter(value: unknown): number | undefined {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return undefined;
    }
    return Math.max(0, Math.trunc(numericValue));
  }

  private static impressionsSection(
    section: UserImpressionsSectionDto | undefined
  ): UserImpressionsSectionDto | undefined {
    if (!section) {
      return undefined;
    }
    return {
      ...section,
      vibeBadges: [...(section.vibeBadges ?? [])],
      personalityBadges: [...(section.personalityBadges ?? [])],
      personalityTraits: (section.personalityTraits ?? []).map(trait => ({ ...trait })),
      categoryBadges: [...(section.categoryBadges ?? [])]
    };
  }
}

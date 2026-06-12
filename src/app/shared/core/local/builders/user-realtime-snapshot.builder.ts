import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserRealtimeCountersDto,
  UserRealtimeLongPollResponseDto
} from '../../base/interfaces/user.interface';

type LocalRealtimeCounterKey =
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

const LOCAL_REALTIME_COUNTER_KEYS: readonly LocalRealtimeCounterKey[] = [
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

export interface LocalUserRealtimeSnapshotState {
  sourceUser: UserDto;
  cursor: number;
  snapshot: UserRealtimeLongPollResponseDto;
}

export class LocalUserRealtimeSnapshotBuilder {
  static buildInitialState(user: UserDto): LocalUserRealtimeSnapshotState {
    return {
      sourceUser: user,
      cursor: 0,
      snapshot: this.buildInitialSnapshot(user)
    };
  }

  static resetState(state: LocalUserRealtimeSnapshotState): LocalUserRealtimeSnapshotState {
    return this.buildInitialState(state.sourceUser);
  }

  static advanceState(
    state: LocalUserRealtimeSnapshotState,
    nextCursor: number
  ): LocalUserRealtimeSnapshotState {
    const increments = this.buildIncrements(state.sourceUser, nextCursor);
    const cursor = String(nextCursor);
    return {
      ...state,
      cursor: nextCursor,
      snapshot: {
        ...state.snapshot,
        counters: this.increaseCounters(state.snapshot.counters, increments),
        impressions: this.increaseImpressions(state.snapshot.impressions, increments),
        cursor
      }
    };
  }

  static snapshotForState(
    state: LocalUserRealtimeSnapshotState,
    options: { suppressImpressionChangeFlags?: boolean } = {}
  ): UserRealtimeLongPollResponseDto {
    if (!options.suppressImpressionChangeFlags) {
      return state.snapshot;
    }
    return {
      ...state.snapshot,
      counters: {
        ...state.snapshot.counters,
        impressionsHostChanged: false,
        impressionsMemberChanged: false
      }
    };
  }

  private static buildInitialSnapshot(user: UserDto): UserRealtimeLongPollResponseDto {
    const activities = user.activities ?? {};
    return {
      userId: user.id,
      counters: {
        game: activities.game,
        chat: activities.chat,
        invitations: activities.invitations,
        events: activities.events,
        hosting: activities.hosting,
        cars: activities.cars,
        accommodation: activities.accommodation,
        supplies: activities.supplies,
        tickets: activities.tickets,
        contacts: activities.contacts,
        feedback: activities.feedback,
        event: activities.event ? { ...activities.event } : undefined,
        asset: activities.asset ? { ...activities.asset } : undefined,
        eventFeedback: activities.eventFeedback ? { ...activities.eventFeedback } : undefined,
        adminJobs: activities.adminJobs,
        adminMetrics: activities.adminMetrics,
        impressionsHostChanged: false,
        impressionsMemberChanged: false
      },
      impressions: this.cloneImpressions(user.impressions),
      cursor: '0'
    };
  }

  private static buildIncrements(user: UserDto, cursor: number): UserRealtimeCountersDto {
    if (!this.hasRealtimeSource(user)) {
      return {
        impressionsHostChanged: false,
        impressionsMemberChanged: false
      };
    }

    const phase = Math.max(0, Math.trunc(cursor)) % 6;
    const events = phase === 1 ? 1 : 0;
    const hosting = phase === 2 ? 1 : 0;
    const game = phase === 3 ? 1 : 0;
    const chat = phase === 4 ? 1 : 0;
    const invitations = phase === 5 ? 1 : 0;
    const feedback = phase === 0 ? 1 : 0;

    return {
      game,
      chat,
      invitations,
      events,
      hosting,
      tickets: events + hosting > 0 ? 1 : 0,
      feedback,
      impressionsHostChanged: events + hosting > 0,
      impressionsMemberChanged: game + chat + invitations > 0
    };
  }

  private static increaseCounters(
    current: UserRealtimeCountersDto,
    increments: UserRealtimeCountersDto
  ): UserRealtimeCountersDto {
    const next: UserRealtimeCountersDto = {};
    for (const key of LOCAL_REALTIME_COUNTER_KEYS) {
      next[key] = this.count(current[key]) + this.count(increments[key]);
    }
    next.event = {
      all: this.count(current.event?.all) + this.count(increments.events) + this.count(increments.invitations) + this.count(increments.hosting),
      active: this.count(current.event?.active) + this.count(increments.events),
      pending: this.count(current.event?.pending),
      invitations: this.count(current.event?.invitations) + this.count(increments.invitations),
      hosting: this.count(current.event?.hosting) + this.count(increments.hosting),
      drafts: this.count(current.event?.drafts),
      trash: this.count(current.event?.trash)
    };
    next.asset = {
      cars: this.count(current.asset?.cars),
      accommodation: this.count(current.asset?.accommodation),
      supplies: this.count(current.asset?.supplies),
      tickets: this.count(current.asset?.tickets) + this.count(increments.tickets)
    };
    next.eventFeedback = {
      ownEvents: this.count(current.eventFeedback?.ownEvents),
      pending: this.count(current.eventFeedback?.pending) + this.count(increments.feedback),
      feedbacked: this.count(current.eventFeedback?.feedbacked),
      removed: this.count(current.eventFeedback?.removed)
    };
    next.adminJobs = this.count(current.adminJobs);
    next.adminMetrics = this.count(current.adminMetrics);
    next.impressionsHostChanged = increments.impressionsHostChanged === true;
    next.impressionsMemberChanged = increments.impressionsMemberChanged === true;
    return next;
  }

  private static increaseImpressions(
    impressions: UserImpressionsDto | undefined,
    increments: UserRealtimeCountersDto
  ): UserImpressionsDto | undefined {
    if (!impressions) {
      return undefined;
    }
    return {
      host: this.increaseImpressionSection(impressions.host, {
        unreadCount: this.count(increments.events) + this.count(increments.hosting),
        totalEvents: increments.events,
        repeatCount: increments.hosting
      }),
      member: this.increaseImpressionSection(impressions.member, {
        unreadCount: this.count(increments.game) + this.count(increments.chat) + this.count(increments.invitations),
        peopleMet: increments.invitations,
        totalEvents: increments.game
      })
    };
  }

  private static increaseImpressionSection(
    section: UserImpressionsSectionDto | undefined,
    increments: Pick<UserImpressionsSectionDto, 'unreadCount' | 'peopleMet' | 'totalEvents' | 'repeatCount'>
  ): UserImpressionsSectionDto | undefined {
    if (!section) {
      return undefined;
    }
    return {
      ...section,
      unreadCount: this.count(section.unreadCount) + this.count(increments.unreadCount),
      peopleMet: this.optionalCount(section.peopleMet, increments.peopleMet),
      totalEvents: this.optionalCount(section.totalEvents, increments.totalEvents),
      repeatCount: this.optionalCount(section.repeatCount, increments.repeatCount)
    };
  }

  private static hasRealtimeSource(user: UserDto): boolean {
    const activities = user.activities ?? {};
    return LOCAL_REALTIME_COUNTER_KEYS.some(key => this.count(activities[key]) > 0)
      || Boolean(user.impressions?.host || user.impressions?.member);
  }

  private static cloneImpressions(impressions: UserImpressionsDto | undefined): UserImpressionsDto | undefined {
    if (!impressions) {
      return undefined;
    }
    return {
      host: this.cloneImpressionSection(impressions.host),
      member: this.cloneImpressionSection(impressions.member)
    };
  }

  private static cloneImpressionSection(
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

  private static optionalCount(baseValue: unknown, incrementValue: unknown): number | undefined {
    if (!Number.isFinite(Number(baseValue)) && !Number.isFinite(Number(incrementValue))) {
      return undefined;
    }
    return this.count(baseValue) + this.count(incrementValue);
  }

  private static count(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
  }
}

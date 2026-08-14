import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserRealtimeCountersDto,
  UserRealtimeLongPollResponseDto,
  UserMenuCountersDto
} from '../../../contracts/user.interface';

type LocalRealtimeCounterKey =
  | 'game'
  | 'chats'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'cars'
  | 'accommodation'
  | 'supplies'
  | 'tickets'
  | 'contacts'
  | 'feedback'
  | 'notifications';

const LOCAL_REALTIME_COUNTER_KEYS: readonly LocalRealtimeCounterKey[] = [
  'game',
  'chats',
  'invitations',
  'events',
  'hosting',
  'cars',
  'accommodation',
  'supplies',
  'tickets',
  'contacts',
  'feedback',
  'notifications'
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

  static menuCountersForUser(user: UserDto): UserMenuCountersDto {
    const {
      impressionsHostChanged: _impressionsHostChanged,
      impressionsMemberChanged: _impressionsMemberChanged,
      ...counters
    } = this.buildInitialSnapshot(user).counters;
    return counters;
  }

  static rebaseState(
    state: LocalUserRealtimeSnapshotState,
    user: UserDto
  ): LocalUserRealtimeSnapshotState {
    if (state.sourceUser === user) {
      return state;
    }
    const previousBase = this.buildInitialSnapshot(state.sourceUser).counters;
    const nextBase = this.buildInitialSnapshot(user).counters;
    return {
      ...state,
      sourceUser: user,
      snapshot: {
        ...state.snapshot,
        counters: this.rebaseCounters(state.snapshot.counters, previousBase, nextBase)
      }
    };
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

  static withNotificationCount(
    state: LocalUserRealtimeSnapshotState,
    count: number
  ): LocalUserRealtimeSnapshotState {
    const notifications = this.count(count);
    return {
      ...state,
      sourceUser: {
        ...state.sourceUser,
        activities: {
          ...state.sourceUser.activities,
          notifications
        }
      },
      snapshot: {
        ...state.snapshot,
        counters: {
          ...state.snapshot.counters,
          notifications
        }
      }
    };
  }

  private static buildInitialSnapshot(user: UserDto): UserRealtimeLongPollResponseDto {
    const activities = user.activities ?? {};
    return {
      userId: user.id,
      counters: {
        game: activities.game,
        chats: activities.chats,
        invitations: activities.invitations,
        events: activities.events,
        hosting: activities.hosting,
        cars: activities.cars,
        accommodation: activities.accommodation,
        supplies: activities.supplies,
        tickets: activities.tickets,
        contacts: activities.contacts,
        feedback: activities.feedback,
        notifications: activities.notifications,
        chat: activities.chat ? { ...activities.chat } : undefined,
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
    const chats = phase === 4 ? 1 : 0;
    const invitations = phase === 5 ? 1 : 0;
    const feedback = phase === 0 ? 1 : 0;

    return {
      game,
      chats,
      chat: chats > 0 ? { all: chats } : undefined,
      invitations,
      events,
      hosting,
      tickets: events + hosting > 0 ? 1 : 0,
      feedback,
      impressionsHostChanged: events + hosting > 0,
      impressionsMemberChanged: game + chats + invitations > 0
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
    next.chat = {
      all: this.count(current.chat?.all) + this.count(increments.chat?.all),
      event: this.count(current.chat?.event) + this.count(increments.chat?.event),
      subEvent: this.count(current.chat?.subEvent) + this.count(increments.chat?.subEvent),
      group: this.count(current.chat?.group) + this.count(increments.chat?.group),
      service: this.count(current.chat?.service) + this.count(increments.chat?.service),
      appSupport: this.count(current.chat?.appSupport) + this.count(increments.chat?.appSupport)
    };
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

  private static rebaseCounters(
    current: UserRealtimeCountersDto,
    previousBase: UserRealtimeCountersDto,
    nextBase: UserRealtimeCountersDto
  ): UserRealtimeCountersDto {
    const next: UserRealtimeCountersDto = {
      ...current,
      impressionsHostChanged: current.impressionsHostChanged === true,
      impressionsMemberChanged: current.impressionsMemberChanged === true
    };
    for (const key of [...LOCAL_REALTIME_COUNTER_KEYS, 'adminJobs', 'adminMetrics'] as const) {
      next[key] = this.count(current[key])
        + this.count(nextBase[key])
        - this.count(previousBase[key]);
      next[key] = this.count(next[key]);
    }
    next.chat = this.rebaseNestedCounters(
      current.chat,
      previousBase.chat,
      nextBase.chat,
      ['all', 'event', 'subEvent', 'group', 'service', 'appSupport']
    );
    next.event = this.rebaseNestedCounters(
      current.event,
      previousBase.event,
      nextBase.event,
      ['all', 'active', 'pending', 'invitations', 'hosting', 'drafts', 'trash']
    );
    next.asset = this.rebaseNestedCounters(
      current.asset,
      previousBase.asset,
      nextBase.asset,
      ['cars', 'accommodation', 'supplies', 'tickets']
    );
    next.eventFeedback = this.rebaseNestedCounters(
      current.eventFeedback,
      previousBase.eventFeedback,
      nextBase.eventFeedback,
      ['ownEvents', 'pending', 'feedbacked', 'removed']
    );
    return next;
  }

  private static rebaseNestedCounters<T extends object>(
    current: T | undefined,
    previousBase: T | undefined,
    nextBase: T | undefined,
    keys: readonly (keyof T)[]
  ): T {
    const currentRecord = (current ?? {}) as Record<string, unknown>;
    const previousRecord = (previousBase ?? {}) as Record<string, unknown>;
    const nextRecord = (nextBase ?? {}) as Record<string, unknown>;
    return Object.fromEntries(keys.map(key => {
      const name = String(key);
      return [name, this.count(
        this.count(currentRecord[name])
        + this.count(nextRecord[name])
        - this.count(previousRecord[name])
      )];
    })) as T;
  }

  private static increaseImpressions(
    impressions: UserImpressionsDto,
    increments: UserRealtimeCountersDto
  ): UserImpressionsDto {
    return {
      host: this.increaseImpressionSection(impressions.host, {
        unreadCount: this.count(increments.events) + this.count(increments.hosting),
        totalEvents: increments.events,
        repeatCount: increments.hosting
      }),
      member: this.increaseImpressionSection(impressions.member, {
        unreadCount: this.count(increments.game) + this.count(increments.chats) + this.count(increments.invitations),
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

  private static cloneImpressions(impressions: UserImpressionsDto | undefined): UserImpressionsDto {
    if (!impressions) {
      return {};
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

import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserRealtimeLongPollResponseDto,
  UserMenuCountersDto
} from '../../../../contracts/accounts/user.interface';

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
    const fresh = this.buildInitialSnapshot(user);
    return {
      ...state,
      sourceUser: user,
      snapshot: {
        ...fresh,
        cursor: String(state.cursor),
        counters: {
          ...fresh.counters,
          impressionsHostChanged: JSON.stringify(state.sourceUser.impressions?.host) !== JSON.stringify(user.impressions?.host),
          impressionsMemberChanged: JSON.stringify(state.sourceUser.impressions?.member) !== JSON.stringify(user.impressions?.member)
        }
      }
    };
  }

  static advanceState(
    state: LocalUserRealtimeSnapshotState,
    nextCursor: number
  ): LocalUserRealtimeSnapshotState {
    // Advancing the transport cursor must not manufacture domain activity.
    return {
      ...state,
      cursor: nextCursor,
      snapshot: { ...state.snapshot, cursor: String(nextCursor) }
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
      profileStatus: user.profileStatus,
      notificationDevices: user.notificationDevices?.map(device => ({ ...device })),
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
        menuCounters: { ...(activities.menuCounters ?? {}) },
        paymentRefundsPending: activities.paymentRefundsPending,
        contactRequestsPending: activities.contactRequestsPending,
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
      paymentTotals: user.paymentTotals
        ? {
          outgoing: { ...(user.paymentTotals.outgoing ?? {}) },
          incoming: { ...(user.paymentTotals.incoming ?? {}) },
          all: { ...(user.paymentTotals.all ?? {}) }
        }
        : { outgoing: {}, incoming: {}, all: {} },
      cursor: '0'
    };
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

  private static count(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
  }
}

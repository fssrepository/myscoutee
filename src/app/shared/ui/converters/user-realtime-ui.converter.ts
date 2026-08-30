import type {
  UserImpressionsDto,
  UserRealtimeLongPollResponseDto
} from '../../core/contracts/user.interface';
import type {
  ActivityCounters
} from '../context/stores/activity.store';
import type {
  UserImpressionChangeFlags
} from '../context/stores/user-profile.store';

export interface UserRealtimeUiPatchInput {
  snapshot: UserRealtimeLongPollResponseDto;
  currentChangeFlags: UserImpressionChangeFlags;
  suppressImpressionBadges: boolean;
}

export interface UserRealtimeUiPatch {
  counterPatch: Partial<ActivityCounters>;
  impressions: UserImpressionsDto;
  changeFlags: UserImpressionChangeFlags | null;
  clearChangeFlags: boolean;
}

export class UserRealtimeUiConverter {
  static convert(input: UserRealtimeUiPatchInput): UserRealtimeUiPatch {
    const counterPatch = this.toCounterPatch(input.snapshot);
    const impressions = input.suppressImpressionBadges
      ? this.toSeenImpressions(input.snapshot.impressions)
      : input.snapshot.impressions;
    return {
      counterPatch,
      impressions,
      changeFlags: input.suppressImpressionBadges
        ? null
        : this.toImpressionChangeFlags(input.snapshot, input.currentChangeFlags),
      clearChangeFlags: input.suppressImpressionBadges
    };
  }

  static toCounterPatch(snapshot: UserRealtimeLongPollResponseDto): Partial<ActivityCounters> {
    const { impressionsHostChanged: _hostChanged, impressionsMemberChanged: _memberChanged, ...counters } = snapshot.counters;
    return { ...counters } as Partial<ActivityCounters>;
  }

  private static toSeenImpressions(impressions: UserImpressionsDto): UserImpressionsDto {
    return {
      host: impressions.host
        ? {
            ...impressions.host,
            unreadCount: 0
          }
        : undefined,
      member: impressions.member
        ? {
            ...impressions.member,
            unreadCount: 0
          }
        : undefined
    };
  }

  private static toImpressionChangeFlags(
    snapshot: UserRealtimeLongPollResponseDto,
    currentFlags: UserImpressionChangeFlags
  ): UserImpressionChangeFlags {
    return {
      host: currentFlags.host || snapshot.counters.impressionsHostChanged === true,
      member: currentFlags.member || snapshot.counters.impressionsMemberChanged === true
    };
  }

}

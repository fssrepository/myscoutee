import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserRealtimeLongPollResponseDto
} from '../../core/contracts/user.interface';
import type {
  ActivityCounters,
  UserImpressionChangeFlags
} from '../context/app-context.types';

export interface UserRealtimeUiPatchInput {
  snapshot: UserRealtimeLongPollResponseDto;
  previousImpressions: UserDto['impressions'] | null;
  currentChangeFlags: UserImpressionChangeFlags;
  suppressImpressionBadges: boolean;
}

export interface UserRealtimeUiPatch {
  counterPatch: Partial<ActivityCounters>;
  impressions: UserImpressionsDto | undefined;
  changeFlags: UserImpressionChangeFlags | null;
  clearChangeFlags: boolean;
}

export class UserRealtimeUiConverter {
  static convert(input: UserRealtimeUiPatchInput): UserRealtimeUiPatch {
    const counterPatch = this.toCounterPatch(input.snapshot);
    const impressions = input.snapshot.impressions
      ? (input.suppressImpressionBadges ? this.toSeenImpressions(input.snapshot.impressions) : input.snapshot.impressions)
      : undefined;
    return {
      counterPatch,
      impressions,
      changeFlags: input.suppressImpressionBadges
        ? null
        : this.toImpressionChangeFlags(input.snapshot, input.previousImpressions, input.currentChangeFlags),
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
    previousImpressions: UserDto['impressions'] | null,
    currentFlags: UserImpressionChangeFlags
  ): UserImpressionChangeFlags {
    const hostChangedByCounter = snapshot.counters.impressionsHostChanged === true;
    const memberChangedByCounter = snapshot.counters.impressionsMemberChanged === true;
    const hostChangedByDiff = this.hasImpressionsSectionChanged(previousImpressions?.host, snapshot.impressions?.host);
    const memberChangedByDiff = this.hasImpressionsSectionChanged(previousImpressions?.member, snapshot.impressions?.member);
    return {
      host: currentFlags.host || hostChangedByCounter || hostChangedByDiff,
      member: currentFlags.member || memberChangedByCounter || memberChangedByDiff
    };
  }

  private static hasImpressionsSectionChanged(
    previous: UserImpressionsSectionDto | undefined,
    next: UserImpressionsSectionDto | undefined
  ): boolean {
    if (!previous && !next) {
      return false;
    }
    if (!previous || !next) {
      return true;
    }
    return (
      this.impressionSectionCounter(previous.unreadCount) !== this.impressionSectionCounter(next.unreadCount)
      || (this.impressionSectionRating(previous.averageRating) ?? -1) !== (this.impressionSectionRating(next.averageRating) ?? -1)
      || (this.impressionSectionMetric(previous.peopleMet) ?? -1) !== (this.impressionSectionMetric(next.peopleMet) ?? -1)
      || (this.impressionSectionMetric(previous.totalEvents) ?? -1) !== (this.impressionSectionMetric(next.totalEvents) ?? -1)
      || (this.impressionSectionMetric(previous.repeatCount) ?? -1) !== (this.impressionSectionMetric(next.repeatCount) ?? -1)
      || (this.impressionSectionMetric(previous.noShowCount) ?? -1) !== (this.impressionSectionMetric(next.noShowCount) ?? -1)
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.vibeBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.vibeBadges ?? []))
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.personalityBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.personalityBadges ?? []))
      || JSON.stringify(this.normalizeImpressionTraits(previous.personalityTraits))
      !== JSON.stringify(this.normalizeImpressionTraits(next.personalityTraits))
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.categoryBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.categoryBadges ?? []))
    );
  }

  private static normalizeImpressionTraits(
    traits: UserImpressionsSectionDto['personalityTraits'] | undefined
  ): Array<{ id: string; percent: number; evidenceCount: number; lastRatedAtIso: string | null }> {
    return [...(traits ?? [])]
      .map(trait => ({
        id: `${trait.id ?? trait.label ?? ''}`.trim(),
        percent: Math.max(0, Math.trunc(Number(trait.percent) || 0)),
        evidenceCount: Math.max(0, Math.trunc(Number(trait.evidenceCount) || 0)),
        lastRatedAtIso: trait.lastRatedAtIso?.trim() || null
      }))
      .filter(trait => trait.id.length > 0)
      .sort((left, right) => right.percent - left.percent || left.id.localeCompare(right.id));
  }

  private static impressionSectionCounter(value: number | undefined): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private static impressionSectionMetric(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private static impressionSectionRating(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.min(5, Number(value)));
  }

  private static sortImpressionsBadgeItems(items: readonly string[]): string[] {
    const parsed = items.map(item => this.parseImpressionsBadgeItem(item));
    parsed.sort((left, right) => {
      if (left.percent !== null && right.percent !== null && left.percent !== right.percent) {
        return right.percent - left.percent;
      }
      if (left.percent !== null && right.percent === null) {
        return -1;
      }
      if (left.percent === null && right.percent !== null) {
        return 1;
      }
      return left.label.localeCompare(right.label);
    });
    return parsed.map(entry => entry.original);
  }

  private static parseImpressionsBadgeItem(item: string): { original: string; label: string; percent: number | null } {
    const original = item.trim();
    const percentMatch = original.match(/^(.*?)(\d{1,3})%$/);
    if (!percentMatch) {
      return {
        original,
        label: original.toLowerCase(),
        percent: null
      };
    }
    return {
      original,
      label: percentMatch[1].trim().toLowerCase(),
      percent: Math.max(0, Math.min(100, Number.parseInt(percentMatch[2], 10) || 0))
    };
  }

}

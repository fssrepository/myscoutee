import type { ActivityRateDTO } from '../../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../../shared/core/contracts';
import type { ImageCardData } from '../../../../../shared/ui';

export function matchesActivitiesRateFilter(
  item: ActivityRateDTO,
  filter: ContractTypes.RateFilterKey,
  socialBadgeEnabled: boolean
): boolean {
  const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
  if (item.mode !== modeKey || item.direction !== directionKey) {
    return false;
  }
  if (modeKey === 'individual') {
    return socialBadgeEnabled
      ? item.socialContext === 'friends-in-common'
      : item.socialContext !== 'friends-in-common';
  }
  return socialBadgeEnabled
    ? item.socialContext === 'separated-friends'
    : item.socialContext !== 'separated-friends';
}

export function pendingActivitiesRateDirectionAfterRating(
  item: ActivityRateDTO
): ActivityRateDTO['direction'] | null {
  const direction = item.direction;
  if (item.mode === 'individual') {
    if (direction === 'given') {
      return 'given';
    }
    if (direction === 'received') {
      return 'mutual';
    }
    return null;
  }
  if (direction === 'received' || direction === 'met') {
    return 'given';
  }
  return null;
}

export function selectedActivitiesRateRow(
  selectedRateId: string | null,
  filteredRows: readonly ImageCardData[]
): ImageCardData | null {
  if (!selectedRateId) {
    return null;
  }
  return filteredRows.find(row => row.id === selectedRateId) ?? null;
}

export function normalizeActivitiesRateScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function activitiesRateOwnScore(item: ActivityRateDTO): number {
  if (Number.isFinite(item.scoreGiven) && item.scoreGiven > 0) {
    return normalizeActivitiesRateScore(item.scoreGiven);
  }
  return 5;
}

export function activitiesRateHasOwnRating(
  item: ActivityRateDTO
): boolean {
  if (item.direction === 'received') {
    return false;
  }
  return Number.isFinite(item.scoreGiven) && item.scoreGiven > 0;
}

export function activitiesPairReceivedAverageScore(
  item: ActivityRateDTO,
  rateItems: readonly ActivityRateDTO[]
): number {
  const matching = rateItems.filter(candidate =>
    candidate.mode === 'pair'
    && sameActivitiesRatePairUsers(candidate, item)
    && candidate.direction === 'received'
    && Number.isFinite(candidate.scoreReceived)
    && candidate.scoreReceived > 0
  );
  if (matching.length === 0) {
    return 0;
  }
  const total = matching.reduce((sum, candidate) => sum + candidate.scoreReceived, 0);
  return normalizeActivitiesRateScore(total / matching.length);
}

export function isActivitiesPairReceivedRateItem(
  item: ActivityRateDTO
): boolean {
  return item.mode === 'pair' && item.direction === 'received';
}

export function activitiesRateOwnRatingValue(
  item: ActivityRateDTO | null,
  rateItems: readonly ActivityRateDTO[]
): number {
  if (!item) {
    return 0;
  }
  if (!activitiesRateHasOwnRating(item)) {
    if (item.direction === 'received' && item.mode === 'pair') {
      return activitiesPairReceivedAverageScore(item, rateItems);
    }
    return 0;
  }
  return activitiesRateOwnScore(item);
}

function sameActivitiesRatePairUsers(left: ActivityRateDTO, right: ActivityRateDTO): boolean {
  const leftIds = [left.userId, left.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
  const rightIds = [right.userId, right.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

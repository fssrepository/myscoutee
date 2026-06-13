import type { ActivityRateDTO } from '../../../../../shared/core/base/dto';
import type * as AppTypes from '../../../../../shared/core/base/models';
import type * as ContractTypes from '../../../../../shared/core/contracts';

export function matchesActivitiesRateFilter(
  item: ActivityRateDTO,
  filter: ContractTypes.RateFilterKey,
  socialBadgeEnabled: boolean,
  displayedDirection: (candidate: ActivityRateDTO) => ActivityRateDTO['direction']
): boolean {
  const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
  if (item.mode !== modeKey || displayedDirection(item) !== directionKey) {
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

export function displayedActivitiesRateDirection(
  item: ActivityRateDTO,
  overrides: Partial<Record<string, ActivityRateDTO['direction']>>
): ActivityRateDTO['direction'] {
  return overrides[item.id] ?? item.direction;
}

export function pendingActivitiesRateDirectionAfterRating(
  item: ActivityRateDTO,
  displayedDirection: (candidate: ActivityRateDTO) => ActivityRateDTO['direction']
): ActivityRateDTO['direction'] | null {
  const direction = displayedDirection(item);
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

export function parseActivitiesRateFilterKey(
  filter: ContractTypes.RateFilterKey
): { mode: 'individual' | 'pair'; direction: ActivityRateDTO['direction'] } {
  const [mode, direction] = filter.split('-') as ['individual' | 'pair', ActivityRateDTO['direction']];
  return { mode, direction };
}

export function collectPendingActivitiesRateDirectionOverrides(
  targetFilter: ContractTypes.RateFilterKey | undefined,
  pendingOverrides: Partial<Record<string, ActivityRateDTO['direction']>>,
  rateItems: readonly ActivityRateDTO[]
): Array<[string, ActivityRateDTO['direction']]> {
  const target = targetFilter ? parseActivitiesRateFilterKey(targetFilter) : null;
  const nextEntries: Array<[string, ActivityRateDTO['direction']]> = [];
  for (const [itemId, pendingDirection] of Object.entries(pendingOverrides)) {
    if (!pendingDirection) {
      continue;
    }
    if (target) {
      const item = rateItems.find(candidate => candidate.id === itemId);
      if (!item) {
        continue;
      }
      if (item.mode !== target.mode || pendingDirection !== target.direction) {
        continue;
      }
    }
    nextEntries.push([itemId, pendingDirection]);
  }
  return nextEntries;
}

export function selectedActivitiesRateRow(
  selectedRateId: string | null,
  filteredRows: readonly AppTypes.ActivityListRow[]
): AppTypes.ActivityListRow | null {
  if (!selectedRateId) {
    return null;
  }
  return filteredRows.find(row => row.type === 'rates' && row.id === selectedRateId) ?? null;
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
  item: ActivityRateDTO,
  draftedValue: number | undefined,
  displayedDirection: (candidate: ActivityRateDTO) => ActivityRateDTO['direction']
): boolean {
  if (Number.isFinite(draftedValue) && (draftedValue as number) > 0) {
    return true;
  }
  if (displayedDirection(item) === 'received') {
    return false;
  }
  return Number.isFinite(item.scoreGiven) && item.scoreGiven > 0;
}

export function activitiesPairReceivedAverageScore(
  item: ActivityRateDTO,
  rateItems: readonly ActivityRateDTO[],
  displayedDirection: (candidate: ActivityRateDTO) => ActivityRateDTO['direction']
): number {
  const matching = rateItems.filter(candidate =>
    candidate.mode === 'pair'
    && sameActivitiesRatePairUsers(candidate, item)
    && displayedDirection(candidate) === 'received'
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
  item: ActivityRateDTO,
  displayedDirection: (candidate: ActivityRateDTO) => ActivityRateDTO['direction']
): boolean {
  return item.mode === 'pair' && displayedDirection(item) === 'received';
}

export function activitiesRateOwnRatingValue(
  item: ActivityRateDTO | null,
  draftedValuesById: Record<string, number>,
  displayedDirection: (candidate: ActivityRateDTO) => ActivityRateDTO['direction'],
  rateItems: readonly ActivityRateDTO[]
): number {
  if (!item) {
    return 0;
  }
  const drafted = draftedValuesById[item.id];
  if (Number.isFinite(drafted)) {
    return normalizeActivitiesRateScore(Number(drafted));
  }
  if (!activitiesRateHasOwnRating(item, drafted, displayedDirection)) {
    if (displayedDirection(item) === 'received' && item.mode === 'pair') {
      return activitiesPairReceivedAverageScore(item, rateItems, displayedDirection);
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

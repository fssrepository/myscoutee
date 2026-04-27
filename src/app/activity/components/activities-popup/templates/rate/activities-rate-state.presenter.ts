import type { RateMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';

export function matchesActivitiesRateFilter(
  item: RateMenuItem,
  filter: AppTypes.RateFilterKey,
  socialBadgeEnabled: boolean,
  displayedDirection: (candidate: RateMenuItem) => RateMenuItem['direction']
): boolean {
  const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', 'given' | 'received' | 'mutual' | 'met'];
  if (item.mode !== modeKey || displayedDirection(item) !== directionKey) {
    return false;
  }
  if (modeKey !== 'pair') {
    return true;
  }
  if (!socialBadgeEnabled) {
    return item.socialContext === 'separated-friends' || !item.socialContext;
  }
  if (filter === 'pair-given' || filter === 'pair-received') {
    return item.socialContext === 'friends-in-common';
  }
  return true;
}

export function displayedActivitiesRateDirection(
  item: RateMenuItem,
  overrides: Partial<Record<string, RateMenuItem['direction']>>
): RateMenuItem['direction'] {
  return overrides[item.id] ?? item.direction;
}

export function pendingActivitiesRateDirectionAfterRating(
  item: RateMenuItem,
  displayedDirection: (candidate: RateMenuItem) => RateMenuItem['direction']
): RateMenuItem['direction'] | null {
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
  filter: AppTypes.RateFilterKey
): { mode: 'individual' | 'pair'; direction: RateMenuItem['direction'] } {
  const [mode, direction] = filter.split('-') as ['individual' | 'pair', RateMenuItem['direction']];
  return { mode, direction };
}

export function collectPendingActivitiesRateDirectionOverrides(
  targetFilter: AppTypes.RateFilterKey | undefined,
  pendingOverrides: Partial<Record<string, RateMenuItem['direction']>>,
  rateItems: readonly RateMenuItem[]
): Array<[string, RateMenuItem['direction']]> {
  const target = targetFilter ? parseActivitiesRateFilterKey(targetFilter) : null;
  const nextEntries: Array<[string, RateMenuItem['direction']]> = [];
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

export function activitiesRateOwnScore(item: RateMenuItem): number {
  if (Number.isFinite(item.scoreGiven) && item.scoreGiven > 0) {
    return normalizeActivitiesRateScore(item.scoreGiven);
  }
  return 5;
}

export function activitiesRateHasOwnRating(
  item: RateMenuItem,
  draftedValue: number | undefined,
  displayedDirection: (candidate: RateMenuItem) => RateMenuItem['direction']
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
  item: RateMenuItem,
  rateItems: readonly RateMenuItem[],
  displayedDirection: (candidate: RateMenuItem) => RateMenuItem['direction']
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

export function isActivitiesPairReceivedRateRow(
  row: AppTypes.ActivityListRow,
  displayedDirection: (candidate: RateMenuItem) => RateMenuItem['direction']
): boolean {
  if (row.type !== 'rates') {
    return false;
  }
  const rate = row.source as RateMenuItem;
  return rate.mode === 'pair' && displayedDirection(rate) === 'received';
}

export function activitiesRateOwnRatingValue(
  row: AppTypes.ActivityListRow,
  draftedValuesById: Record<string, number>,
  displayedDirection: (candidate: RateMenuItem) => RateMenuItem['direction'],
  rateItems: readonly RateMenuItem[]
): number {
  if (row.type !== 'rates') {
    return 0;
  }
  const item = row.source as RateMenuItem;
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

function sameActivitiesRatePairUsers(left: RateMenuItem, right: RateMenuItem): boolean {
  const leftIds = [left.userId, left.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
  const rightIds = [right.userId, right.secondaryUserId ?? ''].filter(id => id.trim().length > 0).sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

import type { ActivitiesFeedFilters, ListQuery } from '../contracts';
import type { ActivitiesSecondaryFilter, ActivityRateDTO } from '../contracts/activity.interface';

export type ActivityRateSort = 'happenedAt' | 'distance' | 'relevance';

export interface ActivityRateOrder {
  sort: ActivityRateSort;
  secondaryFilter: ActivitiesSecondaryFilter;
}

export function resolveActivityRateOrder(
  query: Pick<ListQuery<ActivitiesFeedFilters>, 'sort' | 'view' | 'filters'>
): ActivityRateOrder {
  const requestedSort = query.sort;
  const sort: ActivityRateSort = query.view === 'distance' || requestedSort === 'distance'
    ? 'distance'
    : requestedSort === 'relevance'
      ? 'relevance'
      : 'happenedAt';
  const requestedSecondaryFilter = query.filters?.secondaryFilter;
  const secondaryFilter: ActivitiesSecondaryFilter = sort === 'relevance'
    ? 'relevant'
    : requestedSecondaryFilter === 'past' || requestedSecondaryFilter === 'relevant'
      ? requestedSecondaryFilter
      : 'recent';

  return { sort, secondaryFilter };
}

export function compareActivityRateItems(
  left: ActivityRateDTO,
  right: ActivityRateDTO,
  order: ActivityRateOrder
): number {
  return compareActivityRateSortKeys(
    activityRateSortKey(left, order),
    activityRateSortKey(right, order)
  );
}

export function activityRateSortKey(
  item: ActivityRateDTO,
  order: ActivityRateOrder
): readonly (number | string)[] {
  const timestamp = activityRateTimestamp(item);
  const relevance = activityRateRelevanceScore(item);
  const identity = item.id;
  const innerKey = order.secondaryFilter === 'past'
    ? [timestamp, -relevance]
    : order.secondaryFilter === 'relevant'
      ? [-relevance, -timestamp]
      : [-timestamp, -relevance];

  if (order.sort === 'distance') {
    const distanceMeters = activityRateDistanceMeters(item);
    return [
      activityRateDistanceBucketMeters(distanceMeters),
      ...innerKey,
      distanceMeters,
      identity
    ];
  }

  const dayStart = activityRateUtcDayStart(timestamp);
  return [
    order.secondaryFilter === 'past' ? dayStart : -dayStart,
    ...innerKey,
    identity
  ];
}

export function activityRateRelevanceScore(item: ActivityRateDTO): number {
  const scoreGiven = normalizeActivityRateScore(item.scoreGiven);
  const scoreReceived = normalizeActivityRateScore(item.scoreReceived);
  if (item.direction === 'mutual') {
    return scoreGiven > 0 && scoreReceived > 0
      ? (2 * scoreGiven * scoreReceived) / (scoreGiven + scoreReceived)
      : 0;
  }
  return scoreGiven > 0 ? scoreGiven : 5;
}

function activityRateTimestamp(item: ActivityRateDTO): number {
  const timestamp = Date.parse(item.happenedAt ?? '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function activityRateUtcDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function activityRateDistanceMeters(item: ActivityRateDTO): number {
  return Number.isFinite(item.distanceMetersExact)
    ? Math.max(0, Math.trunc(Number(item.distanceMetersExact)))
    : 0;
}

function activityRateDistanceBucketMeters(distanceMeters: number): number {
  return Math.max(5_000, Math.ceil(distanceMeters / 5_000) * 5_000);
}

function normalizeActivityRateScore(value: unknown): number {
  return Number.isFinite(Number(value))
    ? Math.max(0, Math.min(10, Math.round(Number(value))))
    : 0;
}

function compareActivityRateSortKeys(
  left: readonly (number | string)[],
  right: readonly (number | string)[]
): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      const delta = leftValue - rightValue;
      if (delta !== 0) {
        return delta;
      }
      continue;
    }
    const delta = String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

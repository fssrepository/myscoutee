import type { ActivitiesFeedFilters, ListQuery } from '../contracts';
import type { ActivityRateDTO } from '../contracts/activity.interface';

import {
  activityRateSortKey,
  compareActivityRateItems,
  resolveActivityRateOrder
} from './activity-rate-order';

describe('activity rate ordering', () => {
  it('maps the Distance view and Relevant control to the combined HTTP order', () => {
    const order = resolveActivityRateOrder(query({
      view: 'distance',
      filters: { secondaryFilter: 'relevant' }
    }));

    expect(order).toEqual({
      sort: 'distance',
      secondaryFilter: 'relevant'
    });
  });

  it('orders distance buckets first and relevance inside each bucket', () => {
    const order = { sort: 'distance', secondaryFilter: 'relevant' } as const;
    const items = [
      rate('near-low', 4, '2026-07-03T10:00:00Z', 2_000),
      rate('far-high', 10, '2026-07-03T12:00:00Z', 6_000),
      rate('near-high', 9, '2026-07-03T09:00:00Z', 4_000)
    ];

    expect(items.sort((left, right) => compareActivityRateItems(left, right, order)).map(item => item.id))
      .toEqual(['near-high', 'near-low', 'far-high']);
  });

  it('uses exact distance before identity after the inner-order values tie', () => {
    const order = { sort: 'distance', secondaryFilter: 'relevant' } as const;
    const closerWithLaterId = rate('z-closer', 8, '2026-07-03T10:00:00Z', 1_000);
    const fartherWithEarlierId = rate('a-farther', 8, '2026-07-03T10:00:00Z', 4_000);

    expect([
      activityRateSortKey(fartherWithEarlierId, order),
      activityRateSortKey(closerWithLaterId, order)
    ].sort(compareKeys)).toEqual([
      activityRateSortKey(closerWithLaterId, order),
      activityRateSortKey(fartherWithEarlierId, order)
    ]);
  });

  it('uses harmonic mutual relevance like the backend', () => {
    const order = { sort: 'relevance', secondaryFilter: 'relevant' } as const;
    const balanced = rate('balanced', 5, '2026-07-03T10:00:00Z', 1_000, 5, 'mutual');
    const imbalanced = rate('imbalanced', 9, '2026-07-03T11:00:00Z', 1_000, 1, 'mutual');

    expect([imbalanced, balanced]
      .sort((left, right) => compareActivityRateItems(left, right, order))
      .map(item => item.id))
      .toEqual(['balanced', 'imbalanced']);
  });
});

function query(
  overrides: Partial<ListQuery<ActivitiesFeedFilters>>
): ListQuery<ActivitiesFeedFilters> {
  return {
    page: 0,
    pageSize: 20,
    ...overrides
  };
}

function rate(
  id: string,
  scoreGiven: number,
  happenedAt: string,
  distanceMetersExact: number,
  scoreReceived = 0,
  direction: ActivityRateDTO['direction'] = 'given'
): ActivityRateDTO {
  return {
    id,
    userId: `user-${id}`,
    mode: 'individual',
    direction,
    scoreGiven,
    scoreReceived,
    eventName: 'Rate',
    happenedAt,
    distanceMetersExact
  };
}

function compareKeys(
  left: readonly (number | string)[],
  right: readonly (number | string)[]
): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    const delta = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

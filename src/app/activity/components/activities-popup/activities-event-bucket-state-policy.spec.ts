import { describe, expect, it } from 'vitest';

import { shouldApplyActivitiesEventBucketLoad } from './activities-event-bucket-state-policy';

describe('activities event bucket state ownership', () => {
  const currentDraftState = {
    currentPrimaryFilter: 'events',
    currentEventScope: 'drafts',
    queryPrimaryFilter: 'events',
    queryEventScope: 'drafts',
    aborted: false,
    currentView: 'day'
  } as const;

  it('accepts the completed load of the currently selected event bucket', () => {
    expect(shouldApplyActivitiesEventBucketLoad(currentDraftState)).toBe(true);
  });

  it('rejects an old My Events load that returns after Drafts is already selected', () => {
    expect(shouldApplyActivitiesEventBucketLoad({
      ...currentDraftState,
      queryEventScope: 'my-events'
    })).toBe(false);
  });

  it('rejects aborted and calendar loads as non-authoritative bucket totals', () => {
    expect(shouldApplyActivitiesEventBucketLoad({
      ...currentDraftState,
      aborted: true
    })).toBe(false);
    expect(shouldApplyActivitiesEventBucketLoad({
      ...currentDraftState,
      currentView: 'week'
    })).toBe(false);
  });
});

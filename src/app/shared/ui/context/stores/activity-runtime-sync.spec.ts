import { describe, expect, it, vi } from 'vitest';

import { ActivityStore } from './activity.store';
import { EventSubeventsPopupStore } from './event-subevents-popup.store';

describe('activity runtime counter signals', () => {
  it('emits signed parent activity deltas with a monotonic revision', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const store = new ActivityStore();

    store.emitActivityEventRuntimeSync({
      eventId: 'event-1',
      subEventId: 'stage-1',
      activityDelta: 2,
      source: 'groups'
    });
    const first = store.activityEventRuntimeSync();

    store.emitActivityEventRuntimeSync({
      eventId: 'event-1',
      subEventId: 'stage-1',
      activityDelta: -1,
      source: 'members'
    });
    const second = store.activityEventRuntimeSync();

    expect(first).toMatchObject({
      eventId: 'event-1',
      subEventId: 'stage-1',
      activityDelta: 2,
      source: 'groups'
    });
    expect(second).toMatchObject({
      eventId: 'event-1',
      subEventId: 'stage-1',
      activityDelta: -1,
      source: 'members'
    });
    expect(second?.updatedMs).toBeGreaterThan(first?.updatedMs ?? 0);
    vi.restoreAllMocks();
  });

  it('propagates the stage pending delta separately from its current value', () => {
    vi.spyOn(Date, 'now').mockReturnValue(200);
    const store = new EventSubeventsPopupStore();

    store.emitEventTournamentGroupsUpdate({
      eventId: 'event-1',
      stageId: 'stage-1',
      groupsCount: 4,
      groupsPending: 3,
      groupsPendingDelta: 1
    });

    expect(store.eventTournamentGroupsUpdate()).toMatchObject({
      eventId: 'event-1',
      stageId: 'stage-1',
      groupsCount: 4,
      groupsPending: 3,
      groupsPendingDelta: 1
    });
    vi.restoreAllMocks();
  });
});

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

  it('keeps member and resource revisions monotonic for same-millisecond writes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(150);
    const store = new ActivityStore();

    store.emitActivityMembersSync({
      id: 'event-1:stage-1:group-1',
      acceptedMembers: 2,
      pendingMembers: 1,
      capacityTotal: 5
    });
    const firstMembersRevision = store.activityMembersSync()?.updatedMs ?? 0;
    store.emitActivityMembersSync({
      id: 'event-1:stage-1:group-1',
      acceptedMembers: 2,
      pendingMembers: 3,
      capacityTotal: 5
    });

    store.emitActivityResourceSync({
      ownerId: 'event-1:stage-1:group-1',
      subEventId: 'stage-1',
      assetOwnerUserId: 'user-1'
    });
    const firstResourceRevision = store.activityResourceSync()?.updatedMs ?? 0;
    store.emitActivityResourceSync({
      ownerId: 'event-1:stage-1:group-1',
      subEventId: 'stage-1',
      assetOwnerUserId: 'user-1'
    });

    expect(store.activityMembersSync()?.updatedMs).toBeGreaterThan(firstMembersRevision);
    expect(store.activityResourceSync()?.updatedMs).toBeGreaterThan(firstResourceRevision);
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

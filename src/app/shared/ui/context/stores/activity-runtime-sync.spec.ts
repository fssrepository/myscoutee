import { describe, expect, it, vi } from 'vitest';

import { ActivityStore } from './activity.store';
import { EventSubeventsPopupStore } from './event-subevents-popup.store';
import {
  SubEventResourcePopupStore,
  type ResourcePopupContext
} from './sub-event-resource-popup.store';

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
      id: 'event-1',
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
    expect(store.activityMembersSyncByOwnerId()['event-1:stage-1:group-1']?.pendingMembers).toBe(1);
    expect(store.activityMembersSyncByOwnerId()['event-1']?.pendingMembers).toBe(3);
    expect(store.activityResourceSync()?.updatedMs).toBeGreaterThan(firstResourceRevision);
    vi.restoreAllMocks();
  });

  it('emits the successful resource-member save delta without recounting members', () => {
    vi.spyOn(Date, 'now').mockReturnValue(175);
    const store = new ActivityStore();

    store.emitActivityResourceMemberDeltaSync({
      ownerId: 'event-1',
      subEventId: 'subevent-1',
      assetId: 'asset-1',
      resourceType: 'Transport',
      pendingMemberDelta: 1
    });
    const first = store.activityResourceMemberDeltaSync();
    store.emitActivityResourceMemberDeltaSync({
      ownerId: 'slot-1',
      subEventId: 'subevent-2',
      assetId: 'asset-2',
      resourceType: 'Accommodation',
      pendingMemberDelta: 2
    });

    expect(first).toMatchObject({
      ownerId: 'event-1',
      subEventId: 'subevent-1',
      assetId: 'asset-1',
      resourceType: 'Transport',
      pendingMemberDelta: 1
    });
    expect(store.activityResourceMemberDeltaSync()).toMatchObject({
      ownerId: 'slot-1',
      subEventId: 'subevent-2',
      assetId: 'asset-2',
      resourceType: 'Accommodation',
      pendingMemberDelta: 2
    });
    expect(store.activityResourceMemberDeltaSync()?.updatedMs).toBeGreaterThan(first?.updatedMs ?? 0);
    vi.restoreAllMocks();
  });

  it('carries a lean member status transition with its signed counter deltas', () => {
    const store = new ActivityStore();

    store.emitActivityMembersSync({
      id: 'asset-1',
      eventId: 'event-1',
      subEventId: 'subevent-1',
      acceptedMembers: 1,
      pendingMembers: 0,
      capacityTotal: 4,
      acceptedMemberDelta: 0,
      pendingMemberDelta: -1,
      memberStatusChange: {
        assetId: 'asset-1',
        eventId: 'event-1',
        subEventId: 'subevent-1',
        userId: 'viewer',
        previousStatus: 'pending',
        status: 'deleted',
        acceptedMemberDelta: 0,
        pendingMemberDelta: -1
      }
    });

    expect(store.activityMembersSyncByOwnerId()['asset-1']).toMatchObject({
      eventId: 'event-1',
      subEventId: 'subevent-1',
      pendingMembers: 0,
      pendingMemberDelta: -1,
      memberStatusChange: {
        previousStatus: 'pending',
        status: 'deleted',
        pendingMemberDelta: -1
      }
    });
  });

  it('caches resource member transitions without broadcasting a member-popup sync', () => {
    const store = new ActivityStore();
    const pendingLeave = {
      assetId: 'asset-1',
      eventId: 'event-1',
      subEventId: 'subevent-1',
      userId: 'viewer',
      previousStatus: 'pending' as const,
      status: 'deleted' as const,
      acceptedMemberDelta: 0,
      pendingMemberDelta: -1
    };

    const first = store.cacheActivityMemberStatusChange(pendingLeave, {
      acceptedMembers: 1,
      pendingMembers: 1,
      capacityTotal: 4
    });
    const duplicate = store.cacheActivityMemberStatusChange(pendingLeave, {
      acceptedMembers: 1,
      pendingMembers: 1,
      capacityTotal: 4
    });
    store.cacheActivityMemberStatusChange({
      ...pendingLeave,
      previousStatus: null,
      status: 'pending',
      pendingMemberDelta: 1
    }, {
      acceptedMembers: 1,
      pendingMembers: 1,
      capacityTotal: 4
    });

    expect(store.activityMembersSync()).toBeNull();
    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();
    expect(store.activityMembersSyncByOwnerId()['asset-1']).toMatchObject({
      acceptedMembers: 1,
      pendingMembers: 1,
      memberStatusChange: {
        previousStatus: null,
        status: 'pending',
        pendingMemberDelta: 1
      }
    });
  });

  it('replaces a stale resource-member transition count with a canonical member snapshot', () => {
    const store = new ActivityStore();

    store.cacheActivityMemberStatusChange({
      assetId: 'asset-1',
      eventId: 'event-1',
      subEventId: 'subevent-1',
      userId: 'joining-user',
      previousStatus: null,
      status: 'pending',
      acceptedMemberDelta: 0,
      pendingMemberDelta: 1
    }, {
      acceptedMembers: 1,
      pendingMembers: 1,
      capacityTotal: 4
    });

    expect(store.activityMembersSyncByOwnerId()['asset-1']?.pendingMembers).toBe(2);

    store.emitActivityMembersSync({
      id: 'asset-1',
      eventId: 'event-1',
      subEventId: 'subevent-1',
      acceptedMembers: 1,
      pendingMembers: 1,
      capacityTotal: 4
    });

    expect(store.activityMembersSyncByOwnerId()['asset-1']).toMatchObject({
      acceptedMembers: 1,
      pendingMembers: 1,
      capacityTotal: 4
    });
    expect(store.activityMembersSyncByOwnerId()['asset-1']?.memberStatusChange).toBeUndefined();
  });

  it('publishes an explicit signed resource activity delta separately from absolute metrics', () => {
    const store = new SubEventResourcePopupStore();
    const context = {
      ownerId: 'event-1',
      subEvent: {
        id: 'subevent-1',
        carsAccepted: 2,
        carsPending: 3,
        carsCapacityMin: 0,
        carsCapacityMax: 8
      }
    } as ResourcePopupContext;

    store.publishSubEventResourceMetrics(context, { activityDelta: 1 });

    expect(store.subEventResourceMetricsUpdate()).toMatchObject({
      ownerId: 'event-1',
      subEventId: 'subevent-1',
      activityDelta: 1,
      subEvent: {
        carsAccepted: 2,
        carsPending: 3,
        carsCapacityMax: 8
      }
    });
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

  it('replaces and discards the full event sub-event definition draft with monotonic revisions', () => {
    vi.spyOn(Date, 'now').mockReturnValue(300);
    const store = new EventSubeventsPopupStore();

    store.emitEventSubeventsDefinitionDraftPreview({
      eventId: 'event-1',
      mode: 'Tournament',
      startAtIso: '2026-09-01T10:00:00Z',
      endAtIso: '2026-09-01T12:00:00Z',
      definitions: [{
        id: 'stage-1',
        name: 'Qualifier',
        description: 'Opening stage',
        timing: 'After',
        offsetMinutes: 0,
        durationMinutes: 60,
        optional: false,
        capacityMin: 2,
        capacityMax: 8
      }]
    });

    expect(store.eventSubeventsDefinitionDraftUpdate()).toMatchObject({
      updatedMs: 300,
      action: 'preview',
      eventId: 'event-1',
      mode: 'Tournament',
      definitions: [{ id: 'stage-1', name: 'Qualifier' }]
    });

    store.emitEventSubeventsDefinitionDraftPreview({
      eventId: 'event-1',
      mode: 'Tournament',
      definitions: []
    });

    expect(store.eventSubeventsDefinitionDraftUpdate()).toMatchObject({
      updatedMs: 301,
      action: 'preview',
      eventId: 'event-1',
      definitions: []
    });

    store.discardEventSubeventsDefinitionDraft('event-1');

    expect(store.eventSubeventsDefinitionDraftUpdate()).toMatchObject({
      updatedMs: 302,
      action: 'discard',
      eventId: 'event-1',
      definitions: []
    });
    vi.restoreAllMocks();
  });

  it('keeps event-save sub-event reload requests durable and monotonic', () => {
    const store = new EventSubeventsPopupStore();

    store.requestEventSubeventsReload('event-1');
    const first = store.eventSubeventsReloadRequest();
    store.requestEventSubeventsReload('event-1');

    expect(first).toEqual({
      revision: 1,
      eventId: 'event-1',
      source: 'event-save'
    });
    expect(store.eventSubeventsReloadRequest()).toEqual({
      revision: 2,
      eventId: 'event-1',
      source: 'event-save'
    });
  });

  it('preserves event member counters for the sub-event header converter', () => {
    const store = new EventSubeventsPopupStore();

    store.openEventSubeventsListPopup({
      eventId: 'event-1',
      acceptedMembers: 7,
      pendingMembers: 2,
      capacityTotal: 20
    });

    expect(store.eventSubeventsListPopup()).toMatchObject({
      eventId: 'event-1',
      acceptedMembers: 7,
      pendingMembers: 2,
      capacityTotal: 20
    });
  });
});

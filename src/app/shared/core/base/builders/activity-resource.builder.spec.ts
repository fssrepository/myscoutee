import { describe, expect, it } from 'vitest';

import type {
  AssetDTO,
  AssetMemberRequestDTO,
  ChatDTO
} from '../../contracts';
import { ActivityResourceBuilder } from './activity-resource.builder';

describe('ActivityResourceBuilder group request scoping', () => {
  it('uses only the date range persisted on the chat channel', () => {
    const chat = {
      contextStartAtIso: '2026-08-30T09:30:00Z',
      contextEndAtIso: '2026-08-30T10:30:00Z'
    } as ChatDTO;

    expect(ActivityResourceBuilder.chatResourceDateRange(chat)).toEqual({
      startAtIso: chat.contextStartAtIso,
      endAtIso: chat.contextEndAtIso
    });
    expect(ActivityResourceBuilder.chatResourceDateRange({} as ChatDTO)).toBeNull();
  });

  it('resolves the base event id from slot and group resource owner ids', () => {
    expect(ActivityResourceBuilder.authorizationEventId('event-1', 'sub-1')).toBe('event-1');
    expect(ActivityResourceBuilder.authorizationEventId(
      'event-1:slot:slot-1:2026-07-23T06:30:00Z',
      'sub-1'
    )).toBe('event-1');
    expect(ActivityResourceBuilder.authorizationEventId(
      'event-1:slot:slot-1:2026-07-23T06:30:00Z:sub-1:group-1',
      'sub-1'
    )).toBe('event-1');
  });

  it('EVENT-RUNTIME-001 keeps a MAIN_EVENT resource physically scoped to its runtime and logically scoped to the Event', () => {
    const scope = ActivityResourceBuilder.runtimeResourceScopeIdentity({
      ownerId: 'event-1',
      subEventId: 'main-event:event-1',
      runtimeKind: 'MAIN_EVENT',
      eventId: 'event-1'
    });

    expect(scope).toEqual({
      isMainEvent: true,
      eventId: 'event-1',
      resourceOwnerId: 'event-1',
      resourceScopeId: 'main-event:event-1',
      memberOwner: { ownerType: 'event', ownerId: 'event-1' },
      chatChannelType: 'mainEvent',
      chatOwnerId: 'event-1'
    });

    expect(ActivityResourceBuilder.runtimeResourceTarget({
      ownerId: 'event-1',
      subEventId: 'main-event:event-1',
      runtimeKind: 'MAIN_EVENT',
      eventId: 'event-1',
      name: 'Childless Event',
      description: 'Canonical runtime',
      location: 'Austin',
      startAt: '2026-09-01T09:00:00Z',
      endAt: '2026-09-01T11:00:00Z'
    })).toMatchObject({
      id: 'main-event:event-1',
      runtimeKind: 'MAIN_EVENT',
      eventId: 'event-1',
      name: 'Childless Event',
      optional: false
    });
  });

  it('keeps an ordinary sub-event on its existing sub-event member and chat identity', () => {
    const scope = ActivityResourceBuilder.runtimeResourceScopeIdentity({
      ownerId: 'event-1',
      subEventId: 'sub-1'
    });

    expect(scope.memberOwner).toEqual({ ownerType: 'subEvent', ownerId: 'event-1:sub-1' });
    expect(scope.chatChannelType).toBe('optionalSubEvent');
    expect(scope.chatOwnerId).toBe('event-1:sub-1');
  });

  it('keeps a generated group resource on its physical scope while using its canonical member owner', () => {
    const scope = ActivityResourceBuilder.runtimeResourceScopeIdentity({
      ownerId: 'event-1:stage-1:stage-1:group:1',
      subEventId: 'stage-1',
      groupId: 'stage-1:group:1',
      memberOwnerId: 'stage-1:group:1',
      memberOwnerType: 'group',
      eventId: 'event-1'
    });

    expect(scope).toMatchObject({
      eventId: 'event-1',
      resourceOwnerId: 'event-1:stage-1:stage-1:group:1',
      resourceScopeId: 'stage-1',
      memberOwner: { ownerType: 'group', ownerId: 'stage-1:group:1' }
    });
  });

  it('counts only requests whose booking owner matches the selected group', () => {
    const groupA = 'event-1:stage-1:stage-1:group:1';
    const groupB = 'event-1:stage-1:stage-1:group:2';
    const card = {
      requests: [
        request('request-a', 'user-a', groupA),
        request('request-b', 'user-b', groupB)
      ]
    } as AssetDTO;

    expect(ActivityResourceBuilder.subEventOccupancyRequestCount(card, 'stage-1', 'pending', groupA)).toBe(1);
    expect(ActivityResourceBuilder.subEventOccupancyRequestCount(card, 'stage-1', 'pending', groupB)).toBe(1);
  });

  it('matches a base-event booking to its ungrouped slot runtime owner', () => {
    const slotOwnerId = 'event-1:slot:slot-1:2026-07-23T06:30:00Z';
    const scopedRequest = request('request-slot', 'user-slot', 'event-1');

    expect(ActivityResourceBuilder.isSubEventScopedAssetRequest(
      scopedRequest,
      'stage-1',
      slotOwnerId
    )).toBe(true);
  });

  it('keeps a scoped backend request with a null id renderable', () => {
    const scopedRequest = {
      ...request('request-a', 'user-a', 'event-1:stage-1:stage-1:group:1'),
      id: null
    } as unknown as AssetMemberRequestDTO;

    expect(ActivityResourceBuilder.isSubEventScopedAssetRequest(
      scopedRequest,
      'stage-1',
      'event-1:stage-1:stage-1:group:1'
    )).toBe(true);
  });

  it('builds the persisted group metric snapshot once during local assignment persistence', () => {
    const ownerId = 'event-1:stage-1:stage-1:group:1';
    const card = {
      id: 'asset-1',
      type: 'Transport',
      capacityTotal: 4,
      requests: [request('request-a', 'user-a', ownerId)]
    } as AssetDTO;
    const metrics = ActivityResourceBuilder.buildPersistedResourceMetrics({
      ownerId,
      subEventId: 'stage-1',
      assetOwnerUserId: 'owner-1',
      assetAssignmentIds: { Transport: ['asset-1'] },
      assetSettingsByType: {
        Transport: {
          'asset-1': {
            capacityMin: 0,
            capacityMax: 4,
            quantity: 1,
            addedByUserId: 'owner-1',
            routeEnabled: false,
            routes: []
          }
        }
      },
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: {},
      resourceMetricsByType: {}
    }, [card]);

    expect(metrics.Transport).toEqual({
      accepted: 0,
      pending: 1,
      capacityMin: 0,
      capacityMax: 4
    });
  });

  it('does not count a supplies assignment itself as pending', () => {
    const ownerId = 'event-1:stage-1:stage-1:group:1';
    const card = {
      id: 'supplies-1',
      type: 'Supplies',
      capacityTotal: 6,
      requests: []
    } as AssetDTO;
    const metrics = ActivityResourceBuilder.buildPersistedResourceMetrics({
      ownerId,
      subEventId: 'stage-1',
      assetOwnerUserId: 'owner-1',
      assetAssignmentIds: { Supplies: ['supplies-1'] },
      assetSettingsByType: {
        Supplies: {
          'supplies-1': {
            capacityMin: 0,
            capacityMax: 6,
            quantity: 1,
            addedByUserId: 'owner-1',
            routeEnabled: false,
            routes: []
          }
        }
      },
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: {},
      resourceMetricsByType: {}
    }, [card]);

    expect(metrics.Supplies).toEqual({
      accepted: 0,
      pending: 0,
      capacityMin: 0,
      capacityMax: 6
    });
  });

  it('persists a participant contribution without copying the shared supplies assignment', () => {
    const metrics = ActivityResourceBuilder.buildPersistedResourceMetrics({
      ownerId: 'event-1',
      subEventId: 'stage-1',
      assetOwnerUserId: 'riley',
      assetAssignmentIds: {},
      assetSettingsByType: {},
      supplyContributionEntriesByAssetId: {
        'supplies-1': [{
          id: 'contribution-riley',
          userId: 'riley',
          quantity: 2,
          addedAtIso: '2026-09-04T04:59:00Z'
        }]
      },
      fallbackAssetCardsByType: {},
      resourceMetricsByType: {}
    }, []);

    expect(metrics.Supplies).toEqual({
      accepted: 2,
      pending: 0,
      capacityMin: 0,
      capacityMax: 0
    });
  });

});

function request(id: string, userId: string, eventId: string): AssetMemberRequestDTO {
  return {
    id,
    userId,
    name: userId,
    initials: 'U',
    gender: 'man',
    status: 'pending',
    note: '',
    requestKind: 'borrow',
    requestedAtIso: '2026-07-22T12:00:00Z',
    booking: {
      eventId,
      subEventId: 'stage-1',
      quantity: 1,
      acceptedPolicyIds: []
    },
    menuActions: []
  };
}

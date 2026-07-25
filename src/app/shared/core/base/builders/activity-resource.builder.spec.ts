import { describe, expect, it } from 'vitest';

import type { AssetDTO, AssetMemberRequestDTO } from '../../contracts';
import { ActivityResourceBuilder } from './activity-resource.builder';

describe('ActivityResourceBuilder group request scoping', () => {
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

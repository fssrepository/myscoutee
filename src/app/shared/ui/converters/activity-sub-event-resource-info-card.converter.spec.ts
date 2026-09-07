import { describe, expect, it } from 'vitest';

import * as AppConstants from '../../core/common/constants';
import type * as AppDTOs from '../../core/contracts';
import { ActivitySubEventResourceInfoCardConverter } from './activity-sub-event-resource-info-card.converter';

describe('ActivitySubEventResourceInfoCardConverter member status changes', () => {
  it('keeps pending demand out of accepted occupancy until approval', () => {
    const pending = ActivitySubEventResourceInfoCardConverter.convert({
      ...resourceCard(),
      accepted: 0,
      pending: 1
    }, options([memberRequest()]));
    const accepted = ActivitySubEventResourceInfoCardConverter.convert({
      ...resourceCard(),
      accepted: 1,
      pending: 0
    }, options([{ ...memberRequest(), status: 'accepted' }]));

    expect(pending.mediaEnd).toMatchObject({ label: '0 / 4', pendingCount: 1 });
    expect(accepted.mediaEnd).toMatchObject({ label: '1 / 4', pendingCount: 0 });
  });

  it('keeps a foreign Group resource card read-only', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert(resourceCard(), {
      ...options([]),
      viewOnly: true
    });

    expect(converted.menuActions).toEqual(['viewAsset']);
  });

  it('keeps Leave off the resource card after a pending status transition', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert(resourceCard(), {
      ...options([]),
      memberSyncByOwnerId: {
        'asset-1': {
          memberStatusChange: statusChange(null, 'pending', 1)
        }
      }
    });

    expect(converted.menuActions).not.toContain('leaveResource');
    expect(converted.menuActions).toContain('paymentSummary');
    expect(converted.menuActions).toContain('askAssetOwner');
    expect(converted.menuActions).not.toContain('askOrganizer');
    expect(converted.menuActions).not.toContain('joinResource');
  });

  it('offers only the resource-level Remove to the sole accepted borrowed-asset manager', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert({
      ...resourceCard(),
      accepted: 1,
      pending: 0
    }, {
      ...options([{ ...memberRequest(), status: 'accepted' }]),
      activeUserId: 'viewer',
      assetSettingsByKey: {
        'subevent-1:Transport': {
          'asset-1': assignmentSettings('viewer')
        }
      }
    });

    expect(converted.menuActions).not.toContain('leaveResource');
    expect(converted.menuActions).toContain('removeAssignment');
  });

  it('keeps the resource-level Remove for the borrowed-asset manager when another member can take over', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert({
      ...resourceCard(),
      accepted: 2,
      pending: 0
    }, {
      ...options([{ ...memberRequest(), status: 'accepted' }]),
      activeUserId: 'viewer',
      assetSettingsByKey: {
        'subevent-1:Transport': {
          'asset-1': assignmentSettings('viewer')
        }
      }
    });

    expect(converted.menuActions).not.toContain('leaveResource');
    expect(converted.menuActions).toContain('removeAssignment');
  });

  it('uses the card assignment manager when the viewer state still contains the previous manager', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert({
      ...resourceCard(),
      assetManagerUserId: 'viewer'
    }, {
      ...options([{ ...memberRequest(), status: 'accepted' }]),
      activeUserId: 'viewer',
      assetSettingsByKey: {
        'subevent-1:Transport': {
          'asset-1': assignmentSettings('previous-manager')
        }
      }
    });

    expect(converted.menuActions).toContain('removeAssignment');
  });

  it('keeps Remove assignment for an owned manually assigned asset', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert(resourceCard(), {
      ...options([]),
      activeUserId: 'viewer',
      context: {
        ...options([]).context,
        fallbackCardsByType: {
          [AppConstants.ASSET_TYPE_TRANSPORT]: [{
            id: 'asset-1',
            type: AppConstants.ASSET_TYPE_TRANSPORT,
            ownerUserId: 'viewer',
            requests: []
          }]
        }
      },
      assetSettingsByKey: {
        'subevent-1:Transport': {
          'asset-1': assignmentSettings('viewer')
        }
      }
    });

    expect(converted.menuActions).toContain('removeAssignment');
    expect(converted.menuActions).not.toContain('leaveResource');
  });

  it('derives the available menus from a deleted status transition over stale source data', () => {
    const staleRequest = memberRequest();
    const converted = ActivitySubEventResourceInfoCardConverter.convert(resourceCard(), {
      ...options([staleRequest]),
      memberSyncByOwnerId: {
        'asset-1': {
          memberStatusChange: statusChange('pending', 'deleted', -1)
        }
      }
    });

    expect(converted.menuActions).toContain('joinResource');
    expect(converted.menuActions).not.toContain('leaveResource');
    expect(converted.menuActions).not.toContain('paymentSummary');
  });

  it('does not apply a status transition from another sub-event', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert(resourceCard(), {
      ...options([memberRequest()]),
      memberSyncByOwnerId: {
        'asset-1': {
          memberStatusChange: {
            ...statusChange('pending', 'deleted', -1),
            subEventId: 'subevent-2'
          }
        }
      }
    });

    expect(converted.menuActions).not.toContain('leaveResource');
    expect(converted.menuActions).not.toContain('joinResource');
  });

  it('treats a released former owner as a fresh user who can join the Group asset', () => {
    const converted = ActivitySubEventResourceInfoCardConverter.convert(resourceCard(), {
      ...options([]),
      activeUserId: 'manager',
      context: {
        ...options([]).context,
        fallbackCardsByType: {
          [AppConstants.ASSET_TYPE_TRANSPORT]: [{
            id: 'asset-1',
            type: AppConstants.ASSET_TYPE_TRANSPORT,
            ownerUserId: 'manager',
            ownerReleasedAtIso: '2026-09-03T09:00:00Z',
            requests: []
          }]
        }
      }
    });

    expect(converted.menuActions).toContain('joinResource');
    expect(converted.menuActions).not.toContain('removeAssignment');
  });
});

function resourceCard(): AppDTOs.SubEventResourceCardDTO {
  return {
    id: 'subevent-asset-1',
    sourceAssetId: 'asset-1',
    type: AppConstants.ASSET_TYPE_TRANSPORT,
    title: 'Airport Shuttle',
    subtitle: 'Car',
    city: 'Seattle',
    details: '',
    imageUrl: '',
    sourceLink: '',
    routes: [],
    capacityTotal: 4,
    accepted: 1,
    pending: 0,
    isMembers: false
  };
}

function options(requests: AppDTOs.AssetMemberRequestDTO[]) {
  return {
    activeUserId: 'viewer',
    context: {
      ownerId: 'event-1',
      subEvent: {
        id: 'subevent-1'
      } as AppDTOs.SubEventDTO,
      fallbackCardsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: [{
          id: 'asset-1',
          type: AppConstants.ASSET_TYPE_TRANSPORT,
          ownerUserId: 'manager',
          requests
        }]
      }
    }
  };
}

function memberRequest(): AppDTOs.AssetMemberRequestDTO {
  return {
    id: 'request-1',
    userId: 'viewer',
    name: 'Viewer',
    initials: 'VW',
    gender: 'man',
    status: 'pending',
    note: '',
    requestKind: 'borrow',
    booking: {
      eventId: 'event-1',
      subEventId: 'subevent-1'
    }
  };
}

function statusChange(
  previousStatus: AppConstants.ActivityMemberStatus | null,
  status: AppConstants.ActivityMemberStatus,
  pendingMemberDelta: number
): AppDTOs.AssetMemberStatusChangeDTO {
  return {
    assetId: 'asset-1',
    eventId: 'event-1',
    subEventId: 'subevent-1',
    userId: 'viewer',
    previousStatus,
    status,
    acceptedMemberDelta: 0,
    pendingMemberDelta
  };
}

function assignmentSettings(addedByUserId: string): AppDTOs.SubEventAssignedAssetSettingsDTO {
  return {
    capacityMin: 0,
    capacityMax: 4,
    quantity: 1,
    addedByUserId,
    routeEnabled: false,
    routes: []
  };
}

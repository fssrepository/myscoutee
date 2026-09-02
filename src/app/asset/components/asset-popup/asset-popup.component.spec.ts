import { ChangeDetectorRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import {
  ActivityResourcesService,
  AssetTicketsService,
  AssetsService,
  ExplanationGuideService,
  I18nService,
  ShareTokensService
} from '../../../shared/core';
import * as AppConstants from '../../../shared/core/common/constants';
import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import {
  AppMenuDispatcher
} from '../../../shared/ui';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import { AssetAvailabilityPopupStore } from '../../../shared/ui/context/stores/asset-availability-popup.store';
import { AssetPopupStore } from '../../../shared/ui/context/stores/asset-popup.store';
import { AssetStore } from '../../../shared/ui/context/stores/asset.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { SubEventResourcePopupStore } from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AssetPopupComponent } from './asset-popup.component';

describe('AssetPopupComponent ticket cache reactivity', () => {
  const activeUserId = signal('owner-1');
  const activeUserProfile = signal<UserDto | null>(null);
  const dbRevision = signal(0);
  const peekTicketCountByUser = vi.fn(() => {
    dbRevision();
    return 1;
  });
  const signalUserTicketBucketCount = vi.fn();
  const syncTickets = vi.fn();

  beforeEach(() => {
    activeUserId.set('owner-1');
    activeUserProfile.set(null);
    dbRevision.set(0);
    peekTicketCountByUser.mockClear();
    signalUserTicketBucketCount.mockClear();
    syncTickets.mockReset().mockResolvedValue({ upserts: [], removedIds: [], total: 0 });
    TestBed.configureTestingModule({
      providers: [
        AssetAvailabilityPopupStore,
        AssetPopupStore,
        AssetStore,
        SubEventResourcePopupStore,
        {
          provide: UserProfileStore,
          useValue: {
            activeUserId: activeUserId.asReadonly(),
            activeUserProfile: () => activeUserProfile(),
            getActiveUserId: () => activeUserId()
          }
        },
        {
          provide: AppRuntimeStore,
          useValue: { isOnline: () => true }
        },
        {
          provide: ActivityStore,
          useValue: {
            getUserCounterOverrides: () => ({}),
            signalUserTicketBucketCount
          }
        },
        {
          provide: AssetsService,
          useValue: {
            peekOwnedAssetsByUser: () => [],
            queryOwnedAssetsByUser: async () => []
          }
        },
        {
          provide: AssetTicketsService,
          useValue: {
            peekTicketCountByUser,
            queryTicketPage: async () => ({ items: [], total: 0 }),
            syncTickets
          }
        },
        {
          provide: ShareTokensService,
          useValue: {}
        },
        {
          provide: DialogStore,
          useValue: {}
        },
        {
          provide: AppMenuDispatcher,
          useValue: {
            activeMenu: () => null,
            close: vi.fn()
          }
        },
        {
          provide: I18nService,
          useValue: {
            revision: () => 0,
            translate: (value: string | null | undefined) => value ?? ''
          }
        },
        {
          provide: ActivityResourcesService,
          useValue: {}
        },
        {
          provide: ExplanationGuideService,
          useValue: {
            registerContext: () => vi.fn()
          }
        },
        {
          provide: ChangeDetectorRef,
          useValue: { markForCheck: vi.fn() }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not reset a scanner result when the local ticket cache changes', () => {
    const assetStore = TestBed.inject(AssetStore);
    const popupStore = TestBed.inject(AssetPopupStore);
    assetStore.activeOwnerUserIdRef.set(activeUserId());
    TestBed.runInInjectionContext(() => new AssetPopupComponent());
    TestBed.tick();

    assetStore.openAssetPopup(AppConstants.ASSET_FILTER_TICKET);
    TestBed.tick();
    expect(peekTicketCountByUser).toHaveBeenCalledOnce();

    popupStore.openTicketScanner();
    popupStore.applyTicketScannerValid(scanPayload());
    dbRevision.update(value => value + 1);
    TestBed.tick();

    expect(peekTicketCountByUser).toHaveBeenCalledOnce();
    expect(popupStore.ticketScanMode()).toBe('ticketScanner');
    expect(popupStore.ticketScannerState()).toBe('valid');
    expect(popupStore.ticketScannerResult()?.holderUserId).toBe('holder-1');
  });

  it('uses the shared activity signal for the completed 30-second Ticket poll result', () => {
    const popupStore = TestBed.inject(AssetPopupStore);
    const component = TestBed.runInInjectionContext(() => new AssetPopupComponent());

    expect((component as any).ticketSmartListConfig.pollIntervalMs).toBe(30_000);

    (component as any).onTicketSmartListStateChange({
      items: [],
      total: 2,
      initialLoading: false,
      loading: false,
      query: {
        filters: {
          userId: 'owner-1',
          order: 'upcoming'
        }
      }
    });

    expect(popupStore.ticketTotalCountRef()).toBe(2);
    expect(signalUserTicketBucketCount).toHaveBeenCalledWith(
      'owner-1',
      2,
      expect.any(Object)
    );
  });

  it('uses the existing SmartList delta contract for Ticket polling without changing SmartList core paging', async () => {
    const row = ticketRow();
    syncTickets.mockResolvedValue({
      upserts: [row],
      removedIds: ['events:removed-event'],
      total: 1
    });
    const component = TestBed.runInInjectionContext(() => new AssetPopupComponent());
    const config = (component as any).ticketSmartListConfig;

    const result = await firstValueFrom(config.pollDelta.load({
      page: 0,
      pageSize: 6,
      filters: { userId: 'owner-1', order: 'upcoming' }
    }, {
      knownItems: [
        { id: 'events:removed-event', revision: 'old-revision' },
        { id: 'events:event-1', revision: 'same-revision' }
      ],
      loadedTail: {
        id: 'events:event-1',
        position: '2030-04-18T19:00:00.000Z'
      }
    }));

    expect(syncTickets).toHaveBeenCalledWith({
      userId: 'owner-1',
      order: 'upcoming',
      limit: 6,
      knownItems: [
        { id: 'events:removed-event', revision: 'old-revision' },
        { id: 'events:event-1', revision: 'same-revision' }
      ],
      loadedTail: {
        id: 'events:event-1',
        dateIso: '2030-04-18T19:00:00.000Z'
      }
    }, undefined);
    expect(result).toEqual({
      upserts: [row],
      removedIds: ['events:removed-event'],
      total: 1
    });
    expect(config.cacheable.identity(row, 0, {})).toBe('events:event-1');
  });

  it('publishes the saved main-event assignment metrics before closing the basket', () => {
    const user = {
      id: 'owner-1',
      name: 'Owner One',
      initials: 'OO',
      gender: 'man'
    } as UserDto;
    activeUserProfile.set(user);

    const assetStore = TestBed.inject(AssetStore);
    const resourceStore = TestBed.inject(SubEventResourcePopupStore);
    assetStore.setActiveOwnerUserId(user.id);
    assetStore.applyAssetCards([{
      id: 'transport-1',
      type: AppConstants.ASSET_TYPE_TRANSPORT,
      title: 'Main Event Transport',
      subtitle: '',
      city: 'Austin',
      capacityTotal: 4,
      quantity: 1,
      description: '',
      imageUrl: '',
      ownerUserId: user.id,
      requests: []
    }], { reloadList: false });
    resourceStore.popupContextRef.set({
      origin: 'subEventResource',
      ownerId: 'event-1',
      assetOwnerUserId: user.id,
      parentTitle: 'Main Event',
      subEvent: {
        id: 'main-event:event-1',
        name: 'Main Event',
        runtimeKind: 'MAIN_EVENT',
        carsAccepted: 0,
        carsPending: 0,
        carsCapacityMin: 0,
        carsCapacityMax: 0
      },
      fallbackCardsByType: {}
    } as any);

    const component = TestBed.runInInjectionContext(() => new AssetPopupComponent());
    const savedState = {
      ownerId: 'event-1',
      subEventId: 'main-event:event-1',
      assetOwnerUserId: user.id,
      assetAssignmentIds: { Transport: ['transport-1'] },
      assetSettingsByType: {
        Transport: {
          'transport-1': {
            capacityMin: 0,
            capacityMax: 4,
            quantity: 1,
            addedByUserId: user.id,
            routeEnabled: false,
            routes: []
          }
        }
      },
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: {},
      resourceMetricsByType: {
        Transport: {
          accepted: 1,
          pending: 1,
          capacityMin: 0,
          capacityMax: 4
        }
      }
    };
    (component as any).applyPersistedPopupState(savedState);
    (component as any).syncPopupSubEventMetrics(false, savedState);

    expect(resourceStore.subEventResourceMetricsUpdate()).toMatchObject({
      ownerId: 'event-1',
      subEventId: 'main-event:event-1',
      subEvent: {
        runtimeKind: 'MAIN_EVENT',
        carsAccepted: 1,
        carsPending: 1,
        carsCapacityMin: 0,
        carsCapacityMax: 4
      }
    });
  });
});

function ticketRow(): AssetContracts.AssetTicketDTO {
  return {
    id: 'event-1',
    revision: 'new-revision',
    scanCode: 'TKT-code',
    holderUserId: 'owner-1',
    usedAtIso: null,
    type: 'events',
    status: 'A',
    title: 'Evening event',
    subtitle: 'Main hall',
    detail: 'Tonight',
    dateIso: '2030-04-18T19:00:00.000Z'
  };
}

function scanPayload(): AssetContracts.TicketScanPayloadDTO {
  return {
    code: 'TKT-code',
    holderUserId: 'holder-1',
    holderName: 'Ticket Holder',
    holderAge: 30,
    holderCity: 'Budapest',
    holderRole: 'Member',
    eventId: 'event-1',
    eventTitle: 'Evening event',
    eventSubtitle: 'Main hall',
    eventTimeframe: 'Tonight',
    eventDateLabel: 'Tonight',
    issuedAtIso: '2030-04-18T19:00:00.000Z',
    usedAtIso: '2030-04-18T18:45:00.000Z'
  };
}

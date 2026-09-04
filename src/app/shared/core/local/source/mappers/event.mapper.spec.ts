import { describe, expect, it } from 'vitest';

import {
  ActivityEventDetailDTO,
  type ActivityEventRecord,
  type ActivitySubEventResourceStateDTO
} from '../../../contracts/activity.interface';
import { LocalActivityEventDetailsMapper, LocalActivityEventsMapper } from './event.mapper';

describe('LocalActivityEventDetailsMapper empty child definitions', () => {
  it('canonicalizes enabled empty Slots and Sub Events to the root Event shape', () => {
    const payload = new ActivityEventDetailDTO().apply({
      id: 'event-1',
      userId: 'user-1',
      creatorUserId: 'user-1',
      title: 'Runtime Event',
      startAtIso: '2099-03-10T12:00:00Z',
      endAtIso: '2099-03-10T15:00:00Z',
      frequency: 'Custom',
      slotsEnabled: true,
      slotTemplates: [],
      subEventsEnabled: true,
      subEventDefinitions: []
    });

    const record = LocalActivityEventDetailsMapper.toRecord(payload);

    expect(record.slotsEnabled).toBe(false);
    expect(record.slotTemplates).toEqual([]);
    expect(record.frequency).toBe('One-time');
    expect(record.subEventsEnabled).toBe(false);
    expect(record.subEventDefinitions).toEqual([]);
  });
});

describe('LocalActivityEventsMapper slot-scoped main Event runtime', () => {
  it('maps every Slot without Sub Event definitions to one MAIN_EVENT item', () => {
    const parent = {
      id: 'event-1',
      title: 'Runtime Event',
      subtitle: 'Slot-scoped main runtimes',
      location: 'Austin',
      creatorUserId: 'user-1',
      startAtIso: '2099-03-10T12:00:00Z',
      endAtIso: '2099-03-10T15:00:00Z',
      frequency: 'Custom',
      slotsEnabled: true,
      slotTemplates: [
        { id: 'slot-1', startAt: '2099-03-10T12:00:00Z', subEventDefinitions: [] },
        { id: 'slot-2', startAt: '2099-03-10T13:00:00Z', subEventDefinitions: [] }
      ],
      subEventsEnabled: false,
      subEventDefinitions: [],
      capacityMin: 1,
      capacityMax: 8,
      acceptedMembers: 1,
      pendingMembers: 0
    } as ActivityEventRecord;

    const slots = LocalActivityEventsMapper.toSubEventsSlots('event-1', parent, {
      userId: 'user-1',
      eventId: 'event-1',
      order: 'upcoming',
      view: 'day',
      anchorDate: '2099-03-10',
      rangeStart: '2099-03-10',
      rangeEnd: '2099-03-10'
    });

    expect(slots).toHaveLength(2);
    expect(slots.map(slot => slot.slotTemplateId)).toEqual(['slot-1', 'slot-2']);
    for (const slot of slots) {
      expect(slot.subEventItems).toHaveLength(1);
      expect(slot.subEventItems[0]).toMatchObject({
        id: `main-event:${slot.slotSourceId}`,
        runtimeKind: 'MAIN_EVENT',
        eventId: 'event-1',
        name: 'Runtime Event',
        capacityMax: 8
      });
    }
  });
});

describe('LocalActivityEventsMapper common resource metrics', () => {
  it('keeps the stored common counters for a viewer with an empty own assignment state', () => {
    const slots = [{
      id: 'event-1:default',
      parentEventId: 'event-1',
      slotSourceId: null,
      subEventItems: [{
        id: 'sub-1',
        carsAccepted: 1,
        carsPending: 0,
        carsCapacityMin: 0,
        carsCapacityMax: 4,
        accommodationAccepted: 1,
        accommodationPending: 0,
        accommodationCapacityMin: 0,
        accommodationCapacityMax: 3,
        suppliesAccepted: 3,
        suppliesPending: 0,
        suppliesCapacityMin: 0,
        suppliesCapacityMax: 6
      }]
    }] as Parameters<typeof LocalActivityEventsMapper.withSubEventResourceRecords>[0];
    const rileyState: ActivitySubEventResourceStateDTO = {
      ownerId: 'event-1',
      subEventId: 'sub-1',
      assetOwnerUserId: 'riley',
      assetAssignmentIds: {},
      assetSettingsByType: {},
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: {},
      resourceMetricsByType: {}
    };
    const key = LocalActivityEventsMapper.subEventResourceRecordKey(rileyState);

    const result = LocalActivityEventsMapper.withSubEventResourceRecords(
      slots,
      new Map([[key, rileyState]]),
      'riley'
    );

    expect(result[0]?.subEventItems[0]).toMatchObject({
      carsAccepted: 1,
      carsCapacityMax: 4,
      accommodationAccepted: 1,
      accommodationCapacityMax: 3,
      suppliesAccepted: 3,
      suppliesCapacityMax: 6
    });
  });
});

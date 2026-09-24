import { describe, expect, it } from 'vitest';

import {
  ActivityEventDetailDTO,
  type ActivitySubEventResourceStateDTO,
  type SubEventsSlotDTO
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
  it('keeps a saved childless Event as MAIN_EVENT after serialization and replaces it with real children', () => {
    const saved = LocalActivityEventDetailsMapper.toRecord(new ActivityEventDetailDTO().apply({
      id: 'root', userId: 'owner', creatorUserId: 'owner', title: 'Saved Event',
      startAtIso: '2099-03-10T12:00:00Z', endAtIso: '2099-03-10T15:00:00Z',
      subEventsEnabled: false, subEventDefinitions: [], slotsEnabled: false,
      capacityMax: 8, acceptedMembers: 2
    }));
    const reloaded = JSON.parse(JSON.stringify(saved));
    const slots = LocalActivityEventsMapper.toSubEventsSlots('root', reloaded, {
      userId: 'owner', eventId: 'root', order: 'upcoming', rangeStart: '2099-03-01', rangeEnd: '2099-03-01'
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ id: 'main-event:root', parentEventId: 'root', slotSourceId: null });
    expect(slots[0].subEventItems).toHaveLength(1);
    expect(slots[0].subEventItems[0]).toMatchObject({
      id: 'main-event:root', eventId: 'root', runtimeKind: 'MAIN_EVENT', name: 'Saved Event',
      capacityMax: 8, membersAccepted: 2
    });
    for (const status of ['D', 'T', 'I']) {
      expect(LocalActivityEventsMapper.toSubEventsSlots('root', { ...reloaded, status })).toEqual([]);
    }
    reloaded.subEventsEnabled = true;
    reloaded.subEventDefinitions = [{ id: 'child', name: 'Programme', startOffsetMinutes: 0, durationMinutes: 60 }];
    const changed = LocalActivityEventsMapper.toSubEventsSlots('root', reloaded);
    expect(changed[0].subEventItems.map(item => item.id)).toEqual(['child']);
    expect(changed[0].subEventItems.some(item => item.runtimeKind === 'MAIN_EVENT')).toBe(false);
  });

  it('maps every Slot without Sub Event definitions to one MAIN_EVENT item', () => {
    const parent = LocalActivityEventDetailsMapper.toRecord(new ActivityEventDetailDTO().apply({
      id: 'event-1',
      userId: 'user-1',
      type: 'hosting',
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
    }));

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
    const slots: readonly SubEventsSlotDTO[] = [{
      id: 'event-1:default',
      parentEventId: 'event-1',
      slotSourceId: null,
      subEventItems: [{
        id: 'sub-1',
        name: 'Sub Event',
        description: '',
        startAt: '2099-03-10T12:00:00Z',
        endAt: '2099-03-10T13:00:00Z',
        optional: false,
        capacityMin: 0,
        capacityMax: 8,
        membersAccepted: 0,
        membersPending: 0,
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
    }];
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


describe('activity event external link', () => {
  it('keeps the link in the list DTO so the card menu needs no detail request', () => {
    const record = LocalActivityEventDetailsMapper.toRecord(new ActivityEventDetailDTO().apply({
      id: 'external-event', userId: 'viewer', creatorUserId: 'organizer',
      sourceLink: 'https://example.com/event'
    }));
    expect(LocalActivityEventsMapper.toDto(record).sourceLink).toBe('https://example.com/event');
  });
});

describe('Event gallery persistence', () => {
  it('round-trips five ordered images and uses the first as the card cover', () => {
    const images = ['a', 'b', 'c', 'd', 'e'];
    const dto = new ActivityEventDetailDTO().apply({ id: 'gallery', userId: 'owner', creatorUserId: 'owner', imageUrls: images });
    const record = LocalActivityEventDetailsMapper.toRecord(dto.toPersistencePayload());
    const restored = LocalActivityEventDetailsMapper.toDto(record);
    expect(restored.imageUrls).toEqual(images);
    expect(LocalActivityEventsMapper.toDto(record).imageUrl).toBe('a');
    restored.apply({ imageUrls: ['b', 'c'] });
    expect(restored.toPersistencePayload().imageUrl).toBe('b');
    restored.apply({ imageUrls: [] });
    const cleared = LocalActivityEventDetailsMapper.toDto(LocalActivityEventDetailsMapper.toRecord(restored.toPersistencePayload()));
    expect(cleared.imageUrls).toEqual([]);
    expect(cleared.imageUrl).toBe('');
  });
  it('accepts legacy single images but rejects a sixth event image', () => {
    expect(new ActivityEventDetailDTO().apply({ imageUrl: 'old' }).imageUrls).toEqual(['old']);
    expect(() => new ActivityEventDetailDTO().apply({ imageUrls: ['1','2','3','4','5','6'] })).toThrow();
  });
});

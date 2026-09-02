import { describe, expect, it } from 'vitest';

import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { LocalActivityEventsMapper } from './event.mapper';

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

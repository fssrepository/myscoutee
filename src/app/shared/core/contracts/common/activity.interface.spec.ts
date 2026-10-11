import { describe, expect, it } from 'vitest';

import { ActivityEventDetailDTO } from './activity.interface';

describe('ActivityEventDetailDTO Mingle configuration', () => {
  it('keeps a new Mingle event unconfigured until configuration is provided', () => {
    const event = new ActivityEventDetailDTO().apply({ mode: 'Mingle' });

    expect(event.mingleConfiguration).toBeNull();
  });
});

describe('event slot metadata at the shared schedule boundary', () => {
  it('retains and normalizes subevent definitions on a closed date override', () => {
    const definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions([{
      id: 'sub-1', name: ' Briefing ', description: '', timing: 'Before', offsetMinutes: 10,
      durationMinutes: 15, location: '', optional: false, capacityMin: 1, capacityMax: 5,
      pricing: null
    }]);
    const [slot] = ActivityEventDetailDTO.normalizeSlotTemplates([{
      id: ' slot-1 ', startAt: '2026-10-12T10:00', overrideDate: '2026-10-13',
      closed: true, subEventDefinitions: definitions
    }]);
    expect(slot).toEqual({id: 'slot-1', startAt: '', overrideDate: '2026-10-13',
      closed: true, subEventDefinitions: definitions});
    expect(slot.subEventDefinitions?.[0].name).toBe('Briefing');
  });
});

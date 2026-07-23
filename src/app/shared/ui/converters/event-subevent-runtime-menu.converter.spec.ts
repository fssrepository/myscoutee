import { describe, expect, it } from 'vitest';

import type { SubEventDTO } from '../../core/contracts/event.interface';
import { EventSubeventRuntimeMenuConverter } from './event-subevent-runtime-menu.converter';

describe('EventSubeventRuntimeMenuConverter casual members', () => {
  it('shows member management and its pending badge only for optional subevents', () => {
    const optional = subEvent({ optional: true, membersPending: 2 });
    const mandatory = subEvent({ optional: false, membersPending: 2 });

    expect(EventSubeventRuntimeMenuConverter.convert(optional).map(item => item.id)).toContain('members');
    expect(EventSubeventRuntimeMenuConverter.pendingBadgeCount(optional)).toBe(5);

    expect(EventSubeventRuntimeMenuConverter.convert(mandatory).map(item => item.id)).not.toContain('members');
    expect(EventSubeventRuntimeMenuConverter.pendingBadgeCount(mandatory)).toBe(3);
  });
});

function subEvent(overrides: Partial<SubEventDTO>): SubEventDTO {
  return {
    id: 'subevent-1',
    name: 'Kickoff',
    description: '',
    startAt: '2026-07-23T13:30:00Z',
    endAt: '2026-07-23T14:15:00Z',
    location: 'Seattle',
    optional: true,
    capacityMin: 6,
    capacityMax: 12,
    membersAccepted: 1,
    membersPending: 0,
    carsPending: 1,
    accommodationPending: 1,
    suppliesPending: 1,
    ...overrides
  } as SubEventDTO;
}

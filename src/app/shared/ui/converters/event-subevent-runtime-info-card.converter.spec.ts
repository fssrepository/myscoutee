import { describe, expect, it } from 'vitest';

import type { SubEventDTO } from '../../core/contracts/event.interface';
import { EventSubeventRuntimeInfoCardConverter } from './event-subevent-runtime-info-card.converter';

describe('EventSubeventRuntimeInfoCardConverter pending activity', () => {
  it('maps the aggregated runtime menu count onto the three-dot badge', () => {
    const card = EventSubeventRuntimeInfoCardConverter.convert({
      id: 'subevent-1',
      name: 'Main Session',
      description: '',
      startAt: '2027-03-01T09:45:00Z',
      endAt: '2027-03-01T10:30:00Z',
      optional: true,
      capacityMin: 0,
      capacityMax: 7,
      membersAccepted: 1,
      membersPending: 2,
      carsPending: 1,
      accommodationPending: 0,
      suppliesPending: 0
    } as SubEventDTO, {
      mode: 'Casual',
      hasMenuOptions: true
    });

    expect(card.menuBadgeCount).toBe(3);
  });

  it('maps pending changes inside tournament groups onto the three-dot badge', () => {
    const card = EventSubeventRuntimeInfoCardConverter.convert({
      id: 'stage-1',
      name: 'Qualifiers',
      description: '',
      startAt: '2027-03-05T12:00:00Z',
      endAt: '2027-03-05T13:20:00Z',
      groupsCount: 4,
      groupsPending: 3,
      membersPending: 45
    } as SubEventDTO, {
      mode: 'Tournament',
      hasMenuOptions: true
    });

    expect(card.menuBadgeCount).toBe(3);
  });

  it('shows the compact tournament group and per-group capacity summary', () => {
    const card = EventSubeventRuntimeInfoCardConverter.convert({
      id: 'stage-qualifiers',
      name: 'Qualifiers',
      description: '',
      startAt: '2027-03-05T12:00:00Z',
      endAt: '2027-03-05T13:20:00Z',
      groupsCount: 2,
      tournamentGroupCapacityMin: 1,
      tournamentGroupCapacityMax: 2
    } as SubEventDTO, {
      mode: 'Tournament'
    });

    expect(card.metaRows).toContain('Groups: 2 × 1–2 members');
  });
});

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

  it('presents a persisted MAIN_EVENT runtime as the Event with canonical capacity', () => {
    const card = EventSubeventRuntimeInfoCardConverter.convert({
      id: 'main-event:event-1',
      runtimeKind: 'MAIN_EVENT',
      eventId: 'event-1',
      name: 'Childless Event',
      description: 'One canonical runtime',
      startAt: '2027-03-10T10:00:00Z',
      endAt: '2027-03-10T12:00:00Z',
      optional: false,
      capacityMin: 1,
      capacityMax: 9,
      membersAccepted: 2,
      membersPending: 0
    } as SubEventDTO, {
      mode: 'Casual'
    });

    expect(card.mediaTitle).toBe('Event');
    expect(card.mediaIcon).toBe('event');
    expect(card.mediaEnd).toMatchObject({ label: 'Event', icon: 'event' });
    expect(card.metaRows).toContain('Capacity 2 / 9');
  });

  it('uses the Mingle pink accent for runtime round cards', () => {
    const card = EventSubeventRuntimeInfoCardConverter.convert({
      id: 'mingle-round-1',
      name: 'Round 1',
      description: 'Table rotation',
      startAt: '2027-03-10T18:00:00Z',
      endAt: '2027-03-10T18:20:00Z'
    } as SubEventDTO, {
      mode: 'Mingle',
      sequenceNumber: 1,
      sequenceTotal: 4
    });

    expect(card.surfaceTone).toBe('subevent-strong');
    expect(card.accentHue).toBe(340);
    expect(card.leadingIcon?.tone).toBe('public');
    expect(card.mediaTone).toBe('default');
    expect(card.mediaStart).toBeNull();
  });
});

describe('Speed meeting round status', () => {
  const event = { id: 'meeting', mode: 'Mingle' as const };
  const item = { id: 'mingle-round-2', name: 'Round 2' } as SubEventDTO;
  const state = { eventId: 'meeting', status: 'ROUND', roundNumber: 2 };

  it.each([
    ['ROUND', 'stage-active'], ['PAUSED', 'stage-suspended'],
    ['BREAK', 'stage-finalized'], ['COMPLETED', 'stage-finalized']
  ])('shows the current round %s with the shared contextual badge', (status, tone) => {
    const card = EventSubeventRuntimeInfoCardConverter.convert(item, {
      event, sequenceNumber: 2, mingleState: { ...state, status }
    });
    expect(card.mediaEnd).toMatchObject({ variant: 'badge', interactive: false, tone });
  });

  it('keeps completed, current and future rounds distinct', () => {
    const tones = [1, 2, 3].map(sequenceNumber =>
      EventSubeventRuntimeInfoCardConverter.convert(item, { event, sequenceNumber, mingleState: state }).mediaEnd?.tone);
    expect(tones).toEqual(['stage-finalized', 'stage-active', 'stage-scheduled']);
  });

  it('ignores a different event live state', () => {
    expect(EventSubeventRuntimeInfoCardConverter.convert(item, {
      event, sequenceNumber: 2, mingleState: { ...state, eventId: 'other' }
    }).mediaEnd?.tone).toBe('stage-scheduled');
  });

  it('shows the session break on a main-event card, independently of its list position', () => {
    expect(EventSubeventRuntimeInfoCardConverter.convert({ ...item, runtimeKind: 'MAIN_EVENT' }, {
      event, mingleState: { ...state, status: 'BREAK' }
    }).mediaEnd).toMatchObject({ label: 'mingle.status.break', tone: 'stage-suspended' });
  });
});

import { describe, expect, it } from 'vitest';
import { EventSubeventsSlotConverter } from './event-subevents-slot.converter';
import { EventSubeventRuntimeInfoCardConverter } from './event-subevent-runtime-info-card.converter';
import type { SubEventsSlotDTO } from '../../../core/contracts/common/activity.interface';

describe('Subevents slot current-stage presentation', () => {
  it.each([
    ['A', 'stage-active'], ['RS', 'stage-scheduled'], ['S', 'stage-suspended'],
    ['SR', 'stage-review'], ['F', 'stage-finalized']
  ])('uses the slot current stage and the same %s status tone as its daily card', (status, tone) => {
    const current = {id: 'finals', name: 'Finals', stageStatus: status, startAt: status === 'RS' ? '2099-01-01T10:00:00Z' : '2020-01-01T10:00:00Z',
      endAt: '2099-01-01T12:00:00Z', tournamentLeaderboardType: 'Score', optional: false};
    const slot = {id: 'slot', parentEventId: 'event', currentStage: {
      id: 'finals', name: 'Finals', stageNumber: 2, totalStages: 2, status
    }, subEventItems: [{...current, id: 'qualifiers', name: 'Qualifiers', stageStatus: 'F'}, current]} as SubEventsSlotDTO;
    const model = EventSubeventsSlotConverter.convert(slot, 0);
    expect(model.title).toBe('Finals · 2/2');
    expect(EventSubeventsSlotConverter.headerLabel(model)).toContain('Finals · 2/2');
    const color = EventSubeventsSlotConverter.calendarColorKey(model, {mode: 'Tournament'});
    expect(color).toBe(tone);
    expect(EventSubeventsSlotConverter.calendarColors[color].badgeTone)
      .toBe(EventSubeventRuntimeInfoCardConverter.convert(slot.subEventItems[1], {mode: 'Tournament'}).mediaEnd?.tone);
  });
});

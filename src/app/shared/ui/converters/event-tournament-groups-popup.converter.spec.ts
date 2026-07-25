import { describe, expect, it } from 'vitest';

import type { EventTournamentGroupsStateDTO } from '../../core/contracts/event.interface';
import { EventTournamentGroupsPopupConverter } from './event-tournament-groups-popup.converter';

describe('EventTournamentGroupsPopupConverter metrics', () => {
  it('aggregates group pending changes into stage, accordion trigger, and menu counters', () => {
    const model = EventTournamentGroupsPopupConverter.convert({
      state: tournamentState(),
      selectedStageId: 'stage-1',
      openGroupIds: []
    });
    const group = model.accordion.items[0];
    const actionNodes = group?.actionMenu?.model?.nodes ?? [];
    const menuItems = actionNodes.flatMap(node => node.items ?? []);

    expect(model.stageTrigger.counter).toEqual({
      value: 4,
      max: 99,
      ariaLabel: '4 pending changes'
    });
    expect(model.stageItems[0]?.counter).toEqual({
      value: 4,
      max: 99,
      ariaLabel: '4 pending changes'
    });
    expect(model.stageItems[0]?.counterTone).toBe('alert');
    expect(group?.subtitle).toBe('2 members · 4 pending');
    expect(group?.badges?.map(badge => badge.label)).toEqual(['2 / 0 - 5']);
    expect(group?.actionMenu?.trigger?.counter).toEqual({
      value: 4,
      max: 99,
      ariaLabel: '4 pending changes'
    });
    expect(menuItems.find(item => item.id === 'members')?.counter).toEqual({
      value: 1,
      max: 99,
      ariaLabel: '1 pending'
    });
    expect(menuItems.find(item => item.id === 'transport')?.counter).toEqual({
      value: 3,
      max: 99,
      ariaLabel: '3 pending'
    });
    expect(menuItems.find(item => item.id === 'members')?.counterTone).toBe('alert');
    expect(menuItems.find(item => item.id === 'transport')?.counterTone).toBe('alert');
  });
});

function tournamentState(): EventTournamentGroupsStateDTO {
  return {
    eventId: 'event-1',
    title: 'Seattle Wildflower Meetup',
    subtitle: '',
    canManage: true,
    stages: [{
      subEventId: 'stage-1',
      title: 'Kickoff',
      description: '',
      location: '',
      startAt: '2026-07-23T13:30:00Z',
      endAt: '2026-07-23T14:15:00Z',
      stageNumber: 1,
      stageStatus: 'SR',
      leaderboardType: 'Score',
      advancePerGroup: 1,
      groups: [{
        id: 'stage-1:group:1',
        name: 'Group A',
        source: 'generated',
        capacityMin: 0,
        capacityMax: 5,
        membersAccepted: 2,
        membersPending: 1,
        resourceMetricsByType: {
          Transport: {
            accepted: 2,
            pending: 3,
            capacityMin: 0,
            capacityMax: 5
          }
        }
      }]
    }]
  };
}

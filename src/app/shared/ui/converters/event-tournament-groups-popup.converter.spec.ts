import { describe, expect, it } from 'vitest';

import type { EventTournamentGroupsStateDTO } from '../../core/contracts/event.interface';
import { EventTournamentGroupsPopupConverter } from './event-tournament-groups-popup.converter';

describe('EventTournamentGroupsPopupConverter metrics', () => {
  it('shows accepted members and the group-channel pending total independently', () => {
    const model = EventTournamentGroupsPopupConverter.convert({
      state: tournamentState(),
      selectedStageId: 'stage-1',
      openGroupIds: [],
      pendingTotalsByGroupId: { 'stage-1:group:1': 3 }
    });
    const group = model.accordion.items[0];

    expect(group?.subtitle).toBe('2 members · 3 pending');
    expect(group?.badges?.map(badge => badge.label)).toEqual(['2 / 0 - 5', 3]);
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
        membersPending: 1
      }]
    }]
  };
}

import { describe, expect, it } from 'vitest';

import type { ActivityEventDTO } from '../../core/contracts/activity.interface';
import { ActivityEventInfoCardConverter } from './activity-event-info-card.converter';
import { EventSubeventsListContextMenuConverter } from './event-subevents-list-context-menu.converter';

describe('EventSubeventsListContextMenuConverter member activity', () => {
  it('puts only pending members on the Tags action as a red counter', () => {
    const members = EventSubeventsListContextMenuConverter.convert({
      participantOnly: false,
      editorAction: 'view',
      pendingMembers: 45,
      membersDisabled: false
    }).find(item => item.id === 'members');

    expect(members?.counter).toEqual({ value: 45, max: 99 });
    expect(members?.counterTone).toBe('alert');
  });

  it('uses the same current member summary as the activity card badge', () => {
    const card = ActivityEventInfoCardConverter.convert({
      id: 'event-1',
      title: 'Seattle Wildflower Meetup',
      activity: 2,
      acceptedMembers: 7,
      pendingMembers: 2,
      capacityTotal: 20
    } as ActivityEventDTO);
    const summary = ActivityEventInfoCardConverter.toActivityMembersSummary(card);

    const members = EventSubeventsListContextMenuConverter.convert({
      participantOnly: false,
      editorAction: 'view',
      pendingMembers: summary?.pendingMembers ?? 0,
      membersDisabled: false
    }).find(item => item.id === 'members');

    expect(summary?.pendingMembers).toBe(2);
    expect(members?.counter).toEqual({ value: 2, max: 99 });
    expect(members?.counterTone).toBe('alert');
  });
});

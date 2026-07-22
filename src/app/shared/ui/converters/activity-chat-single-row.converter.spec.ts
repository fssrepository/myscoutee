import { describe, expect, it } from 'vitest';

import type { ChatDTO } from '../../core/contracts/chat.interface';
import type { SubEventDTO } from '../../core/contracts/event.interface';
import type { UserDto } from '../../core/contracts/user.interface';
import { ActivityChatSingleRowConverter } from './activity-chat-single-row.converter';

describe('ActivityChatSingleRowConverter group context', () => {
  it('uses the group name without the channel suffix and keeps its parent context on a separate row', () => {
    const row = ActivityChatSingleRowConverter.convert(groupChat(), {
      activeUser: {
        id: 'viewer',
        name: 'Viewer',
        initials: 'VI',
        gender: 'female'
      } as unknown as UserDto
    });

    expect(row.subtitle).toBe('Group B');
    expect(row.detail).toContain('Seattle Wildflower Meetup');
    expect(row.detail).toContain('Kickoff');
    expect(row.metaRows).toEqual(['Perfect, locking this in.']);
  });
});

function groupChat(): ChatDTO {
  return {
    id: 'chat-group-b',
    avatar: 'GB',
    title: 'Group B · Group Channel',
    lastMessage: 'Perfect, locking this in.',
    lastSenderId: 'member-1',
    memberIds: ['viewer', 'member-1'],
    unread: 0,
    channelType: 'groupSubEvent',
    ownerId: 'event-1:stage-1:stage-1:group:2',
    eventId: 'event-1',
    subEventId: 'stage-1',
    groupId: 'stage-1:group:2',
    navigationContext: {
      eventId: 'event-1',
      eventTitle: 'Seattle Wildflower Meetup',
      eventTarget: 'hosting',
      eventPendingMembers: 0,
      subEvent: {
        id: 'stage-1',
        name: 'Kickoff',
        startAt: '2026-07-23T13:30:00Z',
        endAt: '2026-07-23T14:15:00Z'
      } as SubEventDTO,
      group: {
        id: 'stage-1:group:2',
        name: 'Group B',
        source: 'generated',
        accepted: 2,
        pending: 1,
        capacityMin: 0,
        capacityMax: 5
      }
    }
  };
}

import { describe, expect, it } from 'vitest';

import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { SeedChatsBuilder } from './chats-seed.builder';

describe('SeedChatsBuilder contextual activity membership', () => {
  it('does not expose the main event channel to a pending participant', () => {
    const items = SeedChatsBuilder.buildContextualChatItemsForUser(
      'u3',
      [eventRecord({
        userId: 'u3',
        acceptedMemberUserIds: ['u1', 'u2'],
        pendingMemberUserIds: ['u3']
      })]
    );

    expect(items.some(item => item.channelType === 'mainEvent')).toBe(false);
    expect(items.some(item => item.channelType === 'serviceEvent')).toBe(true);
  });

  it('uses only accepted event members and keeps the latest message sender aligned with the chat summary', () => {
    const records = SeedChatsBuilder.buildContextualRecordCollectionForUser(
      'u1',
      [eventRecord({
        userId: 'u1',
        acceptedMemberUserIds: ['u1', 'u2'],
        pendingMemberUserIds: ['u3']
      })]
    );
    const chat = Object.values(records.chats.byId)
      .find(item => item.channelType === 'mainEvent');

    expect(chat?.memberIds).toEqual(['u1', 'u2']);
    expect(chat?.memberIds).not.toContain('u3');

    const messageIds = records.chatMessages.idsByChatKey[`u1:${chat?.id}`] ?? [];
    const latestMessage = messageIds
      .map(messageId => records.chatMessages.byId[messageId])
      .sort((left, right) => right.sentAtIso.localeCompare(left.sentAtIso))[0];

    expect(latestMessage?.senderAvatar.userId).toBe(chat?.lastSenderId);
    expect(latestMessage?.bodyText).toBe(chat?.lastMessage);
  });
});

function eventRecord(overrides: Partial<ActivityEventRecord>): ActivityEventRecord {
  return {
    id: 'event-1',
    userId: 'u1',
    type: 'events',
    status: 'A',
    avatar: 'EV',
    title: 'Fixture Event',
    subtitle: 'Fixture Event',
    timeframe: '',
    activity: 0,
    unread: 0,
    acceptedMembers: 2,
    pendingMembers: 1,
    capacityTotal: 3,
    creatorUserId: 'u1',
    adminIds: ['u1'],
    acceptedMemberUserIds: ['u1', 'u2'],
    pendingMemberUserIds: ['u3'],
    startAtIso: '2026-08-01T10:00:00Z',
    endAtIso: '2026-08-01T12:00:00Z',
    distanceKm: 0,
    distanceMetersExact: 0,
    affinity: 0,
    boost: 0,
    rating: 0,
    imageUrl: '',
    sourceLink: '',
    location: 'Austin',
    visibility: 'Public',
    blindMode: 'Off',
    expired: false,
    autoInviter: false,
    frequency: 'Once',
    ticketing: false,
    approvalRequired: false,
    topics: [],
    policiesEnabled: false,
    policies: [],
    slotsEnabled: false,
    slotTemplates: [],
    generated: false,
    subEventsEnabled: false,
    subEventDefinitions: [],
    subEvents: [],
    mode: 'Social',
    ...overrides
  } as ActivityEventRecord;
}

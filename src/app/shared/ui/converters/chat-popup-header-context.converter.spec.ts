import { describe, expect, it } from 'vitest';

import type { ChatDTO } from '../../core/contracts/chat.interface';
import { ChatPopupHeaderContextConverter } from './chat-popup-header-context.converter';

describe('ChatPopupHeaderContextConverter event lifecycle', () => {
  it('adds a compact title badge to any unpublished event chat', () => {
    const context = ChatPopupHeaderContextConverter.convert(chat({
      channelType: 'groupSubEvent',
      ownerStatus: 'DR'
    }));

    expect(context.titleBadge).toEqual({
      label: 'activities.chat.event.status.underReview',
      tone: 'warning'
    });
    expect(ChatPopupHeaderContextConverter.convert(chat({ ownerStatus: 'A' })).titleBadge).toBeNull();
  });
});

function chat(overrides: Partial<ChatDTO> = {}): ChatDTO {
  return {
    id: 'chat-event-1',
    avatar: 'EV',
    title: 'Event chat',
    lastMessage: 'Hello',
    lastSenderId: 'member-1',
    memberIds: ['viewer', 'member-1'],
    unread: 0,
    channelType: 'mainEvent',
    ownerId: 'event-1',
    eventId: 'event-1',
    ...overrides
  };
}

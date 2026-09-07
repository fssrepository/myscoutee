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

  it('builds an ordered two-person avatar stack for a draft service chat', () => {
    const members = ChatPopupHeaderContextConverter.memberSummaries([
      {
        id: 'member-1',
        user: {
          id: 'member-1',
          name: 'Nova Social',
          initials: 'NS',
          gender: 'woman',
          images: ['nova.webp'],
          profileStatus: 'public'
        }
      },
      {
        id: 'owner-1',
        user: null,
        fallbackName: 'Casey Bridge'
      }
    ]);
    const context = ChatPopupHeaderContextConverter.convert(chat({
      channelType: 'serviceEvent',
      serviceContext: 'asset',
      memberIds: ['member-1', 'owner-1'],
      members
    }), { includeThumbs: true });

    expect(context.controls[0]?.visual).toEqual({
      kind: 'thumbStack',
      maxVisible: 4,
      thumbs: [
        { id: 'member-1', label: 'Nova Social', initials: 'NS', imageUrl: 'nova.webp' },
        { id: 'owner-1', label: 'Casey Bridge', initials: 'CB', imageUrl: null }
      ]
    });
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

import { describe, expect, it } from 'vitest';

import {
  EventFeedbackDetailDto,
  type EventFeedbackDto,
  type EventFeedbackStateDto
} from '../../core/contracts/activity.interface';
import { EventFeedbackInfoCardConverter } from './event-feedback-info-card.converter';

describe('EventFeedbackInfoCardConverter submitted feedback', () => {
  it('uses a submitted-rating menu action instead of pending actions', () => {
    const item: EventFeedbackDto = {
      eventId: 'event-1',
      title: 'Finished event',
      subtitle: 'Seattle',
      timeframe: 'Jul 12',
      imageUrl: '',
      startAtMs: 1,
      pendingCards: 0,
      totalCards: 1,
      isRemoved: false,
      isFeedbacked: true,
      feedbackedAtMs: 2
    };

    const card = EventFeedbackInfoCardConverter.convert(item);

    expect(card.menuActions).toEqual(['viewSubmittedFeedback']);
  });

  it('hydrates the read-only detail from the persisted state answers', () => {
    const detail = new EventFeedbackDetailDto({
      eventId: 'event-1',
      title: 'Finished event',
      cards: [{
        id: 'card-1',
        eventId: 'event-1',
        kind: 'event',
        eventTitle: 'Finished event',
        eventSubtitle: '',
        eventImageUrl: '',
        eventTimeframe: '',
        eventStartAtIso: '',
        eventLabel: '',
        targetName: 'Host'
      }]
    });
    const state: EventFeedbackStateDto = {
      eventId: 'event-1',
      removed: false,
      submittedAtIso: '2026-07-23T18:00:00Z',
      organizerNote: '',
      answersByCardId: {
        'card-1': {
          cardId: 'card-1',
          eventId: 'event-1',
          kind: 'event',
          targetUserId: 'host-1',
          targetRole: 'Admin',
          primaryValue: 'good',
          secondaryValue: 'resources',
          personalityTraitIds: ['reliable-one'],
          tags: [],
          submittedAtIso: '2026-07-23T18:00:00Z'
        }
      }
    };

    const persisted = detail.withPersistedState(state);

    expect(persisted.submittedAtIso).toBe('2026-07-23T18:00:00Z');
    expect(persisted.cards[0]?.answerPrimary).toBe('good');
    expect(persisted.cards[0]?.answerSecondary).toBe('resources');
    expect(persisted.cards[0]?.selectedTraitIds).toEqual(['reliable-one']);
  });
});

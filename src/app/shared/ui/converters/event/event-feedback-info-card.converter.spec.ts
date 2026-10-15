import { describe, expect, it } from 'vitest';

import {
  EventFeedbackDetailDto,
  type EventFeedbackDto,
  type EventFeedbackStateDto
} from '../../../core/contracts/common/activity.interface';
import { EventFeedbackDetailConverter } from './event-feedback-detail.converter';
import { EventFeedbackInfoCardConverter } from './event-feedback-info-card.converter';
import type { ServiceFeedbackItem } from '../../../core/contracts/community/service-feedback.interface';

describe('EventFeedbackInfoCardConverter submitted feedback', () => {
  const service: ServiceFeedbackItem = {
    providerName: 'Provider', reviewerName: 'Reviewer', serviceTitle: 'Plumbing', serviceImageUrl: '/service.webp',
    feedback: { id: 'review', baseGroupId: 'myscoutee-community', caseId: 'case', caseTitle: 'Meter replacement',
      serviceId: 'service', providerAccountId: 'provider', viewerAccountId: 'reviewer', status: 'removed',
      criteria: {}, average: null, comment: '', createdAtIso: '2026-10-14T10:00:00Z', submittedAtIso: null }
  };

  it('shows service identity and uses the shared danger badge for removed reviews', () => {
    const card = EventFeedbackInfoCardConverter.convertService(service, false);
    expect(card).toMatchObject({ title: 'Plumbing', imageUrl: '/service.webp',
      metaRows: ['Provider', 'Meter replacement'], mediaEnd: { label: 'Removed', tone: 'danger', interactive: false } });
    expect(card.menuActions).toEqual(['restoreFeedback']);
  });

  it('leaves unavailable service images empty for the shared placeholder and retains received identities', () => {
    const card = EventFeedbackInfoCardConverter.convertService({ ...service, serviceImageUrl: null, serviceTitle: null }, true);
    expect(card.imageUrl).toBe('');
    expect(card.mediaMode).toBeUndefined();
    expect(card.title).toBe('Meter replacement');
    expect(card.metaRows).toEqual(['Provider', 'Reviewer', 'Meter replacement']);
    expect(card.menuActions).toEqual(['viewSubmittedFeedback']);
  });

  it('preserves an empty event image so the shared card renders its neutral placeholder', () => {
    const eventId = 'manual-event';
    const [card] = EventFeedbackDetailConverter.convert(new EventFeedbackDetailDto({
      eventId,
      title: 'Manual event',
      cards: [{
        id: `feedback-event-${eventId}`,
        eventId,
        kind: 'event',
        eventTitle: 'Manual event',
        eventSubtitle: '',
        eventImageUrl: '',
        eventTimeframe: '',
        eventStartAtIso: '',
        eventLabel: '',
        targetName: 'Host'
      }]
    }));

    expect(card?.imageUrl).toBe('');
  });

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

    expect(card.menuActions).toEqual(['viewSubmittedFeedback', 'addOrganizerNote']);
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
          eventComment: 'A focused and welcoming event.',
          personalityTraitIds: ['reliable-one'],
          tags: [],
          submittedAtIso: '2026-07-23T18:00:00Z'
        }
      }
    };

    const persisted = detail.withPersistedState(state);

    expect(persisted.submittedAtIso).toBe('2026-07-23T18:00:00Z');
    expect(persisted.cards[0]?.answerPrimary).toBe('good');
    expect(persisted.cards[0]?.eventComment).toBe('A focused and welcoming event.');
    expect(persisted.cards[0]?.answerSecondary).toBe('resources');
    expect(persisted.cards[0]?.selectedTraitIds).toEqual(['reliable-one']);
  });
});

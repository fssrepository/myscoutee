import { describe, expect, it } from 'vitest';

import { FeedbackDetailDto, type FeedbackDto, type FeedbackStateDto } from '../../../core/contracts/feedback/feedback.interface';
import { FeedbackDetailConverter } from './feedback-detail.converter';
import { FeedbackInfoCardConverter } from './feedback-info-card.converter';
import type { FeedbackEvaluationItem } from '../../../core/contracts/feedback/feedback.interface';

describe('FeedbackInfoCardConverter submitted feedback', () => {
  const service: FeedbackEvaluationItem = {
    providerName: 'Provider', reviewerName: 'Reviewer', serviceTitle: 'Plumbing', serviceImageUrl: '/service.webp',
    feedback: { id: 'review', baseGroupId: 'myscoutee-community', caseId: 'case', caseTitle: 'Meter replacement',
      serviceId: 'service', providerAccountId: 'provider', viewerAccountId: 'reviewer', status: 'removed',
      criteria: {}, average: null, comment: '', createdAtIso: '2026-10-14T10:00:00Z', submittedAtIso: null }
  };

  it('shows service identity and uses the same muted badge as the removed filter', () => {
    const card = FeedbackInfoCardConverter.convertService(service, false);
    expect(card).toMatchObject({ title: 'Plumbing', imageUrl: '/service.webp',
      metaRows: ['Provider', 'Meter replacement'], mediaEnd: { label: 'feedback.evaluation.removed', tone: 'slate', interactive: false } });
    expect(card.menuActions).toEqual(['restoreFeedback']);
  });

  it('leaves unavailable service images empty for the shared placeholder and retains received identities', () => {
    const card = FeedbackInfoCardConverter.convertService({ ...service, serviceImageUrl: null, serviceTitle: null }, true);
    expect(card.imageUrl).toBe('');
    expect(card.mediaMode).toBeUndefined();
    expect(card.title).toBe('Meter replacement');
    expect(card.metaRows).toEqual(['Provider', 'Reviewer', 'Meter replacement']);
    expect(card.menuActions).toEqual(['viewSubmittedFeedback']);
  });

  it('preserves an empty event image so the shared card renders its neutral placeholder', () => {
    const eventId = 'manual-event';
    const [card] = FeedbackDetailConverter.convert(new FeedbackDetailDto({
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
    const item: FeedbackDto = {
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

    const card = FeedbackInfoCardConverter.convert(item);

    expect(card.menuActions).toEqual(['viewSubmittedFeedback', 'addOrganizerNote']);
  });

  it('hydrates the read-only detail from the persisted state answers', () => {
    const detail = new FeedbackDetailDto({
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
    const state: FeedbackStateDto = {
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

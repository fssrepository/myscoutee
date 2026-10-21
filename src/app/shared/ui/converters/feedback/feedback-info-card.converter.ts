import { FeedbackFilterMenuConverter } from './feedback-page.converter';
import type { FeedbackDto, FeedbackPageStateSnapshotDto } from '../../../core/contracts/feedback/feedback.interface';
import { type InfoCardData, type CardMenuActionId, type UiListConverter } from '@fssrepository/myscoutee-components';

import type { FeedbackEvaluationItem } from '../../../core/contracts/feedback/feedback.interface';

export interface FeedbackEvaluationCardDetail {
  kind: 'feedback-evaluation';
  item: FeedbackEvaluationItem;
  received: boolean;
}

export interface FeedbackInfoCardConverterOptions {
  state?: FeedbackPageStateSnapshotDto | null;
}

export interface FeedbackOrganizerInfoCardData {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  responseCount: number;
  noteCount: number;
}

export interface FeedbackOrganizerInfoCardConverterOptions {
  showAction?: boolean;
}

export class FeedbackOrganizerInfoCardConverter {
  static convert(
    item: FeedbackOrganizerInfoCardData,
    options: FeedbackOrganizerInfoCardConverterOptions = {}
  ): InfoCardData {
    const showAction = options.showAction ?? true;
    return {
      id: item.eventId,
      status: 'own-event',
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows: [item.timeframe],
      leadingIcon: {
        icon: 'stadium'
      },
      mediaEnd: showAction
        ? {
          variant: 'badge',
          tone: FeedbackFilterMenuConverter.filterPalette('own-events'),
          label: 'view.feedbacks',
          pendingCount: item.responseCount,
          interactive: true,
          ariaLabel: `Open feedback details for ${item.title}`
        }
        : null,
      clickable: false
    };
  }

  static convertList(
    items: readonly FeedbackOrganizerInfoCardData[],
    options: FeedbackOrganizerInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }
}

export class FeedbackInfoCardConverter {
  static serviceItem(card: InfoCardData): FeedbackEvaluationCardDetail | null {
    const detail = card.eagerDetail as FeedbackEvaluationCardDetail | undefined;
    return detail?.kind === 'feedback-evaluation' ? detail : null;
  }

  static convertService(item: FeedbackEvaluationItem, received: boolean): InfoCardData<FeedbackEvaluationCardDetail> {
    const feedback = item.feedback;
    const pending = !received && feedback.status === 'pending';
    return {
      id: `feedback-evaluation:${feedback.id}`,
      eagerDetail: { kind: 'feedback-evaluation', item, received },
      status: received ? 'own-event' : feedback.status,
      title: item.serviceTitle || feedback.caseTitle,
      imageUrl: item.serviceImageUrl || '',
      dateIso: feedback.submittedAtIso ?? feedback.createdAtIso,
      metaRows: received ? [item.providerName, item.reviewerName, feedback.caseTitle] : [item.providerName, feedback.caseTitle],
      description: feedback.comment, descriptionLines: 2,
      leadingIcon: { icon: 'home_repair_service', palette: 'orange' },
      surfaceTone: 'subevent-light', accentHue: 42,
      mediaEnd: { variant: 'badge', tone: FeedbackFilterMenuConverter.filterPalette(received ? 'own-events' : feedback.status),
        label: received ? 'view.feedbacks' : pending ? 'start.feedback' : feedback.status === 'removed' ? 'feedback.evaluation.removed' : 'feedbacked',
        interactive: received || pending },
      menuActions: received ? ['viewSubmittedFeedback'] : pending ? ['startFeedback', 'removeFeedback']
        : feedback.status === 'removed' ? ['restoreFeedback'] : ['viewSubmittedFeedback'],
      clickable: false
    };
  }

  static convert(
    item: FeedbackDto,
    options: FeedbackInfoCardConverterOptions = {}
  ): InfoCardData {
    if (item.isOwnEvent) {
      return FeedbackOrganizerInfoCardConverter.convert({
        eventId: item.eventId,
        title: item.title,
        subtitle: item.subtitle,
        timeframe: item.timeframe,
        imageUrl: item.imageUrl,
        responseCount: item.pendingCards,
        noteCount: 0
      });
    }
    const startAvailable = this.isFeedbackStartAvailable(item);
    const detailRows = item.isFeedbacked
      ? [item.timeframe]
      : [item.timeframe, this.feedbackItemStatusLine(item)];
    return {
      id: item.eventId,
      status: item.isRemoved ? 'removed' : item.isFeedbacked ? 'feedbacked' : 'pending',
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows,
      leadingIcon: {
        icon: this.feedbackLeadingIcon(item)
      },
      mediaEnd: {
        variant: 'badge',
        tone: FeedbackFilterMenuConverter.filterPalette(item.isRemoved ? 'removed' : item.isFeedbacked ? 'feedbacked' : 'pending'),
        label: this.feedbackStartBadgeLabel(item),
        interactive: startAvailable,
        ariaLabel: startAvailable
          ? 'Start feedback'
          : 'feedback.event.unavailable.aria'
      },
      menuActions: this.feedbackMenuActions(item, this.hasOrganizerNote(item.eventId, options.state)),
      clickable: false
    };
  }

  static convertList(
    items: readonly FeedbackDto[],
    options: FeedbackInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }

  private static isFeedbackStartAvailable(item: FeedbackDto): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  private static feedbackItemStatusLine(item: FeedbackDto): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  private static feedbackLeadingIcon(item: FeedbackDto): string {
    if (item.isOwnEvent) {
      return 'stadium';
    }
    if (item.isFeedbacked) {
      return 'task_alt';
    }
    if (item.isRemoved) {
      return 'delete_outline';
    }
    return 'rate_review';
  }

  private static feedbackStartBadgeLabel(item: FeedbackDto): string {
    if (item.isOwnEvent) {
      return 'view.feedbacks';
    }
    if (item.isRemoved) {
      return 'feedback.evaluation.removed';
    }
    if (item.isFeedbacked) {
      return 'feedbacked';
    }
    return 'start.feedback';
  }

  private static feedbackMenuActions(
    item: FeedbackDto,
    hasOrganizerNote: boolean
  ): readonly CardMenuActionId[] {
    if (item.isOwnEvent) {
      return [];
    }
    if (item.isFeedbacked) {
      return [
        'viewSubmittedFeedback',
        hasOrganizerNote ? 'editOrganizerNote' : 'addOrganizerNote'
      ];
    }
    const actions: CardMenuActionId[] = [];
    if (this.isFeedbackStartAvailable(item)) {
      actions.push('startFeedback');
    }
    if (!item.isRemoved && !item.isFeedbacked) {
      actions.push('removeFeedback');
    }
    if (item.isRemoved) {
      actions.push('restoreFeedback');
    }
    actions.push(hasOrganizerNote ? 'editOrganizerNote' : 'addOrganizerNote');
    return actions;
  }

  private static hasOrganizerNote(
    eventId: string,
    state: FeedbackPageStateSnapshotDto | null | undefined
  ): boolean {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return false;
    }
    return Boolean(state?.organizerNotesByEventId?.[normalizedEventId]?.trim());
  }

}

export const feedbackInfoCardConverter =
  FeedbackInfoCardConverter satisfies UiListConverter<
    FeedbackDto,
    InfoCardData,
    FeedbackInfoCardConverterOptions | undefined
  >;

export const feedbackOrganizerInfoCardConverter =
  FeedbackOrganizerInfoCardConverter satisfies UiListConverter<
    FeedbackOrganizerInfoCardData,
    InfoCardData,
    FeedbackOrganizerInfoCardConverterOptions | undefined
  >;

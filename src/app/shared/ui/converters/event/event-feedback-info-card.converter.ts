import type {
  EventFeedbackDto,
  EventFeedbackPageStateSnapshotDto,
} from '../../../core/contracts/activity.interface';
import { type InfoCardData, type CardMenuActionId, type UiListConverter } from '@myscoutee/components';

import type { ServiceFeedbackItem } from '../../../core/contracts/service-feedback.interface';

export interface ServiceFeedbackCardDetail {
  kind: 'service-feedback';
  item: ServiceFeedbackItem;
  received: boolean;
}

export interface EventFeedbackInfoCardConverterOptions {
  state?: EventFeedbackPageStateSnapshotDto | null;
}

export interface EventFeedbackOrganizerInfoCardData {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  responseCount: number;
  noteCount: number;
}

export interface EventFeedbackOrganizerInfoCardConverterOptions {
  showAction?: boolean;
}

export class EventFeedbackOrganizerInfoCardConverter {
  static convert(
    item: EventFeedbackOrganizerInfoCardData,
    options: EventFeedbackOrganizerInfoCardConverterOptions = {}
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
          tone: 'default',
          label: 'View Feedbacks',
          pendingCount: item.responseCount,
          interactive: true,
          ariaLabel: `Open feedback details for ${item.title}`
        }
        : null,
      clickable: false
    };
  }

  static convertList(
    items: readonly EventFeedbackOrganizerInfoCardData[],
    options: EventFeedbackOrganizerInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }
}

export class EventFeedbackInfoCardConverter {
  static serviceItem(card: InfoCardData): ServiceFeedbackCardDetail | null {
    const detail = card.eagerDetail as ServiceFeedbackCardDetail | undefined;
    return detail?.kind === 'service-feedback' ? detail : null;
  }

  static convertService(item: ServiceFeedbackItem, received: boolean): InfoCardData<ServiceFeedbackCardDetail> {
    const feedback = item.feedback;
    const pending = !received && feedback.status === 'pending';
    return {
      id: `service-feedback:${feedback.id}`,
      eagerDetail: { kind: 'service-feedback', item, received },
      status: received ? 'own-event' : feedback.status,
      title: item.providerName,
      mediaTitle: feedback.caseTitle,
      mediaMode: 'title', mediaIcon: 'home_repair_service',
      dateIso: feedback.submittedAtIso ?? feedback.createdAtIso,
      metaRows: received ? [item.reviewerName] : [feedback.caseTitle],
      detailRows: feedback.average == null ? [] : [`${feedback.average.toFixed(2)} / 10`],
      description: feedback.comment, descriptionLines: 2,
      leadingIcon: { icon: 'home_repair_service', palette: 'orange' },
      surfaceTone: 'subevent-light', accentHue: 42,
      mediaEnd: { variant: 'badge', tone: 'default',
        label: received ? 'View Feedbacks' : pending ? 'Start Feedback' : feedback.status === 'removed' ? 'Removed' : 'Feedbacked',
        interactive: received || pending },
      menuActions: received ? ['viewSubmittedFeedback'] : pending ? ['startFeedback', 'removeFeedback']
        : feedback.status === 'removed' ? ['restoreFeedback'] : ['viewSubmittedFeedback'],
      clickable: false
    };
  }

  static convert(
    item: EventFeedbackDto,
    options: EventFeedbackInfoCardConverterOptions = {}
  ): InfoCardData {
    if (item.isOwnEvent) {
      return EventFeedbackOrganizerInfoCardConverter.convert({
        eventId: item.eventId,
        title: item.title,
        subtitle: item.subtitle,
        timeframe: item.timeframe,
        imageUrl: item.imageUrl,
        responseCount: item.pendingCards,
        noteCount: 0
      });
    }
    const startAvailable = this.isEventFeedbackStartAvailable(item);
    const detailRows = item.isFeedbacked
      ? [item.timeframe]
      : [item.timeframe, this.eventFeedbackItemStatusLine(item)];
    return {
      id: item.eventId,
      status: item.isRemoved ? 'removed' : item.isFeedbacked ? 'feedbacked' : 'pending',
      title: item.title,
      imageUrl: item.imageUrl,
      metaRows: [item.subtitle],
      detailRows,
      leadingIcon: {
        icon: this.eventFeedbackLeadingIcon(item)
      },
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.eventFeedbackStartBadgeLabel(item),
        interactive: startAvailable,
        ariaLabel: startAvailable
          ? 'Start event feedback'
          : 'Event feedback unavailable'
      },
      menuActions: this.eventFeedbackMenuActions(item, this.hasOrganizerNote(item.eventId, options.state)),
      clickable: false
    };
  }

  static convertList(
    items: readonly EventFeedbackDto[],
    options: EventFeedbackInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }

  private static isEventFeedbackStartAvailable(item: EventFeedbackDto): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  private static eventFeedbackItemStatusLine(item: EventFeedbackDto): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  private static eventFeedbackLeadingIcon(item: EventFeedbackDto): string {
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

  private static eventFeedbackStartBadgeLabel(item: EventFeedbackDto): string {
    if (item.isOwnEvent) {
      return 'View Feedbacks';
    }
    if (item.isRemoved) {
      return 'Removed';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked';
    }
    return 'Start Feedback';
  }

  private static eventFeedbackMenuActions(
    item: EventFeedbackDto,
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
    if (this.isEventFeedbackStartAvailable(item)) {
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
    state: EventFeedbackPageStateSnapshotDto | null | undefined
  ): boolean {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return false;
    }
    return Boolean(state?.organizerNotesByEventId?.[normalizedEventId]?.trim());
  }

}

export const eventFeedbackInfoCardConverter =
  EventFeedbackInfoCardConverter satisfies UiListConverter<
    EventFeedbackDto,
    InfoCardData,
    EventFeedbackInfoCardConverterOptions | undefined
  >;

export const eventFeedbackOrganizerInfoCardConverter =
  EventFeedbackOrganizerInfoCardConverter satisfies UiListConverter<
    EventFeedbackOrganizerInfoCardData,
    InfoCardData,
    EventFeedbackOrganizerInfoCardConverterOptions | undefined
  >;

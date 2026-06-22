import type {
  EventFeedbackPageItemDto,
  EventFeedbackPageStateSnapshotDto,
} from '../../core/contracts/activity.interface';
import type { InfoCardData, CardMenuActionId } from '../components/card';
import type { UiListConverter } from './converter.types';

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
  static convert(
    item: EventFeedbackPageItemDto,
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
    items: readonly EventFeedbackPageItemDto[],
    options: EventFeedbackInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }

  private static isEventFeedbackStartAvailable(item: EventFeedbackPageItemDto): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  private static eventFeedbackItemStatusLine(item: EventFeedbackPageItemDto): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  private static eventFeedbackLeadingIcon(item: EventFeedbackPageItemDto): string {
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

  private static eventFeedbackStartBadgeLabel(item: EventFeedbackPageItemDto): string {
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
    item: EventFeedbackPageItemDto,
    hasOrganizerNote: boolean
  ): readonly CardMenuActionId[] {
    if (item.isOwnEvent) {
      return [];
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
    EventFeedbackPageItemDto,
    InfoCardData,
    EventFeedbackInfoCardConverterOptions | undefined
  >;

export const eventFeedbackOrganizerInfoCardConverter =
  EventFeedbackOrganizerInfoCardConverter satisfies UiListConverter<
    EventFeedbackOrganizerInfoCardData,
    InfoCardData,
    EventFeedbackOrganizerInfoCardConverterOptions | undefined
  >;

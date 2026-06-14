import type * as AppTypes from '../../core/base/models';
import type {
  EventFeedbackPageCountsDto,
  EventFeedbackPageItemDto,
  EventFeedbackPageResultDto,
  EventFeedbackPageStateSnapshotDto,
  EventFeedbackReceivedEventDto
} from '../../core/contracts/activity.interface';
import type { InfoCardData, InfoCardMenuAction } from '../components/card';

export interface EventFeedbackPageViewModel {
  items: InfoCardData[];
  total: number;
  allItems: AppTypes.EventFeedbackEventCard[];
  organizerItems: AppTypes.EventFeedbackEventCard[];
  receivedEvents: EventFeedbackReceivedEventDto[];
  state: EventFeedbackPageStateSnapshotDto;
  counts: EventFeedbackPageCountsDto;
}

export interface EventFeedbackInfoCardConverterOptions {
  hasOrganizerNote?: (eventId: string) => boolean;
}

export interface EventFeedbackOrganizerInfoCardInput {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  responseCount: number;
  noteCount: number;
}

export class EventFeedbackInfoCardConverter {
  static convertPage(
    result: EventFeedbackPageResultDto,
    options: EventFeedbackInfoCardConverterOptions = {}
  ): EventFeedbackPageViewModel {
    const allItems = this.convertItems(result.allItems);
    const organizerItems = this.convertItems(result.organizerItems);
    return {
      items: this.convertItems(result.items).map(item => this.convert(item, options)),
      total: Math.max(0, Math.trunc(Number(result.total) || 0)),
      allItems,
      organizerItems,
      receivedEvents: [...(result.receivedEvents ?? [])],
      state: result.state,
      counts: result.counts
    };
  }

  static convert(
    item: AppTypes.EventFeedbackEventCard,
    options: EventFeedbackInfoCardConverterOptions = {}
  ): InfoCardData {
    if (item.isOwnEvent) {
      return this.organizerEventFeedbackCard({
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
      menuActions: this.eventFeedbackMenuActions(item, options.hasOrganizerNote?.(item.eventId) === true),
      clickable: false
    };
  }

  static convertItems(items: readonly EventFeedbackPageItemDto[] | undefined): AppTypes.EventFeedbackEventCard[] {
    return (items ?? []).map(item => ({
      eventId: item.eventId?.trim() ?? '',
      title: item.title?.trim() ?? '',
      subtitle: item.subtitle?.trim() ?? '',
      timeframe: item.timeframe?.trim() ?? '',
      imageUrl: item.imageUrl?.trim() ?? '',
      startAtMs: Math.max(0, Math.trunc(Number(item.startAtMs) || 0)),
      pendingCards: Math.max(0, Math.trunc(Number(item.pendingCards) || 0)),
      totalCards: Math.max(0, Math.trunc(Number(item.totalCards) || 0)),
      isRemoved: item.isRemoved === true,
      isFeedbacked: item.isFeedbacked === true,
      feedbackedAtMs: this.numberOrNull(item.feedbackedAtMs),
      removedAtMs: this.numberOrNull(item.removedAtMs),
      isOwnEvent: item.isOwnEvent === true
    })).filter(item => item.eventId.length > 0);
  }

  static organizerEventFeedbackCard(
    item: EventFeedbackOrganizerInfoCardInput,
    options: { showAction?: boolean } = {}
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

  private static isEventFeedbackStartAvailable(item: AppTypes.EventFeedbackEventCard): boolean {
    return !item.isRemoved && item.pendingCards > 0;
  }

  private static eventFeedbackItemStatusLine(item: AppTypes.EventFeedbackEventCard): string {
    if (item.isRemoved) {
      return 'Removed without feedback.';
    }
    if (item.isFeedbacked) {
      return 'Feedbacked.';
    }
    return `${item.pendingCards}/${item.totalCards} feedback item${item.totalCards === 1 ? '' : 's'} pending.`;
  }

  private static eventFeedbackLeadingIcon(item: AppTypes.EventFeedbackEventCard): string {
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

  private static eventFeedbackStartBadgeLabel(item: AppTypes.EventFeedbackEventCard): string {
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
    item: AppTypes.EventFeedbackEventCard,
    hasOrganizerNote: boolean
  ): readonly InfoCardMenuAction[] {
    if (item.isOwnEvent) {
      return [];
    }
    const actions: InfoCardMenuAction[] = [];
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

  private static numberOrNull(value: number | null | undefined): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
  }
}

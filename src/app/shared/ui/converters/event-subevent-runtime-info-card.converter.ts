import { AppUtils } from '../../app-utils';
import type {
  ActivityEventDetailDTO,
  ActivityEventSubEventRuntimeDTO
} from '../../core/contracts/activity.interface';
import type { EventMode } from '../../core/contracts/event.interface';
import type { InfoCardData } from '../components/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface EventSubeventRuntimeInfoCardConverterOptions {
  event?: ActivityEventDetailDTO | null;
  mode?: EventMode | null;
  groupLabel?: string | null;
}

export class EventSubeventRuntimeInfoCardConverter
  implements UiListConverter<ActivityEventSubEventRuntimeDTO, InfoCardData, EventSubeventRuntimeInfoCardConverterOptions> {
  static convert(
    item: ActivityEventSubEventRuntimeDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions = {}
  ): InfoCardData {
    const mode = options.mode ?? options.event?.mode ?? 'Casual';
    const accepted = Math.max(0, Math.trunc(Number(item.membersAccepted) || 0));
    const pending = Math.max(0, Math.trunc(Number(item.membersPending) || 0));
    const max = Math.max(accepted, Math.trunc(Number(item.capacityMax) || 0));
    const capacity = max > 0 ? `${accepted} / ${max}` : `${accepted}`;
    const pendingTotal = this.pendingTotal(item);
    const dateLabel = AppUtils.dateTimeRangeLabel(item.startAt, item.endAt, item.slotTimeframe ?? 'Date unavailable');
    const location = `${item.location ?? options.event?.location ?? ''}`.trim();
    const slotLine = `${item.slotTimeframe ?? ''}`.trim();
    const runtimeIcon = mode === 'Tournament' ? 'emoji_events' : 'event_note';

    return {
      id: item.runtimeId,
      dateIso: item.startAt,
      groupLabel: options.groupLabel ?? null,
      title: item.name,
      mediaMode: 'title',
      mediaTone: 'neutral',
      mediaIcon: runtimeIcon,
      mediaTitle: item.name,
      mediaSubtitle: mode === 'Tournament' ? 'Tournament stage' : 'Sub event',
      metaRows: [
        dateLabel,
        ...(location ? [location] : []),
        ...(slotLine ? [slotLine] : [])
      ],
      description: item.description || 'No description',
      detailRows: [
        `Capacity ${capacity}`,
        pendingTotal > 0 ? `${pendingTotal} pending` : ''
      ].filter(Boolean),
      surfaceTone: mode === 'Tournament' ? 'stage' : 'default',
      leadingIcon: {
        icon: runtimeIcon,
        tone: 'stage'
      },
      mediaEnd: {
        variant: 'badge',
        tone: pendingTotal > 0 ? 'review' : 'neutral',
        icon: pendingTotal > 0 ? 'pending_actions' : 'groups',
        label: pendingTotal > 0 ? `${pendingTotal}` : capacity,
        ariaLabel: pendingTotal > 0 ? 'Pending items' : 'Capacity',
        interactive: false
      },
      footerChips: item.optional
        ? [{ icon: 'toggle_on', label: 'Optional' }]
        : [{ icon: 'block', label: 'Mandatory' }],
      hasMenuOptions: false,
      clickable: false
    };
  }

  static convertList(
    items: readonly ActivityEventSubEventRuntimeDTO[],
    options: EventSubeventRuntimeInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }

  convert(
    input: ActivityEventSubEventRuntimeDTO,
    options?: EventSubeventRuntimeInfoCardConverterOptions
  ): InfoCardData {
    return EventSubeventRuntimeInfoCardConverter.convert(input, options);
  }

  convertList(
    input: readonly ActivityEventSubEventRuntimeDTO[],
    options?: EventSubeventRuntimeInfoCardConverterOptions
  ): InfoCardData[] {
    return EventSubeventRuntimeInfoCardConverter.convertList(input, options);
  }

  private static pendingTotal(item: ActivityEventSubEventRuntimeDTO): number {
    return [
      item.membersPending,
      item.carsPending,
      item.accommodationPending,
      item.suppliesPending
    ].reduce((sum, value) => sum + Math.max(0, Math.trunc(Number(value) || 0)), 0);
  }
}

export const eventSubeventRuntimeInfoCardConverter = new EventSubeventRuntimeInfoCardConverter();

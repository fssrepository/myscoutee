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
  sequenceNumber?: number | null;
  sequenceTotal?: number | null;
}

export class EventSubeventRuntimeInfoCardConverter
  implements UiListConverter<ActivityEventSubEventRuntimeDTO, InfoCardData, EventSubeventRuntimeInfoCardConverterOptions> {
  static convert(
    item: ActivityEventSubEventRuntimeDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions = {}
  ): InfoCardData {
    const mode = options.mode ?? options.event?.mode ?? 'Casual';
    const accepted = Math.max(0, Math.trunc(Number(item.membersAccepted) || 0));
    const max = Math.max(accepted, Math.trunc(Number(item.capacityMax) || 0));
    const capacity = max > 0 ? `${accepted} / ${max}` : `${accepted}`;
    const dateLabel = AppUtils.dateTimeRangeLabel(item.startAt, item.endAt, item.slotTimeframe ?? 'Date unavailable');
    const location = `${item.location ?? options.event?.location ?? ''}`.trim();
    const slotLine = `${item.slotTimeframe ?? ''}`.trim();
    const isTournament = mode === 'Tournament';
    const sequenceNumber = Math.max(1, Math.trunc(Number(options.sequenceNumber) || 1));
    const sequenceTotal = Math.max(sequenceNumber, Math.trunc(Number(options.sequenceTotal) || sequenceNumber));
    const sequenceLabel = isTournament ? `Stage ${sequenceNumber}` : `Sub Event ${sequenceNumber}`;
    const status = this.definitionStatus(item);
    const runtimeIcon = isTournament ? 'emoji_events' : 'inventory_2';

    return {
      id: item.runtimeId,
      dateIso: item.startAt,
      groupLabel: options.groupLabel ?? null,
      title: item.name,
      mediaMode: 'title',
      mediaTone: 'neutral',
      mediaIcon: runtimeIcon,
      mediaTitle: sequenceLabel,
      mediaSubtitle: mode,
      metaRows: [
        dateLabel,
        ...(location ? [location] : []),
        ...(slotLine ? [slotLine] : [])
      ],
      description: item.description || 'No description',
      detailRows: [
        `Capacity ${capacity}`
      ].filter(Boolean),
      surfaceTone: isTournament ? 'stage' : 'draft',
      accentHue: isTournament ? this.stageAccentHue(sequenceNumber, sequenceTotal) : null,
      leadingIcon: {
        icon: isTournament ? 'emoji_events' : status.icon,
        tone: isTournament ? 'stage' : status.leadingTone
      },
      mediaStart: {
        variant: 'avatar',
        tone: 'default',
        icon: 'location_on',
        interactive: false
      },
      mediaEnd: {
        variant: 'badge',
        layout: isTournament ? 'default' : 'badge-with-leading-accessory',
        tone: isTournament ? 'stage' : status.overlayTone,
        label: isTournament ? sequenceLabel : status.label,
        icon: isTournament ? 'emoji_events' : undefined,
        interactive: false,
        leadingAccessory: isTournament ? null : {
          icon: status.icon,
          tone: status.accessoryTone
        }
      },
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

  private static definitionStatus(item: ActivityEventSubEventRuntimeDTO): {
    label: string;
    icon: string;
    overlayTone: 'public' | 'blocked';
    leadingTone: 'public' | 'invitation';
    accessoryTone: 'positive' | 'negative';
  } {
    if (item.optional) {
      return {
        label: 'Optional',
        icon: 'toggle_on',
        overlayTone: 'public',
        leadingTone: 'public',
        accessoryTone: 'positive'
      };
    }
    return {
      label: 'Mandatory',
      icon: 'block',
      overlayTone: 'blocked',
      leadingTone: 'invitation',
      accessoryTone: 'negative'
    };
  }

  private static stageAccentHue(stageNumber: number, totalStages: number): number {
    if (totalStages <= 1) {
      return 210;
    }
    const ratio = AppUtils.clampNumber((stageNumber - 1) / (totalStages - 1), 0, 1);
    return Math.round(210 - (210 * ratio));
  }
}

export const eventSubeventRuntimeInfoCardConverter = new EventSubeventRuntimeInfoCardConverter();

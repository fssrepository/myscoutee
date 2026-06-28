import { AppUtils } from '../../app-utils';
import type {
  ActivityEventDetailDTO,
  ActivityEventSubEventRuntimeDTO
} from '../../core/contracts/activity.interface';
import type { EventMode, TournamentStageStatus } from '../../core/contracts/event.interface';
import type { InfoCardData, InfoCardOverlayAction, InfoCardOverlayTone } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface EventSubeventRuntimeInfoCardConverterOptions {
  event?: ActivityEventDetailDTO | null;
  mode?: EventMode | null;
  groupLabel?: string | null;
  sequenceNumber?: number | null;
  sequenceTotal?: number | null;
  isStageActive?: boolean | null;
  isStageScheduled?: boolean | null;
  isStageBlocked?: boolean | null;
  hasMenuOptions?: boolean;
  menuBadgeCount?: number | null;
  menuTitle?: string | null;
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
    const stageStatus = isTournament
      ? this.stageStatusBadge(item, {
          isStageActive: options.isStageActive === true,
          isStageScheduled: options.isStageScheduled === true,
          isStageBlocked: options.isStageBlocked === true
        })
      : null;
    const runtimeIcon = isTournament ? 'emoji_events' : 'inventory_2';
    const menuBadgeCount = Math.max(0, Math.trunc(Number(options.menuBadgeCount) || 0));

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
      descriptionLines: 2,
      description: item.description || 'No description',
      detailRows: [
        `Capacity ${capacity}`
      ].filter(Boolean),
      surfaceTone: isTournament ? 'stage-runtime' : 'draft',
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
      mediaEnd: isTournament ? stageStatus : {
        variant: 'badge',
        layout: 'badge-with-leading-accessory',
        tone: status.overlayTone,
        label: status.label,
        interactive: false,
        leadingAccessory: {
          icon: status.icon,
          tone: status.accessoryTone
        }
      },
      hasMenuOptions: options.hasMenuOptions === true,
      menuTitle: options.menuTitle ?? item.name,
      menuBadgeCount: menuBadgeCount > 0 ? menuBadgeCount : null,
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

  private static stageStatusBadge(
    item: ActivityEventSubEventRuntimeDTO,
    options: {
      isStageActive: boolean;
      isStageScheduled: boolean;
      isStageBlocked: boolean;
    }
  ): InfoCardOverlayAction | null {
    const status = this.resolveStageStatus(item.stageStatus);
    if (options.isStageBlocked) {
      return {
        variant: 'badge',
        tone: 'stage-blocked',
        label: 'stage.status.blocked',
        icon: 'lock',
        interactive: false
      };
    }
    if (options.isStageScheduled) {
      return {
        variant: 'badge',
        tone: 'stage-scheduled',
        label: 'stage.status.scheduled',
        icon: 'schedule',
        interactive: false
      };
    }
    if (status === 'A' && !options.isStageActive) {
      return null;
    }
    const map: Record<TournamentStageStatus, {
      label: string;
      icon: string;
      tone: Extract<InfoCardOverlayTone, 'stage-active' | 'stage-start' | 'stage-review' | 'stage-finalized' | 'stage-suspended'>;
    }> = {
      A: {
        label: 'active',
        icon: 'play_circle',
        tone: 'stage-active'
      },
      RS: {
        label: 'stage.status.review.to.start',
        icon: 'pending_actions',
        tone: 'stage-start'
      },
      SR: {
        label: 'under.review',
        icon: 'rate_review',
        tone: 'stage-review'
      },
      F: {
        label: 'stage.status.finalized',
        icon: 'verified',
        tone: 'stage-finalized'
      },
      S: {
        label: 'stage.status.suspended',
        icon: 'pause_circle',
        tone: 'stage-suspended'
      }
    };
    const config = map[status];
    return {
      variant: 'badge',
      tone: config.tone,
      label: config.label,
      icon: config.icon,
      interactive: false
    };
  }

  private static resolveStageStatus(status: string | null | undefined): TournamentStageStatus {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    if (normalized === 'RS' || normalized === 'SR' || normalized === 'F' || normalized === 'S') {
      return normalized;
    }
    return 'A';
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

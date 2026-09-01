import { AppUtils } from '../../app-utils';
import type { EventMode, SubEventDTO, TournamentStageStatus } from '../../core/contracts/event.interface';
import type { InfoCardData, InfoCardOverlayAction, InfoCardOverlayTone } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';
import { EventSubeventRuntimeMenuConverter } from './event-subevent-runtime-menu.converter';

export interface EventSubeventRuntimeInfoCardConverterOptions {
  event?: { location?: string | null; mode?: EventMode | null } | null;
  mode?: EventMode | null;
  cardId?: string | null;
  slotTimeframe?: string | null;
  groupLabel?: string | null;
  sequenceNumber?: number | null;
  sequenceTotal?: number | null;
  nowMs?: number;
  hasMenuOptions?: boolean;
  menuBadgeCount?: number | null;
  menuTitle?: string | null;
  translateParams?: (
    key: string,
    values: Record<string, string | number>,
    fallback: string
  ) => string;
}

export class EventSubeventRuntimeInfoCardConverter
  implements UiListConverter<SubEventDTO, InfoCardData, EventSubeventRuntimeInfoCardConverterOptions> {
  static convert(
    item: SubEventDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions = {}
  ): InfoCardData {
    const mode = this.resolveMode(item, options);
    const slotTimeframe = `${options.slotTimeframe ?? ''}`.trim();
    const dateLabel = AppUtils.dateTimeRangeLabel(item.startAt, item.endAt, slotTimeframe || 'Date unavailable');
    const location = `${item.location ?? options.event?.location ?? ''}`.trim();
    const isMainEvent = this.isMainEventRuntime(item);
    const isTournament = mode === 'Tournament';
    const sequenceNumber = Math.max(1, Math.trunc(Number(options.sequenceNumber) || 1));
    const sequenceTotal = Math.max(sequenceNumber, Math.trunc(Number(options.sequenceTotal) || sequenceNumber));
    const sequenceLabel = isMainEvent
      ? 'Event'
      : isTournament
        ? `Stage ${sequenceNumber}`
        : `Sub Event ${sequenceNumber}`;
    const status = this.definitionStatus(item);
    const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
    const stageStatus = isTournament
      ? this.stageStatusBadge(item, nowMs)
      : null;
    const runtimeIcon = isMainEvent ? 'event' : isTournament ? 'emoji_events' : 'inventory_2';
    const menuBadgeCount = options.menuBadgeCount == null
      ? EventSubeventRuntimeMenuConverter.runtimeBadgeCount(item, {
          event: options.event,
          mode
        })
      : Math.max(0, Math.trunc(Number(options.menuBadgeCount) || 0));
    const capacityDetailRow = this.capacityDetailRow(item, mode, options);

    return {
      id: `${options.cardId ?? item.id ?? ''}`.trim(),
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
        ...(capacityDetailRow ? [capacityDetailRow] : [])
      ],
      descriptionLines: 2,
      description: item.description || 'No description',
      detailRows: [],
      surfaceTone: isTournament ? 'stage-runtime' : 'draft',
      accentHue: isTournament ? AppUtils.tournamentStageAccentHue(sequenceNumber, sequenceTotal) : null,
      leadingIcon: {
        icon: isMainEvent ? 'event' : isTournament ? 'emoji_events' : status.icon,
        tone: isTournament ? 'stage' : isMainEvent ? 'public' : status.leadingTone
      },
      mediaStart: {
        variant: 'avatar',
        tone: 'default',
        icon: 'location_on',
        interactive: false
      },
      mediaEnd: isTournament ? stageStatus : isMainEvent ? {
        variant: 'badge',
        tone: 'public',
        label: 'Event',
        icon: 'event',
        interactive: false
      } : {
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
    items: readonly SubEventDTO[],
    options: EventSubeventRuntimeInfoCardConverterOptions = {}
  ): InfoCardData[] {
    return items.map(item => this.convert(item, options));
  }

  convert(
    input: SubEventDTO,
    options?: EventSubeventRuntimeInfoCardConverterOptions
  ): InfoCardData {
    return EventSubeventRuntimeInfoCardConverter.convert(input, options);
  }

  convertList(
    input: readonly SubEventDTO[],
    options?: EventSubeventRuntimeInfoCardConverterOptions
  ): InfoCardData[] {
    return EventSubeventRuntimeInfoCardConverter.convertList(input, options);
  }

  private static definitionStatus(item: SubEventDTO): {
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

  private static resolveMode(
    item: SubEventDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions
  ): EventMode {
    const requestedMode = options.mode ?? options.event?.mode ?? null;
    if (requestedMode === 'Casual' || requestedMode === 'Tournament') {
      return requestedMode;
    }
    return this.isTournamentStage(item) ? 'Tournament' : 'Casual';
  }

  private static isTournamentStage(item: SubEventDTO): boolean {
    return item.tournamentLeaderboardType === 'Score'
      || item.tournamentLeaderboardType === 'Fifa'
      || this.nonNegativeInteger(item.tournamentGroupCapacityMin) > 0
      || this.nonNegativeInteger(item.tournamentGroupCapacityMax) > 0
      || this.hasStageStatus(item.stageStatus);
  }

  private static hasStageStatus(status: string | null | undefined): boolean {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    return normalized === 'A'
      || normalized === 'RS'
      || normalized === 'SR'
      || normalized === 'F'
      || normalized === 'S';
  }

  private static capacityDetailRow(
    item: SubEventDTO,
    mode: EventMode,
    options: EventSubeventRuntimeInfoCardConverterOptions
  ): string | null {
    if (mode === 'Tournament') {
      return this.tournamentGroupCapacitySummary(item, options);
    }
    if (!item.optional && !this.isMainEventRuntime(item)) {
      return null;
    }
    const accepted = Math.max(0, this.nonNegativeInteger(item.membersAccepted));
    const max = Math.max(accepted, this.nonNegativeInteger(item.capacityMax));
    return max > 0 || accepted > 0 ? `Capacity ${max > 0 ? `${accepted} / ${max}` : `${accepted}`}` : null;
  }

  private static tournamentGroupCapacitySummary(
    item: SubEventDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions
  ): string | null {
    const groups = this.nonNegativeInteger(item.groupsCount);
    const configuredMin = this.nonNegativeInteger(item.tournamentGroupCapacityMin);
    const configuredMax = Math.max(configuredMin, this.nonNegativeInteger(item.tournamentGroupCapacityMax));
    if (groups <= 0 || (configuredMin <= 0 && configuredMax <= 0)) {
      return null;
    }
    const fallback = `Groups: ${groups} × ${configuredMin}–${configuredMax} members`;
    return options.translateParams?.(
      'event.subevents.stage.groups.capacity.summary',
      { groups, min: configuredMin, max: configuredMax },
      fallback
    ) ?? fallback;
  }

  private static nonNegativeInteger(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private static isMainEventRuntime(item: SubEventDTO | null | undefined): boolean {
    return `${item?.runtimeKind ?? ''}`.trim().toUpperCase() === 'MAIN_EVENT';
  }

  private static stageStatusBadge(
    item: SubEventDTO,
    nowMs: number
  ): InfoCardOverlayAction | null {
    const rawStatus = this.rawStageStatus(item.stageStatus);
    const status = this.resolveStageStatus(item.stageStatus);
    if (this.isStageBlockedBySchedule(item, rawStatus, nowMs)) {
      return {
        variant: 'badge',
        tone: 'stage-blocked',
        label: 'stage.status.blocked',
        icon: 'lock',
        interactive: false
      };
    }
    if (this.isStageScheduledBySchedule(item, rawStatus, nowMs)) {
      return {
        variant: 'badge',
        tone: 'stage-scheduled',
        label: 'stage.status.scheduled',
        icon: 'schedule',
        interactive: false
      };
    }
    if (status === 'A' && !this.isStageActiveBySchedule(item, rawStatus, nowMs)) {
      return null;
    }
    const scoreReviewStatus = this.scoreReviewStatusBadge(item);
    const map: Record<TournamentStageStatus, {
      label: string;
      icon: string;
      tone: Extract<InfoCardOverlayTone, 'stage-active' | 'stage-scheduled' | 'stage-start' | 'stage-review' | 'stage-finalized' | 'stage-suspended'>;
    }> = {
      A: {
        label: 'stage.status.started',
        icon: 'play_circle',
        tone: 'stage-active'
      },
      RS: {
        label: 'stage.status.scheduled',
        icon: 'schedule',
        tone: 'stage-scheduled'
      },
      SR: {
        label: scoreReviewStatus.label,
        icon: scoreReviewStatus.icon,
        tone: scoreReviewStatus.tone
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

  private static scoreReviewStatusBadge(item: SubEventDTO): {
    label: string;
    icon: string;
    tone: Extract<InfoCardOverlayTone, 'stage-start' | 'stage-review'>;
  } {
    const reason = `${item.stageStatusReason ?? ''}`.trim();
    if (reason === 'scores-reopened') {
      return {
        label: 'stage.status.scores.review',
        icon: 'edit_note',
        tone: 'stage-start'
      };
    }
    return {
      label: 'stage.status.closed',
      icon: 'rate_review',
      tone: 'stage-review'
    };
  }

  private static isStageActiveBySchedule(item: SubEventDTO, rawStatus: string, nowMs: number): boolean {
    if (rawStatus !== 'A') {
      return false;
    }
    const startMs = this.dateMs(item.startAt);
    return !Number.isFinite(startMs) || startMs <= nowMs;
  }

  private static isStageScheduledBySchedule(item: SubEventDTO, rawStatus: string, nowMs: number): boolean {
    if (rawStatus !== 'A' && rawStatus !== 'RS') {
      return false;
    }
    const startMs = this.dateMs(item.startAt);
    return Number.isFinite(startMs) && startMs > nowMs;
  }

  private static isStageBlockedBySchedule(item: SubEventDTO, rawStatus: string, nowMs: number): boolean {
    if (rawStatus === 'RS') {
      return this.hasDatePassed(item.startAt, nowMs) || this.hasDatePassed(item.endAt, nowMs);
    }
    return rawStatus === 'A' && this.hasDatePassed(item.endAt, nowMs);
  }

  private static hasDatePassed(value: string | null | undefined, nowMs: number): boolean {
    const parsed = this.dateMs(value);
    return Number.isFinite(parsed) && parsed <= nowMs;
  }

  private static dateMs(value: string | null | undefined): number {
    return Date.parse(`${value ?? ''}`);
  }

  private static rawStageStatus(status: string | null | undefined): string {
    return `${status ?? ''}`.trim().toUpperCase();
  }

  private static resolveStageStatus(status: string | null | undefined): TournamentStageStatus {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    if (normalized === 'RS' || normalized === 'SR' || normalized === 'F' || normalized === 'S') {
      return normalized;
    }
    return 'A';
  }

}

export const eventSubeventRuntimeInfoCardConverter = new EventSubeventRuntimeInfoCardConverter();

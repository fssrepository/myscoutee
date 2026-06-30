import { AppUtils } from '../../app-utils';
import type { EventMode, SubEventDTO, TournamentStageStatus } from '../../core/contracts/event.interface';
import type { InfoCardData, InfoCardOverlayAction, InfoCardOverlayTone } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface EventSubeventRuntimeInfoCardConverterOptions {
  event?: { location?: string | null; mode?: EventMode | null } | null;
  mode?: EventMode | null;
  cardId?: string | null;
  slotTimeframe?: string | null;
  groupLabel?: string | null;
  sequenceNumber?: number | null;
  sequenceTotal?: number | null;
  subEventIndex?: number | null;
  siblingItems?: readonly SubEventDTO[];
  nowMs?: number | null;
  hasMenuOptions?: boolean;
  menuBadgeCount?: number | null;
  menuTitle?: string | null;
}

export class EventSubeventRuntimeInfoCardConverter
  implements UiListConverter<SubEventDTO, InfoCardData, EventSubeventRuntimeInfoCardConverterOptions> {
  static convert(
    item: SubEventDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions = {}
  ): InfoCardData {
    const mode = this.resolveMode(item, options);
    const accepted = Math.max(0, Math.trunc(Number(item.membersAccepted) || 0));
    const max = Math.max(accepted, Math.trunc(Number(item.capacityMax) || 0));
    const capacity = max > 0 ? `${accepted} / ${max}` : `${accepted}`;
    const slotTimeframe = `${options.slotTimeframe ?? ''}`.trim();
    const dateLabel = AppUtils.dateTimeRangeLabel(item.startAt, item.endAt, slotTimeframe || 'Date unavailable');
    const location = `${item.location ?? options.event?.location ?? ''}`.trim();
    const isTournament = mode === 'Tournament';
    const sequenceNumber = Math.max(1, Math.trunc(Number(options.sequenceNumber) || 1));
    const sequenceTotal = Math.max(sequenceNumber, Math.trunc(Number(options.sequenceTotal) || sequenceNumber));
    const sequenceLabel = isTournament ? `Stage ${sequenceNumber}` : `Sub Event ${sequenceNumber}`;
    const status = this.definitionStatus(item);
    const stageStatus = isTournament
      ? this.stageStatusBadge(this.stageRuntimeState(item, options))
      : null;
    const runtimeIcon = isTournament ? 'emoji_events' : 'inventory_2';
    const menuBadgeCount = Math.max(0, Math.trunc(Number(options.menuBadgeCount) || 0));

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
        ...(location ? [location] : [])
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
    return requestedMode === 'Tournament' || this.isTournamentStage(item)
      ? 'Tournament'
      : 'Casual';
  }

  private static isTournamentStage(item: SubEventDTO): boolean {
    return (item.groups?.length ?? 0) > 0
      || (Number(item.tournamentGroupCount) || 0) > 0
      || item.tournamentLeaderboardType === 'Score'
      || item.tournamentLeaderboardType === 'Fifa'
      || this.hasStageStatus(item.stageStatus);
  }

  private static hasStageStatus(status: string | null | undefined): boolean {
    const normalized = `${status ?? ''}`.trim().toUpperCase();
    return normalized === 'A'
      || normalized === 'RS'
      || normalized === 'SR'
      || normalized === 'F'
      || normalized === 'S'
      || normalized === 'E';
  }

  private static stageRuntimeState(
    item: SubEventDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions
  ): {
    status: TournamentStageStatus;
    badge: 'scheduled' | 'started' | 'blocked' | 'error' | 'review-to-start' | 'closed' | 'finalized' | 'suspended';
  } {
    const status = this.resolveStageStatus(item.stageStatus);
    const now = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
    if (status === 'E') {
      return { status, badge: 'error' };
    }
    if (this.hasBlockingPreviousStage(item, options, now)) {
      return { status, badge: 'blocked' };
    }
    return this.stageRuntimeStateForItem(item, now);
  }

  private static stageRuntimeStateForItem(
    item: SubEventDTO,
    now: number
  ): {
    status: TournamentStageStatus;
    badge: 'scheduled' | 'started' | 'blocked' | 'error' | 'review-to-start' | 'closed' | 'finalized' | 'suspended';
  } {
    const status = this.resolveStageStatus(item.stageStatus);
    const startMs = Date.parse(`${item.startAt ?? ''}`);
    const endMs = Date.parse(`${item.endAt ?? ''}`);
    const runtimeTouched = `${item.stageStatusUpdatedAt ?? ''}`.trim() !== ''
      || `${item.stageFinalizedAt ?? ''}`.trim() !== '';

    if (status === 'E') {
      return { status, badge: 'error' };
    }
    if (status === 'F') {
      return { status, badge: 'finalized' };
    }
    if (status === 'S') {
      return { status, badge: 'suspended' };
    }
    if (status === 'SR') {
      return { status, badge: 'closed' };
    }
    if (status === 'RS') {
      return Number.isFinite(startMs) && startMs <= now
        ? { status, badge: 'blocked' }
        : { status, badge: 'scheduled' };
    }
    if (Number.isFinite(startMs) && startMs > now) {
      return { status, badge: 'scheduled' };
    }
    if (!runtimeTouched) {
      return { status, badge: 'blocked' };
    }
    if (Number.isFinite(endMs) && endMs <= now) {
      return { status, badge: 'blocked' };
    }
    return { status, badge: 'started' };
  }

  private static hasBlockingPreviousStage(
    item: SubEventDTO,
    options: EventSubeventRuntimeInfoCardConverterOptions,
    now: number
  ): boolean {
    const siblings = options.siblingItems ?? [];
    if (siblings.length <= 1) {
      return false;
    }
    const requestedIndex = Math.trunc(Number(options.subEventIndex));
    const matchedIndex = siblings.findIndex(candidate => candidate === item);
    const itemId = `${item.id ?? ''}`.trim();
    const idIndex = itemId
      ? siblings.findIndex(candidate => `${candidate.id ?? ''}`.trim() === itemId)
      : -1;
    const index = matchedIndex >= 0
      ? matchedIndex
      : idIndex >= 0
        ? idIndex
        : Number.isFinite(requestedIndex)
          ? requestedIndex
          : -1;
    if (index <= 0) {
      return false;
    }
    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previousState = this.stageRuntimeStateForItem(siblings[previousIndex], now);
      if (previousState.badge === 'blocked' || previousState.badge === 'error') {
        return true;
      }
    }
    return false;
  }

  private static stageStatusBadge(
    state: {
      status: TournamentStageStatus;
      badge: 'scheduled' | 'started' | 'blocked' | 'error' | 'review-to-start' | 'closed' | 'finalized' | 'suspended';
    }
  ): InfoCardOverlayAction | null {
    if (state.badge === 'error') {
      return {
        variant: 'badge',
        tone: 'stage-error',
        label: 'stage.status.error',
        icon: 'error',
        interactive: false
      };
    }
    if (state.badge === 'blocked') {
      return {
        variant: 'badge',
        tone: 'stage-blocked',
        label: 'stage.status.blocked',
        icon: 'lock',
        interactive: false
      };
    }
    if (state.badge === 'scheduled') {
      return {
        variant: 'badge',
        tone: 'stage-scheduled',
        label: 'stage.status.scheduled',
        icon: 'schedule',
        interactive: false
      };
    }
    const map: Record<TournamentStageStatus, {
      label: string;
      icon: string;
      tone: Extract<InfoCardOverlayTone, 'stage-active' | 'stage-start' | 'stage-review' | 'stage-finalized' | 'stage-suspended' | 'stage-error'>;
    }> = {
      A: {
        label: 'stage.status.started',
        icon: 'play_circle',
        tone: 'stage-active'
      },
      RS: {
        label: 'stage.status.review.to.start',
        icon: 'pending_actions',
        tone: 'stage-start'
      },
      SR: {
        label: 'stage.status.closed',
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
      },
      E: {
        label: 'stage.status.error',
        icon: 'error',
        tone: 'stage-error'
      }
    };
    const config = map[state.status];
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
    if (normalized === 'RS' || normalized === 'SR' || normalized === 'F' || normalized === 'S' || normalized === 'E') {
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

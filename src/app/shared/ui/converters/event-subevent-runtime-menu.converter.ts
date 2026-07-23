import { APP_STATIC_DATA } from '../../app-static-data';
import * as AppConstants from '../../core/common/constants';
import type { SubEventResourceFilter } from '../../core/common/constants';
import type { EventMode, SubEventDTO, TournamentStageStatus } from '../../core/contracts/event.interface';
import type { AppMenuItem, AppMenuPalette } from '../components/core/menu';

export type EventSubeventRuntimeStageAction =
  | 'start-tournament'
  | 'close-stage'
  | 'finalize-stage'
  | 'reopen-scores'
  | 'suspend-tournament'
  | 'resume-tournament';

export type EventSubeventRuntimeMenuItemId =
  | EventSubeventRuntimeStageAction
  | 'groups'
  | 'members'
  | 'transport'
  | 'accommodation'
  | 'supplies'
  | 'runtime-divider'
  | 'runtime-section';

export type EventSubeventRuntimeMenuContext =
  | {
      scope: 'stage-status';
      action: EventSubeventRuntimeStageAction;
      item: SubEventDTO;
      parentEventId: string;
      slotId: string | null;
      sourceId: string;
      subEventId: string | null;
      subEventIndex: number;
      nextStatus: TournamentStageStatus;
      reason: string;
      title: string;
      description: string;
      confirmLabel: string;
      busyLabel: string;
      destructive: boolean;
      confirmPalette: AppMenuPalette;
    }
  | {
      scope: 'stage-dashboard';
      action: 'groups';
      item: SubEventDTO;
      parentEventId: string;
      slotId: string | null;
      sourceId: string;
      subEventIndex: number;
    }
  | {
      scope: 'resource';
      resourceType: SubEventResourceFilter;
      item: SubEventDTO;
      sourceId: string;
      subEventIndex: number;
    };

export interface EventSubeventRuntimeMenuConverterOptions {
  event?: { id?: string | null; mode?: EventMode | null } | null;
  mode?: EventMode | null;
  canManageTournament?: boolean;
  parentEventId?: string | null;
  slotId?: string | null;
  sourceId?: string | null;
  subEventIndex?: number | null;
  stageNumber?: number | null;
  siblingItems?: readonly SubEventDTO[];
  nowMs?: number;
}

export class EventSubeventRuntimeMenuConverter {
  static convert(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions = {}
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const mode = this.resolveMode(item, options);
    return mode === 'Tournament'
      ? this.tournamentItems(item, options)
      : this.casualItems(item, options);
  }

  static pendingBadgeCount(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions = {}
  ): number {
    const mode = this.resolveMode(item, options);
    if (mode === 'Tournament') {
      return Math.max(0, this.toInteger(item.membersPending));
    }
    return [
      item.optional === true ? item.membersPending : 0,
      item.carsPending,
      item.accommodationPending,
      item.suppliesPending
    ].reduce((sum, value) => sum + Math.max(0, this.toInteger(value)), 0);
  }

  private static tournamentItems(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const items: AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] = [];
    const sourceId = `${options.sourceId ?? options.event?.id ?? ''}`.trim();
    const parentEventId = `${options.parentEventId ?? options.event?.id ?? sourceId}`.trim();
    const slotId = `${options.slotId ?? ''}`.trim() || null;
    const subEventId = `${item.id ?? ''}`.trim() || null;
    const subEventIndex = Math.max(0, this.toInteger(options.subEventIndex));
    const stageNumber = Math.max(1, this.toInteger(options.stageNumber) || subEventIndex + 1);

    if (options.canManageTournament && sourceId) {
      items.push(...this.stageStatusItems(item, {
        parentEventId,
        slotId,
        sourceId,
        subEventId,
        subEventIndex,
        stageNumber,
        siblings: options.siblingItems ?? [],
        nowMs: Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now()
      }));
    }

    if (items.length > 0) {
      items.push({
        id: 'runtime-divider',
        kind: 'divider',
        disabled: true
      });
    }

    items.push({
      id: 'groups',
      label: 'Groups',
      icon: 'groups',
      palette: 'green',
      surface: 'tinted',
      layout: 'pill',
      counter: this.groupCount(item) > 0 ? { value: this.groupCount(item), max: 99 } : null,
      context: {
        scope: 'stage-dashboard',
        action: 'groups',
        item,
        parentEventId,
        slotId,
        sourceId,
        subEventIndex
      }
    });
    return items;
  }

  private static stageStatusItems(
    item: SubEventDTO,
    options: {
      parentEventId: string;
      slotId: string | null;
      sourceId: string;
      subEventId: string | null;
      subEventIndex: number;
      stageNumber: number;
      siblings: readonly SubEventDTO[];
      nowMs: number;
    }
  ): AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const status = this.stageStatus(item);
    const isErrorStatus = this.rawStageStatus(item.stageStatus) === 'E';
    const isStageStartPassed = this.hasDatePassed(item.startAt, options.nowMs);
    const isStageEnded = this.hasDatePassed(item.endAt, options.nowMs);
    const isStageWindowOpen = this.isStageInScheduleWindow(item, options.nowMs);
    const actions: AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] = [];
    const stageLabel = `${item.name ?? `Stage ${options.stageNumber}`}`.trim() || `Stage ${options.stageNumber}`;
    const base = {
      item,
      parentEventId: options.parentEventId,
      slotId: options.slotId,
      sourceId: options.sourceId,
      subEventId: options.subEventId,
      subEventIndex: options.subEventIndex
    };

    if (status === 'RS' && !isErrorStatus && isStageStartPassed) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'start-tournament',
        label: 'Start Stage',
        icon: 'play_circle',
        palette: 'success',
        nextStatus: 'A',
        reason: 'tournament-started',
        title: 'Start Stage',
        description: `Start ${stageLabel}? This locks admission and assigns first-stage rooms.`,
        confirmLabel: 'Start',
        busyLabel: 'Starting...',
        destructive: false
      }));
    }
    if (((status === 'RS' && !isErrorStatus) || status === 'A') && isStageEnded) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'close-stage',
        label: 'Close Stage',
        icon: 'rate_review',
        palette: 'blue',
        nextStatus: 'SR',
        reason: 'stage-closed',
        title: 'Close Stage',
        description: `Close ${stageLabel} and move it under score review?`,
        confirmLabel: 'Close Stage',
        busyLabel: 'Closing...',
        destructive: false
      }));
    }
    if (status === 'SR') {
      actions.push(this.stageActionItem({
        ...base,
        action: 'finalize-stage',
        label: 'Finalize Stage',
        icon: 'verified',
        palette: 'success',
        nextStatus: 'F',
        reason: 'stage-finalized',
        title: 'Finalize Stage',
        description: `Finalize ${stageLabel}?`,
        confirmLabel: 'Finalize',
        busyLabel: 'Finalizing...',
        destructive: false
      }));
    }
    if (this.canReopenScores(item)) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'reopen-scores',
        label: 'Reopen Scores',
        icon: 'edit_note',
        palette: 'amber',
        nextStatus: 'SR',
        reason: 'scores-reopened',
        title: 'Reopen Scores',
        description: `Reopen scores for ${stageLabel}?`,
        confirmLabel: 'Reopen',
        busyLabel: 'Reopening...',
        destructive: false
      }));
    }
    if (status === 'A' && isStageWindowOpen) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'suspend-tournament',
        label: 'Suspend Stage',
        icon: 'pause_circle',
        palette: 'warning',
        nextStatus: 'S',
        reason: 'manual-suspension',
        title: 'Suspend Stage',
        description: `Suspend ${stageLabel}?`,
        confirmLabel: 'Suspend',
        busyLabel: 'Suspending...',
        destructive: true
      }));
    }
    if (status === 'S') {
      const resumeNextStatus: TournamentStageStatus = this.hasDatePassed(item.endAt, options.nowMs)
        ? 'SR'
        : 'A';
      actions.push(this.stageActionItem({
        ...base,
        action: 'resume-tournament',
        label: 'Resume Stage',
        icon: 'play_circle',
        palette: 'blue',
        nextStatus: resumeNextStatus,
        reason: 'manual-resume',
        title: 'Resume Stage',
        description: `Resume ${stageLabel}?`,
        confirmLabel: 'Resume',
        busyLabel: 'Resuming...',
        destructive: false
      }));
    }
    return actions;
  }

  private static resolveMode(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions
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
      || Math.max(0, this.toInteger(item.tournamentGroupCapacityMin)) > 0
      || Math.max(0, this.toInteger(item.tournamentGroupCapacityMax)) > 0
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

  private static casualItems(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const items: AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] = [];
    const sourceId = `${options.sourceId ?? options.event?.id ?? ''}`.trim();
    const subEventIndex = Math.max(0, this.toInteger(options.subEventIndex));
    if (item.optional === true) {
      items.push(this.resourceItem('members', 'Members', 'Members', item, this.membersLabel(item), item.membersPending, sourceId, subEventIndex));
    }
    if (items.length > 0) {
      items.push({
        id: 'runtime-divider',
        kind: 'divider',
        disabled: true
      });
    }
    items.push(
      {
        id: 'runtime-section',
        kind: 'section',
        label: 'Tools',
        disabled: true
      },
      this.resourceItem('transport', APP_STATIC_DATA.assetTypeLabels[AppConstants.ASSET_TYPE_TRANSPORT], AppConstants.ASSET_TYPE_TRANSPORT, item, this.assetLabel(item, AppConstants.ASSET_TYPE_TRANSPORT), item.carsPending, sourceId, subEventIndex),
      this.resourceItem('accommodation', APP_STATIC_DATA.assetTypeLabels[AppConstants.ASSET_TYPE_ACCOMMODATION], AppConstants.ASSET_TYPE_ACCOMMODATION, item, this.assetLabel(item, AppConstants.ASSET_TYPE_ACCOMMODATION), item.accommodationPending, sourceId, subEventIndex),
      this.resourceItem('supplies', APP_STATIC_DATA.assetTypeLabels[AppConstants.ASSET_TYPE_SUPPLIES], AppConstants.ASSET_TYPE_SUPPLIES, item, this.assetLabel(item, AppConstants.ASSET_TYPE_SUPPLIES), item.suppliesPending, sourceId, subEventIndex)
    );
    return items;
  }

  private static stageActionItem(options: {
    item: SubEventDTO;
    parentEventId: string;
    slotId: string | null;
    sourceId: string;
    subEventId: string | null;
    subEventIndex: number;
    action: EventSubeventRuntimeStageAction;
    label: string;
    icon: string;
    palette: AppMenuPalette;
    nextStatus: TournamentStageStatus;
    reason: string;
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    destructive: boolean;
  }): AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext> {
    return {
      id: options.action,
      label: options.label,
      icon: options.icon,
      palette: options.palette,
      surface: 'tinted',
      layout: 'pill',
      context: {
        scope: 'stage-status',
        action: options.action,
        item: options.item,
        parentEventId: options.parentEventId,
        slotId: options.slotId,
        sourceId: options.sourceId,
        subEventId: options.subEventId,
        subEventIndex: options.subEventIndex,
        nextStatus: options.nextStatus,
        reason: options.reason,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel,
        busyLabel: options.busyLabel,
        destructive: options.destructive,
        confirmPalette: options.palette
      }
    };
  }

  private static resourceItem(
    id: 'members' | 'transport' | 'accommodation' | 'supplies',
    label: string,
    resourceType: SubEventResourceFilter,
    item: SubEventDTO,
    description: string,
    pendingRaw: unknown,
    sourceId: string,
    subEventIndex: number
  ): AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext> {
    const pending = Math.max(0, this.toInteger(pendingRaw));
    return {
      id,
      label,
      description,
      icon: this.resourceIcon(resourceType),
      palette: this.resourcePalette(resourceType),
      surface: 'tinted',
      layout: 'pill',
      counter: pending > 0 ? { value: pending, max: 99 } : null,
      context: {
        scope: 'resource',
        resourceType,
        item,
        sourceId,
        subEventIndex
      }
    };
  }

  private static canReopenScores(item: SubEventDTO): boolean {
    return this.stageStatus(item) === 'F';
  }

  private static isStageInScheduleWindow(item: SubEventDTO, nowMs: number): boolean {
    const startMs = Date.parse(`${item.startAt ?? ''}`);
    const endMs = Date.parse(`${item.endAt ?? ''}`);
    return Number.isFinite(startMs)
      && Number.isFinite(endMs)
      && startMs <= nowMs
      && nowMs <= endMs;
  }

  private static hasDatePassed(value: string | null | undefined, nowMs: number): boolean {
    const parsed = Date.parse(`${value ?? ''}`);
    return Number.isFinite(parsed) && parsed <= nowMs;
  }

  private static rawStageStatus(status: string | null | undefined): string {
    return `${status ?? ''}`.trim().toUpperCase();
  }

  private static stageStatus(item: SubEventDTO): TournamentStageStatus {
    const raw = `${item.stageStatus ?? ''}`.trim();
    if (raw === 'A' || raw === 'RS' || raw === 'SR' || raw === 'F' || raw === 'S') {
      return raw;
    }
    return 'RS';
  }

  private static groupCount(item: SubEventDTO): number {
    return Math.max(0, this.toInteger(item.groupsCount));
  }

  private static membersLabel(item: SubEventDTO): string {
    const accepted = Math.max(0, this.toInteger(item.membersAccepted));
    return this.rangeLabel(accepted, item.capacityMin, item.capacityMax);
  }

  private static assetLabel(
    item: SubEventDTO,
    type: Exclude<SubEventResourceFilter, 'Members'>
  ): string {
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return this.rangeLabel(item.carsAccepted, item.carsCapacityMin, item.carsCapacityMax);
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return this.rangeLabel(item.accommodationAccepted, item.accommodationCapacityMin, item.accommodationCapacityMax);
    }
    return this.rangeLabel(item.suppliesAccepted, item.suppliesCapacityMin, item.suppliesCapacityMax);
  }

  private static rangeLabel(acceptedRaw: unknown, minRaw: unknown, maxRaw: unknown): string {
    const accepted = Math.max(0, this.toInteger(acceptedRaw));
    const min = Math.max(0, this.toInteger(minRaw));
    const max = Math.max(min, this.toInteger(maxRaw));
    return `${accepted} / ${min} - ${max}`;
  }

  private static resourceIcon(type: SubEventResourceFilter): string {
    switch (type) {
      case 'Members':
        return 'groups';
      case AppConstants.ASSET_TYPE_TRANSPORT:
        return 'directions_car';
      case AppConstants.ASSET_TYPE_ACCOMMODATION:
        return 'apartment';
      case AppConstants.ASSET_TYPE_SUPPLIES:
        return 'inventory_2';
      default:
        return 'category';
    }
  }

  private static resourcePalette(type: SubEventResourceFilter): AppMenuPalette {
    switch (type) {
      case 'Members':
        return 'blue';
      case AppConstants.ASSET_TYPE_TRANSPORT:
        return 'sky';
      case AppConstants.ASSET_TYPE_ACCOMMODATION:
        return 'green';
      case AppConstants.ASSET_TYPE_SUPPLIES:
        return 'brown';
      default:
        return 'default';
    }
  }

  private static toInteger(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.trunc(parsed);
  }
}

export const eventSubeventRuntimeMenuConverter = new EventSubeventRuntimeMenuConverter();

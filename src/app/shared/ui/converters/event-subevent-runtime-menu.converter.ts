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
  | 'car'
  | 'accommodation'
  | 'supplies'
  | 'runtime-divider'
  | 'runtime-section';

export type EventSubeventRuntimeMenuContext =
  | {
      scope: 'stage-status';
      action: EventSubeventRuntimeStageAction;
      item: SubEventDTO;
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
  isStageActive?: boolean | null;
  canStartStage?: boolean | null;
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
      item.optional ? item.membersPending : 0,
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
        sourceId,
        subEventId,
        subEventIndex,
        stageNumber,
        isStageActive: options.isStageActive === true,
        canStartStage: options.canStartStage === true,
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
      sourceId: string;
      subEventId: string | null;
      subEventIndex: number;
      stageNumber: number;
      isStageActive: boolean;
      canStartStage: boolean;
      siblings: readonly SubEventDTO[];
      nowMs: number;
    }
  ): AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const status = this.stageStatus(item);
    const actions: AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] = [];
    const stageLabel = `${item.name ?? `Stage ${options.stageNumber}`}`.trim() || `Stage ${options.stageNumber}`;
    const base = {
      item,
      sourceId: options.sourceId,
      subEventId: options.subEventId,
      subEventIndex: options.subEventIndex
    };

    if (options.canStartStage) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'start-tournament',
        label: 'Start Tournament',
        icon: 'play_circle',
        palette: 'success',
        nextStatus: 'A',
        reason: 'tournament-started',
        title: 'Start Tournament',
        description: `Start ${stageLabel}? This locks admission and assigns first-stage rooms.`,
        confirmLabel: 'Start',
        busyLabel: 'Starting...',
        destructive: false
      }));
    }
    if (status === 'A' && options.isStageActive) {
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
    if (this.canReopenScores(item, options.siblings, options.subEventIndex, options.nowMs)) {
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
    if (status !== 'RS' && status !== 'S' && status !== 'F' && options.isStageActive) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'suspend-tournament',
        label: 'Suspend Tournament',
        icon: 'pause_circle',
        palette: 'warning',
        nextStatus: 'S',
        reason: 'manual-suspension',
        title: 'Suspend Tournament',
        description: `Suspend the tournament at ${stageLabel}?`,
        confirmLabel: 'Suspend',
        busyLabel: 'Suspending...',
        destructive: true
      }));
    }
    if (status === 'S') {
      actions.push(this.stageActionItem({
        ...base,
        action: 'resume-tournament',
        label: 'Resume Tournament',
        icon: 'play_circle',
        palette: 'blue',
        nextStatus: 'A',
        reason: 'manual-resume',
        title: 'Resume Tournament',
        description: `Resume ${stageLabel} and set it back to active?`,
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
      || normalized === 'S';
  }

  private static casualItems(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const items: AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] = [];
    const sourceId = `${options.sourceId ?? options.event?.id ?? ''}`.trim();
    const subEventIndex = Math.max(0, this.toInteger(options.subEventIndex));
    if (item.optional) {
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
      this.resourceItem('car', 'Car', 'Car', item, this.assetLabel(item, 'Car'), item.carsPending, sourceId, subEventIndex),
      this.resourceItem('accommodation', 'Accommodation', 'Accommodation', item, this.assetLabel(item, 'Accommodation'), item.accommodationPending, sourceId, subEventIndex),
      this.resourceItem('supplies', 'Supplies', 'Supplies', item, this.assetLabel(item, 'Supplies'), item.suppliesPending, sourceId, subEventIndex)
    );
    return items;
  }

  private static stageActionItem(options: {
    item: SubEventDTO;
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
    id: 'members' | 'car' | 'accommodation' | 'supplies',
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

  private static canReopenScores(
    item: SubEventDTO,
    siblings: readonly SubEventDTO[],
    subEventIndex: number,
    nowMs: number
  ): boolean {
    if (this.stageStatus(item) !== 'F') {
      return false;
    }
    const itemId = `${item.id ?? ''}`.trim();
    const matchedIndex = siblings.findIndex(candidate => candidate === item
      || (itemId && `${candidate.id ?? ''}`.trim() === itemId));
    const currentIndex = matchedIndex >= 0 ? matchedIndex : subEventIndex;
    const nextStage = currentIndex >= 0 ? siblings[currentIndex + 1] ?? null : null;
    if (!nextStage) {
      return true;
    }
    const nextStartMs = Date.parse(`${nextStage.startAt ?? ''}`);
    return this.stageStatus(nextStage) === 'A' && (!Number.isFinite(nextStartMs) || nextStartMs > nowMs);
  }

  private static stageStatus(item: SubEventDTO): TournamentStageStatus {
    const raw = `${item.stageStatus ?? ''}`.trim();
    if (raw === 'A' || raw === 'RS' || raw === 'SR' || raw === 'F' || raw === 'S') {
      return raw;
    }
    return 'RS';
  }

  private static groupCount(item: SubEventDTO): number {
    const groups = Array.isArray(item.groups) ? item.groups.length : 0;
    return groups > 0 ? groups : Math.max(0, this.toInteger(item.tournamentGroupCount));
  }

  private static membersLabel(item: SubEventDTO): string {
    const accepted = Math.max(0, this.toInteger(item.membersAccepted));
    return this.rangeLabel(accepted, item.capacityMin, item.capacityMax);
  }

  private static assetLabel(
    item: SubEventDTO,
    type: Exclude<SubEventResourceFilter, 'Members'>
  ): string {
    if (type === 'Car') {
      return this.rangeLabel(item.carsAccepted, item.carsCapacityMin, item.carsCapacityMax);
    }
    if (type === 'Accommodation') {
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
      case 'Car':
        return 'directions_car';
      case 'Accommodation':
        return 'apartment';
      case 'Supplies':
        return 'inventory_2';
      default:
        return 'category';
    }
  }

  private static resourcePalette(type: SubEventResourceFilter): AppMenuPalette {
    switch (type) {
      case 'Members':
        return 'blue';
      case 'Car':
        return 'sky';
      case 'Accommodation':
        return 'green';
      case 'Supplies':
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

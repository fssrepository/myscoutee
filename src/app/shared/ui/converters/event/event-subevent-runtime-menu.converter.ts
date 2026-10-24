interface MingleActionOptions {
      action: EventSubeventRuntimeMingleAction;
      backendAction: 'start' | 'next' | 'pause' | 'resume' | 'complete';
      label: string;
      icon: string;
      palette: AppMenuPalette;
      title: string;
      description: string;
      confirmLabel: string;
      busyLabel: string;
      destructive: boolean;
    }
import MINGLE_ACTIONS from './mingle-actions.json';
import { APP_STATIC_DATA } from '../../../core/common/app-static-data';
import * as AppConstants from '../../../core/common/constants';
import type { SubEventResourceFilter } from '../../../core/common/constants';
import type { EventMode, MingleStateDTO, SubEventDTO, TournamentStageStatus } from '../../../core/contracts/events/event.interface';
import type { AppMenuItem, AppMenuPalette } from '@fssrepository/myscoutee-components';

export type EventSubeventRuntimeStageAction =
  | 'start-tournament'
  | 'close-stage'
  | 'finalize-stage'
  | 'reopen-scores'
  | 'suspend-tournament'
  | 'resume-tournament';

export type EventSubeventRuntimeMingleAction =
  | 'mingle-start'
  | 'mingle-next'
  | 'mingle-pause'
  | 'mingle-resume'
  | 'mingle-complete';

export type EventSubeventRuntimeMenuItemId =
  | EventSubeventRuntimeStageAction
  | EventSubeventRuntimeMingleAction
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
      scope: 'mingle-runtime';
      expectedRevision: number;
      action: EventSubeventRuntimeMingleAction;
      backendAction: 'start' | 'next' | 'pause' | 'resume' | 'complete';
      item: SubEventDTO;
      parentEventId: string;
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
  mingleState?: Pick<MingleStateDTO, 'eventId' | 'status' | 'roundNumber' | 'plannedRounds' | 'canManage'> & Partial<Pick<MingleStateDTO, 'revision'>> | null;
}

export class EventSubeventRuntimeMenuConverter {
  static convert(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions = {}
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const mode = this.resolveMode(item, options);
    if (mode === 'Tournament') {
      return this.tournamentItems(item, options);
    }
    return mode === 'Mingle'
      ? this.mingleItems(item, options)
      : this.casualItems(item, options);
  }

  static runtimeBadgeCount(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions = {}
  ): number {
    const mode = this.resolveMode(item, options);
    if (mode === 'Tournament' || mode === 'Mingle') {
      return this.groupPending(item);
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
      label: 'groups.title',
      icon: 'groups',
      palette: 'green',
      surface: 'tinted',
      counter: this.groupPending(item) > 0 ? { value: this.groupPending(item), max: 99 } : null,
      counterTone: 'alert',
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

  private static mingleItems(
    item: SubEventDTO,
    options: EventSubeventRuntimeMenuConverterOptions
  ): readonly AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const sourceId = `${options.sourceId ?? options.event?.id ?? ''}`.trim();
    const parentEventId = `${options.parentEventId ?? options.event?.id ?? sourceId}`.trim();
    const subEventIndex = Math.max(0, this.toInteger(options.subEventIndex));
    const pending = this.groupPending(item);
    const items: AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] = [];
    const stageNumber = Math.max(1, this.toInteger(options.stageNumber) || subEventIndex + 1);
    if (options.canManageTournament) {
      items.push(...this.mingleRuntimeItems(item, parentEventId, stageNumber, options.mingleState));
    }
    if (items.length > 0) {
      items.push({ id: 'runtime-divider', kind: 'divider', disabled: true });
    }
    items.push({
      id: 'groups',
      label: 'mingle.action.tables',
      icon: 'table_restaurant',
      palette: 'teal',
      surface: 'tinted',
      counter: pending > 0 ? { value: pending, max: 99 } : null,
      counterTone: 'alert',
      context: {
        scope: 'stage-dashboard',
        action: 'groups',
        item,
        parentEventId,
        slotId: `${options.slotId ?? ''}`.trim() || null,
        sourceId,
        subEventIndex
      }
    });
    return items;
  }

  private static mingleRuntimeItems(item: SubEventDTO, parentEventId: string, roundNumber: number, state: EventSubeventRuntimeMenuConverterOptions['mingleState']): AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext>[] {
    const current = state?.eventId === parentEventId ? state : null;
    if (!current && roundNumber === 1) {
      return [this.mingleActionItem(item, parentEventId, 0, MINGLE_ACTIONS.start as MingleActionOptions)];
    }
    if (!current || current.canManage !== true) {
      return [];
    }
    const currentRound = Math.max(1, this.toInteger(current.roundNumber));
    if (item.runtimeKind === 'MAIN_EVENT') {
      roundNumber = currentRound + (current.status === 'BREAK' ? 1 : 0);
    }
    if (current.status === 'ROUND' && roundNumber === currentRound) {
      return [
        this.mingleActionItem(item, parentEventId, current?.revision ?? 0, MINGLE_ACTIONS.pause as MingleActionOptions),
        this.mingleActionItem(item, parentEventId, current?.revision ?? 0, MINGLE_ACTIONS.end as MingleActionOptions),
        this.mingleActionItem(item, parentEventId, current?.revision ?? 0, MINGLE_ACTIONS.complete as MingleActionOptions)
      ];
    }
    if (current.status === 'PAUSED' && roundNumber === currentRound) {
      return [this.mingleActionItem(item, parentEventId, current?.revision ?? 0, MINGLE_ACTIONS.resume as MingleActionOptions)];
    }
    if (current.status === 'BREAK' && roundNumber === currentRound + 1) {
      return [this.mingleActionItem(item, parentEventId, current?.revision ?? 0, MINGLE_ACTIONS.nextNow as MingleActionOptions)];
    }
    if (current.status === 'COMPLETED' && roundNumber === currentRound + 1) {
      return [this.mingleActionItem(item, parentEventId, current?.revision ?? 0, MINGLE_ACTIONS.restart as MingleActionOptions)];
    }
    return [];
  }

  private static mingleActionItem(item: SubEventDTO, parentEventId: string, expectedRevision: number, options: MingleActionOptions): AppMenuItem<EventSubeventRuntimeMenuItemId, EventSubeventRuntimeMenuContext> {
    return {
      id: options.action,
      label: options.label,
      icon: options.icon,
      palette: options.palette,
      surface: 'tinted',
      context: {
        scope: 'mingle-runtime',
        expectedRevision,
        action: options.action,
        backendAction: options.backendAction,
        item,
        parentEventId,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel,
        busyLabel: options.busyLabel,
        destructive: options.destructive,
        confirmPalette: options.palette
      }
    };
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
        label: 'event.stage.start.action',
        icon: 'play_circle',
        palette: 'success',
        nextStatus: 'A',
        reason: 'tournament-started',
        title: 'confirmation.start.stage',
        description: `Start ${stageLabel}? This locks admission and assigns first-stage rooms.`,
        confirmLabel: 'start',
        busyLabel: 'event.stage.start.busy',
        destructive: false
      }));
    }
    if (((status === 'RS' && !isErrorStatus) || status === 'A') && isStageEnded) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'close-stage',
        label: 'event.stage.close.action',
        icon: 'rate_review',
        palette: 'blue',
        nextStatus: 'SR',
        reason: 'stage-closed',
        title: 'confirmation.close.stage',
        description: `Close ${stageLabel} and move it under score review?`,
        confirmLabel: 'event.stage.close.action',
        busyLabel: 'Closing...',
        destructive: false
      }));
    }
    if (status === 'SR') {
      actions.push(this.stageActionItem({
        ...base,
        action: 'finalize-stage',
        label: 'event.stage.finalize.action',
        icon: 'verified',
        palette: 'success',
        nextStatus: 'F',
        reason: 'stage-finalized',
        title: 'confirmation.finalize.stage',
        description: `Finalize ${stageLabel}?`,
        confirmLabel: 'Finalize',
        busyLabel: 'Finalizing...',
        destructive: false
      }));
    }
    if (this.canReopenScores(item, options.siblings, options.subEventIndex)) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'reopen-scores',
        label: 'event.stage.scores.reopen.action',
        icon: 'edit_note',
        palette: 'amber',
        nextStatus: 'SR',
        reason: 'scores-reopened',
        title: 'confirmation.reopen.scores',
        description: `Reopen scores for ${stageLabel}?`,
        confirmLabel: 'event.stage.reopen.action',
        busyLabel: 'event.stage.reopen.busy',
        destructive: false
      }));
    }
    if (status === 'A' && isStageWindowOpen) {
      actions.push(this.stageActionItem({
        ...base,
        action: 'suspend-tournament',
        label: 'event.stage.suspend.action',
        icon: 'pause_circle',
        palette: 'warning',
        nextStatus: 'S',
        reason: 'manual-suspension',
        title: 'confirmation.suspend.stage',
        description: `Suspend ${stageLabel}?`,
        confirmLabel: 'event.stage.suspend.confirm',
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
        label: 'event.stage.resume.action',
        icon: 'play_circle',
        palette: 'blue',
        nextStatus: resumeNextStatus,
        reason: 'manual-resume',
        title: 'confirmation.resume.stage',
        description: `Resume ${stageLabel}?`,
        confirmLabel: 'event.stage.resume.confirm',
        busyLabel: 'event.stage.resume.busy',
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
    if (requestedMode === 'Casual' || requestedMode === 'Tournament' || requestedMode === 'Mingle') {
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
      counter: pending > 0 ? { value: pending, max: 99 } : null,
      counterTone: 'alert',
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
    subEventIndex: number
  ): boolean {
    if (this.stageStatus(item) !== 'F') {
      return false;
    }
    return siblings.slice(Math.max(0, subEventIndex) + 1)
      .filter(stage => this.isTournamentStage(stage))
      .every(stage => {
        const status = this.stageStatus(stage);
        const pristineActive = status === 'A'
          && !`${stage.stageStatusUpdatedAt ?? ''}`.trim()
          && !`${stage.stageFinalizedAt ?? ''}`.trim();
        return status === 'RS' || pristineActive;
      });
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

  private static groupPending(item: SubEventDTO): number {
    return Math.max(0, this.toInteger(item.groupsPending));
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

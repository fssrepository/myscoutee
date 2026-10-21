import { POPUP_ADAPTER } from '../../popup-adapter-loaders';
import { PopupAdapterProxyService } from '../../popup-adapter-proxy.service';
import { Injectable, Type, signal, inject } from '@angular/core';

import { ActivityEventDetailDTO, type SubEventDefinitionDTO } from '../../../../core/contracts/common/activity.interface';
import type { EventEditorTarget, EventMode, EventTournamentStageDTO } from '../../../../core/contracts/events/event.interface';

export type EventSubeventsEditorAction = 'edit' | 'manage' | 'view';

export interface EventSubeventsListPopupRequest {
  updatedMs: number;
  host: 'activities' | 'chat' | 'eventExplore';
  eventId: string;
  target: EventEditorTarget;
  title: string | null;
  timeframe: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  mode: EventMode | null;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
  resourceOwnerUserId: string | null;
  editorAction: EventSubeventsEditorAction;
  canEdit: boolean;
}

export interface EventTournamentGroupsPopupRequest {
  updatedMs: number;
  eventId: string;
  slotId: string | null;
  title: string | null;
  mode: EventMode;
  canManage: boolean;
  stages: readonly EventTournamentStageDTO[];
  selectedStageId?: string | null;
  selectedGroupId?: string | null;
}

export interface EventTournamentGroupsUpdate {
  updatedMs: number;
  eventId: string;
  slotId: string | null;
  stageId: string;
  groupsCount: number;
  groupsPending: number;
  groupsPendingDelta: number;
}

export interface EventSubeventsDefinitionDraftUpdate {
  updatedMs: number;
  action: 'preview' | 'discard';
  eventId: string;
  mode: EventMode | null;
  startAtIso: string | null;
  endAtIso: string | null;
  slotsEnabled: boolean;
  definitions: readonly SubEventDefinitionDTO[];
}

export interface EventSubeventsReloadRequest {
  revision: number;
  eventId: string;
  source: 'event-save';
}

@Injectable({
  providedIn: 'root'
})
export class EventSubeventsPopupStore {
  private readonly popupAdapters = inject(PopupAdapterProxyService);
  private readonly calendarSelectionRef = signal<{
    view: 'day' | 'week' | 'month';
    dateRange: {startAt: string; endAt: string; precision: 'date'} | null;
  }>({view: 'day', dateRange: null});
  readonly calendarSelection = this.calendarSelectionRef.asReadonly();

  selectListView(view: 'day' | 'week' | 'month'): void {
    const current = this.calendarSelectionRef();
    if (current.view === view && !current.dateRange) return;
    this.calendarSelectionRef.set({view, dateRange: null});
  }

  selectCalendarRange(startAt: string, endAt = startAt): void {
    const current = this.calendarSelectionRef();
    if (current.view === 'day' && current.dateRange?.startAt === startAt && current.dateRange.endAt === endAt) return;
    this.calendarSelectionRef.set({view: 'day', dateRange: {startAt, endAt, precision: 'date'}});
  }

  private readonly eventSubeventsListPopupRef = signal<EventSubeventsListPopupRequest | null>(null);
  private readonly eventTournamentGroupsPopupRef = signal<EventTournamentGroupsPopupRequest | null>(null);
  private readonly eventTournamentGroupsUpdateRef = signal<EventTournamentGroupsUpdate | null>(null);
  private readonly eventSubeventsDefinitionDraftUpdateRef = signal<EventSubeventsDefinitionDraftUpdate | null>(null);
  private readonly eventSubeventsReloadRequestRef = signal<EventSubeventsReloadRequest | null>(null);
  private readonly eventSubeventsListPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventTournamentGroupsPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly eventSubeventsListPopup = this.eventSubeventsListPopupRef.asReadonly();
  readonly eventTournamentGroupsPopup = this.eventTournamentGroupsPopupRef.asReadonly();
  readonly eventTournamentGroupsUpdate = this.eventTournamentGroupsUpdateRef.asReadonly();
  readonly eventSubeventsDefinitionDraftUpdate = this.eventSubeventsDefinitionDraftUpdateRef.asReadonly();
  readonly eventSubeventsReloadRequest = this.eventSubeventsReloadRequestRef.asReadonly();
  readonly eventSubeventsListPopupComponent = this.eventSubeventsListPopupComponentRef.asReadonly();
  readonly eventTournamentGroupsPopupComponent = this.eventTournamentGroupsPopupComponentRef.asReadonly();

  openEventSubeventsListPopup(payload: {
    eventId: string;
    host?: 'activities' | 'chat' | 'eventExplore';
    target?: EventEditorTarget;
    title?: string | null;
    timeframe?: string | null;
    startAtIso?: string | null;
    endAtIso?: string | null;
    mode?: EventMode | null;
    acceptedMembers?: number | null;
    pendingMembers?: number | null;
    capacityTotal?: number | null;
    resourceOwnerUserId?: string | null;
    editorAction?: EventSubeventsEditorAction;
    canEdit?: boolean;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    const editorAction = payload.editorAction === 'manage'
      || payload.editorAction === 'edit'
      || payload.editorAction === 'view'
      ? payload.editorAction
      : payload.canEdit === true
        ? 'edit'
        : 'view';
    this.selectListView('day');
    this.eventSubeventsListPopupRef.set({
      updatedMs: Date.now(),
      host: payload.host ?? 'activities',
      eventId,
      target: payload.target ?? 'events',
      title: `${payload.title ?? ''}`.trim() || null,
      timeframe: `${payload.timeframe ?? ''}`.trim() || null,
      startAtIso: `${payload.startAtIso ?? ''}`.trim() || null,
      endAtIso: `${payload.endAtIso ?? ''}`.trim() || null,
      mode: payload.mode === 'Tournament' || payload.mode === 'Mingle' || payload.mode === 'Casual'
        ? payload.mode
        : null,
      acceptedMembers: this.nonNegativeInteger(payload.acceptedMembers),
      pendingMembers: this.nonNegativeInteger(payload.pendingMembers),
      capacityTotal: this.nonNegativeInteger(payload.capacityTotal),
      resourceOwnerUserId: `${payload.resourceOwnerUserId ?? ''}`.trim() || null,
      editorAction,
      canEdit: editorAction !== 'view'
    });
  }

  closeEventSubeventsListPopup(): void {
    this.eventSubeventsListPopupRef.set(null);
    this.selectListView('day');
  }

  updateEventSubeventsEditorAction(eventId: string, editorAction: EventSubeventsEditorAction): void {
    const normalizedEventId = eventId.trim();
    this.eventSubeventsListPopupRef.update(request => {
      if (!request || request.eventId !== normalizedEventId || request.editorAction === editorAction) {
        return request;
      }
      return {
        ...request,
        updatedMs: Date.now(),
        editorAction,
        canEdit: editorAction !== 'view'
      };
    });
  }

  openEventTournamentGroupsPopup(payload: {
    eventId: string;
    slotId?: string | null;
    title?: string | null;
    mode?: EventMode | null;
    canManage?: boolean | null;
    stages?: readonly EventTournamentStageDTO[] | null;
    selectedStageId?: string | null;
    selectedGroupId?: string | null;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this.eventTournamentGroupsPopupRef.set({
      updatedMs: Date.now(),
      eventId,
      slotId: `${payload.slotId ?? ''}`.trim() || null,
      title: `${payload.title ?? ''}`.trim() || null,
      mode: ActivityEventDetailDTO.normalizeMode(payload.mode),
      canManage: payload.canManage === true,
      stages: (payload.stages ?? []).map(stage => ({
        ...stage,
        groups: []
      })),
      selectedStageId: `${payload.selectedStageId ?? ''}`.trim() || null,
      selectedGroupId: `${payload.selectedGroupId ?? ''}`.trim() || null
    });
  }

  closeEventTournamentGroupsPopup(): void {
    this.eventTournamentGroupsPopupRef.set(null);
  }

  emitEventTournamentGroupsUpdate(payload: {
    eventId: string;
    slotId?: string | null;
    stageId: string;
    groupsCount: number;
    groupsPending: number;
    groupsPendingDelta?: number;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    const stageId = `${payload.stageId ?? ''}`.trim();
    if (!eventId || !stageId) {
      return;
    }
    const updatedMs = Math.max(
      Date.now(),
      (this.eventTournamentGroupsUpdateRef()?.updatedMs ?? 0) + 1
    );
    this.eventTournamentGroupsUpdateRef.set({
      updatedMs,
      eventId,
      slotId: `${payload.slotId ?? ''}`.trim() || null,
      stageId,
      groupsCount: Math.max(0, Math.trunc(Number(payload.groupsCount) || 0)),
      groupsPending: Math.max(0, Math.trunc(Number(payload.groupsPending) || 0)),
      groupsPendingDelta: Number.isFinite(Number(payload.groupsPendingDelta))
        ? Math.trunc(Number(payload.groupsPendingDelta))
        : 0
    });
  }

  emitEventSubeventsDefinitionDraftPreview(payload: {
    eventId: string;
    mode: EventMode;
    startAtIso?: string | null;
    endAtIso?: string | null;
    slotsEnabled?: boolean;
    definitions?: readonly SubEventDefinitionDTO[] | null;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this.eventSubeventsDefinitionDraftUpdateRef.set({
      updatedMs: this.nextDefinitionDraftUpdatedMs(),
      action: 'preview',
      eventId,
      mode: ActivityEventDetailDTO.normalizeMode(payload.mode),
      startAtIso: `${payload.startAtIso ?? ''}`.trim() || null,
      endAtIso: `${payload.endAtIso ?? ''}`.trim() || null,
      slotsEnabled: payload.slotsEnabled === true,
      definitions: (payload.definitions ?? []).map(definition => ({ ...definition }))
    });
  }

  discardEventSubeventsDefinitionDraft(eventId: string): void {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    if (!normalizedEventId) {
      return;
    }
    this.eventSubeventsDefinitionDraftUpdateRef.set({
      updatedMs: this.nextDefinitionDraftUpdatedMs(),
      action: 'discard',
      eventId: normalizedEventId,
      mode: null,
      startAtIso: null,
      endAtIso: null,
      slotsEnabled: false,
      definitions: []
    });
  }

  clearEventSubeventsDefinitionDraft(eventId: string): void {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    if (this.eventSubeventsDefinitionDraftUpdateRef()?.eventId === normalizedEventId) {
      this.eventSubeventsDefinitionDraftUpdateRef.set(null);
    }
  }

  requestEventSubeventsReload(eventId: string): void {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    if (!normalizedEventId) {
      return;
    }
    this.eventSubeventsReloadRequestRef.set({
      revision: (this.eventSubeventsReloadRequestRef()?.revision ?? 0) + 1,
      eventId: normalizedEventId,
      source: 'event-save'
    });
  }

  private nextDefinitionDraftUpdatedMs(): number {
    return Math.max(
      Date.now(),
      (this.eventSubeventsDefinitionDraftUpdateRef()?.updatedMs ?? 0) + 1
    );
  }

  private nonNegativeInteger(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  }

  async ensureEventSubeventsListPopupLoaded(): Promise<void> {
    if (this.eventSubeventsListPopupComponentRef()) {
      return;
    }
    const module = await this.popupAdapters.load(POPUP_ADAPTER.EVENT_SUBEVENTS_LIST_POPUP);
    this.eventSubeventsListPopupComponentRef.set(module.EventSubeventsListPopupComponent);
  }

  async ensureEventTournamentGroupsPopupLoaded(): Promise<void> {
    if (this.eventTournamentGroupsPopupComponentRef()) {
      return;
    }
    const module = await this.popupAdapters.load(POPUP_ADAPTER.EVENT_TOURNAMENT_GROUPS_POPUP);
    this.eventTournamentGroupsPopupComponentRef.set(module.EventTournamentGroupsPopupComponent);
  }
}

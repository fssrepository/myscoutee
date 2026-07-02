import { Injectable, Type, signal } from '@angular/core';

import type { EventEditorTarget, EventMode, EventTournamentStageDTO } from '../../../core/contracts/event.interface';

export interface EventSubeventsListPopupRequest {
  updatedMs: number;
  host: 'activities' | 'chat';
  eventId: string;
  target: EventEditorTarget;
  title: string | null;
  timeframe: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  mode: EventMode | null;
  canEdit: boolean;
}

export interface EventTournamentGroupsPopupRequest {
  updatedMs: number;
  eventId: string;
  slotId: string | null;
  title: string | null;
  canManage: boolean;
  stages: readonly EventTournamentStageDTO[];
  selectedStageId?: string | null;
  selectedGroupId?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class EventSubeventsPopupStore {
  private readonly eventSubeventsListPopupRef = signal<EventSubeventsListPopupRequest | null>(null);
  private readonly eventTournamentGroupsPopupRef = signal<EventTournamentGroupsPopupRequest | null>(null);
  private readonly eventSubeventsListPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventTournamentGroupsPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly eventSubeventsListPopup = this.eventSubeventsListPopupRef.asReadonly();
  readonly eventTournamentGroupsPopup = this.eventTournamentGroupsPopupRef.asReadonly();
  readonly eventSubeventsListPopupComponent = this.eventSubeventsListPopupComponentRef.asReadonly();
  readonly eventTournamentGroupsPopupComponent = this.eventTournamentGroupsPopupComponentRef.asReadonly();

  openEventSubeventsListPopup(payload: {
    eventId: string;
    host?: 'activities' | 'chat';
    target?: EventEditorTarget;
    title?: string | null;
    timeframe?: string | null;
    startAtIso?: string | null;
    endAtIso?: string | null;
    mode?: EventMode | null;
    canEdit?: boolean;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this.eventSubeventsListPopupRef.set({
      updatedMs: Date.now(),
      host: payload.host ?? 'activities',
      eventId,
      target: payload.target ?? 'events',
      title: `${payload.title ?? ''}`.trim() || null,
      timeframe: `${payload.timeframe ?? ''}`.trim() || null,
      startAtIso: `${payload.startAtIso ?? ''}`.trim() || null,
      endAtIso: `${payload.endAtIso ?? ''}`.trim() || null,
      mode: payload.mode === 'Tournament'
        ? 'Tournament'
        : payload.mode === 'Casual'
          ? 'Casual'
          : null,
      canEdit: payload.canEdit === true
    });
  }

  closeEventSubeventsListPopup(): void {
    this.eventSubeventsListPopupRef.set(null);
  }

  openEventTournamentGroupsPopup(payload: {
    eventId: string;
    slotId?: string | null;
    title?: string | null;
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

  async ensureEventSubeventsListPopupLoaded(): Promise<void> {
    if (this.eventSubeventsListPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-subevents-list-popup/event-subevents-list-popup.component');
    this.eventSubeventsListPopupComponentRef.set(module.EventSubeventsListPopupComponent);
  }

  async ensureEventTournamentGroupsPopupLoaded(): Promise<void> {
    if (this.eventTournamentGroupsPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-tournament-groups-popup/event-tournament-groups-popup.component');
    this.eventTournamentGroupsPopupComponentRef.set(module.EventTournamentGroupsPopupComponent);
  }
}

import { Injectable, Type, signal } from '@angular/core';
import { Subject } from 'rxjs';

import type { EventEditorTarget, EventTournamentStageDTO } from '../../../core/contracts/event.interface';
import type {
  ActivityEventSubEventsQueryDTO,
  SubEventsSlotDTO
} from '../../../core/contracts/activity.interface';

export interface EventSubeventsListPopupRequest {
  updatedMs: number;
  host: 'activities' | 'chat';
  eventId: string;
  target: EventEditorTarget;
  title: string | null;
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

export interface EventSubeventsDefinitionUpdateContext {
  title?: string | null;
  timeframe?: string | null;
  startAtIso?: string | null;
  endAtIso?: string | null;
  location?: string | null;
  acceptedMembers?: number | null;
  pendingMembers?: number | null;
  capacityTotal?: number | null;
  creatorUserId?: string | null;
  userId?: string | null;
  adminIds?: readonly string[];
  mode?: string | null;
}

export interface EventSubeventsDefinitionUpdate {
  updatedMs: number;
  eventId: string;
  event?: EventSubeventsDefinitionUpdateContext | null;
  slots: readonly SubEventsSlotDTO[];
}

@Injectable({
  providedIn: 'root'
})
export class EventSubeventsPopupStore {
  private readonly eventSubeventsListPopupRef = signal<EventSubeventsListPopupRequest | null>(null);
  private readonly eventTournamentGroupsPopupRef = signal<EventTournamentGroupsPopupRequest | null>(null);
  private readonly eventSubeventsListQueryRef = signal<ActivityEventSubEventsQueryDTO | null>(null);
  private readonly eventSubeventsListPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventTournamentGroupsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventSubeventsDefinitionUpdateSubject = new Subject<EventSubeventsDefinitionUpdate>();

  readonly eventSubeventsListPopup = this.eventSubeventsListPopupRef.asReadonly();
  readonly eventTournamentGroupsPopup = this.eventTournamentGroupsPopupRef.asReadonly();
  readonly eventSubeventsListQuery = this.eventSubeventsListQueryRef.asReadonly();
  readonly eventSubeventsListPopupComponent = this.eventSubeventsListPopupComponentRef.asReadonly();
  readonly eventTournamentGroupsPopupComponent = this.eventTournamentGroupsPopupComponentRef.asReadonly();
  readonly eventSubeventsDefinitionUpdate$ = this.eventSubeventsDefinitionUpdateSubject.asObservable();

  openEventSubeventsListPopup(payload: {
    eventId: string;
    host?: 'activities' | 'chat';
    target?: EventEditorTarget;
    title?: string | null;
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
      canEdit: payload.canEdit === true
    });
  }

  closeEventSubeventsListPopup(): void {
    this.eventSubeventsListPopupRef.set(null);
    this.eventSubeventsListQueryRef.set(null);
  }

  setEventSubeventsListQuery(query: ActivityEventSubEventsQueryDTO | null): void {
    if (!query) {
      this.eventSubeventsListQueryRef.set(null);
      return;
    }
    this.eventSubeventsListQueryRef.set({
      ...query,
      userId: `${query.userId ?? ''}`.trim(),
      eventId: `${query.eventId ?? ''}`.trim(),
      order: query.order,
      view: query.view,
      anchorDate: `${query.anchorDate ?? ''}`.trim() || null,
      rangeStart: `${query.rangeStart ?? ''}`.trim() || null,
      rangeEnd: `${query.rangeEnd ?? ''}`.trim() || null
    });
  }

  emitEventSubeventsDefinitionUpdate(payload: {
    eventId: string;
    event?: EventSubeventsDefinitionUpdateContext | null;
    slots?: readonly SubEventsSlotDTO[] | null;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this.eventSubeventsDefinitionUpdateSubject.next({
      updatedMs: Date.now(),
      eventId,
      event: payload.event ?? null,
      slots: (payload.slots ?? []).map(slot => ({
        ...slot,
        subEventItems: (slot.subEventItems ?? []).map(item => ({ ...item }))
      }))
    });
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

import { computed, Injectable, signal } from '@angular/core';
import type { EventEditorTarget } from '../../shared/core/contracts/event.interface';

export interface EventSubeventsListPopupRequest {
  eventId: string;
  target?: EventEditorTarget;
  title?: string | null;
  canEdit?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EventSubeventsListPopupStateService {
  private readonly _request = signal<EventSubeventsListPopupRequest | null>(null);

  readonly request = this._request.asReadonly();
  readonly isOpen = computed(() => Boolean(this._request()));

  open(request: EventSubeventsListPopupRequest): void {
    const eventId = `${request.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this._request.set({
      ...request,
      eventId,
      title: `${request.title ?? ''}`.trim() || null,
      target: request.target ?? 'events',
      canEdit: request.canEdit === true
    });
  }

  close(): void {
    this._request.set(null);
  }
}

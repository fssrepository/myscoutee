import { Injectable, computed, inject, signal } from '@angular/core';

import { EventsService } from '../../../core/base/services/events.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { MingleStateDTO } from '../../../core/contracts/event.interface';
import { UiPollCoordinator } from '../../scheduler/ui-poll-coordinator';
import { UiTaskScheduler } from '../../scheduler/ui-task-scheduler';
import { MemberMenuStore } from './member-menu.store';

@Injectable({ providedIn: 'root' })
export class MingleStore {
  private readonly eventsService = inject(EventsService);
  private readonly i18n = inject(I18nService);
  private readonly pollCoordinator = inject(UiPollCoordinator);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly activeUserIdRef = signal('');
  private readonly stateRef = signal<MingleStateDTO | null>(null);
  private readonly seenRevisionByEventId = new Map<string, number>();
  private requestSequence = 0;

  private readonly scheduler = new UiTaskScheduler<string>({
    intervalMs: () => this.activeUserIdRef() ? 5_000 : 0,
    state: () => this.activeUserIdRef(),
    task: ({ state, signal }) => this.refresh(state, signal),
    pollCoordinator: this.pollCoordinator,
    pollPriority: 'notification'
  });

  readonly state = this.stateRef.asReadonly();
  readonly visible = computed(() => {
    const state = this.stateRef();
    return Boolean(
      state
      && (state.status === 'ROUND' || state.status === 'BREAK' || state.status === 'PAUSED')
      && state.tableNumber != null
    );
  });
  readonly attention = computed(() => {
    const state = this.stateRef();
    if (!state || !this.visible()) {
      return false;
    }
    return state.revision > (this.seenRevisionByEventId.get(state.eventId) ?? -1);
  });

  activate(userId: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (this.activeUserIdRef() === normalizedUserId) {
      return;
    }
    this.activeUserIdRef.set(normalizedUserId);
    this.requestSequence += 1;
    if (!normalizedUserId) {
      this.stateRef.set(null);
      this.scheduler.stop({ abort: true });
      return;
    }
    void this.refresh(normalizedUserId);
    this.scheduler.restart();
  }

  async openCurrentTable(eventId?: string): Promise<boolean> {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    let state = this.stateRef();
    if (normalizedEventId && state?.eventId !== normalizedEventId) {
      const activeUserId = this.activeUserIdRef();
      if (!activeUserId) {
        return false;
      }
      state = await this.eventsService.queryMingleState(activeUserId, normalizedEventId).catch(() => null);
      if (this.activeUserIdRef() !== activeUserId) {
        return false;
      }
      this.stateRef.set(state);
    }
    if (!state || !this.visible()) {
      return false;
    }
    this.seenRevisionByEventId.set(state.eventId, state.revision);
    const tableNumber = state.tableNumber;
    if (tableNumber == null) {
      return false;
    }
    const table = state.tables.find(item => item.tableNumber === tableNumber);
    if (!table) {
      return false;
    }
    const roundNumber = Math.max(1, state.roundNumber);
    const subEventId = `mingle-round-${roundNumber}`;
    const ownerId = `${table.memberOwnerId ?? ''}`.trim();
    if (!ownerId) {
      return false;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      ownerId,
      ownerType: 'group',
      parentOwnerId: state.eventId,
      parentOwnerType: 'event',
      eventId: state.eventId,
      subEventId,
      subtitle: this.i18n.translateParams('mingle.table.number', { number: tableNumber }),
      canManage: state.canManage,
      viewOnly: !state.canManage,
      acceptedMembers: table.participants.length,
      pendingMembers: 0,
      capacityTotal: table.participants.length
    });
    return true;
  }

  async applyAction(eventId: string, actorUserId: string, action: string): Promise<MingleStateDTO | null> {
    const next = await this.eventsService.applyMingleAction(eventId, actorUserId, action);
    if (next && this.activeUserIdRef() === `${actorUserId ?? ''}`.trim()) {
      this.stateRef.set(next);
    }
    return next;
  }

  private async refresh(userId: string, signal?: AbortSignal): Promise<void> {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId || signal?.aborted) {
      return;
    }
    const sequence = ++this.requestSequence;
    const state = await this.eventsService.queryMingleState(normalizedUserId).catch(() => null);
    if (
      signal?.aborted
      || sequence !== this.requestSequence
      || this.activeUserIdRef() !== normalizedUserId
    ) {
      return;
    }
    this.stateRef.set(state);
  }
}

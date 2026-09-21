import { NotificationCenterStore } from './notification-center.store';
import { ActivityStore } from './activity.store';
import { Injectable, computed, effect, inject, signal, untracked, OnDestroy } from '@angular/core';

import { EventsService } from '../../../core/base/services/events.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { MingleStateDTO } from '../../../core/contracts/event.interface';
import { UiPollCoordinator } from '../../scheduler/ui-poll-coordinator';
import { UiTaskScheduler } from '../../scheduler/ui-task-scheduler';
import { MemberMenuStore } from './member-menu.store';

@Injectable({ providedIn: 'root' })
export class MingleStore implements OnDestroy {
  private readonly notifications = inject(NotificationCenterStore);
  private readonly activity = inject(ActivityStore);
  private readonly eventsService = inject(EventsService);
  private readonly i18n = inject(I18nService);
  private readonly pollCoordinator = inject(UiPollCoordinator);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly activeUserIdRef = signal('');
  private readonly stateRef = signal<MingleStateDTO | null>(null);
  private readonly seenRevisionByEventId = signal<Record<string, number>>({});
  private requestSequence = 0;
  private readonly liveViewEventId = signal('');
  private readonly now = signal(Date.now());
  private readonly clock = new UiTaskScheduler<string>({
    intervalMs: () => this.liveViewEventId() ? 1_000 : 0,
    state: () => this.liveViewEventId(),
    task: async () => { this.now.set(Date.now()); }
  });

  readonly statusLabel = computed(() => {
    const state = this.stateRef();
    if (!state) return '';
    const seconds = state.status === 'PAUSED' ? state.remainingSeconds
      : Math.max(0, Math.ceil((Date.parse(state.phaseEndsAtIso ?? '') - this.now()) / 1_000)) || 0;
    const time = `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`;
    return this.i18n.translateParams(`mingle.live.${state.status}`, { time });
  });
  readonly roundLabel = computed(() => {
    const state = this.stateRef();
    return state ? this.i18n.translateParams('mingle.live.round', { round: state.roundNumber, total: state.plannedRounds }) : '';
  });

  closeLiveView(): void {
    this.liveViewEventId.set('');
    this.clock.stop();
  }


  private readonly scheduler = new UiTaskScheduler<string>({
    intervalMs: () => this.activeUserIdRef() && this.hasLiveState()
      && (typeof document === 'undefined' || !document.hidden) ? 5_000 : 0,
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
      && (state.tableNumber != null || state.waitingForTable === true)
    );
  });
  readonly attention = computed(() => {
    const state = this.stateRef();
    if (!state || !this.visible()) {
      return false;
    }
    return state.revision > (this.seenRevisionByEventId()[state.eventId] ?? -1);
  });

  private readonly onForeground = () => {
    if (!document.hidden) void this.refresh(this.activeUserIdRef());
  };

  constructor() {
    effect(() => {
      this.notifications.unreadCount();
      this.activity.activityEventRuntimeSync();
      untracked(() => {
        if (!this.hasLiveState() && this.activeUserIdRef()) void this.refresh(this.activeUserIdRef());
      });
    });
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onForeground);
  }

  ngOnDestroy(): void {
    this.scheduler.destroy();
    this.clock.destroy();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onForeground);
  }

  private hasLiveState(): boolean {
    return ['ROUND', 'BREAK', 'PAUSED'].includes(this.stateRef()?.status ?? '');
  }

  activate(userId: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (this.activeUserIdRef() === normalizedUserId) {
      return;
    }
    this.activeUserIdRef.set(normalizedUserId);
    this.stateRef.set(null);
    this.seenRevisionByEventId.set({});
    this.closeLiveView();
    this.scheduler.stop({ abort: true });
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
    this.seenRevisionByEventId.update(seen => ({ ...seen, [state.eventId]: state.revision }));
    const tableNumber = state.tableNumber;
    const table = state.tables.find(item => item.tableNumber === tableNumber);
    if (!table && !state.waitingForTable) return false;
    const subEventId = `${table?.subEventId ?? ''}`.trim();
    const ownerId = table ? `${table.memberOwnerId ?? ''}`.trim() : state.eventId;
    if (!ownerId || (table && !subEventId)) return false;
    this.liveViewEventId.set(state.eventId);
    this.now.set(Date.now());
    this.clock.restart();
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      mingleLive: true,
      ownerId,
      ownerType: table ? 'group' : 'event',
      parentOwnerId: state.eventId,
      parentOwnerType: 'event',
      eventId: state.eventId,
      subEventId,
      subtitle: table ? this.i18n.translateParams('mingle.table.number', { number: table.tableNumber }) : state.eventTitle,
      canManage: Boolean(table) && state.canManage,
      viewOnly: !table || !state.canManage,
      acceptedMembers: table?.participants.length ?? 0,
      pendingMembers: 0,
      capacityTotal: table?.participants.length ?? 0
    });
    return true;
  }

  async applyAction(eventId: string, actorUserId: string, action: string, expectedRevision?: number): Promise<MingleStateDTO | null> {
    const next = await this.eventsService.applyMingleAction(eventId, actorUserId, action, expectedRevision);
    if (next && this.activeUserIdRef() === `${actorUserId ?? ''}`.trim()) {
      this.stateRef.set(next);
      this.scheduler.restart();
    }
    return next;
  }

  private async refresh(userId: string, signal?: AbortSignal): Promise<void> {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId || signal?.aborted) {
      return;
    }
    const sequence = ++this.requestSequence;
    let state: MingleStateDTO | null;
    try {
      state = await this.eventsService.queryMingleState(normalizedUserId, this.liveViewEventId() || undefined);
    } catch {
      return;
    }
    if (
      signal?.aborted
      || sequence !== this.requestSequence
      || this.activeUserIdRef() !== normalizedUserId
    ) {
      return;
    }
    const wasLive = this.hasLiveState();
    this.stateRef.set(state);
    if (!this.hasLiveState()) this.scheduler.stop();
    else if (!wasLive) this.scheduler.restart();
  }
}

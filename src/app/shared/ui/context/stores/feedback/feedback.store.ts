import { Injectable, Type, computed, effect, inject, signal } from '@angular/core';
import { GroupWorkspaceContextService } from '../../../../core/base/services/groups/group-workspace-context.service';
import { FeedbackService } from '../../../../core/base/services/feedback/feedback.service';
import { FeedbackDetailDto, type FeedbackCommand, type FeedbackEvaluationItem, type FeedbackPageCountsDto, type FeedbackFilterCountDelta } from '../../../../core/contracts/feedback/feedback.interface';
import type { UserMenuCountersDto } from '../../../../core/contracts/accounts/user.interface';
import { MemberMenuStore } from '../app/member-menu.store';
import { UserProfileStore } from '../profile/user-profile.store';

export interface FeedbackCounterSnapshot extends FeedbackPageCountsDto { attention: number; }

const count = (value: number | undefined): number => Math.max(0, Math.trunc(Number(value) || 0));
function counterSnapshot(events: Partial<FeedbackPageCountsDto> = {}, evaluations: Readonly<Record<string, number>> = {}): FeedbackCounterSnapshot {
  return {
    pending: count(events.pending) + count(evaluations['pending']),
    feedbacked: count(events.feedbacked) + count(evaluations['feedbacked']),
    removed: count(events.removed) + count(evaluations['removed']),
    ownEvents: count(events.ownEvents) + count(evaluations['received']),
    attention: count(events.pending) + count(events.ownEvents) + count(evaluations['pending'])
  };
}

@Injectable({ providedIn: 'root' })
export class FeedbackStore {
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly profile = inject(UserProfileStore);
  private readonly menus = inject(MemberMenuStore);
  private readonly service = inject(FeedbackService);
  readonly userId = computed(() => this.profile.activeUserId());
  readonly listOpen = signal(false);
  private readonly counterState = signal<FeedbackCounterSnapshot | null>(null);
  private counterRevision = 0;
  readonly counters = computed(() => {
    const activities = this.profile.activeUserProfile()?.activities;
    return this.counterState() ?? counterSnapshot(activities?.feedbackCounts,
      this.workspace.isCommunity() ? Object.fromEntries(['pending', 'feedbacked', 'removed', 'received']
        .map(bucket => [bucket, activities?.menuCounters?.[`feedbackEvaluation_${bucket}`] ?? 0])) : {});
  });
  readonly submitted = signal<{updatedMs: number; dto: FeedbackDetailDto} | null>(null);
  readonly opened = signal(false);
  readonly component = signal<Type<unknown> | null>(null);
  readonly selected = signal<FeedbackEvaluationItem | null>(null);
  readonly readOnly = signal(true);
  readonly changed = signal<{ userId: string; id: string; action: FeedbackCommand['action'] } | null>(null);
  private generation = 0;

  constructor() {
    effect(() => { this.userId(); this.workspace.active(); this.counterRevision++; this.counterState.set(null); this.close(); });
  }

  captureCounterRevision(): number { return this.counterRevision; }

  applyPageCounters(userId: string, events: FeedbackPageCountsDto, evaluations: Readonly<Record<string, number>>): void {
    if (userId !== this.userId()) return;
    this.counterRevision++;
    this.counterState.set(counterSnapshot(events, evaluations));
  }

  applyRealtimeCounters(userId: string, counters: UserMenuCountersDto, revision: number): void {
    if (userId !== this.userId() || revision !== this.counterRevision || this.listOpen()) return;
    const next = counterSnapshot(counters.feedbackCounts,
      this.workspace.isCommunity() ? Object.fromEntries(['pending', 'feedbacked', 'removed', 'received']
        .map(bucket => [bucket, counters.menuCounters?.[`feedbackEvaluation_${bucket}`] ?? 0])) : {});
    const current = this.counters();
    if (Object.entries(next).some(([key, value]) => current[key as keyof FeedbackCounterSnapshot] !== value))
      this.counterState.set(next);
  }

  applyCounterDelta(delta: FeedbackFilterCountDelta): void {
    const current = this.counters();
    this.counterRevision++;
    this.counterState.set({
      pending: count(current.pending + (delta.pending ?? 0)),
      feedbacked: count(current.feedbacked + (delta.feedbacked ?? 0)),
      removed: count(current.removed + (delta.removed ?? 0)),
      ownEvents: count(current.ownEvents + (delta['own-events'] ?? 0)),
      attention: count(current.attention + (delta.pending ?? 0) + (delta['own-events'] ?? 0))
    });
  }

  emitSubmitted(dto: FeedbackDetailDto): void {
    if (dto.eventId.trim()) this.submitted.set({ updatedMs: Date.now(), dto: new FeedbackDetailDto(dto) });
  }

  open(): void {
    this.menus.openNavigatorFeedbackRequest();
  }

  async openDetail(item: FeedbackEvaluationItem, received = false): Promise<void> {
    const generation = ++this.generation;
    const component = (await import('../../../components/feedback-evaluation/feedback-evaluation-popup.component')).FeedbackEvaluationPopupComponent;
    if (generation !== this.generation) return;
    this.selected.set(item);
    this.readOnly.set(received || item.feedback.status !== 'pending');
    this.component.set(component);
    this.opened.set(true);
  }

  close(): void {
    this.generation++;
    this.opened.set(false);
    this.selected.set(null);
  }

  async action(item: FeedbackEvaluationItem, command: Omit<FeedbackCommand, 'userId'>): Promise<void> {
    const userId = this.userId();
    await this.service.action(item.feedback.id, { ...command, userId });
    if (this.userId() === userId) this.changed.set({ userId, id: item.feedback.id, action: command.action });
  }
}

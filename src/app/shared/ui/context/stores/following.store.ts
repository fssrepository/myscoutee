import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { FollowingService } from '../../../core/base/services/following.service';
import type { FollowingState } from '../../../core/contracts/following.interface';
import { UserProfileStore } from './user-profile.store';
import { DialogStore } from './dialog.store';
@Injectable({ providedIn: 'root' })
export class FollowingStore {
  private readonly service = inject(FollowingService);
  private readonly profile = inject(UserProfileStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly stateRef = signal<FollowingState>({ organizerIds: [], eventCount: 0 });
  private userId = '';
  private revision = 0;
  readonly state = this.stateRef.asReadonly();
  readonly memberCount = computed(() => this.state().organizerIds.length);
  constructor() {
    effect(() => {
      const userId = this.profile.activeUserId();
      if (userId === this.userId) return;
      this.userId = userId;
      this.revision++;
      this.stateRef.set({ organizerIds: [], eventCount: 0 });
    });
  }
  captureRevision(): number { return this.revision; }
  confirmChange(organizerId: string, organizerName: string, followed: boolean, onCommitted?: () => void): void {
    const label = followed ? 'event.following.follow' : 'event.following.unfollow';
    this.dialogStore.open({
      title: label, message: organizerName, confirmLabel: label,
      cancelLabel: 'Cancel', confirmPalette: 'cyan', failureMessage: 'event.following.failed',
      onConfirm: async () => {
        await this.change(organizerId, followed);
        onCommitted?.();
      }
    });
  }
  applySnapshot(userId: string, state: FollowingState | undefined, revision: number): void {
    if (state && userId === this.profile.activeUserId() && revision === this.revision) this.stateRef.set(state);
  }
  async change(organizerId: string, followed: boolean): Promise<void> {
    const userId = this.profile.activeUserId();
    this.revision++;
    try {
      const { eventCountDelta, ...result } = await this.service.change(userId, organizerId, followed);
      if (userId !== this.profile.activeUserId()) return;
      this.stateRef.update(current => ({
        ...result,
        // Apply once against the server's pre-write count. A newer poll or a first
        // unhydrated view reconciles to the returned snapshot instead of double-counting.
        eventCount: current.eventCount === result.eventCount - eventCountDelta
          ? current.eventCount + eventCountDelta : result.eventCount
      }));
    } finally {
      this.revision++;
    }
  }
  members() { return this.service.members(this.profile.activeUserId()); }
}

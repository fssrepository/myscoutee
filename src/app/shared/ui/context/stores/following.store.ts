import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { FollowingService } from '../../../core/base/services/following.service';
import type { FollowingState } from '../../../core/contracts/following.interface';
import { UserProfileStore } from './user-profile.store';
@Injectable({ providedIn: 'root' })
export class FollowingStore {
  private readonly service = inject(FollowingService);
  private readonly profile = inject(UserProfileStore);
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
  applySnapshot(userId: string, state: FollowingState | undefined, revision: number): void {
    if (state && userId === this.profile.activeUserId() && revision === this.revision) this.stateRef.set(state);
  }
  async change(organizerId: string, followed: boolean): Promise<void> {
    const userId = this.profile.activeUserId();
    this.revision++;
    const result = await this.service.change(userId, organizerId, followed);
    this.revision++;
    if (userId === this.profile.activeUserId()) this.stateRef.set(result);
  }
  members() { return this.service.members(this.profile.activeUserId()); }
}

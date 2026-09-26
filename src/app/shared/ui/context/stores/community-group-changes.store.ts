import { Injectable, signal } from '@angular/core';
import type { CommunityGroup } from '../../../core/contracts/community-group.interface';

/** Canonical mutation result shared by member, editor and list surfaces. */
@Injectable({ providedIn: 'root' })
export class CommunityGroupChangesStore {
  readonly revision = signal(0);
  readonly attentionDelta = signal<{ accountId: string; groupId: string; delta: number } | null>(null);
  signalAttentionDelta(accountId: string, groupId: string, delta: number): void {
    if (!delta) return;
    this.revision.update(value => value + 1);
    this.attentionDelta.set({ accountId, groupId, delta });
  }
  readonly change = signal<{ accountId: string; group: CommunityGroup } | null>(null);
  publish(accountId: string, group: CommunityGroup): void { this.revision.update(value => value + 1); this.change.set({ accountId, group }); }
}

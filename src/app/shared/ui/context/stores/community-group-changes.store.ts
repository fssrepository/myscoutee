import { Injectable, signal } from '@angular/core';
import type { CommunityGroup } from '../../../core/contracts/community-group.interface';

/** Canonical mutation result shared by member, editor and list surfaces. */
@Injectable({ providedIn: 'root' })
export class CommunityGroupChangesStore {
  readonly change = signal<{ accountId: string; group: CommunityGroup } | null>(null);
  publish(accountId: string, group: CommunityGroup): void { this.change.set({ accountId, group }); }
}

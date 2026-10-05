import { Injectable, signal } from '@angular/core';
import type { CommunityCase } from '../../../core/contracts/community-case.interface';
/** Canonical case mutation shared by the board, membership and chat surfaces. */
@Injectable({ providedIn: 'root' })
export class CommunityCaseChangesStore {
  readonly change = signal<{ accountId: string; value: CommunityCase } | null>(null);
  publish(accountId: string, value: CommunityCase): void { this.change.set({ accountId, value }); }
}

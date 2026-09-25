import { Injectable, signal } from '@angular/core';
import type { ContentModerationSnapshot } from '../../../core/contracts/content-moderation.interface';
@Injectable({ providedIn: 'root' })
export class ContentModerationStore {
  readonly snapshot = signal<ContentModerationSnapshot | null>(null);
  private readonly groups = signal<Record<string, ContentModerationSnapshot>>({});
  readonly groupSnapshots = this.groups.asReadonly();
  attention(groupId: string, pending = 0, revision = 0) {
    const snapshot = this.groups()[groupId];
    return snapshot && snapshot.revision >= revision
      ? { pending: snapshot.pendingCount, revision: snapshot.revision } : { pending, revision };
  }
  clearGlobal() { this.snapshot.set(null); }
  forScope(groupId?: string | null): ContentModerationSnapshot | null { return groupId ? this.groups()[groupId] ?? null : this.snapshot(); }
  apply(snapshot: ContentModerationSnapshot | null | undefined, groupId?: string | null) {
    if (groupId) {
      if (snapshot && snapshot.revision >= (this.groups()[groupId]?.revision ?? -1)) this.groups.update(groups => ({ ...groups, [groupId]: snapshot }));
      return;
    }
    if (snapshot && snapshot.revision >= (this.snapshot()?.revision ?? -1)) this.snapshot.set(snapshot);
  }
  clear() { this.snapshot.set(null); this.groups.set({}); }
}

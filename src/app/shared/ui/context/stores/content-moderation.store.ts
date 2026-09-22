import { Injectable, signal } from '@angular/core';
import type { ContentModerationSnapshot } from '../../../core/contracts/content-moderation.interface';
@Injectable({ providedIn: 'root' })
export class ContentModerationStore {
  readonly snapshot = signal<ContentModerationSnapshot | null>(null);
  apply(snapshot: ContentModerationSnapshot | null | undefined) {
    if (snapshot && snapshot.revision >= (this.snapshot()?.revision ?? -1)) this.snapshot.set(snapshot);
  }
  clear() { this.snapshot.set(null); }
}

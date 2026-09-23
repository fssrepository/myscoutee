import { Injectable, inject } from '@angular/core';
import { HttpMemoryDb, LocalMemoryDb, type AppMemoryDb } from '../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../common/storage-scope';
import { BaseRouteModeService } from '../services/base-route-mode.service';

interface Queue {
  db: AppMemoryDb;
  key: string;
  pending: Set<string>;
  dirty: Set<string>;
  ready: Promise<void>;
  writes: Promise<void>;
}

/** Small per-user IndexedDB entries, independent of the application snapshot. */
@Injectable({ providedIn: 'root' })
export class FeedSeenOutboxRepository extends BaseRouteModeService {
  private readonly localDb = inject(LocalMemoryDb);
  private readonly httpDb = inject(HttpMemoryDb);
  private readonly queues = new Map<string, Queue>();

  private queue(userId: string): Queue {
    const local = this.isLocalRouteEnabled('/activities/feed');
    const scopeKey = `${local ? 'local' : 'http'}:${userId}`;
    let queue = this.queues.get(scopeKey);
    if (queue) return queue;
    const db = local ? this.localDb : this.httpDb;
    const key = `${APP_INDEXED_DB_KEYS.photoFeedSeenOutboxPrefix}:${userId}`;
    queue = { db, key, pending: new Set(), dirty: new Set(), ready: Promise.resolve(), writes: Promise.resolve() };
    const created = queue;
    created.ready = db.readIndexedDbTableEntry<string[]>(key).then(ids => {
      for (const id of ids ?? []) created.pending.add(id);
    });
    this.queues.set(scopeKey, created);
    return created;
  }
  preload(userId: string): void { void this.queue(userId).ready; }
  pendingNow(userId: string): readonly string[] { return [...this.queue(userId).pending]; }
  enqueue(userId: string, id: string): void {
    const queue = this.queue(userId);
    if (queue.pending.has(id)) return;
    queue.pending.add(id);
    queue.dirty.add(id);
  }
  async pending(userId: string): Promise<string[]> {
    const queue = this.queue(userId); await queue.ready;
    return [...queue.pending];
  }
  persist(userId: string): Promise<void> {
    const queue = this.queue(userId);
    const operation = queue.writes.catch(() => {}).then(async () => {
      await queue.ready;
      const ids = [...queue.dirty];
      if (!ids.length) return;
      const saved = await queue.db.updateIndexedDbTableEntry<string[]>(queue.key,
        stored => [...new Set([...(stored ?? []), ...ids])]);
      for (const id of saved) queue.pending.add(id);
      for (const id of ids) queue.dirty.delete(id);
    });
    queue.writes = operation;
    return operation;
  }
  acknowledge(userId: string, ids: string[]): Promise<void> {
    const queue = this.queue(userId), acknowledged = new Set(ids);
    const operation = queue.writes.catch(() => {}).then(async () => {
      await queue.ready;
      await queue.db.updateIndexedDbTableEntry<string[]>(queue.key, stored => (stored ?? []).filter(id => !acknowledged.has(id)));
      for (const id of ids) { queue.pending.delete(id); queue.dirty.delete(id); }
    });
    queue.writes = operation;
    return operation;
  }
}

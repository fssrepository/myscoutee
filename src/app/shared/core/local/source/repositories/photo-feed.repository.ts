import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { PHOTO_FEED_TABLE_NAME, type PhotoFeedRecord } from '../entity/photo-feed.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { LocalPhotoFeedMapper } from '../mappers/photo-feed.mapper';
import type { PhotoFeedPost, PhotoFeedFilters } from '../../../contracts/photo-feed.interface';
import { MODERATION_STATUSES } from '../../../contracts/content-moderation.interface';
import type { ListQuery, PageResult } from '../../../contracts/list.interface';
import type { PhotoFeedCounters } from '../../../contracts/photo-feed.interface';
import { CONTENT_MODERATION_TABLE_NAME } from '../entity/content-moderation.entity';
import { changeModerationItem } from '../builders/content-moderation.builder';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

@Injectable({ providedIn: 'root' })
export class LocalPhotoFeedRepository {
  private readonly db = inject(LocalMemoryDb);
  async whenReady(): Promise<void> { await this.db.whenReady(); }
  user(id: string) { return this.db.read()[USERS_TABLE_NAME].byId[id]; }
  find(id: string) { return this.db.read()[PHOTO_FEED_TABLE_NAME].byId[id]; }
  counters(userId: string): PhotoFeedCounters { return this.user(userId)?.feedCounters ?? { revision: 0, counts: {} }; }
  async seenIds(userId: string): Promise<string[]> {
    return await this.db.readIndexedDbTableEntry<string[]>(`${APP_INDEXED_DB_KEYS.photoFeedViewsPrefix}:${userId}`) ?? [];
  }
  async markSeen(userId: string, ids: string[]): Promise<string[]> {
    const allowed = ids.filter(id => { const row = this.find(id); return row && (this.user(row.creatorUserId)?.workspaceGroupId ?? null) === (this.user(userId)?.workspaceGroupId ?? null) && row.creatorUserId !== userId && !row.deleted && row.moderationStatus === 'accepted'; });
    await this.db.updateIndexedDbTableEntry<string[]>(`${APP_INDEXED_DB_KEYS.photoFeedViewsPrefix}:${userId}`,
      previous => [...new Set([...(previous ?? []), ...allowed])]);
    return [...new Set(ids)];
  }
  async remove(userId: string, id: string): Promise<PhotoFeedCounters> {
    this.db.write(state => {
      const row = state[PHOTO_FEED_TABLE_NAME].byId[id];
      if (!row || row.creatorUserId !== userId) throw new Error('feed.removeFailed');
      if (row.deleted) return state;
      const table = state[CONTENT_MODERATION_TABLE_NAME], item = table.items[`feed:${id}`];
      if (!item) throw new Error('feed.removeFailed');
      return { ...state, [CONTENT_MODERATION_TABLE_NAME]: changeModerationItem(table, {
        ...item, deleted: true, version: item.version + 1, commandId: `remove:${item.id}`
      }) };
    });
    await this.db.flushToIndexedDb();
    return this.counters(userId);
  }
  async insert(record: PhotoFeedRecord): Promise<PhotoFeedRecord> {
    let saved = record;
    this.db.write(state => {
      const table = state[PHOTO_FEED_TABLE_NAME];
      if (table.byId[record.id]) { saved = table.byId[record.id]; return state; }
      return { ...state, [PHOTO_FEED_TABLE_NAME]: { byId: { ...table.byId, [record.id]: record }, ids: [...table.ids, record.id] } };
    });
    await this.db.flushToIndexedDb();
    return this.find(saved.id);
  }
  page(viewer: string, origin: { latitude: number; longitude: number }, query: ListQuery<PhotoFeedFilters>, seen = new Set<string>()): PageResult<PhotoFeedPost, PhotoFeedCounters> {
    const table = this.db.read()[PHOTO_FEED_TABLE_NAME];
    const status = query.filters?.status ?? 'public';
    if (status !== 'public' && status !== 'seen' && !MODERATION_STATUSES.includes(status)) throw new Error('Invalid feed status.');
    const discovery = status === 'public' || status === 'seen';
    const items = table.ids.map(id => table.byId[id]).filter(record => (this.user(record.creatorUserId)?.workspaceGroupId ?? null) === (this.user(viewer)?.workspaceGroupId ?? null) && !record.deleted && record.moderationStatus === (discovery ? 'accepted' : status)
      && (discovery ? record.creatorUserId !== viewer && seen.has(record.id) === (status === 'seen') : record.creatorUserId === viewer))
      .map(record => LocalPhotoFeedMapper.toDto(record, origin))
      .sort((a, b) => Math.floor(a.distanceKm / 5) - Math.floor(b.distanceKm / 5)
        || b.createdAtIso.localeCompare(a.createdAtIso) || a.id.localeCompare(b.id));
    let remaining = items;
    if (query.cursor) {
      const [bucketValue, date, id, extra] = query.cursor.split('|');
      const bucket = Number(bucketValue);
      if (!Number.isInteger(bucket) || bucket < 0 || !Number.isFinite(Date.parse(date)) || !id || extra) throw new Error('Invalid feed cursor.');
      remaining = items.filter(item => Math.floor(item.distanceKm / 5) > bucket
        || (Math.floor(item.distanceKm / 5) === bucket && (item.createdAtIso < date || (item.createdAtIso === date && item.id > id))));
    }
    const size = Math.max(1, Math.min(50, query.pageSize || 10));
    const page = remaining.slice(0, size);
    const last = page.at(-1);
    const counters = this.counters(viewer);
    return { items: page, context: counters, total: status === 'public' || status === 'seen' ? items.length : counters.counts[status] ?? 0, nextCursor: remaining.length > size && last
      ? `${Math.floor(last.distanceKm / 5)}|${last.createdAtIso}|${last.id}` : null };
  }
}

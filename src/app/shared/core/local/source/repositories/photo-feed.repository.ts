import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { PHOTO_FEED_TABLE_NAME, type PhotoFeedRecord } from '../entity/photo-feed.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { LocalPhotoFeedMapper } from '../mappers/photo-feed.mapper';
import type { PhotoFeedPost } from '../../../contracts/photo-feed.interface';
import type { ListQuery, PageResult } from '../../../contracts/list.interface';

@Injectable({ providedIn: 'root' })
export class LocalPhotoFeedRepository {
  private readonly db = inject(LocalMemoryDb);
  async whenReady(): Promise<void> { await this.db.whenReady(); }
  user(id: string) { return this.db.read()[USERS_TABLE_NAME].byId[id]; }
  find(id: string) { return this.db.read()[PHOTO_FEED_TABLE_NAME].byId[id]; }
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
  page(viewer: string, origin: { latitude: number; longitude: number }, query: ListQuery): PageResult<PhotoFeedPost> {
    const table = this.db.read()[PHOTO_FEED_TABLE_NAME];
    const items = table.ids.map(id => table.byId[id]).filter(record => record.moderationStatus === 'accepted' || record.creatorUserId === viewer)
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
    return { items: page, total: items.length, nextCursor: remaining.length > size && last
      ? `${Math.floor(last.distanceKm / 5)}|${last.createdAtIso}|${last.id}` : null };
  }
}

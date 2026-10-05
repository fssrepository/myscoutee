import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { COMMUNITY_ANNOUNCEMENTS_TABLE_NAME, type CommunityAnnouncementRecord } from '../entity/community-announcement.entity';

@Injectable({ providedIn: 'root' })
export class LocalCommunityAnnouncementsRepository {
  private readonly db = inject(LocalMemoryDb);
  ready() { return this.db.whenReady(); }
  flush() { return this.db.flushToIndexedDb(); }
  find(id: string) { return this.db.read()[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME].byId[id] ?? null; }
  records() { const t = this.db.read()[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME]; return t.ids.map(id => t.byId[id]); }
  save(record: CommunityAnnouncementRecord, expected?: number): CommunityAnnouncementRecord {
    this.db.write(state => {
      const t = state[COMMUNITY_ANNOUNCEMENTS_TABLE_NAME];
      if (t.byId[record.id]?.version !== expected) throw new Error('announcement.changed');
      return { ...state, [COMMUNITY_ANNOUNCEMENTS_TABLE_NAME]: { ids: t.byId[record.id] ? t.ids : [...t.ids, record.id], byId: { ...t.byId, [record.id]: structuredClone(record) } } };
    }); return record;
  }
}

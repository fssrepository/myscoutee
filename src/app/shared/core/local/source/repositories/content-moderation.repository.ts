import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { CONTENT_MODERATION_TABLE_NAME, type ContentModerationTable } from '../entity/content-moderation.entity';
import { changeModerationItem } from '../builders/content-moderation.builder';
import type { ContentModerationDecision, ContentModerationSettings, ContentModerationSnapshot, ModerationCategory, ModerationStatus } from '../../../contracts/content-moderation.interface';
import type { ListQuery } from '../../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class LocalContentModerationRepository {
  private readonly db = inject(LocalMemoryDb);
  async whenReady() { await this.db.whenReady(); }
  state(): ContentModerationTable { return this.db.read()[CONTENT_MODERATION_TABLE_NAME]; }
  snapshot(): ContentModerationSnapshot { const { items, ...snapshot } = this.state(); return snapshot; }
  item(id: string) { return this.state().items[id]; }
  page(category: ModerationCategory, status: ModerationStatus, query: ListQuery) {
    const snapshot = this.snapshot();
    const rows = Object.values(this.state().items).filter(item => item.category === category && item.status === status && (!query.cursor || item.id > query.cursor))
      .sort((a,b) => a.id.localeCompare(b.id));
    const limit = Math.max(1, Math.min(50, query.pageSize || 10));
    const items = rows.slice(0, limit);
    return { items, total: snapshot.counts[category]?.[status] ?? 0, snapshot, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
  }
  async saveSettings(settings: ContentModerationSettings, revision: number) {
    this.db.write(state => {
      const current = state[CONTENT_MODERATION_TABLE_NAME];
      if (current.revision !== revision) throw new Error('moderation.changed');
      return { ...state, [CONTENT_MODERATION_TABLE_NAME]: { ...current, revision: revision + 1, settings: { ...settings, categories: [...settings.categories] } } };
    });
    await this.db.flushToIndexedDb(); return this.snapshot();
  }
  async decide(id: string, request: ContentModerationDecision) {
    this.db.write(state => {
      const current = state[CONTENT_MODERATION_TABLE_NAME], item = current.items[id];
      if (!item) throw new Error('moderation.changed');
      if (item.commandId === request.commandId) return state;
      if (item.version !== request.expectedVersion) throw new Error('moderation.changed');
      return { ...state, [CONTENT_MODERATION_TABLE_NAME]: changeModerationItem(current, { ...item, status: request.status,
        version: item.version + 1, commandId: request.commandId, reviewedBy: request.adminUserId, reviewedAtIso: new Date().toISOString() }) };
    });
    await this.db.flushToIndexedDb(); return this.snapshot();
  }
  async approveDue(now = Date.now()): Promise<number> {
    let changed = 0;
    this.db.write(state => {
      let table = state[CONTENT_MODERATION_TABLE_NAME]; const settings = table.settings;
      if (!settings.autoApprove) return state;
      for (const item of Object.values(table.items)) {
        if (item.status !== 'under-review' || !settings.categories.includes(item.category)
          || Date.parse(item.submittedAtIso) + settings.delayMinutes * 60000 > now) continue;
        table = changeModerationItem(table, { ...item, status: 'accepted', version: item.version + 1,
          commandId: `auto:${item.id}:${item.version}`, reviewedBy: 'content-auto-approve', reviewedAtIso: new Date(now).toISOString() }); changed++;
      }
      return changed ? { ...state, [CONTENT_MODERATION_TABLE_NAME]: table } : state;
    });
    if (changed) await this.db.flushToIndexedDb(); return changed;
  }
}

import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { CONTENT_MODERATION_TABLE_NAME, contentModerationSnapshot, type ContentModerationTable } from '../entity/content-moderation.entity';
import { changeModerationItem } from '../builders/content-moderation.builder';
import type { ContentModerationDecision, ContentModerationSettings, ContentModerationSnapshot, ModerationCategoryFilter, ModerationStatus } from '../../../contracts/content-moderation.interface';
import { moderationCount, moderationDecisionAllowed } from '../../../contracts/content-moderation.interface';
import type { ListQuery } from '../../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class LocalContentModerationRepository {
  private readonly db = inject(LocalMemoryDb);
  async whenReady() { await this.db.whenReady(); }
  state(): ContentModerationTable { return this.db.read()[CONTENT_MODERATION_TABLE_NAME]; }
  snapshot(groupId?: string | null): ContentModerationSnapshot { return contentModerationSnapshot(this.state(), groupId); }
  item(id: string) { return this.state().items[id]; }
  page(category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery, groupId?: string | null) {
    const snapshot = this.snapshot(groupId);
    const rows = Object.values(this.state().items).filter(item => !item.deleted && (item.workspaceGroupId ?? null) === (groupId ?? null) && (category === 'all' || item.category === category) && item.status === status && (!query.cursor || item.id > query.cursor))
      .sort((a,b) => a.id.localeCompare(b.id));
    const limit = Math.max(1, Math.min(50, query.pageSize || 10));
    const items = rows.slice(0, limit);
    return { items, total: moderationCount(snapshot, category, status), snapshot, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
  }
  async saveSettings(settings: ContentModerationSettings, revision: number, groupId?: string | null) {
    this.db.write(state => {
      const current = state[CONTENT_MODERATION_TABLE_NAME];
      const scope = contentModerationSnapshot(current, groupId);
      if (scope.revision !== revision) throw new Error('moderation.changed');
      const updated = { ...scope, revision: revision + 1, settings: { ...settings, categories: [...settings.categories] } };
      return { ...state, [CONTENT_MODERATION_TABLE_NAME]: { ...current,
        ...(groupId ? { scopes: { ...current.scopes, [groupId]: updated } } : updated) } };
    });
    await this.db.flushToIndexedDb(); return this.snapshot(groupId);
  }
  async decide(id: string, request: ContentModerationDecision, admin?: import('../../../contracts/admin.interface').AdminUserDto) {
    this.db.write(state => {
      const current = state[CONTENT_MODERATION_TABLE_NAME], item = current.items[id];
      if (!item || item.deleted) throw new Error('moderation.changed');
      if (item.commandId === request.commandId) return state;
      if (!contentModerationSnapshot(current, item.workspaceGroupId).settings.enabled && request.status !== 'accepted') throw new Error('moderation.changed');
      if (item.version !== request.expectedVersion) throw new Error('moderation.changed');
      if (!moderationDecisionAllowed(item, request.status)) throw new Error('moderation.failed');
      const next = changeModerationItem(current, { ...item, status: request.status,
        version: item.version + 1, commandId: request.commandId, reviewedBy: request.adminUserId, reviewedAtIso: new Date().toISOString() });
      if (request.message.trim() && ['rejected', 'blocked'].includes(request.status)) {
        if (!admin) throw new Error('moderation.failed');
        next.pendingMessages = [...(current.pendingMessages ?? []), { commandId: request.commandId, ownerUserId: item.ownerUserId, message: request.message.trim(), admin }];
      }
      return { ...state, [CONTENT_MODERATION_TABLE_NAME]: next };
    });
    await this.db.flushToIndexedDb(); return this.snapshot();
  }
  async acknowledgeMessage(commandId: string) {
    this.db.write(state => ({ ...state, [CONTENT_MODERATION_TABLE_NAME]: { ...state[CONTENT_MODERATION_TABLE_NAME],
      pendingMessages: (state[CONTENT_MODERATION_TABLE_NAME].pendingMessages ?? []).filter(item => item.commandId !== commandId) } }));
    await this.db.flushToIndexedDb();
  }
  async approveDue(now = Date.now()): Promise<number> {
    let changed = 0;
    this.db.write(state => {
      let table = state[CONTENT_MODERATION_TABLE_NAME];
      for (const item of Object.values(table.items)) {
        if (item.deleted) continue;
        if (changed >= 100) break;
        const settings = contentModerationSnapshot(table, item.workspaceGroupId).settings;
        if (settings.enabled && !settings.autoApprove) continue;
        if (settings.enabled ? item.status !== 'under-review' || !settings.categories.includes(item.category)
          || Date.parse(item.submittedAtIso) + settings.delayMinutes * 60000 > now : item.status === 'accepted') continue;
        table = changeModerationItem(table, { ...item, status: 'accepted', version: item.version + 1,
          commandId: `${settings.enabled ? 'auto' : 'disable'}:${item.id}:${item.version}`, reviewedBy: settings.enabled ? 'content-auto-approve' : 'content-moderation-disabled', reviewedAtIso: new Date(now).toISOString() }); changed++;
      }
      return changed ? { ...state, [CONTENT_MODERATION_TABLE_NAME]: table } : state;
    });
    if (changed) await this.db.flushToIndexedDb(); return changed;
  }
}

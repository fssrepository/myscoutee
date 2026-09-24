import type { AppMemorySchema } from '../../common/memory.schema';
import { moderationHasBeenPublic, type ContentModerationItem, type ModerationCategory } from '../../../contracts/content-moderation.interface';
import { CONTENT_MODERATION_TABLE_NAME, contentModerationSnapshot, type ContentModerationTable } from '../entity/content-moderation.entity';
import { ASSETS_TABLE_NAME } from '../entity/asset.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { PHOTO_FEED_TABLE_NAME } from '../entity/photo-feed.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { COMMUNITY_GROUPS_TABLE_NAME } from '../entity/community-group.entity';
import { MODERATION_STATUSES } from '../../../contracts/content-moderation.interface';

export function changeModerationItem(table: ContentModerationTable, item: ContentModerationItem): ContentModerationTable {
  const previous = table.items[item.id];
  item = { ...item, publiclyVisibleOnce: moderationHasBeenPublic(item) || (!!previous && moderationHasBeenPublic(previous)) };
  const scope = contentModerationSnapshot(table, item.workspaceGroupId);
  const counts = { ...scope.counts, [item.category]: { ...(scope.counts[item.category] ?? {}) } };
  if (previous && !previous.deleted) counts[item.category][previous.status] = (counts[item.category][previous.status] ?? 0) - 1;
  if (!item.deleted) counts[item.category][item.status] = (counts[item.category][item.status] ?? 0) + 1;
  const updated = { ...scope, revision: scope.revision + 1, counts,
    pendingCount: scope.pendingCount + Number(!item.deleted && item.status === 'under-review') - Number(!!previous && !previous.deleted && previous.status === 'under-review') };
  return { ...table, ...(item.workspaceGroupId ? { scopes: { ...table.scopes, [item.workspaceGroupId]: updated } } : updated),
    items: { ...table.items, [item.id]: item } };
}

/** Canonical write hook: applies deltas for submissions and the saved decision to the underlying item. */
export function maintainContentModeration(previous: AppMemorySchema, next: AppMemorySchema): AppMemorySchema {
  let moderation = next[CONTENT_MODERATION_TABLE_NAME];
  const decisionChanged = previous[CONTENT_MODERATION_TABLE_NAME] !== moderation;
  const mappings = [[ASSETS_TABLE_NAME, 'asset'], [EVENTS_TABLE_NAME, 'event'], [PHOTO_FEED_TABLE_NAME, 'feed'], [COMMUNITY_GROUPS_TABLE_NAME, 'group']] as const;
  let result = next;
  for (const [tableKey, category] of mappings) {
    if (!decisionChanged && previous[tableKey] === next[tableKey]) continue;
    const table = next[tableKey];
    const records = table.byId as unknown as Record<string, Record<string, unknown>>;
    const old = previous[tableKey].byId as unknown as Record<string, Record<string, unknown>>;
    let updated = records;
    for (const [key, value] of Object.entries(records)) {
      if (!decisionChanged && old[key] === value) continue;
      if (category === 'event' && (value['generated'] || value['parentEventId'] || value['status'] === 'DR')) continue;
      const sourceId = String(value['id'] ?? key);
      const id = `${category}:${sourceId}`;
      let item = moderation.items[id];
      if (!item && old[key] !== value && !['T', 'D', 'I'].includes(String(value['status'] ?? 'A'))) {
        const ownerUserId = String(value['creatorUserId'] ?? value['ownerUserId'] ?? value['userId'] ?? '');
        const workspaceGroupId = category === 'group' ? null : next[USERS_TABLE_NAME].byId[ownerUserId]?.workspaceGroupId ?? null;
        const settings = contentModerationSnapshot(moderation, workspaceGroupId).settings;
        const status = !settings.enabled || (settings.autoApprove && settings.delayMinutes === 0 && settings.categories.includes(category))
          ? 'accepted' : 'under-review';
        const images = value['imageUrls'] as string[] | undefined;
        item = { id, category, sourceId, ownerUserId, workspaceGroupId,
          title: String(value['title'] ?? value['name'] ?? value['creatorName'] ?? ''), imageUrl: String(value['imageUrl'] ?? images?.[0] ?? ''),
          submittedAtIso: new Date().toISOString(), status, version: 1, commandId: `submit:${id}`, reviewedBy: '', reviewedAtIso: '' };
        moderation = changeModerationItem(moderation, item);
      }
      if (!item) continue;
      if (category === 'group' && value['moderationStatus'] === item.status) continue;
      const patch: Record<string, unknown> = { ...value, moderationStatus: item.status };
      if (category === 'group') patch['version'] = Number(value['version'] ?? 0) + 1;
      if (category === 'feed') patch['deleted'] = !!item.deleted;
      if (category !== 'feed' && category !== 'group') {
        if (item.status === 'accepted') {
          if (value['moderationPreviousStatus']) {
            if (value['status'] === 'B') patch['status'] = value['moderationPreviousStatus'];
            delete patch['moderationPreviousStatus'];
          }
        } else if (!['DR', 'T', 'D'].includes(String(value['status']))) {
          patch['moderationPreviousStatus'] = value['moderationPreviousStatus'] ?? value['status'] ?? 'A';
          patch['status'] = 'B';
        }
      }
      if (updated === records) updated = { ...records };
      updated[key] = patch;
    }
    if (updated !== records) result = { ...result, [tableKey]: { ...table, byId: updated } } as AppMemorySchema;
  }
  for (const [groupId, scope] of Object.entries(moderation.scopes ?? {})) {
    if (scope === previous[CONTENT_MODERATION_TABLE_NAME].scopes?.[groupId]) continue;
    const table = result[COMMUNITY_GROUPS_TABLE_NAME], group = table.byId[groupId];
    if (!group || (group.moderationQueueRevision ?? -1) >= scope.revision) continue;
    // Persist the committed counter in the same memory write as the decision/submission.
    result = { ...result, [COMMUNITY_GROUPS_TABLE_NAME]: { ...table, byId: { ...table.byId,
      [groupId]: { ...group, moderationPending: scope.pendingCount, moderationQueueRevision: scope.revision, version: group.version + 1 }
    } } };
  }
  if (previous[PHOTO_FEED_TABLE_NAME] !== result[PHOTO_FEED_TABLE_NAME]) {
    const oldRows = previous[PHOTO_FEED_TABLE_NAME].byId;
    const rows = result[PHOTO_FEED_TABLE_NAME].byId;
    const owners = new Set<string>();
    for (const id of new Set([...Object.keys(oldRows), ...Object.keys(rows)])) {
      if (oldRows[id] === rows[id]) continue;
      if (oldRows[id]) owners.add(oldRows[id].creatorUserId);
      if (rows[id]) owners.add(rows[id].creatorUserId);
    }
    const users = result[USERS_TABLE_NAME];
    const byId = { ...users.byId };
    for (const owner of owners) {
      const user = byId[owner];
      if (!user) continue;
      const counts = Object.fromEntries(MODERATION_STATUSES.map(status => [status, 0])) as Record<import('../../../contracts/content-moderation.interface').ModerationStatus, number>;
      for (const row of Object.values(rows)) if (!row.deleted && row.creatorUserId === owner && row.moderationStatus) counts[row.moderationStatus]++;
      if (MODERATION_STATUSES.every(status => user.feedCounters?.counts[status] === counts[status])) continue;
      byId[owner] = { ...user, feedCounters: { revision: (user.feedCounters?.revision ?? 0) + 1, counts } };
    }
    result = { ...result, [USERS_TABLE_NAME]: { ...users, byId } };
  }
  return moderation === result[CONTENT_MODERATION_TABLE_NAME] ? result : { ...result, [CONTENT_MODERATION_TABLE_NAME]: moderation };
}

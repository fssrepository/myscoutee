import type { AppMemorySchema } from '../../common/memory.schema';
import type { ContentModerationItem, ModerationCategory } from '../../../contracts/content-moderation.interface';
import { CONTENT_MODERATION_TABLE_NAME, type ContentModerationTable } from '../entity/content-moderation.entity';
import { ASSETS_TABLE_NAME } from '../entity/asset.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { PHOTO_FEED_TABLE_NAME } from '../entity/photo-feed.entity';

export function changeModerationItem(table: ContentModerationTable, item: ContentModerationItem): ContentModerationTable {
  const previous = table.items[item.id];
  const counts = { ...table.counts, [item.category]: { ...(table.counts[item.category] ?? {}) } };
  if (previous) counts[item.category][previous.status] = (counts[item.category][previous.status] ?? 0) - 1;
  counts[item.category][item.status] = (counts[item.category][item.status] ?? 0) + 1;
  return { ...table, revision: table.revision + 1, counts,
    pendingCount: table.pendingCount + Number(item.status === 'under-review') - Number(previous?.status === 'under-review'),
    items: { ...table.items, [item.id]: item } };
}

/** Canonical write hook: applies deltas for submissions and the saved decision to the underlying item. */
export function maintainContentModeration(previous: AppMemorySchema, next: AppMemorySchema): AppMemorySchema {
  let moderation = next[CONTENT_MODERATION_TABLE_NAME];
  const decisionChanged = previous[CONTENT_MODERATION_TABLE_NAME] !== moderation;
  const mappings = [[ASSETS_TABLE_NAME, 'asset'], [EVENTS_TABLE_NAME, 'event'], [PHOTO_FEED_TABLE_NAME, 'feed']] as const;
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
        const status = 'under-review';
        const images = value['imageUrls'] as string[] | undefined;
        item = { id, category, sourceId, ownerUserId: String(value['creatorUserId'] ?? value['ownerUserId'] ?? value['userId'] ?? ''),
          title: String(value['title'] ?? value['creatorName'] ?? ''), imageUrl: String(value['imageUrl'] ?? images?.[0] ?? ''),
          submittedAtIso: new Date().toISOString(), status, version: 1, commandId: `submit:${id}`, reviewedBy: '', reviewedAtIso: '' };
        moderation = changeModerationItem(moderation, item);
      }
      if (!item) continue;
      const patch: Record<string, unknown> = { ...value, moderationStatus: item.status };
      if (category !== 'feed') {
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
  return moderation === result[CONTENT_MODERATION_TABLE_NAME] ? result : { ...result, [CONTENT_MODERATION_TABLE_NAME]: moderation };
}

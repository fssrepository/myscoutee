import { MODERATION_CATEGORIES, type ContentModerationSnapshot, type ContentModerationItem } from '../../../contracts/content-moderation.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
export const CONTENT_MODERATION_TABLE_NAME = APP_INDEXED_DB_KEYS.contentModeration;
export interface ContentModerationTable extends ContentModerationSnapshot {
  items: Record<string, ContentModerationItem>;
  pendingMessages: { commandId: string; ownerUserId: string; message: string; admin: import('../../../contracts/admin.interface').AdminUserDto }[];
}
export interface ContentModerationMemorySchema { [CONTENT_MODERATION_TABLE_NAME]: ContentModerationTable; }
export function emptyContentModeration(): ContentModerationTable {
  return { revision: 0, settings: { enabled: false, autoApprove: false, delayMinutes: 0, categories: [...MODERATION_CATEGORIES] }, counts: {}, pendingCount: 0, items: {}, pendingMessages: [] };
}

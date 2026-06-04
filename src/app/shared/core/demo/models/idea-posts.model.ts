import type { IdeaPost } from '../../base/models';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const IDEA_POSTS_TABLE_NAME = APP_INDEXED_DB_KEYS.ideaPosts;

export interface DemoIdeaPostsTable {
  seeded: boolean;
  byId: Record<string, IdeaPost>;
  ids: string[];
}

export interface DemoIdeaPostsMemorySchema {
  [IDEA_POSTS_TABLE_NAME]: DemoIdeaPostsTable;
}

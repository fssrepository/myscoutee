import type { IdeaPost } from '../../base/models';

export const IDEA_POSTS_TABLE_NAME = 'ideaPosts';

export interface DemoIdeaPostsTable {
  seeded: boolean;
  byId: Record<string, IdeaPost>;
  ids: string[];
}

export interface DemoIdeaPostsMemorySchema {
  [IDEA_POSTS_TABLE_NAME]: DemoIdeaPostsTable;
}

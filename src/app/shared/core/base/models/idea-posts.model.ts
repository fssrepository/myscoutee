import type { IdeaPostDto } from '../../contracts/content.interface';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const IDEA_POSTS_TABLE_NAME = APP_INDEXED_DB_KEYS.ideaPosts;

export interface IdeaPostsTable {
  seeded: boolean;
  byId: Record<string, IdeaPostDto>;
  ids: string[];
}

export interface IdeaPostsMemorySchema {
  [IDEA_POSTS_TABLE_NAME]: IdeaPostsTable;
}

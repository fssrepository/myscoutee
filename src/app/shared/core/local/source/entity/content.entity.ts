import type { IdeaPostDto } from '../../../contracts/content.interface';
import type { HelpCenterAuditEntry, HelpCenterRevision, PrivacyConsentRecord } from '../../../contracts/content.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const HELP_CENTER_TABLE_NAME = APP_INDEXED_DB_KEYS.helpCenter;
export const IDEA_POSTS_TABLE_NAME = APP_INDEXED_DB_KEYS.ideaPosts;

export interface HelpCenterTable {
  seeded: boolean;
  activeRevisionId: string | null;
  seededKinds?: Record<string, boolean>;
  activeRevisionIdsByKind?: Record<string, string | null>;
  revisionsById: Record<string, HelpCenterRevision>;
  revisionIds: string[];
  auditById: Record<string, HelpCenterAuditEntry>;
  auditIds: string[];
  privacyConsentsById?: Record<string, PrivacyConsentRecord>;
  privacyConsentIds?: string[];
}

export interface HelpCenterMemorySchema {
  [HELP_CENTER_TABLE_NAME]: HelpCenterTable;
}

export interface IdeaPostsTable {
  seeded: boolean;
  byId: Record<string, IdeaPostDto>;
  ids: string[];
}

export interface IdeaPostsMemorySchema {
  [IDEA_POSTS_TABLE_NAME]: IdeaPostsTable;
}

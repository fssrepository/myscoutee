import type { IdeaPostDto } from '../../../contracts/content.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const HELP_CENTER_TABLE_NAME = APP_INDEXED_DB_KEYS.helpCenter;
export const IDEA_POSTS_TABLE_NAME = APP_INDEXED_DB_KEYS.ideaPosts;

export interface HelpCenterSectionRecord {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  contentHtml: string;
  imageUrls?: string[];
  panelSpan?: string;
  optional?: boolean;
  details?: string[];
  points?: string[];
}

export interface HelpCenterRevisionRecord {
  id: string;
  documentKind?: string;
  contextKey?: string | null;
  lang: string;
  languageLabel: string;
  version: number;
  title: string;
  summary: string;
  description: string;
  headerColor?: string;
  sections: HelpCenterSectionRecord[];
  active: boolean;
  createdAtIso: string;
  createdByUserId: string;
  updatedAtIso: string;
  updatedByUserId: string;
}

export interface HelpCenterAuditRecord {
  id: string;
  documentKind?: string;
  lang?: string;
  languageLabel?: string;
  revisionId: string | null;
  version: number | null;
  action: string;
  actorUserId: string;
  createdAtIso: string;
  message: string;
}

export interface PrivacyConsentLocalRecord {
  id: string;
  userId: string;
  revisionId: string;
  revisionVersion: number;
  approvedOptionalSectionIds: string[];
  acceptedAtIso: string;
  updatedAtIso: string;
  source: string;
}

export interface HelpCenterTable {
  seeded: boolean;
  activeRevisionId: string | null;
  seededKinds?: Record<string, boolean>;
  activeRevisionIdsByKind?: Record<string, string | null>;
  revisionsById: Record<string, HelpCenterRevisionRecord>;
  revisionIds: string[];
  auditById: Record<string, HelpCenterAuditRecord>;
  auditIds: string[];
  privacyConsentsById?: Record<string, PrivacyConsentLocalRecord>;
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

import type { HelpCenterAuditEntry, HelpCenterRevision, PrivacyConsentRecord } from '.';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const HELP_CENTER_TABLE_NAME = APP_INDEXED_DB_KEYS.helpCenter;

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

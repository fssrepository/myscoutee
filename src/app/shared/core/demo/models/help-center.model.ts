import type { HelpCenterAuditEntry, HelpCenterRevision, PrivacyConsentRecord } from '../../base/models';

export const HELP_CENTER_TABLE_NAME = 'helpCenter';

export interface DemoHelpCenterTable {
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

export interface DemoHelpCenterMemorySchema {
  [HELP_CENTER_TABLE_NAME]: DemoHelpCenterTable;
}

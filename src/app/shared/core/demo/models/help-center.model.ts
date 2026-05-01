import type { HelpCenterAuditEntry, HelpCenterRevision } from '../../base/models';

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
}

export interface DemoHelpCenterMemorySchema {
  [HELP_CENTER_TABLE_NAME]: DemoHelpCenterTable;
}

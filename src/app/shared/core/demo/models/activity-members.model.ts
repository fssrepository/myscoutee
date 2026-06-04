import type { ActivityMemberOwnerType } from '../../../core/base/models';
import type * as AppTypes from '../../../core/base/models';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const ACTIVITY_MEMBERS_TABLE_NAME = APP_INDEXED_DB_KEYS.activityMembers;

export interface DemoActivityMemberRecord extends AppTypes.ActivityMemberEntry {
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
  ownerKey: string;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface DemoActivityMembersRecordCollection {
  byId: Record<string, DemoActivityMemberRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type DemoActivityMembersMemorySchema = Record<typeof ACTIVITY_MEMBERS_TABLE_NAME, DemoActivityMembersRecordCollection>;

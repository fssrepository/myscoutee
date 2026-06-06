import type { ActivityMemberOwnerType } from '.';
import type * as AppTypes from '.';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const ACTIVITY_MEMBERS_TABLE_NAME = APP_INDEXED_DB_KEYS.activityMembers;

export interface ActivityMemberRecord extends AppTypes.ActivityMemberEntry {
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
  ownerKey: string;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ActivityMembersRecordCollection {
  byId: Record<string, ActivityMemberRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type ActivityMembersMemorySchema = Record<typeof ACTIVITY_MEMBERS_TABLE_NAME, ActivityMembersRecordCollection>;

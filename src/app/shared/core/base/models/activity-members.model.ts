import { APP_INDEXED_DB_KEYS } from '../storage-scope';
import type { ActivityMemberEntry, ActivityMemberOwnerType } from '../../contracts/activity.interface';

export const ACTIVITY_MEMBERS_TABLE_NAME = APP_INDEXED_DB_KEYS.activityMembers;

export interface ActivityMemberRecord extends ActivityMemberEntry {
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

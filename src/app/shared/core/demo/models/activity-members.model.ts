import type { ActivityMemberOwnerType } from '../../../activities-models';
import type * as AppTypes from '../../../app-types';

export const ACTIVITY_MEMBERS_TABLE_NAME = 'activityMembers' as const;

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
}

export type DemoActivityMembersMemorySchema = Record<typeof ACTIVITY_MEMBERS_TABLE_NAME, DemoActivityMembersRecordCollection>;

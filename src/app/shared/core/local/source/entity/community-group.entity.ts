import type { CommunityGroup } from '../../../contracts/community-group.interface';
export const COMMUNITY_GROUPS_TABLE_NAME = 'communityGroups' as const;
export type CommunityGroupRecord = Pick<CommunityGroup, 'id' | 'ownerUserId' | 'name' | 'description' | 'imageUrl'
  | 'category' | 'visibility' | 'hideMembers' | 'policy' | 'createdAtIso' | 'updatedAtIso' | 'version' | 'moderationStatus' | 'moderationPending' | 'moderationQueueRevision'> & { pendingMembers?: number };
export interface CommunityGroupsMemorySchema {
  [COMMUNITY_GROUPS_TABLE_NAME]: { byId: Record<string, CommunityGroupRecord>; ids: string[] };
}

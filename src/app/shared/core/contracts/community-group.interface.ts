import type { ListQuery, PageResult } from './list.interface';
export const GROUP_CATEGORIES = ['friends', 'work', 'sport', 'learning', 'hobbies', 'neighbourhood'] as const;
export type GroupCategory = typeof GROUP_CATEGORIES[number];
export type GroupVisibility = 'public' | 'private' | 'invitation';
export type GroupBucket = 'hosting' | 'participation' | 'explore';
export interface GroupPolicy { workspace: boolean; enabled: boolean; requiredFields: string[]; }
export interface CommunityGroup {
  id: string; ownerUserId: string; ownerName: string; ownerAvatarUrl: string | null;
  name: string; description: string; imageUrl: string | null; category: GroupCategory;
  visibility: GroupVisibility; hideMembers: boolean; policy: GroupPolicy;
  createdAtIso: string; updatedAtIso: string; version: number;
  role: 'Admin' | 'Member' | null; membershipStatus: 'accepted' | 'pending' | null;
  requestKind: 'invite' | 'join' | null; organizerOnly: boolean;
  acceptedMembers: number; pendingMembers: number; activity: number; distanceKm: number | null;
}
export interface SaveCommunityGroup {
  userId: string; id?: string; name: string; description: string; imageUrl: string | null;
  category: GroupCategory; visibility: GroupVisibility; hideMembers: boolean; policy: GroupPolicy; version?: number;
}
export interface GroupFilters { bucket: GroupBucket; category?: GroupCategory | null; }
export interface GroupCounters { hosting: number; participation: number; }
export interface ICommunityGroupsService {
  page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroup, GroupCounters>>;
  detail(userId: string, id: string): Promise<CommunityGroup>;
  save(request: SaveCommunityGroup): Promise<CommunityGroup>;
  join(userId: string, groupId: string): Promise<CommunityGroup>;
}

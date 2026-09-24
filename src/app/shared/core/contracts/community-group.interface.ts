import type { UserDto } from './user.interface';
import type { ListQuery, PageResult } from './list.interface';
export const GROUP_CATEGORIES = ['friends', 'work', 'sport', 'learning', 'hobbies', 'neighbourhood'] as const;
export type GroupCategory = typeof GROUP_CATEGORIES[number];
export type GroupVisibility = 'public' | 'private' | 'invitation';
export type GroupBucket = 'hosting' | 'participation' | 'explore';
export interface GroupPolicy { workspace: boolean; enabled: boolean; requiredFields: string[]; }
export interface CommunityGroup {
  moderationStatus?: import('./content-moderation.interface').ModerationStatus | null;
  revision?: string;
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
export interface GroupWorkspace {
  groupId: string; profileId: string; name: string; role: string; activity: number; policy: GroupPolicy;
}
export interface GroupWorkspaceSelection { workspace: GroupWorkspace | null; profile: UserDto; }
export interface GroupSyncRequest { bucket: GroupBucket; category?: GroupCategory | null; limit: number; knownItems: readonly { id: string; revision: string }[]; tailId: string | null; }
export interface GroupSyncResponse { upserts: CommunityGroup[]; removedIds: string[]; total: number; }
export interface ICommunityGroupsService {
  sync(userId: string, request: GroupSyncRequest, signal?: AbortSignal): Promise<GroupSyncResponse>;
  workspaces(userId: string): Promise<GroupWorkspace[]>;
  selectWorkspace(userId: string, groupId: string | null): Promise<GroupWorkspaceSelection>;
  page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroup, GroupCounters>>;
  detail(userId: string, id: string): Promise<CommunityGroup>;
  save(request: SaveCommunityGroup): Promise<CommunityGroup>;
  join(userId: string, groupId: string): Promise<CommunityGroup>;
  report(userId: string, groupId: string, details: string): Promise<void>;
}

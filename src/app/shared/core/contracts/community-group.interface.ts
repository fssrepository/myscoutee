import type { UserDto } from './user.interface';
import type { ListQuery, PageResult } from './list.interface';
export const GROUP_CATEGORIES = ['friends', 'work', 'sport', 'learning', 'hobbies', 'neighbourhood'] as const;
export type GroupCategory = typeof GROUP_CATEGORIES[number];
export type GroupVisibility = 'public' | 'private' | 'invitation';
export type GroupBucket = 'hosting' | 'participation' | 'pending' | 'invitations' | 'explore';
export function groupMembershipBucket(group: { role?: string | null; membershipStatus?: string | null; requestKind?: string | null }): GroupBucket {
  if (group.membershipStatus === 'accepted' && group.role === 'Admin') return 'hosting';
  if (group.membershipStatus === 'pending' && group.requestKind === 'invite') return 'invitations';
  if (group.membershipStatus === 'pending') return 'pending';
  return group.membershipStatus === 'accepted' ? 'participation' : 'explore';
}
export type GroupSort = 'distance' | 'updated';
export function groupSort(bucket: GroupBucket, sort?: string | null): GroupSort {
  return sort === 'distance' || sort === 'updated' ? sort : bucket === 'explore' ? 'distance' : 'updated';
}
export interface GroupPolicy {
  workspace: boolean; enabled: boolean; requiredFields: string[];
  policiesEnabled?: boolean;
  policies?: import('./event.interface').EventPolicyDTO[];
}
export interface CommunityGroup {
  membersActivity?: number;
  moderationPending?: number;
  moderationQueueRevision?: number;
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
export type CommunityGroupSummary = Omit<CommunityGroup, 'description' | 'policy'>;
export function canPreviewGroupMembers(group: CommunityGroupSummary): boolean {
  return !group.hideMembers || (group.role === 'Admin' && group.membershipStatus === 'accepted');
}
export function communityGroupSummary(group: CommunityGroup | CommunityGroupSummary): CommunityGroupSummary {
  const { description, policy, ...summary } = group as CommunityGroup;
  return summary;
}
export interface GroupFilters { bucket: GroupBucket; category?: GroupCategory | null; }
export interface GroupCounters { hosting: number; participation: number; pending: number; invitations: number; }
export interface GroupWorkspace {
  membersActivity?: number;
  moderationPending?: number;
  moderationQueueRevision?: number;
  category?: GroupCategory; membershipStatus?: 'accepted' | 'pending';
  requestKind?: 'invite' | 'join' | null;
  groupId: string; profileId: string | null; name: string; role: string; activity: number; policy: GroupPolicy;
}
export interface GroupWorkspaceSelection { workspace: GroupWorkspace | null; profile: UserDto; accountProfile?: UserDto | null; }
export interface GroupSyncRequest { bucket: GroupBucket; category?: GroupCategory | null; sort?: GroupSort; limit: number; knownItems: readonly { id: string; revision: string }[]; tailId: string | null; }
export interface GroupSyncResponse { upserts: CommunityGroupSummary[]; removedIds: string[]; total: number; }
export interface ICommunityGroupsService {
  sync(userId: string, request: GroupSyncRequest, signal?: AbortSignal): Promise<GroupSyncResponse>;
  workspaces(userId: string): Promise<GroupWorkspace[]>;
  page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroupSummary, GroupCounters>>;
  detail(userId: string, id: string, signal?: AbortSignal): Promise<CommunityGroup>;
  save(request: SaveCommunityGroup): Promise<CommunityGroup>;
  join(userId: string, groupId: string): Promise<CommunityGroup>;
  report(userId: string, groupId: string, details: string): Promise<void>;
}

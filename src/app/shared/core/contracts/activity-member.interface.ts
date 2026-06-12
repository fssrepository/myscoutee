import type { UserDto } from './user.interface';

export type ActivityMemberStatus = 'pending' | 'accepted' | 'disqualified';
export type ActivityPendingSource = 'admin' | 'member' | null;
export type ActivityInviteSort = 'recent' | 'relevant';
export type ActivityMemberRequestKind = 'invite' | 'join' | 'waitlist' | 'waitlist-invite' | null;
export type ActivityMemberRole = 'Admin' | 'Member' | 'Manager';
export type ActivityMemberOwnerType = 'event' | 'subEvent' | 'group' | 'asset';

export interface ActivityMemberEntry {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  city: string;
  statusText: string;
  role: ActivityMemberRole;
  status: ActivityMemberStatus;
  pendingSource: ActivityPendingSource;
  requestKind: ActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  invitedByUserId?: string | null;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  avatarUrl: string;
  profile?: UserDto | null;
}

export interface ActivityMemberOwnerRef {
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
}

export interface ActivityMembersSummary {
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
  acceptedMemberUserIds: string[];
  pendingMemberUserIds: string[];
}

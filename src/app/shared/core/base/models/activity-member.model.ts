import type { UserDto } from '../interfaces/user.interface';

export type ActivityMemberStatus = 'pending' | 'accepted';
export type ActivityPendingSource = 'admin' | 'member' | null;
export type ActivityInviteSort = 'recent' | 'relevant';
export type ActivityMemberRequestKind = 'invite' | 'join' | 'waitlist' | 'waitlist-invite' | null;
export type ActivityMemberRole = 'Admin' | 'Member' | 'Manager';

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
  relevance: number;
  avatarUrl: string;
  profile?: UserDto | null;
}

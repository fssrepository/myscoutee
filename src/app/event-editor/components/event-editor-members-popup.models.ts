export type EventEditorActivityMemberStatus = 'pending' | 'accepted';
export type EventEditorActivityPendingSource = 'admin' | 'member' | null;
export type EventEditorActivityMemberRequestKind = 'invite' | 'join' | null;
export type EventEditorActivityMemberRole = 'Admin' | 'Member' | 'Manager';

export interface EventEditorMembersPopupRow {
  id: string;
  type: string;
  title: string;
  isAdmin?: boolean;
}

export interface EventEditorMembersPopupUser {
  id: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  city: string;
  statusText: string;
  images?: string[];
  age?: number;
}

export interface EventEditorMembersPopupMember {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
  city: string;
  statusText: string;
  role: EventEditorActivityMemberRole;
  status: EventEditorActivityMemberStatus;
  pendingSource: EventEditorActivityPendingSource;
  requestKind: EventEditorActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  relevance: number;
  avatarUrl: string;
}

import type { ActivityInviteSort, ActivityMemberEntry, ActivityMemberOwnerType } from '../../../core/base/models';

export interface ActivityInviteOwnerContext {
  ownerId: string;
  ownerType: ActivityMemberOwnerType;
  title: string;
  subtitle: string;
  detail: string;
  dateIso: string;
  distanceKm: number;
  sourceType: 'events' | 'hosting';
  isAdmin: boolean;
}

export interface ActivityInviteCandidatesQuery {
  activeUserId: string;
  owner: ActivityInviteOwnerContext;
  existingMemberUserIds: readonly string[];
  sort: ActivityInviteSort;
}

export interface ActivityInviteCandidatesRepository {
  queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityMemberEntry[]>;
}

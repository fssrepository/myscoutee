import { AppUtils } from '../../../app-utils';
import type { ActivityInviteCandidatesQuery } from '../../contracts/activity-invite.interface';
import type { ActivityMemberEntry } from '../../contracts/activity-member.interface';
import type { UserDto } from '../../contracts/user.interface';

export interface LocalActivityInviteCandidateRecord {
  user: UserDto;
  metAtIso: string;
  metWhere: string;
  userRateAffinity: number;
}

export class LocalActivityInviteCandidatesMapper {
  static toEntry(
    query: ActivityInviteCandidatesQuery,
    candidate: LocalActivityInviteCandidateRecord
  ): ActivityMemberEntry {
    const user = candidate.user;
    const rowKey = `${query.owner.sourceType}:${query.owner.ownerId}`;
    return {
      id: `${rowKey}:${user.id}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: user.statusText,
      role: query.owner.isAdmin && user.id === query.activeUserId ? 'Admin' : 'Member',
      status: 'pending',
      pendingSource: 'admin',
      requestKind: 'invite',
      invitedByActiveUser: true,
      metAtIso: candidate.metAtIso,
      actionAtIso: candidate.metAtIso,
      metWhere: candidate.metWhere,
      avatarUrl: AppUtils.firstImageUrl(user.images),
      profile: user
    };
  }

  static toEntries(
    query: ActivityInviteCandidatesQuery,
    candidates: readonly LocalActivityInviteCandidateRecord[]
  ): ActivityMemberEntry[] {
    return candidates.map(candidate => this.toEntry(query, candidate));
  }
}

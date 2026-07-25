import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../contracts/user.interface';
import type {
  ActivityMemberDTO,
  ActivityMemberOwnerRef,
  ActivityMembersSummaryDto,
} from '../../contracts/activity.interface';
import type {
  ActivityMemberStatus,
  ActivityPendingSource
} from '../../common/constants';

export type ActivityMemberSourceType = 'events' | 'hosting' | 'invitations';

export interface ActivityMemberSourceModel {
  id: string;
  type: ActivityMemberSourceType;
  isAdmin?: boolean;
}

export class ActivityMembersBuilder {
  static buildActivityMembersSummary(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityMemberDTO[],
    capacityTotal: number
  ): ActivityMembersSummaryDto {
    const acceptedMemberUserIds = members
      .filter(member => member.status === 'accepted')
      .map(member => member.userId);
    const pendingMemberUserIds = members
      .filter(member => member.status === 'pending')
      .map(member => member.userId);
    return {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      acceptedMembers: acceptedMemberUserIds.length,
      pendingMembers: pendingMemberUserIds.length,
      capacityTotal: Math.max(acceptedMemberUserIds.length, capacityTotal),
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
  }

  static toActivityMemberDTO(
    user: UserDto,
    row: ActivityMemberSourceModel,
    rowKey: string,
    activeUserId: string,
    defaults: { status: ActivityMemberStatus; pendingSource: ActivityPendingSource; invitedByActiveUser: boolean },
    metPlaces: string[] = APP_STATIC_DATA.activityMemberMetPlaces
  ): ActivityMemberDTO {
    const seed = AppUtils.hashText(`${rowKey}:${user.id}`);
    const metAt = AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((seed % 220) + 1));
    const place = metPlaces.length > 0 ? metPlaces[seed % metPlaces.length] : APP_STATIC_DATA.activityMemberDefaults.forcedMetWhere;
    return {
      id: `${rowKey}:${user.id}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: user.statusText,
      role: row.isAdmin && user.id === activeUserId ? 'Admin' : 'Member',
      status: defaults.status,
      pendingSource: defaults.pendingSource,
      requestKind: defaults.status === 'pending' ? 'invite' : null,
      invitedByActiveUser: defaults.invitedByActiveUser,
      metAtIso: AppUtils.toIsoDateTime(metAt),
      actionAtIso: AppUtils.toIsoDateTime(metAt),
      metWhere: place,
      avatarUrl: AppUtils.firstImageUrl(user.images),
      profile: user
    };
  }

  static sortActivityMembersByActionTimeDesc(entries: readonly ActivityMemberDTO[]): ActivityMemberDTO[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(b.actionAtIso) - AppUtils.toSortableDate(a.actionAtIso));
  }

  static sortActivityMembersByActionTimeAsc(entries: readonly ActivityMemberDTO[]): ActivityMemberDTO[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(a.actionAtIso) - AppUtils.toSortableDate(b.actionAtIso));
  }

}

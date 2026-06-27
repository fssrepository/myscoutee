import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../contracts/user.interface';
import type {
  ActivityMemberEntry,
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
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
  acceptedMembers?: number | null;
  pendingMembers?: number | null;
  capacityTotal?: number | null;
  capacityMax?: number | null;
}

export class ActivityMembersBuilder {
  static activityMembersOwnerForRow(row: ActivityMemberSourceModel): ActivityMemberOwnerRef | null {
    return {
      ownerType: 'event',
      ownerId: row.id
    };
  }

  static activityMembersSummaryForRow(
    row: ActivityMemberSourceModel,
    options: {
      capacityByRowId: Record<string, string>;
      pendingMembersByRowId: Record<string, number>;
    }
  ): ActivityMembersSummary | null {
    const source = options.capacityByRowId[row.id];
    const pendingMembers = Math.max(0, Math.trunc(Number(options.pendingMembersByRowId[row.id]) || 0));
    const acceptedFromSource = Number(row.acceptedMembers);
    const pendingFromSource = Number(row.pendingMembers);
    const capacityFromSource = Number(row.capacityTotal);
    const capacityMaxFromSource = Number(row.capacityMax);
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      const acceptedMembers = parts.length >= 1 && Number.isFinite(parts[0]) ? Math.max(0, parts[0]) : null;
      const capacityTotal = parts.length >= 2 && Number.isFinite(parts[1]) ? Math.max(0, parts[1]) : null;
      if (acceptedMembers !== null && capacityTotal !== null) {
        return {
          ownerType: 'event',
          ownerId: row.id,
          acceptedMembers,
          pendingMembers: Number.isFinite(pendingFromSource) ? Math.max(0, Math.trunc(pendingFromSource)) : pendingMembers,
          capacityTotal,
          acceptedMemberUserIds: [],
          pendingMemberUserIds: []
        };
      }
    }
    if (
      Number.isFinite(acceptedFromSource)
      || Number.isFinite(pendingFromSource)
      || Number.isFinite(capacityFromSource)
      || Number.isFinite(capacityMaxFromSource)
    ) {
      const acceptedMembers = Number.isFinite(acceptedFromSource)
        ? Math.max(0, Math.trunc(acceptedFromSource))
        : 0;
      const resolvedPendingMembers = Number.isFinite(pendingFromSource)
        ? Math.max(0, Math.trunc(pendingFromSource))
        : pendingMembers;
      return {
        ownerType: 'event',
        ownerId: row.id,
        acceptedMembers,
        pendingMembers: resolvedPendingMembers,
        capacityTotal: Math.max(
          acceptedMembers,
          Number.isFinite(capacityFromSource)
            ? Math.max(0, Math.trunc(capacityFromSource))
            : Number.isFinite(capacityMaxFromSource)
              ? Math.max(0, Math.trunc(capacityMaxFromSource))
              : acceptedMembers
        ),
        acceptedMemberUserIds: [],
        pendingMemberUserIds: []
      };
    }
    return null;
  }

  static buildActivityMembersSummary(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityMemberEntry[],
    capacityTotal: number
  ): ActivityMembersSummary {
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

  static toActivityMemberEntry(
    user: UserDto,
    row: ActivityMemberSourceModel,
    rowKey: string,
    activeUserId: string,
    defaults: { status: ActivityMemberStatus; pendingSource: ActivityPendingSource; invitedByActiveUser: boolean },
    metPlaces: string[] = APP_STATIC_DATA.activityMemberMetPlaces
  ): ActivityMemberEntry {
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

  static sortActivityMembersByActionTimeDesc(entries: readonly ActivityMemberEntry[]): ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(b.actionAtIso) - AppUtils.toSortableDate(a.actionAtIso));
  }

  static sortActivityMembersByActionTimeAsc(entries: readonly ActivityMemberEntry[]): ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(a.actionAtIso) - AppUtils.toSortableDate(b.actionAtIso));
  }
}

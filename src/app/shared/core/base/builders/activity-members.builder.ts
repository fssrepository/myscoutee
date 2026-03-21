import { AppDemoGenerators } from '../../../app-demo-generators';
import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppUtils } from '../../../app-utils';
import type { DemoUser } from '../../../demo-data';
import type {
  ActivityMemberEntry,
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivityListRow
} from '../models';

export class ActivityMembersBuilder {
  static activityCapacityTotal(
    row: ActivityListRow,
    capacityByRowId: Record<string, string>,
    fallbackBase = 0
  ): number {
    const source = capacityByRowId[row.id];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] >= 0) {
        return parts[1];
      }
    }
    const sourceCapacityMax = Number((row.source as { capacityMax?: unknown }).capacityMax);
    if (Number.isFinite(sourceCapacityMax) && sourceCapacityMax >= 0) {
      return Math.max(fallbackBase, Math.trunc(sourceCapacityMax));
    }
    const sourceCapacityTotal = Number((row.source as { capacityTotal?: unknown }).capacityTotal);
    if (Number.isFinite(sourceCapacityTotal) && sourceCapacityTotal >= 0) {
      return Math.max(fallbackBase, Math.trunc(sourceCapacityTotal));
    }
    return Math.max(fallbackBase, 4);
  }

  static activityMembersOwnerForRow(row: ActivityListRow): ActivityMemberOwnerRef | null {
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    return {
      ownerType: 'event',
      ownerId: row.id
    };
  }

  static activityMembersSummaryForRow(
    row: ActivityListRow,
    options: {
      capacityByRowId: Record<string, string>;
      pendingMembersByRowId: Record<string, number>;
    }
  ): ActivityMembersSummary | null {
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    const source = options.capacityByRowId[row.id];
    const pendingMembers = Math.max(0, Math.trunc(Number(options.pendingMembersByRowId[row.id]) || 0));
    const sourceRecord = row.source as {
      acceptedMembers?: unknown;
      pendingMembers?: unknown;
      capacityTotal?: unknown;
      capacityMax?: unknown;
    };
    const acceptedFromSource = Number(sourceRecord.acceptedMembers);
    const pendingFromSource = Number(sourceRecord.pendingMembers);
    const capacityFromSource = Number(sourceRecord.capacityTotal);
    const capacityMaxFromSource = Number(sourceRecord.capacityMax);
    if (
      Number.isFinite(acceptedFromSource)
      && (Number.isFinite(capacityFromSource) || Number.isFinite(capacityMaxFromSource))
    ) {
      return {
        ownerType: 'event',
        ownerId: row.id,
        acceptedMembers: Math.max(0, Math.trunc(acceptedFromSource)),
        pendingMembers: Number.isFinite(pendingFromSource) ? Math.max(0, Math.trunc(pendingFromSource)) : pendingMembers,
        capacityTotal: Math.max(
          Math.max(0, Math.trunc(acceptedFromSource)),
          Number.isFinite(capacityFromSource)
            ? Math.max(0, Math.trunc(capacityFromSource))
            : Math.max(0, Math.trunc(capacityMaxFromSource))
        ),
        acceptedMemberUserIds: [],
        pendingMemberUserIds: []
      };
    }
    if (!source) {
      return null;
    }
    const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
    const acceptedMembers = parts.length >= 1 && Number.isFinite(parts[0]) ? Math.max(0, parts[0]) : null;
    const capacityTotal = parts.length >= 2 && Number.isFinite(parts[1]) ? Math.max(0, parts[1]) : null;
    if (acceptedMembers === null || capacityTotal === null) {
      return null;
    }
    return {
      ownerType: 'event',
      ownerId: row.id,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      acceptedMemberUserIds: [],
      pendingMemberUserIds: []
    };
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

  static buildSyncedActivityMembersForRow(
    row: ActivityListRow,
    acceptedMembers: number,
    pendingMembers: number,
    options: {
      activeUser: DemoUser;
      users: readonly DemoUser[];
    }
  ): ActivityMemberEntry[] {
    if (acceptedMembers <= 0 && pendingMembers <= 0) {
      return [];
    }
    const rowKey = `${row.type}:${row.id}`;
    const seed = AppDemoGenerators.hashText(`${rowKey}:${acceptedMembers}:${pendingMembers}`);
    const candidates = [options.activeUser, ...options.users.filter(user => user.id !== options.activeUser.id)];
    const used = new Set<string>();
    const pickUser = (offset: number): DemoUser => {
      if (candidates.length === 0) {
        return options.activeUser;
      }
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[(seed + offset + index) % candidates.length];
        if (!used.has(candidate.id) || used.size >= candidates.length) {
          used.add(candidate.id);
          return candidate;
        }
      }
      return options.activeUser;
    };

    const entries: ActivityMemberEntry[] = [];
    for (let index = 0; index < acceptedMembers; index += 1) {
      const user = pickUser(index);
      entries.push(AppDemoGenerators.toActivityMemberEntry(
        user,
        row,
        rowKey,
        options.activeUser.id,
        { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
        APP_STATIC_DATA.activityMemberMetPlaces
      ));
    }
    for (let index = 0; index < pendingMembers; index += 1) {
      const user = pickUser(acceptedMembers + index);
      const isJoinRequest = ((seed + index) % 3) === 0;
      const pendingSource = isJoinRequest
        ? 'member'
        : (row.isAdmin ? 'admin' : 'member');
      const entry = AppDemoGenerators.toActivityMemberEntry(
        user,
        row,
        rowKey,
        options.activeUser.id,
        { status: 'pending', pendingSource, invitedByActiveUser: !isJoinRequest },
        APP_STATIC_DATA.activityMemberMetPlaces
      );
      entries.push({
        ...entry,
        requestKind: isJoinRequest ? 'join' : 'invite',
        statusText: isJoinRequest ? 'Waiting for admin approval.' : 'Invitation pending.'
      });
    }
    return this.sortActivityMembersByActionTimeDesc(entries);
  }

  static sortActivityMembersByActionTimeDesc(entries: readonly ActivityMemberEntry[]): ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(b.actionAtIso) - AppUtils.toSortableDate(a.actionAtIso));
  }

  static sortActivityMembersByActionTimeAsc(entries: readonly ActivityMemberEntry[]): ActivityMemberEntry[] {
    return [...entries].sort((a, b) => AppUtils.toSortableDate(a.actionAtIso) - AppUtils.toSortableDate(b.actionAtIso));
  }
}

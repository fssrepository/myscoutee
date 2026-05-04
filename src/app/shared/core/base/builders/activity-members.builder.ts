import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppUtils } from '../../../app-utils';
import type { DemoUser } from '../interfaces/user.interface';
import type {
  ActivityMemberEntry,
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivityListRow,
  ActivityMemberStatus,
  ActivityPendingSource
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
    if (row.type !== 'events' && row.type !== 'hosting' && row.type !== 'invitations') {
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
    if (row.type !== 'events' && row.type !== 'hosting' && row.type !== 'invitations') {
      return null;
    }
    const source = options.capacityByRowId[row.id];
    const pendingMembers = Math.max(0, Math.trunc(Number(options.pendingMembersByRowId[row.id]) || 0));
    const sourceRecord = row.source as {
      acceptedMembers?: unknown;
      pendingMembers?: unknown;
      capacityTotal?: unknown;
      capacityMax?: unknown;
      acceptedMemberUserIds?: readonly unknown[];
      pendingMemberUserIds?: readonly unknown[];
    };
    const acceptedMemberUserIds = Array.isArray(sourceRecord.acceptedMemberUserIds)
      ? [...new Set(sourceRecord.acceptedMemberUserIds
        .map(userId => `${userId ?? ''}`.trim())
        .filter(userId => userId.length > 0))]
      : [];
    const pendingMemberUserIds = Array.isArray(sourceRecord.pendingMemberUserIds)
      ? [...new Set(sourceRecord.pendingMemberUserIds
        .map(userId => `${userId ?? ''}`.trim())
        .filter(userId => userId.length > 0)
        .filter(userId => !acceptedMemberUserIds.includes(userId)))]
      : [];
    const acceptedFromSource = Number(sourceRecord.acceptedMembers);
    const pendingFromSource = Number(sourceRecord.pendingMembers);
    const capacityFromSource = Number(sourceRecord.capacityTotal);
    const capacityMaxFromSource = Number(sourceRecord.capacityMax);
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
          acceptedMemberUserIds: [...acceptedMemberUserIds],
          pendingMemberUserIds: [...pendingMemberUserIds]
        };
      }
    }
    if (
      Number.isFinite(acceptedFromSource)
      || acceptedMemberUserIds.length > 0
      || pendingMemberUserIds.length > 0
      && (Number.isFinite(capacityFromSource) || Number.isFinite(capacityMaxFromSource))
    ) {
      const acceptedMembers = Number.isFinite(acceptedFromSource)
        ? Math.max(0, Math.trunc(acceptedFromSource))
        : acceptedMemberUserIds.length;
      const resolvedPendingMembers = Number.isFinite(pendingFromSource)
        ? Math.max(0, Math.trunc(pendingFromSource))
        : (pendingMemberUserIds.length > 0 ? pendingMemberUserIds.length : pendingMembers);
      return {
        ownerType: 'event',
        ownerId: row.id,
        acceptedMembers,
        pendingMembers: resolvedPendingMembers,
        capacityTotal: Math.max(
          acceptedMembers,
          Number.isFinite(capacityFromSource)
            ? Math.max(0, Math.trunc(capacityFromSource))
            : Math.max(0, Math.trunc(capacityMaxFromSource))
        ),
        acceptedMemberUserIds: [...acceptedMemberUserIds],
        pendingMemberUserIds: [...pendingMemberUserIds]
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
    if (row.type === 'invitations') {
      return this.buildInvitationSyncedActivityMembersForRow(row, acceptedMembers, pendingMembers, options);
    }
    const rowKey = `${row.type}:${row.id}`;
    const seed = AppUtils.hashText(`${rowKey}:${acceptedMembers}:${pendingMembers}`);
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
      entries.push(this.toActivityMemberEntry(
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
      const entry = this.toActivityMemberEntry(
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

  static toActivityMemberEntry(
    user: DemoUser,
    row: ActivityListRow,
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
      relevance: 40 + (seed % 61),
      avatarUrl: AppUtils.firstImageUrl(user.images),
      profile: user
    };
  }

  static buildForcedAcceptedMembers(
    row: ActivityListRow,
    rowKey: string,
    count: number,
    users: readonly DemoUser[],
    activeUser: DemoUser,
    forcedMetWhere = APP_STATIC_DATA.activityMemberDefaults.forcedMetWhere
  ): ActivityMemberEntry[] {
    const templates = users.length > 0 ? users : [activeUser];
    const members: ActivityMemberEntry[] = [];
    const cappedCount = Math.max(1, count);
    for (let index = 0; index < cappedCount; index += 1) {
      const template = templates[index % templates.length];
      const ordinal = Math.floor(index / templates.length);
      const isSelf = index === 0;
      const userId = isSelf ? activeUser.id : `${template.id}-force-${ordinal + 1}-${index + 1}`;
      const profile = isSelf ? activeUser : { ...template, id: userId };
      const when = AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((index % 30) + 1));
      members.push({
        id: `${rowKey}:${userId}`,
        userId,
        name: isSelf ? activeUser.name : template.name,
        initials: template.initials,
        gender: template.gender,
        city: template.city,
        statusText: template.statusText,
        role: isSelf && row.isAdmin ? 'Admin' : 'Member',
        status: 'accepted',
        pendingSource: null,
        requestKind: null,
        invitedByActiveUser: false,
        metAtIso: AppUtils.toIsoDateTime(when),
        actionAtIso: AppUtils.toIsoDateTime(when),
        metWhere: forcedMetWhere,
        relevance: 60 + ((index * 7) % 40),
        avatarUrl: AppUtils.firstImageUrl(template.images),
        profile
      });
    }
    return members;
  }

  static generateActivityMembersForRow(
    row: ActivityListRow,
    rowKey: string,
    users: readonly DemoUser[],
    activeUser: DemoUser,
    metPlaces: string[] = APP_STATIC_DATA.activityMemberMetPlaces
  ): ActivityMemberEntry[] {
    if (row.type === 'invitations') {
      const targets = this.resolveGeneratedMemberTargets(row, AppUtils.hashText(`${row.type}:${row.id}`), users.length);
      return this.buildInvitationSyncedActivityMembersForRow(
        row,
        targets.acceptedTarget,
        targets.pendingTarget,
        { activeUser, users },
        metPlaces
      );
    }
    const others = users.filter(user => user.id !== activeUser.id);
    if (others.length === 0) {
      return [this.toActivityMemberEntry(
        activeUser,
        row,
        rowKey,
        activeUser.id,
        { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
        metPlaces
      )];
    }
    const seed = AppUtils.hashText(`${row.type}:${row.id}`);
    const orderedOthers = [...others].sort((left, right) => {
      const leftWeight = AppUtils.hashText(`${rowKey}:${left.id}`);
      const rightWeight = AppUtils.hashText(`${rowKey}:${right.id}`);
      return leftWeight - rightWeight;
    });
    const targets = this.resolveGeneratedMemberTargets(row, seed, orderedOthers.length);
    const picked: DemoUser[] = [
      activeUser,
      ...orderedOthers.slice(0, Math.max(0, targets.acceptedTarget - 1))
    ];
    const accepted = picked.map(user => this.toActivityMemberEntry(
      user,
      row,
      rowKey,
      activeUser.id,
      { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
      metPlaces
    ));
    const acceptedIds = new Set(accepted.map(item => item.userId));
    const pendingPool = orderedOthers.filter(user => !acceptedIds.has(user.id));
    const pendingCount = Math.min(targets.pendingTarget, pendingPool.length);
    for (let index = 0; index < pendingCount; index += 1) {
      const user = pendingPool[index];
      const isJoinRequest = ((seed + index) % 3) === 0;
      const pendingSource: ActivityPendingSource = row.isAdmin ? 'admin' : 'member';
      const baseEntry = this.toActivityMemberEntry(
        user,
        row,
        rowKey,
        activeUser.id,
        {
          status: 'pending',
          pendingSource: isJoinRequest ? 'member' : pendingSource,
          invitedByActiveUser: !isJoinRequest
        },
        metPlaces
      );
      accepted.push({
        ...baseEntry,
        requestKind: isJoinRequest ? 'join' : 'invite'
      });
    }
    return accepted;
  }

  private static resolveGeneratedMemberTargets(
    row: ActivityListRow,
    seed: number,
    availableOtherUsers: number
  ): { acceptedTarget: number; pendingTarget: number } {
    const maxAcceptedTarget = availableOtherUsers + 1;
    if (row.type === 'invitations') {
      const acceptedTarget = Math.max(1, Math.min(maxAcceptedTarget, 2 + (seed % 3)));
      const pendingTarget = Math.max(0, Math.min(
        availableOtherUsers - Math.max(0, acceptedTarget - 1),
        1 + ((seed >> 2) % 2)
      ));
      return { acceptedTarget, pendingTarget };
    }

    const bucket = seed % 100;
    let totalTarget = 5 + (seed % 3);

    if (bucket >= 45 && bucket < 78) {
      totalTarget = 7 + (seed % 3);
    } else if (bucket >= 78 && bucket < 93) {
      totalTarget = 10 + (seed % 3);
    } else if (bucket >= 93 && bucket < 99) {
      totalTarget = 13 + (seed % 2);
    } else if (bucket >= 99) {
      totalTarget = 15;
    }

    let pendingTarget = 0;
    if (totalTarget >= 7 && totalTarget <= 9) {
      pendingTarget = 1 + ((seed >> 4) % 2);
    } else if (totalTarget >= 10 && totalTarget <= 12) {
      pendingTarget = 1 + ((seed >> 5) % 3);
    } else if (totalTarget >= 13) {
      pendingTarget = 2 + ((seed >> 6) % 3);
    }

    let acceptedTarget = totalTarget - pendingTarget;
    acceptedTarget = Math.max(1, Math.min(maxAcceptedTarget, acceptedTarget));
    pendingTarget = Math.max(0, Math.min(
      availableOtherUsers - Math.max(0, acceptedTarget - 1),
      pendingTarget
    ));

    return { acceptedTarget, pendingTarget };
  }

  private static buildInvitationSyncedActivityMembersForRow(
    row: ActivityListRow,
    acceptedMembers: number,
    pendingMembers: number,
    options: {
      activeUser: DemoUser;
      users: readonly DemoUser[];
    },
    metPlaces: string[] = APP_STATIC_DATA.activityMemberMetPlaces
  ): ActivityMemberEntry[] {
    const rowKey = `${row.type}:${row.id}`;
    const orderedCandidates = [...new Map(
      options.users
        .filter(user => user.id !== options.activeUser.id)
        .map(user => [user.id, user] as const)
    ).values()].sort((left, right) =>
      AppUtils.hashText(`${rowKey}:${left.id}`) - AppUtils.hashText(`${rowKey}:${right.id}`)
    );
    const acceptedPool = orderedCandidates.slice(0, Math.max(0, acceptedMembers));
    const entries = acceptedPool.map(user => this.toActivityMemberEntry(
      user,
      row,
      rowKey,
      options.activeUser.id,
      { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
      metPlaces
    ));
    if (pendingMembers > 0) {
      const activePendingEntry = this.toActivityMemberEntry(
        options.activeUser,
        row,
        rowKey,
        options.activeUser.id,
        { status: 'pending', pendingSource: 'admin', invitedByActiveUser: false },
        metPlaces
      );
      entries.push({
        ...activePendingEntry,
        requestKind: 'invite',
        statusText: 'Invitation pending.'
      });
    }
    const usedUserIds = new Set(entries.map(entry => entry.userId));
    const additionalPendingCount = Math.max(0, pendingMembers - (usedUserIds.has(options.activeUser.id) ? 1 : 0));
    const pendingPool = orderedCandidates
      .filter(user => !usedUserIds.has(user.id))
      .slice(0, additionalPendingCount);
    for (const user of pendingPool) {
      const entry = this.toActivityMemberEntry(
        user,
        row,
        rowKey,
        options.activeUser.id,
        { status: 'pending', pendingSource: 'admin', invitedByActiveUser: false },
        metPlaces
      );
      entries.push({
        ...entry,
        requestKind: 'invite',
        statusText: 'Invitation pending.'
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

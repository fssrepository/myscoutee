import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../contracts/user.interface';
import type { ActivityMemberRecord } from '../../base/models/activity-members.model';
import type { ActivityMemberEntry, ActivityMemberOwnerRef, ActivityMembersSummary } from '../../contracts/activity.interface';

export interface ActivityMemberProfileFallback {
  name?: string;
  initials?: string;
  city?: string;
  gender?: UserDto['gender'];
}

export type ActivityMemberProfileResolver = (
  userId: string,
  fallback: ActivityMemberProfileFallback
) => UserDto;

export class LocalActivityMembersMapper {
  static toEntry(
    record: ActivityMemberRecord,
    resolveProfile: ActivityMemberProfileResolver
  ): ActivityMemberEntry {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      initials: record.initials,
      gender: record.gender,
      city: record.city,
      statusText: record.statusText,
      role: record.role,
      status: record.status,
      pendingSource: record.pendingSource,
      requestKind: record.requestKind,
      invitedByActiveUser: record.invitedByActiveUser,
      invitedByUserId: record.invitedByUserId ?? null,
      metAtIso: record.metAtIso,
      actionAtIso: record.actionAtIso,
      metWhere: record.metWhere,
      avatarUrl: record.avatarUrl,
      profile: resolveProfile(record.userId, {
        name: record.name,
        initials: record.initials,
        city: record.city,
        gender: record.gender
      })
    };
  }

  static toRecord(
    owner: ActivityMemberOwnerRef,
    member: ActivityMemberEntry,
    existingRecord?: ActivityMemberRecord | null
  ): ActivityMemberRecord {
    const normalizedOwner = this.normalizeOwner(owner);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const invitedByUserId = member.status === 'pending'
      && (member.requestKind === 'invite' || member.requestKind === 'waitlist-invite')
        ? member.invitedByUserId?.trim() || null
        : null;
    return {
      ...member,
      invitedByUserId,
      invitedByActiveUser: invitedByUserId ? member.invitedByActiveUser === true : false,
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      ownerKey: this.ownerKey(normalizedOwner),
      createdMs: Number.isFinite(Number(existingRecord?.createdMs)) ? Number(existingRecord?.createdMs) : nowMs,
      updatedMs: nowMs,
      createdAtIso: existingRecord?.createdAtIso?.trim() || nowIso,
      updatedAtIso: nowIso
    };
  }

  static recordsToSummary(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    capacityTotal?: number | null
  ): ActivityMembersSummary {
    const normalizedOwner = this.normalizeOwner(owner);
    const acceptedMemberUserIds = records
      .filter(record => record.status === 'accepted')
      .map(record => record.userId);
    const pendingMemberUserIds = records
      .filter(record => record.status === 'pending')
      .map(record => record.userId);
    const acceptedMembers = acceptedMemberUserIds.length;
    const pendingMembers = pendingMemberUserIds.length;
    return {
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(acceptedMembers, this.normalizeCount(capacityTotal) ?? acceptedMembers),
      acceptedMemberUserIds: [...acceptedMemberUserIds],
      pendingMemberUserIds: [...pendingMemberUserIds]
    };
  }

  static cloneRecord(record: ActivityMemberRecord): ActivityMemberRecord {
    return {
      ...record,
      profile: record.profile ? { ...record.profile } : record.profile
    };
  }

  static cloneRecords(records: readonly ActivityMemberRecord[]): ActivityMemberRecord[] {
    return records.map(record => this.cloneRecord(record));
  }

  static sortEntriesByActionTime(entries: readonly ActivityMemberEntry[]): ActivityMemberEntry[] {
    return [...entries]
      .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));
  }

  private static normalizeOwner(owner: ActivityMemberOwnerRef): ActivityMemberOwnerRef {
    return {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId.trim()
    };
  }

  private static ownerKey(owner: ActivityMemberOwnerRef): string {
    return `${owner.ownerType}:${owner.ownerId}`;
  }

  private static normalizeCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}

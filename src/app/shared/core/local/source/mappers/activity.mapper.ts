import { AppUtils } from '../../../../app-utils';
import { ActivityResourceBuilder } from '../../../base/builders';
import type { UserDto } from '../../../contracts/user.interface';
import type {
  ActivityMemberEntry,
  ActivityMemberOwnerRef,
  ActivityMembersSummaryDto,
  ActivityInviteCandidatesQuery
} from '../../../contracts/activity.interface';
import type {
  ActivityMemberRecord,
  ActivitySubEventResourceRecord
} from '../entity/activity.entity';

import type * as AppDTOs from '../../../contracts';
import type * as AppConstants from '../../../common/constants';
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

export interface LocalActivityMembersOwnerSnapshot {
  ownerType: ActivityMemberOwnerRef['ownerType'];
  ownerId: string;
  records: ActivityMemberRecord[];
  acceptedMemberUserIds: string[];
  pendingMemberUserIds: string[];
  invitedMemberUserIds: string[];
  pendingRequestMemberUserIds: string[];
  adminUserIds: string[];
  capacityTotal: number;
}

export class LocalActivityMembersBuilder {
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

  static recordsToOwnerSnapshot(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    capacityTotal?: number | null
  ): LocalActivityMembersOwnerSnapshot {
    const normalizedOwner = this.normalizeOwner(owner);
    const normalizedRecords = this.cloneRecords(records);
    const acceptedMemberUserIds = this.memberUserIds(normalizedRecords, record => record.status === 'accepted');
    const pendingMemberUserIds = this.memberUserIds(normalizedRecords, record => record.status === 'pending');
    return {
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      records: normalizedRecords,
      acceptedMemberUserIds,
      pendingMemberUserIds,
      invitedMemberUserIds: this.memberUserIds(
        normalizedRecords,
        record => record.status === 'pending' && this.isInvitationRecord(record)
      ),
      pendingRequestMemberUserIds: this.memberUserIds(
        normalizedRecords,
        record => record.status === 'pending' && !this.isInvitationRecord(record)
      ),
      adminUserIds: this.memberUserIds(
        normalizedRecords,
        record => record.status === 'accepted' && (record.role === 'Admin' || record.role === 'Manager')
      ),
      capacityTotal: Math.max(acceptedMemberUserIds.length, this.normalizeCount(capacityTotal) ?? acceptedMemberUserIds.length)
    };
  }

  static ownerSnapshotToSummary(snapshot: LocalActivityMembersOwnerSnapshot): ActivityMembersSummaryDto {
    return {
      ownerType: snapshot.ownerType,
      ownerId: snapshot.ownerId,
      acceptedMembers: snapshot.acceptedMemberUserIds.length,
      pendingMembers: snapshot.pendingMemberUserIds.length,
      capacityTotal: Math.max(snapshot.acceptedMemberUserIds.length, this.normalizeCount(snapshot.capacityTotal) ?? 0),
      acceptedMemberUserIds: [...snapshot.acceptedMemberUserIds],
      pendingMemberUserIds: [...snapshot.pendingMemberUserIds]
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

  private static memberUserIds(
    records: readonly ActivityMemberRecord[],
    predicate: (record: ActivityMemberRecord) => boolean
  ): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const record of records) {
      const userId = record.userId.trim();
      if (!userId || seen.has(userId) || !predicate(record)) {
        continue;
      }
      seen.add(userId);
      ids.push(userId);
    }
    return ids;
  }

  private static isInvitationRecord(record: ActivityMemberRecord): boolean {
    return record.requestKind === 'invite' || record.requestKind === 'waitlist-invite';
  }

  private static normalizeCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}

export class LocalActivityResourcesMapper {
  static normalizeRef(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO | null | undefined
  ): AppDTOs.ActivitySubEventResourceStateRefDTO | null {
    const ownerId = `${ref?.ownerId ?? ''}`.trim();
    const subEventId = `${ref?.subEventId ?? ''}`.trim();
    const assetOwnerUserId = `${ref?.assetOwnerUserId ?? ''}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId
    };
  }

  static recordId(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return ActivityResourceBuilder.recordId(ref);
  }

  static ownerKey(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return ActivityResourceBuilder.ownerKey(ref);
  }

  static normalizeState(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    fallbackRef?: AppDTOs.ActivitySubEventResourceStateRefDTO | null
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    return ActivityResourceBuilder.normalizeState(state, fallbackRef);
  }

  static toRecord(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    existing?: ActivitySubEventResourceRecord | null
  ): ActivitySubEventResourceRecord {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    return {
      id: this.recordId(state),
      ownerKey: this.ownerKey(state),
      ownerId: state.ownerId,
      subEventId: state.subEventId,
      assetOwnerUserId: state.assetOwnerUserId,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(state.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(state.assetSettingsByType),
      supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
        state.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(state.fallbackAssetCardsByType),
      createdMs: existing?.createdMs ?? nowMs,
      updatedMs: nowMs,
      createdAtIso: existing?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso
    };
  }

  static toState(
    record: ActivitySubEventResourceRecord
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const normalizedState = ActivityResourceBuilder.normalizeState({
      ownerId: record.ownerId,
      subEventId: record.subEventId,
      assetOwnerUserId: record.assetOwnerUserId,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(record.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(record.assetSettingsByType),
      supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
        record.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(record.fallbackAssetCardsByType)
    }, record);
    return normalizedState ? ActivityResourceBuilder.cloneState(normalizedState) : null;
  }

  static cloneRecord(record: ActivitySubEventResourceRecord): ActivitySubEventResourceRecord {
    return {
      ...record,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(record.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(record.assetSettingsByType),
      supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
        record.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(record.fallbackAssetCardsByType)
    };
  }

}

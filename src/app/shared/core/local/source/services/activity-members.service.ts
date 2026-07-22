import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import type { UserDto } from '../../../contracts/user.interface';
import type { ActivityMemberRecord } from '../entity/activity.entity';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityMembersBuilder, type ActivityMemberProfileFallback, type LocalActivityMembersOwnerSnapshot } from '../mappers';
import type {
  ActivityMemberDTO,
  ActivityMemberOwnerRef,
  ActivityMembersQueryOptions,
  ActivityMembersSummaryDto
} from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityMembersService extends LocalRouteDelayService {
  private static readonly MEMBERS_ROUTE = '/activities/events/members';
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly localUsersRepository = inject(LocalUsersRepository);

  peekMembersByOwner(owner: ActivityMemberOwnerRef): ActivityMemberDTO[] {
    return this.entriesFromRecords(this.activityMembersRepository.peekRecordsByOwner(owner), owner);
  }

  async queryMembersByOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberDTO[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    return this.loadMembersByOwner(owner, options);
  }

  async loadMembersByOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberDTO[]> {
    return this.entriesFromRecords(await this.activityMembersRepository.queryRecordsByOwner(owner, options), owner);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    return this.summaryFromOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummaryDto[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    return this.activityMembersRepository.normalizeOwners(owners)
      .map(owner => this.summaryFromOwner(owner))
      .filter((summary): summary is ActivityMembersSummaryDto => Boolean(summary));
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityMemberDTO[],
    capacityTotal?: number | null,
    actorUserId = '',
    options?: ActivityMembersQueryOptions
  ): Promise<void> {
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    void actorUserId;
    void options;
    const existingRecordsById = this.existingRecordsById(normalizedOwner);
    const records = members.map(member => LocalActivityMembersBuilder.toRecord(
      normalizedOwner,
      member,
      existingRecordsById.get(member.id) ?? null
    ));
    const ownerSnapshot = this.ownerSnapshotFromOwner(normalizedOwner);
    this.activityMembersRepository.replaceRecordsByOwner(
      normalizedOwner,
      records,
      capacityTotal ?? ownerSnapshot?.capacityTotal ?? null
    );
  }

  async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    targetUserId: string,
    action: 'disqualify' | 'reinstate',
    reason?: string | null
  ): Promise<ActivityMemberDTO[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    void actorUserId;
    void reason;
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedOwner || !normalizedTargetUserId) {
      return normalizedOwner ? this.peekMembersByOwner(normalizedOwner) : [];
    }

    const previousRecords = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const previousMembers = this.entriesFromRecords(previousRecords, normalizedOwner);
    const nowIso = AppUtils.toIsoDateTime(new Date());
    const nextMembers = previousMembers.map(member => {
      if (member.userId !== normalizedTargetUserId) {
        return member;
      }
      if (action === 'disqualify' && member.status === 'accepted') {
        return {
          ...member,
          status: 'disqualified' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      if (action === 'reinstate' && member.status === 'disqualified') {
        return {
          ...member,
          status: 'accepted' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      return member;
    });
    const changed = nextMembers.some((member, index) => member.status !== previousMembers[index]?.status);
    if (!changed) {
      return previousMembers;
    }

    const previousRecordsById = new Map(previousRecords.map(record => [record.id, record] as const));
    const nextRecords = nextMembers.map(member => LocalActivityMembersBuilder.toRecord(
      normalizedOwner,
      member,
      previousRecordsById.get(member.id) ?? null
    ));
    const ownerSnapshot = this.ownerSnapshotFromOwner(normalizedOwner);
    this.activityMembersRepository.replaceRecordsByOwner(
      normalizedOwner,
      nextRecords,
      ownerSnapshot?.capacityTotal ?? null
    );
    return this.entriesFromRecords(nextRecords, normalizedOwner);
  }

  private entriesFromRecords(
    records: readonly ActivityMemberRecord[],
    owner?: ActivityMemberOwnerRef
  ): ActivityMemberDTO[] {
    const userIds = records.map(record => record.userId);
    const involvementRecordsByUserId = owner
      ? this.activityMembersRepository.queryInvolvementRecordsByOwnerAndUsers(owner, userIds)
      : new Map<string, ActivityMemberRecord[]>();
    return LocalActivityMembersBuilder.sortEntriesByActionTime(
      records.map(record => LocalActivityMembersBuilder.toEntry(
        record,
        (userId, fallback) => this.resolveDemoUser(userId, fallback),
        involvementRecordsByUserId.get(record.userId.trim()) ?? []
      ))
    );
  }

  private summaryFromOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    const snapshot = this.ownerSnapshotFromOwner(owner);
    return snapshot ? LocalActivityMembersBuilder.ownerSnapshotToSummary(snapshot) : null;
  }

  private ownerSnapshotFromOwner(owner: ActivityMemberOwnerRef): LocalActivityMembersOwnerSnapshot | null {
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const records = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const acceptedMembers = records.filter(record => record.status === 'accepted').length;
    const capacityTotal = this.activityMembersRepository.resolveOwnerCapacityTotal(normalizedOwner, acceptedMembers);
    return this.ownerSnapshotFromRecords(normalizedOwner, records, capacityTotal);
  }

  private ownerSnapshotFromRecords(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    capacityTotal?: number | null
  ): LocalActivityMembersOwnerSnapshot {
    return LocalActivityMembersBuilder.recordsToOwnerSnapshot(owner, records, capacityTotal);
  }

  private existingRecordsById(owner: ActivityMemberOwnerRef): ReadonlyMap<string, ActivityMemberRecord> {
    return new Map(this.activityMembersRepository.peekRecordsByOwner(owner).map(record => [record.id, record] as const));
  }

  private resolveDemoUser(userId: string, fallback: ActivityMemberProfileFallback): UserDto {
    const normalizedUserId = userId.trim();
    const fallbackName = fallback.name?.trim() || 'Unknown User';
    const fallbackInitials = fallback.initials?.trim() || AppUtils.initialsFromText(fallbackName);
    const fallbackCity = fallback.city?.trim() || '';
    const fallbackGender = fallback.gender ?? 'man';
    const demoUsers = this.localActivityMemberUsers;
    const byId = demoUsers.find(user => user.id === normalizedUserId);
    if (byId) {
      return byId;
    }
    const templateSeed = AppUtils.hashText(`${normalizedUserId}:${fallbackName}`);
    const template = demoUsers[templateSeed % demoUsers.length];
    return {
      ...(template ?? demoUsers[0]),
      id: normalizedUserId || template?.id || 'unknown-user',
      name: fallbackName || template?.name || 'Unknown User',
      initials: fallbackInitials || template?.initials || 'UN',
      city: fallbackCity || template?.city || '',
      gender: fallbackGender || template?.gender || 'man'
    };
  }

  private get localActivityMemberUsers(): UserDto[] {
    return (this.localUsersRepository.queryAllUsers() as UserDto[])
      .filter(user => user.id.trim().length > 0);
  }
}

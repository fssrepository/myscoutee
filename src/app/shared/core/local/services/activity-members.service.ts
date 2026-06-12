import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../base/interfaces/user.interface';
import type {
  ActivityMemberEntry,
  ActivityMemberOwnerRef,
  ActivityMembersSummary
} from '../../../core/base/models';
import type { ActivityMemberRecord } from '../../base/models/activity-members.model';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalActivityMembersMapper, type ActivityMemberProfileFallback } from '../mappers';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityMembersService extends LocalRouteDelayService {
  private static readonly MEMBERS_ROUTE = '/activities/events/members';
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly localUsersRepository = inject(LocalUsersRepository);

  peekMembersByOwner(owner: ActivityMemberOwnerRef): ActivityMemberEntry[] {
    return this.entriesFromRecords(this.activityMembersRepository.peekRecordsByOwner(owner));
  }

  async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<ActivityMemberEntry[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    return this.entriesFromRecords(await this.activityMembersRepository.queryRecordsByOwner(owner));
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    return this.summaryFromOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    return this.activityMembersRepository.normalizeOwners(owners)
      .map(owner => this.summaryFromOwner(owner))
      .filter((summary): summary is ActivityMembersSummary => Boolean(summary));
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityMemberEntry[],
    capacityTotal?: number | null,
    actorUserId = ''
  ): Promise<void> {
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    void actorUserId;
    const existingRecordsById = this.existingRecordsById(normalizedOwner);
    const records = members.map(member => LocalActivityMembersMapper.toRecord(
      normalizedOwner,
      member,
      existingRecordsById.get(member.id) ?? null
    ));
    const summary = this.summaryFromRecords(
      normalizedOwner,
      records,
      capacityTotal ?? this.summaryFromOwner(normalizedOwner)?.capacityTotal ?? null
    );
    this.activityMembersRepository.replaceRecordsByOwner(normalizedOwner, records, summary, true);
  }

  async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    targetUserId: string,
    action: 'disqualify' | 'reinstate',
    reason?: string | null
  ): Promise<ActivityMemberEntry[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    void actorUserId;
    void reason;
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedOwner || !normalizedTargetUserId) {
      return normalizedOwner ? this.peekMembersByOwner(normalizedOwner) : [];
    }

    const previousRecords = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const previousMembers = this.entriesFromRecords(previousRecords);
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
    const nextRecords = nextMembers.map(member => LocalActivityMembersMapper.toRecord(
      normalizedOwner,
      member,
      previousRecordsById.get(member.id) ?? null
    ));
    const summary = this.summaryFromRecords(
      normalizedOwner,
      nextRecords,
      this.summaryFromOwner(normalizedOwner)?.capacityTotal ?? null
    );
    this.activityMembersRepository.replaceRecordsByOwner(normalizedOwner, nextRecords, summary, true);
    return this.entriesFromRecords(nextRecords);
  }

  private entriesFromRecords(records: readonly ActivityMemberRecord[]): ActivityMemberEntry[] {
    return LocalActivityMembersMapper.sortEntriesByActionTime(
      records.map(record => LocalActivityMembersMapper.toEntry(
        record,
        (userId, fallback) => this.resolveDemoUser(userId, fallback)
      ))
    );
  }

  private summaryFromOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const records = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const acceptedMembers = records.filter(record => record.status === 'accepted').length;
    const capacityTotal = this.activityMembersRepository.resolveOwnerCapacityTotal(normalizedOwner, acceptedMembers);
    return this.summaryFromRecords(normalizedOwner, records, capacityTotal);
  }

  private summaryFromRecords(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    capacityTotal?: number | null
  ): ActivityMembersSummary {
    return LocalActivityMembersMapper.recordsToSummary(owner, records, capacityTotal);
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

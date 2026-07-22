import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import type { ActivityInviteCandidatesQuery } from '../../../contracts/activity.interface';
import type { ActivityRateDTO } from '../../../contracts/activity.interface';
import type { LocalActivityInviteCandidateRecord } from '../mappers';
import { LocalUsersMapper } from '../mappers';
import { LocalContactsRepository } from './contacts.repository';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { LocalRatesRepository } from './rates.repository';
import { LocalUsersRepository } from './users.repository';

import type * as AppConstants from '../../../common/constants';

export interface LocalActivityInviteCandidatesPage {
  items: LocalActivityInviteCandidateRecord[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesRepository {
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly ratesRepository = inject(LocalRatesRepository);
  private readonly contactsRepository = inject(LocalContactsRepository);
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);

  async queryCandidateRecords(query: ActivityInviteCandidatesQuery): Promise<LocalActivityInviteCandidatesPage> {
    const activeUserId = query.activeUserId.trim();
    const ownerId = query.owner.ownerId.trim();
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 16)));
    if (!activeUserId || !ownerId) {
      return { items: [], total: 0, page, pageSize };
    }

    const activeUser = this.usersRepository.queryUserById(activeUserId);
    if (!activeUser) {
      return { items: [], total: 0, page, pageSize };
    }

    if (query.owner.ownerType !== 'event' && query.parentOwner?.ownerId.trim()) {
      const childRecords = this.activityMembersRepository.peekRecordsByOwner({
        ownerType: query.owner.ownerType,
        ownerId
      });
      const selectedPendingUserIds = new Set(
        query.pendingInviteUserIds.map(userId => userId.trim()).filter(Boolean)
      );
      const excludedUserIds = new Set(
        query.existingMemberUserIds.map(userId => userId.trim()).filter(Boolean)
      );
      excludedUserIds.add(activeUserId);
      const pendingCandidates = [...selectedPendingUserIds]
        .map(userId => {
          const record = childRecords.find(entry => entry.userId.trim() === userId);
          const user = this.usersRepository.queryUserById(userId);
          return user
            ? {
                user: LocalUsersMapper.toDto(user),
                metAtIso: record?.actionAtIso || record?.metAtIso || new Date().toISOString(),
                metWhere: record?.metWhere || query.owner.title || 'Pending invitation',
                userRateAffinity: 0
              }
            : null;
        })
        .filter((candidate): candidate is LocalActivityInviteCandidateRecord => Boolean(candidate));
      const candidates = this.activityMembersRepository.peekRecordsByOwner({
        ownerType: query.parentOwner.ownerType,
        ownerId: query.parentOwner.ownerId.trim()
      })
        .filter(record => record.status === 'accepted')
        .filter(record => !excludedUserIds.has(record.userId.trim()))
        .sort((left, right) => {
          const actionDelta = AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso);
          return actionDelta || left.userId.localeCompare(right.userId);
        })
        .map(record => {
          const user = this.usersRepository.queryUserById(record.userId.trim());
          return user
            ? {
                user: LocalUsersMapper.toDto(user),
                metAtIso: record.actionAtIso || record.metAtIso || new Date().toISOString(),
                metWhere: record.metWhere || query.owner.title || 'Parent member',
                userRateAffinity: 0
              }
            : null;
        })
        .filter((candidate): candidate is LocalActivityInviteCandidateRecord => Boolean(candidate));
      return this.toPage([...pendingCandidates, ...candidates], page, pageSize);
    }

    const existingUserIds = new Set(query.existingMemberUserIds.map(userId => userId.trim()).filter(Boolean));
    existingUserIds.add(activeUserId);
    const pendingCandidates = this.activityMembersRepository.peekRecordsByOwner({
      ownerType: query.owner.ownerType,
      ownerId
    })
      .filter(record => record.status === 'pending' && record.userId.trim() !== activeUserId)
      .sort((left, right) => AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso))
      .map(record => {
        const user = this.usersRepository.queryUserById(record.userId.trim());
        return user
          ? {
              user: LocalUsersMapper.toDto(user),
              metAtIso: record.actionAtIso || record.metAtIso || new Date().toISOString(),
              metWhere: record.metWhere || query.owner.title || 'Pending invitation',
              userRateAffinity: 0
            }
          : null;
      })
      .filter((candidate): candidate is LocalActivityInviteCandidateRecord => Boolean(candidate));
    const pendingCandidateUserIds = new Set(pendingCandidates.map(candidate => candidate.user.id));

    // Filter out existing contacts at the repository level if the owner is an asset
    if (query.owner.ownerType === 'asset') {
      for (const contact of this.contactsRepository.queryContactRecordsByUser(activeUserId)) {
        const contactUserId = (contact.userId || contact.id || '').trim();
        if (contactUserId) {
          existingUserIds.add(contactUserId);
        }
      }
    }

    const latestMetByUserId = new Map<string, { metAtIso: string; metWhere: string; userRateAffinity: number }>();
    for (const item of await this.queryMetRateItems(activeUserId, query.sort)) {
      const candidateUserId = item.userId?.trim() ?? '';
      if (!candidateUserId || candidateUserId === activeUserId) {
        continue;
      }
      const metAtIso = item.happenedAt?.trim() || new Date().toISOString();
      if (!this.isFinishedMetActivity(metAtIso)) {
        continue;
      }
      const metWhere = item.eventName?.trim() || 'Met on MyScoutee';
      const userRateAffinity = this.normalizeRateItemAffinity(item);
      const current = latestMetByUserId.get(candidateUserId);
      if (!current || AppUtils.toSortableDate(metAtIso) > AppUtils.toSortableDate(current.metAtIso)) {
        latestMetByUserId.set(candidateUserId, {
          metAtIso,
          metWhere,
          userRateAffinity
        });
      }
    }

    const metCandidates = [...latestMetByUserId.keys()]
      .filter(userId => !existingUserIds.has(userId))
      .map(userId => this.usersRepository.queryUserById(userId))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map(user => LocalUsersMapper.toDto(user))
      .map(user => {
        const latestMet = latestMetByUserId.get(user.id)!;
        return {
          user,
          metAtIso: latestMet.metAtIso,
          metWhere: latestMet.metWhere,
          userRateAffinity: latestMet.userRateAffinity
        };
      });

    metCandidates.sort((left, right) => {
      if (query.sort === 'relevant') {
        const leftUserRateAffinity = latestMetByUserId.get(left.user.id)?.userRateAffinity ?? 0;
        const rightUserRateAffinity = latestMetByUserId.get(right.user.id)?.userRateAffinity ?? 0;
        if (rightUserRateAffinity !== leftUserRateAffinity) {
          return rightUserRateAffinity - leftUserRateAffinity;
        }
      }
      return AppUtils.toSortableDate(right.metAtIso) - AppUtils.toSortableDate(left.metAtIso);
    });
    const candidates = [
      ...pendingCandidates,
      ...metCandidates.filter(candidate => !pendingCandidateUserIds.has(candidate.user.id))
    ];
    return this.toPage(candidates, page, pageSize);
  }

  private toPage(
    candidates: readonly LocalActivityInviteCandidateRecord[],
    page: number,
    pageSize: number
  ): LocalActivityInviteCandidatesPage {
    const start = Math.min(candidates.length, page * pageSize);
    return {
      items: candidates.slice(start, start + pageSize),
      total: candidates.length,
      page,
      pageSize
    };
  }

  private async queryMetRateItems(
    activeUserId: string,
    sort: AppConstants.ActivityInviteSort
  ): Promise<ActivityRateDTO[]> {
    const itemsById = new Map<string, ActivityRateDTO>();
    for (const socialBadgeEnabled of [false, true]) {
      const page = await this.ratesRepository.queryActivityRateItemsPage({
        ownerUserId: activeUserId,
        mode: 'single',
        displayDirection: 'met',
        socialBadgeEnabled,
        sort: sort === 'relevant' ? 'relevance' : 'happenedAt',
        sortDirection: 'desc',
        limit: 500
      });
      for (const item of page.items) {
        itemsById.set(item.id, { ...item });
      }
    }
    return [...itemsById.values()];
  }

  private normalizeRateItemAffinity(item: ActivityRateDTO): number {
    const scoreGiven = Number.isFinite(Number(item.scoreGiven)) ? Math.max(0, Number(item.scoreGiven)) : 0;
    const scoreReceived = Number.isFinite(Number(item.scoreReceived)) ? Math.max(0, Number(item.scoreReceived)) : 0;
    const score = scoreGiven > 0 && scoreReceived > 0
      ? (2 * scoreGiven * scoreReceived) / (scoreGiven + scoreReceived)
      : (scoreGiven > 0 ? scoreGiven : scoreReceived > 0 ? scoreReceived : 5);
    return Math.max(40, Math.min(100, Math.round(score * 10)));
  }

  private isFinishedMetActivity(happenedAt: string): boolean {
    const happenedAtMs = AppUtils.toSortableDate(happenedAt);
    return happenedAtMs <= 0 || happenedAtMs <= Date.now();
  }
}

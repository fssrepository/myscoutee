import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { ActivityInviteCandidatesQuery } from '../../contracts/activity.interface';
import type { UserDto } from '../../contracts/user.interface';
import type { RateRecord } from '../../contracts/activity.interface';
import type { LocalActivityInviteCandidateRecord } from '../mappers';
import { LocalContactsRepository } from './contacts.repository';
import { LocalRatesRepository } from './rates.repository';
import { LocalUsersRepository } from './users.repository';
import type * as ActivityContracts from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesRepository {
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly ratesRepository = inject(LocalRatesRepository);
  private readonly contactsRepository = inject(LocalContactsRepository);

  async queryCandidateRecords(query: ActivityInviteCandidatesQuery): Promise<LocalActivityInviteCandidateRecord[]> {
    const activeUserId = query.activeUserId.trim();
    const ownerId = query.owner.ownerId.trim();
    if (!activeUserId || !ownerId) {
      return [];
    }

    const activeUser = this.usersRepository.queryUserById(activeUserId);
    if (!activeUser) {
      return [];
    }

    const existingUserIds = new Set(query.existingMemberUserIds.map(userId => userId.trim()).filter(Boolean));
    existingUserIds.add(activeUserId);

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

    const candidates = [...latestMetByUserId.keys()]
      .filter(userId => !existingUserIds.has(userId))
      .map(userId => this.usersRepository.queryUserById(userId))
      .filter((user): user is UserDto => Boolean(user))
      .map(user => {
        const latestMet = latestMetByUserId.get(user.id)!;
        return {
          user,
          metAtIso: latestMet.metAtIso,
          metWhere: latestMet.metWhere,
          userRateAffinity: latestMet.userRateAffinity
        };
      });

    candidates.sort((left, right) => {
      if (query.sort === 'relevant') {
        const leftUserRateAffinity = latestMetByUserId.get(left.user.id)?.userRateAffinity ?? 0;
        const rightUserRateAffinity = latestMetByUserId.get(right.user.id)?.userRateAffinity ?? 0;
        if (rightUserRateAffinity !== leftUserRateAffinity) {
          return rightUserRateAffinity - leftUserRateAffinity;
        }
      }
      return AppUtils.toSortableDate(right.metAtIso) - AppUtils.toSortableDate(left.metAtIso);
    });
    return candidates;
  }

  private async queryMetRateItems(
    activeUserId: string,
    sort: ActivityContracts.ActivityInviteSort
  ): Promise<RateRecord[]> {
    const itemsById = new Map<string, RateRecord>();
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

  private normalizeRateItemAffinity(item: RateRecord): number {
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

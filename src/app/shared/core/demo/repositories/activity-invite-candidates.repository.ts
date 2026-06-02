import { Injectable, inject } from '@angular/core';

import { ActivityMembersBuilder } from '../../base/builders/activity-members.builder';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { DemoUser } from '../../base/interfaces/user.interface';
import type { RateRecord } from '../../base/models/rate.model';
import type {
  ActivityInviteCandidatesQuery,
  ActivityInviteCandidatesRepository
} from '../../base/interfaces/activity-invite.interface';
import { scopedStorageKey } from '../../base/storage-scope';
import { DemoUsersRatingsRepository } from './users-ratings.repository';
import { DemoUsersRepository } from './users.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityInviteCandidatesRepository implements ActivityInviteCandidatesRepository {
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<AppTypes.ActivityMemberEntry[]> {
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
      const storageKey = scopedStorageKey(`navigator.contacts.v1.${activeUserId}`);
      try {
        const rawContacts = localStorage.getItem(storageKey);
        if (rawContacts) {
          const contacts = JSON.parse(rawContacts);
          if (Array.isArray(contacts)) {
            for (const contact of contacts) {
              const contactUserId = (contact.userId || contact.id || '').trim();
              if (contactUserId) {
                existingUserIds.add(contactUserId);
              }
            }
          }
        }
      } catch {
        // Ignore storage errors
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

    const row = this.buildOwnerRow(query);
    const rowKey = `${row.type}:${row.id}`;
    const candidates = [...latestMetByUserId.keys()]
      .filter(userId => !existingUserIds.has(userId))
      .map(userId => this.usersRepository.queryUserById(userId))
      .filter((user): user is DemoUser => Boolean(user))
      .map(user => {
        const entry = ActivityMembersBuilder.toActivityMemberEntry(
          user as unknown as DemoUser,
          row,
          rowKey,
          activeUserId,
          {
            status: 'pending',
            pendingSource: 'admin',
            invitedByActiveUser: true
          }
        );
        const latestMet = latestMetByUserId.get(user.id)!;
        return {
          ...entry,
          metAtIso: latestMet.metAtIso,
          actionAtIso: latestMet.metAtIso,
          metWhere: latestMet.metWhere,
          status: 'pending' as const,
          pendingSource: 'admin' as const,
          requestKind: 'invite' as const,
          invitedByActiveUser: true
        };
      });

    candidates.sort((left, right) => {
      if (query.sort === 'relevant') {
        const leftUserRateAffinity = latestMetByUserId.get(left.userId)?.userRateAffinity ?? 0;
        const rightUserRateAffinity = latestMetByUserId.get(right.userId)?.userRateAffinity ?? 0;
        if (rightUserRateAffinity !== leftUserRateAffinity) {
          return rightUserRateAffinity - leftUserRateAffinity;
        }
      }
      return AppUtils.toSortableDate(right.metAtIso) - AppUtils.toSortableDate(left.metAtIso);
    });
    return candidates;
  }

  private buildOwnerRow(query: ActivityInviteCandidatesQuery): AppTypes.ActivityListRow {
    const type = query.owner.sourceType;
    return {
      id: query.owner.ownerId,
      type,
      status: type === 'hosting' ? 'H' : 'A',
      title: query.owner.title,
      subtitle: query.owner.subtitle,
      detail: query.owner.detail,
      dateIso: query.owner.dateIso,
      distanceMetersExact: Math.max(0, Math.round((Number(query.owner.distanceKm) || 0) * 1000)),
      unread: 0,
      metricScore: 0,
      isAdmin: query.owner.isAdmin
    } as AppTypes.ActivityListRow;
  }

  private async queryMetRateItems(
    activeUserId: string,
    sort: AppTypes.ActivityInviteSort
  ): Promise<RateRecord[]> {
    const itemsById = new Map<string, RateRecord>();
    for (const socialBadgeEnabled of [false, true]) {
      const page = await this.usersRatingsRepository.queryActivityRateItemsPage({
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

import { Injectable, inject } from '@angular/core';

import { ActivityMembersBuilder } from '../../base/builders/activity-members.builder';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { DemoUser } from '../../base/interfaces/user.interface';
import type {
  ActivityInviteCandidatesQuery,
  ActivityInviteCandidatesRepository
} from '../../base/interfaces/activity-invite.interface';
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

    const allUsers = this.usersRepository.queryAllUsers();
    const activeUser = this.usersRepository.queryUserById(activeUserId);
    if (!activeUser) {
      return [];
    }

    const existingUserIds = new Set(query.existingMemberUserIds.map(userId => userId.trim()).filter(Boolean));
    existingUserIds.add(activeUserId);

    const latestMetByUserId = new Map<string, { metAtIso: string; metWhere: string; relevance: number }>();
    for (const rate of this.usersRatingsRepository.queryUserRatesByUserId(activeUserId)) {
      const counterpartIds = this.counterpartUserIds(rate, activeUserId);
      const metAtIso = rate.happenedAtIso?.trim() || rate.updatedAtIso || rate.createdAtIso;
      const metWhere = rate.eventName?.trim() || 'Met on MyScoutee';
      const relevance = this.normalizeRelevance(rate);
      for (const counterpartId of counterpartIds) {
        const current = latestMetByUserId.get(counterpartId);
        if (!current || AppUtils.toSortableDate(metAtIso) > AppUtils.toSortableDate(current.metAtIso)) {
          latestMetByUserId.set(counterpartId, {
            metAtIso,
            metWhere,
            relevance
          });
        }
      }
    }


    if (latestMetByUserId.size < 12) {
      for (const user of allUsers) {
        if (user.id === activeUserId || existingUserIds.has(user.id) || latestMetByUserId.has(user.id)) {
          continue;
        }
        latestMetByUserId.set(user.id, {
          metAtIso: AppUtils.toIsoDateTime(AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((AppUtils.hashText(`${activeUserId}:community:${ownerId}:${user.id}`) % 90) + 1))),
          metWhere: 'MyScoutee community',
          relevance: 56 + (AppUtils.hashText(`${activeUserId}:community:${user.id}`) % 18)
        });
        if (latestMetByUserId.size >= 12) {
          break;
        }
      }
    }

    const row = this.buildOwnerRow(query);
    const rowKey = `${row.type}:${row.id}`;
    const candidates = allUsers
      .filter(user => !existingUserIds.has(user.id))
      .filter(user => latestMetByUserId.has(user.id))
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
          relevance: latestMet.relevance,
          status: 'pending' as const,
          pendingSource: 'admin' as const,
          requestKind: 'invite' as const,
          invitedByActiveUser: true
        };
      });

    candidates.sort((left, right) => {
      if (query.sort === 'relevant' && right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      return AppUtils.toSortableDate(right.metAtIso) - AppUtils.toSortableDate(left.metAtIso);
    });
    return candidates;
  }

  private buildOwnerRow(query: ActivityInviteCandidatesQuery): AppTypes.ActivityListRow {
    const type = query.owner.sourceType;
    const baseSource = {
      id: query.owner.ownerId,
      avatar: query.owner.title,
      title: query.owner.title,
      shortDescription: query.owner.subtitle,
      timeframe: query.owner.detail,
      activity: 0
    };
    return {
      id: query.owner.ownerId,
      type,
      title: query.owner.title,
      subtitle: query.owner.subtitle,
      detail: query.owner.detail,
      dateIso: query.owner.dateIso,
      distanceKm: query.owner.distanceKm,
      unread: 0,
      metricScore: 0,
      isAdmin: query.owner.isAdmin,
      source: type === 'hosting'
        ? baseSource
        : { ...baseSource, isAdmin: query.owner.isAdmin }
    } as AppTypes.ActivityListRow;
  }

  private counterpartUserIds(
    rate: {
      fromUserId: string;
      toUserId: string;
      ownerUserId?: string;
      mode: 'single' | 'pair';
    },
    activeUserId: string
  ): string[] {
    if (rate.mode === 'pair' && rate.ownerUserId?.trim() === activeUserId) {
      return [rate.fromUserId.trim(), rate.toUserId.trim()].filter(userId => userId && userId !== activeUserId);
    }
    if (rate.fromUserId.trim() === activeUserId) {
      return [rate.toUserId.trim()].filter(Boolean);
    }
    if (rate.toUserId.trim() === activeUserId) {
      return [rate.fromUserId.trim()].filter(Boolean);
    }
    return [];
  }

  private normalizeRelevance(rate: {
    rate: number;
    scoreGiven?: number;
    scoreReceived?: number;
  }): number {
    const base = Number.isFinite(Number(rate.rate)) ? Number(rate.rate) : 5;
    const given = Number.isFinite(Number(rate.scoreGiven)) ? Number(rate.scoreGiven) : base;
    const received = Number.isFinite(Number(rate.scoreReceived)) ? Number(rate.scoreReceived) : base;
    return Math.max(40, Math.min(100, Math.round(((given + received) / 2) * 10)));
  }
}

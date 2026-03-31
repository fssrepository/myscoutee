import { AppUtils } from '../../../app-utils';
import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { UserRateRecord } from '../../base/interfaces/game.interface';

type RateUserRef = {
  id: string;
  gender?: 'woman' | 'man';
};

interface GeneratedRateItemsOptions {
  extraSingleGivenCount?: number;
  userCoverageRatio?: number;
}

export class DemoUserRatesBuilder {
  private static readonly DEFAULT_EXTRA_SINGLE_GIVEN_COUNT = 0;
  private static readonly DEFAULT_USER_COVERAGE_RATIO = 1;

  static buildGeneratedRateItemsForUser<TUser extends RateUserRef>(
    users: readonly TUser[],
    activeUserId: string,
    options: GeneratedRateItemsOptions = {}
  ): RateMenuItem[] {
    const otherUsers = users
      .filter(user => user.id !== activeUserId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const seededUsers = this.selectSeedUsers(otherUsers, activeUserId, options.userCoverageRatio);
    const seededUserIds = new Set(seededUsers.map(user => user.id));
    const extraTargetUsers = otherUsers
      .filter(user => !seededUserIds.has(user.id))
      .sort((left, right) =>
        AppUtils.hashText(`rate-extra-seed:${activeUserId}:${left.id}`)
        - AppUtils.hashText(`rate-extra-seed:${activeUserId}:${right.id}`)
        || left.id.localeCompare(right.id)
      );
    const extraUsers = extraTargetUsers.length > 0 ? extraTargetUsers : seededUsers;
    const filterLanes: Array<{ mode: 'individual' | 'pair'; direction: RateMenuItem['direction'] }> = [
      { mode: 'individual', direction: 'given' },
      { mode: 'individual', direction: 'received' },
      { mode: 'individual', direction: 'mutual' },
      { mode: 'individual', direction: 'met' },
      { mode: 'pair', direction: 'given' },
      { mode: 'pair', direction: 'received' }
    ];
    const generated: RateMenuItem[] = [];
    seededUsers.forEach((user, userIndex) => {
      const laneIndex = userIndex % filterLanes.length;
      const lane = filterLanes[laneIndex];
      let secondaryUserId: string | undefined;
      if (lane.mode === 'pair') {
        secondaryUserId = lane.direction === 'received'
          ? activeUserId
          : this.selectPairSecondaryUserId(otherUsers, user.id, userIndex, laneIndex);
      }
      generated.push(
        this.buildGeneratedRateItemForLane(
          activeUserId,
          user.id,
          lane.mode,
          lane.direction,
          laneIndex,
          userIndex,
          0,
          secondaryUserId
        )
      );
    });

    const extraSingleGivenCount = Math.max(
      0,
      Math.trunc(options.extraSingleGivenCount ?? DemoUserRatesBuilder.DEFAULT_EXTRA_SINGLE_GIVEN_COUNT)
    );
    for (let extraIndex = 0; extraIndex < extraSingleGivenCount; extraIndex += 1) {
      const targetUser = extraUsers[extraIndex % extraUsers.length];
      if (!targetUser) {
        break;
      }
      generated.push(
        this.buildGeneratedRateItemForLane(
          activeUserId,
          targetUser.id,
          'individual',
          'given',
          0,
          seededUsers.length + extraIndex,
          extraIndex + 1
        )
      );
    }
    return generated;
  }

  static buildActivityRateSeedRecords<TUser extends RateUserRef>(
    users: readonly TUser[],
    options: GeneratedRateItemsOptions = {}
  ): UserRateRecord[] {
    return users.flatMap(user =>
      this.buildGeneratedRateItemsForUser(users, user.id, options)
        .map(item => this.toActivityRateRecord(user.id, item))
    );
  }

  static toActivityRateRecord(ownerUserId: string, item: RateMenuItem): UserRateRecord {
    const normalizedOwnerUserId = ownerUserId.trim();
    const normalizedCounterpartyUserId = item.userId.trim();
    const normalizedSecondaryUserId = item.secondaryUserId?.trim() ?? '';
    const activityRateId = item.id.trim() || this.createRateId();
    const scoreGiven = this.normalizeRateScore(item.scoreGiven);
    const scoreReceived = this.normalizeRateScore(item.scoreReceived);

    let fromUserId = normalizedOwnerUserId;
    let toUserId = normalizedCounterpartyUserId;
    let rate = scoreGiven;

    if (item.mode === 'pair' && normalizedSecondaryUserId && normalizedSecondaryUserId !== normalizedCounterpartyUserId) {
      fromUserId = normalizedCounterpartyUserId;
      toUserId = normalizedSecondaryUserId;
      rate = item.direction === 'received' ? scoreReceived : scoreGiven;
    } else {
      if (item.direction === 'received') {
        fromUserId = normalizedCounterpartyUserId;
        toUserId = normalizedOwnerUserId;
        rate = scoreReceived;
      } else if (item.direction === 'met') {
        rate = 0;
      }
    }

    const happenedAtIso = item.happenedAt?.trim() || new Date().toISOString();
    return {
      id: activityRateId,
      fromUserId,
      toUserId,
      rate,
      mode: item.mode === 'pair' ? 'pair' : 'single',
      source: 'activity-rate',
      createdAtIso: happenedAtIso,
      updatedAtIso: happenedAtIso,
      ownerUserId: normalizedOwnerUserId,
      displayId: activityRateId,
      displayDirection: item.direction,
      socialContext: item.socialContext,
      bridgeUserId: item.bridgeUserId,
      bridgeCount: item.bridgeCount,
      scoreGiven,
      scoreReceived,
      eventName: item.eventName,
      happenedAtIso,
      distanceKm: Number.isFinite(item.distanceKm) ? Number(item.distanceKm) : 0,
      distanceMetersExact: this.normalizeDistanceMetersExact(item.distanceMetersExact, item.distanceKm, activityRateId)
    };
  }

  static toRateMenuItem(record: UserRateRecord): RateMenuItem | null {
    if (record.source !== 'activity-rate') {
      return null;
    }
    const direction = record.displayDirection;
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (!direction || !ownerUserId) {
      return null;
    }
    if (record.mode === 'pair') {
      const firstUserId = record.fromUserId.trim();
      const secondUserId = record.toUserId.trim();
      if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
        return null;
      }
      const socialContext = this.resolvePairSocialContext(record);
      if (direction === 'received') {
        if (firstUserId === ownerUserId) {
          return {
            id: record.displayId?.trim() || record.id,
            userId: secondUserId,
            secondaryUserId: firstUserId,
            mode: 'pair',
            direction,
            socialContext,
            bridgeUserId: record.bridgeUserId,
            bridgeCount: record.bridgeCount,
            scoreGiven: this.normalizeRateScore(record.scoreGiven),
            scoreReceived: this.normalizeRateScore(record.scoreReceived),
            eventName: record.eventName?.trim() || 'Rate',
            happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
            distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
            distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
          };
        }
        if (secondUserId === ownerUserId) {
          return {
            id: record.displayId?.trim() || record.id,
            userId: firstUserId,
            secondaryUserId: secondUserId,
            mode: 'pair',
            direction,
            socialContext,
            bridgeUserId: record.bridgeUserId,
            bridgeCount: record.bridgeCount,
            scoreGiven: this.normalizeRateScore(record.scoreGiven),
            scoreReceived: this.normalizeRateScore(record.scoreReceived),
            eventName: record.eventName?.trim() || 'Rate',
            happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
            distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
            distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
          };
        }
      } else if (firstUserId === ownerUserId || secondUserId === ownerUserId) {
        return null;
      }
      return {
        id: record.displayId?.trim() || record.id,
        userId: firstUserId,
        secondaryUserId: secondUserId,
        mode: 'pair',
        direction,
        socialContext,
        bridgeUserId: record.bridgeUserId,
        bridgeCount: record.bridgeCount,
        scoreGiven: this.normalizeRateScore(record.scoreGiven),
        scoreReceived: this.normalizeRateScore(record.scoreReceived),
        eventName: record.eventName?.trim() || 'Rate',
        happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
        distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
        distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
      };
    }
    const counterpartyUserId = record.fromUserId === ownerUserId
      ? record.toUserId
      : record.fromUserId;
    return {
      id: record.displayId?.trim() || record.id,
      userId: counterpartyUserId,
      mode: 'individual',
      direction,
      socialContext: record.socialContext,
      bridgeUserId: record.bridgeUserId,
      bridgeCount: record.bridgeCount,
      scoreGiven: this.normalizeRateScore(record.scoreGiven),
      scoreReceived: this.normalizeRateScore(record.scoreReceived),
      eventName: record.eventName?.trim() || 'Rate',
      happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
      distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
      distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
    };
  }

  static toGameCardRateMenuItem(record: UserRateRecord, ownerUserId: string): RateMenuItem | null {
    if (record.source !== 'game-card') {
      return null;
    }
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return null;
    }
    if (record.mode === 'pair') {
      const firstUserId = record.fromUserId.trim();
      const secondUserId = record.toUserId.trim();
      if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
        return null;
      }
      const recordOwnerUserId = record.ownerUserId?.trim() ?? '';
      const normalizedScore = this.normalizeRateScore(record.rate);
      if (recordOwnerUserId === normalizedOwnerUserId) {
        return {
          id: record.id,
          userId: firstUserId,
          secondaryUserId: secondUserId,
          mode: 'pair',
          direction: 'given',
          socialContext: 'separated-friends',
          scoreGiven: normalizedScore,
          scoreReceived: 0,
          eventName: 'Pair rate',
          happenedAt: record.updatedAtIso,
          distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
          distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
        };
      }
      if (firstUserId === normalizedOwnerUserId || secondUserId === normalizedOwnerUserId) {
        const otherUserId = firstUserId === normalizedOwnerUserId ? secondUserId : firstUserId;
        return {
          id: record.id,
          userId: otherUserId,
          secondaryUserId: normalizedOwnerUserId,
          mode: 'pair',
          direction: 'received',
          socialContext: 'friends-in-common',
          bridgeUserId: recordOwnerUserId || undefined,
          bridgeCount: 1,
          scoreGiven: 0,
          scoreReceived: normalizedScore,
          eventName: 'Pair rate',
          happenedAt: record.updatedAtIso,
          distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
          distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
        };
      }
      return null;
    }
    const isGiven = record.fromUserId === normalizedOwnerUserId;
    const isReceived = record.toUserId === normalizedOwnerUserId;
    if (!isGiven && !isReceived) {
      return null;
    }
    const counterpartyUserId = isGiven ? record.toUserId : record.fromUserId;
    if (!counterpartyUserId.trim()) {
      return null;
    }
    const normalizedScore = this.normalizeRateScore(record.rate);
    return {
      id: record.id,
      userId: counterpartyUserId,
      mode: 'individual',
      direction: isGiven ? 'given' : 'received',
      scoreGiven: isGiven ? normalizedScore : 0,
      scoreReceived: isReceived ? normalizedScore : 0,
      eventName: 'Single rate',
      happenedAt: record.updatedAtIso,
      distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0,
      distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact, record.distanceKm, record.id)
    };
  }

  private static buildGeneratedRateItemForLane(
    activeUserId: string,
    targetUserId: string,
    mode: 'individual' | 'pair',
    direction: RateMenuItem['direction'],
    laneIndex: number,
    userIndex: number,
    variantIndex = 0,
    secondaryUserId?: string
  ): RateMenuItem {
    const seed = AppUtils.hashText(
      `rate-grid:${activeUserId}:${targetUserId}:${secondaryUserId ?? ''}:${mode}:${direction}:${variantIndex}`
    );
    const happenedAtDate = new Date('2026-03-01T20:00:00');
    happenedAtDate.setDate(happenedAtDate.getDate() - ((laneIndex * 17) + userIndex + 1 + (variantIndex * 2)));
    const happenedAt = AppUtils.toIsoDateTime(happenedAtDate);
    let scoreGiven = 0;
    let scoreReceived = 0;
    if (direction === 'given') {
      scoreGiven = 4 + (seed % 7);
      scoreReceived = seed % 2 === 0 ? 4 + ((seed + 2) % 7) : 0;
    } else if (direction === 'received') {
      scoreGiven = 0;
      scoreReceived = 4 + ((seed + 3) % 7);
    } else if (direction === 'mutual') {
      scoreGiven = 4 + (seed % 7);
      scoreReceived = 4 + ((seed + 5) % 7);
    } else if (direction === 'met') {
      scoreGiven = 4 + (seed % 7);
      scoreReceived = 0;
    }
    const variantSuffix = variantIndex > 0 ? `-v${variantIndex}` : '';
    return {
      id: this.createRateId(),
      userId: targetUserId,
      ...(secondaryUserId ? { secondaryUserId } : {}),
      mode,
      direction,
      ...(mode === 'pair' ? { socialContext: this.generatedPairSocialContext(direction) } : {}),
      scoreGiven,
      scoreReceived,
      eventName: variantIndex > 0
        ? `${mode === 'pair' ? 'Pair' : 'Single'} ${direction} ${variantIndex + 1}`
        : `${mode === 'pair' ? 'Pair' : 'Single'} ${direction}`,
      happenedAt,
      distanceKm: 2 + ((seed + laneIndex + userIndex) % 33),
      distanceMetersExact: this.seedDistanceMetersExact(2 + ((seed + laneIndex + userIndex) % 33), seed)
    };
  }

  private static createRateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `rate-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private static selectPairSecondaryUserId<TUser extends RateUserRef>(
    users: readonly TUser[],
    primaryUserId: string,
    userIndex: number,
    laneIndex: number
  ): string | undefined {
    const primaryUser = users.find(user => user.id === primaryUserId) ?? null;
    const preferredCandidates = users.filter(user =>
      user.id !== primaryUserId
      && (!!primaryUser?.gender ? user.gender === this.oppositeGender(primaryUser.gender) : true)
    );
    const fallbackCandidates = users.filter(user => user.id !== primaryUserId);
    const pool = preferredCandidates.length > 0 ? preferredCandidates : fallbackCandidates;
    if (pool.length === 0) {
      return undefined;
    }
    const index = (userIndex + laneIndex + 1) % pool.length;
    return pool[index]?.id;
  }

  private static oppositeGender(gender: 'woman' | 'man'): 'woman' | 'man' {
    return gender === 'woman' ? 'man' : 'woman';
  }

  private static resolvePairSocialContext(
    record: UserRateRecord
  ): RateMenuItem['socialContext'] {
    return record.socialContext ?? this.generatedPairSocialContext(record.displayDirection);
  }

  private static generatedPairSocialContext(
    direction: UserRateRecord['displayDirection'] | RateMenuItem['direction']
  ): RateMenuItem['socialContext'] | undefined {
    if (direction === 'given') {
      return 'separated-friends';
    }
    if (direction === 'received') {
      return 'friends-in-common';
    }
    return undefined;
  }

  private static selectSeedUsers<TUser extends RateUserRef>(
    users: readonly TUser[],
    activeUserId: string,
    requestedCoverageRatio: number | undefined
  ): TUser[] {
    const coverageRatio = this.normalizeCoverageRatio(requestedCoverageRatio);
    if (coverageRatio >= 1 || users.length <= 1) {
      return [...users];
    }
    if (coverageRatio <= 0 || users.length === 0) {
      return [];
    }
    const targetCount = Math.max(1, Math.round(users.length * coverageRatio));
    return [...users]
      .map(user => ({
        user,
        seed: AppUtils.hashText(`rate-seed-coverage:${activeUserId}:${user.id}`)
      }))
      .sort((left, right) => left.seed - right.seed || left.user.id.localeCompare(right.user.id))
      .slice(0, targetCount)
      .map(entry => entry.user)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private static normalizeRateScore(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.trunc(Number(value))));
  }

  private static normalizeCoverageRatio(value: number | undefined): number {
    if (!Number.isFinite(value)) {
      return DemoUserRatesBuilder.DEFAULT_USER_COVERAGE_RATIO;
    }
    return Math.max(0, Math.min(1, Number(value)));
  }

  private static normalizeDistanceMetersExact(value: unknown, distanceKm: unknown, seedKey: string): number {
    if (Number.isFinite(value)) {
      return Math.max(0, Math.trunc(Number(value)));
    }
    const normalizedDistanceKm = Number.isFinite(distanceKm) ? Math.max(0, Number(distanceKm)) : 0;
    return this.seedDistanceMetersExact(normalizedDistanceKm, AppUtils.hashText(`distance:${seedKey}`));
  }

  private static seedDistanceMetersExact(distanceKm: number, seed: number): number {
    const kmFloor = Math.max(0, Math.trunc(distanceKm));
    const fractionalMeters = seed % 1000;
    return (kmFloor * 1000) + fractionalMeters;
  }
}

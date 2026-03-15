import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type { RateMenuItem } from '../../../demo-data';
import type { UserRateRecord } from '../../base/interfaces/game.interface';

type RateUserRef = { id: string };

interface GeneratedRateItemsOptions {
  extraSingleGivenCount?: number;
}

export class DemoUserRatesBuilder {
  private static readonly DEFAULT_EXTRA_SINGLE_GIVEN_COUNT = 0;

  static buildGeneratedRateItemsForUser<TUser extends RateUserRef>(
    users: readonly TUser[],
    activeUserId: string,
    options: GeneratedRateItemsOptions = {}
  ): RateMenuItem[] {
    const otherUsers = users
      .filter(user => user.id !== activeUserId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const filterLanes: Array<{ mode: 'individual' | 'pair'; direction: RateMenuItem['direction'] }> = [
      { mode: 'individual', direction: 'given' },
      { mode: 'individual', direction: 'received' },
      { mode: 'individual', direction: 'mutual' },
      { mode: 'individual', direction: 'met' },
      { mode: 'pair', direction: 'given' },
      { mode: 'pair', direction: 'received' }
    ];
    const generated: RateMenuItem[] = [];
    otherUsers.forEach((user, userIndex) => {
      const laneIndex = userIndex % filterLanes.length;
      const lane = filterLanes[laneIndex];
      generated.push(this.buildGeneratedRateItemForLane(activeUserId, user.id, lane.mode, lane.direction, laneIndex, userIndex));
    });

    const extraSingleGivenCount = Math.max(
      0,
      Math.trunc(options.extraSingleGivenCount ?? DemoUserRatesBuilder.DEFAULT_EXTRA_SINGLE_GIVEN_COUNT)
    );
    for (let extraIndex = 0; extraIndex < extraSingleGivenCount; extraIndex += 1) {
      const targetUser = otherUsers[extraIndex % otherUsers.length];
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
          otherUsers.length + extraIndex,
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
    const scoreGiven = this.normalizeRateScore(item.scoreGiven);
    const scoreReceived = this.normalizeRateScore(item.scoreReceived);

    let fromUserId = normalizedOwnerUserId;
    let toUserId = normalizedCounterpartyUserId;
    let rate = scoreGiven;

    if (item.direction === 'received') {
      fromUserId = normalizedCounterpartyUserId;
      toUserId = normalizedOwnerUserId;
      rate = scoreReceived;
    } else if (item.direction === 'met') {
      rate = 0;
    }

    const happenedAtIso = item.happenedAt?.trim() || new Date().toISOString();
    return {
      id: `activity-rate:${normalizedOwnerUserId}:${item.id}`,
      fromUserId,
      toUserId,
      rate,
      mode: item.mode === 'pair' ? 'pair' : 'single',
      source: 'activity-rate',
      createdAtIso: happenedAtIso,
      updatedAtIso: happenedAtIso,
      ownerUserId: normalizedOwnerUserId,
      displayId: item.id,
      displayDirection: item.direction,
      scoreGiven,
      scoreReceived,
      eventName: item.eventName,
      happenedAtIso,
      distanceKm: Number.isFinite(item.distanceKm) ? Number(item.distanceKm) : 0
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
    const counterpartyUserId = record.fromUserId === ownerUserId
      ? record.toUserId
      : record.fromUserId;
    const mode: RateMenuItem['mode'] = record.mode === 'pair' ? 'pair' : 'individual';
    return {
      id: record.displayId?.trim() || record.id,
      userId: counterpartyUserId,
      mode,
      direction,
      scoreGiven: this.normalizeRateScore(record.scoreGiven),
      scoreReceived: this.normalizeRateScore(record.scoreReceived),
      eventName: record.eventName?.trim() || 'Rate',
      happenedAt: record.happenedAtIso?.trim() || record.updatedAtIso,
      distanceKm: Number.isFinite(record.distanceKm) ? Number(record.distanceKm) : 0
    };
  }

  private static buildGeneratedRateItemForLane(
    activeUserId: string,
    targetUserId: string,
    mode: 'individual' | 'pair',
    direction: RateMenuItem['direction'],
    laneIndex: number,
    userIndex: number,
    variantIndex = 0
  ): RateMenuItem {
    const seed = AppDemoGenerators.hashText(`rate-grid:${activeUserId}:${targetUserId}:${mode}:${direction}:${variantIndex}`);
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
      id: `rate-${activeUserId}-${mode}-${direction}-${targetUserId}${variantSuffix}`,
      userId: targetUserId,
      mode,
      direction,
      scoreGiven,
      scoreReceived,
      eventName: variantIndex > 0
        ? `${mode === 'pair' ? 'Pair' : 'Single'} ${direction} ${variantIndex + 1}`
        : `${mode === 'pair' ? 'Pair' : 'Single'} ${direction}`,
      happenedAt,
      distanceKm: 2 + ((seed + laneIndex + userIndex) % 33)
    };
  }

  private static normalizeRateScore(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.trunc(Number(value))));
  }
}

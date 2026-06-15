import type { ActivityRateDTO } from '../../../contracts/activity.interface';
import type { UserRateRecord } from '../entity/rate.entity';

export class LocalUserRatesMapper {
  static toUserRateRecord(ownerUserId: string, item: ActivityRateDTO): UserRateRecord {
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
      distanceMetersExact: this.normalizeDistanceMetersExact(item.distanceMetersExact)
    };
  }

  static toActivityRateDTO(record: UserRateRecord): ActivityRateDTO | null {
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
            distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact)
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
            distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact)
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
        distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact)
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
      distanceMetersExact: this.normalizeDistanceMetersExact(record.distanceMetersExact)
    };
  }

  private static createRateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `rate-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private static resolvePairSocialContext(
    record: UserRateRecord
  ): ActivityRateDTO['socialContext'] {
    return record.socialContext;
  }

  private static normalizeRateScore(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.trunc(Number(value))));
  }

  private static normalizeDistanceMetersExact(value: unknown): number {
    if (Number.isFinite(value)) {
      return Math.max(0, Math.trunc(Number(value)));
    }
    return 0;
  }
}

import type {
  ActivityRateDTO,
  UserRateSyncPayloadDTO
} from '../../contracts/activity.interface';
import type { UserRateRecord } from '../../local/source/entity/rate.entity';

export interface UserRateGameCardRecordDTO {
  kind: 'game-card';
  raterUserId: string;
  ratedUserId: string;
  rating: number;
  mode?: 'single' | 'pair';
  socialContext?: ActivityRateDTO['socialContext'];
  bridgeUserId?: string;
  bridgeCount?: number;
}

export interface UserRateGameCardPairRecordDTO {
  kind: 'game-card-pair';
  raterUserId: string;
  firstRatedUserId: string;
  secondRatedUserId: string;
  rating: number;
  socialContext?: ActivityRateDTO['socialContext'];
}

export interface UserRateActivityRecordDTO {
  kind: 'activity-rate';
  ownerUserId: string;
  item: ActivityRateDTO;
  rating: number;
  direction?: ActivityRateDTO['direction'] | null;
}

export type UserRateRecordDTO =
  | UserRateGameCardRecordDTO
  | UserRateGameCardPairRecordDTO
  | UserRateActivityRecordDTO;

export class BaseUserRatesMapper {
  static toRecord(ownerUserId: string, item: ActivityRateDTO): UserRateRecord;
  static toRecord(input: UserRateRecordDTO): UserRateRecord | null;
  static toRecord(ownerUserIdOrInput: string | UserRateRecordDTO, item?: ActivityRateDTO): UserRateRecord | null {
    if (typeof ownerUserIdOrInput === 'string') {
      return this.toActivityRateRecord(ownerUserIdOrInput, item!);
    }
    switch (ownerUserIdOrInput.kind) {
      case 'game-card':
        return this.toGameCardRateRecord(ownerUserIdOrInput);
      case 'game-card-pair':
        return this.toGameCardPairRateRecord(ownerUserIdOrInput);
      case 'activity-rate':
        return this.toActivityRateInputRecord(ownerUserIdOrInput);
      default:
        return null;
    }
  }

  private static toActivityRateRecord(ownerUserId: string, item: ActivityRateDTO): UserRateRecord {
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

  private static toGameCardRateRecord(input: UserRateGameCardRecordDTO): UserRateRecord | null {
    const normalizedRaterId = input.raterUserId.trim();
    const normalizedRatedUserId = input.ratedUserId.trim();
    const mode = input.mode === 'pair' ? 'pair' : 'single';
    if (!normalizedRaterId || !normalizedRatedUserId || normalizedRaterId === normalizedRatedUserId) {
      return null;
    }
    const normalizedRating = this.normalizeRequiredRateScore(input.rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
      return null;
    }
    const nowIso = new Date().toISOString();
    const normalizedSocialContext = this.normalizeRateSocialContext(mode, input.socialContext);
    const normalizedBridgeUserId = normalizedSocialContext === 'friends-in-common'
      ? input.bridgeUserId?.trim() ?? ''
      : '';
    const normalizedBridgeCount = normalizedSocialContext === 'friends-in-common' && Number.isFinite(Number(input.bridgeCount))
      ? Math.max(1, Math.trunc(Number(input.bridgeCount)))
      : undefined;
    return this.toActivityRateRecord(normalizedRaterId, {
      id: `game-card:${normalizedRaterId}:${normalizedRatedUserId}`,
      userId: normalizedRatedUserId,
      mode: mode === 'pair' ? 'pair' : 'individual',
      direction: 'given',
      socialContext: normalizedSocialContext ?? undefined,
      ...(normalizedBridgeUserId ? { bridgeUserId: normalizedBridgeUserId } : {}),
      ...(normalizedBridgeCount ? { bridgeCount: normalizedBridgeCount } : {}),
      scoreGiven: normalizedRating,
      scoreReceived: 0,
      eventName: 'Single rate',
      happenedAt: nowIso,
      distanceMetersExact: 0
    });
  }

  private static toGameCardPairRateRecord(input: UserRateGameCardPairRecordDTO): UserRateRecord | null {
    const normalizedOwnerUserId = input.raterUserId.trim();
    const normalizedFirstUserId = input.firstRatedUserId.trim();
    const normalizedSecondUserId = input.secondRatedUserId.trim();
    if (
      !normalizedOwnerUserId
      || !normalizedFirstUserId
      || !normalizedSecondUserId
      || normalizedFirstUserId === normalizedSecondUserId
      || normalizedFirstUserId === normalizedOwnerUserId
      || normalizedSecondUserId === normalizedOwnerUserId
    ) {
      return null;
    }
    const normalizedRating = this.normalizeRequiredRateScore(input.rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
      return null;
    }
    const [fromUserId, toUserId] = [normalizedFirstUserId, normalizedSecondUserId].sort((left, right) => left.localeCompare(right));
    const nowIso = new Date().toISOString();
    return this.toActivityRateRecord(normalizedOwnerUserId, {
      id: `game-card-pair:${normalizedOwnerUserId}:${fromUserId}:${toUserId}`,
      userId: fromUserId,
      secondaryUserId: toUserId,
      mode: 'pair',
      direction: 'given',
      socialContext: this.normalizeRateSocialContext('pair', input.socialContext) ?? undefined,
      scoreGiven: normalizedRating,
      scoreReceived: 0,
      eventName: 'Pair rate',
      happenedAt: nowIso,
      distanceMetersExact: 0
    });
  }

  private static toActivityRateInputRecord(input: UserRateActivityRecordDTO): UserRateRecord | null {
    const normalizedOwnerUserId = input.ownerUserId.trim();
    const normalizedUserId = input.item.userId.trim();
    if (!normalizedOwnerUserId || !normalizedUserId) {
      return null;
    }
    const nextDirection = this.normalizeRateDirection(input.direction ?? input.item.direction);
    if (!nextDirection) {
      return null;
    }
    return this.toActivityRateRecord(normalizedOwnerUserId, {
      ...input.item,
      userId: normalizedUserId,
      secondaryUserId: input.item.secondaryUserId?.trim() || undefined,
      direction: nextDirection,
      socialContext: input.item.socialContext,
      bridgeUserId: input.item.bridgeUserId?.trim() || undefined,
      bridgeCount: Number.isFinite(input.item.bridgeCount) ? Math.max(0, Math.trunc(Number(input.item.bridgeCount))) : undefined,
      scoreGiven: this.normalizeRequiredRateScore(input.rating),
      scoreReceived: this.normalizeOptionalRateScore(input.item.scoreReceived),
      eventName: input.item.eventName?.trim() || 'Rate',
      happenedAt: input.item.happenedAt?.trim() || new Date().toISOString(),
      distanceMetersExact: Number.isFinite(input.item.distanceMetersExact)
        ? Math.max(0, Math.trunc(Number(input.item.distanceMetersExact)))
        : 0
    });
  }

  static toDto(record: UserRateRecord): ActivityRateDTO | null {
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

  static toSyncPayload(record: UserRateRecord): UserRateSyncPayloadDTO | null {
    const id = record.id?.trim() ?? '';
    const fromUserId = record.fromUserId?.trim() ?? '';
    const toUserId = record.toUserId?.trim() ?? '';
    const mode = record.mode === 'pair' ? 'pair' : record.mode === 'single' ? 'single' : null;
    if (!id || !fromUserId || !toUserId || !mode || fromUserId === toUserId) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const createdAtIso = record.createdAtIso?.trim() || record.happenedAtIso?.trim() || record.updatedAtIso?.trim() || nowIso;
    const updatedAtIso = record.updatedAtIso?.trim() || createdAtIso;
    const payload: UserRateSyncPayloadDTO = {
      id,
      fromUserId,
      toUserId,
      rate: this.normalizeOptionalRateScore(record.rate),
      mode,
      createdAtIso,
      updatedAtIso
    };
    const ownerUserId = record.ownerUserId?.trim() ?? '';
    if (ownerUserId) {
      payload.ownerUserId = ownerUserId;
    }
    const displayId = record.displayId?.trim() ?? '';
    if (displayId) {
      payload.displayId = displayId;
    }
    const displayDirection = this.normalizeRateDirection(record.displayDirection);
    if (displayDirection) {
      payload.displayDirection = displayDirection;
    }
    const socialContext = this.normalizeRateSocialContext(mode, record.socialContext);
    if (socialContext) {
      payload.socialContext = socialContext;
    }
    const bridgeUserId = record.bridgeUserId?.trim() ?? '';
    if (bridgeUserId) {
      payload.bridgeUserId = bridgeUserId;
    }
    if (Number.isFinite(Number(record.bridgeCount))) {
      payload.bridgeCount = Math.max(0, Math.trunc(Number(record.bridgeCount)));
    }
    payload.scoreGiven = this.normalizeOptionalRateScore(record.scoreGiven);
    payload.scoreReceived = this.normalizeOptionalRateScore(record.scoreReceived);
    const eventName = record.eventName?.trim() ?? '';
    if (eventName) {
      payload.eventName = eventName;
    }
    const happenedAtIso = record.happenedAtIso?.trim() ?? '';
    if (happenedAtIso) {
      payload.happenedAtIso = happenedAtIso;
    }
    if (Number.isFinite(Number(record.distanceMetersExact))) {
      payload.distanceMetersExact = Math.max(0, Math.trunc(Number(record.distanceMetersExact)));
    }
    return payload;
  }

  static normalizeRateDirection(
    direction: ActivityRateDTO['direction'] | string | null | undefined
  ): ActivityRateDTO['direction'] | null {
    if (direction === 'given' || direction === 'received' || direction === 'mutual' || direction === 'met') {
      return direction;
    }
    return null;
  }

  static normalizeRateScore(value: unknown): number {
    if (!Number.isFinite(Number(value))) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.trunc(Number(value))));
  }

  static normalizeOptionalRateScore(value: unknown): number {
    if (!Number.isFinite(Number(value))) {
      return 0;
    }
    return Math.max(0, Math.min(10, Math.trunc(Number(value))));
  }

  private static normalizeRequiredRateScore(value: unknown): number {
    return Math.max(1, Math.min(10, Math.trunc(Number(value) || 0)));
  }

  static normalizeRateSocialContext(
    mode: 'single' | 'pair',
    value: unknown
  ): UserRateRecord['socialContext'] | null {
    if (mode === 'single') {
      return value === 'friends-in-common' ? 'friends-in-common' : null;
    }
    return value === 'separated-friends' ? 'separated-friends' : null;
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

  private static normalizeDistanceMetersExact(value: unknown): number {
    if (Number.isFinite(Number(value))) {
      return Math.max(0, Math.trunc(Number(value)));
    }
    return 0;
  }
}

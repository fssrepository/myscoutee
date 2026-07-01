import { AppUtils } from '../../app-utils';
import type { ActivityRateDTO } from '../../core/contracts/activity.interface';
import type { UserDto } from '../../core/contracts/user.interface';
import type { ImageCardData, ImageCardPerson, PairCardSlot } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityRateImageCardConverterOptions {
  resolveRatedUserById: (userId: string) => UserDto | null;
}

export class ActivityRateImageCardConverter {
  static convert(
    dto: ActivityRateDTO,
    options: ActivityRateImageCardConverterOptions
  ): ImageCardData {
    const direction = dto.direction;
    const primaryUser = this.resolvePrimaryUser(dto, options);
    const ownScore = this.rateOwnScore(dto);
    const distanceMetersExact = this.exactDistanceMeters(dto);
    const sortScore = direction === 'mutual' ? ownScore + Math.max(dto.scoreReceived, 0) : ownScore;

    return {
      id: dto.id,
      smartListKey: `rates:${dto.id}`,
      status: direction,
      dateIso: dto.happenedAt ?? '',
      distanceMetersExact,
      sortScore,
      title: primaryUser?.name ?? dto.userId,
      subtitle: '',
      detail: '',
      mode: dto.mode,
      direction: dto.direction,
      displayedDirection: direction,
      eventName: dto.eventName,
      happenedOnLabel: this.formatMonthDayLabel(dto.happenedAt),
      primaryUser: primaryUser ? this.toImageCardPerson(primaryUser) : null,
      pairUsers: this.buildPairUsers(dto, options),
      singleImageUrls: this.buildSingleImageUrls(dto, primaryUser),
      pairSlots: this.buildPairSlots(dto, options),
      stackClasses: [
        dto.mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
        `activities-rate-profile-stack-${direction}`
      ],
      userId: dto.userId,
      secondaryUserId: dto.secondaryUserId ?? null,
      socialContext: dto.socialContext ?? null,
      bridgeUserId: dto.bridgeUserId ?? null,
      bridgeCount: Number.isFinite(dto.bridgeCount) ? Math.max(0, Math.trunc(Number(dto.bridgeCount))) : null,
      scoreGiven: Number.isFinite(dto.scoreGiven) ? dto.scoreGiven : null,
      scoreReceived: Number.isFinite(dto.scoreReceived) ? dto.scoreReceived : null
    };
  }

  static convertList(
    dtos: readonly ActivityRateDTO[],
    options: ActivityRateImageCardConverterOptions
  ): ImageCardData[] {
    return dtos.map(dto => this.convert(dto, options));
  }

  private static resolvePrimaryUser(
    dto: ActivityRateDTO,
    options: ActivityRateImageCardConverterOptions
  ): UserDto | null {
    return this.resolveRatedUserById(dto.userId, options);
  }

  private static resolveRatedUserById(
    userId: string | undefined,
    options: ActivityRateImageCardConverterOptions
  ): UserDto | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return null;
    }
    return options.resolveRatedUserById(normalizedUserId);
  }

  private static toImageCardPerson(user: UserDto): ImageCardPerson {
    return {
      id: user.id,
      name: user.name,
      age: user.age,
      city: user.city,
      gender: user.gender,
      profile: user
    };
  }

  private static buildPairUsers(
    dto: ActivityRateDTO,
    options: ActivityRateImageCardConverterOptions
  ): ImageCardPerson[] {
    return [dto.userId, dto.secondaryUserId]
      .filter((userId): userId is string => typeof userId === 'string' && userId.trim().length > 0)
      .map(userId => this.resolveRatedUserById(userId, options))
      .filter((user): user is UserDto => Boolean(user))
      .map(user => this.toImageCardPerson(user));
  }

  private static buildSingleImageUrls(
    dto: ActivityRateDTO,
    user: UserDto | null
  ): string[] {
    const seedUserId = user?.id ?? dto.userId ?? dto.id;
    const seededCount = 1 + (AppUtils.hashText(`rate-photo-count:${seedUserId || dto.id}`) % 4);
    const desiredCount = dto.direction === 'met' ? Math.min(2, seededCount) : seededCount;
    return this.buildDisplayImageUrls(user?.images, Math.max(1, Math.min(4, desiredCount)));
  }

  private static buildPairSlots(
    dto: ActivityRateDTO,
    options: ActivityRateImageCardConverterOptions
  ): PairCardSlot[] {
    return ([0, 1] as const).map(index => {
      const slot = index === 0 ? 'woman' : 'man';
      const label = this.resolvePairSlotLabel(dto, index);
      const user = this.resolveRatedUserById(index === 0 ? dto.userId : dto.secondaryUserId, options);
      return {
        key: slot,
        label,
        tone: user?.gender ?? slot,
        slides: user
          ? this.buildPairSlotSlides(dto, slot, user)
          : [{
              imageUrl: '',
              primaryLine: `${label} - waiting`,
              secondaryLine: 'No pair card yet',
              placeholderLabel: ''
            }]
      };
    });
  }

  private static buildPairSlotSlides(
    dto: ActivityRateDTO,
    slot: 'woman' | 'man',
    user: UserDto
  ): PairCardSlot['slides'] {
    const seededCount = 2 + (AppUtils.hashText(`pair-rate-photo-count:${dto.id}:${slot}:${user.id}`) % 2);
    return this.buildDisplayImageUrls(user.images, seededCount).map(imageUrl => ({
      imageUrl,
      primaryLine: `${user.name}, ${user.age}`,
      secondaryLine: `${user.city} - ${this.distanceKmFromMeters(this.exactDistanceMeters(dto))} km`,
      placeholderLabel: AppUtils.initialsFromText(user.name)
    }));
  }

  private static buildDisplayImageUrls(images: readonly string[] | undefined, count: number): string[] {
    const normalizedCount = Math.max(1, Math.min(4, Math.trunc(count)));
    const source = (images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .filter(image => image.length > 0);
    if (source.length === 0) {
      return Array.from({ length: normalizedCount }, () => '');
    }
    return Array.from({ length: normalizedCount }, (_item, index) => source[index % source.length]);
  }

  private static resolvePairSlotLabel(dto: ActivityRateDTO, index: 0 | 1): string {
    if (dto.socialContext === 'friends-in-common') {
      return index === 0 ? 'Person' : 'Common friend';
    }
    if (dto.socialContext === 'separated-friends') {
      return index === 0 ? 'Friend A' : 'Friend B';
    }
    return index === 0 ? 'Person A' : 'Person B';
  }

  private static rateOwnScore(dto: ActivityRateDTO): number {
    if (Number.isFinite(dto.scoreGiven) && dto.scoreGiven > 0) {
      return Math.min(10, Math.max(1, Math.round(dto.scoreGiven)));
    }
    return 5;
  }

  private static exactDistanceMeters(dto: ActivityRateDTO): number {
    if (Number.isFinite(dto.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(dto.distanceMetersExact)));
    }
    return 0;
  }

  private static distanceKmFromMeters(distanceMeters: number): number {
    const meters = Math.max(0, Math.trunc(Number(distanceMeters) || 0));
    return Math.round((meters / 1000) * 10) / 10;
  }

  private static formatMonthDayLabel(isoValue: string | null | undefined): string {
    const date = AppUtils.parseDate(isoValue);
    return date ? AppUtils.shortMonthDayLabel(date) : 'Activity date';
  }
}

export const activityRateImageCardConverter =
  ActivityRateImageCardConverter satisfies UiListConverter<
    ActivityRateDTO,
    ImageCardData,
    ActivityRateImageCardConverterOptions
  >;

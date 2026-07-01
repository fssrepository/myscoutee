import {
  buildPairRateCardData,
  buildSingleRateCardData,
  type CardBadgeConfig,
  type ImageCardData,
  type ImageCardDirection,
  type ImageCardMode,
  type PairCardData,
  type RateCardPerson,
  type SingleCardData
} from '../components/core/smart-list/card';
import type { ActivityRateDTO } from '../../core/contracts/activity.interface';

export interface ActivityRateCardConverterOptions {
  groupLabel?: string | null;
  presentation?: SingleCardData['presentation'] | PairCardData['presentation'];
  state?: SingleCardData['state'] | PairCardData['state'];
  badge: CardBadgeConfig;
  displayedDirection: ActivityRateDTO['direction'];
  activeUserGender: 'woman' | 'man';
  fullscreenSplitEnabled: boolean;
}

export function isActivityRatePairCardRow(row: ImageCardData): boolean {
  return row.mode === 'pair';
}

export class ActivityRateSingleCardConverter {
  static convert(row: ImageCardData, options: ActivityRateCardConverterOptions): SingleCardData {
    return buildSingleRateCardData({
      ...activityRateCardInput(row, options),
      badge: options.badge,
      contextBadge: row.contextBadge ?? null
    });
  }
}

export class ActivityRatePairCardConverter {
  static convert(row: ImageCardData, options: ActivityRateCardConverterOptions): PairCardData {
    return buildPairRateCardData({
      ...activityRateCardInput(row, options),
      badge: options.badge
    });
  }
}

function activityRateCardInput(
  row: ImageCardData,
  options: ActivityRateCardConverterOptions
) {
  const presentation = options.presentation ?? 'list';
  const mode = normalizeRateCardMode(row.mode);
  const direction = normalizeRateCardDirection(options.displayedDirection ?? row.displayedDirection ?? row.direction);

  return {
    rowId: row.id,
    groupLabel: options.groupLabel ?? null,
    title: row.title,
    distanceKm: distanceKmFromMeters(row.distanceMetersExact),
    mode,
    direction,
    eventName: row.eventName ?? '',
    happenedOnLabel: row.happenedOnLabel ?? 'Unknown',
    primaryUser: toActivityRateCardPerson(row.primaryUser),
    pairUsers: activityRateCardPairUsers(row),
    availableUsers: activityRateCardAvailableUsers(row),
    singleImageUrls: resolvedActivityRateImageUrls(row.singleImageUrls),
    pairSlots: activityRateCardPairSlots(row),
    fallbackGender: options.activeUserGender,
    stackClasses: row.stackClasses?.length
      ? [...row.stackClasses]
      : activityRateCardStackClasses(mode, direction),
    presentation,
    state: options.state ?? 'default',
    fullscreenSplitEnabled: presentation === 'fullscreen' ? options.fullscreenSplitEnabled : false
  };
}

function distanceKmFromMeters(distanceMeters: number | null | undefined): number {
  const meters = Number.isFinite(distanceMeters)
    ? Math.max(0, Math.trunc(Number(distanceMeters)))
    : 0;
  return Math.round((meters / 1000) * 10) / 10;
}

function activityRateCardStackClasses(
  mode: ActivityRateDTO['mode'],
  displayedDirection: ActivityRateDTO['direction']
): string[] {
  return [
    mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
    `activities-rate-profile-stack-${displayedDirection}`
  ];
}

function activityRateCardPairSlots(row: ImageCardData): PairCardData['slots'] | undefined {
  if (!row.pairSlots?.length) {
    return undefined;
  }

  const hasUsableImage = row.pairSlots.some(slot =>
    slot.slides.some(slide => `${slide.imageUrl ?? ''}`.trim().length > 0)
  );
  if (!hasUsableImage) {
    return undefined;
  }

  return row.pairSlots.map(slot => ({
    key: slot.key,
    label: slot.label,
    tone: slot.tone,
    slides: slot.slides.map(slide => ({ ...slide })),
    profileView: slot.profileView ?? null
  }));
}

function activityRateCardPairUsers(row: ImageCardData): RateCardPerson[] {
  return (row.pairUsers ?? [])
    .map(user => toActivityRateCardPerson(user))
    .filter((user): user is RateCardPerson => Boolean(user));
}

function activityRateCardAvailableUsers(row: ImageCardData): RateCardPerson[] {
  return (row.availableUsers ?? [])
    .map(user => toActivityRateCardPerson(user))
    .filter((user): user is RateCardPerson => Boolean(user));
}

function resolvedActivityRateImageUrls(imageUrls: readonly string[] | null | undefined): readonly string[] | undefined {
  if (!imageUrls?.length) {
    return undefined;
  }
  const normalizedImageUrls = imageUrls
    .map(imageUrl => `${imageUrl ?? ''}`.trim())
    .filter(imageUrl => imageUrl.length > 0);
  return normalizedImageUrls.length > 0 ? normalizedImageUrls : undefined;
}

function toActivityRateCardPerson(user: ImageCardData['primaryUser'] | null | undefined): RateCardPerson | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    age: user.age,
    city: user.city,
    gender: user.gender,
    profile: 'profile' in user ? user.profile : null
  };
}

function normalizeRateCardMode(value: ImageCardMode | null | undefined): ActivityRateDTO['mode'] {
  return value === 'pair' ? 'pair' : 'individual';
}

function normalizeRateCardDirection(value: ImageCardDirection | null | undefined): ActivityRateDTO['direction'] {
  return value === 'received' || value === 'mutual' || value === 'met' ? value : 'given';
}

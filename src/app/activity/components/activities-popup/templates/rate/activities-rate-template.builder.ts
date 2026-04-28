import type { RateMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import {
  buildPairRateCardData,
  buildSingleRateCardData,
  type CardBadgeConfig,
  type PairCardData,
  type RateCardPerson,
  type SingleCardData
} from '../../../../../shared/ui';

interface BuildActivitiesRateCardOptions {
  groupLabel?: string | null;
  presentation?: SingleCardData['presentation'] | PairCardData['presentation'];
  state?: SingleCardData['state'] | PairCardData['state'];
  badge: CardBadgeConfig;
  displayedDirection: RateMenuItem['direction'];
  availableUsers: readonly RateCardPerson[];
  resolveUserById: (userId: string) => RateCardPerson | null;
  activeUserGender: 'woman' | 'man';
  fullscreenSplitEnabled: boolean;
}

export function isActivitiesPairRateRow(row: AppTypes.ActivityListRow): boolean {
  const rate = row.source as RateMenuItem;
  return rate.mode === 'pair';
}

export function buildActivitiesSingleRateCard(
  row: AppTypes.ActivityListRow,
  options: BuildActivitiesRateCardOptions
): SingleCardData {
  return buildSingleRateCardData({
    ...buildActivitiesRateCardInput(row, options),
    badge: options.badge
  });
}

export function buildActivitiesPairRateCard(
  row: AppTypes.ActivityListRow,
  options: BuildActivitiesRateCardOptions
): PairCardData {
  return buildPairRateCardData({
    ...buildActivitiesRateCardInput(row, options),
    badge: options.badge
  });
}

function buildActivitiesRateCardInput(
  row: AppTypes.ActivityListRow,
  options: BuildActivitiesRateCardOptions
) {
  const item = row.source as RateMenuItem;
  const presentation = options.presentation ?? 'list';
  const rateDisplay = row.rateDisplay;

  return {
    rowId: row.id,
    groupLabel: options.groupLabel ?? null,
    title: row.title,
    distanceKm: row.distanceKm,
    mode: item.mode,
    direction: options.displayedDirection,
    eventName: item.eventName,
    happenedOnLabel: rateDisplay?.happenedOnLabel ?? 'Unknown',
    primaryUser: toActivitiesRateCardPerson(rateDisplay?.primaryUser) ?? resolveActivitiesRatePrimaryUser(row, options.resolveUserById),
    pairUsers: buildActivitiesRateCardPairUsers(row, options.resolveUserById),
    availableUsers: options.availableUsers,
    singleImageUrls: resolveActivitiesRateImageUrls(rateDisplay?.imageUrls),
    pairSlots: buildActivitiesRateCardPairSlots(row),
    fallbackGender: options.activeUserGender,
    stackClasses: buildActivitiesRateCardStackClasses(item.mode, options.displayedDirection),
    presentation,
    state: options.state ?? 'default',
    fullscreenSplitEnabled: presentation === 'fullscreen' ? options.fullscreenSplitEnabled : false
  };
}

function buildActivitiesRateCardStackClasses(
  mode: RateMenuItem['mode'],
  displayedDirection: RateMenuItem['direction']
): string[] {
  return [
    mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
    `activities-rate-profile-stack-${displayedDirection}`
  ];
}

function buildActivitiesRateCardPairSlots(row: AppTypes.ActivityListRow): PairCardData['slots'] | undefined {
  if (!row.rateDisplay?.pairSlots?.length) {
    return undefined;
  }

  const hasUsableImage = row.rateDisplay.pairSlots.some(slot =>
    slot.slides.some(slide => `${slide.imageUrl ?? ''}`.trim().length > 0)
  );
  if (!hasUsableImage) {
    return undefined;
  }

  return row.rateDisplay.pairSlots.map(slot => ({
    key: slot.key,
    label: slot.label,
    tone: slot.tone,
    slides: slot.slides.map(slide => ({ ...slide }))
  }));
}

function buildActivitiesRateCardPairUsers(
  row: AppTypes.ActivityListRow,
  resolveUserById: (userId: string) => RateCardPerson | null
): RateCardPerson[] {
  if (row.type !== 'rates') {
    return [];
  }

  const item = row.source as RateMenuItem;
  return [item.userId, item.secondaryUserId]
    .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
    .map(userId => resolveUserById(userId))
    .filter((user): user is RateCardPerson => Boolean(user));
}

function resolveActivitiesRatePrimaryUser(
  row: AppTypes.ActivityListRow,
  resolveUserById: (userId: string) => RateCardPerson | null
): RateCardPerson | null {
  if (row.type !== 'rates') {
    return null;
  }

  const item = row.source as RateMenuItem;
  return resolveUserById(item.userId);
}

function resolveActivitiesRateImageUrls(imageUrls: readonly string[] | null | undefined): readonly string[] | undefined {
  if (!imageUrls?.length) {
    return undefined;
  }
  const normalizedImageUrls = imageUrls
    .map(imageUrl => `${imageUrl ?? ''}`.trim())
    .filter(imageUrl => imageUrl.length > 0);
  return normalizedImageUrls.length > 0 ? normalizedImageUrls : undefined;
}

function toActivitiesRateCardPerson(
  user: AppTypes.ActivityRateDisplayUser | null | undefined
): RateCardPerson | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    age: user.age,
    city: user.city,
    gender: user.gender
  };
}

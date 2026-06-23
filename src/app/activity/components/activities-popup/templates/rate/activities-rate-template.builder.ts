import {
  buildPairRateCardData,
  buildSingleRateCardData,
  type CardBadgeConfig,
  type CardContextBadgeConfig,
  type PairCardData,
  type RateCardPerson,
  type SingleCardData
} from '../../../../../shared/ui';
import type { ImageCardData, ImageCardDirection, ImageCardMode } from '../../../../../shared/ui';
import type { ActivityRateDTO } from '../../../../../shared/core/contracts/activity.interface';

interface BuildActivitiesRateCardOptions {
  groupLabel?: string | null;
  presentation?: SingleCardData['presentation'] | PairCardData['presentation'];
  state?: SingleCardData['state'] | PairCardData['state'];
  badge: CardBadgeConfig;
  displayedDirection: ActivityRateDTO['direction'];
  availableUsers: readonly RateCardPerson[];
  resolveUserById: (userId: string) => RateCardPerson | null;
  activeUserGender: 'woman' | 'man';
  fullscreenSplitEnabled: boolean;
}

export function isActivitiesPairRateRow(row: ImageCardData): boolean {
  return row.mode === 'pair';
}

export function buildActivitiesSingleRateCard(
  row: ImageCardData,
  options: BuildActivitiesRateCardOptions
): SingleCardData {
  return buildSingleRateCardData({
    ...buildActivitiesRateCardInput(row, options),
    badge: options.badge,
    contextBadge: buildActivitiesRateContextBadge(row, options.resolveUserById)
  });
}

export function buildActivitiesPairRateCard(
  row: ImageCardData,
  options: BuildActivitiesRateCardOptions
): PairCardData {
  return buildPairRateCardData({
    ...buildActivitiesRateCardInput(row, options),
    badge: options.badge
  });
}

function buildActivitiesRateCardInput(
  row: ImageCardData,
  options: BuildActivitiesRateCardOptions
) {
  const presentation = options.presentation ?? 'list';
  const resolvedPrimaryUser = resolveActivitiesRatePrimaryUser(row, options.resolveUserById);
  const displayPrimaryUser = toActivitiesRateCardPerson(row.primaryUser);
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
    primaryUser: mergeActivitiesRateCardPerson(displayPrimaryUser, resolvedPrimaryUser),
    pairUsers: buildActivitiesRateCardPairUsers(row, options.resolveUserById),
    availableUsers: options.availableUsers,
    singleImageUrls: resolveActivitiesRateImageUrls(row.singleImageUrls),
    pairSlots: buildActivitiesRateCardPairSlots(row, options.resolveUserById),
    fallbackGender: options.activeUserGender,
    stackClasses: row.stackClasses?.length
      ? [...row.stackClasses]
      : buildActivitiesRateCardStackClasses(mode, direction),
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

function buildActivitiesRateCardStackClasses(
  mode: ActivityRateDTO['mode'],
  displayedDirection: ActivityRateDTO['direction']
): string[] {
  return [
    mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
    `activities-rate-profile-stack-${displayedDirection}`
  ];
}

function buildActivitiesRateCardPairSlots(
  row: ImageCardData,
  resolveUserById: (userId: string) => RateCardPerson | null
): PairCardData['slots'] | undefined {
  if (!row.pairSlots?.length) {
    return undefined;
  }

  const hasUsableImage = row.pairSlots.some(slot =>
    slot.slides.some(slide => `${slide.imageUrl ?? ''}`.trim().length > 0)
  );
  if (!hasUsableImage) {
    return undefined;
  }

  const pairUsers = buildActivitiesRateCardPairUsers(row, resolveUserById);
  const pairUserByGender = new Map(pairUsers.map(user => [user.gender, user]));
  return row.pairSlots.map((slot, index) => {
    const profileUser = (slot.tone ? pairUserByGender.get(slot.tone) : null) ?? pairUsers[index] ?? null;
    return {
      key: slot.key,
      label: slot.label,
      tone: slot.tone,
      slides: slot.slides.map(slide => ({ ...slide })),
      profileView: profileUser
        ? {
            userId: profileUser.id,
            label: profileUser.name
          }
        : null
    };
  });
}

function buildActivitiesRateCardPairUsers(
  row: ImageCardData,
  resolveUserById: (userId: string) => RateCardPerson | null
): RateCardPerson[] {
  const imageCardPairUsers = row.pairUsers ?? [];
  if (imageCardPairUsers.length > 0) {
    return imageCardPairUsers
      .map(user => mergeActivitiesRateCardPerson(toActivitiesRateCardPerson(user), resolveUserById(user.id)))
      .filter((user): user is RateCardPerson => Boolean(user));
  }
  return [row.userId, row.secondaryUserId]
    .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
    .map(userId => resolveUserById(userId))
    .filter((user): user is RateCardPerson => Boolean(user));
}

function resolveActivitiesRatePrimaryUser(
  row: ImageCardData,
  resolveUserById: (userId: string) => RateCardPerson | null
): RateCardPerson | null {
  return resolveUserById(`${row.userId ?? ''}`.trim());
}

function buildActivitiesRateContextBadge(
  row: ImageCardData,
  resolveUserById: (userId: string) => RateCardPerson | null
): CardContextBadgeConfig | null {
  const item = row;
  if (item?.mode !== 'individual' || item.socialContext !== 'friends-in-common') {
    return null;
  }

  const bridgeUserId = item.bridgeUserId?.trim() ?? '';
  if (!bridgeUserId) {
    return null;
  }

  const bridgeUser = resolveUserById(bridgeUserId);
  if (!bridgeUser) {
    return null;
  }

  const bridgeCount = Math.max(0, Math.trunc(Number(item.bridgeCount) || 0));
  return {
    label: initialsFromName(bridgeUser.name),
    imageUrl: firstProfileImageUrl(bridgeUser),
    counterLabel: bridgeCount > 1 ? `+${bridgeCount - 1}` : null,
    title: contextBadgeTitle(bridgeUser.name, bridgeCount),
    ariaLabel: `View ${bridgeUser.name} profile`,
    profileView: {
      userId: bridgeUser.id,
      label: bridgeUser.name
    }
  };
}

function contextBadgeTitle(bridgeName: string, bridgeCount: number): string {
  const extraCount = Math.max(0, Math.trunc(Number(bridgeCount) || 0) - 1);
  return extraCount > 0
    ? `Shown via ${bridgeName} and ${extraCount} more`
    : `Shown via ${bridgeName}`;
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
  user: ImageCardData['primaryUser'] | null | undefined
): RateCardPerson | null {
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

function mergeActivitiesRateCardPerson(
  displayUser: RateCardPerson | null,
  resolvedUser: RateCardPerson | null
): RateCardPerson | null {
  if (!displayUser) {
    return resolvedUser;
  }
  if (displayUser.profile || !resolvedUser?.profile) {
    return displayUser;
  }
  return {
    ...displayUser,
    profile: resolvedUser.profile
  };
}

function firstProfileImageUrl(user: RateCardPerson): string | null {
  const profile = user.profile as { images?: readonly string[] } | null | undefined;
  const imageUrl = profile?.images
    ?.map(image => `${image ?? ''}`.trim())
    .find(image => image.length > 0);
  return imageUrl ?? null;
}

function initialsFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0] ?? '')
    .join('')
    .toUpperCase();
  return initials || '?';
}

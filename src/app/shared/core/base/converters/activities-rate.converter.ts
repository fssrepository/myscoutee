import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import type * as ContractTypes from '../../contracts';
import type { ActivityRateDTO } from '../dto';
import type { UserDto } from '../../contracts/user.interface';
import type { ImageCardData, ImageCardPerson, PairCardSlot } from '../../../ui';

interface BuildActivityRateRowsOptions {
  activeUserId: string;
  users: readonly UserDto[];
  filter: ContractTypes.RateFilterKey;
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter;
  view: ContractTypes.ActivitiesView;
  directionOverrides?: Partial<Record<string, ActivityRateDTO['direction']>>;
  preserveOrder?: boolean;
}

function formatActivityMonthDayLabel(isoValue: string | null | undefined): string {
  const timestamp = isoValue ? Date.parse(isoValue) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return 'Activity date';
  }
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

export function buildActivityRateRows(
  items: readonly ActivityRateDTO[],
  options: BuildActivityRateRowsOptions
): AppTypes.ActivityListRow[] {
  const rows = items
    .filter(item => item.userId !== options.activeUserId && matchesRateFilter(item, options.filter, options.directionOverrides))
    .map(item => toActivityRateRow(item, options));

  if (options.preserveOrder) {
    return rows;
  }

  if (options.view === 'distance') {
    return [...rows].sort((left, right) => activityRowDistanceMeters(left) - activityRowDistanceMeters(right));
  }

  if (options.secondaryFilter === 'recent' || options.secondaryFilter === 'past') {
    return [...rows].sort((left, right) => AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso));
  }

  return [...rows].sort((left, right) => {
    const metricDelta = right.metricScore - left.metricScore;
    if (metricDelta !== 0) {
      return metricDelta;
    }
    return AppUtils.toSortableDate(right.dateIso) - AppUtils.toSortableDate(left.dateIso);
  });
}

function toActivityRateRow(
  item: ActivityRateDTO,
  options: BuildActivityRateRowsOptions
): AppTypes.ActivityListRow {
  const direction = displayedRateDirection(item, options.directionOverrides);
  const primaryUser = resolvePrimaryRateUser(item, options.users, options.activeUserId);
  const ownScore = rateOwnScore(item);
  const distanceMetersExact = exactDistanceMeters(item);
  const displayItem = buildActivityRateImageCard(item, primaryUser, options, direction, distanceMetersExact);

  return {
    ...displayItem,
    id: item.id,
    type: 'rates',
    status: direction,
    title: displayItem.title,
    subtitle: displayItem.subtitle ?? '',
    detail: displayItem.detail ?? '',
    dateIso: displayItem.dateIso ?? item.happenedAt ?? '',
    distanceMetersExact,
    unread: 0,
    metricScore: direction === 'mutual' ? ownScore + Math.max(item.scoreReceived, 0) : ownScore,
    sortScore: direction === 'mutual' ? ownScore + Math.max(item.scoreReceived, 0) : ownScore
  };
}

function buildActivityRateImageCard(
  item: ActivityRateDTO,
  primaryUser: UserDto | null,
  options: BuildActivityRateRowsOptions,
  displayedDirection: ActivityRateDTO['direction'],
  distanceMetersExact: number
): ImageCardData {
  return {
    id: item.id,
    status: displayedDirection,
    dateIso: item.happenedAt ?? '',
    distanceMetersExact,
    sortScore: displayedDirection === 'mutual'
      ? rateOwnScore(item) + Math.max(item.scoreReceived, 0)
      : rateOwnScore(item),
    title: primaryUser?.name ?? item.userId,
    mode: item.mode,
    direction: item.direction,
    displayedDirection,
    eventName: item.eventName,
    happenedOnLabel: formatActivityMonthDayLabel(item.happenedAt),
    primaryUser: primaryUser ? toImageCardPerson(primaryUser) : null,
    pairUsers: buildImageCardPairUsers(item, options.users),
    singleImageUrls: buildSingleRateImageUrls(item, primaryUser, options.activeUserId),
    pairSlots: buildPairRateDisplaySlots(item, options),
    stackClasses: [
      item.mode === 'pair' ? 'activities-rate-profile-stack-pair' : 'activities-rate-profile-stack-single',
      `activities-rate-profile-stack-${displayedDirection}`
    ],
    userId: item.userId,
    secondaryUserId: item.secondaryUserId ?? null,
    socialContext: item.socialContext ?? null,
    bridgeUserId: item.bridgeUserId ?? null,
    bridgeCount: Number.isFinite(item.bridgeCount) ? Math.max(0, Math.trunc(Number(item.bridgeCount))) : null,
    scoreGiven: Number.isFinite(item.scoreGiven) ? item.scoreGiven : null,
    scoreReceived: Number.isFinite(item.scoreReceived) ? item.scoreReceived : null
  };
}

function buildSingleRateImageUrls(
  item: ActivityRateDTO,
  user: UserDto | null,
  activeUserId: string
): string[] {
  const seedUserId = user?.id ?? activeUserId;
  const seededCount = 1 + (AppUtils.hashText(`rate-photo-count:${seedUserId || item.id}`) % 4);
  const desiredCount = item.direction === 'met' ? Math.min(2, seededCount) : seededCount;
  return buildDisplayImageUrls(user?.images, Math.max(1, Math.min(4, desiredCount)));
}

function buildPairRateDisplaySlots(
  item: ActivityRateDTO,
  options: BuildActivityRateRowsOptions
): PairCardSlot[] {
  return ([0, 1] as const).map(index => {
    const slot = index === 0 ? 'woman' : 'man';
    const label = resolvePairSlotLabel(item, index);
    const user = resolvePairSlotUserById(index === 0 ? item.userId : item.secondaryUserId, options.users);
    return {
      key: slot,
      label,
      tone: user?.gender ?? slot,
      slides: user
        ? buildPairSlotSlides(item, slot, user)
        : [{
            imageUrl: '',
            primaryLine: `${label} · waiting`,
            secondaryLine: 'No pair card yet',
            placeholderLabel: '∅'
          }]
    };
  });
}

function buildPairSlotSlides(
  item: ActivityRateDTO,
  slot: 'woman' | 'man',
  user: UserDto
): PairCardSlot['slides'] {
  const seededCount = 2 + (AppUtils.hashText(`pair-rate-photo-count:${item.id}:${slot}:${user.id}`) % 2);
  return buildDisplayImageUrls(user.images, seededCount).map(imageUrl => ({
    imageUrl,
    primaryLine: `${user.name}, ${user.age}`,
    secondaryLine: `${user.city} · ${distanceKmFromMeters(exactDistanceMeters(item))} km`,
    placeholderLabel: AppUtils.initialsFromText(user.name)
  }));
}

function resolvePrimaryRateUser(
  item: ActivityRateDTO,
  users: readonly UserDto[],
  activeUserId: string
): UserDto | null {
  return users.find(user => user.id === item.userId)
    ?? users.find(user => user.id === activeUserId)
    ?? null;
}

function resolvePairSlotUserById(
  userId: string | undefined,
  users: readonly UserDto[]
): UserDto | null {
  const normalizedUserId = `${userId ?? ''}`.trim();
  if (!normalizedUserId) {
    return null;
  }
  return users.find(user => user.id === normalizedUserId) ?? null;
}

function resolvePairSlotLabel(item: ActivityRateDTO, index: 0 | 1): string {
  if (item.socialContext === 'friends-in-common') {
    return index === 0 ? 'Person' : 'Common friend';
  }
  if (item.socialContext === 'separated-friends') {
    return index === 0 ? 'Friend A' : 'Friend B';
  }
  return index === 0 ? 'Person A' : 'Person B';
}

function toImageCardPerson(user: UserDto): ImageCardPerson {
  return {
    id: user.id,
    name: user.name,
    age: user.age,
    city: user.city,
    gender: user.gender,
    profile: user
  };
}

function buildImageCardPairUsers(
  item: ActivityRateDTO,
  users: readonly UserDto[]
): ImageCardPerson[] {
  return [item.userId, item.secondaryUserId]
    .filter((userId): userId is string => typeof userId === 'string' && userId.trim().length > 0)
    .map(userId => resolvePairSlotUserById(userId, users))
    .filter((user): user is UserDto => Boolean(user))
    .map(user => toImageCardPerson(user));
}

function buildDisplayImageUrls(images: readonly string[] | undefined, count: number): string[] {
  const normalizedCount = Math.max(1, Math.min(4, Math.trunc(count)));
  const source = (images ?? [])
    .map(image => `${image ?? ''}`.trim())
    .filter(image => image.length > 0);
  if (source.length === 0) {
    return Array.from({ length: normalizedCount }, () => '');
  }
  return Array.from({ length: normalizedCount }, (_, index) => source[index % source.length]);
}

function matchesRateFilter(
  item: ActivityRateDTO,
  filter: ContractTypes.RateFilterKey,
  directionOverrides?: Partial<Record<string, ActivityRateDTO['direction']>>
): boolean {
  const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', ActivityRateDTO['direction']];
  return item.mode === modeKey && displayedRateDirection(item, directionOverrides) === directionKey;
}

function displayedRateDirection(
  item: ActivityRateDTO,
  directionOverrides?: Partial<Record<string, ActivityRateDTO['direction']>>
): ActivityRateDTO['direction'] {
  return directionOverrides?.[item.id] ?? item.direction;
}

function rateOwnScore(item: ActivityRateDTO): number {
  if (Number.isFinite(item.scoreGiven) && item.scoreGiven > 0) {
    return normalizeRateScore(item.scoreGiven);
  }
  return 5;
}

function normalizeRateScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function exactDistanceMeters(item: ActivityRateDTO): number {
  if (Number.isFinite(item.distanceMetersExact)) {
    return Math.max(0, Math.trunc(Number(item.distanceMetersExact)));
  }
  return 0;
}

function distanceKmFromMeters(distanceMeters: number): number {
  const meters = Math.max(0, Math.trunc(Number(distanceMeters) || 0));
  return Math.round((meters / 1000) * 10) / 10;
}

function activityRowDistanceMeters(row: AppTypes.ActivityListRow): number {
  if (Number.isFinite(row.distanceMetersExact)) {
    return Math.max(0, Math.trunc(Number(row.distanceMetersExact)));
  }
  return 0;
}

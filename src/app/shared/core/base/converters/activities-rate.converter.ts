import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import type { DemoUser, RateMenuItem } from '../../../demo-data';
import { formatActivityMonthDayLabel } from '../formatters';

interface BuildActivityRateRowsOptions {
  activeUserId: string;
  users: readonly DemoUser[];
  filter: AppTypes.RateFilterKey;
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  view: AppTypes.ActivitiesView;
  directionOverrides?: Partial<Record<string, RateMenuItem['direction']>>;
  preserveOrder?: boolean;
}

export function buildActivityRateRows(
  items: readonly RateMenuItem[],
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
  item: RateMenuItem,
  options: BuildActivityRateRowsOptions
): AppTypes.ActivityListRow {
  const direction = displayedRateDirection(item, options.directionOverrides);
  const primaryUser = resolvePrimaryRateUser(item, options.users, options.activeUserId);
  const ownScore = rateOwnScore(item);

  return {
    id: item.id,
    type: 'rates',
    title: primaryUser?.name ?? item.userId,
    subtitle: '',
    detail: '',
    dateIso: item.happenedAt ?? '',
    distanceKm: item.distanceKm ?? 0,
    distanceMetersExact: exactDistanceMeters(item),
    unread: 0,
    metricScore: direction === 'mutual' ? ownScore + Math.max(item.scoreReceived, 0) : ownScore,
    rateDisplay: buildActivityRateDisplay(item, primaryUser, options),
    source: item
  };
}

function buildActivityRateDisplay(
  item: RateMenuItem,
  primaryUser: DemoUser | null,
  options: BuildActivityRateRowsOptions
): AppTypes.ActivityRateDisplay {
  return {
    primaryUser: primaryUser ? toActivityRateDisplayUser(primaryUser) : null,
    imageUrls: buildSingleRateImageUrls(item, primaryUser, options.activeUserId),
    happenedOnLabel: formatActivityMonthDayLabel(item.happenedAt),
    pairSlots: buildPairRateDisplaySlots(item, options)
  };
}

function buildSingleRateImageUrls(
  item: RateMenuItem,
  user: DemoUser | null,
  activeUserId: string
): string[] {
  const seedUserId = user?.id ?? activeUserId;
  const seededCount = 1 + (AppUtils.hashText(`rate-photo-count:${seedUserId || item.id}`) % 4);
  const desiredCount = item.direction === 'met' ? Math.min(2, seededCount) : seededCount;
  return buildDisplayImageUrls(user?.images, Math.max(1, Math.min(4, desiredCount)));
}

function buildPairRateDisplaySlots(
  item: RateMenuItem,
  options: BuildActivityRateRowsOptions
): AppTypes.ActivityRateDisplaySlot[] {
  return (['woman', 'man'] as const).map(slot => {
    const user = resolvePairSlotUser(item, slot, options.users);
    return {
      key: slot,
      label: slot === 'woman' ? 'Woman' : 'Man',
      tone: slot,
      slides: user
        ? buildPairSlotSlides(item, slot, user)
        : [{
            imageUrl: '',
            primaryLine: `${slot === 'woman' ? 'Woman' : 'Man'} · waiting`,
            secondaryLine: 'No pair card yet',
            placeholderLabel: '∅'
          }]
    };
  });
}

function buildPairSlotSlides(
  item: RateMenuItem,
  slot: 'woman' | 'man',
  user: DemoUser
): AppTypes.ActivityRateDisplaySlide[] {
  const seededCount = 2 + (AppUtils.hashText(`pair-rate-photo-count:${item.id}:${slot}:${user.id}`) % 2);
  return buildDisplayImageUrls(user.images, seededCount).map(imageUrl => ({
    imageUrl,
    primaryLine: `${user.name}, ${user.age}`,
    secondaryLine: `${user.city} · ${item.distanceKm ?? 0} km`,
    placeholderLabel: AppUtils.initialsFromText(user.name)
  }));
}

function resolvePrimaryRateUser(
  item: RateMenuItem,
  users: readonly DemoUser[],
  activeUserId: string
): DemoUser | null {
  return users.find(user => user.id === item.userId)
    ?? users.find(user => user.id === activeUserId)
    ?? null;
}

function resolvePairSlotUser(
  item: RateMenuItem,
  gender: DemoUser['gender'],
  users: readonly DemoUser[]
): DemoUser | null {
  const pairUsers = [item.userId, item.secondaryUserId]
    .filter((userId): userId is string => typeof userId === 'string' && userId.trim().length > 0)
    .map(userId => users.find(user => user.id === userId) ?? null)
    .filter((user): user is DemoUser => Boolean(user));

  const directMatch = pairUsers.find(user => user.gender === gender) ?? null;
  if (directMatch) {
    return directMatch;
  }

  const primary = pairUsers[0] ?? null;
  const candidates = users.filter(user =>
    user.gender === gender
    && !pairUsers.some(pairUser => pairUser.id === user.id)
  );

  if (candidates.length > 0) {
    const seed = AppUtils.hashText(`pair-rate-slot:${item.id}:${gender}`);
    return candidates[seed % candidates.length] ?? null;
  }

  if (primary && primary.gender !== gender) {
    return primary;
  }

  return null;
}

function toActivityRateDisplayUser(user: DemoUser): AppTypes.ActivityRateDisplayUser {
  return {
    id: user.id,
    name: user.name,
    age: user.age,
    city: user.city,
    gender: user.gender
  };
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
  item: RateMenuItem,
  filter: AppTypes.RateFilterKey,
  directionOverrides?: Partial<Record<string, RateMenuItem['direction']>>
): boolean {
  const [modeKey, directionKey] = filter.split('-') as ['individual' | 'pair', RateMenuItem['direction']];
  return item.mode === modeKey && displayedRateDirection(item, directionOverrides) === directionKey;
}

function displayedRateDirection(
  item: RateMenuItem,
  directionOverrides?: Partial<Record<string, RateMenuItem['direction']>>
): RateMenuItem['direction'] {
  return directionOverrides?.[item.id] ?? item.direction;
}

function rateOwnScore(item: RateMenuItem): number {
  if (Number.isFinite(item.scoreGiven) && item.scoreGiven > 0) {
    return normalizeRateScore(item.scoreGiven);
  }
  return 5;
}

function normalizeRateScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function exactDistanceMeters(item: RateMenuItem): number {
  if (Number.isFinite(item.distanceMetersExact)) {
    return Math.max(0, Math.trunc(Number(item.distanceMetersExact)));
  }
  return Math.max(0, Math.round((Number(item.distanceKm) || 0) * 1000));
}

function activityRowDistanceMeters(row: AppTypes.ActivityListRow): number {
  if (Number.isFinite(row.distanceMetersExact)) {
    return Math.max(0, Math.trunc(Number(row.distanceMetersExact)));
  }
  return Math.max(0, Math.round((Number(row.distanceKm) || 0) * 1000));
}

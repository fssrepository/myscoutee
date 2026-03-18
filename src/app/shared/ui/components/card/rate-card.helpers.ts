import type {
  CardBadgeConfig,
  CardPresentation,
  CardRenderState,
  PairCardData,
  PairCardSlot,
  SingleCardData
} from './card.types';

export type RateCardDirection = 'given' | 'received' | 'mutual' | 'met';
export type RateCardMode = 'individual' | 'pair';
export type RateCardGender = 'woman' | 'man';

export interface RateCardPerson {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: RateCardGender;
}

export interface RateCardDataInput {
  rowId: string;
  groupLabel?: string | null;
  title: string;
  distanceKm: number;
  mode: RateCardMode;
  direction: RateCardDirection;
  eventName: string;
  happenedOnLabel: string;
  primaryUser: RateCardPerson | null;
  pairUsers?: readonly RateCardPerson[];
  availableUsers?: readonly RateCardPerson[];
  fallbackGender: RateCardGender;
  stackClasses?: readonly string[];
  badge?: CardBadgeConfig | null;
  presentation?: CardPresentation;
  state?: CardRenderState;
  fullscreenSplitEnabled?: boolean;
}

export function buildSingleRateCardData(input: RateCardDataInput): SingleCardData {
  return {
    rowId: input.rowId,
    groupLabel: input.groupLabel ?? null,
    slides: buildSingleRateSlides(input),
    stackClasses: input.stackClasses ?? [],
    badge: input.badge ?? null,
    presentation: input.presentation ?? 'list',
    state: input.state ?? 'default'
  };
}

export function buildPairRateCardData(input: RateCardDataInput): PairCardData {
  const presentation = input.presentation ?? 'list';
  return {
    rowId: input.rowId,
    groupLabel: input.groupLabel ?? null,
    slots: buildPairRateSlots(input),
    stackClasses: input.stackClasses ?? [],
    badge: input.badge ?? null,
    presentation,
    state: input.state ?? 'default',
    split: presentation === 'fullscreen'
      ? { enabled: input.fullscreenSplitEnabled !== false }
      : null
  };
}

function buildSingleRateSlides(input: RateCardDataInput): SingleCardData['slides'] {
  const user = input.primaryUser;
  const seededImages = buildSeededPortraitUrls({
    rowId: input.rowId,
    seedUserId: user?.id ?? 'rate-fallback',
    gender: user?.gender ?? input.fallbackGender,
    count: clampSingleRateImageCount(input.rowId, input.direction, user?.id)
  });
  const cards = [
    user
      ? {
          primary: `${user.name}, ${user.age}`,
          secondary: `${user.city} · ${input.distanceKm} km`
        }
      : {
          primary: input.title,
          secondary: `${input.distanceKm} km`
        },
    {
      primary: `${input.mode === 'pair' ? 'Pair' : 'Single'} · ${capitalize(input.direction)}`,
      secondary: `${input.eventName} · ${input.happenedOnLabel}`
    }
  ];

  return seededImages.map((imageUrl, index) => ({
    imageUrl,
    primaryLine: cards[index]?.primary ?? '',
    secondaryLine: cards[index]?.secondary ?? ''
  }));
}

function buildPairRateSlots(input: RateCardDataInput): readonly PairCardSlot[] {
  return (['woman', 'man'] as const).map(slot => {
    const user = resolvePairSlotUser(input, slot);
    const slides = user
      ? buildSeededPortraitUrls({
          rowId: `${input.rowId}-${slot}`,
          seedUserId: user.id,
          gender: user.gender,
          count: 2 + (hashText(`pair-rate-photo-count:${input.rowId}:${slot}:${user.id}`) % 2)
        }).map(imageUrl => ({
          imageUrl,
          primaryLine: `${user.name}, ${user.age}`,
          secondaryLine: `${user.city} · ${input.distanceKm} km`,
          placeholderLabel: initialsFromText(user.name)
        }))
      : [{
          imageUrl: '',
          primaryLine: `${slot === 'woman' ? 'Woman' : 'Man'} · waiting`,
          secondaryLine: 'No pair card yet',
          placeholderLabel: '∅'
        }];

    return {
      key: slot,
      label: slot === 'woman' ? 'Woman' : 'Man',
      tone: slot,
      slides
    };
  });
}

function resolvePairSlotUser(input: RateCardDataInput, gender: RateCardGender): RateCardPerson | null {
  const pairUsers = input.pairUsers ?? [];
  const directMatch = pairUsers.find(user => user.gender === gender) ?? null;
  if (directMatch) {
    return directMatch;
  }

  const primary = pairUsers[0] ?? null;
  const candidates = (input.availableUsers ?? []).filter(user =>
    user.gender === gender
    && !pairUsers.some(pairUser => pairUser.id === user.id)
  );

  if (candidates.length > 0) {
    const seed = hashText(`pair-rate-slot:${input.rowId}:${gender}`);
    return candidates[seed % candidates.length] ?? null;
  }

  if (primary && primary.gender !== gender) {
    return primary;
  }

  return null;
}

function buildSeededPortraitUrls(options: {
  rowId: string;
  seedUserId: string;
  gender: RateCardGender;
  count: number;
}): string[] {
  const normalizedCount = Math.max(1, Math.min(4, Math.trunc(options.count)));
  return Array.from({ length: normalizedCount }, (_, index) => {
    const hash = hashText(`rate-card:${options.seedUserId}:${options.rowId}:${index + 1}`);
    const genderFolder = options.gender === 'woman' ? 'women' : 'men';
    return `https://randomuser.me/api/portraits/${genderFolder}/${hash % 100}.jpg`;
  });
}

function clampSingleRateImageCount(
  rowId: string,
  direction: RateCardDirection,
  userId?: string | null
): number {
  const seededCount = 1 + (hashText(`rate-photo-count:${userId ?? rowId}`) % 4);
  const desiredCount = direction === 'met' ? Math.min(2, seededCount) : seededCount;
  return Math.max(1, Math.min(4, desiredCount));
}

function initialsFromText(value: string): string {
  const tokens = value
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return '∅';
  }

  return tokens
    .slice(0, 2)
    .map(token => token.charAt(0).toUpperCase())
    .join('');
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

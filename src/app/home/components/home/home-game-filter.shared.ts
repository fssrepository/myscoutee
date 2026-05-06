import type { DemoUser } from '../../../shared/core/base/interfaces/user.interface';

export const GAME_FILTER_AGE_MIN = 18;
export const GAME_FILTER_AGE_MAX = 120;
export const GAME_FILTER_HEIGHT_MIN_CM = 40;
export const GAME_FILTER_HEIGHT_MAX_CM = 250;

export type FilterSelectorKind =
  | 'interests'
  | 'values'
  | 'physiques'
  | 'languages'
  | 'genders'
  | 'horoscopes'
  | 'traitLabels'
  | 'smoking'
  | 'drinking'
  | 'workout'
  | 'pets'
  | 'familyPlans'
  | 'children'
  | 'loveStyles'
  | 'communicationStyles'
  | 'sexualOrientations'
  | 'religions';

export interface GameFilterForm {
  ageMin: number;
  ageMax: number;
  heightMinCm: number;
  heightMaxCm: number;
  interests: string[];
  values: string[];
  physiques: string[];
  languages: string[];
  genders: Array<DemoUser['gender']>;
  horoscopes: string[];
  traitLabels: string[];
  smoking: string[];
  drinking: string[];
  workout: string[];
  pets: string[];
  familyPlans: string[];
  children: string[];
  loveStyles: string[];
  communicationStyles: string[];
  sexualOrientations: string[];
  religions: string[];
}

export interface GameUserFacet {
  interests: string[];
  values: string[];
  smoking: string;
  drinking: string;
  workout: string;
  pets: string;
  familyPlans: string;
  children: string;
  loveStyle: string;
  communicationStyle: string;
  sexualOrientation: string;
  religion: string;
}

export interface GameFilterOptionGroup {
  title: string;
  icon: string;
  toneClass: string;
  options: string[];
}

export interface HomeGameFilterPopupContext {
  activeUser: DemoUser;
  filter: GameFilterForm;
  users: readonly DemoUser[];
  userFacets: Readonly<Record<string, GameUserFacet>>;
  interestOptionGroups: readonly GameFilterOptionGroup[];
  valueOptionGroups: readonly GameFilterOptionGroup[];
}

const DEFAULT_GAME_USER_FACET: GameUserFacet = {
  interests: [],
  values: [],
  smoking: 'never',
  drinking: 'never',
  workout: 'weekly',
  pets: 'all pets welcome',
  familyPlans: 'open to both',
  children: 'no',
  loveStyle: 'slow-burn connection',
  communicationStyle: 'direct + warm',
  sexualOrientation: 'straight',
  religion: 'not religious'
};

export function parseGameHeightCm(height: string): number | null {
  const parsed = Number.parseInt(height, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createInitialGameFilter(activeUser?: Pick<DemoUser, 'age' | 'height'> | null): GameFilterForm {
  const activeAge = typeof activeUser?.age === 'number' && activeUser.age >= GAME_FILTER_AGE_MIN
    ? activeUser.age
    : 30;
  const activeHeight = parseGameHeightCm(activeUser?.height ?? '');
  const preferredMin = Math.max(GAME_FILTER_AGE_MIN, activeAge - 5);
  const preferredMax = Math.min(GAME_FILTER_AGE_MAX, activeAge + 5);
  return {
    ageMin: preferredMin,
    ageMax: preferredMax,
    heightMinCm: Math.max(GAME_FILTER_HEIGHT_MIN_CM, (activeHeight ?? GAME_FILTER_HEIGHT_MIN_CM) - 10),
    heightMaxCm: Math.min(GAME_FILTER_HEIGHT_MAX_CM, (activeHeight ?? GAME_FILTER_HEIGHT_MAX_CM) + 10),
    interests: [],
    values: [],
    physiques: [],
    languages: [],
    genders: [],
    horoscopes: [],
    traitLabels: [],
    smoking: [],
    drinking: [],
    workout: [],
    pets: [],
    familyPlans: [],
    children: [],
    loveStyles: [],
    communicationStyles: [],
    sexualOrientations: [],
    religions: []
  };
}

export function cloneGameFilter(filter: GameFilterForm): GameFilterForm {
  return {
    ageMin: filter.ageMin,
    ageMax: filter.ageMax,
    heightMinCm: filter.heightMinCm,
    heightMaxCm: filter.heightMaxCm,
    interests: [...filter.interests],
    values: [...filter.values],
    physiques: [...filter.physiques],
    languages: [...filter.languages],
    genders: [...filter.genders],
    horoscopes: [...filter.horoscopes],
    traitLabels: [...filter.traitLabels],
    smoking: [...filter.smoking],
    drinking: [...filter.drinking],
    workout: [...filter.workout],
    pets: [...filter.pets],
    familyPlans: [...filter.familyPlans],
    children: [...filter.children],
    loveStyles: [...filter.loveStyles],
    communicationStyles: [...filter.communicationStyles],
    sexualOrientations: [...filter.sexualOrientations],
    religions: [...filter.religions]
  };
}

export function normalizeGameFilter(filter: GameFilterForm): GameFilterForm {
  const minAge = Math.max(GAME_FILTER_AGE_MIN, Math.min(filter.ageMin, filter.ageMax));
  const maxAge = Math.min(GAME_FILTER_AGE_MAX, Math.max(filter.ageMin, filter.ageMax));
  const minHeight = Math.max(GAME_FILTER_HEIGHT_MIN_CM, Math.min(filter.heightMinCm, filter.heightMaxCm));
  const maxHeight = Math.min(GAME_FILTER_HEIGHT_MAX_CM, Math.max(filter.heightMinCm, filter.heightMaxCm));
  return {
    ageMin: minAge,
    ageMax: maxAge,
    heightMinCm: minHeight,
    heightMaxCm: maxHeight,
    interests: [...filter.interests],
    values: [...filter.values],
    physiques: [...filter.physiques],
    languages: [...filter.languages],
    genders: [...filter.genders],
    horoscopes: [...filter.horoscopes],
    traitLabels: [...filter.traitLabels],
    smoking: [...filter.smoking],
    drinking: [...filter.drinking],
    workout: [...filter.workout],
    pets: [...filter.pets],
    familyPlans: [...filter.familyPlans],
    children: [...filter.children],
    loveStyles: [...filter.loveStyles],
    communicationStyles: [...filter.communicationStyles],
    sexualOrientations: [...filter.sexualOrientations],
    religions: [...filter.religions]
  };
}

export function isGameFilterActive(
  filter: GameFilterForm,
  activeUser?: Pick<DemoUser, 'age' | 'height'> | null
): boolean {
  const baseline = createInitialGameFilter(activeUser);
  return (
    filter.ageMin !== baseline.ageMin ||
    filter.ageMax !== baseline.ageMax ||
    filter.heightMinCm !== baseline.heightMinCm ||
    filter.heightMaxCm !== baseline.heightMaxCm ||
    filter.interests.length > 0 ||
    filter.values.length > 0 ||
    filter.physiques.length > 0 ||
    filter.languages.length > 0 ||
    filter.genders.length > 0 ||
    filter.horoscopes.length > 0 ||
    filter.traitLabels.length > 0 ||
    filter.smoking.length > 0 ||
    filter.drinking.length > 0 ||
    filter.workout.length > 0 ||
    filter.pets.length > 0 ||
    filter.familyPlans.length > 0 ||
    filter.children.length > 0 ||
    filter.loveStyles.length > 0 ||
    filter.communicationStyles.length > 0 ||
    filter.sexualOrientations.length > 0 ||
    filter.religions.length > 0
  );
}

export function getGameUserFacet(
  user: DemoUser,
  userFacets: Readonly<Record<string, GameUserFacet>>
): GameUserFacet {
  return userFacets[user.id] ?? DEFAULT_GAME_USER_FACET;
}

export function getGameUserInterests(
  user: DemoUser,
  userFacets: Readonly<Record<string, GameUserFacet>>
): string[] {
  return getGameUserFacet(user, userFacets).interests;
}

export function getGameUserValues(
  user: DemoUser,
  userFacets: Readonly<Record<string, GameUserFacet>>
): string[] {
  return getGameUserFacet(user, userFacets).values;
}

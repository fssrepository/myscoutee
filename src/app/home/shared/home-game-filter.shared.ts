import type { UserDto } from '../../shared/core/contracts/user.interface';
export type { GameUserFacet } from '../../shared/core/common/game-user-facet';
export { resolvePersonalityTraitId, getGameUserFacet, getGameUserInterests, getGameUserValues } from '../../shared/core/common/game-user-facet';

export const GAME_FILTER_AGE_MIN = 18;
export const GAME_FILTER_AGE_MAX = 120;
export const GAME_FILTER_HEIGHT_MIN_CM = 40;
export const GAME_FILTER_HEIGHT_MAX_CM = 250;

export type GameFilterMenuKind =
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
  genders: string[];
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

export interface GameFilterOptionGroup {
  title: string;
  icon: string;
  toneClass: string;
  options: string[];
}

export interface HomeGameFilterPopupContext {
  activeUser: UserDto;
  filter: GameFilterForm;
  users: readonly UserDto[];
  interestOptionGroups: readonly GameFilterOptionGroup[];
  valueOptionGroups: readonly GameFilterOptionGroup[];
}

export function parseGameHeightCm(height: string): number | null {
  const parsed = Number.parseInt(height, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createInitialGameFilter(_activeUser?: Pick<UserDto, 'age' | 'height'> | null): GameFilterForm {
  return {
    ageMin: GAME_FILTER_AGE_MIN,
    ageMax: GAME_FILTER_AGE_MAX,
    heightMinCm: GAME_FILTER_HEIGHT_MIN_CM,
    heightMaxCm: GAME_FILTER_HEIGHT_MAX_CM,
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
  activeUser?: Pick<UserDto, 'age' | 'height'> | null
): boolean {
  return countGameFilterSelections(filter) > 0;
}

/** Each selected option counts once; each narrowed range counts as one filter. */
export function countGameFilterSelections(filter: GameFilterForm): number {
  const age = filter.ageMin !== GAME_FILTER_AGE_MIN || filter.ageMax !== GAME_FILTER_AGE_MAX;
  const height = filter.heightMinCm !== GAME_FILTER_HEIGHT_MIN_CM || filter.heightMaxCm !== GAME_FILTER_HEIGHT_MAX_CM;
  return Number(age) + Number(height)
    + Object.values(filter).reduce((count: number, value) => count + (Array.isArray(value) ? value.length : 0), 0);
}

import { APP_STATIC_DATA } from '../../app-static-data';
import type { UserDto } from '../contracts/user.interface';

export interface GameUserFacet {
  gender: string;
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

export function getGameUserFacet(
  user: UserDto
): GameUserFacet {
  const details = new Map<string, string>();
  for (const group of user.profileDetails ?? []) {
    for (const row of group.rows ?? []) {
      const key = row.labelKey.trim().toLowerCase();
      if (!details.has(key)) details.set(key, `${row.value ?? ''}`.trim());
    }
  }
  const detail = (field: string) => details.get(`profile.details.${field}`.toLowerCase()) ?? '';
  const list = (field: string) => detail(field).split(',').map(value => value.trim()).filter(Boolean);
  return {
    gender: (details.get('profile.gender') ?? user.gender ?? '').toLowerCase(),
    interests: list('interest'),
    values: list('values'),
    smoking: detail('smoking').toLowerCase(),
    drinking: detail('drinking').toLowerCase(),
    workout: detail('workout').toLowerCase(),
    pets: detail('pets').toLowerCase(),
    familyPlans: detail('familyPlans').toLowerCase(),
    children: detail('children').toLowerCase(),
    loveStyle: detail('loveStyle').toLowerCase(),
    communicationStyle: detail('communicationStyle').toLowerCase(),
    sexualOrientation: detail('sexualOrientation').toLowerCase(),
    religion: detail('religion').toLowerCase()
  };
}

export function getGameUserInterests(
  user: UserDto
): string[] {
  return getGameUserFacet(user).interests;
}

export function getGameUserValues(
  user: UserDto
): string[] {
  return getGameUserFacet(user).values;
}

export function resolvePersonalityTraitId(label: string | undefined): string | null {
    const normalized = `${label ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    const direct = APP_STATIC_DATA.personalityTraitCatalog.find(trait =>
      trait.id === normalized
      || trait.label.toLowerCase() === normalized
      || trait.aliases.some(alias => alias.toLowerCase() === normalized)
    );
    if (direct) {
      return direct.id;
    }
    const byWordTail = APP_STATIC_DATA.personalityTraitCatalog.find(trait =>
      normalized.endsWith(trait.label.toLowerCase())
      || trait.aliases.some(alias => normalized.endsWith(alias.toLowerCase()))
    );
    return byWordTail?.id ?? null;
  }

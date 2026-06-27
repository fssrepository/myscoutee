import { AppUtils } from '../../../../app-utils';
import { environment } from '../../../../../../environments/environment';
import type { UserDto } from '../../../contracts/user.interface';
import type { LocationCoordinates } from '../../../contracts/user.interface';
import type { UserRecord } from '../../source/entity/user.entity';


function buildDemoPortraitStack(
  gender: UserRecord['gender'],
  seedIndex: number,
  count = 3
): string[] {
  const normalizedCount = Math.max(1, Math.min(8, Math.trunc(count)));
  const folder = gender === 'woman' ? 'women' : 'men';
  const normalizedSeed = ((Math.trunc(seedIndex) % 100) + 100) % 100;
  const indexes: number[] = [];

  for (let offset = 0; offset < 8 && indexes.length < normalizedCount; offset += 1) {
    const candidate = (normalizedSeed + offset * 17) % 100;
    if (!indexes.includes(candidate)) {
      indexes.push(candidate);
    }
  }

  return indexes.map(index => `https://randomuser.me/api/portraits/${folder}/${index}.jpg`);
}

const CURRENT_PROFILE_FORM_VERSION = 2;

const BASE_DEMO_USERS: UserRecord[] = [
  {
    id: 'u1',
    name: 'Farkas Anna',
    age: 28,
    birthday: '1997-05-12',
    city: 'Austin',
    height: '170 cm',
    physique: 'Athletic',
    languages: ['English', 'Spanish'],
    horoscope: 'Taurus',
    initials: 'FA',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Platinum Host',
    traitLabel: 'Empatikus',
    completion: 72,
    headline: 'Planning cozy chaos with structure.',
    about: 'I host events where social energy stays high, but logistics stay clean and predictable.',
    images: buildDemoPortraitStack('woman', 74),
    profileStatus: 'public',
    activities: { game: 9, chat: 8, invitations: 4, events: 6, hosting: 3 }
  },
  {
    id: 'u2',
    name: 'Kiss Balázs',
    age: 31,
    birthday: '1994-09-23',
    city: 'Chicago',
    height: '182 cm',
    physique: 'Lean',
    languages: ['English', 'Hungarian'],
    horoscope: 'Libra',
    initials: 'KB',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Megbízható',
    completion: 64,
    headline: 'Reliable planning, zero drama.',
    about: 'I like compact events with clear timelines and simple role assignment.',
    images: buildDemoPortraitStack('man', 75),
    profileStatus: 'public',
    activities: { game: 4, chat: 3, invitations: 1, events: 2, hosting: 1 }
  },
  {
    id: 'u3',
    name: 'Nagy Eszter',
    age: 30,
    birthday: '1995-07-19',
    city: 'Seattle',
    height: '168 cm',
    physique: 'Fit',
    languages: ['English', 'Hungarian'],
    horoscope: 'Cancer',
    initials: 'NE',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Kreatív',
    completion: 58,
    headline: 'Art nights and adventure mornings.',
    about: 'I enjoy cultural events and activity-heavy weekends with small groups.',
    images: buildDemoPortraitStack('woman', 76),
    profileStatus: 'public',
    activities: { game: 6, chat: 7, invitations: 3, events: 4, hosting: 2 }
  },
  {
    id: 'u4',
    name: 'Maya Stone',
    age: 29,
    birthday: '1996-11-04',
    city: 'San Diego',
    height: '172 cm',
    physique: 'Athletic',
    languages: ['English'],
    horoscope: 'Scorpio',
    initials: 'MS',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Social Charmer',
    completion: 76,
    headline: 'Sunset rides and coffee circles.',
    about: 'I host social-first events where people who do not know each other can connect fast.',
    images: buildDemoPortraitStack('woman', 77),
    profileStatus: 'public',
    activities: { game: 7, chat: 5, invitations: 3, events: 5, hosting: 2 }
  },
  {
    id: 'u5',
    name: 'Lina Park',
    age: 27,
    birthday: '1998-02-21',
    city: 'Denver',
    height: '167 cm',
    physique: 'Slim',
    languages: ['English', 'Korean'],
    horoscope: 'Pisces',
    initials: 'LP',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Deep Thinker',
    completion: 68,
    headline: 'Thoughtful plans, minimal noise.',
    about: 'I prefer meaningful conversations and smaller events with quality curation.',
    images: buildDemoPortraitStack('woman', 78),
    profileStatus: 'host only',
    activities: { game: 5, chat: 6, invitations: 4, events: 4, hosting: 1 }
  },
  {
    id: 'u6',
    name: 'Iris Bloom',
    age: 26,
    birthday: '1999-08-14',
    city: 'Miami',
    height: '169 cm',
    physique: 'Curvy',
    languages: ['English', 'Portuguese'],
    horoscope: 'Leo',
    initials: 'IB',
    gender: 'woman',
    statusText: 'Recently Active',
    hostTier: 'Bronze Host',
    traitLabel: 'Adventurer',
    completion: 55,
    headline: 'Travel light, host well.',
    about: 'I organize active and travel-style events with flexible participant roles.',
    images: buildDemoPortraitStack('woman', 79),
    profileStatus: 'public',
    activities: { game: 3, chat: 4, invitations: 2, events: 3, hosting: 1 }
  },
  {
    id: 'u7',
    name: 'Noah Hart',
    age: 30,
    birthday: '1995-03-07',
    city: 'New York',
    height: '184 cm',
    physique: 'Athletic',
    languages: ['English'],
    horoscope: 'Pisces',
    initials: 'NH',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Playful Spirit',
    completion: 70,
    headline: 'Fast pace, good vibes.',
    about: 'I host sports and game-heavy events with structured follow-ups.',
    images: buildDemoPortraitStack('man', 80),
    profileStatus: 'public',
    activities: { game: 8, chat: 9, invitations: 3, events: 5, hosting: 2 }
  },
  {
    id: 'u8',
    name: 'Evan Reed',
    age: 32,
    birthday: '1993-12-28',
    city: 'Boston',
    height: '180 cm',
    physique: 'Average',
    languages: ['English', 'French'],
    horoscope: 'Capricorn',
    initials: 'ER',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Ambitious Go-Getter',
    completion: 61,
    headline: 'Metrics first, then movement.',
    about: 'I optimize event outcomes and participant quality through filtered invites.',
    images: buildDemoPortraitStack('man', 81),
    profileStatus: 'public',
    activities: { game: 4, chat: 4, invitations: 2, events: 3, hosting: 2 }
  },
  {
    id: 'u9',
    name: 'Kai Morgan',
    age: 25,
    birthday: '2000-04-18',
    city: 'Portland',
    height: '178 cm',
    physique: 'Slim',
    languages: ['English'],
    horoscope: 'Aries',
    initials: 'KM',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Bronze Host',
    traitLabel: 'Creative Soul',
    completion: 53,
    headline: 'Design-led hangouts only.',
    about: 'I design event atmospheres first and build flow around people and space.',
    images: buildDemoPortraitStack('man', 82),
    profileStatus: 'host only',
    activities: { game: 2, chat: 5, invitations: 2, events: 2, hosting: 1 }
  },
  {
    id: 'u10',
    name: 'Luca Hale',
    age: 29,
    birthday: '1996-01-11',
    city: 'Los Angeles',
    height: '183 cm',
    physique: 'Fit',
    languages: ['English', 'Italian'],
    horoscope: 'Capricorn',
    initials: 'LH',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Gold Host',
    traitLabel: 'Reliable One',
    completion: 74,
    headline: 'Always on time, always clear.',
    about: 'I keep the calendar strict and communication transparent for all members.',
    images: buildDemoPortraitStack('man', 10),
    profileStatus: 'public',
    activities: { game: 6, chat: 4, invitations: 2, events: 6, hosting: 3 }
  },
  {
    id: 'u11',
    name: 'Theo Lane',
    age: 33,
    birthday: '1992-10-02',
    city: 'Nashville',
    height: '186 cm',
    physique: 'Athletic',
    languages: ['English'],
    horoscope: 'Libra',
    initials: 'TL',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Silver Host',
    traitLabel: 'Deep Thinker',
    completion: 60,
    headline: 'Calm planning for complex events.',
    about: 'I run long-format events with multiple sub-events and role-based access.',
    images: buildDemoPortraitStack('man', 11),
    profileStatus: 'friends only',
    activities: { game: 5, chat: 3, invitations: 2, events: 4, hosting: 2 }
  },
  {
    id: 'u12',
    name: 'Milo Grant',
    age: 27,
    birthday: '1998-06-27',
    city: 'Phoenix',
    height: '176 cm',
    physique: 'Average',
    languages: ['English', 'Spanish'],
    horoscope: 'Cancer',
    initials: 'MG',
    gender: 'man',
    statusText: 'Recently Active',
    hostTier: 'Bronze Host',
    traitLabel: 'Social Charmer',
    completion: 66,
    headline: 'Curated nights, meaningful circles.',
    about: 'I host quality-first social events with strong moderation and feedback loops.',
    images: buildDemoPortraitStack('man', 12),
    profileStatus: 'public',
    activities: { game: 4, chat: 5, invitations: 3, events: 3, hosting: 1 }
  }
];

export class SeedUserBuilder {
  private static readonly CITY_LOCATION_COORDINATES_BY_NAME: Record<string, LocationCoordinates> = {
    Austin: { latitude: 30.2672, longitude: -97.7431 },
    Seattle: { latitude: 47.6062, longitude: -122.3321 },
    Chicago: { latitude: 41.8781, longitude: -87.6298 },
    Denver: { latitude: 39.7392, longitude: -104.9903 },
    Miami: { latitude: 25.7617, longitude: -80.1918 },
    Boston: { latitude: 42.3601, longitude: -71.0589 },
    Phoenix: { latitude: 33.4484, longitude: -112.0740 },
    Nashville: { latitude: 36.1627, longitude: -86.7816 },
    'San Diego': { latitude: 32.7157, longitude: -117.1611 },
    Portland: { latitude: 45.5152, longitude: -122.6784 }
  };

  static buildExpandedDemoUsers(totalCount: number, baseUsers: readonly UserRecord[] = BASE_DEMO_USERS): UserRecord[] {
    const normalizedBaseUsers = baseUsers.map(user => this.withResolvedLocationCoordinates(user));
    if (baseUsers.length >= totalCount) {
      return normalizedBaseUsers.slice(0, totalCount);
    }
    const expanded: UserRecord[] = [...normalizedBaseUsers];
    const firstNamesWomen = ['Emma', 'Sophia', 'Olivia', 'Mia', 'Lina', 'Nora', 'Chloe', 'Ivy', 'Ava', 'Zoe'];
    const firstNamesMen = ['Liam', 'Noah', 'Ethan', 'Mason', 'Lucas', 'Owen', 'Elijah', 'Leo', 'Ryan', 'Alex'];
    const lastNames = ['Parker', 'Reed', 'Stone', 'Lane', 'Baker', 'Hale', 'Rivera', 'Turner', 'Brooks', 'Grant'];
    const cities = ['Austin', 'Seattle', 'Chicago', 'Denver', 'Miami', 'Boston', 'Phoenix', 'Nashville', 'San Diego', 'Portland'];
    const usedPrimaryPortraitUrls = new Set(
      expanded
        .map(user => user.images?.[0]?.trim() ?? '')
        .filter(Boolean)
    );
    let generatedWomenCount = 0;
    let generatedMenCount = 0;

    for (let index = baseUsers.length; index < totalCount; index += 1) {
      const id = `u${index + 1}`;
      const template = normalizedBaseUsers[index % normalizedBaseUsers.length];
      const gender = index % 2 === 0 ? 'woman' : 'man';
      const firstNamePool = gender === 'woman' ? firstNamesWomen : firstNamesMen;
      const generatedGenderIndex = gender === 'woman' ? generatedWomenCount++ : generatedMenCount++;
      const firstName = firstNamePool[generatedGenderIndex % firstNamePool.length];
      const lastName = lastNames[(generatedGenderIndex * 3 + Math.floor(generatedGenderIndex / firstNamePool.length)) % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const initials = `${firstName[0] ?? 'U'}${lastName[0] ?? 'S'}`.toUpperCase();
      const age = 24 + (index % 12);
      const birthday = new Date(1990 + (index % 11), index % 12, 1 + (index % 27));
      const images = this.buildUniquePrimaryPortraitStack(gender, (index * 7) % 100, usedPrimaryPortraitUrls);
      expanded.push(this.withResolvedLocationCoordinates({
        ...template,
        id,
        name,
        age,
        birthday: birthday.toISOString().slice(0, 10),
        city: cities[index % cities.length],
        initials,
        gender,
        images,
        ...this.demoLifecycleStatusForIndex(index, totalCount)
      }));
    }
    return expanded;
  }

  private static buildUniquePrimaryPortraitStack(
    gender: UserRecord['gender'],
    seedIndex: number,
    usedPrimaryPortraitUrls: Set<string>
  ): string[] {
    for (let offset = 0; offset < 100; offset += 1) {
      const images = buildDemoPortraitStack(gender, seedIndex + offset);
      const primaryImageUrl = images[0]?.trim() ?? '';
      if (primaryImageUrl && !usedPrimaryPortraitUrls.has(primaryImageUrl)) {
        usedPrimaryPortraitUrls.add(primaryImageUrl);
        return images;
      }
    }
    const images = buildDemoPortraitStack(gender, seedIndex);
    const primaryImageUrl = images[0]?.trim() ?? '';
    if (primaryImageUrl) {
      usedPrimaryPortraitUrls.add(primaryImageUrl);
    }
    return images;
  }

  private static demoLifecycleStatusForIndex(index: number, totalCount: number): Partial<UserRecord> {
    if (index === totalCount - 2) {
      return {
        profileStatus: 'blocked',
        statusText: 'Blocked',
        activities: { game: 0, chat: 1, invitations: 0, events: 0, hosting: 0 }
      };
    }
    if (index === totalCount - 1) {
      return {
        profileStatus: 'deleted',
        deletedAtIso: AppUtils.anchorDate(environment.bootstrapOffsetInDays).toISOString(),
        statusText: 'Deleted',
        activities: { game: 0, chat: 0, invitations: 0, events: 0, hosting: 0 }
      };
    }
    return {};
  }

  static resolveDemoLocationCoordinates(city: string, seedKey: string): LocationCoordinates {
    const base = this.CITY_LOCATION_COORDINATES_BY_NAME[city] ?? this.CITY_LOCATION_COORDINATES_BY_NAME['Austin'];
    const normalizedSeedKey = seedKey.trim() || city.trim() || 'demo-user';
    const seed = AppUtils.hashText(normalizedSeedKey);
    const latitudeOffset = (((seed % 29) - 14) * 0.0012);
    const longitudeOffset = (((Math.floor(seed / 29) % 29) - 14) * 0.0012);
    return {
      latitude: this.roundCoordinate(base.latitude + latitudeOffset),
      longitude: this.roundCoordinate(base.longitude + longitudeOffset)
    };
  }

  static resolveUserAffinity(
    user: Pick<
      UserDto,
      | 'id'
      | 'name'
      | 'age'
      | 'city'
      | 'height'
      | 'physique'
      | 'languages'
      | 'horoscope'
      | 'gender'
      | 'hostTier'
      | 'traitLabel'
      | 'completion'
    >
  ): number {
    const tokens = this.uniqueAffinityTokens([
      user.name,
      user.city,
      user.physique,
      ...(user.languages ?? []),
      user.horoscope,
      user.gender,
      user.hostTier,
      user.traitLabel
    ]);
    const heightCm = this.parseHeightCm(user.height) ?? 170;
    return (
      this.resolveAffinityTokenScore(tokens, `user:${user.id}`) * 97
      + Math.max(18, Math.trunc(Number(user.age) || 30)) * 17
      + heightCm * 11
      + Math.max(0, Math.trunc(Number(user.completion) || 0)) * 13
    );
  }

  private static withResolvedLocationCoordinates(user: UserRecord): UserRecord {
    const nextUser = {
      ...user,
      profileFormVersion: this.resolveSeedProfileFormVersion(user.profileFormVersion),
      locationCoordinates: this.cloneLocationCoordinates(user.locationCoordinates)
        ?? this.resolveDemoLocationCoordinates(user.city, user.id)
    };
    return {
      ...nextUser,
      affinity: Number.isFinite(nextUser.affinity)
        ? Number(nextUser.affinity)
        : this.resolveUserAffinity(nextUser)
    };
  }

  private static resolveSeedProfileFormVersion(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : CURRENT_PROFILE_FORM_VERSION;
  }

  private static cloneLocationCoordinates(
    value: LocationCoordinates | undefined | null
  ): LocationCoordinates | null {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: this.roundCoordinate(value.latitude),
      longitude: this.roundCoordinate(value.longitude)
    };
  }

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((AppUtils.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
  }

  private static parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private static roundCoordinate(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

}

import { AppUtils } from '../../../app-utils';
import { buildDemoPortraitStack, DEMO_USERS, type DemoUser } from '../../../demo-data';
import type { LocationCoordinates } from '../../base/interfaces';

export class DemoUserSeedBuilder {
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

  static buildExpandedDemoUsers(totalCount: number, baseUsers: readonly DemoUser[] = DEMO_USERS): DemoUser[] {
    const normalizedBaseUsers = baseUsers.map(user => this.withResolvedLocationCoordinates(user));
    if (baseUsers.length >= totalCount) {
      return normalizedBaseUsers.slice(0, totalCount);
    }
    const expanded: DemoUser[] = [...normalizedBaseUsers];
    const firstNamesWomen = ['Emma', 'Sophia', 'Olivia', 'Mia', 'Lina', 'Nora', 'Chloe', 'Ivy', 'Ava', 'Zoe'];
    const firstNamesMen = ['Liam', 'Noah', 'Ethan', 'Mason', 'Lucas', 'Owen', 'Elijah', 'Leo', 'Ryan', 'Alex'];
    const lastNames = ['Parker', 'Reed', 'Stone', 'Lane', 'Baker', 'Hale', 'Rivera', 'Turner', 'Brooks', 'Grant'];
    const cities = ['Austin', 'Seattle', 'Chicago', 'Denver', 'Miami', 'Boston', 'Phoenix', 'Nashville', 'San Diego', 'Portland'];

    for (let index = baseUsers.length; index < totalCount; index += 1) {
      const id = `u${index + 1}`;
      const template = normalizedBaseUsers[index % normalizedBaseUsers.length];
      const gender = index % 2 === 0 ? 'woman' : 'man';
      const firstNamePool = gender === 'woman' ? firstNamesWomen : firstNamesMen;
      const firstName = firstNamePool[index % firstNamePool.length];
      const lastName = lastNames[(index * 3) % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const initials = `${firstName[0] ?? 'U'}${lastName[0] ?? 'S'}`.toUpperCase();
      const age = 24 + (index % 12);
      const birthday = new Date(1990 + (index % 11), index % 12, 1 + (index % 27));
      const portraitIndex = (index * 7) % 100;
      expanded.push(this.withResolvedLocationCoordinates({
        ...template,
        id,
        name,
        age,
        birthday: birthday.toISOString().slice(0, 10),
        city: cities[index % cities.length],
        initials,
        gender,
        images: buildDemoPortraitStack(gender, portraitIndex)
      }));
    }
    return expanded;
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
      DemoUser,
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

  static isFriendOfActiveUser(userId: string, activeUserId: string): boolean {
    if (!userId || userId === activeUserId) {
      return false;
    }
    const [firstId, secondId] = [activeUserId.trim(), userId.trim()].sort();
    const seed = AppUtils.hashText(`friend-pair:${firstId}:${secondId}`);
    return (seed % 100) < 32;
  }

  static friendUsersForActiveUser<T extends Pick<DemoUser, 'id' | 'city' | 'gender'>>(
    users: readonly T[],
    activeUserId: string,
    limit = 12
  ): T[] {
    const normalizedActiveUserId = activeUserId.trim();
    if (!normalizedActiveUserId || limit <= 0) {
      return [];
    }
    const activeUser = users.find(user => user.id === normalizedActiveUserId) ?? null;
    return users
      .filter(user => user.id.trim().length > 0 && user.id !== normalizedActiveUserId)
      .map(user => ({
        user,
        score: this.friendAffinityScore(activeUser, user)
      }))
      .sort((left, right) => right.score - left.score || left.user.id.localeCompare(right.user.id))
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map(entry => entry.user);
  }

  private static withResolvedLocationCoordinates(user: DemoUser): DemoUser {
    const nextUser = {
      ...user,
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

  private static friendAffinityScore<T extends Pick<DemoUser, 'id' | 'city' | 'gender'>>(
    activeUser: T | null,
    candidate: T
  ): number {
    const normalizedCandidateId = candidate.id.trim();
    if (!normalizedCandidateId) {
      return Number.NEGATIVE_INFINITY;
    }
    const normalizedActiveUserId = activeUser?.id?.trim() ?? '';
    const [firstId, secondId] = [normalizedActiveUserId, normalizedCandidateId].sort();
    const pairSeed = AppUtils.hashText(`friend-pair:${firstId}:${secondId}`);
    const cityBonus = activeUser?.city?.trim() && activeUser.city === candidate.city ? 220 : 0;
    const genderBonus = activeUser?.gender && activeUser.gender === candidate.gender ? 40 : 0;
    return 10_000 - pairSeed + cityBonus + genderBonus;
  }
}

import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../interfaces/user.interface';

export class UserProfileStateBuilder {
  private static readonly EMPTY_ONBOARDING_USER_ID = 'u-onboarding';
  private static readonly HARD_HIDDEN_PROFILE_STATUSES = new Set(['blocked', 'inactive', 'deleted']);
  private static readonly INSIDE_NETWORK_GAME_PROFILE_STATUSES = new Set(['public', 'friends only']);

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

  static isFriendOfActiveUser(userId: string, activeUserId: string): boolean {
    if (
      !userId
      || userId === activeUserId
      || this.isEmptyOnboardingProfileUserId(userId)
      || this.isEmptyOnboardingProfileUserId(activeUserId)
    ) {
      return false;
    }
    const [firstId, secondId] = [activeUserId.trim(), userId.trim()].sort();
    const seed = AppUtils.hashText(`friend-pair:${firstId}:${secondId}`);
    return (seed % 100) < 32;
  }

  static isPublicGameProfile(user: Pick<UserDto, 'profileStatus'> | null | undefined): boolean {
    return user?.profileStatus === 'public';
  }

  static isInsideNetworkGameProfile(user: Pick<UserDto, 'profileStatus'> | null | undefined): boolean {
    return this.INSIDE_NETWORK_GAME_PROFILE_STATUSES.has(user?.profileStatus ?? '');
  }

  static isActivityRateVisibleProfile(user: Pick<UserDto, 'profileStatus'> | null | undefined): boolean {
    return Boolean(user) && !this.HARD_HIDDEN_PROFILE_STATUSES.has(user?.profileStatus ?? '');
  }

  static isEmptyOnboardingProfileUserId(userId: string): boolean {
    return userId.trim() === this.EMPTY_ONBOARDING_USER_ID;
  }

  static isEmptyOnboardingProfile(
    user: Partial<Pick<
      UserDto,
      | 'id'
      | 'name'
      | 'birthday'
      | 'city'
      | 'height'
      | 'physique'
      | 'languages'
      | 'statusText'
      | 'completion'
      | 'profileFormVersion'
      | 'images'
      | 'profileDetails'
    >>
  ): boolean {
    if (this.isEmptyOnboardingProfileUserId(`${user.id ?? ''}`)) {
      return true;
    }
    const statusText = `${user.statusText ?? ''}`.trim().toLowerCase();
    const completion = Math.max(0, Math.trunc(Number(user.completion) || 0));
    const profileFormVersion = Math.max(0, Math.trunc(Number(user.profileFormVersion) || 0));
    const profileDetails = Array.isArray(user.profileDetails) ? user.profileDetails : [];
    const hasProfileData = Boolean(
      `${user.name ?? ''}`.trim()
      || `${user.birthday ?? ''}`.trim()
      || `${user.city ?? ''}`.trim()
      || `${user.height ?? ''}`.trim()
      || `${user.physique ?? ''}`.trim()
      || (user.languages ?? []).some(language => `${language ?? ''}`.trim().length > 0)
      || (user.images ?? []).some(image => `${image ?? ''}`.trim().length > 0)
      || profileDetails.some(group => (group.rows ?? []).some(row => `${row.value ?? ''}`.trim().length > 0))
    );
    return !hasProfileData
      && (
        statusText === 'new'
        || statusText === 'new profile'
        || (completion === 0 && profileFormVersion === 0)
      );
  }

  static friendUsersForActiveUser<T extends Pick<UserDto, 'id' | 'city' | 'gender'>>(
    users: readonly T[],
    activeUserId: string,
    limit = 12
  ): T[] {
    const normalizedActiveUserId = activeUserId.trim();
    if (!normalizedActiveUserId || limit <= 0 || this.isEmptyOnboardingProfileUserId(normalizedActiveUserId)) {
      return [];
    }
    const seedableUsers = users.filter(user => !this.isEmptyOnboardingProfileUserId(user.id) && !this.isEmptyOnboardingProfile(user));
    const activeUser = seedableUsers.find(user => user.id === normalizedActiveUserId) ?? null;
    return seedableUsers
      .filter(user => user.id.trim().length > 0 && user.id !== normalizedActiveUserId)
      .map(user => ({
        user,
        score: this.friendAffinityScore(activeUser, user)
      }))
      .sort((left, right) => right.score - left.score || left.user.id.localeCompare(right.user.id))
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map(entry => entry.user);
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

  private static friendAffinityScore<T extends Pick<UserDto, 'id' | 'city' | 'gender'>>(
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

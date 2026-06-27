import { Injectable, computed, signal } from '@angular/core';

import type { ProfileExtDto, UserDto, UserImpressionsDto } from '../../../core/contracts/user.interface';
import {
  DEFAULT_USER_IMPRESSION_CHANGE_FLAGS,
  type AppContextAdminUserDto,
  type UserGameFilterPreferencesDto,
  type UserImpressionChangeFlags
} from '../app-context.types';
import {
  adminUserFromProfile,
  cloneImpressions,
  cloneProfileExt,
  cloneUserProfile,
  normalizeCounterValue,
  normalizeFilterPreferences
} from './app-context-store.utils';

@Injectable({
  providedIn: 'root'
})
export class UserProfileStore {
  private readonly _userProfilesByUserId = signal<Record<string, UserDto>>({});
  private readonly _profileExtByUserId = signal<Record<string, ProfileExtDto>>({});
  private readonly _filterCountByUserId = signal<Record<string, number>>({});
  private readonly _filterPreferencesByUserId = signal<Record<string, UserGameFilterPreferencesDto>>({});
  private readonly _impressionsByUserId = signal<Record<string, UserImpressionsDto>>({});
  private readonly _impressionChangeFlagsByUserId = signal<Record<string, UserImpressionChangeFlags>>({});
  private readonly _activeUserId = signal<string>('');

  readonly userProfilesByUserId = this._userProfilesByUserId.asReadonly();
  readonly profileExtByUserId = this._profileExtByUserId.asReadonly();
  readonly filterCountByUserId = this._filterCountByUserId.asReadonly();
  readonly filterPreferencesByUserId = this._filterPreferencesByUserId.asReadonly();
  readonly impressionsByUserId = this._impressionsByUserId.asReadonly();
  readonly impressionChangeFlagsByUserId = this._impressionChangeFlagsByUserId.asReadonly();
  readonly activeUserId = this._activeUserId.asReadonly();
  readonly activeUserProfile = computed(() => {
    const normalizedUserId = this._activeUserId().trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this._userProfilesByUserId()[normalizedUserId];
    return user ? cloneUserProfile(user) : null;
  });
  readonly activeUserProfileExt = computed(() => {
    const normalizedUserId = this._activeUserId().trim();
    if (!normalizedUserId) {
      return null;
    }
    return this._profileExtByUserId()[normalizedUserId] ?? null;
  });
  readonly activeUserIsAdmin = computed(() =>
    this.isAdminUserProfile(this.activeUserProfile(), this._activeUserId())
  );
  readonly activeAdminUser = computed(() =>
    this.activeUserIsAdmin() ? adminUserFromProfile(this.activeUserProfile()) : null
  );

  getActiveUserId(): string {
    return this._activeUserId();
  }

  setActiveUserId(userId: string): void {
    const normalizedUserId = userId.trim();
    this._activeUserId.set(normalizedUserId);
  }

  getUserProfile(userId: string): UserDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this._userProfilesByUserId()[normalizedUserId];
    return user ? cloneUserProfile(user) : null;
  }

  setUserProfile(user: UserDto): void {
    const normalizedUserId = user.id.trim();
    if (!normalizedUserId) {
      return;
    }
    this._userProfilesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: cloneUserProfile({
        ...user,
        id: normalizedUserId
      })
    }));
  }

  getProfileExt(userId: string): ProfileExtDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const profileExt = this._profileExtByUserId()[normalizedUserId];
    return profileExt ? cloneProfileExt(profileExt) : null;
  }

  setProfileExt(profileExt: ProfileExtDto): void {
    const normalizedUserId = profileExt.profile.id.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedProfileExt = cloneProfileExt({
      ...profileExt,
      profile: {
        ...profileExt.profile,
        id: normalizedUserId
      }
    });
    this._profileExtByUserId.update(state => ({
      ...state,
      [normalizedUserId]: normalizedProfileExt
    }));
    this.setUserProfile(normalizedProfileExt.profile);
  }

  patchActiveUserProfile(
    patch: Partial<Omit<UserDto, 'id'>> | ((current: UserDto) => Partial<Omit<UserDto, 'id'>>)
  ): UserDto | null {
    const current = this.activeUserProfile();
    if (!current) {
      return null;
    }
    const resolvedPatch = typeof patch === 'function' ? patch(current) : patch;
    const nextUser: UserDto = {
      ...current,
      ...resolvedPatch,
      id: current.id
    };
    this.setUserProfile(nextUser);
    return this.getUserProfile(current.id);
  }

  getActiveAdminUser(): AppContextAdminUserDto | null {
    return this.activeAdminUser();
  }

  isAdminUserProfile(user: UserDto | null | undefined, fallbackUserId = ''): boolean {
    const normalizedUserId = `${user?.id ?? fallbackUserId ?? ''}`.trim();
    return user?.admin === true
      || user?.hostTier === 'Admin'
      || user?.statusText === 'Admin workspace'
      || normalizedUserId === 'admin'
      || normalizedUserId.startsWith('admin-');
  }

  clearUserProfile(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._userProfilesByUserId.update(state => {
      if (!Object.prototype.hasOwnProperty.call(state, normalizedUserId)) {
        return state;
      }
      const { [normalizedUserId]: _removed, ...rest } = state;
      return rest;
    });
  }

  getUserFilterCountOverride(userId: string): number | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const value = this._filterCountByUserId()[normalizedUserId];
    if (!Number.isFinite(value)) {
      return null;
    }
    return normalizeCounterValue(value);
  }

  setUserFilterCountOverride(userId: string, value: number): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedValue = normalizeCounterValue(value);
    this._filterCountByUserId.update(state => ({
      ...state,
      [normalizedUserId]: normalizedValue
    }));
  }

  clearUserFilterCountOverride(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._filterCountByUserId.update(state => {
      if (!Object.prototype.hasOwnProperty.call(state, normalizedUserId)) {
        return state;
      }
      const { [normalizedUserId]: _removed, ...rest } = state;
      return rest;
    });
  }

  resolveUserFilterCount(userId: string, fallbackValue: number): number {
    const override = this.getUserFilterCountOverride(userId);
    if (override !== null) {
      return override;
    }
    return normalizeCounterValue(fallbackValue);
  }

  getUserFilterPreferences(userId: string): UserGameFilterPreferencesDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const preferences = this._filterPreferencesByUserId()[normalizedUserId];
    if (!preferences) {
      return null;
    }
    return { ...preferences };
  }

  resolveUserFilterPreferences<T extends UserGameFilterPreferencesDto>(userId: string, fallback: T): T {
    const normalizedFallback = normalizeFilterPreferences(fallback) as T;
    const preferences = this.getUserFilterPreferences(userId);
    if (!preferences) {
      return { ...normalizedFallback };
    }
    return normalizeFilterPreferences({
      ...normalizedFallback,
      ...preferences
    }) as T;
  }

  setUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._filterPreferencesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: normalizeFilterPreferences(preferences)
    }));
  }

  clearUserFilterPreferences(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._filterPreferencesByUserId.update(state => {
      if (!Object.prototype.hasOwnProperty.call(state, normalizedUserId)) {
        return state;
      }
      const { [normalizedUserId]: _removed, ...rest } = state;
      return rest;
    });
  }

  getUserImpressions(userId: string): UserImpressionsDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const impressions = this._impressionsByUserId()[normalizedUserId];
    if (!impressions) {
      return null;
    }
    return cloneImpressions(impressions);
  }

  setUserImpressions(userId: string, impressions: UserImpressionsDto): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._impressionsByUserId.update(state => ({
      ...state,
      [normalizedUserId]: cloneImpressions(impressions)
    }));
  }

  clearUserImpressions(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._impressionsByUserId.update(state => {
      if (!Object.prototype.hasOwnProperty.call(state, normalizedUserId)) {
        return state;
      }
      const { [normalizedUserId]: _removed, ...rest } = state;
      return rest;
    });
  }

  getUserImpressionChangeFlags(userId: string): UserImpressionChangeFlags {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return { ...DEFAULT_USER_IMPRESSION_CHANGE_FLAGS };
    }
    const flags = this._impressionChangeFlagsByUserId()[normalizedUserId];
    if (!flags) {
      return { ...DEFAULT_USER_IMPRESSION_CHANGE_FLAGS };
    }
    return {
      host: flags.host === true,
      member: flags.member === true
    };
  }

  setUserImpressionChangeFlags(userId: string, flags: UserImpressionChangeFlags): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedFlags: UserImpressionChangeFlags = {
      host: flags.host === true,
      member: flags.member === true
    };
    this._impressionChangeFlagsByUserId.update(state => ({
      ...state,
      [normalizedUserId]: normalizedFlags
    }));
  }

  clearUserImpressionChangeFlags(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._impressionChangeFlagsByUserId.update(state => {
      if (!Object.prototype.hasOwnProperty.call(state, normalizedUserId)) {
        return state;
      }
      const { [normalizedUserId]: _removed, ...rest } = state;
      return rest;
    });
  }
}

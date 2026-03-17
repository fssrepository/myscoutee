import { Injectable, computed, signal } from '@angular/core';
import type { UserGameFilterPreferencesDto } from '../interfaces/game.interface';
import type { UserDto, UserImpressionsDto, UserImpressionsSectionDto } from '../interfaces/user.interface';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';
export type ActivityCounterKey = 'game' | 'chat' | 'invitations' | 'events' | 'hosting' | 'tickets' | 'feedback';
export type ConnectivityState = 'online' | 'offline';

export interface ActivityCounters {
  game: number;
  chat: number;
  invitations: number;
  events: number;
  hosting: number;
  tickets: number;
  feedback: number;
}

export interface LoadState {
  status: LoadStatus;
  error: string | null;
  loadedAtIso: string | null;
}

export interface UserImpressionChangeFlags {
  host: boolean;
  member: boolean;
}

export interface ActivityMembersSyncState {
  updatedMs: number;
  id: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
}

export interface ActivityInvitePopupState {
  updatedMs: number;
  ownerId: string;
  title?: string;
}

interface NavigatorMenuRequest {
  updatedMs: number;
  type: 'activities' | 'asset';
  primaryFilter?: 'rates' | 'chats' | 'events';
  eventScope?: 'active-events' | 'invitations' | 'my-events';
  assetFilter?: 'Car' | 'Accommodation' | 'Supplies' | 'Ticket';
}

export const DEFAULT_LOAD_STATE: LoadState = {
  status: 'idle',
  error: null,
  loadedAtIso: null
};

export const DEFAULT_USER_IMPRESSION_CHANGE_FLAGS: UserImpressionChangeFlags = {
  host: false,
  member: false
};

const ACTIVITY_COUNTER_KEYS: ActivityCounterKey[] = [
  'game',
  'chat',
  'invitations',
  'events',
  'hosting',
  'tickets',
  'feedback'
];

function detectInitialConnectivityState(): ConnectivityState {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }
  return 'online';
}

@Injectable({
  providedIn: 'root'
})
export class AppContext {
  private readonly _loadingState = signal<Record<string, LoadState>>({});
  private readonly _userProfilesByUserId = signal<Record<string, UserDto>>({});
  private readonly _counterOverridesByUserId = signal<Record<string, Partial<ActivityCounters>>>({});
  private readonly _filterCountByUserId = signal<Record<string, number>>({});
  private readonly _filterPreferencesByUserId = signal<Record<string, UserGameFilterPreferencesDto>>({});
  private readonly _impressionsByUserId = signal<Record<string, UserImpressionsDto>>({});
  private readonly _impressionChangeFlagsByUserId = signal<Record<string, UserImpressionChangeFlags>>({});
  private readonly _activityMembersSync = signal<ActivityMembersSyncState | null>(null);
  private readonly _activityInvitePopup = signal<ActivityInvitePopupState | null>(null);
  private readonly _navigatorMenuRequest = signal<NavigatorMenuRequest | null>(null);
  private readonly _activeUserId = signal<string>('');
  private readonly _connectivityState = signal<ConnectivityState>(detectInitialConnectivityState());

  readonly loadingState = this._loadingState.asReadonly();
  readonly userProfilesByUserId = this._userProfilesByUserId.asReadonly();
  readonly counterOverridesByUserId = this._counterOverridesByUserId.asReadonly();
  readonly filterCountByUserId = this._filterCountByUserId.asReadonly();
  readonly filterPreferencesByUserId = this._filterPreferencesByUserId.asReadonly();
  readonly impressionsByUserId = this._impressionsByUserId.asReadonly();
  readonly impressionChangeFlagsByUserId = this._impressionChangeFlagsByUserId.asReadonly();
  readonly activityMembersSync = this._activityMembersSync.asReadonly();
  readonly activityInvitePopup = this._activityInvitePopup.asReadonly();
  readonly navigatorMenuRequest = this._navigatorMenuRequest.asReadonly();
  readonly activeUserId = this._activeUserId.asReadonly();
  readonly connectivityState = this._connectivityState.asReadonly();
  readonly isOnline = computed(() => this._connectivityState() === 'online');
  readonly activeUserProfile = computed(() => {
    const normalizedUserId = this._activeUserId().trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this._userProfilesByUserId()[normalizedUserId];
    return user ? this.cloneUserProfile(user) : null;
  });

  selectLoadingState(contextKey: string) {
    return computed(() => this._loadingState()[contextKey] ?? DEFAULT_LOAD_STATE);
  }

  getLoadingState(contextKey: string): LoadState {
    return this._loadingState()[contextKey] ?? DEFAULT_LOAD_STATE;
  }

  setLoadingState(contextKey: string, next: LoadState): void {
    this._loadingState.update(state => ({
      ...state,
      [contextKey]: next
    }));
  }

  resetLoadingState(contextKey: string): void {
    this.setLoadingState(contextKey, { ...DEFAULT_LOAD_STATE });
  }

  setStatus(contextKey: string, status: LoadStatus, message?: string): LoadState {
    const current = this.getLoadingState(contextKey);
    const next: LoadState = {
      status,
      error: message ?? (status === 'loading' || status === 'success' ? null : current.error),
      loadedAtIso: status === 'success' ? new Date().toISOString() : current.loadedAtIso
    };
    this.setLoadingState(contextKey, next);
    return next;
  }

  getActiveUserId(): string {
    return this._activeUserId();
  }

  setActiveUserId(userId: string): void {
    const normalizedUserId = userId.trim();
    this._activeUserId.set(normalizedUserId);
  }

  setConnectivityState(state: ConnectivityState): void {
    this._connectivityState.set(state);
  }

  setOnlineState(isOnline: boolean): void {
    this._connectivityState.set(isOnline ? 'online' : 'offline');
  }

  getUserProfile(userId: string): UserDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this._userProfilesByUserId()[normalizedUserId];
    return user ? this.cloneUserProfile(user) : null;
  }

  setUserProfile(user: UserDto): void {
    const normalizedUserId = user.id.trim();
    if (!normalizedUserId) {
      return;
    }
    this._userProfilesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: this.cloneUserProfile({
        ...user,
        id: normalizedUserId
      })
    }));
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

  getUserCounterOverride(userId: string, key: ActivityCounterKey): number | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const value = this._counterOverridesByUserId()[normalizedUserId]?.[key];
    if (!Number.isFinite(value)) {
      return null;
    }
    return this.normalizeCounterValue(value as number);
  }

  getUserCounterOverrides(userId: string): Partial<ActivityCounters> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {};
    }
    const overrides = this._counterOverridesByUserId()[normalizedUserId];
    if (!overrides) {
      return {};
    }
    return { ...overrides };
  }

  setUserCounterOverride(userId: string, key: ActivityCounterKey, value: number): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedValue = this.normalizeCounterValue(value);
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        [key]: normalizedValue
      }
    }));
  }

  patchUserCounterOverrides(userId: string, patch: Partial<ActivityCounters>): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPatch: Partial<ActivityCounters> = {};
    for (const key of ACTIVITY_COUNTER_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }
      const value = patch[key];
      if (!Number.isFinite(value)) {
        continue;
      }
      normalizedPatch[key] = this.normalizeCounterValue(value as number);
    }
    if (Object.keys(normalizedPatch).length === 0) {
      return;
    }
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        ...normalizedPatch
      }
    }));
  }

  clearUserCounterOverrides(userId: string, keys?: ActivityCounterKey[]): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._counterOverridesByUserId.update(state => {
      const current = state[normalizedUserId];
      if (!current) {
        return state;
      }
      if (!keys || keys.length === 0) {
        const { [normalizedUserId]: _removed, ...rest } = state;
        return rest;
      }
      const next = { ...current };
      for (const key of keys) {
        delete next[key];
      }
      if (Object.keys(next).length === 0) {
        const { [normalizedUserId]: _removed, ...rest } = state;
        return rest;
      }
      return {
        ...state,
        [normalizedUserId]: next
      };
    });
  }

  resolveUserCounter(userId: string, key: ActivityCounterKey, fallbackValue: number): number {
    const override = this.getUserCounterOverride(userId, key);
    if (override !== null) {
      return override;
    }
    return this.normalizeCounterValue(fallbackValue);
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
    return this.normalizeCounterValue(value as number);
  }

  setUserFilterCountOverride(userId: string, value: number): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedValue = this.normalizeCounterValue(value);
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
    return this.normalizeCounterValue(fallbackValue);
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
    const normalizedFallback = this.normalizeFilterPreferences(fallback) as T;
    const preferences = this.getUserFilterPreferences(userId);
    if (!preferences) {
      return { ...normalizedFallback };
    }
    return this.normalizeFilterPreferences({
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
      [normalizedUserId]: this.normalizeFilterPreferences(preferences)
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
    return this.cloneImpressions(impressions);
  }

  setUserImpressions(userId: string, impressions: UserImpressionsDto): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._impressionsByUserId.update(state => ({
      ...state,
      [normalizedUserId]: this.cloneImpressions(impressions)
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

  emitActivityMembersSync(payload: Omit<ActivityMembersSyncState, 'updatedMs'>): void {
    const normalizedId = payload.id.trim();
    if (!normalizedId) {
      return;
    }
    const updatedMs = Date.now();
    this._activityMembersSync.set({
      updatedMs,
      id: normalizedId,
      acceptedMembers: this.normalizeCounterValue(payload.acceptedMembers),
      pendingMembers: this.normalizeCounterValue(payload.pendingMembers),
      capacityTotal: Math.max(
        this.normalizeCounterValue(payload.acceptedMembers),
        this.normalizeCounterValue(payload.capacityTotal)
      )
    });
  }

  openActivityInvitePopup(payload: { ownerId: string; title?: string }): void {
    const normalizedOwnerId = payload.ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    this._activityInvitePopup.set({
      updatedMs: Date.now(),
      ownerId: normalizedOwnerId,
      title: payload.title?.trim() || undefined
    });
  }

  closeActivityInvitePopup(): void {
    this._activityInvitePopup.set(null);
  }

  openNavigatorActivitiesRequest(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'active-events' | 'invitations' | 'my-events'
  ): void {
    this._navigatorMenuRequest.set({
      updatedMs: Date.now(),
      type: 'activities',
      primaryFilter,
      eventScope
    });
  }

  openNavigatorAssetRequest(assetFilter: 'Car' | 'Accommodation' | 'Supplies' | 'Ticket'): void {
    this._navigatorMenuRequest.set({
      updatedMs: Date.now(),
      type: 'asset',
      assetFilter
    });
  }

  clearNavigatorMenuRequest(): void {
    this._navigatorMenuRequest.set(null);
  }

  private normalizeCounterValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private normalizeFilterPreferences(
    preferences: UserGameFilterPreferencesDto
  ): UserGameFilterPreferencesDto {
    const normalizeNumber = (value: unknown): number | undefined => {
      if (!Number.isFinite(value)) {
        return undefined;
      }
      return Math.max(0, Math.trunc(Number(value)));
    };
    const normalizeStringArray = (values: unknown): string[] | undefined => {
      if (!Array.isArray(values)) {
        return undefined;
      }
      const normalized = values
        .map(value => String(value).trim())
        .filter(value => value.length > 0);
      return normalized.length > 0 ? normalized : [];
    };
    const normalizeGenderArray = (values: unknown): Array<'woman' | 'man'> | undefined => {
      if (!Array.isArray(values)) {
        return undefined;
      }
      const normalized = values
        .map(value => String(value).trim().toLowerCase())
        .filter((value): value is 'woman' | 'man' => value === 'woman' || value === 'man');
      return normalized.length > 0 ? normalized : [];
    };

    const normalized: UserGameFilterPreferencesDto = {};
    const ageMin = normalizeNumber(preferences.ageMin);
    const ageMax = normalizeNumber(preferences.ageMax);
    const heightMinCm = normalizeNumber(preferences.heightMinCm);
    const heightMaxCm = normalizeNumber(preferences.heightMaxCm);
    if (ageMin !== undefined) {
      normalized.ageMin = ageMin;
    }
    if (ageMax !== undefined) {
      normalized.ageMax = ageMax;
    }
    if (heightMinCm !== undefined) {
      normalized.heightMinCm = heightMinCm;
    }
    if (heightMaxCm !== undefined) {
      normalized.heightMaxCm = heightMaxCm;
    }

    const interests = normalizeStringArray(preferences.interests);
    const values = normalizeStringArray(preferences.values);
    const physiques = normalizeStringArray(preferences.physiques);
    const languages = normalizeStringArray(preferences.languages);
    const genders = normalizeGenderArray(preferences.genders);
    const horoscopes = normalizeStringArray(preferences.horoscopes);
    const traitLabels = normalizeStringArray(preferences.traitLabels);
    const smoking = normalizeStringArray(preferences.smoking);
    const drinking = normalizeStringArray(preferences.drinking);
    const workout = normalizeStringArray(preferences.workout);
    const pets = normalizeStringArray(preferences.pets);
    const familyPlans = normalizeStringArray(preferences.familyPlans);
    const children = normalizeStringArray(preferences.children);
    const loveStyles = normalizeStringArray(preferences.loveStyles);
    const communicationStyles = normalizeStringArray(preferences.communicationStyles);
    const sexualOrientations = normalizeStringArray(preferences.sexualOrientations);
    const religions = normalizeStringArray(preferences.religions);

    if (interests) {
      normalized.interests = interests;
    }
    if (values) {
      normalized.values = values;
    }
    if (physiques) {
      normalized.physiques = physiques;
    }
    if (languages) {
      normalized.languages = languages;
    }
    if (genders) {
      normalized.genders = genders;
    }
    if (horoscopes) {
      normalized.horoscopes = horoscopes;
    }
    if (traitLabels) {
      normalized.traitLabels = traitLabels;
    }
    if (smoking) {
      normalized.smoking = smoking;
    }
    if (drinking) {
      normalized.drinking = drinking;
    }
    if (workout) {
      normalized.workout = workout;
    }
    if (pets) {
      normalized.pets = pets;
    }
    if (familyPlans) {
      normalized.familyPlans = familyPlans;
    }
    if (children) {
      normalized.children = children;
    }
    if (loveStyles) {
      normalized.loveStyles = loveStyles;
    }
    if (communicationStyles) {
      normalized.communicationStyles = communicationStyles;
    }
    if (sexualOrientations) {
      normalized.sexualOrientations = sexualOrientations;
    }
    if (religions) {
      normalized.religions = religions;
    }

    return normalized;
  }


  private cloneImpressions(impressions: UserImpressionsDto): UserImpressionsDto {
    return {
      host: this.cloneImpressionsSection(impressions.host),
      member: this.cloneImpressionsSection(impressions.member)
    };
  }

  private cloneImpressionsSection(
    section: UserImpressionsSectionDto | undefined
  ): UserImpressionsSectionDto | undefined {
    if (!section) {
      return undefined;
    }
    return {
      ...section,
      vibeBadges: [...(section.vibeBadges ?? [])],
      personalityBadges: [...(section.personalityBadges ?? [])],
      categoryBadges: [...(section.categoryBadges ?? [])]
    };
  }

  private cloneUserProfile(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0
      },
      impressions: user.impressions ? this.cloneImpressions(user.impressions) : undefined
    };
  }
}

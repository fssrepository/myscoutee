import { Injectable } from '@angular/core';

import type { UserDto } from '../interfaces/user.interface';
import type { ExperienceEntry, ProfileStatus } from '../models/profile.model';

export type ProfileOnboardingStepId =
  | 'basics'
  | 'photos'
  | 'identity'
  | 'about'
  | 'lifestyle'
  | 'values'
  | 'interests'
  | 'experience'
  | 'review';

export interface ProfileOnboardingForm {
  fullName: string;
  birthday: string;
  city: string;
  heightCm: number | null;
  physique: string;
  languages: string[];
  images: string[];
  headline: string;
  about: string;
  profileStatus: ProfileStatus;
  genderDetail: string;
  drinking: string;
  smoking: string;
  workout: string;
  pets: string;
  familyPlans: string;
  children: string;
  loveStyle: string;
  communicationStyle: string;
  sexualOrientation: string;
  religion: string;
  values: string[];
  interests: string[];
  experienceEntries: ExperienceEntry[];
}

export interface ProfileOnboardingDraft {
  version: 1;
  userId: string;
  currentStepId: ProfileOnboardingStepId;
  updatedAtIso: string;
  completedStepIds: ProfileOnboardingStepId[];
  skippedStepIds: ProfileOnboardingStepId[];
  form: ProfileOnboardingForm;
}

export interface ProfileOnboardingAssessment {
  shouldPrompt: boolean;
  requiredMissingKeys: string[];
  emptyProfile: boolean;
  profileFormOutdated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileOnboardingService {
  private static readonly STORAGE_PREFIX = 'myscoutee.profile-onboarding.v1';
  readonly currentProfileFormVersion = 2;

  assessUser(user: UserDto | null | undefined): ProfileOnboardingAssessment {
    if (!user || this.isBlockedLifecycleUser(user)) {
      return {
        shouldPrompt: false,
        requiredMissingKeys: [],
        emptyProfile: false,
        profileFormOutdated: false
      };
    }
    const requiredMissingKeys = this.requiredMissingKeys(user);
    const emptyProfile = this.isProfileEffectivelyEmpty(user);
    const profileFormOutdated = this.resolveProfileFormVersion(user.profileFormVersion) < this.currentProfileFormVersion;
    return {
      shouldPrompt: emptyProfile || requiredMissingKeys.length > 0 || profileFormOutdated,
      requiredMissingKeys,
      emptyProfile,
      profileFormOutdated
    };
  }

  shouldPrompt(user: UserDto | null | undefined): boolean {
    return this.assessUser(user).shouldPrompt;
  }

  loadDraft(user: UserDto): ProfileOnboardingDraft {
    const stored = this.readStoredDraft(user.id);
    if (stored) {
      return this.mergeDraftWithUser(stored, user);
    }
    return this.createDraft(user);
  }

  saveDraft(draft: ProfileOnboardingDraft): void {
    const normalizedDraft = this.normalizeDraft(draft);
    if (!normalizedDraft.userId) {
      return;
    }
    this.writeJson(this.storageKey(normalizedDraft.userId), normalizedDraft);
  }

  clearDraft(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(this.storageKey(normalizedUserId));
    } catch {
      // Storage cleanup is best-effort.
    }
  }

  createDraft(user: UserDto): ProfileOnboardingDraft {
    return this.normalizeDraft({
      version: 1,
      userId: user.id.trim(),
      currentStepId: 'basics',
      updatedAtIso: new Date().toISOString(),
      completedStepIds: [],
      skippedStepIds: [],
      form: this.initialForm(user)
    });
  }

  requiredMissingKeys(user: UserDto): string[] {
    const missing: string[] = [];
    if (!this.hasText(user.name)) {
      missing.push('name');
    }
    if (!this.isIsoDate(user.birthday)) {
      missing.push('birthday');
    }
    if (!this.hasText(user.city)) {
      missing.push('city');
    }
    if ((this.parseHeightCm(user.height) ?? 0) <= 0) {
      missing.push('height');
    }
    if (!this.hasText(user.physique)) {
      missing.push('physique');
    }
    if ((user.languages ?? []).filter(language => this.hasText(language)).length === 0) {
      missing.push('languages');
    }
    return missing;
  }

  private readStoredDraft(userId: string): ProfileOnboardingDraft | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    return this.readJson<ProfileOnboardingDraft>(this.storageKey(normalizedUserId));
  }

  private mergeDraftWithUser(draft: ProfileOnboardingDraft, user: UserDto): ProfileOnboardingDraft {
    const fallback = this.initialForm(user);
    const normalized = this.normalizeDraft({
      ...draft,
      userId: user.id.trim(),
      form: {
        ...fallback,
        ...(draft.form ?? {}),
        languages: this.normalizeStringList(draft.form?.languages).length > 0
          ? this.normalizeStringList(draft.form?.languages)
          : fallback.languages,
        images: this.normalizeStringList(draft.form?.images).length > 0
          ? this.normalizeStringList(draft.form?.images).slice(0, 8)
          : fallback.images,
        values: this.normalizeStringList(draft.form?.values),
        interests: this.normalizeStringList(draft.form?.interests),
        experienceEntries: this.normalizeExperienceEntries(draft.form?.experienceEntries ?? fallback.experienceEntries)
      }
    });
    return normalized;
  }

  private initialForm(user: UserDto): ProfileOnboardingForm {
    const emptyProfile = this.isProfileEffectivelyEmpty(user);
    return {
      fullName: `${user.name ?? ''}`.trim(),
      birthday: this.isIsoDate(user.birthday) ? user.birthday.trim() : '',
      city: `${user.city ?? ''}`.trim(),
      heightCm: this.parseHeightCm(user.height),
      physique: `${user.physique ?? ''}`.trim(),
      languages: this.normalizeStringList(user.languages),
      images: this.normalizeStringList(user.images).slice(0, 8),
      headline: `${user.headline ?? ''}`.trim(),
      about: `${user.about ?? ''}`.trim().slice(0, 160),
      profileStatus: this.normalizeProfileStatus(user.profileStatus),
      genderDetail: emptyProfile
        ? ''
        : user.gender === 'woman' ? 'Woman' : user.gender === 'man' ? 'Man' : '',
      drinking: this.profileDetailValue(user, 'Drinking'),
      smoking: this.profileDetailValue(user, 'Smoking'),
      workout: this.profileDetailValue(user, 'Workout'),
      pets: this.profileDetailValue(user, 'Pets'),
      familyPlans: this.profileDetailValue(user, 'Family plans'),
      children: this.profileDetailValue(user, 'Children'),
      loveStyle: this.profileDetailValue(user, 'Love style'),
      communicationStyle: this.profileDetailValue(user, 'Communication style'),
      sexualOrientation: this.profileDetailValue(user, 'Sexual orientation'),
      religion: this.profileDetailValue(user, 'Religion'),
      values: this.parseCommaValues(this.profileDetailValue(user, 'Values')),
      interests: this.parseCommaValues(this.profileDetailValue(user, 'Interest')),
      experienceEntries: []
    };
  }

  private profileDetailValue(user: UserDto, label: string): string {
    const normalizedLabel = this.normalizeToken(label);
    for (const group of user.profileDetails ?? []) {
      for (const row of group.rows ?? []) {
        if (this.normalizeToken(row.label) === normalizedLabel) {
          return `${row.value ?? ''}`.trim();
        }
      }
    }
    return '';
  }

  private normalizeDraft(draft: ProfileOnboardingDraft): ProfileOnboardingDraft {
    return {
      version: 1,
      userId: `${draft.userId ?? ''}`.trim(),
      currentStepId: this.normalizeStepId(draft.currentStepId),
      updatedAtIso: new Date().toISOString(),
      completedStepIds: this.normalizeStepIds(draft.completedStepIds),
      skippedStepIds: this.normalizeStepIds(draft.skippedStepIds),
      form: {
        fullName: `${draft.form?.fullName ?? ''}`.trim(),
        birthday: this.isIsoDate(draft.form?.birthday ?? '') ? `${draft.form?.birthday}`.trim() : '',
        city: `${draft.form?.city ?? ''}`.trim(),
        heightCm: this.normalizeHeightCm(draft.form?.heightCm),
        physique: `${draft.form?.physique ?? ''}`.trim(),
        languages: this.normalizeStringList(draft.form?.languages),
        images: this.normalizeStringList(draft.form?.images).slice(0, 8),
        headline: `${draft.form?.headline ?? ''}`.trim(),
        about: `${draft.form?.about ?? ''}`.trim().slice(0, 160),
        profileStatus: this.normalizeProfileStatus(draft.form?.profileStatus),
        genderDetail: `${draft.form?.genderDetail ?? ''}`.trim(),
        drinking: `${draft.form?.drinking ?? ''}`.trim(),
        smoking: `${draft.form?.smoking ?? ''}`.trim(),
        workout: `${draft.form?.workout ?? ''}`.trim(),
        pets: `${draft.form?.pets ?? ''}`.trim(),
        familyPlans: `${draft.form?.familyPlans ?? ''}`.trim(),
        children: `${draft.form?.children ?? ''}`.trim(),
        loveStyle: `${draft.form?.loveStyle ?? ''}`.trim(),
        communicationStyle: `${draft.form?.communicationStyle ?? ''}`.trim(),
        sexualOrientation: `${draft.form?.sexualOrientation ?? ''}`.trim(),
        religion: `${draft.form?.religion ?? ''}`.trim(),
        values: this.normalizeStringList(draft.form?.values).slice(0, 5),
        interests: this.normalizeStringList(draft.form?.interests).slice(0, 5),
        experienceEntries: this.normalizeExperienceEntries(draft.form?.experienceEntries ?? [])
      }
    };
  }

  private normalizeExperienceEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return (entries ?? [])
      .map(entry => ({
        id: `${entry?.id ?? ''}`.trim(),
        type: this.normalizeExperienceType(entry?.type),
        title: `${entry?.title ?? ''}`.trim(),
        org: `${entry?.org ?? ''}`.trim(),
        city: `${entry?.city ?? ''}`.trim(),
        dateFrom: `${entry?.dateFrom ?? ''}`.trim(),
        dateTo: `${entry?.dateTo ?? ''}`.trim() || 'Present',
        description: `${entry?.description ?? ''}`.trim()
      }))
      .filter(entry => entry.id && entry.title && entry.org);
  }

  private normalizeExperienceType(value: unknown): ExperienceEntry['type'] {
    return value === 'School'
      || value === 'Online Session'
      || value === 'Additional Project'
      ? value
      : 'Workspace';
  }

  private isBlockedLifecycleUser(user: UserDto): boolean {
    return user.profileStatus === 'blocked' || user.profileStatus === 'deleted' || user.hostTier === 'Admin';
  }

  private resolveProfileFormVersion(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private isProfileEffectivelyEmpty(user: UserDto): boolean {
    const signals = [
      this.hasText(user.name),
      this.isIsoDate(user.birthday),
      this.hasText(user.city),
      (this.parseHeightCm(user.height) ?? 0) > 0,
      this.hasText(user.physique),
      (user.languages ?? []).some(language => this.hasText(language)),
      this.hasText(user.about),
      (user.images ?? []).some(image => this.hasText(image))
    ];
    return signals.filter(Boolean).length <= 2;
  }

  private normalizeStepId(value: unknown): ProfileOnboardingStepId {
    const candidate = `${value ?? ''}`.trim();
    return this.stepIds().includes(candidate as ProfileOnboardingStepId)
      ? candidate as ProfileOnboardingStepId
      : 'basics';
  }

  private normalizeStepIds(values: readonly ProfileOnboardingStepId[] | undefined): ProfileOnboardingStepId[] {
    const allowed = new Set(this.stepIds());
    return [...new Set((values ?? []).filter(stepId => allowed.has(stepId)))];
  }

  private stepIds(): ProfileOnboardingStepId[] {
    return ['basics', 'photos', 'identity', 'about', 'lifestyle', 'values', 'interests', 'experience', 'review'];
  }

  private normalizeProfileStatus(value: unknown): ProfileStatus {
    if (value === 'friends only' || value === 'host only' || value === 'inactive') {
      return value;
    }
    return 'public';
  }

  private normalizeStringList(values: readonly unknown[] | undefined): string[] {
    return [...new Set(
      (values ?? [])
        .map(value => `${value ?? ''}`.trim())
        .filter(value => value.length > 0)
    )];
  }

  private parseCommaValues(value: string): string[] {
    return this.normalizeStringList(value.split(','));
  }

  private normalizeHeightCm(value: unknown): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    const parsed = Math.trunc(Number(value));
    if (parsed <= 0) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private parseHeightCm(value: string | null | undefined): number | null {
    const parsed = Number.parseInt(`${value ?? ''}`.replace(/[^0-9]/g, ''), 10);
    return this.normalizeHeightCm(parsed);
  }

  private isIsoDate(value: string | null | undefined): boolean {
    const normalized = `${value ?? ''}`.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return false;
    }
    const parsed = Date.parse(`${normalized}T00:00:00Z`);
    return Number.isFinite(parsed);
  }

  private hasText(value: unknown): boolean {
    return `${value ?? ''}`.trim().length > 0;
  }

  private normalizeToken(value: unknown): string {
    return `${value ?? ''}`.trim().toLowerCase();
  }

  private storageKey(userId: string): string {
    return `${ProfileOnboardingService.STORAGE_PREFIX}:${userId.trim()}`;
  }

  private readJson<T>(key: string): T | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the runtime draft even when persistent storage is unavailable.
    }
  }
}

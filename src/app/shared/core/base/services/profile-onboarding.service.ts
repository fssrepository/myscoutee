import { Injectable } from '@angular/core';

import type { UserDto } from '../../contracts/user.interface';
import type { ProfileStatus } from '../../common/constants';
import type { ExperienceEntry } from '../../contracts/profile.interface';

export type ProfileOnboardingStepId =
  | 'basics'
  | 'photos'
  | 'lifestyle'
  | 'review';

export interface ProfileOnboardingForm {
  fullName: string;
  birthday: string;
  city: string;
  heightCm: number | null;
  physique: string;
  languages: string[];
  images: string[];
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
  private static readonly MIN_REQUIRED_IMAGES = 3;
  readonly currentProfileFormVersion = 2;

  assessUser(user: UserDto | null | undefined): ProfileOnboardingAssessment {
    if (!user || user.admin === true || this.isBlockedLifecycleUser(user)) {
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

  private requiredMissingKeys(user: UserDto): string[] {
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
    if ((user.images ?? []).filter(image => this.hasText(image)).length < ProfileOnboardingService.MIN_REQUIRED_IMAGES) {
      missing.push('images');
    }
    return missing;
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

  private parseHeightCm(value: string | null | undefined): number | null {
    const parsed = Number.parseInt(`${value ?? ''}`.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
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
}

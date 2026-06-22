import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import {
  I18nPipe,
  ProfileExperienceManagerComponent,
  type ProfileExperienceEntriesChange
} from '../../../shared/ui';
import {
  FormFlowComponent,
  type FormFlowMenuItemSelectEvent,
  type FormFlowModel
} from '../../../shared/ui/components/form-flow';
import {
  UsersService,
  type ProfileOnboardingDraft,
  type UserDto
} from '../../../shared/core';
import type { DetailPrivacy, ProfileStatus } from '../../../shared/core/common/constants';
import type {
  ExperienceEntry,
  ExperienceFilter,
  ProfileDetailFormGroup
} from '../../../shared/core/contracts/profile.interface';
import {
  ProfileOnboardingDraftConverter,
  ProfileOnboardingFormFlowConverter,
  type ProfileOnboardingFormFlowMenuContext
} from '../../../shared/ui/converters';

type OnboardingExperienceSelectorType = Extract<ExperienceEntry['type'], 'Workspace' | 'School'>;

@Component({
  selector: 'app-profile-onboarding-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    FormFlowComponent,
    ProfileExperienceManagerComponent,
    I18nPipe
  ],
  templateUrl: './profile-onboarding-popup.component.html',
  styleUrl: './profile-onboarding-popup.component.scss'
})
export class ProfileOnboardingPopupComponent implements OnChanges, OnDestroy {
  private static readonly MIN_REQUIRED_IMAGES = 3;

  @Input() open = false;
  @Input() user: UserDto | null = null;
  @Input() mobile = false;
  @Input() title = 'Profile setup';
  @Input() message = '';

  @Output() readonly completed = new EventEmitter<UserDto>();
  @Output() readonly dismissed = new EventEmitter<void>();

  private readonly usersService = inject(UsersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private documentScrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyOverscrollBehavior = '';
  private previousDocumentOverflow = '';
  private previousDocumentOverscrollBehavior = '';
  private onboardingFlowModelCacheKey = '';
  private onboardingFlowModelCache: FormFlowModel | null = null;

  protected draft: ProfileOnboardingDraft | null = null;
  protected saving = false;
  protected saveError = '';
  protected experienceManagerOpen = false;
  protected experienceManagerFilter: ExperienceFilter = 'All';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncDocumentScrollLock();
    }
    if (!changes['open'] && !changes['user']) {
      return;
    }
    if (!this.open || !this.user) {
      this.resetPopupState();
      return;
    }
    const nextUserId = this.user.id.trim();
    if (this.draft?.userId === nextUserId) {
      return;
    }
    this.draft = ProfileOnboardingDraftConverter.convert(this.user);
    this.saveError = '';
    this.saving = false;
    this.experienceManagerOpen = false;
    this.experienceManagerFilter = 'All';
    this.clearOnboardingFlowModelCache();
  }

  ngOnDestroy(): void {
    this.unlockDocumentScroll();
  }

  protected get form() {
    return this.draft?.form ?? null;
  }

  protected onboardingFlowModel(): FormFlowModel | null {
    if (!this.draft) {
      this.clearOnboardingFlowModelCache();
      return null;
    }
    const form = this.draft.form;
    const cacheKey = [
      this.draft.userId,
      this.title,
      this.message,
      this.user?.id ?? '',
      form.physique,
      form.genderDetail,
      form.profileStatus,
      form.drinking,
      form.smoking,
      form.workout,
      form.pets,
      form.familyPlans,
      form.children,
      form.loveStyle,
      form.communicationStyle,
      form.sexualOrientation,
      form.religion,
      form.values.join('|'),
      form.interests.join('|'),
      form.experienceEntries
        .map(entry => `${entry.id}:${entry.type}:${entry.title}:${entry.org}:${entry.dateFrom}:${entry.dateTo}`)
        .join('|')
    ].join('\u0001');
    if (this.onboardingFlowModelCache && this.onboardingFlowModelCacheKey === cacheKey) {
      return this.onboardingFlowModelCache;
    }
    this.onboardingFlowModelCacheKey = cacheKey;
    this.onboardingFlowModelCache = ProfileOnboardingFormFlowConverter.convert(this.draft, {
      title: this.title,
      subtitle: this.message,
      userId: this.user?.id ?? ''
    });
    return this.onboardingFlowModelCache;
  }

  protected onOnboardingFlowSave(): void {
    if (!this.draft || this.saving) {
      return;
    }
    this.normalizeDraft();
    void this.saveAndComplete();
  }

  protected onOnboardingFlowMenuItemSelect(event: FormFlowMenuItemSelectEvent): void {
    const context = event.selectEvent.context as ProfileOnboardingFormFlowMenuContext | undefined;
    if (context?.menu === 'experienceSelector') {
      this.openExperienceManager(context.value);
    }
  }

  protected requestDismiss(): void {
    if (this.saving) {
      return;
    }
    this.dismissed.emit();
  }

  protected closeExperienceManager(): void {
    this.experienceManagerOpen = false;
  }

  protected experienceManagerTitle(): string {
    if (this.experienceManagerFilter === 'Workspace') {
      return 'profile.experience.workplace';
    }
    if (this.experienceManagerFilter === 'School') {
      return 'profile.experience.school';
    }
    return 'Experience';
  }

  protected onExperienceManagerEntriesChange(event: ProfileExperienceEntriesChange): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.experienceEntries = event.entries.map(entry => ({ ...entry }));
    this.clearOnboardingFlowModelCache();
    this.cdr.markForCheck();
  }

  private async saveAndComplete(): Promise<void> {
    if (!this.user || !this.draft || this.requiredMissingLabels().length > 0 || this.saving) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    const payload = this.buildUserPayload(this.user, this.draft);
    let completionEmitted = false;
    try {
      const savedUser = await this.usersService.saveUserProfileExt(payload, this.draft.form.experienceEntries);
      if (!savedUser) {
        throw new Error('Profile save returned no user.');
      }
      completionEmitted = true;
      this.completed.emit(savedUser);
    } catch {
      this.saveError = 'Profile could not be saved. Please check the required fields and try again.';
    } finally {
      if (!completionEmitted) {
        this.saving = false;
      }
    }
  }

  private requiredMissingLabels(): string[] {
    if (!this.draft) {
      return [];
    }
    const labels: string[] = [];
    if (!this.draft.form.fullName.trim()) {
      labels.push('Name');
    }
    if (!this.draft.form.birthday.trim()) {
      labels.push('Birthday');
    }
    if (!this.draft.form.city.trim()) {
      labels.push('City');
    }
    if ((this.draft.form.heightCm ?? 0) <= 0) {
      labels.push('Height');
    }
    if (!this.draft.form.physique.trim()) {
      labels.push('Physique');
    }
    if (this.draft.form.languages.length === 0) {
      labels.push('Language');
    }
    if (this.draft.form.images.length < ProfileOnboardingPopupComponent.MIN_REQUIRED_IMAGES) {
      labels.push('3 photos');
    }
    return labels;
  }

  private normalizeDraft(): void {
    if (!this.draft) {
      return;
    }
    this.draft = ProfileOnboardingDraftConverter.convert(this.draft);
    this.clearOnboardingFlowModelCache();
  }

  private resetPopupState(): void {
    this.draft = null;
    this.saveError = '';
    this.saving = false;
    this.experienceManagerOpen = false;
    this.experienceManagerFilter = 'All';
    this.clearOnboardingFlowModelCache();
  }

  private openExperienceManager(type: OnboardingExperienceSelectorType): void {
    if (this.saving) {
      return;
    }
    this.experienceManagerFilter = type;
    this.experienceManagerOpen = true;
  }

  private clearOnboardingFlowModelCache(): void {
    this.onboardingFlowModelCacheKey = '';
    this.onboardingFlowModelCache = null;
  }

  private buildUserPayload(user: UserDto, draft: ProfileOnboardingDraft): UserDto {
    const birthdayDate = AppUtils.fromIsoDate(draft.form.birthday);
    const name = draft.form.fullName.trim();
    const birthday = birthdayDate ? AppUtils.toIsoDate(birthdayDate) : draft.form.birthday.trim();
    return {
      ...user,
      name,
      initials: AppUtils.initialsFromText(name),
      birthday,
      age: AppUtils.ageFromIsoDate(birthday, user.age),
      city: draft.form.city.trim(),
      height: `${draft.form.heightCm ?? 0} cm`,
      physique: draft.form.physique.trim(),
      languages: [...draft.form.languages],
      horoscope: birthdayDate ? AppUtils.horoscopeByDate(birthdayDate) : user.horoscope,
      headline: `${user.headline ?? ''}`.trim(),
      about: draft.form.about.trim().slice(0, 160),
      images: [...draft.form.images],
      profileStatus: draft.form.profileStatus,
      profileFormVersion: ProfileOnboardingDraftConverter.currentProfileFormVersion,
      profileDetails: this.buildProfileDetails(user, draft),
      completion: this.completionPercent(draft)
    };
  }

  private buildProfileDetails(user: UserDto, draft: ProfileOnboardingDraft): ProfileDetailFormGroup[] {
    const form = draft.form;
    const basicValues: Record<string, string> = {
      'profile.name': form.fullName.trim(),
      'profile.city': form.city.trim(),
      'profile.birthday': this.formatDateForDetail(form.birthday),
      'profile.height': `${form.heightCm ?? 0} cm`,
      'profile.physique': form.physique.trim(),
      'profile.languages': form.languages.join(', '),
      'profile.horoscope': AppUtils.fromIsoDate(form.birthday)
        ? AppUtils.horoscopeByDate(AppUtils.fromIsoDate(form.birthday) as Date)
        : '',
      'profile.gender': form.genderDetail.trim()
    };
    const optionalValues: Record<string, string> = {
      'profile.details.interest': form.interests.join(', '),
      'profile.details.drinking': form.drinking,
      'profile.details.smoking': form.smoking,
      'profile.details.workout': form.workout,
      'profile.details.pets': form.pets,
      'profile.details.familyPlans': form.familyPlans,
      'profile.details.children': form.children,
      'profile.details.loveStyle': form.loveStyle,
      'profile.details.communicationStyle': form.communicationStyle,
      'profile.details.sexualOrientation': form.sexualOrientation,
      'profile.details.religion': form.religion,
      'profile.details.values': form.values.join(', ')
    };
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        labelKey: row.labelKey,
        value: basicValues[row.labelKey] ?? optionalValues[row.labelKey] ?? this.existingDetailValue(user, row.labelKey),
        privacy: this.existingDetailPrivacy(user, row.labelKey, row.privacy),
        options: this.detailOptionsForRow(row.labelKey)
      }))
    }));
  }

  private detailOptionsForRow(labelKey: string): string[] {
    if (labelKey === 'profile.details.values') {
      return APP_STATIC_DATA.beliefsValuesOptionGroups.flatMap(group => group.options);
    }
    if (labelKey === 'profile.details.interest') {
      return APP_STATIC_DATA.interestOptionGroups.flatMap(group => group.options);
    }
    return APP_STATIC_DATA.profileDetailValueOptions[labelKey] ?? [];
  }

  private existingDetailValue(user: UserDto, labelKey: string): string {
    const target = AppUtils.normalizeText(labelKey);
    for (const group of user.profileDetails ?? []) {
      const row = (group.rows ?? []).find(candidate => AppUtils.normalizeText(candidate.labelKey) === target);
      if (row) {
        return row.value;
      }
    }
    return '';
  }

  private existingDetailPrivacy(user: UserDto, labelKey: string, fallback: DetailPrivacy): DetailPrivacy {
    const target = AppUtils.normalizeText(labelKey);
    for (const group of user.profileDetails ?? []) {
      const row = (group.rows ?? []).find(candidate => AppUtils.normalizeText(candidate.labelKey) === target);
      if (row && this.isDetailPrivacy(row.privacy)) {
        return row.privacy;
      }
    }
    return fallback;
  }

  private isDetailPrivacy(value: string): value is DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  private completionPercent(draft: ProfileOnboardingDraft): number {
    let completed = 0;
    let total = 0;
    const add = (ok: boolean): void => {
      total += 1;
      if (ok) {
        completed += 1;
      }
    };
    add(Boolean(draft.form.fullName.trim()));
    add(Boolean(draft.form.birthday.trim()));
    add(Boolean(draft.form.city.trim()));
    add((draft.form.heightCm ?? 0) > 0);
    add(Boolean(draft.form.physique.trim()));
    add(draft.form.languages.length > 0);
    add(draft.form.images.length >= ProfileOnboardingPopupComponent.MIN_REQUIRED_IMAGES);
    add(draft.form.about.trim().length >= 20);
    add(draft.form.values.length > 0);
    add(draft.form.interests.length > 0);
    add(draft.form.experienceEntries.length > 0);
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }

  private formatDateForDetail(value: string): string {
    const parsed = AppUtils.fromIsoDate(value);
    return parsed
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  }

  private syncDocumentScrollLock(): void {
    if (this.open) {
      this.lockDocumentScroll();
      return;
    }
    this.unlockDocumentScroll();
  }

  private lockDocumentScroll(): void {
    if (this.documentScrollLocked) {
      return;
    }
    const body = this.document.body;
    const documentElement = this.document.documentElement;
    if (!body || !documentElement) {
      return;
    }
    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    this.previousDocumentOverflow = documentElement.style.overflow;
    this.previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    this.documentScrollLocked = true;
  }

  private unlockDocumentScroll(): void {
    if (!this.documentScrollLocked) {
      return;
    }
    const body = this.document.body;
    const documentElement = this.document.documentElement;
    if (body) {
      body.style.overflow = this.previousBodyOverflow;
      body.style.overscrollBehavior = this.previousBodyOverscrollBehavior;
    }
    if (documentElement) {
      documentElement.style.overflow = this.previousDocumentOverflow;
      documentElement.style.overscrollBehavior = this.previousDocumentOverscrollBehavior;
    }
    this.documentScrollLocked = false;
  }
}

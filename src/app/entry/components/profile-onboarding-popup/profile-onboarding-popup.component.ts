import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AppCalendarDateAdapter, AppCalendarDateFormats } from '../../../shared/app-calendar-date-adapter';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import {
  ProfileOnboardingService,
  UserExperiencesService,
  UsersService,
  type ProfileOnboardingAssessment,
  type ProfileOnboardingDraft,
  type ProfileOnboardingStepId,
  type UserDto
} from '../../../shared/core';
import type {
  DetailPrivacy,
  ExperienceEntry,
  ProfileDetailFormGroup,
  ProfileStatus
} from '../../../shared/core/base/models/profile.model';

interface OnboardingStep {
  id: ProfileOnboardingStepId;
  title: string;
  optional: boolean;
}

type ExperienceFormDraft = Omit<ExperienceEntry, 'id'> & { current: boolean };

@Component({
  selector: 'app-profile-onboarding-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule
  ],
  providers: [
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateOnly }
  ],
  templateUrl: './profile-onboarding-popup.component.html',
  styleUrl: './profile-onboarding-popup.component.scss'
})
export class ProfileOnboardingPopupComponent implements OnChanges, OnDestroy {
  private static readonly DEMO_SAVE_MIN_BUSY_MS = 1500;
  private static readonly MAX_IMAGE_SLOTS = 8;
  private static readonly LANGUAGE_PANEL_GAP_PX = 8;
  private static readonly LANGUAGE_PANEL_MAX_HEIGHT_PX = 260;

  @ViewChild('onboardingImageInput') private onboardingImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('languageSelectRoot', { read: ElementRef }) private languageSelectRoot?: ElementRef<HTMLElement>;
  @Input() open = false;
  @Input() user: UserDto | null = null;
  @Input() mobile = false;

  @Output() readonly completed = new EventEmitter<UserDto>();
  @Output() readonly dismissed = new EventEmitter<void>();

  private readonly onboarding = inject(ProfileOnboardingService);
  private readonly usersService = inject(UsersService);
  private readonly userExperiencesService = inject(UserExperiencesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private experienceLoadToken = 0;
  private documentScrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyOverscrollBehavior = '';
  private previousDocumentOverflow = '';
  private previousDocumentOverscrollBehavior = '';

  protected readonly steps: OnboardingStep[] = [
    { id: 'basics', title: 'Basics', optional: false },
    { id: 'photos', title: 'Photos', optional: true },
    { id: 'identity', title: 'Identity', optional: true },
    { id: 'about', title: 'About', optional: true },
    { id: 'lifestyle', title: 'Lifestyle', optional: true },
    { id: 'values', title: 'Values', optional: true },
    { id: 'interests', title: 'Interests', optional: true },
    { id: 'experience', title: 'Experience', optional: true },
    { id: 'review', title: 'Review', optional: false }
  ];
  protected readonly physiqueOptions = APP_STATIC_DATA.physiqueOptions;
  protected readonly languageSuggestions = APP_STATIC_DATA.languageSuggestions;
  protected languagePanelWidth = '320px';
  protected readonly profileStatusOptions = APP_STATIC_DATA.profileStatusOptions;
  protected readonly profileDetailValueOptions = APP_STATIC_DATA.profileDetailValueOptions;
  protected readonly beliefsValuesOptionGroups = APP_STATIC_DATA.beliefsValuesOptionGroups;
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;
  protected readonly experienceTypeOptions = APP_STATIC_DATA.experienceTypeOptions;
  protected readonly saveRingPerimeter = 100;

  protected draft: ProfileOnboardingDraft | null = null;
  protected assessment: ProfileOnboardingAssessment | null = null;
  protected birthdayDate: Date | null = null;
  protected saving = false;
  protected saveError = '';
  protected imageUploadError = '';
  protected attemptedContinue = false;
  protected experienceFormVisible = false;
  protected experienceForm: ExperienceFormDraft = this.createEmptyExperienceForm();
  protected experienceRangeStart: Date | null = null;
  protected experienceRangeEnd: Date | null = null;
  protected imageSlots: Array<string | null> = this.createEmptyImageSlots();
  protected selectedImageIndex = 0;
  protected pendingImageUploadIndex: number | null = null;
  protected uploadingImageSlotIndex: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncDocumentScrollLock();
    }
    if (!changes['open'] && !changes['user']) {
      return;
    }
    if (!this.open || !this.user) {
      this.clearLanguagePanelPosition();
      this.draft = null;
      this.assessment = null;
      this.birthdayDate = null;
      this.saveError = '';
      this.imageUploadError = '';
      this.saving = false;
      this.attemptedContinue = false;
      this.experienceFormVisible = false;
      this.experienceRangeStart = null;
      this.experienceRangeEnd = null;
      this.experienceLoadToken += 1;
      this.imageSlots = this.createEmptyImageSlots();
      this.selectedImageIndex = 0;
      this.pendingImageUploadIndex = null;
      this.uploadingImageSlotIndex = null;
      return;
    }
    this.assessment = this.onboarding.assessUser(this.user);
    this.draft = this.onboarding.loadDraft(this.user);
    this.syncBirthdayDateFromDraft();
    this.syncImageSlotsFromDraft();
    this.scheduleLanguagePanelWidthSync();
    this.loadExistingExperienceEntries(this.user.id);
  }

  ngOnDestroy(): void {
    this.clearLanguagePanelPosition();
    this.unlockDocumentScroll();
  }

  protected get form() {
    return this.draft?.form ?? null;
  }

  protected currentStep(): OnboardingStep {
    const stepId = this.draft?.currentStepId ?? 'basics';
    return this.steps.find(step => step.id === stepId) ?? this.steps[0];
  }

  protected currentStepIndex(): number {
    const stepId = this.currentStep().id;
    return Math.max(0, this.steps.findIndex(step => step.id === stepId));
  }

  protected progressPercent(): number {
    return Math.round(((this.currentStepIndex() + 1) / this.steps.length) * 100);
  }

  protected requiredMissingLabels(): string[] {
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
    if (!this.hasLanguageReady()) {
      labels.push('Language');
    }
    return labels;
  }

  protected canContinue(): boolean {
    if (!this.draft || this.saving || this.uploadingImageSlotIndex !== null) {
      return false;
    }
    if (this.currentStep().id === 'basics') {
      return this.requiredMissingLabels().length === 0;
    }
    if (this.currentStep().id === 'review') {
      return this.requiredMissingLabels().length === 0;
    }
    return true;
  }

  protected primaryActionLabel(): string {
    if (this.saving) {
      return 'Saving';
    }
    return this.currentStep().id === 'review' ? 'Save' : 'Next';
  }

  protected requestDismiss(): void {
    if (this.saving || this.uploadingImageSlotIndex !== null) {
      return;
    }
    this.dismissed.emit();
  }

  protected persistDraft(): void {
    if (!this.draft) {
      return;
    }
    this.onboarding.saveDraft(this.draft);
  }

  protected goBack(): void {
    if (!this.draft || this.saving || this.uploadingImageSlotIndex !== null) {
      return;
    }
    const index = this.currentStepIndex();
    if (index <= 0) {
      return;
    }
    this.setStep(this.steps[index - 1].id);
  }

  protected skipStep(): void {
    if (!this.draft || !this.currentStep().optional || this.saving || this.uploadingImageSlotIndex !== null) {
      return;
    }
    const current = this.currentStep().id;
    this.draft.skippedStepIds = [...new Set([...this.draft.skippedStepIds, current])];
    this.goNext();
  }

  protected goNext(): void {
    if (!this.draft || this.saving || this.uploadingImageSlotIndex !== null) {
      return;
    }
    this.attemptedContinue = true;
    if (!this.canContinue()) {
      this.persistDraft();
      return;
    }
    const current = this.currentStep().id;
    this.draft.completedStepIds = [...new Set([...this.draft.completedStepIds, current])];
    if (current === 'review') {
      void this.saveAndComplete();
      return;
    }
    const nextStep = this.steps[Math.min(this.steps.length - 1, this.currentStepIndex() + 1)];
    this.setStep(nextStep.id);
  }

  protected onLanguagesChange(values: string[] | string | null): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.languages = this.normalizeSelectedLanguages(values);
    this.persistDraft();
    this.syncLanguagePanelPosition();
    this.cdr.detectChanges();
  }

  protected onLanguageSelectOpened(opened: boolean): void {
    if (opened) {
      this.syncLanguagePanelPosition();
      this.scheduleLanguagePanelWidthSync();
      return;
    }
    this.clearLanguagePanelPosition();
  }

  protected removeLanguage(value: string): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.languages = this.draft.form.languages.filter(language => language !== value);
    this.persistDraft();
    this.cdr.detectChanges();
  }

  protected onBirthdayDateChange(value: Date | string | null): void {
    if (!this.draft) {
      return;
    }
    const candidate = value instanceof Date
      ? value
      : AppUtils.fromIsoDate(`${value ?? ''}`.trim());
    const parsed = candidate && Number.isFinite(candidate.getTime()) ? candidate : null;
    this.birthdayDate = parsed;
    this.draft.form.birthday = parsed ? AppUtils.toIsoDate(parsed) : '';
    this.persistDraft();
  }

  protected selectedImagePreview(): string | null {
    return this.imageSlots[this.selectedImageIndex] ?? null;
  }

  protected imageCount(): number {
    return this.imageSlots.filter(slot => Boolean(slot?.trim())).length;
  }

  protected selectImageSlot(index: number): void {
    if (this.uploadingImageSlotIndex !== null || this.saving) {
      return;
    }
    const isSelectedSlot = this.selectedImageIndex === index;
    const hasImage = Boolean(this.imageSlots[index]);
    this.selectedImageIndex = index;
    if (hasImage && !isSelectedSlot) {
      return;
    }
    this.pendingImageUploadIndex = index;
    this.onboardingImageInput?.nativeElement.click();
  }

  protected removeImage(index: number): void {
    if (this.uploadingImageSlotIndex === index || this.saving) {
      return;
    }
    this.revokeObjectUrl(this.imageSlots[index]);
    this.imageSlots[index] = null;
    this.syncDraftImagesFromSlots();
    if (this.selectedImageIndex === index) {
      const nearest = this.findNearestFilledImageIndex(index);
      this.selectedImageIndex = nearest >= 0 ? nearest : 0;
    }
  }

  protected onImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;
    const slotIndex = this.pendingImageUploadIndex;
    this.pendingImageUploadIndex = null;
    target.value = '';
    if (!file || slotIndex === null) {
      return;
    }
    void this.uploadAndRefreshProfileImageSlot(file, slotIndex);
  }

  protected isImageSlotUploading(index: number): boolean {
    return this.uploadingImageSlotIndex === index;
  }

  protected isSelectedImageUploading(): boolean {
    return this.uploadingImageSlotIndex !== null && this.uploadingImageSlotIndex === this.selectedImageIndex;
  }

  protected reviewValue(value: string | number | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    return normalized || 'Not set';
  }

  protected reviewList(values: readonly string[] | null | undefined): string {
    const normalized = (values ?? [])
      .map(value => `${value ?? ''}`.trim())
      .filter(value => value.length > 0);
    return normalized.length > 0 ? normalized.join(', ') : 'Not set';
  }

  private hasLanguageReady(): boolean {
    return Boolean(this.draft?.form.languages.length);
  }

  private scheduleLanguagePanelWidthSync(): void {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.syncLanguagePanelPosition());
      return;
    }
    setTimeout(() => this.syncLanguagePanelPosition(), 0);
  }

  protected syncLanguagePanelWidth(): void {
    this.syncLanguagePanelPosition();
  }

  protected syncLanguagePanelPosition(): void {
    const host = this.languageSelectRoot?.nativeElement;
    if (!host) {
      return;
    }
    const hostRect = host.getBoundingClientRect();
    const panelRect = host.closest('.profile-onboarding-panel')?.getBoundingClientRect();
    const viewportWidth = this.document.defaultView?.innerWidth ?? this.document.documentElement.clientWidth;
    const viewportHeight = this.document.defaultView?.innerHeight ?? this.document.documentElement.clientHeight;
    const horizontalInset = this.mobile ? 12 : 16;
    const panelLeft = panelRect?.left ?? horizontalInset;
    const panelTop = panelRect?.top ?? horizontalInset;
    const panelWidth = panelRect?.width ?? Math.max(0, viewportWidth - (horizontalInset * 2));
    const viewportInset = this.mobile ? 10 : 12;
    const maxPanelWidth = Math.max(180, Math.min(panelWidth - (horizontalInset * 2), viewportWidth - (viewportInset * 2)));
    const minWidth = Math.min(this.mobile ? 260 : 320, maxPanelWidth);
    const width = Math.floor(Math.max(minWidth, Math.min(hostRect.width, maxPanelWidth)));
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    const minTop = Math.max(8, panelTop + 8);
    const availableAboveInput = hostRect.top - minTop - ProfileOnboardingPopupComponent.LANGUAGE_PANEL_GAP_PX;
    const maxHeightLimit = Math.min(
      ProfileOnboardingPopupComponent.LANGUAGE_PANEL_MAX_HEIGHT_PX,
      Math.max(120, viewportHeight * 0.42)
    );
    const maxHeight = Math.floor(Math.min(maxHeightLimit, Math.max(120, availableAboveInput)));
    const centeredLeft = panelLeft + ((panelWidth - width) / 2);
    const left = Math.round(this.clamp(centeredLeft, viewportInset, viewportWidth - width - viewportInset));
    const preferredTop = hostRect.top - maxHeight - ProfileOnboardingPopupComponent.LANGUAGE_PANEL_GAP_PX;
    const top = Math.round(
      this.clamp(preferredTop, minTop, Math.max(minTop, viewportHeight - maxHeight - 8))
    );
    const rootStyle = this.document.documentElement.style;
    rootStyle.setProperty('--profile-onboarding-language-panel-left', `${left}px`);
    rootStyle.setProperty('--profile-onboarding-language-panel-top', `${top}px`);
    rootStyle.setProperty('--profile-onboarding-language-panel-width', `${width}px`);
    rootStyle.setProperty('--profile-onboarding-language-panel-max-height', `${maxHeight}px`);
    const nextWidth = `${width}px`;
    if (this.languagePanelWidth !== nextWidth) {
      this.languagePanelWidth = nextWidth;
      this.cdr.detectChanges();
    }
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  private clearLanguagePanelPosition(): void {
    const rootStyle = this.document.documentElement.style;
    rootStyle.removeProperty('--profile-onboarding-language-panel-left');
    rootStyle.removeProperty('--profile-onboarding-language-panel-top');
    rootStyle.removeProperty('--profile-onboarding-language-panel-width');
    rootStyle.removeProperty('--profile-onboarding-language-panel-max-height');
  }

  private syncBirthdayDateFromDraft(): void {
    this.birthdayDate = AppUtils.fromIsoDate(this.draft?.form.birthday ?? '');
  }

  protected toggleValue(option: string): void {
    this.toggleLimitedOption('values', option, this.beliefsValuesAllOptions());
  }

  protected toggleInterest(option: string): void {
    this.toggleLimitedOption('interests', option, this.interestAllOptions());
  }

  protected removeValueOption(option: string): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.values = this.draft.form.values.filter(item => item !== option);
    this.persistDraft();
  }

  protected removeInterestOption(option: string): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.interests = this.draft.form.interests.filter(item => item !== option);
    this.persistDraft();
  }

  protected clearValues(): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.values = [];
    this.persistDraft();
  }

  protected clearInterests(): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.interests = [];
    this.persistDraft();
  }

  protected isValueSelected(option: string): boolean {
    return this.draft?.form.values.includes(option) ?? false;
  }

  protected isInterestSelected(option: string): boolean {
    return this.draft?.form.interests.includes(option) ?? false;
  }

  protected profileSelectorToneIcon(toneClass: string): string {
    switch (toneClass) {
      case 'section-family':
        return 'family_restroom';
      case 'section-ambition':
        return 'rocket_launch';
      case 'section-lifestyle':
        return 'eco';
      case 'section-beliefs':
        return 'auto_awesome';
      case 'section-social':
        return 'celebration';
      case 'section-arts':
        return 'palette';
      case 'section-food':
        return 'restaurant';
      case 'section-active':
        return 'hiking';
      case 'section-mind':
        return 'self_improvement';
      case 'section-identity':
        return 'public';
      default:
        return 'label';
    }
  }

  protected openExperienceForm(): void {
    if (this.saving) {
      return;
    }
    this.experienceForm = this.createEmptyExperienceForm();
    this.experienceRangeStart = null;
    this.experienceRangeEnd = null;
    this.experienceFormVisible = true;
  }

  protected closeExperienceForm(): void {
    this.experienceFormVisible = false;
    this.experienceForm = this.createEmptyExperienceForm();
    this.experienceRangeStart = null;
    this.experienceRangeEnd = null;
  }

  protected canAddExperience(): boolean {
    return Boolean(
      this.experienceForm.title.trim()
      && this.experienceForm.org.trim()
      && this.experienceRangeStart
    );
  }

  protected addExperienceEntry(): void {
    if (!this.draft || !this.canAddExperience()) {
      return;
    }
    const entry: ExperienceEntry = {
      id: this.createExperienceId(),
      type: this.experienceForm.type,
      title: this.experienceForm.title.trim(),
      org: this.experienceForm.org.trim(),
      city: this.experienceForm.city.trim(),
      dateFrom: AppUtils.toYearMonth(this.experienceRangeStart),
      dateTo: this.experienceRangeEnd ? AppUtils.toYearMonth(this.experienceRangeEnd) : 'Present',
      description: this.experienceForm.description.trim()
    };
    this.draft.form.experienceEntries = [...this.draft.form.experienceEntries, entry];
    this.closeExperienceForm();
    this.persistDraft();
  }

  protected removeExperienceEntry(entryId: string): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.experienceEntries = this.draft.form.experienceEntries.filter(entry => entry.id !== entryId);
    this.persistDraft();
  }

  protected statusIcon(status: ProfileStatus): string {
    return this.profileStatusOptions.find(option => option.value === status)?.icon ?? 'public';
  }

  protected stepDone(stepId: ProfileOnboardingStepId): boolean {
    return this.draft?.completedStepIds.includes(stepId) ?? false;
  }

  protected stepSkipped(stepId: ProfileOnboardingStepId): boolean {
    return this.draft?.skippedStepIds.includes(stepId) ?? false;
  }

  protected detailOptions(label: string): string[] {
    return this.profileDetailValueOptions[label] ?? [];
  }

  protected basicsErrorVisible(): boolean {
    return this.attemptedContinue && this.currentStep().id === 'basics' && this.requiredMissingLabels().length > 0;
  }

  private async saveAndComplete(): Promise<void> {
    if (!this.user || !this.draft || !this.canContinue()) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.persistDraft();
    const payload = this.buildUserPayload(this.user, this.draft);
    try {
      const savedUser = await this.usersService.saveUserProfile(payload, {
        requestTimeoutMs: 8000,
        minimumDurationMs: this.usersService.demoModeEnabled ? ProfileOnboardingPopupComponent.DEMO_SAVE_MIN_BUSY_MS : 0,
        returnFallbackOnFailure: false
      });
      if (!savedUser) {
        throw new Error('Profile save returned no user.');
      }
      if (this.draft.form.experienceEntries.length > 0) {
        await this.userExperiencesService.saveUserExperiences(savedUser.id, this.draft.form.experienceEntries);
      }
      this.onboarding.clearDraft(savedUser.id);
      this.completed.emit(savedUser);
    } catch {
      this.saveError = 'Profile could not be saved. Please check the required fields and try again.';
    } finally {
      this.saving = false;
    }
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
      headline: draft.form.headline.trim(),
      about: draft.form.about.trim().slice(0, 160),
      images: this.collectPersistedProfileImages(draft.form.images),
      profileStatus: draft.form.profileStatus,
      profileFormVersion: this.onboarding.currentProfileFormVersion,
      profileDetails: this.buildProfileDetails(user, draft),
      completion: this.completionPercent(draft)
    };
  }

  private buildProfileDetails(user: UserDto, draft: ProfileOnboardingDraft): ProfileDetailFormGroup[] {
    const form = draft.form;
    const basicValues: Record<string, string> = {
      Name: form.fullName.trim(),
      City: form.city.trim(),
      Birthday: this.formatDateForDetail(form.birthday),
      Height: `${form.heightCm ?? 0} cm`,
      Physique: form.physique.trim(),
      Languages: form.languages.join(', '),
      Horoscope: AppUtils.fromIsoDate(form.birthday)
        ? AppUtils.horoscopeByDate(AppUtils.fromIsoDate(form.birthday) as Date)
        : '',
      Gender: form.genderDetail.trim()
    };
    const optionalValues: Record<string, string> = {
      Interest: form.interests.join(', '),
      Drinking: form.drinking,
      Smoking: form.smoking,
      Workout: form.workout,
      Pets: form.pets,
      'Family plans': form.familyPlans,
      Children: form.children,
      'Love style': form.loveStyle,
      'Communication style': form.communicationStyle,
      'Sexual orientation': form.sexualOrientation,
      Religion: form.religion,
      Values: form.values.join(', ')
    };
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        label: row.label,
        value: basicValues[row.label] ?? optionalValues[row.label] ?? this.existingDetailValue(user, row.label),
        privacy: this.existingDetailPrivacy(user, row.label, row.privacy),
        options: this.detailOptionsForRow(row.label)
      }))
    }));
  }

  private detailOptionsForRow(label: string): string[] {
    if (label === 'Values') {
      return this.beliefsValuesAllOptions();
    }
    if (label === 'Interest') {
      return this.interestAllOptions();
    }
    return this.profileDetailValueOptions[label] ?? [];
  }

  private existingDetailValue(user: UserDto, label: string): string {
    const target = AppUtils.normalizeText(label);
    for (const group of user.profileDetails ?? []) {
      const row = (group.rows ?? []).find(candidate => AppUtils.normalizeText(candidate.label) === target);
      if (row) {
        return row.value;
      }
    }
    return '';
  }

  private existingDetailPrivacy(user: UserDto, label: string, fallback: DetailPrivacy): DetailPrivacy {
    const target = AppUtils.normalizeText(label);
    for (const group of user.profileDetails ?? []) {
      const row = (group.rows ?? []).find(candidate => AppUtils.normalizeText(candidate.label) === target);
      if (row && this.isDetailPrivacy(row.privacy)) {
        return row.privacy;
      }
    }
    return fallback;
  }

  private isDetailPrivacy(value: string): value is DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  protected setStep(stepId: ProfileOnboardingStepId): void {
    if (!this.draft || this.uploadingImageSlotIndex !== null) {
      return;
    }
    this.draft.currentStepId = stepId;
    this.attemptedContinue = false;
    this.persistDraft();
  }

  private toggleLimitedOption(kind: 'values' | 'interests', option: string, allowed: string[]): void {
    if (!this.draft || !allowed.includes(option)) {
      return;
    }
    const current = this.draft.form[kind];
    this.draft.form[kind] = current.includes(option)
      ? current.filter(item => item !== option)
      : [...current, option].slice(0, 5);
    this.persistDraft();
  }

  private async loadExistingExperienceEntries(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !this.draft) {
      return;
    }
    const token = ++this.experienceLoadToken;
    try {
      const entries = await this.userExperiencesService.loadUserExperiences(normalizedUserId);
      if (token !== this.experienceLoadToken || !this.draft || this.draft.userId !== normalizedUserId) {
        return;
      }
      if (this.draft.form.experienceEntries.length === 0 && entries.length > 0) {
        this.draft.form.experienceEntries = entries.map(entry => ({ ...entry }));
        this.persistDraft();
      }
    } catch {
      // Experience is optional, so onboarding can continue without this enrichment.
    }
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
    add(draft.form.images.length > 0);
    add(draft.form.about.trim().length >= 20);
    add(draft.form.values.length > 0);
    add(draft.form.interests.length > 0);
    add(draft.form.experienceEntries.length > 0);
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
  }

  private createEmptyImageSlots(): Array<string | null> {
    return Array.from({ length: ProfileOnboardingPopupComponent.MAX_IMAGE_SLOTS }, () => null);
  }

  private syncImageSlotsFromDraft(): void {
    const slots = this.createEmptyImageSlots();
    const images = (this.draft?.form.images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .filter(image => image.length > 0)
      .slice(0, ProfileOnboardingPopupComponent.MAX_IMAGE_SLOTS);
    images.forEach((image, index) => {
      slots[index] = image;
    });
    this.imageSlots = slots;
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    this.selectedImageIndex = firstFilled >= 0 ? firstFilled : 0;
  }

  private syncDraftImagesFromSlots(): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.images = this.collectPersistedProfileImages(this.imageSlots);
    this.persistDraft();
    this.cdr.detectChanges();
  }

  private collectPersistedProfileImages(values: readonly (string | null)[] = []): string[] {
    const images: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = `${value ?? ''}`.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      images.push(normalized);
      seen.add(normalized);
      if (images.length >= ProfileOnboardingPopupComponent.MAX_IMAGE_SLOTS) {
        break;
      }
    }
    return images;
  }

  private findNearestFilledImageIndex(fromIndex: number): number {
    for (let distance = 1; distance < this.imageSlots.length; distance += 1) {
      const right = fromIndex + distance;
      if (right < this.imageSlots.length && this.imageSlots[right]) {
        return right;
      }
      const left = fromIndex - distance;
      if (left >= 0 && this.imageSlots[left]) {
        return left;
      }
    }
    return this.imageSlots.findIndex(slot => Boolean(slot));
  }

  private async uploadAndRefreshProfileImageSlot(file: File, slotIndex: number): Promise<void> {
    if (!this.user || !this.draft) {
      return;
    }
    if (!file.type.toLowerCase().startsWith('image/')) {
      this.imageUploadError = 'Please choose an image file.';
      return;
    }
    const previousImage = this.imageSlots[slotIndex] ?? null;
    this.uploadingImageSlotIndex = slotIndex;
    this.imageUploadError = '';
    this.cdr.detectChanges();
    try {
      this.syncDraftImagesFromSlots();
      const uploadResult = await this.usersService.uploadUserProfileImage(this.user.id, file, slotIndex);
      if (!uploadResult.uploaded) {
        throw new Error('Upload failed.');
      }
      const verifiedImageUrl = await this.reloadUploadedImageUrl(this.user.id, slotIndex, uploadResult.imageUrl);
      if (!verifiedImageUrl) {
        throw new Error('Uploaded image was not available.');
      }
      this.revokeObjectUrl(previousImage);
      this.imageSlots[slotIndex] = verifiedImageUrl;
      this.selectedImageIndex = this.resolveSelectedImageIndexAfterUpload(slotIndex);
      this.syncDraftImagesFromSlots();
    } catch {
      this.imageUploadError = 'Image could not be uploaded. Please try another image.';
    } finally {
      this.uploadingImageSlotIndex = null;
      this.cdr.detectChanges();
    }
  }

  private async reloadUploadedImageUrl(
    userId: string,
    slotIndex: number,
    uploadedImageUrl: string | null
  ): Promise<string | null> {
    if (uploadedImageUrl?.trim()) {
      return uploadedImageUrl.trim();
    }
    const loadedUser = await this.usersService.loadUserById(userId, 2500);
    const loadedImages = (loadedUser?.images ?? [])
      .map(image => image.trim())
      .filter(image => image.length > 0);
    return loadedImages[slotIndex] ?? loadedImages[loadedImages.length - 1] ?? null;
  }

  private resolveSelectedImageIndexAfterUpload(slotIndex: number): number {
    if (slotIndex >= 0 && slotIndex < this.imageSlots.length && this.imageSlots[slotIndex]) {
      return slotIndex;
    }
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    return firstFilled >= 0 ? firstFilled : 0;
  }

  private revokeObjectUrl(value: string | null): void {
    if (value && value.startsWith('blob:') && typeof URL !== 'undefined') {
      URL.revokeObjectURL(value);
    }
  }

  private formatDateForDetail(value: string): string {
    const parsed = AppUtils.fromIsoDate(value);
    return parsed
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  }

  private createEmptyExperienceForm(): ExperienceFormDraft {
    return {
      type: 'Workspace',
      title: '',
      org: '',
      city: '',
      dateFrom: '',
      dateTo: '',
      current: true,
      description: ''
    };
  }

  private createExperienceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `exp-${crypto.randomUUID()}`;
    }
    return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeSelectedLanguages(values: string[] | string | null): string[] {
    const rawValues = Array.isArray(values) ? values : values ? [values] : [];
    const selected = new Set(rawValues.map(value => value.trim().toLowerCase()).filter(Boolean));
    return this.languageSuggestions.filter(language => selected.has(language.trim().toLowerCase()));
  }
}

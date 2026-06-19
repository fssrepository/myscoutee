import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AppCalendarDateAdapter, AppCalendarDateFormats } from '../../../shared/app-calendar-date-adapter';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import {
  AppMenuComponent,
  EditableImageCarouselComponent,
  I18nPipe,
  ProfileExperienceManagerComponent,
  buildTabbedMenuModel,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  type ProfileExperienceEntriesChange
} from '../../../shared/ui';
import {
  ProfileOnboardingService,
  UsersService,
  type ProfileOnboardingAssessment,
  type ProfileOnboardingDraft,
  type ProfileOnboardingStepId,
  type UserDto,
  type UserExperiencesRouteConfig
} from '../../../shared/core';
import type {
  DetailPrivacy,
  ProfileStatus
} from '../../../shared/core/common/constants';
import type {
  ExperienceEntry,
  ExperienceFilter,
  ProfileDetailFormGroup
} from '../../../shared/core/contracts/profile.interface';

interface OnboardingStep {
  id: ProfileOnboardingStepId;
  title: string;
  optional: boolean;
}

type OnboardingExperienceSelectorType = Extract<ExperienceEntry['type'], 'Workspace' | 'School'>;

type OnboardingMenuField =
  | 'physique'
  | 'profileStatus'
  | 'genderDetail'
  | 'drinking'
  | 'smoking'
  | 'workout'
  | 'pets'
  | 'familyPlans'
  | 'children'
  | 'loveStyle'
  | 'communicationStyle'
  | 'sexualOrientation'
  | 'religion';

type OnboardingMenuContext =
  | { menu: 'field'; field: OnboardingMenuField; value: string }
  | { menu: 'experienceSelector'; value: OnboardingExperienceSelectorType }
  | { menu: 'languageOption'; value: string }
  | { menu: 'valuesOption'; value: string }
  | { menu: 'interestOption'; value: string }
  | { menu: 'navigation'; action: 'back' | 'skip' | 'next' };

interface ExperienceSelectorMenuSnapshot {
  cacheKey: string;
  entries: ExperienceEntry[];
  value: ExperienceEntry[];
  model: AppMenuModel<string, OnboardingMenuContext>;
}

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
    AppMenuComponent,
    EditableImageCarouselComponent,
    ProfileExperienceManagerComponent,
    I18nPipe
  ],
  providers: [
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateOnly }
  ],
  templateUrl: './profile-onboarding-popup.component.html',
  styleUrl: './profile-onboarding-popup.component.scss'
})
export class ProfileOnboardingPopupComponent implements OnChanges, OnDestroy {
  private static readonly MAX_IMAGE_SLOTS = 8;
  private static readonly MIN_REQUIRED_IMAGES = 3;

  @Input() open = false;
  @Input() user: UserDto | null = null;
  @Input() mobile = false;
  @Input() title = 'Profile setup';
  @Input() message = '';

  @Output() readonly completed = new EventEmitter<UserDto>();
  @Output() readonly dismissed = new EventEmitter<void>();

  private readonly onboarding = inject(ProfileOnboardingService);
  private readonly usersService = inject(UsersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly experienceSelectorMenuCache: Record<OnboardingExperienceSelectorType, ExperienceSelectorMenuSnapshot> = {
    Workspace: this.createExperienceSelectorMenuSnapshot('Workspace', []),
    School: this.createExperienceSelectorMenuSnapshot('School', [])
  };
  private readonly experienceSelectorMenuTriggerByType: Record<OnboardingExperienceSelectorType, AppMenuTrigger> = {
    Workspace: this.createExperienceSelectorMenuTrigger('Workspace'),
    School: this.createExperienceSelectorMenuTrigger('School')
  };
  private documentScrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyOverscrollBehavior = '';
  private previousDocumentOverflow = '';
  private previousDocumentOverscrollBehavior = '';

  protected readonly steps: OnboardingStep[] = [
    { id: 'basics', title: 'Basics', optional: false },
    { id: 'photos', title: 'Photos', optional: false },
    { id: 'lifestyle', title: 'Lifestyle', optional: true },
    { id: 'review', title: 'Review', optional: false }
  ];
  protected readonly physiqueOptions = APP_STATIC_DATA.physiqueOptions;
  protected readonly languageSuggestions = APP_STATIC_DATA.languageSuggestions;
  protected readonly profileStatusOptions = APP_STATIC_DATA.profileStatusOptions;
  protected readonly profileDetailValueOptions = APP_STATIC_DATA.profileDetailValueOptions;
  protected readonly beliefsValuesOptionGroups = APP_STATIC_DATA.beliefsValuesOptionGroups;
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;
  protected readonly experienceMemoryRouteConfig: UserExperiencesRouteConfig = { mode: 'memory' };
  protected draft: ProfileOnboardingDraft | null = null;
  protected assessment: ProfileOnboardingAssessment | null = null;
  protected birthdayDate: Date | null = null;
  protected saving = false;
  protected saveError = '';
  protected imageUploadError = '';
  protected attemptedContinue = false;
  protected experienceManagerOpen = false;
  protected experienceManagerFilter: ExperienceFilter = 'All';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncDocumentScrollLock();
    }
    if (!changes['open'] && !changes['user']) {
      return;
    }
    const previousDraftUserId = this.draft?.userId?.trim() ?? '';
    if (!this.open || !this.user) {
      this.onboarding.clearDraft(previousDraftUserId);
      this.draft = null;
      this.assessment = null;
      this.birthdayDate = null;
      this.saveError = '';
      this.imageUploadError = '';
      this.saving = false;
      this.attemptedContinue = false;
      this.experienceManagerOpen = false;
      this.experienceManagerFilter = 'All';
      return;
    }
    const nextUserId = this.user.id.trim();
    if (previousDraftUserId && previousDraftUserId !== nextUserId) {
      this.onboarding.clearDraft(previousDraftUserId);
    }
    this.assessment = this.onboarding.assessUser(this.user);
    this.draft = this.onboarding.loadDraft(this.user);
    this.syncBirthdayDateFromDraft();
  }

  ngOnDestroy(): void {
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
    const labels = this.basicsMissingLabels();
    if (this.imageCount() < ProfileOnboardingPopupComponent.MIN_REQUIRED_IMAGES) {
      labels.push('3 photos');
    }
    return labels;
  }

  protected basicsMissingLabels(): string[] {
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
    if (!this.draft || this.saving) {
      return false;
    }
    if (this.currentStep().id === 'basics') {
      return this.basicsMissingLabels().length === 0;
    }
    if (this.currentStep().id === 'photos') {
      return this.imageCount() >= ProfileOnboardingPopupComponent.MIN_REQUIRED_IMAGES;
    }
    if (this.currentStep().id === 'review') {
      return this.requiredMissingLabels().length === 0;
    }
    return true;
  }

  protected primaryActionLabel(): string {
    if (this.saving) {
      return 'Saving...';
    }
    return this.currentStep().id === 'review' ? 'Save' : 'Next';
  }

  protected requestDismiss(): void {
    if (this.saving) {
      return;
    }
    const userId = this.draft?.userId?.trim() ?? this.user?.id?.trim() ?? '';
    this.onboarding.clearDraft(userId);
    this.dismissed.emit();
  }

  protected persistDraft(): void {
    if (!this.draft) {
      return;
    }
    this.onboarding.saveDraft(this.draft);
  }

  protected goBack(): void {
    if (!this.draft || this.saving) {
      return;
    }
    const index = this.currentStepIndex();
    if (index <= 0) {
      return;
    }
    this.setStep(this.steps[index - 1].id);
  }

  protected skipStep(): void {
    if (!this.draft || !this.currentStep().optional || this.saving) {
      return;
    }
    const current = this.currentStep().id;
    this.draft.skippedStepIds = [...new Set([...this.draft.skippedStepIds, current])];
    this.goNext();
  }

  protected goNext(): void {
    if (!this.draft || this.saving) {
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

  protected selectMenuTrigger(value: string | null | undefined, icon = 'tune', palette: AppMenuPalette = 'neutral'): AppMenuTrigger {
    const label = `${value ?? ''}`.trim();
    return {
      label,
      icon,
      palette,
      shape: 'field',
      disabled: () => this.saving,
      ariaLabel: 'Open selector'
    };
  }

  protected fieldMenuTrigger(
    field: OnboardingMenuField,
    options: readonly string[],
    activeValue: string | null | undefined,
    icon = 'radio_button_checked',
    palette: AppMenuPalette = 'neutral'
  ): AppMenuTrigger {
    const label = `${activeValue ?? ''}`.trim();
    return this.selectMenuTrigger(
      label,
      label ? this.fieldMenuItemIcon(field, label, icon) : icon,
      label ? this.fieldMenuItemPalette(field, label, options, palette) : palette
    );
  }

  protected fieldMenuItems(
    field: OnboardingMenuField,
    options: readonly string[],
    activeValue: string | null | undefined,
    icon = 'radio_button_checked',
    palette: AppMenuPalette = 'neutral'
  ): readonly AppMenuItem<string, OnboardingMenuContext>[] {
    return options.map(option => ({
      id: `${field}-${option}`,
      label: option,
      icon: this.fieldMenuItemIcon(field, option, icon),
      kind: 'radio',
      active: option === activeValue,
      palette: this.fieldMenuItemPalette(field, option, options, palette),
      surface: 'tinted',
      value: option,
      context: { menu: 'field', field, value: option }
    }));
  }

  protected profileStatusMenuTrigger(status: ProfileStatus): AppMenuTrigger {
    return this.selectMenuTrigger(status, this.statusIcon(status), this.profileStatusPalette(status));
  }

  protected profileStatusMenuItems(status: ProfileStatus): readonly AppMenuItem<string, OnboardingMenuContext>[] {
    return this.profileStatusOptions.map(option => ({
      id: `profile-status-${option.value}`,
      label: option.value,
      icon: option.icon,
      kind: 'radio',
      active: option.value === status,
      palette: this.profileStatusPalette(option.value),
      surface: 'tinted',
      value: option.value,
      context: { menu: 'field', field: 'profileStatus', value: option.value }
    }));
  }

  protected experienceSelectorLabelKey(type: OnboardingExperienceSelectorType): string {
    return type === 'Workspace'
      ? 'profile.experience.workplace'
      : 'profile.experience.school';
  }

  protected experienceSelectorMenuTrigger(type: OnboardingExperienceSelectorType): AppMenuTrigger {
    return this.experienceSelectorMenuTriggerByType[type];
  }

  protected experienceSelectorMenuValue(type: OnboardingExperienceSelectorType): ExperienceEntry[] {
    return this.experienceSelectorMenuSnapshot(type).value;
  }

  protected experienceSelectorMenuModel(type: OnboardingExperienceSelectorType): AppMenuModel<string, OnboardingMenuContext> {
    return this.experienceSelectorMenuSnapshot(type).model;
  }

  protected languageMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'language',
      palette: 'blue',
      shape: 'field',
      disabled: () => this.saving,
      ariaLabel: (this.draft?.form.languages.length ?? 0) > 0 ? 'open.languages.selector' : 'select.languages'
    };
  }

  protected languageMenuModel(): AppMenuModel<string, OnboardingMenuContext> {
    return buildTabbedMenuModel<string, OnboardingMenuContext>({
      idPrefix: 'onboarding-language',
      groups: [{
        title: 'Languages',
        shortTitle: 'Languages',
        toneClass: 'section-languages',
        options: this.languageMenuOptions()
      }],
      selected: this.draft?.form.languages ?? [],
      context: value => ({ menu: 'languageOption', value }),
      summary: {
        emptyLabel: 'select.languages',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected valuesMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'auto_awesome',
      palette: this.paletteFromProfileTone(this.valuesDominantToneClass(this.draft?.form.values ?? [])),
      shape: 'field',
      disabled: () => this.saving,
      ariaLabel: (this.draft?.form.values.length ?? 0) > 0 ? 'open.values.selector' : 'select.values'
    };
  }

  protected valuesMenuModel(): AppMenuModel<string, OnboardingMenuContext> {
    return buildTabbedMenuModel<string, OnboardingMenuContext>({
      idPrefix: 'onboarding-values',
      groups: this.beliefsValuesOptionGroups,
      selected: this.draft?.form.values ?? [],
      maxSelected: 5,
      context: value => ({ menu: 'valuesOption', value }),
      summary: {
        emptyLabel: 'select.values',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected interestsMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'sell',
      palette: this.paletteFromProfileTone(this.interestDominantToneClass(this.draft?.form.interests ?? [])),
      shape: 'field',
      disabled: () => this.saving,
      ariaLabel: (this.draft?.form.interests.length ?? 0) > 0 ? 'open.interests.selector' : 'select.interests'
    };
  }

  protected interestsMenuModel(): AppMenuModel<string, OnboardingMenuContext> {
    return buildTabbedMenuModel<string, OnboardingMenuContext>({
      idPrefix: 'onboarding-interests',
      groups: this.interestOptionGroups,
      selected: this.draft?.form.interests ?? [],
      maxSelected: 5,
      context: value => ({ menu: 'interestOption', value }),
      summary: {
        emptyLabel: 'select.interests',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected onboardingActionMenuItems(): readonly AppMenuItem<string, OnboardingMenuContext>[] {
    const primaryLabel = this.primaryActionLabel();
    const items: AppMenuItem<string, OnboardingMenuContext>[] = [
      {
        id: 'onboarding-back',
        label: 'Back',
        icon: 'arrow_back',
        layout: 'action',
        palette: 'neutral',
        surface: 'tinted',
        disabled: this.saving || this.currentStepIndex() === 0,
        ariaLabel: 'Back',
        context: { menu: 'navigation', action: 'back' }
      }
    ];
    if (this.currentStep().optional) {
      items.push({
        id: 'onboarding-skip',
        label: 'Skip',
        icon: 'skip_next',
        layout: 'action',
        palette: 'amber',
        surface: 'tinted',
        disabled: this.saving,
        ariaLabel: 'Skip',
        context: { menu: 'navigation', action: 'skip' }
      });
    }
    items.push({
      id: 'onboarding-next',
      label: primaryLabel,
      icon: this.currentStep().id === 'review' ? 'done' : 'arrow_forward',
      layout: 'action',
      palette: this.currentStep().id === 'review' ? 'green' : 'blue',
      surface: 'tinted',
      disabled: !this.canContinue(),
      ariaLabel: primaryLabel,
      progress: this.saving
        ? {
            state: 'loading',
            shape: 'button'
          }
        : null,
      context: { menu: 'navigation', action: 'next' }
    });
    return items;
  }

  protected onProfileOnboardingMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as OnboardingMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'experienceSelector':
        this.openExperienceManager(context.value);
        return;
      case 'navigation':
        this.handleOnboardingNavigationAction(context.action);
        return;
      default:
        return;
    }
  }

  private handleOnboardingNavigationAction(action: 'back' | 'skip' | 'next'): void {
    switch (action) {
      case 'back':
        this.goBack();
        return;
      case 'skip':
        this.skipStep();
        return;
      case 'next':
        this.goNext();
        return;
    }
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

  protected imageCount(): number {
    return this.draft?.form.images.length ?? 0;
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

  private syncBirthdayDateFromDraft(): void {
    this.birthdayDate = AppUtils.fromIsoDate(this.draft?.form.birthday ?? '');
  }

  protected closeExperienceManager(): void {
    this.experienceManagerOpen = false;
  }

  protected experienceManagerTitle(): string {
    if (this.experienceManagerFilter === 'Workspace' || this.experienceManagerFilter === 'School') {
      return this.experienceSelectorLabelKey(this.experienceManagerFilter);
    }
    return 'Experience';
  }

  protected onExperienceManagerEntriesChange(event: ProfileExperienceEntriesChange): void {
    if (!this.draft) {
      return;
    }
    this.draft.form.experienceEntries = event.entries.map(entry => ({ ...entry }));
    this.persistDraft();
    this.cdr.markForCheck();
  }

  protected statusIcon(status: ProfileStatus): string {
    return this.profileStatusOptions.find(option => option.value === status)?.icon ?? 'public';
  }

  private getPhysiqueIcon(value: string): string {
    const normalized = AppUtils.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'directions_run';
    }
    if (normalized.includes('lean')) {
      return 'self_improvement';
    }
    if (normalized.includes('athletic')) {
      return 'fitness_center';
    }
    if (normalized.includes('fit')) {
      return 'sports_gymnastics';
    }
    if (normalized.includes('curvy')) {
      return 'accessibility';
    }
    if (normalized.includes('muscular')) {
      return 'sports_mma';
    }
    return 'accessibility_new';
  }

  private getPhysiqueClass(value: string): string {
    const normalized = AppUtils.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'physique-slim';
    }
    if (normalized.includes('lean')) {
      return 'physique-lean';
    }
    if (normalized.includes('fit')) {
      return 'physique-fit';
    }
    if (normalized.includes('athletic')) {
      return 'physique-athletic';
    }
    if (normalized.includes('curvy')) {
      return 'physique-curvy';
    }
    if (normalized.includes('muscular')) {
      return 'physique-muscular';
    }
    return 'physique-average';
  }

  private profileStatusPalette(status: string): AppMenuPalette {
    switch (status) {
      case 'public':
        return 'green';
      case 'friends only':
        return 'blue';
      case 'host only':
        return 'brown';
      case 'blocked':
      case 'deleted':
        return 'red';
      case 'inactive':
        return 'muted';
      default:
        return 'neutral';
    }
  }

  private detailToneFromOptions(value: string, options: readonly string[]): string {
    const index = options.findIndex(item => AppUtils.normalizeText(item) === AppUtils.normalizeText(value));
    return `detail-tone-${((index >= 0 ? index : 0) % 8) + 1}`;
  }

  private paletteFromProfileTone(toneClass: string): AppMenuPalette {
    switch (toneClass) {
      case 'status-public':
      case 'physique-lean':
      case 'physique-fit':
      case 'detail-tone-2':
      case 'detail-tone-5':
      case 'section-active':
        return 'green';
      case 'status-friends':
      case 'physique-athletic':
      case 'detail-tone-1':
      case 'section-languages':
      case 'section-social':
        return 'blue';
      case 'status-host':
      case 'detail-tone-8':
        return 'brown';
      case 'physique-slim':
      case 'detail-tone-7':
        return 'sky';
      case 'physique-curvy':
      case 'detail-tone-6':
        return 'pink';
      case 'physique-muscular':
        return 'red';
      case 'detail-tone-3':
      case 'section-family':
      case 'section-food':
        return 'orange';
      case 'section-ambition':
        return 'amber';
      case 'section-lifestyle':
      case 'section-mind':
        return 'teal';
      case 'section-beliefs':
        return 'purple';
      case 'detail-tone-4':
      case 'section-arts':
        return 'violet';
      case 'section-identity':
        return 'cyan';
      case 'status-inactive':
      default:
        return 'muted';
    }
  }

  protected experienceTypeIcon(type: string): string {
    switch (type) {
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      case 'Additional Project':
        return 'rocket_launch';
      case 'Workspace':
      default:
        return 'apartment';
    }
  }

  private experienceTypePalette(type: string): AppMenuPalette {
    switch (type) {
      case 'School':
        return 'blue';
      case 'Online Session':
        return 'green';
      case 'Additional Project':
        return 'violet';
      case 'Workspace':
      default:
        return 'pink';
    }
  }

  private languageMenuOptions(): readonly string[] {
    const optionByKey = new Map<string, string>();
    for (const option of [...this.languageSuggestions, ...(this.draft?.form.languages ?? [])]) {
      const normalized = option.trim();
      if (!normalized) {
        continue;
      }
      optionByKey.set(normalized.toLowerCase(), normalized);
    }
    return [...optionByKey.values()];
  }

  private normalizeTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  private valuesDominantToneClass(selected: readonly string[]): string {
    return this.dominantToneClass(selected, value => this.valuesOptionToneClass(value), 'section-beliefs');
  }

  private interestDominantToneClass(selected: readonly string[]): string {
    return this.dominantToneClass(selected, value => this.interestOptionToneClass(value), 'section-social');
  }

  private dominantToneClass(
    selected: readonly string[],
    toneForOption: (value: string) => string,
    fallback: string
  ): string {
    const normalizedSelected = selected.map(item => item.trim()).filter(Boolean);
    if (normalizedSelected.length === 0) {
      return fallback;
    }
    const counts: Record<string, number> = {};
    for (const option of normalizedSelected) {
      const tone = toneForOption(option);
      if (!tone) {
        continue;
      }
      counts[tone] = (counts[tone] ?? 0) + 1;
    }
    let bestTone = '';
    let bestCount = 0;
    for (const [tone, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestTone = tone;
        bestCount = count;
      }
    }
    if (!bestTone || Object.values(counts).filter(count => count === bestCount).length > 1) {
      return toneForOption(normalizedSelected[0]) || fallback;
    }
    return bestTone;
  }

  private valuesOptionToneClass(option: string): string {
    const normalizedOption = this.normalizeTopicToken(option);
    if (!normalizedOption) {
      return '';
    }
    for (const group of this.beliefsValuesOptionGroups) {
      if (group.options.some(groupOption => this.normalizeTopicToken(groupOption) === normalizedOption)) {
        return group.toneClass;
      }
    }
    return '';
  }

  private interestOptionToneClass(option: string): string {
    const normalizedOption = this.normalizeTopicToken(option);
    if (!normalizedOption) {
      return '';
    }
    for (const group of this.interestOptionGroups) {
      if (group.options.some(groupOption => this.normalizeTopicToken(groupOption) === normalizedOption)) {
        return group.toneClass;
      }
    }
    return '';
  }

  private fieldMenuItemIcon(field: OnboardingMenuField, value: string, fallback: string): string {
    if (field === 'physique') {
      return this.getPhysiqueIcon(value);
    }
    if (field !== 'profileStatus') {
      return this.detailOptionIcon(this.profileDetailKeyFromField(field), value);
    }
    return fallback;
  }

  private fieldMenuItemPalette(
    field: OnboardingMenuField,
    value: string,
    options: readonly string[],
    fallback: AppMenuPalette
  ): AppMenuPalette {
    if (field === 'physique') {
      return this.paletteFromProfileTone(this.getPhysiqueClass(value));
    }
    if (field !== 'profileStatus') {
      return this.paletteFromProfileTone(this.detailToneFromOptions(value, options));
    }
    return fallback;
  }

  private detailOptionIcon(labelKey: string, option: string): string {
    const normalizedLabel = AppUtils.normalizeText(labelKey);
    const normalizedOption = AppUtils.normalizeText(option);

    if (normalizedLabel.includes('drinking')) {
      if (normalizedOption.includes('never')) {
        return 'no_drinks';
      }
      if (normalizedOption.includes('socially')) {
        return 'groups';
      }
      if (normalizedOption.includes('occasionally')) {
        return 'event';
      }
      return 'nightlife';
    }
    if (normalizedLabel.includes('smoking')) {
      if (normalizedOption.includes('never')) {
        return 'smoke_free';
      }
      if (normalizedOption.includes('trying')) {
        return 'healing';
      }
      if (normalizedOption.includes('socially')) {
        return 'group';
      }
      return 'smoking_rooms';
    }
    if (normalizedLabel.includes('workout')) {
      if (normalizedOption.includes('daily')) {
        return 'whatshot';
      }
      if (normalizedOption.includes('4x')) {
        return 'fitness_center';
      }
      if (normalizedOption.includes('2-3x')) {
        return 'directions_run';
      }
      return 'self_improvement';
    }
    if (normalizedLabel.includes('pets')) {
      if (normalizedOption.includes('dog')) {
        return 'pets';
      }
      if (normalizedOption.includes('cat')) {
        return 'pets';
      }
      if (normalizedOption.includes('all')) {
        return 'cruelty_free';
      }
      return 'block';
    }
    if (normalizedLabel.includes('family')) {
      if (normalizedOption.includes('want')) {
        return 'child_care';
      }
      if (normalizedOption.includes('open')) {
        return 'family_restroom';
      }
      if (normalizedOption.includes('not sure')) {
        return 'help_outline';
      }
      return 'do_not_disturb_alt';
    }
    if (normalizedLabel.includes('children')) {
      if (normalizedOption === 'yes') {
        return 'child_friendly';
      }
      if (normalizedOption === 'no') {
        return 'do_not_disturb_alt';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('love')) {
      if (normalizedOption.includes('long-term')) {
        return 'favorite';
      }
      if (normalizedOption.includes('slow-burn')) {
        return 'hourglass_bottom';
      }
      if (normalizedOption.includes('open')) {
        return 'hub';
      }
      return 'explore';
    }
    if (normalizedLabel.includes('communication')) {
      if (normalizedOption.includes('direct')) {
        return 'campaign';
      }
      if (normalizedOption.includes('calm')) {
        return 'record_voice_over';
      }
      if (normalizedOption.includes('playful')) {
        return 'mood';
      }
      return 'forum';
    }
    if (normalizedLabel.includes('orientation')) {
      if (normalizedOption.includes('straight')) {
        return 'person';
      }
      if (normalizedOption.includes('bisexual')) {
        return 'diversity_3';
      }
      if (normalizedOption.includes('gay') || normalizedOption.includes('lesbian')) {
        return 'favorite';
      }
      if (normalizedOption.includes('pansexual')) {
        return 'all_inclusive';
      }
      if (normalizedOption.includes('asexual')) {
        return 'do_not_disturb_on';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('gender')) {
      if (normalizedOption.includes('woman')) {
        return 'female';
      }
      if (normalizedOption.includes('man')) {
        return 'male';
      }
      if (normalizedOption.includes('non-binary')) {
        return 'transgender';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('religion')) {
      if (normalizedOption.includes('spiritual')) {
        return 'self_improvement';
      }
      if (normalizedOption.includes('christian')) {
        return 'church';
      }
      if (normalizedOption.includes('muslim')) {
        return 'mosque';
      }
      if (normalizedOption.includes('jewish')) {
        return 'synagogue';
      }
      if (normalizedOption.includes('buddhist') || normalizedOption.includes('hindu')) {
        return 'temple_buddhist';
      }
      if (normalizedOption.includes('atheist')) {
        return 'public_off';
      }
      return 'privacy_tip';
    }

    if (normalizedOption.includes('never')) {
      return 'block';
    }
    if (normalizedOption.includes('daily')) {
      return 'today';
    }
    return this.fallbackDetailOptionIcon(normalizedOption);
  }

  private fallbackDetailOptionIcon(normalizedOption: string): string {
    const iconPool = [
      'radio_button_checked',
      'diamond',
      'bolt',
      'eco',
      'favorite',
      'nightlife',
      'star',
      'palette',
      'self_improvement',
      'travel_explore',
      'psychology',
      'celebration'
    ];
    let hash = 0;
    for (let i = 0; i < normalizedOption.length; i += 1) {
      hash = ((hash << 5) - hash + normalizedOption.charCodeAt(i)) | 0;
    }
    return iconPool[Math.abs(hash) % iconPool.length];
  }

  protected stepDone(stepId: ProfileOnboardingStepId): boolean {
    return this.draft?.completedStepIds.includes(stepId) ?? false;
  }

  protected stepSkipped(stepId: ProfileOnboardingStepId): boolean {
    return this.draft?.skippedStepIds.includes(stepId) ?? false;
  }

  protected stepRequiredMissing(stepId: ProfileOnboardingStepId): boolean {
    if (stepId === 'basics') {
      return this.basicsMissingLabels().length > 0;
    }
    if (stepId === 'photos') {
      return this.imageCount() < ProfileOnboardingPopupComponent.MIN_REQUIRED_IMAGES;
    }
    return false;
  }

  protected stepIcon(step: OnboardingStep): string {
    if (this.stepRequiredMissing(step.id)) {
      return 'priority_high';
    }
    if (this.stepDone(step.id)) {
      return 'done';
    }
    if (this.stepSkipped(step.id)) {
      return 'remove';
    }
    return step.optional ? 'radio_button_unchecked' : 'priority_high';
  }

  protected detailOptions(label: string): string[] {
    return this.profileDetailValueOptions[this.profileDetailKeyFromLabel(label)] ?? [];
  }

  protected basicsErrorVisible(): boolean {
    return this.attemptedContinue && this.currentStep().id === 'basics' && this.basicsMissingLabels().length > 0;
  }

  private async saveAndComplete(): Promise<void> {
    if (!this.user || !this.draft || !this.canContinue()) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.persistDraft();
    const payload = this.buildUserPayload(this.user, this.draft);
    let completionEmitted = false;
    try {
      const savedUser = await this.usersService.saveUserProfileExt(payload, this.draft.form.experienceEntries);
      if (!savedUser) {
        throw new Error('Profile save returned no user.');
      }
      this.onboarding.clearDraft(savedUser.id);
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
      headline: `${user.headline ?? ''}`.trim(),
      about: draft.form.about.trim().slice(0, 160),
      images: [...draft.form.images],
      profileStatus: draft.form.profileStatus,
      profileFormVersion: this.onboarding.currentProfileFormVersion,
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
      return this.beliefsValuesAllOptions();
    }
    if (labelKey === 'profile.details.interest') {
      return this.interestAllOptions();
    }
    return this.profileDetailValueOptions[labelKey] ?? [];
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

  private profileDetailKeyFromLabel(label: string): string {
    switch (label) {
      case 'Gender':
        return 'profile.gender';
      case 'Drinking':
        return 'profile.details.drinking';
      case 'Smoking':
        return 'profile.details.smoking';
      case 'Workout':
        return 'profile.details.workout';
      case 'Pets':
        return 'profile.details.pets';
      case 'Family plans':
        return 'profile.details.familyPlans';
      case 'Children':
        return 'profile.details.children';
      case 'Love style':
        return 'profile.details.loveStyle';
      case 'Communication style':
        return 'profile.details.communicationStyle';
      case 'Sexual orientation':
        return 'profile.details.sexualOrientation';
      case 'Religion':
        return 'profile.details.religion';
      case 'Values':
        return 'profile.details.values';
      case 'Interest':
        return 'profile.details.interest';
      default:
        return label;
    }
  }

  private profileDetailKeyFromField(field: OnboardingMenuField): string {
    switch (field) {
      case 'genderDetail':
        return 'profile.gender';
      case 'drinking':
        return 'profile.details.drinking';
      case 'smoking':
        return 'profile.details.smoking';
      case 'workout':
        return 'profile.details.workout';
      case 'pets':
        return 'profile.details.pets';
      case 'familyPlans':
        return 'profile.details.familyPlans';
      case 'children':
        return 'profile.details.children';
      case 'loveStyle':
        return 'profile.details.loveStyle';
      case 'communicationStyle':
        return 'profile.details.communicationStyle';
      case 'sexualOrientation':
        return 'profile.details.sexualOrientation';
      case 'religion':
        return 'profile.details.religion';
      case 'physique':
        return 'profile.physique';
      case 'profileStatus':
        return 'profile.status';
      default:
        return field;
    }
  }

  private isDetailPrivacy(value: string): value is DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  protected setStep(stepId: ProfileOnboardingStepId): void {
    if (!this.draft) {
      return;
    }
    this.draft.currentStepId = stepId;
    this.attemptedContinue = false;
    this.persistDraft();
  }

  private openExperienceManager(type: OnboardingExperienceSelectorType): void {
    if (this.saving) {
      return;
    }
    this.experienceManagerFilter = type;
    this.experienceManagerOpen = true;
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

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
  }

  private formatDateForDetail(value: string): string {
    const parsed = AppUtils.fromIsoDate(value);
    return parsed
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  }

  private experienceSelectorEntries(type: OnboardingExperienceSelectorType): ExperienceEntry[] {
    return this.experienceSelectorMenuSnapshot(type).entries;
  }

  private collectExperienceSelectorEntries(type: OnboardingExperienceSelectorType): ExperienceEntry[] {
    return (this.draft?.form.experienceEntries ?? [])
      .filter(item => item.type === type)
      .sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom));
  }

  private experienceSelectorMenuSnapshot(type: OnboardingExperienceSelectorType): ExperienceSelectorMenuSnapshot {
    const cache = this.experienceSelectorMenuCache[type];
    const entries = this.collectExperienceSelectorEntries(type);
    const cacheKey = this.experienceSelectorEntriesCacheKey(entries);
    if (cache.cacheKey === cacheKey) {
      return cache;
    }
    const next = this.createExperienceSelectorMenuSnapshot(type, entries);
    cache.cacheKey = next.cacheKey;
    cache.entries = next.entries;
    cache.value = next.value;
    cache.model = next.model;
    return cache;
  }

  private createExperienceSelectorMenuTrigger(type: OnboardingExperienceSelectorType): AppMenuTrigger {
    return {
      icon: this.experienceTypeIcon(type),
      palette: this.experienceTypePalette(type),
      shape: 'field',
      action: 'custom',
      trailingIcon: 'chevron_right',
      disabled: () => this.saving,
      ariaLabel: () => this.experienceSelectorEntries(type).length > 0
        ? this.experienceSelectorOpenLabelKey(type)
        : this.experienceSelectorEmptyLabelKey(type),
      context: { menu: 'experienceSelector', value: type }
    };
  }

  private createExperienceSelectorMenuSnapshot(
    type: OnboardingExperienceSelectorType,
    entries: readonly ExperienceEntry[]
  ): ExperienceSelectorMenuSnapshot {
    const palette = this.experienceTypePalette(type);
    const stableEntries = [...entries];
    return {
      cacheKey: this.experienceSelectorEntriesCacheKey(stableEntries),
      entries: stableEntries,
      value: stableEntries,
      model: {
        presentation: 'tabs',
        valueKey: 'id',
        summary: {
          emptyLabel: this.experienceSelectorEmptyLabelKey(type),
          maxLabels: 2,
          counter: 'overflow'
        },
        groups: [{
          id: `onboarding-experience-${type.toLowerCase()}`,
          label: this.experienceSelectorLabelKey(type),
          icon: this.experienceTypeIcon(type),
          palette,
          items: stableEntries.map(entry => ({
            id: `onboarding-experience-${type}-${entry.id}`,
            label: this.experienceSelectorEntryLabel(entry),
            icon: this.experienceTypeIcon(type),
            kind: 'checkbox',
            removable: false,
            closeOnSelect: false,
            palette,
            value: entry,
            context: { menu: 'experienceSelector', value: type }
          }))
        }]
      }
    };
  }

  private experienceSelectorEntriesCacheKey(entries: readonly ExperienceEntry[]): string {
    return entries
      .map(entry => [
        entry.id,
        entry.type,
        entry.title,
        entry.org,
        entry.city,
        entry.dateFrom,
        entry.dateTo,
        entry.description
      ].map(value => `${value ?? ''}`).join('\u001f'))
      .join('\u001e');
  }

  private experienceSelectorEntryLabel(entry: ExperienceEntry): string {
    return entry.title.trim()
      || entry.org.trim()
      || entry.city.trim()
      || this.experienceSelectorLabelKey(entry.type as OnboardingExperienceSelectorType);
  }

  private experienceSelectorEmptyLabelKey(type: OnboardingExperienceSelectorType): string {
    return type === 'Workspace'
      ? 'profile.experience.selectWorkplace'
      : 'profile.experience.selectSchool';
  }

  private experienceSelectorOpenLabelKey(type: OnboardingExperienceSelectorType): string {
    return type === 'Workspace'
      ? 'profile.experience.openWorkplace'
      : 'profile.experience.openSchool';
  }

}

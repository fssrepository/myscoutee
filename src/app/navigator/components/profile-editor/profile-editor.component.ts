import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from '../../../shared/app-calendar-date-adapter';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import type {
  ExperienceImportProgressState,
  ExperienceImportStatistics,
  UserExperienceImportDraft
} from '../../../shared/core/contracts/profile.interface';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { AppContext } from '../../../shared/ui';
import { MediaService, ProfileOnboardingService, UserExperiencesService, UsersService, type UserDto } from '../../../shared/core';
import { I18nService } from '../../../shared/core';
import { I18nPipe } from '../../../shared/ui';
import { ProgressIndicatorComponent } from '../../../shared/ui';
import {
  AppMenuComponent,
  AppMenuDispatcher,
  AppMenuOutletComponent,
  AppMenuTriggerComponent,
  buildTabbedMenuModel,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../shared/ui/components/menu';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { NavigatorService } from '../../navigator.service';
import type * as ProfileContracts from '../../../shared/core/contracts/profile.interface';

import type * as AppConstants from '../../../shared/core/common/constants';
type ProfileEditorPanel = 'profile' | 'image' | 'experience';
type ProfileEditorMenuId = string;

type ProfileEditorMenuContext =
  | { kind: 'profileStatus'; value: AppConstants.ProfileStatus }
  | { kind: 'physique'; value: string }
  | { kind: 'detailValue'; groupIndex: number; rowIndex: number; value: string }
  | { kind: 'detailPrivacy'; groupIndex: number; rowIndex: number; value: AppConstants.DetailPrivacy }
  | { kind: 'experiencePrivacy'; type: 'workspace' | 'school'; value: AppConstants.DetailPrivacy }
  | { kind: 'experienceFilter'; value: ProfileContracts.ExperienceFilter }
  | { kind: 'experienceType'; value: ProfileContracts.ExperienceEntry['type'] }
  | { kind: 'experienceQuickAction'; action: 'create' | 'upload' }
  | { kind: 'languageOption'; value: string }
  | { kind: 'valuesOption'; groupIndex: number; rowIndex: number; value: string }
  | { kind: 'interestOption'; groupIndex: number; rowIndex: number; value: string };

interface ProfileFormState {
  fullName: string;
  headline: string;
  birthday: Date | null;
  city: string;
  heightCm: number | null;
  physique: string;
  languages: string[];
  horoscope: string;
  profileStatus: AppConstants.ProfileStatus;
  about: string;
}

interface ExperienceImportDialogState {
  visible: boolean;
  fileName: string;
  busy: boolean;
  progress: ExperienceImportProgressState;
  statistics: ExperienceImportStatistics;
  warnings: string[];
  error: string | null;
  draft: UserExperienceImportDraft | null;
}

@Component({
  selector: 'app-profile-editor',
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
    AppMenuOutletComponent,
    AppMenuTriggerComponent,
    ProgressIndicatorComponent,
    I18nPipe
  ],
  providers: [
    AppMenuDispatcher,
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateOnly }
  ],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.scss'
})
export class ProfileEditorComponent {
  @ViewChild('slotImageInput') private slotImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('experienceImportInput') private experienceImportInput?: ElementRef<HTMLInputElement>;

  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly appCtx = inject(AppContext);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly menuDispatcher = inject(AppMenuDispatcher);
  private readonly i18n = inject(I18nService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly profileOnboardingService = inject(ProfileOnboardingService);
  private readonly userExperiencesService = inject(UserExperiencesService);
  private readonly usersService = inject(UsersService);
  private readonly mediaService = inject(MediaService);
  private readonly profileDetailsFormByUser: Record<string, ProfileContracts.ProfileDetailFormGroup[]> = {};
  private readonly profileImageSlotsByUser: Record<string, Array<string | null>> = {};
  private readonly experienceEntriesByUser: Record<string, ProfileContracts.ExperienceEntry[]> = {};
  private lastLoadedUserId = '';
  private experienceEntriesLoadToken = 0;
  private experienceEntriesSaveToken = 0;
  private experienceImportToken = 0;

  protected readonly isOpen = this.navigatorService.profileEditorOpen;
  protected readonly profileStatusOptions = APP_STATIC_DATA.profileStatusOptions;
  protected readonly physiqueOptions = APP_STATIC_DATA.physiqueOptions;
  protected readonly profileDetailValueOptions = APP_STATIC_DATA.profileDetailValueOptions;
  protected readonly beliefsValuesOptionGroups = APP_STATIC_DATA.beliefsValuesOptionGroups;
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;
  protected readonly detailPrivacyOptions = APP_STATIC_DATA.detailPrivacyOptions;
  protected readonly experienceFilterOptions = APP_STATIC_DATA.experienceFilterOptions;
  protected readonly experienceTypeOptions = APP_STATIC_DATA.experienceTypeOptions;
  protected readonly languageSuggestions = APP_STATIC_DATA.languageSuggestions;

  protected panel: ProfileEditorPanel = 'profile';
  protected profileUser: UserDto | null = null;
  protected profileForm: ProfileFormState = this.createEmptyProfileForm();
  protected profileDetailsForm: ProfileContracts.ProfileDetailFormGroup[] = [];
  protected imageSlots: Array<string | null> = this.createEmptyImageSlots();
  protected selectedImageIndex = 0;
  protected pendingSlotUploadIndex: number | null = null;
  protected uploadingImageSlotIndex: number | null = null;
  protected privacyFabJustSelectedKey: string | null = null;
  protected experienceVisibility: Record<'workspace' | 'school', AppConstants.DetailPrivacy> = {
    workspace: 'Public',
    school: 'Public'
  };
  protected experienceEntries: ProfileContracts.ExperienceEntry[] = [];
  protected experienceFilter: ProfileContracts.ExperienceFilter = 'All';
  protected showExperienceForm = false;
  protected editingExperienceId: string | null = null;
  protected pendingExperienceDeleteId: string | null = null;
  protected highlightedImportedExperienceIds = new Set<string>();
  protected experienceImportDialog: ExperienceImportDialogState = this.createEmptyExperienceImportDialogState();
  protected experienceRangeStart: Date | null = null;
  protected experienceRangeEnd: Date | null = null;
  protected experienceForm: Omit<ProfileContracts.ExperienceEntry, 'id'> = {
    type: 'Workspace',
    title: '',
    org: '',
    city: '',
    dateFrom: '',
    dateTo: '',
    description: ''
  };

  constructor() {
    effect(() => {
      const isOpen = this.navigatorService.profileEditorOpen();
      const activeUser = this.appCtx.activeUserProfile();
      const activeUserId = activeUser?.id ?? '';

      if (!isOpen) {
        this.lastLoadedUserId = '';
        this.resetTransientUiState();
        return;
      }

      if (!activeUser || this.lastLoadedUserId === activeUserId) {
        return;
      }

      this.lastLoadedUserId = activeUserId;
      this.loadProfileEditorState(activeUser);
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onWindowEscape(event: Event): void {
    if (!this.isOpen()) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.stopPropagation();
    void this.handleCloseAction();
  }

  protected get activeUser(): UserDto | null {
    return this.profileUser;
  }

  protected get selectedImagePreview(): string | null {
    return this.imageSlots[this.selectedImageIndex] ?? null;
  }

  protected get featuredImagePreview(): string | null {
    return this.imageSlots[0] ?? null;
  }

  protected get imageStackSlots(): number[] {
    return this.imageSlots
      .map((slot, index) => (slot ? index : -1))
      .filter(index => index >= 0);
  }

  protected get profileCompletionPercent(): number {
    return this.calculateProfileCompletionPercent();
  }

  protected get profileEditorAge(): number {
    if (!this.profileUser) {
      return 0;
    }
    if (!this.profileForm.birthday) {
      return this.profileUser.age;
    }
    return AppUtils.ageFromIsoDate(AppUtils.toIsoDate(this.profileForm.birthday), this.profileUser.age);
  }

  protected get filteredExperienceEntries(): ProfileContracts.ExperienceEntry[] {
    const filtered = this.experienceEntries.filter(item => {
      if (this.experienceFilter === 'All') {
        return true;
      }
      return item.type === this.experienceFilter;
    });
    return [...filtered].sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom));
  }

  protected get workspaceExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'Workspace').length;
    return `${count} items`;
  }

  protected get schoolExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'School').length;
    return `${count} items`;
  }

  protected get canSaveExperienceEntry(): boolean {
    return Boolean(this.experienceForm.title.trim() && this.experienceForm.org.trim() && this.experienceRangeStart);
  }

  protected get canSubmitExperienceImport(): boolean {
    return !this.experienceImportDialog.busy
      && !this.experienceImportDialog.error
      && (this.experienceImportDialog.draft?.importedIds.length ?? 0) > 0;
  }

  protected popupTitle(): string {
    if (this.panel === 'image') {
      return 'Images';
    }
    if (this.isAdminProfile()) {
      return 'Admin profile';
    }
    switch (this.panel) {
      case 'experience':
        return 'Experience';
      default:
        return 'Profile';
    }
  }

  protected isAdminProfile(): boolean {
    const user = this.profileUser;
    return Boolean(user && (user.hostTier === 'Admin' || user.statusText === 'Admin workspace' || user.id.startsWith('admin-')));
  }

  protected async handleCloseAction(): Promise<void> {
    if (this.experienceImportDialog.visible) {
      this.cancelExperienceImportDialog();
      return;
    }
    if (this.showExperienceForm) {
      this.closeExperienceForm();
      return;
    }
    if (this.panel !== 'profile') {
      this.panel = 'profile';
      return;
    }
    await this.commitProfileForm(false);
    this.navigatorService.closeProfileEditor();
    this.resetTransientUiState();
  }

  protected onBackdropClose(): void {
    void this.handleCloseAction();
  }

  protected openImageEditor(): void {
    this.panel = 'image';
  }

  protected openWorkspaceSelector(): void {
    this.openExperienceSelector('Workspace');
  }

  protected openSchoolSelector(): void {
    this.openExperienceSelector('School');
  }

  protected openExperienceSelector(filter: ProfileContracts.ExperienceFilter = 'All'): void {
    this.experienceFilter = filter;
    this.pendingExperienceDeleteId = null;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    this.panel = 'experience';
  }

  protected selectImageSlot(index: number): void {
    if (this.uploadingImageSlotIndex !== null) {
      return;
    }
    const isSelectedSlot = this.selectedImageIndex === index;
    const hasImage = Boolean(this.imageSlots[index]);
    this.selectedImageIndex = index;
    if (hasImage && !isSelectedSlot) {
      return;
    }
    this.pendingSlotUploadIndex = index;
    this.slotImageInput?.nativeElement.click();
  }

  protected selectImageFromStack(index: number): void {
    if (!this.imageSlots[index]) {
      return;
    }
    this.selectedImageIndex = index;
  }

  protected removeImage(index: number): void {
    if (this.uploadingImageSlotIndex === index) {
      return;
    }
    this.revokeObjectUrl(this.imageSlots[index]);
    this.imageSlots[index] = null;
    this.persistActiveUserImageSlots();
    if (this.selectedImageIndex === index) {
      const nearest = this.findNearestFilledImageIndex(index);
      this.selectedImageIndex = nearest >= 0 ? nearest : 0;
    }
  }

  protected onSlotImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    const slotIndex = this.pendingSlotUploadIndex;
    this.pendingSlotUploadIndex = null;
    if (!file || slotIndex === null) {
      target.value = '';
      return;
    }
    target.value = '';
    void this.uploadAndRefreshProfileImageSlot(file, slotIndex);
  }

  protected isImageSlotUploading(index: number): boolean {
    return this.uploadingImageSlotIndex === index;
  }

  protected isSelectedImageUploading(): boolean {
    return this.uploadingImageSlotIndex !== null && this.uploadingImageSlotIndex === this.selectedImageIndex;
  }

  protected openExperienceCreateAction(event?: Event): void {
    event?.stopPropagation();
    this.openExperienceForm();
  }

  protected openExperienceUploadAction(event?: Event): void {
    event?.stopPropagation();
    const input = this.experienceImportInput?.nativeElement;
    if (!input) {
      return;
    }
    input.value = '';
    input.click();
  }

  protected experienceQuickActionMenuItems(): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return [
      {
        id: 'experience-actions',
        icon: 'add',
        closeIcon: 'close',
        ariaLabel: 'Open experience actions',
        palette: 'blue',
        items: [
          {
            id: 'experience-action-create',
            label: 'Create',
            icon: 'add_circle',
            palette: 'teal',
            surface: 'tinted',
            context: { kind: 'experienceQuickAction', action: 'create' }
          },
          {
            id: 'experience-action-upload',
            label: 'Upload',
            icon: 'upload_file',
            palette: 'orange',
            surface: 'tinted',
            context: { kind: 'experienceQuickAction', action: 'upload' }
          }
        ]
      }
    ];
  }

  protected profileStatusMenuTrigger(): AppMenuTrigger {
    return {
      label: this.profileForm.profileStatus,
      icon: this.getProfileStatusIcon(this.profileForm.profileStatus),
      palette: this.profileStatusPalette(this.profileForm.profileStatus),
      shape: 'pill',
      ariaLabel: 'Open profile status selector'
    };
  }

  protected profileStatusMenuItems(): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return this.profileStatusOptions.map(option => ({
      id: this.menuItemId('profile-status', option.value),
      label: option.value,
      icon: option.icon,
      kind: 'radio',
      active: option.value === this.profileForm.profileStatus,
      palette: this.profileStatusPalette(option.value),
      surface: 'tinted',
      context: { kind: 'profileStatus', value: option.value }
    }));
  }

  protected physiqueMenuTrigger(): AppMenuTrigger {
    return {
      label: this.profileForm.physique,
      icon: this.getPhysiqueIcon(this.profileForm.physique),
      palette: this.paletteFromProfileTone(this.getPhysiqueClass(this.profileForm.physique)),
      shape: 'field',
      ariaLabel: 'Open physique selector'
    };
  }

  protected physiqueMenuItems(): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return this.physiqueOptions.map(option => ({
      id: this.menuItemId('physique', option),
      label: option,
      icon: this.getPhysiqueIcon(option),
      kind: 'radio',
      active: option === this.profileForm.physique,
      palette: this.paletteFromProfileTone(this.getPhysiqueClass(option)),
      surface: 'tinted',
      context: { kind: 'physique', value: option }
    }));
  }

  protected detailValueMenuTrigger(row: ProfileContracts.ProfileDetailFormRow): AppMenuTrigger {
    return {
      label: row.value,
      icon: this.detailOptionIcon(row.labelKey, row.value),
      palette: this.paletteFromProfileTone(this.detailSelectedClass(row.labelKey, row.value, row.options)),
      shape: 'field',
      ariaLabel: `Open ${this.i18n.translate(row.labelKey)} selector`
    };
  }

  protected detailValueMenuItems(
    groupIndex: number,
    rowIndex: number,
    row: ProfileContracts.ProfileDetailFormRow
  ): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return row.options.map(option => ({
      id: this.menuItemId(`detail-value-${groupIndex}-${rowIndex}`, option),
      label: option,
      icon: this.detailOptionIcon(row.labelKey, option),
      kind: 'radio',
      active: option === row.value,
      palette: this.paletteFromProfileTone(this.detailOptionClass(row.labelKey, option, row.options)),
      surface: 'tinted',
      context: { kind: 'detailValue', groupIndex, rowIndex, value: option }
    }));
  }

  protected detailPrivacyMenuTrigger(row: ProfileContracts.ProfileDetailFormRow): AppMenuTrigger {
    return this.privacyMenuTrigger(row.privacy, 'Change visibility');
  }

  protected detailPrivacyMenuItems(
    groupIndex: number,
    rowIndex: number,
    row: ProfileContracts.ProfileDetailFormRow
  ): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return this.detailPrivacyOptions.map(option => ({
      id: this.menuItemId(`detail-privacy-${groupIndex}-${rowIndex}`, option),
      label: option,
      icon: this.privacyStatusIcon(option),
      kind: 'radio',
      active: option === row.privacy,
      palette: this.privacyPalette(option),
      surface: 'tinted',
      context: { kind: 'detailPrivacy', groupIndex, rowIndex, value: option }
    }));
  }

  protected experiencePrivacyMenuTrigger(type: 'workspace' | 'school'): AppMenuTrigger {
    const label = type === 'workspace' ? 'workspace' : 'school';
    return this.privacyMenuTrigger(this.experienceVisibilityValue(type), `Change ${label} visibility`);
  }

  protected experiencePrivacyMenuItems(
    type: 'workspace' | 'school'
  ): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    const current = this.experienceVisibilityValue(type);
    return this.detailPrivacyOptions.map(option => ({
      id: this.menuItemId(`experience-privacy-${type}`, option),
      label: option,
      icon: this.privacyStatusIcon(option),
      kind: 'radio',
      active: option === current,
      palette: this.privacyPalette(option),
      surface: 'tinted',
      context: { kind: 'experiencePrivacy', type, value: option }
    }));
  }

  protected experienceFilterMenuTrigger(): AppMenuTrigger {
    return {
      label: this.experienceFilter,
      icon: this.experienceFilterIcon(this.experienceFilter),
      palette: this.paletteFromProfileTone(this.experienceFilterClass(this.experienceFilter)),
      shape: 'field',
      ariaLabel: 'Open experience filter'
    };
  }

  protected experienceFilterMenuItems(): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return this.experienceFilterOptions.map(option => ({
      id: this.menuItemId('experience-filter', option),
      label: option,
      icon: this.experienceFilterIcon(option),
      kind: 'radio',
      active: option === this.experienceFilter,
      palette: this.paletteFromProfileTone(this.experienceFilterClass(option)),
      surface: 'tinted',
      context: { kind: 'experienceFilter', value: option }
    }));
  }

  protected experienceTypeMenuTrigger(): AppMenuTrigger {
    return {
      label: this.experienceForm.type,
      icon: this.experienceTypeIcon(this.experienceForm.type),
      palette: this.paletteFromProfileTone(this.experienceTypeToneClass(this.experienceForm.type)),
      shape: 'field',
      ariaLabel: 'Open experience type selector'
    };
  }

  protected experienceTypeMenuItems(): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return this.experienceTypeOptions.map(option => ({
      id: this.menuItemId('experience-type', option),
      label: option,
      icon: this.experienceTypeIcon(option),
      kind: 'radio',
      active: option === this.experienceForm.type,
      palette: this.paletteFromProfileTone(this.experienceTypeToneClass(option)),
      surface: 'tinted',
      context: { kind: 'experienceType', value: option }
    }));
  }

  protected valuesDetailMenuTrigger(row: ProfileContracts.ProfileDetailFormRow): AppMenuTrigger {
    const selected = this.parseCommaValues(row.value);
    return {
      icon: 'auto_awesome',
      palette: this.paletteFromProfileTone(this.valuesDominantToneClass(row.value)),
      shape: 'field',
      ariaLabel: selected.length > 0 ? 'open.values.selector' : 'select.values'
    };
  }

  protected valuesDetailMenuModel(
    groupIndex: number,
    rowIndex: number,
    row: ProfileContracts.ProfileDetailFormRow
  ): AppMenuModel<ProfileEditorMenuId, ProfileEditorMenuContext> {
    return buildTabbedMenuModel<ProfileEditorMenuId, ProfileEditorMenuContext>({
      idPrefix: `profile-values-${groupIndex}-${rowIndex}`,
      groups: this.beliefsValuesOptionGroups,
      selected: this.parseCommaValues(row.value),
      context: value => ({ kind: 'valuesOption', groupIndex, rowIndex, value }),
      summary: {
        emptyLabel: 'select.values',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected interestDetailMenuTrigger(row: ProfileContracts.ProfileDetailFormRow): AppMenuTrigger {
    const selected = this.parseCommaValues(row.value);
    return {
      icon: 'sell',
      palette: this.paletteFromProfileTone(this.interestDominantToneClass(row.value)),
      shape: 'field',
      ariaLabel: selected.length > 0 ? 'open.interests.selector' : 'select.interests'
    };
  }

  protected interestDetailMenuModel(
    groupIndex: number,
    rowIndex: number,
    row: ProfileContracts.ProfileDetailFormRow
  ): AppMenuModel<ProfileEditorMenuId, ProfileEditorMenuContext> {
    return buildTabbedMenuModel<ProfileEditorMenuId, ProfileEditorMenuContext>({
      idPrefix: `profile-interest-${groupIndex}-${rowIndex}`,
      groups: this.interestOptionGroups,
      selected: this.parseCommaValues(row.value),
      context: value => ({ kind: 'interestOption', groupIndex, rowIndex, value }),
      summary: {
        emptyLabel: 'select.interests',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected languageMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'language',
      palette: 'blue',
      shape: 'field',
      ariaLabel: this.profileForm.languages.length > 0 ? 'open.languages.selector' : 'select.languages'
    };
  }

  protected languageMenuModel(): AppMenuModel<ProfileEditorMenuId, ProfileEditorMenuContext> {
    return buildTabbedMenuModel<ProfileEditorMenuId, ProfileEditorMenuContext>({
      idPrefix: 'profile-language',
      groups: [{
        title: 'Languages',
        shortTitle: 'Languages',
        toneClass: 'section-languages',
        options: this.languageMenuOptions()
      }],
      selected: this.profileForm.languages,
      context: value => ({ kind: 'languageOption', value }),
      summary: {
        emptyLabel: 'select.languages',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected onProfileEditorMenuSelect(
    event: AppMenuItemSelectEvent<ProfileEditorMenuId, ProfileEditorMenuContext>
  ): void {
    const context = event.context;
    if (!context) {
      return;
    }

    switch (context.kind) {
      case 'profileStatus':
        this.profileForm.profileStatus = context.value;
        return;
      case 'physique':
        this.profileForm.physique = context.value;
        return;
      case 'detailValue': {
        const row = this.profileDetailsForm[context.groupIndex]?.rows[context.rowIndex];
        if (row && row.options.includes(context.value)) {
          row.value = context.value;
        }
        return;
      }
      case 'detailPrivacy': {
        const row = this.profileDetailsForm[context.groupIndex]?.rows[context.rowIndex];
        if (!row) {
          return;
        }
        row.privacy = context.value;
        const key = this.detailPrivacyFabKey(context.groupIndex, context.rowIndex);
        this.markPrivacyFabJustSelected(key);
        return;
      }
      case 'experiencePrivacy':
        this.experienceVisibility[context.type] = context.value;
        return;
      case 'experienceFilter':
        this.experienceFilter = context.value;
        return;
      case 'experienceType':
        this.experienceForm.type = context.value;
        return;
      case 'experienceQuickAction':
        if (context.action === 'create') {
          this.openExperienceCreateAction(event.sourceEvent);
          return;
        }
        this.openExperienceUploadAction(event.sourceEvent);
        return;
      case 'languageOption':
        this.toggleLanguageOption(context.value, event.action === 'remove');
        return;
      case 'valuesOption':
        this.updateMultiValueDetailRow(
          context.groupIndex,
          context.rowIndex,
          context.value,
          this.beliefsValuesAllOptions(),
          event.action === 'remove'
        );
        return;
      case 'interestOption':
        this.updateMultiValueDetailRow(
          context.groupIndex,
          context.rowIndex,
          context.value,
          this.interestAllOptions(),
          event.action === 'remove'
        );
        return;
    }
  }

  protected onProfileEditorDispatchedMenuSelect(
    event: AppMenuItemSelectEvent<ProfileEditorMenuId, unknown>
  ): void {
    this.onProfileEditorMenuSelect(event as AppMenuItemSelectEvent<ProfileEditorMenuId, ProfileEditorMenuContext>);
  }

  protected onExperienceImportFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) {
      return;
    }
    void this.prepareExperienceImport(file);
  }

  protected cancelExperienceImportDialog(): void {
    if (this.experienceImportDialog.busy && this.experienceImportDialog.progress.stage === 'saving') {
      return;
    }
    this.experienceImportToken += 1;
    this.experienceImportDialog = this.createEmptyExperienceImportDialogState();
  }

  protected submitExperienceImport(): void {
    if (!this.canSubmitExperienceImport || !this.profileUser || !this.experienceImportDialog.draft) {
      return;
    }
    const activeRequestToken = ++this.experienceImportToken;
    const draft = this.experienceImportDialog.draft;
    this.experienceImportDialog = {
      ...this.experienceImportDialog,
      busy: true,
      progress: {
        stage: 'saving',
        percent: 100,
        label: 'Saving imported experience batch'
      }
    };
    void this.persistExperienceEntries(draft.nextEntries, {
      highlightedIds: draft.importedIds,
      onComplete: () => {
        if (activeRequestToken !== this.experienceImportToken) {
          return;
        }
        this.experienceFilter = 'All';
        this.experienceImportDialog = this.createEmptyExperienceImportDialogState();
        this.cdr.markForCheck();
      }
    });
  }

  protected isExperienceEntryHighlighted(entryId: string): boolean {
    return this.highlightedImportedExperienceIds.has(entryId);
  }

  protected experienceImportTypeCount(type: ProfileContracts.ExperienceEntry['type']): number {
    return this.experienceImportDialog.statistics.countsByType[type] ?? 0;
  }

  protected profileStatusClass(value: AppConstants.ProfileStatus = this.profileForm.profileStatus): string {
    switch (value) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      default:
        return 'status-inactive';
    }
  }

  protected completionBadgeStyle(value: number): Record<string, string> {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const hue = Math.round((clamped / 100) * 120);
    return {
      background: `hsl(${hue}, 82%, 84%)`,
      borderColor: `hsl(${hue}, 70%, 58%)`,
      color: `hsl(${hue}, 74%, 24%)`
    };
  }

  protected getProfileStatusIcon(value: AppConstants.ProfileStatus = this.profileForm.profileStatus): string {
    switch (value) {
      case 'public':
        return 'public';
      case 'friends only':
        return 'groups';
      case 'host only':
        return 'stadium';
      default:
        return 'visibility_off';
    }
  }

  protected getPhysiqueIcon(value: string): string {
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

  protected getPhysiqueClass(value: string): string {
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

  protected getHoroscopeSymbol(value: string): string {
    switch (value) {
      case 'Aries':
        return '♈';
      case 'Taurus':
        return '♉';
      case 'Gemini':
        return '♊';
      case 'Cancer':
        return '♋';
      case 'Leo':
        return '♌';
      case 'Virgo':
        return '♍';
      case 'Libra':
        return '♎';
      case 'Scorpio':
        return '♏';
      case 'Sagittarius':
        return '♐';
      case 'Capricorn':
        return '♑';
      case 'Aquarius':
        return '♒';
      default:
        return '♓';
    }
  }

  protected getHoroscopeClass(value: string): string {
    return `zodiac-${AppUtils.normalizeText(value).replace(/\s+/g, '-')}`;
  }

  protected onBirthdayChange(value: Date | null): void {
    this.profileForm.birthday = value;
    this.profileForm.horoscope = value ? AppUtils.horoscopeByDate(value) : '';
  }

  private toggleLanguageOption(value: string, removeOnly: boolean): void {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return;
    }
    const exists = this.profileForm.languages.some(item => item.toLowerCase() === normalizedValue.toLowerCase());
    if (exists) {
      this.profileForm.languages = this.profileForm.languages.filter(item => item.toLowerCase() !== normalizedValue.toLowerCase());
      return;
    }
    if (!removeOnly) {
      this.profileForm.languages = [...this.profileForm.languages, normalizedValue];
    }
  }

  private languageMenuOptions(): readonly string[] {
    const optionByKey = new Map<string, string>();
    for (const option of [...this.languageSuggestions, ...this.profileForm.languages]) {
      const normalized = option.trim();
      if (!normalized) {
        continue;
      }
      optionByKey.set(normalized.toLowerCase(), normalized);
    }
    return [...optionByKey.values()];
  }

  protected isDetailPrivacyJustSelected(groupIndex: number, rowIndex: number): boolean {
    return this.privacyFabJustSelectedKey === this.detailPrivacyFabKey(groupIndex, rowIndex);
  }

  protected detailPrivacyMenuId(groupIndex: number, rowIndex: number): string {
    return `profile-detail-privacy-${groupIndex}-${rowIndex}`;
  }

  protected experienceVisibilityValue(type: 'workspace' | 'school'): AppConstants.DetailPrivacy {
    return this.experienceVisibility[type];
  }

  private updateMultiValueDetailRow(
    groupIndex: number,
    rowIndex: number,
    option: string,
    allowedOptions: readonly string[],
    removeOnly: boolean
  ): void {
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row || !this.containsNormalizedOption(allowedOptions, option)) {
      return;
    }

    const current = this.parseCommaValues(row.value)
      .filter(item => this.containsNormalizedOption(allowedOptions, item))
      .slice(0, 5);
    const normalizedOption = this.normalizeTopicToken(option);
    const existingIndex = current.findIndex(item => this.normalizeTopicToken(item) === normalizedOption);

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else if (!removeOnly && current.length < 5) {
      current.push(option);
    }

    row.value = current.join(', ');
  }

  private containsNormalizedOption(options: readonly string[], value: string): boolean {
    const normalizedValue = this.normalizeTopicToken(value);
    return options.some(option => this.normalizeTopicToken(option) === normalizedValue);
  }

  protected valuesOptionToneClass(option: string): string {
    for (const group of this.beliefsValuesOptionGroups) {
      if (group.options.includes(option)) {
        return group.toneClass;
      }
    }
    return '';
  }

  protected interestOptionToneClass(option: string): string {
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

  protected detailOptionClass(labelKey: string, option: string, options: string[]): string {
    if (labelKey === 'profile.details.values') {
      return this.valuesDominantToneClass(option);
    }
    if (labelKey === 'profile.details.interest') {
      return this.interestDominantToneClass(option);
    }
    return this.detailToneFromOptions(option, options);
  }

  protected detailSelectedClass(labelKey: string, value: string, options: string[]): string {
    if (labelKey === 'profile.details.values') {
      return this.valuesDominantToneClass(value);
    }
    if (labelKey === 'profile.details.interest') {
      return this.interestDominantToneClass(value);
    }
    return this.detailToneFromOptions(value, options);
  }

  protected detailOptionIcon(labelKey: string, option: string): string {
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
        return 'cat';
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
    if (normalizedLabel === 'gender') {
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

  protected privacyStatusClass(value: AppConstants.DetailPrivacy): string {
    switch (value) {
      case 'Public':
        return 'status-public';
      case 'Friends':
        return 'status-friends';
      case 'Hosts':
        return 'status-host';
      default:
        return 'status-inactive';
    }
  }

  protected privacyStatusIcon(value: AppConstants.DetailPrivacy): string {
    switch (value) {
      case 'Public':
        return 'public';
      case 'Friends':
        return 'groups';
      case 'Hosts':
        return 'stadium';
      default:
        return 'visibility_off';
    }
  }

  protected experienceTypeIcon(type: ProfileContracts.ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'apartment';
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      default:
        return 'rocket_launch';
    }
  }

  protected experienceTypeClass(type: ProfileContracts.ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'experience-card-workspace';
      case 'School':
        return 'experience-card-school';
      case 'Online Session':
        return 'experience-card-online';
      default:
        return 'experience-card-project';
    }
  }

  protected experienceFilterIcon(option: ProfileContracts.ExperienceFilter): string {
    switch (option) {
      case 'Workspace':
        return 'apartment';
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      case 'Additional Project':
        return 'rocket_launch';
      default:
        return 'filter_alt';
    }
  }

  protected experienceFilterClass(option: ProfileContracts.ExperienceFilter): string {
    switch (option) {
      case 'Workspace':
        return 'experience-filter-workspace';
      case 'School':
        return 'experience-filter-school';
      case 'Online Session':
        return 'experience-filter-online';
      case 'Additional Project':
        return 'experience-filter-project';
      default:
        return 'experience-filter-all';
    }
  }

  protected experienceTypeToneClass(type: ProfileContracts.ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'experience-filter-workspace';
      case 'School':
        return 'experience-filter-school';
      case 'Online Session':
        return 'experience-filter-online';
      default:
        return 'experience-filter-project';
    }
  }

  protected openExperienceForm(entry?: ProfileContracts.ExperienceEntry): void {
    this.pendingExperienceDeleteId = null;
    this.showExperienceForm = true;
    if (entry) {
      this.editingExperienceId = entry.id;
      this.experienceForm = {
        type: entry.type,
        title: entry.title,
        org: entry.org,
        city: entry.city,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo === 'Present' ? '' : entry.dateTo,
        description: entry.description
      };
      this.experienceRangeStart = AppUtils.fromYearMonth(entry.dateFrom);
      this.experienceRangeEnd = entry.dateTo === 'Present' ? null : AppUtils.fromYearMonth(entry.dateTo);
      return;
    }
    this.editingExperienceId = null;
    this.resetExperienceForm();
  }

  protected closeExperienceForm(): void {
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
  }

  protected saveExperienceEntry(): void {
    if (!this.experienceForm.title.trim() || !this.experienceForm.org.trim() || !this.experienceRangeStart) {
      return;
    }
    const dateFrom = AppUtils.toYearMonth(this.experienceRangeStart);
    if (!dateFrom) {
      return;
    }
    const dateTo = this.experienceRangeEnd ? AppUtils.toYearMonth(this.experienceRangeEnd) : 'Present';
    const payload: Omit<ProfileContracts.ExperienceEntry, 'id'> = {
      ...this.experienceForm,
      dateFrom,
      title: this.experienceForm.title.trim(),
      org: this.experienceForm.org.trim(),
      city: this.experienceForm.city.trim(),
      dateTo: dateTo || 'Present',
      description: this.experienceForm.description.trim()
    };
    const nextEntries = this.editingExperienceId
      ? this.experienceEntries.map(item =>
        item.id === this.editingExperienceId
          ? { ...item, ...payload }
          : item
      )
      : [
          ...this.experienceEntries,
          { id: this.createExperienceId(), ...payload }
        ];
    this.setExperienceEntries(nextEntries);
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    void this.persistExperienceEntries(nextEntries);
  }

  protected requestExperienceDelete(entryId: string): void {
    this.pendingExperienceDeleteId = entryId;
  }

  protected cancelExperienceDelete(): void {
    this.pendingExperienceDeleteId = null;
  }

  protected confirmExperienceDelete(): void {
    if (!this.pendingExperienceDeleteId) {
      return;
    }
    const nextEntries = this.experienceEntries.filter(item => item.id !== this.pendingExperienceDeleteId);
    this.setExperienceEntries(nextEntries);
    this.pendingExperienceDeleteId = null;
    void this.persistExperienceEntries(nextEntries);
  }

  private loadProfileEditorState(user: UserDto): void {
    this.resetTransientUiState();
    this.profileUser = this.cloneUser(user);
    const birthday = AppUtils.fromIsoDate(user.birthday);
    this.profileDetailsForm = this.profileDetailsForUser(user.id, user);
    this.profileForm = {
      fullName: user.name,
      headline: user.headline,
      birthday,
      city: user.city,
      heightCm: Number.parseInt(user.height, 10) || null,
      physique: user.physique,
      languages: [...(user.languages ?? [])],
      horoscope: birthday ? AppUtils.horoscopeByDate(birthday) : user.horoscope,
      profileStatus: user.profileStatus,
      about: user.about
    };
    this.syncProfileBasicsIntoDetailRows(user);
    const slots = this.profileImageSlotsByUser[user.id] ?? this.resolveUserImageSlots(user);
    this.profileImageSlotsByUser[user.id] = [...slots];
    this.imageSlots = [...slots];
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    this.selectedImageIndex = firstFilled >= 0 ? firstFilled : 0;
    this.setExperienceEntries(this.experienceEntriesByUser[user.id] ?? [], []);
    this.panel = 'profile';
    void this.loadExperienceEntriesForUser(user.id);
  }

  private createEmptyProfileForm(): ProfileFormState {
    return {
      fullName: '',
      headline: '',
      birthday: null,
      city: '',
      heightCm: null,
      physique: '',
      languages: [],
      horoscope: '',
      profileStatus: 'public',
      about: ''
    };
  }

  private createEmptyImageSlots(): Array<string | null> {
    return Array.from({ length: 8 }, () => null);
  }

  private resolveUserImageSlots(user: UserDto): Array<string | null> {
    const slots = this.createEmptyImageSlots();
    const explicitImages = (user.images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0)
      .slice(0, 8);
    explicitImages.forEach((url, index) => {
      slots[index] = url;
    });
    return slots;
  }

  private profileDetailsForUser(userId: string, user?: UserDto): ProfileContracts.ProfileDetailFormGroup[] {
    const existing = this.profileDetailsFormByUser[userId];
    if (existing) {
      return existing;
    }
    if (!user) {
      return [];
    }
    const generated = this.createProfileDetailsFormForUser(user);
    this.profileDetailsFormByUser[userId] = generated;
    return generated;
  }

  private createProfileDetailsFormForUser(user: UserDto): ProfileContracts.ProfileDetailFormGroup[] {
    const persisted = this.hydratePersistedProfileDetails(user);
    if (persisted.length > 0) {
      return persisted;
    }
    const beliefsValuesOptions = this.beliefsValuesAllOptions();
    const interestOptions = this.interestAllOptions();
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        labelKey: row.labelKey,
        value: this.profileDetailSeedValue(user, row.labelKey, ''),
        privacy: row.privacy,
        options:
          row.labelKey === 'profile.details.values'
            ? beliefsValuesOptions
            : row.labelKey === 'profile.details.interest'
              ? interestOptions
              : this.profileDetailValueOptions[row.labelKey] ?? [this.profileDetailSeedValue(user, row.labelKey, '')]
      }))
    }));
  }

  private hydratePersistedProfileDetails(user: UserDto): ProfileContracts.ProfileDetailFormGroup[] {
    if (!Array.isArray(user.profileDetails) || user.profileDetails.length === 0) {
      return [];
    }
    const rowByKey = new Map<string, ProfileContracts.ProfileDetailFormRow>();
    for (const group of user.profileDetails) {
      for (const row of group.rows ?? []) {
        const normalizedKey = AppUtils.normalizeText(`${row.labelKey ?? ''}`.trim());
        if (!normalizedKey) {
          continue;
        }
        rowByKey.set(normalizedKey, {
          labelKey: row.labelKey,
          value: row.value,
          privacy: this.isDetailPrivacy(row.privacy) ? row.privacy : 'Public',
          options: [...(row.options ?? [])]
        });
      }
    }
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => {
        const persisted = rowByKey.get(AppUtils.normalizeText(row.labelKey));
        return {
          labelKey: row.labelKey,
          value: persisted?.value ?? this.profileDetailSeedValue(user, row.labelKey, ''),
          privacy: persisted?.privacy ?? row.privacy,
          options: this.profileDetailOptionsForKey(row.labelKey, persisted?.options ?? [])
        };
      })
    }));
  }

  private profileDetailOptionsForKey(labelKey: string, persistedOptions: readonly string[] = []): string[] {
    const defaults = labelKey === 'profile.details.values'
      ? this.beliefsValuesAllOptions()
      : labelKey === 'profile.details.interest'
        ? this.interestAllOptions()
        : this.profileDetailValueOptions[labelKey] ?? [];
    const merged = [...defaults];
    for (const option of persistedOptions) {
      const normalized = option.trim();
      if (normalized && !merged.includes(normalized)) {
        merged.push(normalized);
      }
    }
    return merged;
  }

  private profileDetailSeedValue(user: UserDto, labelKey: string, fallback: string): string {
    switch (labelKey) {
      case 'profile.name':
        return user.name;
      case 'profile.city':
        return user.city;
      case 'profile.birthday': {
        const parsed = AppUtils.fromIsoDate(user.birthday);
        return parsed
          ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : fallback;
      }
      case 'profile.height':
        return user.height;
      case 'profile.physique':
        return user.physique;
      case 'profile.languages':
        return user.languages.join(', ');
      case 'profile.horoscope':
        return user.horoscope;
      case 'profile.gender':
        return user.gender === 'woman' ? 'Woman' : 'Man';
      case 'profile.details.interest':
        return this.seededOptionsForUser(user, this.interestAllOptions(), 3, labelKey).join(', ');
      case 'profile.details.values':
        return this.seededOptionsForUser(user, this.beliefsValuesAllOptions(), 3, labelKey).join(', ');
      default: {
        const options = this.profileDetailValueOptions[labelKey] ?? [];
        if (options.length === 0) {
          return fallback;
        }
        return this.seededOptionForUser(user, options, labelKey);
      }
    }
  }

  private profileDetailRowByKey(userId: string, labelKey: string): ProfileContracts.ProfileDetailFormRow | null {
    const target = AppUtils.normalizeText(labelKey);
    for (const group of this.profileDetailsForUser(userId, this.profileUser ?? undefined)) {
      for (const row of group.rows) {
        if (AppUtils.normalizeText(row.labelKey) === target) {
          return row;
        }
      }
    }
    return null;
  }

  private seededOptionForUser(user: UserDto, options: string[], context: string): string {
    if (options.length === 0) {
      return '';
    }
    const seed = AppUtils.hashText(`profile-detail:${user.id}:${context}`);
    return options[seed % options.length] ?? options[0];
  }

  private seededOptionsForUser(user: UserDto, options: string[], count: number, context: string): string[] {
    if (options.length === 0 || count <= 0) {
      return [];
    }
    const start = AppUtils.hashText(`profile-detail-list:${user.id}:${context}`) % options.length;
    const selected: string[] = [];
    let index = start;
    while (selected.length < Math.min(count, options.length)) {
      const option = options[index % options.length];
      if (!selected.includes(option)) {
        selected.push(option);
      }
      index += 3;
    }
    return selected;
  }

  private syncProfileBasicsIntoDetailRows(user: UserDto): void {
    const setRowValue = (labelKey: string, value: string): void => {
      const row = this.profileDetailRowByKey(user.id, labelKey);
      if (!row) {
        return;
      }
      row.value = value;
    };
    const birthdayDate = AppUtils.fromIsoDate(user.birthday);
    setRowValue('profile.name', user.name);
    setRowValue('profile.city', user.city);
    setRowValue(
      'profile.birthday',
      birthdayDate
        ? birthdayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
    );
    setRowValue('profile.height', user.height);
    setRowValue('profile.physique', user.physique);
    setRowValue('profile.languages', user.languages.join(', '));
    setRowValue('profile.horoscope', user.horoscope);
    setRowValue('profile.gender', user.gender === 'woman' ? 'Woman' : 'Man');
  }

  private calculateProfileCompletionPercent(): number {
    const activeUserId = this.profileUser?.id?.trim() ?? '';
    if (!activeUserId) {
      return 0;
    }

    let completed = 0;
    let total = 0;
    const add = (ok: boolean): void => {
      total += 1;
      if (ok) {
        completed += 1;
      }
    };
    const hasDetail = (labelKey: string, minLength = 1): boolean => {
      const row = this.profileDetailRowByKey(activeUserId, labelKey);
      return AppUtils.hasText(row?.value, minLength);
    };

    const languages = this.profileForm.languages.filter(item => AppUtils.hasText(item));
    const imageCount = this.imageSlots.filter(slot => AppUtils.hasText(slot ?? '')).length;
    const valuesCount = this.parseCommaValues(this.profileDetailRowByKey(activeUserId, 'profile.details.values')?.value ?? '').length;
    const interestCount = this.parseCommaValues(this.profileDetailRowByKey(activeUserId, 'profile.details.interest')?.value ?? '').length;
    const aboutLength = this.profileForm.about.trim().length;

    add(AppUtils.hasText(this.profileForm.fullName));
    add(this.profileForm.birthday instanceof Date);
    add(AppUtils.hasText(this.profileForm.city));
    add((this.profileForm.heightCm ?? 0) > 0);
    add(AppUtils.hasText(this.profileForm.physique));
    add(AppUtils.hasText(this.profileForm.horoscope));
    add(AppUtils.hasText(this.profileForm.profileStatus));
    add(languages.length > 0);
    add(languages.length > 1);
    add(languages.length > 2);
    add(aboutLength >= 20);
    add(aboutLength >= 80);
    add(aboutLength >= 140);
    add(valuesCount > 0);
    add(valuesCount >= 3);
    add(interestCount > 0);
    add(interestCount >= 3);
    add(hasDetail('profile.details.drinking'));
    add(hasDetail('profile.details.smoking'));
    add(hasDetail('profile.details.workout'));
    add(hasDetail('profile.details.pets'));
    add(hasDetail('profile.details.familyPlans'));
    add(hasDetail('profile.details.children'));
    add(hasDetail('profile.details.loveStyle'));
    add(hasDetail('profile.details.communicationStyle'));
    add(hasDetail('profile.details.sexualOrientation'));
    add(hasDetail('profile.details.religion'));
    add(hasDetail('profile.gender'));

    for (let index = 0; index < 8; index += 1) {
      add(imageCount > index);
    }

    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }

  private parseCommaValues(value: string): string[] {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
  }

  private normalizeTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  private detailToneFromOptions(value: string, options: string[]): string {
    const index = options.findIndex(item => AppUtils.normalizeText(item) === AppUtils.normalizeText(value));
    return `detail-tone-${((index >= 0 ? index : 0) % 8) + 1}`;
  }

  private valuesDominantToneClass(value: string): string {
    const selected = this.parseCommaValues(value);
    if (selected.length === 0) {
      return 'section-beliefs';
    }
    const counts: Record<string, number> = {};
    for (const option of selected) {
      const tone = this.valuesOptionToneClass(option);
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
      return this.valuesOptionToneClass(selected[0]) || 'section-beliefs';
    }
    return bestTone;
  }

  private interestDominantToneClass(value: string): string {
    const selected = this.parseCommaValues(value);
    if (selected.length === 0) {
      return 'section-social';
    }
    const counts: Record<string, number> = {};
    for (const option of selected) {
      const tone = this.interestOptionToneClass(option);
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
      return this.interestOptionToneClass(selected[0]) || 'section-social';
    }
    return bestTone;
  }

  private privacyMenuTrigger(value: AppConstants.DetailPrivacy, ariaLabel: string): AppMenuTrigger {
    return {
      icon: this.privacyStatusIcon(value),
      closeIcon: 'close',
      hideLabel: true,
      shape: 'icon',
      palette: this.privacyPalette(value),
      ariaLabel
    };
  }

  private profileStatusPalette(value: AppConstants.ProfileStatus): AppMenuPalette {
    switch (value) {
      case 'public':
        return 'green';
      case 'friends only':
        return 'blue';
      case 'host only':
        return 'brown';
      case 'blocked':
      case 'deleted':
        return 'red';
      default:
        return 'muted';
    }
  }

  private privacyPalette(value: AppConstants.DetailPrivacy): AppMenuPalette {
    switch (value) {
      case 'Public':
        return 'green';
      case 'Friends':
        return 'blue';
      case 'Hosts':
        return 'brown';
      default:
        return 'muted';
    }
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
      case 'section-social':
      case 'experience-filter-all':
      case 'experience-filter-school':
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
      case 'experience-filter-workspace':
        return 'orange';
      case 'section-ambition':
        return 'amber';
      case 'section-lifestyle':
      case 'section-mind':
      case 'experience-filter-online':
        return 'teal';
      case 'section-beliefs':
        return 'purple';
      case 'detail-tone-4':
      case 'section-arts':
      case 'experience-filter-project':
        return 'violet';
      case 'section-identity':
        return 'cyan';
      case 'status-inactive':
      default:
        return 'muted';
    }
  }

  private menuItemId(prefix: string, value: string): string {
    const normalized = AppUtils.normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${prefix}:${normalized || 'item'}`;
  }

  private markPrivacyFabJustSelected(key: string): void {
    this.privacyFabJustSelectedKey = key;
    setTimeout(() => {
      if (this.privacyFabJustSelectedKey === key) {
        this.privacyFabJustSelectedKey = null;
      }
    }, 280);
  }

  private isDetailPrivacy(value: string): value is AppConstants.DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  private detailPrivacyFabKey(groupIndex: number, rowIndex: number): string {
    return `${groupIndex}-${rowIndex}`;
  }

  private resetExperienceForm(): void {
    this.experienceForm = {
      type: 'Workspace',
      title: '',
      org: '',
      city: '',
      dateFrom: '',
      dateTo: '',
      description: ''
    };
    this.experienceRangeStart = null;
    this.experienceRangeEnd = null;
  }

  private createEmptyExperienceImportDialogState(): ExperienceImportDialogState {
    return {
      visible: false,
      fileName: '',
      busy: false,
      progress: {
        stage: 'ready',
        percent: 0,
        label: ''
      },
      statistics: this.createEmptyExperienceImportStatistics(),
      warnings: [],
      error: null,
      draft: null
    };
  }

  private createEmptyExperienceImportStatistics(): ExperienceImportStatistics {
    return {
      detectedCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      countsByType: {
        Workspace: 0,
        School: 0,
        'Online Session': 0,
        'Additional Project': 0
      }
    };
  }

  private cloneExperienceEntries(entries: readonly ProfileContracts.ExperienceEntry[]): ProfileContracts.ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }

  private setExperienceEntries(
    entries: readonly ProfileContracts.ExperienceEntry[],
    highlightedIds: readonly string[] | null = null
  ): void {
    const nextEntries = this.cloneExperienceEntries(entries);
    this.experienceEntries = nextEntries;
    if (this.profileUser) {
      this.experienceEntriesByUser[this.profileUser.id] = this.cloneExperienceEntries(nextEntries);
    }
    if (highlightedIds) {
      const validIds = new Set(nextEntries.map(entry => entry.id));
      this.highlightedImportedExperienceIds = new Set(highlightedIds.filter(id => validIds.has(id)));
      return;
    }
    this.pruneHighlightedExperienceIds(nextEntries);
  }

  private pruneHighlightedExperienceIds(entries: readonly ProfileContracts.ExperienceEntry[]): void {
    if (this.highlightedImportedExperienceIds.size === 0) {
      return;
    }
    const validIds = new Set(entries.map(entry => entry.id));
    this.highlightedImportedExperienceIds = new Set(
      [...this.highlightedImportedExperienceIds].filter(id => validIds.has(id))
    );
  }

  private createExperienceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `exp-${crypto.randomUUID()}`;
    }
    return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async loadExperienceEntriesForUser(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      this.setExperienceEntries([], []);
      return;
    }

    const requestToken = ++this.experienceEntriesLoadToken;
    try {
      const loadedEntries = await this.userExperiencesService.loadUserExperiences(normalizedUserId);
      if (requestToken !== this.experienceEntriesLoadToken || this.profileUser?.id !== normalizedUserId) {
        return;
      }
      this.setExperienceEntries(loadedEntries, []);
      this.cdr.markForCheck();
    } catch {
      if (requestToken !== this.experienceEntriesLoadToken || this.profileUser?.id !== normalizedUserId) {
        return;
      }
      this.setExperienceEntries(this.experienceEntriesByUser[normalizedUserId] ?? [], []);
      this.cdr.markForCheck();
    }
  }

  private async prepareExperienceImport(file: File): Promise<void> {
    const importToken = ++this.experienceImportToken;
    this.experienceImportDialog = {
      ...this.createEmptyExperienceImportDialogState(),
      visible: true,
      fileName: file.name,
      busy: true,
      progress: {
        stage: 'reading',
        percent: 0,
        label: 'Preparing import preview'
      }
    };
    this.cdr.markForCheck();

    try {
      const draft = await this.userExperiencesService.prepareUserExperienceImport(
        file,
        this.experienceEntries,
        progress => {
          if (importToken !== this.experienceImportToken) {
            return;
          }
          this.experienceImportDialog = {
            ...this.experienceImportDialog,
            visible: true,
            fileName: file.name,
            busy: true,
            progress,
            error: null
          };
          this.cdr.markForCheck();
        }
      );
      if (importToken !== this.experienceImportToken) {
        return;
      }
      this.experienceImportDialog = {
        visible: true,
        fileName: file.name,
        busy: false,
        progress: {
          stage: 'ready',
          percent: 100,
          label: draft.statistics.detectedCount > 0 ? 'Import preview ready' : 'No experience items recognized'
        },
        statistics: draft.statistics,
        warnings: [...draft.warnings],
        error: null,
        draft
      };
      this.cdr.markForCheck();
    } catch (error) {
      if (importToken !== this.experienceImportToken) {
        return;
      }
      this.experienceImportDialog = {
        ...this.createEmptyExperienceImportDialogState(),
        visible: true,
        fileName: file.name,
        error: this.resolveExperienceImportError(error),
        progress: {
          stage: 'ready',
          percent: 100,
          label: 'Import preview unavailable'
        }
      };
      this.cdr.markForCheck();
    }
  }

  private async persistExperienceEntries(
    entries: readonly ProfileContracts.ExperienceEntry[],
    options?: { highlightedIds?: readonly string[]; onComplete?: () => void }
  ): Promise<void> {
    const userId = this.profileUser?.id?.trim() ?? '';
    if (!userId) {
      return;
    }

    const requestToken = ++this.experienceEntriesSaveToken;
    const savedEntries = await this.userExperiencesService.saveUserExperiences(userId, entries);
    if (requestToken !== this.experienceEntriesSaveToken || this.profileUser?.id !== userId) {
      return;
    }
    this.setExperienceEntries(savedEntries.length > 0 ? savedEntries : entries, options?.highlightedIds ?? null);
    options?.onComplete?.();
    this.cdr.markForCheck();
  }

  private resolveExperienceImportError(error: unknown): string {
    if (error instanceof Error) {
      const normalizedMessage = error.message.trim();
      if (normalizedMessage) {
        return normalizedMessage;
      }
    }
    return 'Invalid document. Please upload a PDF, DOC, DOCX, ODT, RTF, or TXT file.';
  }

  private persistActiveUserImageSlots(): void {
    this.syncActiveUserImageSlotsState();
    if (this.profileUser) {
      void this.usersService.saveUserProfile(this.cloneUser(this.profileUser));
    }
  }

  private collectPersistedProfileImages(existingImages: readonly string[] = []): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();
    const pushIfValid = (value: string | null | undefined): void => {
      const normalized = value?.trim() ?? '';
      if (!normalized || seen.has(normalized)) {
        return;
      }
      merged.push(normalized);
      seen.add(normalized);
    };
    for (const image of existingImages) {
      pushIfValid(image);
    }
    for (const slot of this.imageSlots) {
      pushIfValid(slot);
    }
    return merged;
  }

  private syncActiveUserImageSlotsState(preserveExisting = false): void {
    if (!this.profileUser) {
      return;
    }
    const user = this.cloneUser(this.profileUser);
    const previousImages = [...(user.images ?? [])];
    this.profileImageSlotsByUser[user.id] = [...this.imageSlots];
    const nextImages = this.collectPersistedProfileImages();
    if (!preserveExisting) {
      user.images = nextImages;
    } else {
      const merged: string[] = [];
      const pushed = new Set<string>();
      for (const image of previousImages) {
        const normalized = image?.trim() ?? '';
        if (!normalized) {
          continue;
        }
        merged.push(normalized);
        pushed.add(normalized);
      }
      for (const image of nextImages) {
        const normalized = image?.trim() ?? '';
        if (!normalized || pushed.has(normalized)) {
          continue;
        }
        merged.push(normalized);
        pushed.add(normalized);
      }
      user.images = merged;
    }
    user.completion = this.calculateProfileCompletionPercent();
    this.pushProfileUserToContextAndLegacyMirror(user);
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
    if (!this.profileUser) {
      return;
    }
    const userId = this.profileUser.id;
    const previousImage = this.imageSlots[slotIndex] ?? null;
    this.uploadingImageSlotIndex = slotIndex;
    this.cdr.markForCheck();
    try {
      this.syncActiveUserImageSlotsState(true);
      const uploadResult = await this.mediaService.uploadImage(userId, `profile-${slotIndex}`, file);
      const uploadedImageUrl = uploadResult.imageUrl?.trim() ?? '';
      if (!uploadResult.uploaded || !uploadedImageUrl) {
        this.confirmationDialogService.openInfo('Unable to upload image', {
          title: 'Upload failed',
          confirmTone: 'neutral'
        });
        return;
      }
      this.revokeObjectUrl(previousImage);
      this.imageSlots[slotIndex] = uploadedImageUrl;
      this.selectedImageIndex = this.resolveSelectedImageIndexAfterUpload(slotIndex);
      this.syncActiveUserImageSlotsState(false);
      if (this.profileUser) {
        await this.usersService.saveUserProfile(this.cloneUser(this.profileUser));
      }
    } finally {
      this.uploadingImageSlotIndex = null;
      this.cdr.markForCheck();
    }
  }

  private resolveSelectedImageIndexAfterUpload(slotIndex: number): number {
    if (slotIndex >= 0 && slotIndex < this.imageSlots.length && this.imageSlots[slotIndex]) {
      return slotIndex;
    }
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    return firstFilled >= 0 ? firstFilled : 0;
  }

  private revokeObjectUrl(value: string | null): void {
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  }

  private async commitProfileForm(showAlert: boolean): Promise<void> {
    if (!this.profileUser) {
      return;
    }
    if (this.isAdminProfile()) {
      await this.commitAdminProfileForm(showAlert);
      return;
    }
    const user = this.cloneUser(this.profileUser);
    user.name = this.profileForm.fullName.trim() || user.name;
    user.headline = this.profileForm.headline.trim() || user.headline;
    const birthday = this.profileForm.birthday ? AppUtils.toIsoDate(this.profileForm.birthday) : user.birthday;
    user.birthday = birthday;
    user.age = AppUtils.ageFromIsoDate(birthday, user.age);
    user.city = this.profileForm.city.trim() || user.city;
    user.height = this.profileForm.heightCm ? `${this.profileForm.heightCm} cm` : user.height;
    user.physique = this.profileForm.physique || user.physique;
    user.languages = this.profileForm.languages.length > 0 ? [...this.profileForm.languages] : user.languages;
    user.horoscope = this.profileForm.horoscope || user.horoscope;
    user.profileStatus = this.profileForm.profileStatus;
    user.about = this.profileForm.about.trim().slice(0, 160);
    user.initials = AppUtils.initialsFromText(user.name);
    user.images = this.collectPersistedProfileImages(user.images ?? []);
    this.syncProfileBasicsIntoDetailRows(user);
    user.profileDetails = this.cloneProfileDetailsForm(this.profileDetailsForm);
    user.completion = this.calculateProfileCompletionPercent();
    user.profileFormVersion = this.profileOnboardingService.currentProfileFormVersion;
    this.profileDetailsFormByUser[user.id] = this.cloneProfileDetailsForm(this.profileDetailsForm);
    this.pushProfileUserToContextAndLegacyMirror(user);
    await this.usersService.saveUserProfile(this.cloneUser(user));
    if (showAlert) {
      this.confirmationDialogService.openInfo('Profile saved', {
        title: 'Profile updated',
        confirmTone: 'neutral'
      });
    }
  }

  private async commitAdminProfileForm(showAlert: boolean): Promise<void> {
    if (!this.profileUser) {
      return;
    }
    const user = this.cloneUser(this.profileUser);
    user.name = this.profileForm.fullName.trim() || user.name;
    user.initials = AppUtils.initialsFromText(user.name);
    user.headline = this.profileForm.headline.trim() || user.headline || 'Moderation workspace';
    user.about = this.profileForm.about.trim().slice(0, 160);
    user.statusText = 'Admin workspace';
    user.hostTier = 'Admin';
    user.completion = 100;
    user.profileFormVersion = this.profileOnboardingService.currentProfileFormVersion;
    this.pushProfileUserToContextAndLegacyMirror(user);
    await this.usersService.saveUserProfile(this.cloneUser(user));
    if (showAlert) {
      this.confirmationDialogService.openInfo('Profile saved', {
        title: 'Profile updated',
        confirmTone: 'neutral'
      });
    }
  }

  private pushProfileUserToContextAndLegacyMirror(user: UserDto): void {
    const normalized = this.cloneUser(user);
    this.profileUser = normalized;
    this.appCtx.setUserProfile(normalized);
    this.navigatorService.syncHydratedUser(this.cloneUser(normalized));
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      profileDetails: user.profileDetails ? this.cloneProfileDetailsForm(user.profileDetails) : undefined,
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0,
        cars: user.activities?.cars ?? 0,
        accommodation: user.activities?.accommodation ?? 0,
        supplies: user.activities?.supplies ?? 0,
        tickets: user.activities?.tickets ?? 0,
        contacts: user.activities?.contacts ?? 0,
        feedback: user.activities?.feedback ?? 0
      },
      impressions: user.impressions
        ? {
            host: user.impressions.host ? { ...user.impressions.host } : undefined,
            member: user.impressions.member ? { ...user.impressions.member } : undefined
          }
        : undefined
    };
  }

  private cloneProfileDetailsForm(groups: ProfileContracts.ProfileDetailFormGroup[]): ProfileContracts.ProfileDetailFormGroup[] {
    return groups.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        labelKey: row.labelKey,
        value: row.value,
        privacy: row.privacy,
        options: [...row.options]
      }))
    }));
  }

  private resetTransientUiState(): void {
    this.menuDispatcher.close();
    this.panel = 'profile';
    this.privacyFabJustSelectedKey = null;
    this.pendingSlotUploadIndex = null;
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.pendingExperienceDeleteId = null;
    this.highlightedImportedExperienceIds = new Set<string>();
    this.cancelExperienceImportDialog();
    this.resetExperienceForm();
  }
}

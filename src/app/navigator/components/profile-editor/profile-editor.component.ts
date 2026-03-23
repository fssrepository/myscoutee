import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, effect, inject } from '@angular/core';
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
import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { AppContext, UsersService, type UserDto } from '../../../shared/core';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { NavigatorService } from '../../navigator.service';

type ProfileEditorPanel = 'profile' | 'image' | 'values' | 'interest' | 'experience';

interface ProfileFormState {
  fullName: string;
  birthday: Date | null;
  city: string;
  heightCm: number | null;
  physique: string;
  languages: string[];
  horoscope: string;
  profileStatus: AppTypes.ProfileStatus;
  about: string;
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
    MatSelectModule
  ],
  providers: [
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateOnly }
  ],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.scss'
})
export class ProfileEditorComponent {
  @ViewChild('slotImageInput') private slotImageInput?: ElementRef<HTMLInputElement>;

  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly appCtx = inject(AppContext);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly navigatorService = inject(NavigatorService);
  private readonly usersService = inject(UsersService);
  private readonly languageSheetHeightCssVar = '--mobile-language-sheet-height';
  private readonly profileDetailsFormByUser: Record<string, AppTypes.ProfileDetailFormGroup[]> = {};
  private readonly profileImageSlotsByUser: Record<string, Array<string | null>> = {};
  private lastLoadedUserId = '';

  protected readonly isOpen = this.navigatorService.profileEditorOpen;
  protected readonly profileStatusOptions = APP_STATIC_DATA.profileStatusOptions;
  protected readonly physiqueOptions = APP_STATIC_DATA.physiqueOptions;
  protected readonly profileDetailValueOptions = APP_STATIC_DATA.profileDetailValueOptions;
  protected readonly beliefsValuesOptionGroups = APP_STATIC_DATA.beliefsValuesOptionGroups;
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;
  protected readonly detailPrivacyOptions = APP_STATIC_DATA.detailPrivacyOptions;
  protected readonly experienceFilterOptions = APP_STATIC_DATA.experienceFilterOptions;
  protected readonly experienceTypeOptions = APP_STATIC_DATA.experienceTypeOptions;
  protected languageSuggestions = [...APP_STATIC_DATA.languageSuggestions];

  protected panel: ProfileEditorPanel = 'profile';
  protected showProfileStatusHeaderPicker = false;
  protected profileUser: UserDto | null = null;
  protected profileForm: ProfileFormState = this.createEmptyProfileForm();
  protected profileDetailsForm: AppTypes.ProfileDetailFormGroup[] = [];
  protected imageSlots: Array<string | null> = this.createEmptyImageSlots();
  protected selectedImageIndex = 0;
  protected pendingSlotUploadIndex: number | null = null;
  protected languageInput = '';
  protected mobileProfileSelectorSheet: AppTypes.MobileProfileSelectorSheet | null = null;
  protected openPrivacyFab: { groupIndex: number; rowIndex: number } | null = null;
  protected openExperiencePrivacyFab: 'workspace' | 'school' | null = null;
  protected privacyFabJustSelectedKey: string | null = null;
  protected valuesSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected valuesSelectorSelected: string[] = [];
  protected interestSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected interestSelectorSelected: string[] = [];
  protected experienceVisibility: Record<'workspace' | 'school', AppTypes.DetailPrivacy> = {
    workspace: 'Public',
    school: 'Public'
  };
  protected experienceEntries: AppTypes.ExperienceEntry[] = APP_STATIC_DATA.profileSampleExperienceEntries.map(item => ({ ...item }));
  protected experienceFilter: 'All' | 'Workspace' | 'School' = 'All';
  protected showExperienceForm = false;
  protected editingExperienceId: string | null = null;
  protected pendingExperienceDeleteId: string | null = null;
  protected experienceRangeStart: Date | null = null;
  protected experienceRangeEnd: Date | null = null;
  protected experienceForm: Omit<AppTypes.ExperienceEntry, 'id'> = {
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
    if (this.showProfileStatusHeaderPicker && !target.closest('.profile-status-header-picker') && !target.closest('.popup-view-fab')) {
      this.showProfileStatusHeaderPicker = false;
    }
    if (this.openPrivacyFab && !target.closest('.profile-details-privacy-fab')) {
      this.openPrivacyFab = null;
    }
    if (this.openExperiencePrivacyFab && !target.closest('.profile-details-privacy-fab')) {
      this.openExperiencePrivacyFab = null;
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onWindowEscape(event: Event): void {
    if (!this.isOpen()) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.stopPropagation();
    this.handleCloseAction();
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

  protected get filteredExperienceEntries(): AppTypes.ExperienceEntry[] {
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

  protected popupTitle(): string {
    switch (this.panel) {
      case 'image':
        return 'Images';
      case 'values':
        return 'Values';
      case 'interest':
        return 'Interest';
      case 'experience':
        return 'Experience';
      default:
        return 'Profile';
    }
  }

  protected handleCloseAction(): void {
    if (this.mobileProfileSelectorSheet) {
      this.closeMobileProfileSelectorSheet();
      return;
    }
    if (this.showExperienceForm) {
      this.closeExperienceForm();
      return;
    }
    if (this.panel !== 'profile') {
      this.panel = 'profile';
      this.openPrivacyFab = null;
      this.openExperiencePrivacyFab = null;
      return;
    }
    this.commitProfileForm(false);
    this.navigatorService.closeProfileEditor();
    this.resetTransientUiState();
  }

  protected onBackdropClose(): void {
    this.handleCloseAction();
  }

  protected toggleProfileStatusHeaderPicker(event?: Event): void {
    event?.stopPropagation();
    this.showProfileStatusHeaderPicker = !this.showProfileStatusHeaderPicker;
  }

  protected selectProfileStatusFromHeader(option: AppTypes.ProfileStatus, event?: Event): void {
    event?.stopPropagation();
    this.profileForm.profileStatus = option;
    this.showProfileStatusHeaderPicker = false;
  }

  protected openImageEditor(): void {
    this.showProfileStatusHeaderPicker = false;
    this.panel = 'image';
  }

  protected openWorkspaceSelector(): void {
    this.openExperienceSelector('Workspace');
  }

  protected openSchoolSelector(): void {
    this.openExperienceSelector('School');
  }

  protected openExperienceSelector(filter: 'All' | 'Workspace' | 'School' = 'All'): void {
    this.experienceFilter = filter;
    this.pendingExperienceDeleteId = null;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    this.panel = 'experience';
  }

  protected openValuesSelector(groupIndex: number, rowIndex: number): void {
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    const allowed = new Set(this.beliefsValuesAllOptions());
    this.valuesSelectorContext = { groupIndex, rowIndex };
    this.valuesSelectorSelected = this.parseCommaValues(row.value)
      .filter(item => allowed.has(item))
      .slice(0, 5);
    this.syncValuesContextToRow();
    this.panel = 'values';
  }

  protected openInterestSelector(groupIndex: number, rowIndex: number): void {
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    const allowed = new Set(this.interestAllOptions());
    this.interestSelectorContext = { groupIndex, rowIndex };
    this.interestSelectorSelected = this.parseCommaValues(row.value)
      .filter(item => allowed.has(item))
      .slice(0, 5);
    this.syncInterestContextToRow();
    this.panel = 'interest';
  }

  protected selectImageSlot(index: number): void {
    this.selectedImageIndex = index;
    if (this.imageSlots[index]) {
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

  protected profileStatusClass(value: AppTypes.ProfileStatus = this.profileForm.profileStatus): string {
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

  protected getProfileStatusIcon(value: AppTypes.ProfileStatus = this.profileForm.profileStatus): string {
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

  protected get isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isNarrowViewport = window.matchMedia('(max-width: 760px)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return isNarrowViewport && hasCoarsePointer;
  }

  protected openMobilePhysiqueSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Physique',
      selected: this.profileForm.physique,
      options: this.physiqueOptions.map(option => ({
        value: option,
        label: option,
        icon: this.getPhysiqueIcon(option),
        toneClass: this.getPhysiqueClass(option)
      })),
      context: { kind: 'physique' }
    };
  }

  protected openMobileLanguageSelector(event: Event): void {
    event.stopPropagation();
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const stableHeight = Math.max(window.innerHeight - 6, 320);
      document.documentElement.style.setProperty(this.languageSheetHeightCssVar, `${stableHeight}px`);
    }
    this.languageInput = '';
    this.mobileProfileSelectorSheet = {
      title: 'Languages',
      selected: '',
      options: this.languageSuggestions.map(option => ({
        value: option,
        label: option,
        icon: 'language'
      })),
      context: { kind: 'language' }
    };
  }

  protected openMobileDetailValueSelector(groupIndex: number, rowIndex: number, event: Event): void {
    event.stopPropagation();
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    this.mobileProfileSelectorSheet = {
      title: row.label,
      selected: row.value,
      options: row.options.map(option => ({
        value: option,
        label: option,
        icon: this.detailOptionIcon(row.label, option),
        toneClass: this.detailOptionClass(row.label, option, row.options)
      })),
      context: { kind: 'detailValue', groupIndex, rowIndex }
    };
  }

  protected openMobileExperienceTypeSelector(event: Event): void {
    event.stopPropagation();
    this.mobileProfileSelectorSheet = {
      title: 'Experience Type',
      selected: this.experienceForm.type,
      options: this.experienceTypeOptions.map(option => ({
        value: option,
        label: option,
        icon: this.experienceTypeIcon(option),
        toneClass: this.experienceTypeToneClass(option)
      })),
      context: { kind: 'experienceType' }
    };
  }

  protected closeMobileProfileSelectorSheet(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.style.removeProperty(this.languageSheetHeightCssVar);
    }
    this.mobileProfileSelectorSheet = null;
  }

  protected submitMobileLanguageAndClose(event: Event): void {
    event.stopPropagation();
    this.addCustomLanguage();
    this.closeMobileProfileSelectorSheet();
  }

  protected isMobileSelectorOptionActive(value: string): boolean {
    const sheet = this.mobileProfileSelectorSheet;
    if (!sheet) {
      return false;
    }
    if (sheet.context.kind === 'language') {
      return this.profileForm.languages.some(item => item.toLowerCase() === value.toLowerCase());
    }
    return sheet.selected === value;
  }

  protected selectMobileProfileSelectorOption(value: string): void {
    const sheet = this.mobileProfileSelectorSheet;
    if (!sheet) {
      return;
    }
    if (sheet.context.kind === 'profileStatus') {
      if (this.profileStatusOptions.some(option => option.value === value)) {
        this.profileForm.profileStatus = value as AppTypes.ProfileStatus;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'physique') {
      if (this.physiqueOptions.includes(value)) {
        this.profileForm.physique = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'language') {
      const exists = this.profileForm.languages.some(item => item.toLowerCase() === value.toLowerCase());
      if (exists) {
        this.profileForm.languages = this.profileForm.languages.filter(item => item.toLowerCase() !== value.toLowerCase());
      } else {
        this.profileForm.languages = [...this.profileForm.languages, value];
      }
      this.languageInput = '';
      this.mobileProfileSelectorSheet = {
        ...sheet,
        selected: this.profileForm.languages.join(', ')
      };
      return;
    }
    if (sheet.context.kind === 'detailPrivacy') {
      const row = this.profileDetailsForm[sheet.context.groupIndex]?.rows[sheet.context.rowIndex];
      if (row && this.isDetailPrivacy(value)) {
        row.privacy = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'experiencePrivacy') {
      if (this.isDetailPrivacy(value)) {
        this.experienceVisibility[sheet.context.type] = value;
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'experienceType') {
      if (this.experienceTypeOptions.includes(value as AppTypes.ExperienceEntry['type'])) {
        this.experienceForm.type = value as AppTypes.ExperienceEntry['type'];
      }
      this.mobileProfileSelectorSheet = null;
      return;
    }
    if (sheet.context.kind === 'detailValue') {
      const row = this.profileDetailsForm[sheet.context.groupIndex]?.rows[sheet.context.rowIndex];
      if (row && row.options.includes(value)) {
        row.value = value;
      }
    }
    this.mobileProfileSelectorSheet = null;
  }

  protected addCustomLanguage(value = this.languageInput): void {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    if (!this.profileForm.languages.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.profileForm.languages = [...this.profileForm.languages, normalized];
    }
    if (!this.languageSuggestions.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.languageSuggestions.push(normalized);
    }
    this.languageInput = '';
  }

  protected onLanguageInputBlur(): void {
    this.addCustomLanguage();
  }

  protected onLanguageInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    this.addCustomLanguage();
  }

  protected removeLanguage(value: string): void {
    this.profileForm.languages = this.profileForm.languages.filter(item => item !== value);
  }

  protected languageTriggerLabel(): string {
    if (this.profileForm.languages.length === 0) {
      return '';
    }
    if (this.profileForm.languages.length === 1) {
      return this.profileForm.languages[0];
    }
    return `${this.profileForm.languages[0]} +${this.profileForm.languages.length - 1}`;
  }

  protected languageTriggerPrimaryLabel(maxVisible = 2): string {
    const languages = this.profileForm.languages
      .map(item => item.trim())
      .filter(item => item.length > 0);
    if (languages.length === 0) {
      return '';
    }
    return languages.slice(0, Math.max(1, maxVisible)).join(', ');
  }

  protected languageTriggerOverflowCount(maxVisible = 2): number {
    const languages = this.profileForm.languages
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return Math.max(0, languages.length - Math.max(1, maxVisible));
  }

  protected languageToneClass(value: string): string {
    return `language-tone-${this.languageToneIndex(value)}`;
  }

  protected get availableLanguageSuggestions(): string[] {
    const query = this.languageInput.trim().toLowerCase();
    return this.languageSuggestions.filter(item => {
      const isSelected = this.profileForm.languages.some(selected => selected.toLowerCase() === item.toLowerCase());
      if (isSelected) {
        return false;
      }
      return query.length === 0 ? true : item.toLowerCase().includes(query);
    });
  }

  protected get availableLanguageDisplaySuggestions(): string[] {
    return this.availableLanguageSuggestions.slice(0, 20);
  }

  protected openDetailPrivacySelector(groupIndex: number, rowIndex: number, event: Event): void {
    event.stopPropagation();
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    if (!this.isMobileView) {
      const isOpen =
        this.openPrivacyFab?.groupIndex === groupIndex &&
        this.openPrivacyFab?.rowIndex === rowIndex;
      this.openPrivacyFab = isOpen ? null : { groupIndex, rowIndex };
      this.openExperiencePrivacyFab = null;
      return;
    }
    this.mobileProfileSelectorSheet = {
      title: `${row.label} visibility`,
      selected: row.privacy,
      options: this.privacySelectorOptions(),
      context: { kind: 'detailPrivacy', groupIndex, rowIndex }
    };
  }

  protected isDetailPrivacyFabOpen(groupIndex: number, rowIndex: number): boolean {
    return this.openPrivacyFab?.groupIndex === groupIndex && this.openPrivacyFab?.rowIndex === rowIndex;
  }

  protected selectDetailPrivacy(groupIndex: number, rowIndex: number, privacy: AppTypes.DetailPrivacy, event: MouseEvent): void {
    event.stopPropagation();
    const row = this.profileDetailsForm[groupIndex]?.rows[rowIndex];
    if (!row) {
      return;
    }
    row.privacy = privacy;
    this.openPrivacyFab = null;
    const key = this.detailPrivacyFabKey(groupIndex, rowIndex);
    this.privacyFabJustSelectedKey = key;
    setTimeout(() => {
      if (this.privacyFabJustSelectedKey === key) {
        this.privacyFabJustSelectedKey = null;
      }
    }, 280);
  }

  protected isDetailPrivacyJustSelected(groupIndex: number, rowIndex: number): boolean {
    return this.privacyFabJustSelectedKey === this.detailPrivacyFabKey(groupIndex, rowIndex);
  }

  protected openExperiencePrivacySelector(type: 'workspace' | 'school', event: Event): void {
    event.stopPropagation();
    if (!this.isMobileView) {
      this.openExperiencePrivacyFab = this.openExperiencePrivacyFab === type ? null : type;
      this.openPrivacyFab = null;
      return;
    }
    this.mobileProfileSelectorSheet = {
      title: `${type === 'workspace' ? 'Workspace' : 'School'} visibility`,
      selected: this.experienceVisibility[type],
      options: this.privacySelectorOptions(),
      context: { kind: 'experiencePrivacy', type }
    };
  }

  protected isExperiencePrivacyFabOpen(type: 'workspace' | 'school'): boolean {
    return this.openExperiencePrivacyFab === type;
  }

  protected selectExperiencePrivacy(type: 'workspace' | 'school', privacy: AppTypes.DetailPrivacy, event: MouseEvent): void {
    event.stopPropagation();
    this.experienceVisibility[type] = privacy;
    this.openExperiencePrivacyFab = null;
  }

  protected experienceVisibilityValue(type: 'workspace' | 'school'): AppTypes.DetailPrivacy {
    return this.experienceVisibility[type];
  }

  protected toggleValuesOption(option: string): void {
    const allowed = this.beliefsValuesAllOptions();
    if (!allowed.includes(option)) {
      return;
    }
    const exists = this.valuesSelectorSelected.includes(option);
    if (!exists && this.valuesSelectorSelected.length >= 5) {
      return;
    }
    this.valuesSelectorSelected = exists
      ? this.valuesSelectorSelected.filter(item => item !== option)
      : [...this.valuesSelectorSelected, option];
    this.syncValuesContextToRow();
  }

  protected removeValuesOption(option: string): void {
    this.valuesSelectorSelected = this.valuesSelectorSelected.filter(item => item !== option);
    this.syncValuesContextToRow();
  }

  protected clearValuesSelector(): void {
    this.valuesSelectorSelected = [];
    this.syncValuesContextToRow();
  }

  protected isValuesOptionSelected(option: string): boolean {
    return this.valuesSelectorSelected.includes(option);
  }

  protected toggleInterestOption(option: string): void {
    const allowed = this.interestAllOptions();
    if (!allowed.includes(option)) {
      return;
    }
    const exists = this.interestSelectorSelected.includes(option);
    if (!exists && this.interestSelectorSelected.length >= 5) {
      return;
    }
    this.interestSelectorSelected = exists
      ? this.interestSelectorSelected.filter(item => item !== option)
      : [...this.interestSelectorSelected, option];
    this.syncInterestContextToRow();
  }

  protected removeInterestOption(option: string): void {
    this.interestSelectorSelected = this.interestSelectorSelected.filter(item => item !== option);
    this.syncInterestContextToRow();
  }

  protected clearInterestSelector(): void {
    this.interestSelectorSelected = [];
    this.syncInterestContextToRow();
  }

  protected isInterestOptionSelected(option: string): boolean {
    return this.interestSelectorSelected.includes(option);
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

  protected valuesRowPreviewOptions(value: string, max = 2): string[] {
    return this.parseCommaValues(value).slice(0, Math.max(0, max));
  }

  protected valuesRowPreviewOverflow(value: string, max = 2): number {
    return Math.max(0, this.parseCommaValues(value).length - Math.max(0, max));
  }

  protected interestRowPreviewOptions(value: string, max = 2): string[] {
    return this.parseCommaValues(value).slice(0, Math.max(0, max));
  }

  protected interestRowPreviewOverflow(value: string, max = 2): number {
    return Math.max(0, this.parseCommaValues(value).length - Math.max(0, max));
  }

  protected detailOptionClass(label: string, option: string, options: string[]): string {
    if (label === 'Values') {
      return this.valuesDominantToneClass(option);
    }
    if (label === 'Interest') {
      return this.interestDominantToneClass(option);
    }
    return this.detailToneFromOptions(option, options);
  }

  protected detailSelectedClass(label: string, value: string, options: string[]): string {
    if (label === 'Values') {
      return this.valuesDominantToneClass(value);
    }
    if (label === 'Interest') {
      return this.interestDominantToneClass(value);
    }
    return this.detailToneFromOptions(value, options);
  }

  protected detailOptionIcon(label: string, option: string): string {
    const normalizedLabel = AppUtils.normalizeText(label);
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

  protected privacyStatusClass(value: AppTypes.DetailPrivacy): string {
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

  protected privacyStatusIcon(value: AppTypes.DetailPrivacy): string {
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

  protected privacyTriggerIcon(value: AppTypes.DetailPrivacy, isOpen: boolean): string {
    return isOpen ? 'close' : this.privacyStatusIcon(value);
  }

  protected experienceTypeIcon(type: AppTypes.ExperienceEntry['type']): string {
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

  protected experienceTypeClass(type: AppTypes.ExperienceEntry['type']): string {
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

  protected experienceFilterIcon(option: 'All' | 'Workspace' | 'School'): string {
    if (option === 'Workspace') {
      return 'apartment';
    }
    if (option === 'School') {
      return 'school';
    }
    return 'filter_alt';
  }

  protected experienceFilterClass(option: 'All' | 'Workspace' | 'School'): string {
    if (option === 'Workspace') {
      return 'experience-filter-workspace';
    }
    if (option === 'School') {
      return 'experience-filter-school';
    }
    return 'experience-filter-all';
  }

  protected experienceTypeToneClass(type: AppTypes.ExperienceEntry['type']): string {
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

  protected openExperienceForm(entry?: AppTypes.ExperienceEntry): void {
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
    const payload: Omit<AppTypes.ExperienceEntry, 'id'> = {
      ...this.experienceForm,
      dateFrom,
      title: this.experienceForm.title.trim(),
      org: this.experienceForm.org.trim(),
      city: this.experienceForm.city.trim(),
      dateTo: dateTo || 'Present',
      description: this.experienceForm.description.trim()
    };
    if (this.editingExperienceId) {
      this.experienceEntries = this.experienceEntries.map(item =>
        item.id === this.editingExperienceId
          ? { ...item, ...payload }
          : item
      );
    } else {
      this.experienceEntries = [
        ...this.experienceEntries,
        { id: `exp-${Date.now()}`, ...payload }
      ];
    }
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
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
    this.experienceEntries = this.experienceEntries.filter(item => item.id !== this.pendingExperienceDeleteId);
    this.pendingExperienceDeleteId = null;
  }

  private loadProfileEditorState(user: UserDto): void {
    this.resetTransientUiState();
    this.profileUser = this.cloneUser(user);
    const birthday = AppUtils.fromIsoDate(user.birthday);
    this.profileDetailsForm = this.profileDetailsForUser(user.id, user);
    this.profileForm = {
      fullName: user.name,
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
    this.panel = 'profile';
  }

  private createEmptyProfileForm(): ProfileFormState {
    return {
      fullName: '',
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

  private profileDetailsForUser(userId: string, user?: UserDto): AppTypes.ProfileDetailFormGroup[] {
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

  private createProfileDetailsFormForUser(user: UserDto): AppTypes.ProfileDetailFormGroup[] {
    const beliefsValuesOptions = this.beliefsValuesAllOptions();
    const interestOptions = this.interestAllOptions();
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        label: row.label,
        value: this.profileDetailSeedValue(user, row.label, ''),
        privacy: row.privacy,
        options:
          row.label === 'Values'
            ? beliefsValuesOptions
            : row.label === 'Interest'
              ? interestOptions
              : this.profileDetailValueOptions[row.label] ?? [this.profileDetailSeedValue(user, row.label, '')]
      }))
    }));
  }

  private profileDetailSeedValue(user: UserDto, label: string, fallback: string): string {
    switch (label) {
      case 'Name':
        return user.name;
      case 'City':
        return user.city;
      case 'Birthday': {
        const parsed = AppUtils.fromIsoDate(user.birthday);
        return parsed
          ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : fallback;
      }
      case 'Height':
        return user.height;
      case 'Physique':
        return user.physique;
      case 'Languages':
        return user.languages.join(', ');
      case 'Horoscope':
        return user.horoscope;
      case 'Gender':
        return user.gender === 'woman' ? 'Woman' : 'Man';
      case 'Interest':
        return this.seededOptionsForUser(user, this.interestAllOptions(), 3, label).join(', ');
      case 'Values':
        return this.seededOptionsForUser(user, this.beliefsValuesAllOptions(), 3, label).join(', ');
      default: {
        const options = this.profileDetailValueOptions[label] ?? [];
        if (options.length === 0) {
          return fallback;
        }
        return this.seededOptionForUser(user, options, label);
      }
    }
  }

  private profileDetailRowByLabel(userId: string, label: string): AppTypes.ProfileDetailFormRow | null {
    const target = AppUtils.normalizeText(label);
    for (const group of this.profileDetailsForUser(userId, this.profileUser ?? undefined)) {
      for (const row of group.rows) {
        if (AppUtils.normalizeText(row.label) === target) {
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
    const setRowValue = (label: string, value: string): void => {
      const row = this.profileDetailRowByLabel(user.id, label);
      if (!row) {
        return;
      }
      row.value = value;
    };
    const birthdayDate = AppUtils.fromIsoDate(user.birthday);
    setRowValue('Name', user.name);
    setRowValue('City', user.city);
    setRowValue(
      'Birthday',
      birthdayDate
        ? birthdayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
    );
    setRowValue('Height', user.height);
    setRowValue('Physique', user.physique);
    setRowValue('Languages', user.languages.join(', '));
    setRowValue('Horoscope', user.horoscope);
    setRowValue('Gender', user.gender === 'woman' ? 'Woman' : 'Man');
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
    const hasDetail = (label: string, minLength = 1): boolean => {
      const row = this.profileDetailRowByLabel(activeUserId, label);
      return AppUtils.hasText(row?.value, minLength);
    };

    const languages = this.profileForm.languages.filter(item => AppUtils.hasText(item));
    const imageCount = this.imageSlots.filter(slot => AppUtils.hasText(slot ?? '')).length;
    const valuesCount = this.parseCommaValues(this.profileDetailRowByLabel(activeUserId, 'Values')?.value ?? '').length;
    const interestCount = this.parseCommaValues(this.profileDetailRowByLabel(activeUserId, 'Interest')?.value ?? '').length;
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
    add(hasDetail('Drinking'));
    add(hasDetail('Smoking'));
    add(hasDetail('Workout'));
    add(hasDetail('Pets'));
    add(hasDetail('Family plans'));
    add(hasDetail('Children'));
    add(hasDetail('Love style'));
    add(hasDetail('Communication style'));
    add(hasDetail('Sexual orientation'));
    add(hasDetail('Religion'));
    add(hasDetail('Gender'));

    for (let index = 0; index < 8; index += 1) {
      add(imageCount > index);
    }

    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }

  private syncValuesContextToRow(): void {
    if (!this.valuesSelectorContext) {
      return;
    }
    const row = this.profileDetailsForm[this.valuesSelectorContext.groupIndex]?.rows[this.valuesSelectorContext.rowIndex];
    if (!row) {
      return;
    }
    row.value = this.valuesSelectorSelected.join(', ');
  }

  private syncInterestContextToRow(): void {
    if (!this.interestSelectorContext) {
      return;
    }
    const row = this.profileDetailsForm[this.interestSelectorContext.groupIndex]?.rows[this.interestSelectorContext.rowIndex];
    if (!row) {
      return;
    }
    row.value = this.interestSelectorSelected.join(', ');
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

  private privacySelectorOptions(): AppTypes.MobileProfileSelectorOption[] {
    const order: AppTypes.DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
    return order.map(option => ({
      value: option,
      label: option,
      icon: this.privacyStatusIcon(option),
      toneClass: this.privacyStatusClass(option)
    }));
  }

  private isDetailPrivacy(value: string): value is AppTypes.DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  private detailPrivacyFabKey(groupIndex: number, rowIndex: number): string {
    return `${groupIndex}-${rowIndex}`;
  }

  private languageToneIndex(value: string): number {
    const normalized = AppUtils.normalizeText(value);
    if (!normalized) {
      return 1;
    }
    let hash = 0;
    for (const char of normalized) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return (hash % 8) + 1;
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
    this.syncActiveUserImageSlotsState(true);
    if (this.usersService.demoModeEnabled && this.profileUser) {
      await this.usersService.saveUserProfile(this.cloneUser(this.profileUser));
    }
    const uploadResult = await this.usersService.uploadUserProfileImage(userId, file, slotIndex);
    if (!uploadResult.uploaded) {
      this.confirmationDialogService.openInfo('Unable to upload image', {
        title: 'Upload failed',
        confirmTone: 'neutral'
      });
      return;
    }
    const verifiedImageUrl = await this.reloadUploadedImageUrl(userId, slotIndex, uploadResult.imageUrl);
    if (!verifiedImageUrl) {
      this.confirmationDialogService.openInfo('Image uploaded but profile refresh failed', {
        title: 'Upload incomplete',
        confirmTone: 'neutral'
      });
      return;
    }
    this.revokeObjectUrl(previousImage);
    this.imageSlots[slotIndex] = verifiedImageUrl;
    this.selectedImageIndex = this.resolveSelectedImageIndexAfterUpload(slotIndex);
    this.syncActiveUserImageSlotsState(true);
    if (this.usersService.demoModeEnabled && this.profileUser) {
      await this.usersService.saveUserProfile(this.cloneUser(this.profileUser));
    }
    this.cdr.markForCheck();
  }

  private async reloadUploadedImageUrl(
    userId: string,
    slotIndex: number,
    uploadedImageUrl: string | null
  ): Promise<string | null> {
    if (uploadedImageUrl) {
      return uploadedImageUrl;
    }
    const loadedUser = await this.usersService.loadUserById(userId);
    if (!loadedUser) {
      return null;
    }
    const loadedImages = (loadedUser.images ?? [])
      .map(image => image.trim())
      .filter(image => image.length > 0);
    if (slotIndex >= 0 && slotIndex < loadedImages.length) {
      return loadedImages[slotIndex] ?? null;
    }
    return loadedImages[loadedImages.length - 1] ?? null;
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

  private commitProfileForm(showAlert: boolean): void {
    if (!this.profileUser) {
      return;
    }
    const user = this.cloneUser(this.profileUser);
    user.name = this.profileForm.fullName.trim() || user.name;
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
    user.completion = this.calculateProfileCompletionPercent();
    this.profileDetailsFormByUser[user.id] = this.cloneProfileDetailsForm(this.profileDetailsForm);
    this.pushProfileUserToContextAndLegacyMirror(user);
    void this.usersService.saveUserProfile(this.cloneUser(user));
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
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0
      },
      impressions: user.impressions
        ? {
            host: user.impressions.host ? { ...user.impressions.host } : undefined,
            member: user.impressions.member ? { ...user.impressions.member } : undefined
          }
        : undefined
    };
  }

  private cloneProfileDetailsForm(groups: AppTypes.ProfileDetailFormGroup[]): AppTypes.ProfileDetailFormGroup[] {
    return groups.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        label: row.label,
        value: row.value,
        privacy: row.privacy,
        options: [...row.options]
      }))
    }));
  }

  private resetTransientUiState(): void {
    this.panel = 'profile';
    this.showProfileStatusHeaderPicker = false;
    this.closeMobileProfileSelectorSheet();
    this.openPrivacyFab = null;
    this.openExperiencePrivacyFab = null;
    this.privacyFabJustSelectedKey = null;
    this.valuesSelectorContext = null;
    this.valuesSelectorSelected = [];
    this.interestSelectorContext = null;
    this.interestSelectorSelected = [];
    this.pendingSlotUploadIndex = null;
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.pendingExperienceDeleteId = null;
    this.resetExperienceForm();
  }
}

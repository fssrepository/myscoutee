import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { DemoUser } from '../../shared/demo-data';
import { ProfileEditorStateMachine, ProfileEditorScreen } from '../profile-editor-state.machine';
import {
  DetailPrivacy,
  ExperienceEntry,
  ExperienceVisibilityMap,
  InterestOptionGroup,
  ProfileDetailFormGroup,
  ProfileEditorForm,
  ProfileStatus,
  ValuesOptionGroup
} from '../profile-editor.types';
import { ProfileEditorValuesScreenComponent } from './profile-editor-values-screen.component';
import { ProfileEditorInterestScreenComponent } from './profile-editor-interest-screen.component';
import { ProfileEditorExperienceScreenComponent } from './profile-editor-experience-screen.component';
import { ProfileEditorImageEditorScreenComponent } from './profile-editor-image-editor-screen.component';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    ProfileEditorValuesScreenComponent,
    ProfileEditorInterestScreenComponent,
    ProfileEditorExperienceScreenComponent,
    ProfileEditorImageEditorScreenComponent
  ],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class ProfileEditorComponent {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly stateMachine = new ProfileEditorStateMachine();
  private languageSuggestionsLocal: string[] = [];

  @Input({ required: true }) activeUser!: DemoUser;
  @Input({ required: true }) profileForm!: ProfileEditorForm;
  @Input({ required: true }) profileDetailsForm!: ProfileDetailFormGroup[];
  @Input({ required: true }) profileStatusOptions: Array<{ value: ProfileStatus; icon: string }> = [];
  @Input({ required: true }) physiqueOptions: string[] = [];
  @Input({ required: true }) beliefsValuesOptionGroups: ValuesOptionGroup[] = [];
  @Input({ required: true }) interestOptionGroups: InterestOptionGroup[] = [];
  @Input({ required: true }) detailPrivacyOptions: DetailPrivacy[] = ['Public', 'Friends', 'Hosts', 'Private'];
  @Input({ required: true }) experienceEntries: ExperienceEntry[] = [];
  @Input({ required: true }) imageSlots: Array<string | null> = [];
  @Input({ required: true }) experienceVisibility: ExperienceVisibilityMap = {
    workspace: 'Public',
    school: 'Public'
  };
  @Input() featuredImagePreview: string | null = null;
  @Input() profileCompletionPercent = 0;
  @Input() profileEditorAge = 0;

  @Input()
  set languageSuggestions(value: string[]) {
    this.languageSuggestionsLocal = [...value];
  }

  @Output() imageSlotsChange = new EventEmitter<Array<string | null>>();
  @Output() screenChange = new EventEmitter<ProfileEditorScreen>();
  @Output() experienceEntriesChange = new EventEmitter<ExperienceEntry[]>();
  @Output() experienceVisibilityChange = new EventEmitter<ExperienceVisibilityMap>();
  @Output() languageSuggestionsChange = new EventEmitter<string[]>();

  protected valuesSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected valuesSelectorSelected: string[] = [];
  protected interestSelectorContext: { groupIndex: number; rowIndex: number } | null = null;
  protected interestSelectorSelected: string[] = [];
  protected openPrivacyFab: { groupIndex: number; rowIndex: number } | null = null;
  protected openExperiencePrivacyFab: 'workspace' | 'school' | null = null;
  protected privacyFabJustSelectedKey: string | null = null;
  protected showLanguageSelector = false;
  protected languageInput = '';
  protected experiencePreferredFilter: 'All' | 'Workspace' | 'School' = 'All';

  protected get currentScreen(): ProfileEditorScreen {
    return this.stateMachine.current;
  }

  protected get workspaceExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'Workspace').length;
    return `${count} items`;
  }

  protected get schoolExperienceSummary(): string {
    const count = this.experienceEntries.filter(item => item.type === 'School').length;
    return `${count} items`;
  }

  protected get availableLanguageSuggestions(): string[] {
    const query = this.languageInput.trim().toLowerCase();
    return this.languageSuggestionsLocal.filter(item => {
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

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const host = this.hostRef.nativeElement;
    if (!host.contains(target)) {
      this.openPrivacyFab = null;
      this.openExperiencePrivacyFab = null;
      return;
    }
    if (this.openPrivacyFab && !target.closest('.profile-details-privacy-fab')) {
      this.openPrivacyFab = null;
    }
    if (this.openExperiencePrivacyFab && !target.closest('.profile-details-privacy-fab')) {
      this.openExperiencePrivacyFab = null;
    }
  }

  protected goBackFromSecondaryScreen(): void {
    if (!this.stateMachine.canGoBack()) {
      this.stateMachine.goMain();
      this.emitScreenChange();
      return;
    }
    const leaving = this.currentScreen;
    this.stateMachine.back();
    this.emitScreenChange();
    if (leaving === 'values') {
      this.valuesSelectorContext = null;
      this.valuesSelectorSelected = [];
    }
    if (leaving === 'interest') {
      this.interestSelectorContext = null;
      this.interestSelectorSelected = [];
    }
  }

  public goBackFromHostHeader(): void {
    this.goBackFromSecondaryScreen();
  }

  protected openImageEditor(): void {
    this.stateMachine.goTo('imageEditor');
    this.emitScreenChange();
  }

  protected onImageSlotsChanged(slots: Array<string | null>): void {
    this.imageSlots = [...slots];
    this.imageSlotsChange.emit(this.imageSlots);
  }

  protected onBirthdayChange(value: Date | null): void {
    this.profileForm.birthday = value;
    this.profileForm.horoscope = value ? this.getHoroscopeByDate(value) : '';
  }

  protected openLanguageSelector(event: Event): void {
    event.stopPropagation();
    this.languageInput = '';
    this.showLanguageSelector = true;
  }

  protected closeLanguageSelector(): void {
    this.showLanguageSelector = false;
    this.languageInput = '';
  }

  protected submitLanguageAndClose(event: Event): void {
    event.stopPropagation();
    this.addCustomLanguage();
    this.closeLanguageSelector();
  }

  protected addCustomLanguage(value = this.languageInput): void {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    if (!this.profileForm.languages.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.profileForm.languages = [...this.profileForm.languages, normalized];
    }
    if (!this.languageSuggestionsLocal.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.languageSuggestionsLocal = [...this.languageSuggestionsLocal, normalized];
      this.languageSuggestionsChange.emit(this.languageSuggestionsLocal);
    }
    this.languageInput = '';
  }

  protected selectLanguage(value: string): void {
    const exists = this.profileForm.languages.some(item => item.toLowerCase() === value.toLowerCase());
    if (exists) {
      this.profileForm.languages = this.profileForm.languages.filter(item => item.toLowerCase() !== value.toLowerCase());
      return;
    }
    this.profileForm.languages = [...this.profileForm.languages, value];
    this.languageInput = '';
  }

  protected removeLanguage(value: string): void {
    this.profileForm.languages = this.profileForm.languages.filter(item => item !== value);
  }

  protected isLanguageSelected(value: string): boolean {
    return this.profileForm.languages.some(item => item.toLowerCase() === value.toLowerCase());
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

  protected languageTriggerPrimaryLabel(maxVisible = 2): string {
    const languages = this.profileForm.languages.map(item => item.trim()).filter(item => item.length > 0);
    if (languages.length === 0) {
      return '';
    }
    const visibleCount = Math.max(1, maxVisible);
    return languages.slice(0, visibleCount).join(', ');
  }

  protected languageTriggerOverflowCount(maxVisible = 2): number {
    const languages = this.profileForm.languages.map(item => item.trim()).filter(item => item.length > 0);
    const visibleCount = Math.max(1, maxVisible);
    return Math.max(0, languages.length - visibleCount);
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
    this.stateMachine.goTo('values');
    this.emitScreenChange();
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
    this.stateMachine.goTo('interest');
    this.emitScreenChange();
  }

  protected openWorkspaceSelector(): void {
    this.openExperienceSelector('Workspace');
  }

  protected openSchoolSelector(): void {
    this.openExperienceSelector('School');
  }

  protected openExperienceSelector(filter: 'All' | 'Workspace' | 'School' = 'All'): void {
    this.experiencePreferredFilter = filter;
    this.stateMachine.goTo('experience');
    this.emitScreenChange();
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

  protected valuesRowPreviewOptions(value: string, max = 2): string[] {
    const selected = this.parseCommaValues(value);
    return selected.slice(0, Math.max(0, max));
  }

  protected valuesRowPreviewOverflow(value: string, max = 2): number {
    const selected = this.parseCommaValues(value);
    return Math.max(0, selected.length - Math.max(0, max));
  }

  protected interestRowPreviewOptions(value: string, max = 2): string[] {
    const selected = this.parseCommaValues(value);
    return selected.slice(0, Math.max(0, max));
  }

  protected interestRowPreviewOverflow(value: string, max = 2): number {
    const selected = this.parseCommaValues(value);
    return Math.max(0, selected.length - Math.max(0, max));
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
    const normalizedLabel = this.normalizeText(label);
    const normalizedOption = this.normalizeText(option);

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
        return 'set_meal';
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
    const safeIndex = Math.abs(hash) % iconPool.length;
    return iconPool[safeIndex];
  }

  protected openDetailPrivacySelector(groupIndex: number, rowIndex: number, event: Event): void {
    event.stopPropagation();
    const isOpen =
      this.openPrivacyFab?.groupIndex === groupIndex &&
      this.openPrivacyFab?.rowIndex === rowIndex;
    this.openPrivacyFab = isOpen ? null : { groupIndex, rowIndex };
    this.openExperiencePrivacyFab = null;
  }

  protected isDetailPrivacyFabOpen(groupIndex: number, rowIndex: number): boolean {
    return this.openPrivacyFab?.groupIndex === groupIndex && this.openPrivacyFab?.rowIndex === rowIndex;
  }

  protected selectDetailPrivacy(
    groupIndex: number,
    rowIndex: number,
    privacy: DetailPrivacy,
    event: MouseEvent
  ): void {
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
    this.openExperiencePrivacyFab = this.openExperiencePrivacyFab === type ? null : type;
    this.openPrivacyFab = null;
  }

  protected isExperiencePrivacyFabOpen(type: 'workspace' | 'school'): boolean {
    return this.openExperiencePrivacyFab === type;
  }

  protected selectExperiencePrivacy(
    type: 'workspace' | 'school',
    privacy: DetailPrivacy,
    event: MouseEvent
  ): void {
    event.stopPropagation();
    this.experienceVisibility = {
      ...this.experienceVisibility,
      [type]: privacy
    };
    this.experienceVisibilityChange.emit(this.experienceVisibility);
    this.openExperiencePrivacyFab = null;
  }

  protected experienceVisibilityValue(type: 'workspace' | 'school'): DetailPrivacy {
    return this.experienceVisibility[type];
  }

  protected onExperienceEntriesChanged(entries: ExperienceEntry[]): void {
    this.experienceEntries = [...entries];
    this.experienceEntriesChange.emit(this.experienceEntries);
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

  protected profileStatusClass(value: ProfileStatus = this.activeUser.profileStatus): string {
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

  protected getProfileStatusIcon(value: ProfileStatus = this.activeUser.profileStatus): string {
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

  protected privacyStatusClass(value: DetailPrivacy): string {
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

  protected privacyStatusIcon(value: DetailPrivacy): string {
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

  protected privacyTriggerIcon(value: DetailPrivacy, isOpen: boolean): string {
    return isOpen ? 'close' : this.privacyStatusIcon(value);
  }

  protected getPhysiqueIcon(value: string): string {
    const normalized = this.normalizeText(value);
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
    const normalized = this.normalizeText(value);
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
    return `zodiac-${this.normalizeText(value).replace(/\s+/g, '-')}`;
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
    for (const group of this.interestOptionGroups) {
      if (group.options.includes(option)) {
        return group.toneClass;
      }
    }
    return '';
  }

  protected valuesDominantToneClass(value: string): string {
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
      const firstTone = this.valuesOptionToneClass(selected[0]);
      return firstTone || 'section-beliefs';
    }
    return bestTone;
  }

  protected interestDominantToneClass(value: string): string {
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
      const firstTone = this.interestOptionToneClass(selected[0]);
      return firstTone || 'section-social';
    }
    return bestTone;
  }

  protected languageToneClass(value: string): string {
    return `language-tone-${this.languageToneIndex(value)}`;
  }

  private languageToneIndex(value: string): number {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return 1;
    }
    let hash = 0;
    for (const char of normalized) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return (hash % 8) + 1;
  }

  private beliefsValuesAllOptions(): string[] {
    return this.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return this.interestOptionGroups.flatMap(group => group.options);
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
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  private detailToneFromOptions(value: string, options: string[]): string {
    const index = options.findIndex(item => this.normalizeText(item) === this.normalizeText(value));
    const paletteIndex = (index >= 0 ? index : 0) % 8;
    return `detail-tone-${paletteIndex + 1}`;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private detailPrivacyFabKey(groupIndex: number, rowIndex: number): string {
    return `${groupIndex}-${rowIndex}`;
  }

  private emitScreenChange(): void {
    this.screenChange.emit(this.currentScreen);
  }

  private getHoroscopeByDate(value: Date): string {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
    return 'Capricorn';
  }
}

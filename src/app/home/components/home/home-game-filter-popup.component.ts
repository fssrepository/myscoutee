import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { DemoUser } from '../../../shared/demo-data';
import {
  FilterSelectorKind,
  GameFilterForm,
  GameFilterOptionGroup,
  HomeGameFilterPopupContext,
  cloneGameFilter,
  getGameUserFacet,
  getGameUserInterests,
  getGameUserValues,
  normalizeGameFilter,
  GAME_FILTER_AGE_MAX,
  GAME_FILTER_AGE_MIN,
  GAME_FILTER_HEIGHT_MAX_CM,
  GAME_FILTER_HEIGHT_MIN_CM
} from './home-game-filter.shared';

@Component({
  selector: 'app-home-game-filter-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSliderModule
  ],
  templateUrl: './home-game-filter-popup.component.html',
  styleUrl: './home-game-filter-popup.component.scss'
})
export class HomeGameFilterPopupComponent implements OnChanges {
  @Input() context: HomeGameFilterPopupContext | null = null;

  @Output() readonly closed = new EventEmitter<GameFilterForm | null>();

  protected filterDraft!: GameFilterForm;
  protected filterSelector: FilterSelectorKind | null = null;
  protected filterLanguageInput = '';
  protected readonly genderFilterOptions: Array<{ value: DemoUser['gender']; label: string; icon: string }> = [
    { value: 'woman', label: 'Woman', icon: 'female' },
    { value: 'man', label: 'Man', icon: 'male' }
  ];

  private filterLanguageSuggestionPool: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['context'] || !this.context) {
      return;
    }
    this.filterDraft = cloneGameFilter(this.context.filter);
    this.filterSelector = null;
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.requestClose();
  }

  protected get minAgeBound(): number {
    return GAME_FILTER_AGE_MIN;
  }

  protected get maxAgeBound(): number {
    return GAME_FILTER_AGE_MAX;
  }

  protected get minHeightBoundCm(): number {
    return GAME_FILTER_HEIGHT_MIN_CM;
  }

  protected get maxHeightBoundCm(): number {
    return GAME_FILTER_HEIGHT_MAX_CM;
  }

  protected get availablePhysiques(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => user.physique))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableInterests(): string[] {
    return Array.from(new Set((this.context?.users ?? []).flatMap(user => this.userInterests(user)))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableValues(): string[] {
    return Array.from(new Set((this.context?.users ?? []).flatMap(user => this.userValues(user)))).sort((a, b) => a.localeCompare(b));
  }

  protected get interestOptionGroups(): readonly GameFilterOptionGroup[] {
    return this.context?.interestOptionGroups ?? [];
  }

  protected get valueOptionGroups(): readonly GameFilterOptionGroup[] {
    return this.context?.valueOptionGroups ?? [];
  }

  protected get availableLanguages(): string[] {
    return Array.from(new Set((this.context?.users ?? []).flatMap(user => user.languages))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableSmokingOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).smoking))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableDrinkingOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).drinking))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableWorkoutOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).workout))).sort((a, b) => a.localeCompare(b));
  }

  protected get availablePetsOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).pets))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableFamilyPlanOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).familyPlans))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableChildrenOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).children))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableLoveStyleOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).loveStyle))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableCommunicationStyleOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).communicationStyle))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableSexualOrientationOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).sexualOrientation))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableReligionOptions(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => this.userFacet(user).religion))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableHoroscopes(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => user.horoscope))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableTraitLabels(): string[] {
    return Array.from(new Set((this.context?.users ?? []).map(user => user.traitLabel))).sort((a, b) => a.localeCompare(b));
  }

  protected get hasOpenFilterSelector(): boolean {
    return this.filterSelector !== null;
  }

  protected get activeFilterSelectorTitle(): string {
    switch (this.filterSelector) {
      case 'interests':
        return 'Interest';
      case 'values':
        return 'Values';
      case 'physiques':
        return 'Physique';
      case 'languages':
        return 'Languages';
      case 'genders':
        return 'Gender';
      case 'horoscopes':
        return 'Horoscope';
      case 'traitLabels':
        return 'Top Trait';
      case 'smoking':
        return 'Smoking';
      case 'drinking':
        return 'Drinking';
      case 'workout':
        return 'Workout';
      case 'pets':
        return 'Pets';
      case 'familyPlans':
        return 'Family plans';
      case 'children':
        return 'Children';
      case 'loveStyles':
        return 'Love style';
      case 'communicationStyles':
        return 'Communication style';
      case 'sexualOrientations':
        return 'Sexual orientation';
      case 'religions':
        return 'Religion';
      default:
        return 'Filter';
    }
  }

  protected get activeFilterSelectorOptionGroups(): readonly GameFilterOptionGroup[] {
    if (this.filterSelector === 'interests') {
      return this.interestOptionGroups;
    }
    if (this.filterSelector === 'values') {
      return this.valueOptionGroups;
    }
    return [];
  }

  protected get activeFilterSelectorUsesGroups(): boolean {
    return this.filterSelector === 'interests' || this.filterSelector === 'values';
  }

  protected get activeFilterSelectorOptions(): Array<{ value: string; label: string; icon?: string }> {
    switch (this.filterSelector) {
      case 'interests':
        return this.availableInterests.map(option => ({ value: option, label: option }));
      case 'values':
        return this.availableValues.map(option => ({ value: option, label: option }));
      case 'smoking':
        return this.availableSmokingOptions.map(option => ({ value: option, label: option }));
      case 'drinking':
        return this.availableDrinkingOptions.map(option => ({ value: option, label: option }));
      case 'workout':
        return this.availableWorkoutOptions.map(option => ({ value: option, label: option }));
      case 'pets':
        return this.availablePetsOptions.map(option => ({ value: option, label: option }));
      case 'familyPlans':
        return this.availableFamilyPlanOptions.map(option => ({ value: option, label: option }));
      case 'children':
        return this.availableChildrenOptions.map(option => ({ value: option, label: option }));
      case 'loveStyles':
        return this.availableLoveStyleOptions.map(option => ({ value: option, label: option }));
      case 'communicationStyles':
        return this.availableCommunicationStyleOptions.map(option => ({ value: option, label: option }));
      case 'sexualOrientations':
        return this.availableSexualOrientationOptions.map(option => ({ value: option, label: option }));
      case 'religions':
        return this.availableReligionOptions.map(option => ({ value: option, label: option }));
      case 'physiques':
        return this.availablePhysiques.map(option => ({ value: option, label: option }));
      case 'languages':
        return this.availableLanguages.map(option => ({ value: option, label: option }));
      case 'genders':
        return this.genderFilterOptions.map(option => ({ value: option.value, label: option.label, icon: option.icon }));
      case 'horoscopes':
        return this.availableHoroscopes.map(option => ({ value: option, label: option }));
      case 'traitLabels':
        return this.availableTraitLabels.map(option => ({ value: option, label: option }));
      default:
        return [];
    }
  }

  protected get availableFilterLanguageSuggestions(): string[] {
    const selected = new Set(this.filterDraft.languages.map(item => item.trim().toLowerCase()));
    const query = this.filterLanguageInput.trim().toLowerCase();
    return this.filterLanguageSuggestionPool
      .filter(item => !selected.has(item.toLowerCase()))
      .filter(item => query.length === 0 || item.toLowerCase().includes(query));
  }

  protected get availableFilterLanguageDisplaySuggestions(): string[] {
    return this.availableFilterLanguageSuggestions.slice(0, 24);
  }

  protected requestClose(event?: Event): void {
    event?.stopPropagation();
    this.closed.emit(null);
  }

  protected apply(): void {
    this.closed.emit(normalizeGameFilter(this.filterDraft));
  }

  protected openFilterSelector(kind: FilterSelectorKind): void {
    this.filterSelector = kind;
    if (kind === 'languages') {
      this.filterLanguageInput = '';
      this.refreshFilterLanguageSuggestionPool();
    }
  }

  protected closeFilterSelector(): void {
    this.filterSelector = null;
  }

  protected clearActiveFilterSelector(): void {
    switch (this.filterSelector) {
      case 'interests':
        this.filterDraft.interests = [];
        return;
      case 'values':
        this.filterDraft.values = [];
        return;
      case 'physiques':
        this.filterDraft.physiques = [];
        return;
      case 'languages':
        this.filterDraft.languages = [];
        this.refreshFilterLanguageSuggestionPool();
        return;
      case 'genders':
        this.filterDraft.genders = [];
        return;
      case 'horoscopes':
        this.filterDraft.horoscopes = [];
        return;
      case 'traitLabels':
        this.filterDraft.traitLabels = [];
        return;
      case 'smoking':
        this.filterDraft.smoking = [];
        return;
      case 'drinking':
        this.filterDraft.drinking = [];
        return;
      case 'workout':
        this.filterDraft.workout = [];
        return;
      case 'pets':
        this.filterDraft.pets = [];
        return;
      case 'familyPlans':
        this.filterDraft.familyPlans = [];
        return;
      case 'children':
        this.filterDraft.children = [];
        return;
      case 'loveStyles':
        this.filterDraft.loveStyles = [];
        return;
      case 'communicationStyles':
        this.filterDraft.communicationStyles = [];
        return;
      case 'sexualOrientations':
        this.filterDraft.sexualOrientations = [];
        return;
      case 'religions':
        this.filterDraft.religions = [];
        return;
      default:
        return;
    }
  }

  protected activeFilterSelectorHasSelection(): boolean {
    if (!this.filterSelector) {
      return false;
    }
    return this.filterSelectorSelectionCount(this.filterSelector) > 0;
  }

  protected filterSelectorHasSelection(kind: FilterSelectorKind): boolean {
    return this.filterSelectorSelectionCount(kind) > 0;
  }

  protected filterSelectorPreview(kind: FilterSelectorKind): string[] {
    return this.filterSelectorLabels(kind).slice(0, 2);
  }

  protected filterSelectorExtraCount(kind: FilterSelectorKind): number {
    return Math.max(0, this.filterSelectorLabels(kind).length - 2);
  }

  protected filterSelectorToneClass(kind: FilterSelectorKind): string {
    switch (kind) {
      case 'interests':
        return 'game-filter-selector-tone-interest';
      case 'values':
        return 'game-filter-selector-tone-values';
      case 'physiques':
        return 'game-filter-selector-tone-physique';
      case 'languages':
        return 'game-filter-selector-tone-languages';
      case 'genders':
        return 'game-filter-selector-tone-gender';
      case 'horoscopes':
        return 'game-filter-selector-tone-horoscope';
      case 'traitLabels':
        return 'game-filter-selector-tone-traits';
      case 'smoking':
        return 'game-filter-selector-tone-smoking';
      case 'drinking':
        return 'game-filter-selector-tone-drinking';
      case 'workout':
        return 'game-filter-selector-tone-workout';
      case 'pets':
        return 'game-filter-selector-tone-pets';
      case 'familyPlans':
        return 'game-filter-selector-tone-family';
      case 'children':
        return 'game-filter-selector-tone-children';
      case 'loveStyles':
        return 'game-filter-selector-tone-love';
      case 'communicationStyles':
        return 'game-filter-selector-tone-communication';
      case 'sexualOrientations':
        return 'game-filter-selector-tone-orientation';
      case 'religions':
        return 'game-filter-selector-tone-religion';
      default:
        return 'game-filter-selector-tone-neutral';
    }
  }

  protected toggleFilterPhysique(physique: string): void {
    this.filterDraft.physiques = this.toggleArraySelection(this.filterDraft.physiques, physique);
  }

  protected toggleFilterInterest(interest: string): void {
    this.filterDraft.interests = this.toggleArraySelection(this.filterDraft.interests, interest);
  }

  protected toggleFilterValue(value: string): void {
    this.filterDraft.values = this.toggleArraySelection(this.filterDraft.values, value);
  }

  protected toggleFilterLanguage(language: string): void {
    const normalized = language.trim();
    if (!normalized) {
      return;
    }
    const exists = this.filterDraft.languages.some(item => item.toLowerCase() === normalized.toLowerCase());
    this.filterDraft.languages = exists
      ? this.filterDraft.languages.filter(item => item.toLowerCase() !== normalized.toLowerCase())
      : [...this.filterDraft.languages, normalized];
    this.refreshFilterLanguageSuggestionPool();
  }

  protected submitFilterLanguageInput(event?: Event): void {
    event?.stopPropagation();
    const normalized = this.filterLanguageInput.trim();
    if (!normalized) {
      return;
    }
    const exists = this.filterDraft.languages.some(item => item.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      this.filterDraft.languages = [...this.filterDraft.languages, normalized];
    }
    this.filterLanguageInput = '';
    this.refreshFilterLanguageSuggestionPool();
  }

  protected onFilterLanguageInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    this.submitFilterLanguageInput();
  }

  protected onFilterLanguageInputBlur(): void {
    this.submitFilterLanguageInput();
  }

  protected selectFilterLanguage(value: string): void {
    this.toggleFilterLanguage(value);
    this.filterLanguageInput = '';
  }

  protected filterLanguageToneClass(value: string): string {
    return `game-filter-language-tone-${this.filterLanguageToneIndex(value)}`;
  }

  protected toggleFilterGender(gender: DemoUser['gender']): void {
    this.filterDraft.genders = this.toggleArraySelection(this.filterDraft.genders, gender);
  }

  protected toggleFilterHoroscope(horoscope: string): void {
    this.filterDraft.horoscopes = this.toggleArraySelection(this.filterDraft.horoscopes, horoscope);
  }

  protected toggleFilterTraitLabel(traitLabel: string): void {
    this.filterDraft.traitLabels = this.toggleArraySelection(this.filterDraft.traitLabels, traitLabel);
  }

  protected toggleFilterSmoking(option: string): void {
    this.filterDraft.smoking = this.toggleArraySelection(this.filterDraft.smoking, option);
  }

  protected toggleFilterDrinking(option: string): void {
    this.filterDraft.drinking = this.toggleArraySelection(this.filterDraft.drinking, option);
  }

  protected toggleFilterWorkout(option: string): void {
    this.filterDraft.workout = this.toggleArraySelection(this.filterDraft.workout, option);
  }

  protected toggleFilterPets(option: string): void {
    this.filterDraft.pets = this.toggleArraySelection(this.filterDraft.pets, option);
  }

  protected toggleFilterFamilyPlans(option: string): void {
    this.filterDraft.familyPlans = this.toggleArraySelection(this.filterDraft.familyPlans, option);
  }

  protected toggleFilterChildren(option: string): void {
    this.filterDraft.children = this.toggleArraySelection(this.filterDraft.children, option);
  }

  protected toggleFilterLoveStyles(option: string): void {
    this.filterDraft.loveStyles = this.toggleArraySelection(this.filterDraft.loveStyles, option);
  }

  protected toggleFilterCommunicationStyles(option: string): void {
    this.filterDraft.communicationStyles = this.toggleArraySelection(this.filterDraft.communicationStyles, option);
  }

  protected toggleFilterSexualOrientations(option: string): void {
    this.filterDraft.sexualOrientations = this.toggleArraySelection(this.filterDraft.sexualOrientations, option);
  }

  protected toggleFilterReligions(option: string): void {
    this.filterDraft.religions = this.toggleArraySelection(this.filterDraft.religions, option);
  }

  protected isPhysiqueSelected(physique: string): boolean {
    return this.filterDraft.physiques.includes(physique);
  }

  protected isInterestSelected(interest: string): boolean {
    return this.filterDraft.interests.includes(interest);
  }

  protected isValueSelected(value: string): boolean {
    return this.filterDraft.values.includes(value);
  }

  protected isLanguageSelected(language: string): boolean {
    return this.filterDraft.languages.includes(language);
  }

  protected isGenderSelected(gender: DemoUser['gender']): boolean {
    return this.filterDraft.genders.includes(gender);
  }

  protected isHoroscopeSelected(horoscope: string): boolean {
    return this.filterDraft.horoscopes.includes(horoscope);
  }

  protected isTraitLabelSelected(traitLabel: string): boolean {
    return this.filterDraft.traitLabels.includes(traitLabel);
  }

  protected isSmokingSelected(option: string): boolean {
    return this.filterDraft.smoking.includes(option);
  }

  protected isDrinkingSelected(option: string): boolean {
    return this.filterDraft.drinking.includes(option);
  }

  protected isWorkoutSelected(option: string): boolean {
    return this.filterDraft.workout.includes(option);
  }

  protected isPetsSelected(option: string): boolean {
    return this.filterDraft.pets.includes(option);
  }

  protected isFamilyPlansSelected(option: string): boolean {
    return this.filterDraft.familyPlans.includes(option);
  }

  protected isChildrenSelected(option: string): boolean {
    return this.filterDraft.children.includes(option);
  }

  protected isLoveStylesSelected(option: string): boolean {
    return this.filterDraft.loveStyles.includes(option);
  }

  protected isCommunicationStylesSelected(option: string): boolean {
    return this.filterDraft.communicationStyles.includes(option);
  }

  protected isSexualOrientationsSelected(option: string): boolean {
    return this.filterDraft.sexualOrientations.includes(option);
  }

  protected isReligionsSelected(option: string): boolean {
    return this.filterDraft.religions.includes(option);
  }

  protected toggleActiveFilterSelectorOption(value: string): void {
    switch (this.filterSelector) {
      case 'interests':
        this.toggleFilterInterest(value);
        return;
      case 'values':
        this.toggleFilterValue(value);
        return;
      case 'smoking':
        this.toggleFilterSmoking(value);
        return;
      case 'drinking':
        this.toggleFilterDrinking(value);
        return;
      case 'workout':
        this.toggleFilterWorkout(value);
        return;
      case 'pets':
        this.toggleFilterPets(value);
        return;
      case 'familyPlans':
        this.toggleFilterFamilyPlans(value);
        return;
      case 'children':
        this.toggleFilterChildren(value);
        return;
      case 'loveStyles':
        this.toggleFilterLoveStyles(value);
        return;
      case 'communicationStyles':
        this.toggleFilterCommunicationStyles(value);
        return;
      case 'sexualOrientations':
        this.toggleFilterSexualOrientations(value);
        return;
      case 'religions':
        this.toggleFilterReligions(value);
        return;
      case 'physiques':
        this.toggleFilterPhysique(value);
        return;
      case 'languages':
        this.toggleFilterLanguage(value);
        return;
      case 'genders':
        if (value === 'woman' || value === 'man') {
          this.toggleFilterGender(value);
        }
        return;
      case 'horoscopes':
        this.toggleFilterHoroscope(value);
        return;
      case 'traitLabels':
        this.toggleFilterTraitLabel(value);
        return;
      default:
        return;
    }
  }

  protected isActiveFilterSelectorOptionSelected(value: string): boolean {
    switch (this.filterSelector) {
      case 'interests':
        return this.isInterestSelected(value);
      case 'values':
        return this.isValueSelected(value);
      case 'smoking':
        return this.isSmokingSelected(value);
      case 'drinking':
        return this.isDrinkingSelected(value);
      case 'workout':
        return this.isWorkoutSelected(value);
      case 'pets':
        return this.isPetsSelected(value);
      case 'familyPlans':
        return this.isFamilyPlansSelected(value);
      case 'children':
        return this.isChildrenSelected(value);
      case 'loveStyles':
        return this.isLoveStylesSelected(value);
      case 'communicationStyles':
        return this.isCommunicationStylesSelected(value);
      case 'sexualOrientations':
        return this.isSexualOrientationsSelected(value);
      case 'religions':
        return this.isReligionsSelected(value);
      case 'physiques':
        return this.isPhysiqueSelected(value);
      case 'languages':
        return this.isLanguageSelected(value);
      case 'genders':
        return value === 'woman' || value === 'man' ? this.isGenderSelected(value) : false;
      case 'horoscopes':
        return this.isHoroscopeSelected(value);
      case 'traitLabels':
        return this.isTraitLabelSelected(value);
      default:
        return false;
    }
  }

  protected filterSelectorSelectedValues(kind: FilterSelectorKind): string[] {
    switch (kind) {
      case 'interests':
        return [...this.filterDraft.interests];
      case 'values':
        return [...this.filterDraft.values];
      case 'smoking':
        return [...this.filterDraft.smoking];
      case 'drinking':
        return [...this.filterDraft.drinking];
      case 'workout':
        return [...this.filterDraft.workout];
      case 'pets':
        return [...this.filterDraft.pets];
      case 'familyPlans':
        return [...this.filterDraft.familyPlans];
      case 'children':
        return [...this.filterDraft.children];
      case 'loveStyles':
        return [...this.filterDraft.loveStyles];
      case 'communicationStyles':
        return [...this.filterDraft.communicationStyles];
      case 'sexualOrientations':
        return [...this.filterDraft.sexualOrientations];
      case 'religions':
        return [...this.filterDraft.religions];
      case 'physiques':
        return [...this.filterDraft.physiques];
      case 'languages':
        return [...this.filterDraft.languages];
      case 'genders':
        return [...this.filterDraft.genders];
      case 'horoscopes':
        return [...this.filterDraft.horoscopes];
      case 'traitLabels':
        return [...this.filterDraft.traitLabels];
      default:
        return [];
    }
  }

  protected filterSelectorValueLabel(kind: FilterSelectorKind, value: string): string {
    if (kind !== 'genders') {
      return value;
    }
    return this.genderFilterOptions.find(option => option.value === value)?.label ?? value;
  }

  protected removeFilterSelectorValue(kind: FilterSelectorKind, value: string, event?: Event): void {
    event?.stopPropagation();
    switch (kind) {
      case 'interests':
        this.filterDraft.interests = this.filterDraft.interests.filter(item => item !== value);
        return;
      case 'values':
        this.filterDraft.values = this.filterDraft.values.filter(item => item !== value);
        return;
      case 'smoking':
        this.filterDraft.smoking = this.filterDraft.smoking.filter(item => item !== value);
        return;
      case 'drinking':
        this.filterDraft.drinking = this.filterDraft.drinking.filter(item => item !== value);
        return;
      case 'workout':
        this.filterDraft.workout = this.filterDraft.workout.filter(item => item !== value);
        return;
      case 'pets':
        this.filterDraft.pets = this.filterDraft.pets.filter(item => item !== value);
        return;
      case 'familyPlans':
        this.filterDraft.familyPlans = this.filterDraft.familyPlans.filter(item => item !== value);
        return;
      case 'children':
        this.filterDraft.children = this.filterDraft.children.filter(item => item !== value);
        return;
      case 'loveStyles':
        this.filterDraft.loveStyles = this.filterDraft.loveStyles.filter(item => item !== value);
        return;
      case 'communicationStyles':
        this.filterDraft.communicationStyles = this.filterDraft.communicationStyles.filter(item => item !== value);
        return;
      case 'sexualOrientations':
        this.filterDraft.sexualOrientations = this.filterDraft.sexualOrientations.filter(item => item !== value);
        return;
      case 'religions':
        this.filterDraft.religions = this.filterDraft.religions.filter(item => item !== value);
        return;
      case 'physiques':
        this.filterDraft.physiques = this.filterDraft.physiques.filter(item => item !== value);
        return;
      case 'languages':
        this.filterDraft.languages = this.filterDraft.languages.filter(item => item.toLowerCase() !== value.toLowerCase());
        this.refreshFilterLanguageSuggestionPool();
        return;
      case 'genders':
        if (value === 'woman' || value === 'man') {
          this.filterDraft.genders = this.filterDraft.genders.filter(item => item !== value);
        }
        return;
      case 'horoscopes':
        this.filterDraft.horoscopes = this.filterDraft.horoscopes.filter(item => item !== value);
        return;
      case 'traitLabels':
        this.filterDraft.traitLabels = this.filterDraft.traitLabels.filter(item => item !== value);
        return;
      default:
        return;
    }
  }

  protected onAgeMinChange(value: number): void {
    this.filterDraft.ageMin = Number(value);
    if (this.filterDraft.ageMin > this.filterDraft.ageMax) {
      this.filterDraft.ageMax = this.filterDraft.ageMin;
    }
  }

  protected onAgeMaxChange(value: number): void {
    this.filterDraft.ageMax = Number(value);
    if (this.filterDraft.ageMax < this.filterDraft.ageMin) {
      this.filterDraft.ageMin = this.filterDraft.ageMax;
    }
  }

  protected onHeightMinChange(value: number): void {
    this.filterDraft.heightMinCm = Number(value);
    if (this.filterDraft.heightMinCm > this.filterDraft.heightMaxCm) {
      this.filterDraft.heightMaxCm = this.filterDraft.heightMinCm;
    }
  }

  protected onHeightMaxChange(value: number): void {
    this.filterDraft.heightMaxCm = Number(value);
    if (this.filterDraft.heightMaxCm < this.filterDraft.heightMinCm) {
      this.filterDraft.heightMinCm = this.filterDraft.heightMaxCm;
    }
  }

  private toggleArraySelection<T extends string>(values: T[], target: T): T[] {
    const hasTarget = values.includes(target);
    return hasTarget ? values.filter(item => item !== target) : [...values, target];
  }

  private filterLanguageToneIndex(value: string): number {
    const normalized = this.normalizeLanguageText(value);
    if (!normalized) {
      return 1;
    }
    let hash = 0;
    for (const char of normalized) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return (hash % 8) + 1;
  }

  private normalizeLanguageText(value: string): string {
    return value.trim().toLowerCase();
  }

  private refreshFilterLanguageSuggestionPool(): void {
    const pool = new Map<string, string>();
    for (const item of this.availableLanguages) {
      const normalized = this.normalizeLanguageText(item);
      if (!normalized || pool.has(normalized)) {
        continue;
      }
      pool.set(normalized, item.trim());
    }
    for (const item of this.filterLanguageSuggestionPool) {
      const normalized = this.normalizeLanguageText(item);
      if (!normalized || pool.has(normalized)) {
        continue;
      }
      pool.set(normalized, item.trim());
    }
    for (const item of this.filterDraft.languages) {
      const normalized = this.normalizeLanguageText(item);
      if (!normalized || pool.has(normalized)) {
        continue;
      }
      pool.set(normalized, item.trim());
    }
    this.filterLanguageSuggestionPool = Array.from(pool.values()).sort((a, b) => a.localeCompare(b));
  }

  private filterSelectorSelectionCount(kind: FilterSelectorKind): number {
    switch (kind) {
      case 'interests':
        return this.filterDraft.interests.length;
      case 'values':
        return this.filterDraft.values.length;
      case 'smoking':
        return this.filterDraft.smoking.length;
      case 'drinking':
        return this.filterDraft.drinking.length;
      case 'workout':
        return this.filterDraft.workout.length;
      case 'pets':
        return this.filterDraft.pets.length;
      case 'familyPlans':
        return this.filterDraft.familyPlans.length;
      case 'children':
        return this.filterDraft.children.length;
      case 'loveStyles':
        return this.filterDraft.loveStyles.length;
      case 'communicationStyles':
        return this.filterDraft.communicationStyles.length;
      case 'sexualOrientations':
        return this.filterDraft.sexualOrientations.length;
      case 'religions':
        return this.filterDraft.religions.length;
      case 'physiques':
        return this.filterDraft.physiques.length;
      case 'languages':
        return this.filterDraft.languages.length;
      case 'genders':
        return this.filterDraft.genders.length;
      case 'horoscopes':
        return this.filterDraft.horoscopes.length;
      case 'traitLabels':
        return this.filterDraft.traitLabels.length;
      default:
        return 0;
    }
  }

  private filterSelectorLabels(kind: FilterSelectorKind): string[] {
    switch (kind) {
      case 'interests':
        return [...this.filterDraft.interests];
      case 'values':
        return [...this.filterDraft.values];
      case 'smoking':
        return [...this.filterDraft.smoking];
      case 'drinking':
        return [...this.filterDraft.drinking];
      case 'workout':
        return [...this.filterDraft.workout];
      case 'pets':
        return [...this.filterDraft.pets];
      case 'familyPlans':
        return [...this.filterDraft.familyPlans];
      case 'children':
        return [...this.filterDraft.children];
      case 'loveStyles':
        return [...this.filterDraft.loveStyles];
      case 'communicationStyles':
        return [...this.filterDraft.communicationStyles];
      case 'sexualOrientations':
        return [...this.filterDraft.sexualOrientations];
      case 'religions':
        return [...this.filterDraft.religions];
      case 'physiques':
        return [...this.filterDraft.physiques];
      case 'languages':
        return [...this.filterDraft.languages];
      case 'genders':
        return this.filterDraft.genders.map(value => this.genderFilterOptions.find(item => item.value === value)?.label ?? value);
      case 'horoscopes':
        return [...this.filterDraft.horoscopes];
      case 'traitLabels':
      default:
        return [...this.filterDraft.traitLabels];
    }
  }

  private userInterests(user: DemoUser): string[] {
    return getGameUserInterests(user, this.context?.userFacets ?? {});
  }

  private userValues(user: DemoUser): string[] {
    return getGameUserValues(user, this.context?.userFacets ?? {});
  }

  private userFacet(user: DemoUser) {
    return getGameUserFacet(user, this.context?.userFacets ?? {});
  }
}

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
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import {
  AppMenuComponent,
  I18nPipe,
  ProgressIndicatorComponent,
  buildTabbedMenuModel,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuStaticOptionGroup,
  type AppMenuTrigger
} from '../../../shared/ui';
import {
  GameFilterForm,
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
import type {
  GameFilterMenuKind,
  GameFilterOptionGroup,
  HomeGameFilterPopupContext
} from './home-game-filter.shared';

type GameFilterMenuId = string;
type GameFilterMenuContext = {
  kind: GameFilterMenuKind;
  value: string;
};

@Component({
  selector: 'app-home-game-filter-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    CommonModule,
    FormsModule,
    I18nPipe,
    MatIconModule,
    MatSliderModule,
    ProgressIndicatorComponent
  ],
  templateUrl: './home-game-filter-popup.component.html',
  styleUrl: './home-game-filter-popup.component.scss'
})
export class HomeGameFilterPopupComponent implements OnChanges {
  @Input() context: HomeGameFilterPopupContext | null = null;
  @Input() saving = false;

  @Output() readonly closed = new EventEmitter<GameFilterForm | null>();

  protected filterDraft!: GameFilterForm;
  protected readonly genderFilterOptions: Array<{ value: UserDto['gender']; label: string; icon: string }> = [
    { value: 'woman', label: 'gender.woman', icon: 'female' },
    { value: 'man', label: 'gender.man', icon: 'male' }
  ];
  protected readonly basicsFilterMenuKinds: readonly GameFilterMenuKind[] = ['horoscopes', 'languages'];
  protected readonly beliefsFilterMenuKinds: readonly GameFilterMenuKind[] = ['values', 'religions'];
  protected readonly lifestyleFilterMenuKinds: readonly GameFilterMenuKind[] = [
    'interests',
    'physiques',
    'smoking',
    'drinking',
    'workout',
    'pets'
  ];
  protected readonly relationshipFilterMenuKinds: readonly GameFilterMenuKind[] = [
    'genders',
    'traitLabels',
    'familyPlans',
    'children',
    'loveStyles',
    'communicationStyles',
    'sexualOrientations'
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['context'] || !this.context) {
      return;
    }
    this.filterDraft = cloneGameFilter(this.context.filter);
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

  protected filterMenuTitle(kind: GameFilterMenuKind): string {
    switch (kind) {
      case 'interests':
        return 'interest';
      case 'values':
        return 'values';
      case 'physiques':
        return 'physique';
      case 'languages':
        return 'profile.languages';
      case 'genders':
        return 'gender';
      case 'horoscopes':
        return 'profile.horoscope';
      case 'traitLabels':
        return 'top.trait';
      case 'smoking':
        return 'smoking';
      case 'drinking':
        return 'drinking';
      case 'workout':
        return 'workout';
      case 'pets':
        return 'pets';
      case 'familyPlans':
        return 'family.plans';
      case 'children':
        return 'children';
      case 'loveStyles':
        return 'love.style';
      case 'communicationStyles':
        return 'communication.style';
      case 'sexualOrientations':
        return 'sexual.orientation';
      case 'religions':
        return 'religion';
    }
  }

  protected filterMenuTrigger(kind: GameFilterMenuKind): AppMenuTrigger {
    return {
      icon: this.filterMenuIcon(kind),
      palette: this.filterMenuPalette(kind),
      layout: 'field',
      ariaLabel: this.filterMenuTitle(kind)
    };
  }

  protected filterMenuModel(kind: GameFilterMenuKind): AppMenuModel<GameFilterMenuId, GameFilterMenuContext> {
    return buildTabbedMenuModel<GameFilterMenuId, GameFilterMenuContext>({
      idPrefix: `game-filter-${kind}`,
      groups: this.filterMenuGroups(kind),
      selected: this.filterMenuSelectedValues(kind),
      context: value => ({ kind, value }),
      itemLabel: value => this.filterMenuValueLabel(kind, value),
      itemIcon: (value, group) => this.filterMenuItemIcon(kind, value, group),
      itemPalette: (_value, group) => this.filterMenuGroupPalette(kind, group),
      groupIcon: group => group.icon || this.filterMenuIcon(kind),
      groupPalette: group => this.filterMenuGroupPalette(kind, group),
      summary: {
        emptyLabel: 'any',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  protected onGameFilterMenuSelect(
    event: AppMenuItemSelectEvent<GameFilterMenuId, GameFilterMenuContext>
  ): void {
    const context = event.context;
    if (!context) {
      return;
    }
    const value = `${event.value ?? context.value}`.trim();
    if (!value) {
      return;
    }
    if (event.action === 'remove') {
      this.removeFilterMenuValue(context.kind, value, event.sourceEvent);
      return;
    }
    this.toggleGameFilterMenuValue(context.kind, value);
  }

  protected requestClose(event?: Event): void {
    event?.stopPropagation();
    if (this.saving) {
      return;
    }
    this.closed.emit(null);
  }

  protected apply(): void {
    if (this.saving) {
      return;
    }
    this.closed.emit(normalizeGameFilter(this.filterDraft));
  }

  private filterMenuGroups(kind: GameFilterMenuKind): readonly GameFilterOptionGroup[] {
    if (kind === 'interests') {
      return this.interestOptionGroups;
    }
    if (kind === 'values') {
      return this.valueOptionGroups;
    }
    return [{
      title: this.filterMenuTitle(kind),
      icon: this.filterMenuIcon(kind),
      toneClass: this.filterMenuToneClass(kind),
      options: this.filterMenuOptions(kind)
    }];
  }

  private filterMenuOptions(kind: GameFilterMenuKind): string[] {
    switch (kind) {
      case 'interests':
        return this.mergeFilterOptions(this.availableInterests, this.filterDraft.interests);
      case 'values':
        return this.mergeFilterOptions(this.availableValues, this.filterDraft.values);
      case 'smoking':
        return this.mergeFilterOptions(this.availableSmokingOptions, this.filterDraft.smoking);
      case 'drinking':
        return this.mergeFilterOptions(this.availableDrinkingOptions, this.filterDraft.drinking);
      case 'workout':
        return this.mergeFilterOptions(this.availableWorkoutOptions, this.filterDraft.workout);
      case 'pets':
        return this.mergeFilterOptions(this.availablePetsOptions, this.filterDraft.pets);
      case 'familyPlans':
        return this.mergeFilterOptions(this.availableFamilyPlanOptions, this.filterDraft.familyPlans);
      case 'children':
        return this.mergeFilterOptions(this.availableChildrenOptions, this.filterDraft.children);
      case 'loveStyles':
        return this.mergeFilterOptions(this.availableLoveStyleOptions, this.filterDraft.loveStyles);
      case 'communicationStyles':
        return this.mergeFilterOptions(this.availableCommunicationStyleOptions, this.filterDraft.communicationStyles);
      case 'sexualOrientations':
        return this.mergeFilterOptions(this.availableSexualOrientationOptions, this.filterDraft.sexualOrientations);
      case 'religions':
        return this.mergeFilterOptions(this.availableReligionOptions, this.filterDraft.religions);
      case 'physiques':
        return this.mergeFilterOptions(this.availablePhysiques, this.filterDraft.physiques);
      case 'languages':
        return this.mergeFilterOptions(this.availableLanguages, this.filterDraft.languages);
      case 'genders':
        return this.genderFilterOptions.map(option => option.value);
      case 'horoscopes':
        return this.mergeFilterOptions(this.availableHoroscopes, this.filterDraft.horoscopes);
      case 'traitLabels':
        return this.mergeFilterOptions(this.availableTraitLabels, this.filterDraft.traitLabels);
    }
  }

  private filterMenuItemIcon(
    kind: GameFilterMenuKind,
    value: string,
    group: AppMenuStaticOptionGroup
  ): string {
    if (kind === 'genders') {
      return this.genderFilterOptions.find(option => option.value === value)?.icon ?? this.filterMenuIcon(kind);
    }
    return group.icon || this.filterMenuIcon(kind);
  }

  private filterMenuIcon(kind: GameFilterMenuKind): string {
    switch (kind) {
      case 'interests':
        return 'sell';
      case 'values':
        return 'auto_awesome';
      case 'physiques':
        return 'accessibility_new';
      case 'languages':
        return 'language';
      case 'genders':
        return 'wc';
      case 'horoscopes':
        return 'brightness_5';
      case 'traitLabels':
        return 'stars';
      case 'smoking':
        return 'smoking_rooms';
      case 'drinking':
        return 'local_bar';
      case 'workout':
        return 'fitness_center';
      case 'pets':
        return 'pets';
      case 'familyPlans':
        return 'family_restroom';
      case 'children':
        return 'child_care';
      case 'loveStyles':
        return 'favorite';
      case 'communicationStyles':
        return 'forum';
      case 'sexualOrientations':
        return 'diversity_1';
      case 'religions':
        return 'church';
    }
  }

  private filterMenuPalette(kind: GameFilterMenuKind): AppMenuPalette {
    switch (kind) {
      case 'interests':
      case 'smoking':
      case 'workout':
      case 'sexualOrientations':
        return 'green';
      case 'values':
        return 'purple';
      case 'physiques':
      case 'drinking':
      case 'languages':
        return 'blue';
      case 'genders':
      case 'pets':
      case 'familyPlans':
        return 'orange';
      case 'horoscopes':
      case 'religions':
        return 'gold';
      case 'traitLabels':
      case 'loveStyles':
        return 'pink';
      case 'children':
        return 'sky';
      case 'communicationStyles':
        return 'violet';
    }
  }

  private filterMenuToneClass(kind: GameFilterMenuKind): string {
    switch (kind) {
      case 'interests':
        return 'game-filter-group-tone-lifestyle';
      case 'values':
        return 'game-filter-group-tone-beliefs';
      case 'physiques':
      case 'drinking':
      case 'languages':
        return 'game-filter-group-tone-social';
      case 'smoking':
      case 'workout':
      case 'sexualOrientations':
        return 'game-filter-group-tone-active';
      case 'genders':
      case 'pets':
      case 'familyPlans':
        return 'game-filter-group-tone-family';
      case 'horoscopes':
      case 'religions':
        return 'game-filter-group-tone-beliefs';
      case 'traitLabels':
      case 'loveStyles':
        return 'game-filter-group-tone-ambition';
      case 'children':
        return 'game-filter-group-tone-identity';
      case 'communicationStyles':
        return 'game-filter-group-tone-arts';
    }
  }

  private filterMenuGroupPalette(kind: GameFilterMenuKind, group: AppMenuStaticOptionGroup): AppMenuPalette {
    switch (group.toneClass) {
      case 'game-filter-group-tone-social':
        return 'blue';
      case 'game-filter-group-tone-arts':
        return 'violet';
      case 'game-filter-group-tone-food':
      case 'game-filter-group-tone-family':
        return 'orange';
      case 'game-filter-group-tone-active':
        return 'green';
      case 'game-filter-group-tone-mind':
      case 'game-filter-group-tone-lifestyle':
        return 'teal';
      case 'game-filter-group-tone-identity':
        return 'cyan';
      case 'game-filter-group-tone-ambition':
        return 'pink';
      case 'game-filter-group-tone-beliefs':
        return 'gold';
      default:
        return this.filterMenuPalette(kind);
    }
  }

  private mergeFilterOptions(...optionLists: readonly (readonly string[])[]): string[] {
    const optionsByKey = new Map<string, string>();
    for (const optionList of optionLists) {
      for (const option of optionList) {
        const normalized = option.trim();
        const key = normalized.toLowerCase();
        if (!normalized || optionsByKey.has(key)) {
          continue;
        }
        optionsByKey.set(key, normalized);
      }
    }
    return Array.from(optionsByKey.values()).sort((a, b) => a.localeCompare(b));
  }

  private toggleGameFilterMenuValue(kind: GameFilterMenuKind, value: string): void {
    switch (kind) {
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
  }

  protected toggleFilterGender(gender: UserDto['gender']): void {
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

  protected filterMenuSelectedValues(kind: GameFilterMenuKind): string[] {
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

  protected filterMenuValueLabel(kind: GameFilterMenuKind, value: string): string {
    if (kind !== 'genders') {
      return value;
    }
    return this.genderFilterOptions.find(option => option.value === value)?.label ?? value;
  }

  protected removeFilterMenuValue(kind: GameFilterMenuKind, value: string, event?: Event): void {
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

  private userInterests(user: UserDto): string[] {
    return getGameUserInterests(user, this.context?.userFacets ?? {});
  }

  private userValues(user: UserDto): string[] {
    return getGameUserValues(user, this.context?.userFacets ?? {});
  }

  private userFacet(user: UserDto) {
    return getGameUserFacet(user, this.context?.userFacets ?? {});
  }
}

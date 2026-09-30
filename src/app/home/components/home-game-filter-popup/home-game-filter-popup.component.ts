import { scheduleAfterPaint } from '../../../shared/ui/scheduler/after-paint';
import { resolveSideMenuPresentation } from '../../../shared/ui/components/side-menu/side-menu-presenters';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { ProfileFormFlowConverter } from '../../../shared/ui/converters/profile-form-flow.converter';
import { ExplanationGuideService } from '../../../shared/core/base/services/explanation-guide.service';
import {
  AppMenuComponent,
  FormFlowComponent,
  I18nPipe,
  PopupComponent,
  type FormFlowMenuControlConfig,
  type AppMenuGroup,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuTrigger,
  type PopupControl,
  type PopupModel
} from '../../../shared/ui';
import {
  GameFilterForm,
  cloneGameFilter,
  normalizeGameFilter,
  GAME_FILTER_AGE_MAX,
  GAME_FILTER_AGE_MIN,
  GAME_FILTER_HEIGHT_MAX_CM,
  GAME_FILTER_HEIGHT_MIN_CM
} from '../../shared/home-game-filter.shared';
import type {
  GameFilterMenuKind,
  HomeGameFilterPopupContext
} from '../../shared/home-game-filter.shared';

type GameFilterMenuId = string;
type GameFilterMenuContext =
  | { kind: GameFilterMenuKind; value: string }
  | { kind: 'apply' };

@Component({
  selector: 'app-home-game-filter-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    FormFlowComponent,
    FormsModule,
    I18nPipe,
    MatSliderModule,
    PopupComponent
  ],
  templateUrl: './home-game-filter-popup.component.html',
  styleUrl: './home-game-filter-popup.component.scss'
})
export class HomeGameFilterPopupComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() context: HomeGameFilterPopupContext | null = null;
  @Input() saving = false;

  @Output() readonly closed = new EventEmitter<GameFilterForm | null>();

  protected filterDraft!: GameFilterForm;
  protected readonly preparing = signal(true);
  private cancelPreparation: (() => void) | null = null;
  private readonly explanationGuide = inject(ExplanationGuideService);
  private unregisterExplanationContext: (() => void) | null = null;
  private cachedProfileFieldMenus: Map<string, FormFlowMenuControlConfig> | null = null;
  private readonly menuModels = new Map<GameFilterMenuKind, {
    selected: string[];
    model: AppMenuModel<GameFilterMenuId, GameFilterMenuContext>;
  }>();

  private get profileFieldMenus(): Map<string, FormFlowMenuControlConfig> {
    return this.cachedProfileFieldMenus ??= new Map(
      ProfileFormFlowConverter.convert(null, { imageEditor: 'external', showHeader: false, showSave: false })
        .steps.flatMap(step => step.controls ?? [])
        .filter(control => control.kind === 'menu')
        .map(control => [control.id, control.config as FormFlowMenuControlConfig])
    );
  }

  ngAfterViewInit(): void {
    this.cancelPreparation = scheduleAfterPaint(() => {
      this.preparing.set(false);
      this.cancelPreparation = null;
    });
  }

  ngOnDestroy(): void {
    this.cancelPreparation?.();
    this.unregisterExplanationContext?.();
    this.unregisterExplanationContext = null;
  }

  private readonly profileFieldIds: Partial<Record<GameFilterMenuKind, string>> = {
    interests: 'interests', values: 'values', physiques: 'physique', languages: 'languages',
    genders: 'gender', smoking: 'smoking', drinking: 'drinking', workout: 'workout', pets: 'pets',
    familyPlans: 'familyPlans', children: 'children', loveStyles: 'loveStyle',
    communicationStyles: 'communicationStyle', sexualOrientations: 'sexualOrientation', religions: 'religion'
  };
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
    if (!changes['context']) {
      return;
    }
    if (this.context) {
      this.unregisterExplanationContext ??= this.explanationGuide.registerContext('home.filters');
    } else {
      this.unregisterExplanationContext?.();
      this.unregisterExplanationContext = null;
    }
    if (!this.context) return;
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

  protected gameFilterPopupModel(): PopupModel<GameFilterMenuContext> {
    return {
      title: 'game.filters',
      ariaLabel: 'Game filters',
      closeAriaLabel: 'Close filter popup',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      closeOnBackdrop: !this.saving,
      headerControls: this.gameFilterPopupHeaderControls(),
      onClose: event => this.requestClose(event),
      onMenuSelect: event => this.onGameFilterMenuSelect(event.itemSelect)
    };
  }

  protected gameFilterPopupZIndex(): number {
    return 10020;
  }

  private gameFilterPopupHeaderControls(): PopupControl<GameFilterMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'game-filter-actions',
      menuKind: 'inline',
      items: this.gameFilterPopupActionItems(),
      panelAlign: 'end',
      closeOnSelect: false
    }];
  }

  private gameFilterPopupActionItems(): readonly AppMenuItem<GameFilterMenuId, GameFilterMenuContext>[] {
    return [{
      id: 'game-filter-apply',
      icon: 'check',
      kind: 'action',
      palette: 'green',
      disabled: this.saving || this.preparing(),
      ariaLabel: this.saving ? 'Saving filters' : 'Apply filters',
      progress: this.saving
        ? {
            state: 'loading',
            shape: 'circle'
          }
        : null,
      context: { kind: 'apply' }
    }];
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
      ...this.profileFieldMenus.get(this.profileFieldIds[kind] ?? '')?.trigger,
      label: undefined,
      ...(kind === 'horoscopes' ? { icon: 'brightness_5', palette: 'gold' as const } : {}),
      ...(kind === 'traitLabels' ? { icon: 'stars', palette: 'pink' as const } : {}),
      layout: 'field',
      ariaLabel: this.filterMenuTitle(kind)
    };
  }

  protected filterMenuSearchable(kind: GameFilterMenuKind): boolean {
    return kind === 'languages' || kind === 'interests' || kind === 'values';
  }

  protected filterMenuModel(kind: GameFilterMenuKind): AppMenuModel<GameFilterMenuId, GameFilterMenuContext> {
    const cached = this.menuModels.get(kind);
    if (cached?.selected === this.filterDraft[kind]) return cached.model;
    const config = this.profileFieldMenus.get(this.profileFieldIds[kind] ?? '');
    let groups: readonly AppMenuGroup[] = config?.model?.groups ?? [{
      id: `game-filter-${kind}`, label: this.filterMenuTitle(kind), items: config?.items ?? []
    }];
    if (kind === 'horoscopes') {
      groups = [{ id: 'horoscopes', items: Object.entries(APP_STATIC_DATA.profileHoroscopeMetaBySign)
        .map(([value, meta]) => ({ id: value, value, ...meta, iconKind: 'text', surface: 'tinted' })) }];
    } else if (kind === 'traitLabels') {
      groups = [{ id: 'traits', items: APP_STATIC_DATA.personalityTraitCatalog.map(trait => ({
        id: trait.id, value: trait.label, label: trait.label, icon: trait.icon, surface: 'tinted',
        palette: resolveSideMenuPresentation('trait', trait.label).menuPalette
      })) }];
    }
    if (kind === 'languages') {
      const items = groups.flatMap(group => group.items ?? []);
      groups = [{ id: 'languages-a-h', label: 'A–H' }, { id: 'languages-i-z', label: 'I–Z' }]
        .map((group, index) => ({ ...group, icon: 'language', palette: config?.trigger?.palette,
          items: items.filter(item => (`${item.value}`.toLowerCase() < 'i') === (index === 0))
            .sort((left, right) => `${left.value}`.localeCompare(`${right.value}`)) }));
    }
    const selected = new Set(this.filterDraft[kind].map(value => value.trim().toLowerCase()));
    const known = new Set<string>();
    const adapt = (item: AppMenuItem): AppMenuItem<GameFilterMenuId, GameFilterMenuContext> => {
      const value = `${item.value ?? item.id}`;
      const key = value.trim().toLowerCase();
      known.add(key);
      const active = selected.has(key);
      return { label: item.label, icon: item.icon, iconKind: item.iconKind, palette: item.palette,
        surface: item.surface, togglePalette: item.togglePalette, id: `game-filter-${kind}-${item.id}`, value,
        kind: 'checkbox', checked: active, active, removable: active,
        disabled: false, closeOnSelect: false, context: { kind, value } };
    };
    const adapted = groups.map(group => ({ ...group, headerActions: undefined,
      items: (group.items ?? []).map(adapt) }));
    // A saved custom value must remain removable even if it is outside the current editor catalog.
    for (const value of this.filterDraft[kind]) {
      if (!known.has(value.trim().toLowerCase())) {
        adapted[0].items.push(adapt({ id: value, value, label: value }));
      }
    }
    const model: AppMenuModel<GameFilterMenuId, GameFilterMenuContext> = { layout: 'tabs', maxSelected: null, groups: adapted,
      summary: { emptyLabel: 'any', maxLabels: 2, counter: 'overflow' } };
    this.menuModels.set(kind, { selected: this.filterDraft[kind], model });
    return model;
  }

  protected onGameFilterMenuSelect(
    event: AppMenuItemSelectEvent<GameFilterMenuId, GameFilterMenuContext>
  ): void {
    const context = event.context;
    if (!context) {
      return;
    }
    if (context.kind === 'apply') {
      this.apply();
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
    if (this.saving || this.preparing()) {
      return;
    }
    this.closed.emit(normalizeGameFilter(this.filterDraft));
  }

  private toggleGameFilterMenuValue(kind: GameFilterMenuKind, value: string): void {
    this.filterDraft[kind] = this.toggleArraySelection(this.filterDraft[kind], value);
  }

  protected removeFilterMenuValue(kind: GameFilterMenuKind, value: string, event?: Event): void {
    event?.stopPropagation();
    this.filterDraft[kind] = this.filterDraft[kind].filter(item => item.trim().toLowerCase() !== value.trim().toLowerCase());
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
    const key = target.trim().toLowerCase();
    const hasTarget = values.some(item => item.trim().toLowerCase() === key);
    return hasTarget ? values.filter(item => item.trim().toLowerCase() !== key) : [...values, target];
  }

}

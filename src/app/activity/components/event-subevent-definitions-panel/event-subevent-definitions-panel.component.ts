import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, Input, Output, inject } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';

import { AppUtils } from '../../../shared/app-utils';
import { PricingBuilder } from '../../../shared/core/base/builders';
import { ActivityEventDetailDTO, type SubEventDefinitionDTO } from '../../../shared/core/contracts/activity.interface';
import type { DateRangeDto } from '../../../shared/core/contracts/date.interface';
import type * as EventContracts from '../../../shared/core/contracts/event.interface';
import {
  CARD_MENU_ACTIONS,
  InfoCardComponent,
  AppMenuComponent,
  TextCardComponent,
  type AppMenuItem,
  SmartListComponent,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger,
  type CardMenuActionEvent,
  type InfoCardData,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage,
  type TextCardBadgeTone,
  type TextCardStatusTone,
  type TextCardTone
} from '../../../shared/ui';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import {
  EventSubeventStageFormPopupComponent,
  type EventSubeventStageFormModel,
  type EventSubeventStageFormPopupView,
  type EventSubeventStageInsertPlacement,
  type EventSubeventTournamentLeaderboardType
} from '../event-subevent-stage-form-popup/event-subevent-stage-form-popup.component';

interface SubEventDefinitionsPanelFilters {
  revision: number;
}

type SubEventDefinitionSmartListView = 'timeline' | 'list';

interface SubEventDefinitionFormState {
  index: number | null;
  id: string;
  icon: string | null;
  model: EventSubeventStageFormModel;
  insertPlacement: EventSubeventStageInsertPlacement;
  insertTargetId: string | null;
}

@Component({
  selector: 'app-event-subevent-definitions-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    SmartListComponent,
    InfoCardComponent,
    TextCardComponent,
    EventSubeventStageFormPopupComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EventSubeventDefinitionsPanelComponent),
      multi: true
    }
  ],
  templateUrl: './event-subevent-definitions-panel.component.html',
  styleUrl: './event-subevent-definitions-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventSubeventDefinitionsPanelComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogStore = inject(DialogStore);
  private onChange: (value: SubEventDefinitionDTO[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private revision = 0;
  private boundsValue: DateRangeDto | null = null;
  private readonly tournamentLeaderboardTypeOptions: readonly EventSubeventTournamentLeaderboardType[] = ['Score', 'Fifa'];
  private readonly definitionTimelineStepMinutes = 60;
  private readonly definitionTimelineVisibleStepCount = 5;

  @Input() mode: EventContracts.EventMode = 'Casual';
  @Input() enabled = false;
  @Input() modeControl: 'menu' | 'badge' = 'menu';
  @Input() showEnableToggle = true;
  @Input() readOnly = false;
  @Output() readonly enabledChange = new EventEmitter<boolean>();
  @Output() readonly modeChange = new EventEmitter<EventContracts.EventMode>();
  @Input()
  set bounds(value: DateRangeDto | null | undefined) {
    this.boundsValue = value ? ActivityEventDetailDTO.normalizeDateRange(value) : null;
    this.refreshDefinitionFormView();
  }

  protected definitions: SubEventDefinitionDTO[] = [];
  @Input() disabled = false;
  protected definitionForm: SubEventDefinitionFormState | null = null;
  protected definitionFormModelValue: EventSubeventStageFormModel = this.createDefinitionFormModel(null, 1);
  protected definitionFormView: EventSubeventStageFormPopupView = this.createDefinitionFormPopupView(null, this.definitionFormModelValue);
  protected definitionView: SubEventDefinitionSmartListView = 'timeline';
  protected smartListQuery: Partial<ListQuery<SubEventDefinitionsPanelFilters>> = {
    view: 'timeline',
    filters: { revision: 0 }
  };

  protected readonly smartListConfig: SmartListConfig<SubEventDefinitionDTO, SubEventDefinitionsPanelFilters> = {
    pageSize: 20,
    defaultView: 'timeline',
    views: [
      { key: 'timeline', label: 'Timeline', mode: 'timeline', pageSize: 20 },
      { key: 'list', label: 'Cards', mode: 'list', pageSize: 20 }
    ],
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No sub event definitions yet',
    emptyDescription: '',
    timeline: {
      stepMinutes: this.definitionTimelineStepMinutes,
      visibleDurationMinutes: () => this.definitionTimelineVisibleDurationMinutes(),
      pageStepMinutes: () => this.definitionTimelineVisibleDurationMinutes(),
      anchorRadius: 0,
      rowCount: 1,
      rowHeightPx: 92,
      useItemTemplate: true,
      resolveRange: item => this.definitionTimelineRange(item),
      badgeLabel: item => item.name,
      badgeMeta: item => `Duration ${this.durationLabel(item.durationMinutes)}`,
      badgeToneClass: item => `calendar-badge-tone-${((this.definitions.indexOf(item) + 6) % 6) + 1}`,
      offsetLabel: offset => this.minutesLabel(offset)
    },
    listLayout: 'card-grid',
    orientation: 'horizontal',
    desktopColumns: 3,
    snapMode: 'none',
    mobileStepper: true,
    pagination: {
      mode: 'arrows'
    },
    trackBy: (_index, item) => item.id
  };

  protected readonly loadDefinitionsPage: SmartListLoadPage<SubEventDefinitionDTO, SubEventDefinitionsPanelFilters> = () => of({
    items: this.definitions,
    total: this.definitions.length
  } satisfies PageResult<SubEventDefinitionDTO>);

  writeValue(value: readonly SubEventDefinitionDTO[] | null | undefined): void {
    this.definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(value ?? []);
    this.bumpList();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: SubEventDefinitionDTO[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected canEdit(): boolean {
    return !this.readOnly && !this.disabled;
  }

  protected shouldShowPanel(): boolean {
    return this.canEdit() || this.enabled;
  }

  protected canConfigureDefinitions(): boolean {
    return this.canEdit() && this.enabled;
  }

  protected panelSubtitle(): string {
    return this.enabled
      ? this.countLabel()
      : 'Use the main event without sub events.';
  }

  protected toggleSubEventsEnabled(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canEdit()) {
      return;
    }
    this.enabled = !this.enabled;
    this.enabledChange.emit(this.enabled);
  }

  protected modeLabel(): string {
    return this.mode === 'Tournament' ? 'Tournament' : 'Casual';
  }

  protected modeMenuTrigger(): AppMenuTrigger {
    const tournamentMode = this.mode === 'Tournament';
    return {
      label: this.modeLabel(),
      icon: tournamentMode ? 'emoji_events' : 'groups',
      palette: tournamentMode ? 'cyan' : 'slate',
      layout: 'pill',
      disabled: !this.canConfigureDefinitions()
    };
  }

  protected modeBadgeTrigger(): AppMenuTrigger {
    return {
      ...this.modeMenuTrigger(),
      trailingIcon: '',
      disabled: true
    };
  }

  protected modeMenuItems(): readonly AppMenuItem<EventContracts.EventMode, unknown>[] {
    return [
      {
        id: 'Casual',
        label: 'Casual',
        icon: 'groups',
        kind: 'radio',
        palette: 'slate',
        surface: 'tinted',
        active: this.mode !== 'Tournament',
        checked: this.mode !== 'Tournament'
      },
      {
        id: 'Tournament',
        label: 'Tournament',
        icon: 'emoji_events',
        kind: 'radio',
        palette: 'cyan',
        surface: 'tinted',
        active: this.mode === 'Tournament',
        checked: this.mode === 'Tournament'
      }
    ];
  }

  protected onModeMenuSelect(event: AppMenuItemSelectEvent<EventContracts.EventMode, unknown>): void {
    if (!this.canConfigureDefinitions()) {
      return;
    }
    this.mode = event.id === 'Tournament' ? 'Tournament' : 'Casual';
    this.modeChange.emit(this.mode);
  }

  protected viewMenuTrigger(): AppMenuTrigger {
    const timeline = this.definitionView === 'timeline';
    return {
      label: timeline ? 'Timeline' : 'Cards',
      icon: timeline ? 'timeline' : 'view_carousel',
      palette: timeline ? 'teal' : 'violet',
      layout: 'pill',
      disabled: !this.enabled
    };
  }

  protected viewMenuItems(): readonly AppMenuItem<SubEventDefinitionSmartListView, unknown>[] {
    return [
      {
        id: 'timeline',
        label: 'Timeline',
        icon: 'timeline',
        kind: 'radio',
        palette: 'teal',
        surface: 'tinted',
        active: this.definitionView === 'timeline',
        checked: this.definitionView === 'timeline'
      },
      {
        id: 'list',
        label: 'Cards',
        icon: 'view_carousel',
        kind: 'radio',
        palette: 'violet',
        surface: 'tinted',
        active: this.definitionView === 'list',
        checked: this.definitionView === 'list'
      }
    ];
  }

  protected onViewMenuSelect(event: AppMenuItemSelectEvent<SubEventDefinitionSmartListView, unknown>): void {
    this.definitionView = event.id === 'list' ? 'list' : 'timeline';
    this.bumpList();
  }

  protected addMenuItems(): readonly AppMenuItem<string, unknown>[] {
    if (!this.canConfigureDefinitions()) {
      return [];
    }
    return [{
      id: 'add',
      icon: 'add',
      ariaLabel: 'Add sub event definition',
      palette: 'amber'
    }];
  }

  protected onAddMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (event.id !== 'add') {
      return;
    }
    this.openCreateDefinitionForm(event.sourceEvent);
  }

  protected countLabel(): string {
    return `${this.definitions.length} item${this.definitions.length === 1 ? '' : 's'}`;
  }

  protected definitionCard(item: SubEventDefinitionDTO, index: number): InfoCardData {
    const isTournament = this.mode === 'Tournament';
    const stageNumber = index + 1;
    const totalStages = Math.max(this.definitions.length, 1);
    const accentHue = isTournament ? this.stageAccentHue(stageNumber, totalStages) : null;
    const sequenceLabel = isTournament ? `Stage ${stageNumber}` : `Sub Event ${stageNumber}`;
    const status = this.definitionStatus(item);
    const capacityMetaRow = this.definitionCapacityMetaRow(item, isTournament);
    return {
      id: item.id,
      title: item.name,
      mediaMode: 'title',
      mediaTone: 'neutral',
      mediaTitle: sequenceLabel,
      mediaSubtitle: this.mode,
      mediaIcon: item.icon || (isTournament ? 'emoji_events' : 'inventory_2'),
      metaRows: [
        this.definitionStartLabel(item, index),
        ...(capacityMetaRow ? [capacityMetaRow] : [])
      ],
      description: item.description || 'No description',
      descriptionLines: 2,
      surfaceTone: isTournament ? 'stage' : 'draft',
      accentHue,
      leadingIcon: {
        icon: isTournament ? 'emoji_events' : status.icon,
        tone: isTournament ? 'stage' : status.leadingTone
      },
      mediaStart: {
        variant: 'avatar',
        tone: 'default',
        icon: 'location_on',
        interactive: false
      },
      mediaEnd: {
        variant: 'badge',
        layout: isTournament ? 'default' : 'badge-with-leading-accessory',
        tone: isTournament ? 'stage' : status.overlayTone,
        label: isTournament ? sequenceLabel : status.label,
        icon: isTournament ? 'emoji_events' : undefined,
        interactive: false,
        leadingAccessory: isTournament ? null : {
          icon: status.icon,
          tone: status.accessoryTone
        }
      },
      mediaBottomEnd: {
        variant: 'badge',
        tone: 'stage-review',
        icon: 'schedule',
        label: this.durationMinutesBadgeLabel(item.durationMinutes),
        ariaLabel: `Duration ${this.durationLabel(item.durationMinutes)}`,
        interactive: false
      },
      menuActions: this.canConfigureDefinitions() ? ['edit', 'delete'] : []
    };
  }

  private definitionCapacityMetaRow(item: SubEventDefinitionDTO, isTournament: boolean): string | null {
    if (isTournament) {
      const min = this.toNonNegativeInteger(item.tournamentGroupCapacityMin ?? 0);
      const max = Math.max(min, this.toNonNegativeInteger(item.tournamentGroupCapacityMax ?? min));
      return min > 0 || max > 0 ? `Group capacity ${min} - ${max}` : null;
    }
    if (!item.optional) {
      return null;
    }
    const min = this.toNonNegativeInteger(item.capacityMin);
    const max = Math.max(min, this.toNonNegativeInteger(item.capacityMax));
    return min > 0 || max > 0 ? `Capacity ${min} - ${max}` : null;
  }

  private definitionStatus(item: SubEventDefinitionDTO): {
    label: string;
    icon: string;
    overlayTone: 'public' | 'blocked';
    leadingTone: 'public' | 'invitation';
    accessoryTone: 'positive' | 'negative';
  } {
    if (item.optional) {
      return {
        label: 'Optional',
        icon: 'toggle_on',
        overlayTone: 'public',
        leadingTone: 'public',
        accessoryTone: 'positive'
      };
    }
    return {
      label: 'Mandatory',
      icon: 'block',
      overlayTone: 'blocked',
      leadingTone: 'invitation',
      accessoryTone: 'negative'
    };
  }

  private stageAccentHue(stageNumber: number, totalStages: number): number {
    if (totalStages <= 1) {
      return 210;
    }
    const ratio = AppUtils.clampNumber((stageNumber - 1) / (totalStages - 1), 0, 1);
    return Math.round(210 - (210 * ratio));
  }

  protected definitionMenuContext(item: SubEventDefinitionDTO): Record<string, unknown> {
    return { definitionId: item.id };
  }

  protected definitionTimelineMenuItems(item: SubEventDefinitionDTO): readonly AppMenuItem<string, unknown>[] {
    if (!this.canConfigureDefinitions()) {
      return [];
    }
    const editConfig = CARD_MENU_ACTIONS['edit'];
    const deleteConfig = CARD_MENU_ACTIONS['delete'];
    return [
      {
        id: 'edit',
        label: editConfig.label,
        icon: editConfig.icon,
        palette: 'brown',
        surface: 'tinted',
        context: this.definitionMenuContext(item)
      },
      {
        id: 'delete',
        label: deleteConfig.label,
        icon: deleteConfig.icon,
        palette: 'danger',
        surface: 'tinted',
        context: this.definitionMenuContext(item)
      }
    ];
  }

  protected definitionTimelineIcon(item: SubEventDefinitionDTO): string {
    return item.icon || (this.mode === 'Tournament' ? 'emoji_events' : 'inventory_2');
  }

  protected definitionTimelineDetail(item: SubEventDefinitionDTO): string {
    return item.description || '';
  }

  protected definitionTimelineTone(_item: SubEventDefinitionDTO): TextCardTone {
    if (this.mode !== 'Tournament') {
      return 'draft';
    }
    return 'stage';
  }

  protected definitionTimelineAccentHue(item: SubEventDefinitionDTO): number | null {
    if (this.mode !== 'Tournament') {
      return null;
    }
    return this.stageAccentHue(this.definitionIndex(item) + 1, Math.max(this.definitions.length, 1));
  }

  protected definitionTimelineBadgeTone(_item: SubEventDefinitionDTO): TextCardBadgeTone {
    return 'warning';
  }

  protected definitionTimelineStatusLabel(item: SubEventDefinitionDTO): string {
    const index = this.definitionIndex(item);
    if (this.mode === 'Tournament') {
      return `Stage ${index + 1}`;
    }
    return this.definitionStatus(item).label;
  }

  protected definitionTimelineStatusIcon(item: SubEventDefinitionDTO): string {
    return this.mode === 'Tournament' ? 'emoji_events' : this.definitionStatus(item).icon;
  }

  protected definitionTimelineStatusTone(item: SubEventDefinitionDTO): TextCardStatusTone {
    if (this.mode === 'Tournament') {
      return 'stage';
    }
    return item.optional ? 'success' : 'danger';
  }

  protected definitionTimelineStatusAriaLabel(item: SubEventDefinitionDTO): string {
    return this.mode === 'Tournament'
      ? `${this.definitionTimelineStatusLabel(item)} definition`
      : `${this.definitionTimelineStatusLabel(item)} sub event definition`;
  }

  protected onDefinitionMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (!this.canConfigureDefinitions()) {
      return;
    }
    const context = event.context as { definitionId?: unknown } | undefined;
    const definitionId = `${context?.definitionId ?? ''}`.trim();
    const item = this.definitions.find(definition => definition.id === definitionId);
    if (!item) {
      return;
    }
    this.onCardMenuAction(item, {
      id: item.id,
      actionId: event.id,
      action: {
        id: event.id,
        label: `${event.item?.label ?? event.id}`,
        icon: `${event.item?.icon ?? ''}`
      },
      card: this.definitionCard(item, this.definitions.indexOf(item))
    });
  }

  protected openCreateDefinitionForm(event?: Event): void {
    event?.stopPropagation();
    if (!this.canConfigureDefinitions()) {
      return;
    }
    const nextIndex = this.definitions.length + 1;
    const model = this.createDefinitionFormModel(null, nextIndex);
    this.setDefinitionForm({
      index: null,
      id: `subevent-definition-${Date.now()}`,
      icon: null,
      model,
      insertPlacement: 'after',
      insertTargetId: this.definitions[this.definitions.length - 1]?.id ?? null
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected onCardMenuAction(item: SubEventDefinitionDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (!this.canConfigureDefinitions()) {
      return;
    }
    const index = this.definitions.findIndex(candidate => candidate.id === item.id);
    if (index < 0) {
      return;
    }
    if (event.actionId === 'edit') {
      this.openEditDefinitionForm(index);
      return;
    }
    if (event.actionId === 'delete') {
      this.requestDeleteDefinition(index);
    }
  }

  private createDefinitionFormPopupView(
    state: SubEventDefinitionFormState | null,
    model: EventSubeventStageFormModel
  ): EventSubeventStageFormPopupView {
    const isTournament = this.mode === 'Tournament';
    const isOptional = !isTournament && model.optional === true;
    const insertOptions = this.definitionInsertOptions();
    const leaderboardType = this.normalizedTournamentLeaderboardType(model.tournamentLeaderboardType);
    const timingBounds = this.definitionTimingBounds();
    const timingSummaryMeta = timingBounds
      ? `Main event range ${AppUtils.dateTimeRangeLabel(timingBounds.startAt, timingBounds.endAt, 'Date unavailable')}`
      : (isTournament ? 'Tournament definition' : 'Casual definition');

    const insertPlacement = state?.insertPlacement ?? 'after';
    return {
      open: Boolean(state),
      parentTitle: 'Sub Events',
      title: this.definitionFormTitle(state),
      readOnly: !this.canConfigureDefinitions(),
      canSave: this.canSaveDefinitionForm(model),
      invalidName: !this.hasText(model.name),
      invalidDescription: !this.hasText(model.description),
      showOptionalToggle: !isTournament,
      modeClass: isOptional ? 'subevent-mode-optional' : 'subevent-mode-mandatory',
      modeIcon: isOptional ? 'toggle_on' : 'block',
      slotBoundTiming: Boolean(timingBounds),
      timingSummaryTitle: timingBounds ? 'Main event range' : 'Definition',
      timingSummaryText: '',
      timingSummaryMeta,
      timingInputMode: 'duration',
      showInsertControls: state?.index === null && insertOptions.length > 0,
      showDuringInsertPlacement: !isTournament,
      insertFieldLabel: isTournament ? 'Insert Stage' : 'Insert Sub Event',
      insertPlacement: isTournament && insertPlacement === 'during' ? 'after' : insertPlacement,
      insertTargetId: state?.insertTargetId ?? insertOptions[insertOptions.length - 1]?.id ?? null,
      insertOptions,
      showTournamentFields: isTournament,
      tournamentLeaderboardTypeOptions: this.tournamentLeaderboardTypeOptions,
      tournamentLeaderboardTypeValue: leaderboardType,
      tournamentLeaderboardTypeClass: `tournament-leaderboard-${leaderboardType.toLowerCase()}`,
      tournamentLeaderboardTypeIcon: leaderboardType === 'Fifa' ? 'sports_soccer' : 'leaderboard',
      tournamentEstimatedGroupCountLabel: this.tournamentEstimatedGroupCountLabel(model)
    };
  }

  protected saveDefinitionForm(event?: Event): void {
    event?.stopPropagation();
    const state = this.definitionForm;
    if (!state || !this.canConfigureDefinitions() || !this.canSaveDefinitionForm(state.model)) {
      return;
    }

    const definition = this.definitionFromFormState(state);
    const next = [...this.definitions];
    if (state.index === null) {
      next.splice(this.definitionInsertIndex(state), 0, definition);
    } else {
      next[state.index] = definition;
    }
    this.setDefinitionForm(null);
    this.commit(next);
  }

  protected cancelDefinitionForm(event?: Event): void {
    event?.stopPropagation();
    this.setDefinitionForm(null);
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected selectDefinitionOptional(optional: boolean): void {
    this.patchDefinitionFormModel({ optional });
  }

  protected selectDefinitionInsertPlacement(placement: EventSubeventStageInsertPlacement): void {
    if (!this.definitionForm) {
      return;
    }
    if (this.mode === 'Tournament' && placement === 'during') {
      return;
    }
    this.setDefinitionForm({
      ...this.definitionForm,
      insertPlacement: placement
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected onDefinitionInsertTargetChange(targetId: string | null): void {
    if (!this.definitionForm) {
      return;
    }
    this.setDefinitionForm({
      ...this.definitionForm,
      insertTargetId: targetId
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected onDefinitionCapacityMinChange(value: number | string): void {
    this.patchDefinitionFormModel({ capacityMin: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionCapacityMaxChange(value: number | string): void {
    this.patchDefinitionFormModel({ capacityMax: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionTournamentGroupCapacityMinChange(value: number | string): void {
    this.patchDefinitionFormModel({ tournamentGroupCapacityMin: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionTournamentGroupCapacityMaxChange(value: number | string): void {
    this.patchDefinitionFormModel({ tournamentGroupCapacityMax: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionTournamentLeaderboardTypeChange(value: EventSubeventTournamentLeaderboardType | string | null | undefined): void {
    this.patchDefinitionFormModel({ tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(value) });
  }

  protected onDefinitionTournamentAdvancePerGroupChange(value: number | string): void {
    this.patchDefinitionFormModel({ tournamentAdvancePerGroup: this.toNonNegativeInteger(value) });
  }

  private openEditDefinitionForm(index: number): void {
    const item = this.definitions[index];
    if (!item) {
      return;
    }
    this.setDefinitionForm({
      index,
      id: item.id,
      icon: item.icon ?? null,
      model: this.createDefinitionFormModel(item, index + 1),
      insertPlacement: this.insertPlacementFromDefinitionTiming(item.timing),
      insertTargetId: item.id
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  private requestDeleteDefinition(index: number): void {
    const item = this.definitions[index];
    if (!item) {
      return;
    }
    const label = this.definitionSequenceLabel(index);
    this.dialogStore.open({
      title: this.mode === 'Tournament' ? 'Delete Stage Definition' : 'Delete Sub Event Definition',
      message: `Delete ${label} - ${item.name}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Unable to delete sub event definition.',
      onConfirm: () => {
        if (this.definitionForm?.index === index) {
          this.setDefinitionForm(null);
        }
        this.commit(this.definitions.filter((_, itemIndex) => itemIndex !== index));
      }
    });
  }

  private createDefinitionFormModel(item: SubEventDefinitionDTO | null, _fallbackIndex: number): EventSubeventStageFormModel {
    const groupCapacityMin = this.optionalNonNegativeInteger(item?.tournamentGroupCapacityMin) ?? 0;
    const groupCapacityMax = Math.max(groupCapacityMin, this.optionalNonNegativeInteger(item?.tournamentGroupCapacityMax) ?? groupCapacityMin);
    const optional = this.mode === 'Tournament' ? false : item?.optional ?? true;
    return {
      name: item?.name?.trim() ?? '',
      description: item?.description?.trim() ?? '',
      location: item?.location?.trim() ?? '',
      offsetMinutes: this.toNonNegativeInteger(item?.offsetMinutes ?? 0),
      durationMinutes: this.toPositiveInteger(item?.durationMinutes ?? 60),
      optional,
      pricing: item?.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : PricingBuilder.createDefaultPricingConfig('subevent'),
      capacityMin: this.toNonNegativeInteger(item?.capacityMin ?? 0),
      capacityMax: this.toNonNegativeInteger(item?.capacityMax ?? 0),
      tournamentGroupCapacityMin: groupCapacityMin,
      tournamentGroupCapacityMax: groupCapacityMax,
      tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(item?.tournamentLeaderboardType),
      tournamentAdvancePerGroup: this.optionalNonNegativeInteger(item?.tournamentAdvancePerGroup) ?? 0
    };
  }

  private definitionFromFormState(state: SubEventDefinitionFormState): SubEventDefinitionDTO {
    const model = state.model;
    const capacityMin = this.toNonNegativeInteger(model.capacityMin);
    const capacityMax = Math.max(capacityMin, this.toNonNegativeInteger(model.capacityMax));
    const groupCapacityMin = this.optionalNonNegativeInteger(model.tournamentGroupCapacityMin);
    const groupCapacityMax = this.optionalNonNegativeInteger(model.tournamentGroupCapacityMax);
    return ActivityEventDetailDTO.normalizeSubEventDefinitions([{
      id: state.id,
      name: model.name,
      description: model.description,
      timing: this.definitionTimingFromInsertPlacement(state.insertPlacement),
      offsetMinutes: this.toNonNegativeInteger(model.offsetMinutes ?? 0),
      durationMinutes: this.toPositiveInteger(model.durationMinutes),
      location: `${model.location ?? ''}`.trim(),
      tournamentGroupCapacityMin: groupCapacityMin,
      tournamentGroupCapacityMax: Math.max(groupCapacityMin ?? 0, groupCapacityMax ?? groupCapacityMin ?? 0),
      tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(model.tournamentLeaderboardType),
      tournamentAdvancePerGroup: this.optionalNonNegativeInteger(model.tournamentAdvancePerGroup),
      optional: this.mode === 'Tournament' ? false : model.optional === true,
      pricing: model.pricing ? PricingBuilder.clonePricingConfig(model.pricing) : null,
      capacityMin,
      capacityMax,
      icon: state.icon
    }])[0];
  }

  private patchDefinitionFormModel(update: Partial<EventSubeventStageFormModel>): void {
    if (!this.definitionForm) {
      return;
    }
    this.setDefinitionForm({
      ...this.definitionForm,
      model: {
        ...this.definitionForm.model,
        ...update
      }
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  private setDefinitionForm(state: SubEventDefinitionFormState | null): void {
    this.definitionForm = state;
    this.definitionFormModelValue = state?.model ?? this.createDefinitionFormModel(null, this.definitions.length + 1);
    this.definitionFormView = this.createDefinitionFormPopupView(state, this.definitionFormModelValue);
  }

  private definitionFormTitle(state: SubEventDefinitionFormState | null): string {
    const verb = !state || state.index === null ? 'Create' : 'Edit';
    return this.mode === 'Tournament'
      ? `${verb} Stage`
      : `${verb} Sub Event`;
  }

  private definitionSequenceLabel(index: number): string {
    return this.mode === 'Tournament'
      ? `Stage ${index + 1}`
      : `Sub Event ${index + 1}`;
  }

  private definitionTimingFromInsertPlacement(placement: EventSubeventStageInsertPlacement): SubEventDefinitionDTO['timing'] {
    if (placement === 'before') {
      return 'Before';
    }
    if (placement === 'during') {
      return this.mode === 'Tournament' ? 'After' : 'During';
    }
    return 'After';
  }

  private insertPlacementFromDefinitionTiming(value: SubEventDefinitionDTO['timing'] | null | undefined): EventSubeventStageInsertPlacement {
    if (value === 'Before') {
      return 'before';
    }
    if (value === 'During') {
      return this.mode === 'Tournament' ? 'after' : 'during';
    }
    return 'after';
  }

  private definitionInsertOptions(): ReadonlyArray<{ id: string; label: string }> {
    return this.definitions.map((item, index) => ({
      id: item.id,
      label: this.definitionInsertOptionLabel(item, index)
    }));
  }

  private definitionInsertOptionLabel(item: SubEventDefinitionDTO, index: number): string {
    const name = `${item.name ?? ''}`.trim();
    const staleSubEventFallback = this.mode === 'Tournament' && /^Sub Event\s+\d+$/i.test(name);
    return name && !staleSubEventFallback ? name : this.definitionSequenceLabel(index);
  }

  private definitionInsertIndex(state: SubEventDefinitionFormState): number {
    const targetIndex = this.definitions.findIndex(item => item.id === state.insertTargetId);
    if (targetIndex < 0) {
      return this.definitions.length;
    }
    return state.insertPlacement === 'before' ? targetIndex : targetIndex + 1;
  }

  private canSaveDefinitionForm(model: EventSubeventStageFormModel): boolean {
    return this.hasText(model.name)
      && this.hasText(model.description)
      && this.toPositiveInteger(model.durationMinutes) > 0;
  }

  private tournamentEstimatedGroupCountLabel(model: EventSubeventStageFormModel): string {
    const groupMin = Math.max(1, this.toNonNegativeInteger(model.tournamentGroupCapacityMin ?? 0) || 1);
    const groupMax = Math.max(groupMin, this.toNonNegativeInteger(model.tournamentGroupCapacityMax ?? groupMin));
    const stageMin = this.toNonNegativeInteger(model.capacityMin);
    const stageMax = Math.max(stageMin, this.toNonNegativeInteger(model.capacityMax));
    const estimateMin = Math.max(1, Math.ceil(stageMin / groupMax));
    const estimateMax = Math.max(estimateMin, Math.ceil(stageMax / groupMin));
    return `${estimateMin} - ${estimateMax}`;
  }

  private normalizedTournamentLeaderboardType(value: EventSubeventTournamentLeaderboardType | string | null | undefined): EventSubeventTournamentLeaderboardType {
    return `${value ?? ''}`.trim() === 'Fifa' ? 'Fifa' : 'Score';
  }

  private definitionTimingBounds(): DateRangeDto | null {
    const start = this.parseDate(this.boundsValue?.startAt);
    const end = this.parseDate(this.boundsValue?.endAt);
    if (!start || !end || end.getTime() <= start.getTime()) {
      return null;
    }
    return {
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      precision: 'minute'
    };
  }

  private refreshDefinitionFormView(): void {
    this.definitionFormView = this.createDefinitionFormPopupView(this.definitionForm, this.definitionFormModelValue);
    this.cdr.markForCheck();
  }

  private optionalNonNegativeInteger(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
  }

  private parseDate(value: unknown): Date | null {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw.replace(/\//g, '-'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private hasText(value: unknown): boolean {
    return `${value ?? ''}`.trim().length > 0;
  }

  private commit(items: readonly SubEventDefinitionDTO[]): void {
    this.definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(items);
    this.bumpList();
    this.onTouched();
    this.onChange(this.definitions.map(item => ({ ...item })));
    this.cdr.markForCheck();
  }

  private bumpList(): void {
    this.revision += 1;
    this.smartListQuery = {
      view: this.definitionView,
      filters: { revision: this.revision }
    };
  }

  private toNonNegativeInteger(value: number | string): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private toPositiveInteger(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(1, parsed) : 60;
  }

  protected durationLabel(totalMinutes: number): string {
    const safeMinutes = this.toPositiveInteger(totalMinutes);
    return this.minutesLabel(safeMinutes);
  }

  protected durationMinutesBadgeLabel(totalMinutes: number): string {
    return `${this.toPositiveInteger(totalMinutes)}m`;
  }

  private offsetLabel(totalMinutes: number): string {
    const safeMinutes = this.toNonNegativeInteger(totalMinutes);
    return this.minutesLabel(safeMinutes);
  }

  private definitionIndex(item: SubEventDefinitionDTO): number {
    return Math.max(0, this.definitions.findIndex(candidate => candidate.id === item.id));
  }

  private definitionStartLabel(item: SubEventDefinitionDTO, index: number): string {
    const offsetMinutes = this.toNonNegativeInteger(item.offsetMinutes);
    const offsetLabel = this.offsetLabel(offsetMinutes);
    if (index <= 0) {
      return offsetMinutes > 0
        ? `Starts ${offsetLabel} after event start`
        : 'Starts at event start';
    }

    const previousLabel = this.definitionSequenceLabel(index - 1);
    if (item.timing === 'During') {
      return offsetMinutes > 0
        ? `Starts ${offsetLabel} after ${previousLabel} starts`
        : `Starts with ${previousLabel}`;
    }

    return offsetMinutes > 0
      ? `Starts ${offsetLabel} after ${previousLabel}`
      : `Starts after ${previousLabel}`;
  }

  private minutesLabel(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) {
      return `${minutes}m`;
    }
    if (minutes <= 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  private definitionTimelineRange(item: SubEventDefinitionDTO): { startOffsetMinutes: number; endOffsetMinutes: number } | null {
    const entry = this.definitionTimelineEntries().find(candidate => candidate.item === item);
    if (!entry) {
      return null;
    }
    return {
      startOffsetMinutes: entry.startOffsetMinutes,
      endOffsetMinutes: entry.startOffsetMinutes + entry.durationMinutes
    };
  }

  private definitionTimelineVisibleDurationMinutes(): number {
    const minimumDuration = this.definitionTimelineStepMinutes * this.definitionTimelineVisibleStepCount;
    const furthestEndOffset = this.definitionTimelineEntries().reduce(
      (furthest, entry) => Math.max(furthest, entry.startOffsetMinutes + entry.durationMinutes),
      0
    );
    const renderedDuration = Math.ceil(furthestEndOffset / this.definitionTimelineStepMinutes)
      * this.definitionTimelineStepMinutes;
    return Math.max(minimumDuration, renderedDuration);
  }

  private definitionTimelineEntries(): Array<{ item: SubEventDefinitionDTO; startOffsetMinutes: number; durationMinutes: number }> {
    let previousStartOffsetMinutes = 0;
    let previousEndOffsetMinutes = 0;
    return this.definitions.map((item, index) => {
      const durationMinutes = this.toPositiveInteger(item.durationMinutes);
      const offsetMinutes = this.toNonNegativeInteger(item.offsetMinutes);
      const startOffsetMinutes = index <= 0
        ? offsetMinutes
        : item.timing === 'During'
          ? previousStartOffsetMinutes + offsetMinutes
          : previousEndOffsetMinutes + offsetMinutes;
      previousStartOffsetMinutes = startOffsetMinutes;
      previousEndOffsetMinutes = startOffsetMinutes + durationMinutes;
      return { item, startOffsetMinutes, durationMinutes };
    });
  }
}

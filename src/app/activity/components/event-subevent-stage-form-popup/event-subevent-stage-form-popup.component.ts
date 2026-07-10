import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AppUtils } from '../../../shared/app-utils';
import { PricingBuilder } from '../../../shared/core/base/builders';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  AppMenuComponent,
  DateInputComponent,
  type DateInputModel,
  LocationInputComponent,
  type LocationInputConfig,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  PricingEditorInputComponent,
  type PricingEditorConfig
} from '../../../shared/ui';

export type EventSubeventStageFormModeClass = 'subevent-mode-mandatory' | 'subevent-mode-optional';
export type EventSubeventStageInsertPlacement = 'before' | 'during' | 'after';
export type EventSubeventTournamentLeaderboardType = 'Score' | 'Fifa';
export type EventSubeventStageTimingInputMode = 'range' | 'duration';

export interface EventSubeventStageInsertOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  palette: AppMenuPalette;
}

type EventSubeventStageFormMenuContext =
  | { menu: 'optional'; optional: boolean }
  | { menu: 'insert-placement'; placement: EventSubeventStageInsertPlacement }
  | { menu: 'insert-target'; targetId: string | null }
  | { menu: 'leaderboard-type'; leaderboardType: EventSubeventTournamentLeaderboardType }
  | { menu: 'save' };

export interface EventSubeventStageFormPopupView {
  open: boolean;
  parentTitle: string;
  title: string;
  readOnly: boolean;
  canSave: boolean;
  invalidName: boolean;
  invalidDescription: boolean;
  showOptionalToggle: boolean;
  modeClass: EventSubeventStageFormModeClass;
  modeIcon: string;
  slotBoundTiming: boolean;
  timingSummaryTitle: string;
  timingSummaryText: string;
  timingSummaryMeta: string;
  timingInputMode?: EventSubeventStageTimingInputMode;
  dateInput?: DateInputModel;
  showInsertControls: boolean;
  showDuringInsertPlacement: boolean;
  insertPlacement: EventSubeventStageInsertPlacement;
  insertTargetId: string | null;
  insertOptions: ReadonlyArray<EventSubeventStageInsertOption>;
  showTournamentFields: boolean;
  tournamentLeaderboardTypeOptions: readonly EventSubeventTournamentLeaderboardType[];
  tournamentLeaderboardTypeValue: EventSubeventTournamentLeaderboardType;
  tournamentLeaderboardTypeClass: string;
  tournamentLeaderboardTypeIcon: string;
  tournamentEstimatedGroupCountLabel: string;
}

export interface EventSubeventStageFormModel {
  name: string;
  description: string;
  location: string;
  dateRange?: ContractTypes.DateRangeDto;
  offsetMinutes?: number;
  durationMinutes?: number;
  optional: boolean;
  pricing?: ContractTypes.PricingConfig | null;
  capacityMin: number;
  capacityMax: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: EventSubeventTournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
}

export interface EventSubeventStageFormSubmit {
  sourceEvent: Event;
  model: EventSubeventStageFormModel;
  insertPlacement: EventSubeventStageInsertPlacement;
  insertTargetId: string | null;
}

@Component({
  selector: 'app-event-subevent-stage-form-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    AppMenuComponent,
    PopupComponent,
    DateInputComponent,
    LocationInputComponent,
    PricingEditorInputComponent
  ],
  templateUrl: './event-subevent-stage-form-popup.component.html',
  styleUrls: ['./event-subevent-stage-form-popup.component.scss']
})
export class EventSubeventStageFormPopupComponent implements OnChanges {
  @Input() view: EventSubeventStageFormPopupView = this.defaultView();
  @Input() model: EventSubeventStageFormModel = {
    name: '',
    description: '',
    location: '',
    dateRange: { startAt: '', endAt: '', precision: 'minute' },
    offsetMinutes: 0,
    durationMinutes: 60,
    optional: false,
    pricing: null,
    capacityMin: 0,
    capacityMax: 0
  };

  @Output() readonly save = new EventEmitter<EventSubeventStageFormSubmit>();
  @Output() readonly cancel = new EventEmitter<Event>();

  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('descriptionInput') private descriptionInput?: ElementRef<HTMLTextAreaElement>;

  protected draftModel: EventSubeventStageFormModel = this.cloneModel(this.model);
  protected draftInsertPlacement: EventSubeventStageInsertPlacement = 'after';
  protected draftInsertTargetId: string | null = null;
  private lastModelInput: EventSubeventStageFormModel | null = null;
  private lastOpen = false;

  protected readonly subeventPricingEditorConfig: PricingEditorConfig = {
    context: 'subevent',
    presentation: 'popup-summary',
    allowSlotFeatures: false,
    showAudienceSection: false
  };
  protected readonly subeventLocationInputConfig: LocationInputConfig = {
    label: 'Location',
    placeholder: 'Sub event location',
    mapMode: 'search',
    mapAriaLabel: 'Open sub event location on map'
  };
  ngOnChanges(): void {
    this.syncDraftFromInputs();
    if (this.usesDurationInput()) {
      this.normalizeDuration(this.draftModel);
      return;
    }
    this.normalizeDateRange(this.draftModel);
  }

  protected stagePopupModel(): PopupModel<EventSubeventStageFormMenuContext> {
    return {
      title: this.view.title,
      subtitle: this.view.parentTitle || null,
      ariaLabel: this.view.title,
      closeAriaLabel: 'Close sub event form',
      closeOnBackdrop: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerControls: this.stagePopupHeaderControls(),
      onClose: event => this.cancel.emit(event),
      onMenuSelect: event => this.onStagePopupMenuSelect(event)
    };
  }

  private stagePopupHeaderControls(): readonly PopupControl<EventSubeventStageFormMenuContext>[] {
    const controls: PopupControl<EventSubeventStageFormMenuContext>[] = [{
      kind: 'menu',
      id: 'subevent-mode',
      menuKind: 'select',
      trigger: this.stageModeTrigger(),
      items: this.view.showOptionalToggle ? this.optionalMenuItems() : [],
      panelAlign: 'end'
    }];
    if (!this.view.readOnly) {
      controls.push({
        kind: 'menu',
        id: 'subevent-save',
        menuKind: 'inline',
        items: this.stageSaveMenuItems(),
        closeOnSelect: false
      });
    }
    return controls;
  }

  private stageModeTrigger(): AppMenuTrigger {
    if (this.view.showOptionalToggle) {
      return this.optionalMenuTrigger();
    }
    return {
      label: 'Mandatory',
      icon: 'lock',
      palette: 'red',
      ariaLabel: 'Mandatory sub event',
      layout: 'pill',
      trailingIcon: '',
      disabled: true
    };
  }

  private stageSaveMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    const canSave = this.canSaveCurrentModel();
    return [{
      id: 'subevent-save',
      icon: 'done',
      kind: 'action',
      palette: canSave ? 'green' : 'danger',
      disabled: false,
      ariaLabel: 'Save sub event',
      context: { menu: 'save' }
    }];
  }

  private onStagePopupMenuSelect(event: PopupMenuSelectEvent<EventSubeventStageFormMenuContext>): void {
    if (event.itemSelect.context?.menu === 'save') {
      this.syncTextDraftFromElements();
      if (!this.canSaveCurrentModel()) {
        return;
      }
      this.save.emit({
        sourceEvent: event.itemSelect.sourceEvent,
        model: this.normalizedDraftModel(),
        insertPlacement: this.draftInsertPlacement,
        insertTargetId: this.draftInsertTargetId
      });
      return;
    }
    this.onStageFormMenuSelect(event.itemSelect);
  }

  protected trackByInsertOption(_: number, option: { id: string }): string {
    return option.id;
  }

  protected canSaveCurrentModel(): boolean {
    return !this.view.readOnly
      && this.hasText(this.draftModel.name)
      && this.hasText(this.draftModel.description)
      && (this.usesDurationInput()
        ? this.positiveInteger(this.draftModel.durationMinutes) > 0
        : this.hasText(this.draftModel.dateRange?.startAt) && this.hasText(this.draftModel.dateRange?.endAt));
  }

  protected fieldInvalid(field: 'name' | 'description'): boolean {
    return !this.hasText(this.draftModel[field]);
  }

  protected optionalMenuTrigger(): AppMenuTrigger {
    return {
      label: this.draftModel.optional ? 'Optional' : 'Mandatory',
      icon: this.draftModeIcon(),
      palette: this.draftModel.optional ? 'blue' : 'red',
      ariaLabel: 'Sub event optional mode',
      layout: 'pill'
    };
  }

  protected optionalMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    return [
      {
        id: 'subevent-optional-mandatory',
        label: 'Mandatory',
        icon: 'lock',
        kind: 'radio',
        palette: 'red',
        surface: 'tinted',
        active: !this.draftModel.optional,
        context: { menu: 'optional', optional: false }
      },
      {
        id: 'subevent-optional-optional',
        label: 'Optional',
        icon: 'toggle_on',
        kind: 'radio',
        palette: 'blue',
        surface: 'tinted',
        active: this.draftModel.optional,
        context: { menu: 'optional', optional: true }
      }
    ];
  }

  protected insertPlacementMenuTrigger(): AppMenuTrigger {
    const placement = this.draftInsertPlacement;
    return {
      label: this.insertPlacementLabel(placement),
      icon: this.insertPlacementIcon(placement),
      palette: this.insertPlacementPalette(placement),
      ariaLabel: 'Position',
      layout: 'field'
    };
  }

  protected insertPlacementMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    return this.insertPlacementOptions().map(placement => ({
      id: `subevent-insert-placement-${placement}`,
      label: this.insertPlacementLabel(placement),
      icon: this.insertPlacementIcon(placement),
      kind: 'radio',
      palette: this.insertPlacementPalette(placement),
      surface: 'tinted',
      active: placement === this.draftInsertPlacement,
      context: { menu: 'insert-placement', placement }
    }));
  }

  protected insertTargetMenuTrigger(): AppMenuTrigger {
    const selected = this.insertTargetOption();
    return {
      label: this.insertTargetLabel(),
      icon: selected?.icon ?? 'route',
      palette: selected?.palette ?? 'blue',
      ariaLabel: 'Event Anchor',
      layout: 'field'
    };
  }

  protected insertTargetMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    return this.view.insertOptions.map(option => ({
      id: `subevent-insert-target-${option.id}`,
      label: option.label,
      description: option.description,
      icon: option.icon,
      kind: 'radio',
      palette: option.palette,
      surface: 'tinted',
      active: option.id === this.draftInsertTargetId,
      context: { menu: 'insert-target', targetId: option.id }
    }));
  }

  protected tournamentLeaderboardMenuTrigger(): AppMenuTrigger {
    const value = this.draftTournamentLeaderboardType();
    return {
      label: value,
      icon: this.tournamentLeaderboardIcon(value),
      palette: this.tournamentLeaderboardPalette(value),
      ariaLabel: 'Leaderboard type',
      layout: 'field'
    };
  }

  protected tournamentLeaderboardMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    return this.view.tournamentLeaderboardTypeOptions.map(option => ({
      id: `subevent-leaderboard-type-${option.toLowerCase()}`,
      label: option,
      icon: this.tournamentLeaderboardIcon(option),
      kind: 'radio',
      palette: this.tournamentLeaderboardPalette(option),
      surface: 'tinted',
      active: option === this.draftTournamentLeaderboardType(),
      context: { menu: 'leaderboard-type', leaderboardType: option }
    }));
  }

  protected onStageFormMenuSelect(event: AppMenuItemSelectEvent<string, EventSubeventStageFormMenuContext>): void {
    const context = event.context;
    if (!context) {
      return;
    }

    switch (context.menu) {
      case 'optional':
        this.draftModel.optional = this.view.showTournamentFields ? false : context.optional;
        break;
      case 'insert-placement':
        if (this.view.showTournamentFields && context.placement === 'during') {
          return;
        }
        this.draftInsertPlacement = context.placement;
        break;
      case 'insert-target':
        this.draftInsertTargetId = context.targetId;
        break;
      case 'leaderboard-type':
        this.draftModel.tournamentLeaderboardType = context.leaderboardType;
        break;
    }
  }

  private insertPlacementOptions(): readonly EventSubeventStageInsertPlacement[] {
    return this.view.showDuringInsertPlacement
      ? ['before', 'during', 'after']
      : ['before', 'after'];
  }

  private insertPlacementLabel(placement: EventSubeventStageInsertPlacement): string {
    if (placement === 'before') {
      return 'Before';
    }
    if (placement === 'during') {
      return 'During';
    }
    return 'After';
  }

  private insertPlacementIcon(placement: EventSubeventStageInsertPlacement): string {
    if (placement === 'before') {
      return 'keyboard_double_arrow_up';
    }
    if (placement === 'during') {
      return 'merge_type';
    }
    return 'keyboard_double_arrow_down';
  }

  private insertPlacementPalette(placement: EventSubeventStageInsertPlacement): AppMenuPalette {
    if (placement === 'before') {
      return 'orange';
    }
    if (placement === 'during') {
      return 'blue';
    }
    return 'green';
  }

  private insertTargetLabel(): string {
    const selected = this.insertTargetOption();
    return selected?.label ?? this.view.insertOptions[0]?.label ?? 'Select stage';
  }

  private insertTargetOption(): EventSubeventStageInsertOption | null {
    return this.view.insertOptions.find(option => option.id === this.draftInsertTargetId) ?? null;
  }

  private tournamentLeaderboardIcon(option: EventSubeventTournamentLeaderboardType): string {
    return option === 'Fifa' ? 'sports_soccer' : 'leaderboard';
  }

  private tournamentLeaderboardPalette(option: EventSubeventTournamentLeaderboardType): AppMenuPalette {
    return option === 'Fifa' ? 'orange' : 'blue';
  }

  protected usesDurationInput(): boolean {
    return this.view.timingInputMode === 'duration';
  }

  protected syncDraftTextInput(field: 'name' | 'description', event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    this.draftModel[field] = target?.value ?? '';
  }

  protected draftModeClass(): EventSubeventStageFormModeClass {
    return this.draftModel.optional && !this.view.showTournamentFields
      ? 'subevent-mode-optional'
      : 'subevent-mode-mandatory';
  }

  protected draftModeIcon(): string {
    return this.draftModel.optional && !this.view.showTournamentFields ? 'toggle_on' : 'lock';
  }

  protected positionPanelClass(): string {
    if (this.view.showTournamentFields) {
      return 'subevent-position-panel--tournament';
    }
    return this.draftModel.optional
      ? 'subevent-position-panel--optional'
      : 'subevent-position-panel--mandatory';
  }

  protected draftTournamentEstimatedGroupCountLabel(): string {
    const groupMin = Math.max(1, this.positiveInteger(this.draftModel.tournamentGroupCapacityMin ?? 0) || 1);
    const groupMax = Math.max(groupMin, this.positiveInteger(this.draftModel.tournamentGroupCapacityMax ?? groupMin));
    const stageMin = this.positiveInteger(this.draftModel.capacityMin);
    const stageMax = Math.max(stageMin, this.positiveInteger(this.draftModel.capacityMax));
    const estimateMin = Math.max(1, Math.ceil(stageMin / groupMax));
    const estimateMax = Math.max(estimateMin, Math.ceil(stageMax / groupMin));
    return `${estimateMin} - ${estimateMax}`;
  }

  private draftTournamentLeaderboardType(): EventSubeventTournamentLeaderboardType {
    return this.draftModel.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score';
  }

  private normalizeDuration(target: EventSubeventStageFormModel): void {
    target.offsetMinutes = this.positiveInteger(target.offsetMinutes);
    target.durationMinutes = this.positiveInteger(target.durationMinutes) || 60;
  }

  private positiveInteger(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private normalizeDateRange(target: EventSubeventStageFormModel): void {
    const boundStart = this.parseDateTime(this.view.dateInput?.range?.bounds?.start);
    const boundEnd = this.parseDateTime(this.view.dateInput?.range?.bounds?.end);
    const defaultStart = boundStart ?? new Date();
    const defaultDurationMs = boundStart && boundEnd && boundEnd.getTime() > boundStart.getTime()
      ? Math.max(15 * 60 * 1000, Math.min(60 * 60 * 1000, boundEnd.getTime() - boundStart.getTime()))
      : (60 * 60 * 1000);

    const currentRange = target.dateRange ?? { startAt: '', endAt: '', precision: 'minute' as const };
    let start = this.parseDateTime(currentRange.startAt) ?? new Date(defaultStart.getTime());
    let safeEnd = this.parseDateTime(currentRange.endAt);
    if (!safeEnd || safeEnd.getTime() <= start.getTime()) {
      safeEnd = new Date(start.getTime() + defaultDurationMs);
    }

    if (this.view.slotBoundTiming && boundStart && boundEnd && boundEnd.getTime() > boundStart.getTime()) {
      const minMs = boundStart.getTime();
      const maxMs = boundEnd.getTime();
      const minSpanMs = Math.max(60 * 1000, Math.min(defaultDurationMs, maxMs - minMs));

      let startMs = Math.max(minMs, start.getTime());
      let endMs = Math.min(maxMs, safeEnd.getTime());

      if (startMs >= maxMs) {
        startMs = Math.max(minMs, maxMs - minSpanMs);
      }
      if (endMs <= startMs) {
        endMs = Math.min(maxMs, startMs + minSpanMs);
      }
      if (endMs <= startMs) {
        startMs = minMs;
        endMs = maxMs;
      }

      start = new Date(startMs);
      safeEnd = new Date(endMs);
    }

    target.dateRange = {
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(safeEnd),
      precision: 'minute'
    };
  }

  private syncDraftFromInputs(): void {
    const opening = this.view.open && !this.lastOpen;
    if (opening || this.lastModelInput !== this.model) {
      this.draftModel = this.cloneModel(this.model);
      this.draftInsertPlacement = this.view.showTournamentFields && this.view.insertPlacement === 'during'
        ? 'after'
        : this.view.insertPlacement;
      this.draftInsertTargetId = this.view.insertTargetId ?? this.view.insertOptions[this.view.insertOptions.length - 1]?.id ?? null;
      this.lastModelInput = this.model;
    }
    if (this.view.showTournamentFields) {
      this.draftModel.optional = false;
      if (this.draftInsertPlacement === 'during') {
        this.draftInsertPlacement = 'after';
      }
    }
    this.lastOpen = this.view.open;
  }

  private normalizedDraftModel(): EventSubeventStageFormModel {
    this.syncTextDraftFromElements();
    const next = this.cloneModel(this.draftModel);
    next.name = `${next.name ?? ''}`.trim();
    next.description = `${next.description ?? ''}`.trim();
    next.location = `${next.location ?? ''}`.trim();
    next.optional = this.view.showTournamentFields ? false : next.optional === true;
    next.capacityMin = this.positiveInteger(next.capacityMin);
    next.capacityMax = this.positiveInteger(next.capacityMax);
    next.tournamentGroupCapacityMin = this.positiveInteger(next.tournamentGroupCapacityMin ?? 0);
    next.tournamentGroupCapacityMax = Math.max(
      next.tournamentGroupCapacityMin,
      this.positiveInteger(next.tournamentGroupCapacityMax ?? next.tournamentGroupCapacityMin)
    );
    next.tournamentLeaderboardType = this.draftTournamentLeaderboardType();
    next.tournamentAdvancePerGroup = this.positiveInteger(next.tournamentAdvancePerGroup ?? 0);
    if (this.usesDurationInput()) {
      this.normalizeDuration(next);
    } else {
      this.normalizeDateRange(next);
    }
    return next;
  }

  private cloneModel(value: EventSubeventStageFormModel): EventSubeventStageFormModel {
    return {
      ...value,
      dateRange: value.dateRange ? { ...value.dateRange } : undefined,
      pricing: value.pricing ? PricingBuilder.clonePricingConfig(value.pricing) : null
    };
  }

  private syncTextDraftFromElements(): void {
    this.draftModel.name = this.nameInput?.nativeElement.value ?? this.draftModel.name;
    this.draftModel.description = this.descriptionInput?.nativeElement.value ?? this.draftModel.description;
  }

  private defaultView(): EventSubeventStageFormPopupView {
    return {
      open: false,
      parentTitle: '',
      title: 'Create Stage Event',
      readOnly: false,
      canSave: false,
      invalidName: false,
      invalidDescription: false,
      showOptionalToggle: false,
      modeClass: 'subevent-mode-mandatory',
      modeIcon: 'lock',
      slotBoundTiming: false,
      timingSummaryTitle: '',
      timingSummaryText: '',
      timingSummaryMeta: '',
      timingInputMode: 'range',
      dateInput: {
        mode: 'range',
        precision: 'minute',
        range: {
          start: { label: 'Start' },
          end: { label: 'End' },
          bounds: null
        }
      },
      showInsertControls: false,
      showDuringInsertPlacement: false,
      insertPlacement: 'after',
      insertTargetId: null,
      insertOptions: [],
      showTournamentFields: false,
      tournamentLeaderboardTypeOptions: ['Score', 'Fifa'],
      tournamentLeaderboardTypeValue: 'Score',
      tournamentLeaderboardTypeClass: 'tournament-leaderboard-score',
      tournamentLeaderboardTypeIcon: 'leaderboard',
      tournamentEstimatedGroupCountLabel: '0 - 0'
    };
  }

  private parseDateTime(value: unknown): Date | null {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }

    const legacyPattern = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})$/);
    if (legacyPattern) {
      const day = Number.parseInt(legacyPattern[1] ?? '', 10);
      const month = Number.parseInt(legacyPattern[2] ?? '', 10);
      const year = Number.parseInt(legacyPattern[3] ?? '', 10);
      const hours = Number.parseInt(legacyPattern[4] ?? '', 10);
      const minutes = Number.parseInt(legacyPattern[5] ?? '', 10);
      if ([day, month, year, hours, minutes].every(Number.isFinite)) {
        return new Date(year, month - 1, day, hours, minutes, 0, 0);
      }
    }

    const isoLikePattern = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2}),?\s+(\d{1,2}):(\d{2})$/);
    if (isoLikePattern) {
      const year = Number.parseInt(isoLikePattern[1] ?? '', 10);
      const month = Number.parseInt(isoLikePattern[2] ?? '', 10);
      const day = Number.parseInt(isoLikePattern[3] ?? '', 10);
      const hours = Number.parseInt(isoLikePattern[4] ?? '', 10);
      const minutes = Number.parseInt(isoLikePattern[5] ?? '', 10);
      if ([day, month, year, hours, minutes].every(Number.isFinite)) {
        return new Date(year, month - 1, day, hours, minutes, 0, 0);
      }
    }

    const normalized = raw.replace(/\//g, '-');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private hasText(value: unknown): boolean {
    return `${value ?? ''}`.trim().length > 0;
  }
}

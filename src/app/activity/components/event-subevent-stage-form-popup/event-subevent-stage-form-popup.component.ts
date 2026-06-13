import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { AppUtils } from '../../../shared/app-utils';
import type * as AppTypes from '../../../shared/core/base/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  PricingEditorComponent
} from '../../../shared/ui';

export type EventSubeventStageFormModeClass = 'subevent-mode-mandatory' | 'subevent-mode-optional';
export type EventSubeventStageInsertPlacement = 'before' | 'after';
export type EventSubeventTournamentLeaderboardType = 'Score' | 'Fifa';

type EventSubeventStageFormMenuContext =
  | { menu: 'optional'; optional: boolean }
  | { menu: 'insert-target'; targetId: string | null }
  | { menu: 'leaderboard-type'; leaderboardType: EventSubeventTournamentLeaderboardType };

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
  startFieldLabel: string;
  endFieldLabel: string;
  timingBoundStartAt: string;
  timingBoundEndAt: string;
  showInsertControls: boolean;
  insertFieldLabel: string;
  insertPlacement: EventSubeventStageInsertPlacement;
  insertTargetId: string | null;
  insertOptions: ReadonlyArray<{ id: string; label: string }>;
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
  startAt: string;
  endAt: string;
  optional: boolean;
  pricing?: ContractTypes.PricingConfig | null;
  capacityMin: number;
  capacityMax: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: EventSubeventTournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
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
    MatDatepickerModule,
    MatTimepickerModule,
    MatNativeDateModule,
    AppMenuComponent,
    PricingEditorComponent
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
    startAt: '',
    endAt: '',
    optional: false,
    pricing: null,
    capacityMin: 0,
    capacityMax: 0
  };

  @Output() readonly save = new EventEmitter<Event>();
  @Output() readonly cancel = new EventEmitter<Event>();
  @Output() readonly selectOptional = new EventEmitter<boolean>();
  @Output() readonly selectInsertPlacement = new EventEmitter<EventSubeventStageInsertPlacement>();
  @Output() readonly insertTargetChange = new EventEmitter<string | null>();
  @Output() readonly openLocationMap = new EventEmitter<Event>();
  @Output() readonly capacityMinChange = new EventEmitter<number | string>();
  @Output() readonly capacityMaxChange = new EventEmitter<number | string>();
  @Output() readonly tournamentGroupCapacityMinChange = new EventEmitter<number | string>();
  @Output() readonly tournamentGroupCapacityMaxChange = new EventEmitter<number | string>();
  @Output() readonly tournamentLeaderboardTypeChange = new EventEmitter<EventSubeventTournamentLeaderboardType | string | null | undefined>();
  @Output() readonly tournamentAdvancePerGroupChange = new EventEmitter<number | string>();

  protected subEventStartDateValue: Date | null = null;
  protected subEventStartTimeValue: Date | null = null;
  protected subEventEndDateValue: Date | null = null;
  protected subEventEndTimeValue: Date | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['view']) {
      this.syncDateTimeControlsFromModel();
    }
  }

  protected onStartDateChange(value: Date | null): void {
    this.subEventStartDateValue = value;
    this.model.startAt = AppUtils.applyDatePartToIsoLocal(this.ensureIsoLocal(this.model.startAt), value);
    this.normalizeDateRange();
    this.syncDateTimeControlsFromModel();
  }

  protected onStartTimeChange(value: Date | null): void {
    this.subEventStartTimeValue = value;
    this.model.startAt = AppUtils.applyTimePartFromDateToIsoLocal(this.ensureIsoLocal(this.model.startAt), value);
    this.normalizeDateRange();
    this.syncDateTimeControlsFromModel();
  }

  protected onEndDateChange(value: Date | null): void {
    this.subEventEndDateValue = value;
    this.model.endAt = AppUtils.applyDatePartToIsoLocal(this.ensureIsoLocal(this.model.endAt), value);
    this.normalizeDateRange();
    this.syncDateTimeControlsFromModel();
  }

  protected onEndTimeChange(value: Date | null): void {
    this.subEventEndTimeValue = value;
    this.model.endAt = AppUtils.applyTimePartFromDateToIsoLocal(this.ensureIsoLocal(this.model.endAt), value);
    this.normalizeDateRange();
    this.syncDateTimeControlsFromModel();
  }

  protected trackByInsertOption(_: number, option: { id: string }): string {
    return option.id;
  }

  protected optionalMenuTrigger(): AppMenuTrigger {
    return {
      label: this.model.optional ? 'Optional' : 'Mandatory',
      icon: this.view.modeIcon,
      palette: this.model.optional ? 'blue' : 'red',
      ariaLabel: 'Sub event optional mode',
      shape: 'pill'
    };
  }

  protected optionalMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    return [
      {
        id: 'subevent-optional-mandatory',
        label: 'Mandatory',
        icon: 'block',
        kind: 'radio',
        palette: 'red',
        surface: 'tinted',
        active: !this.model.optional,
        context: { menu: 'optional', optional: false }
      },
      {
        id: 'subevent-optional-optional',
        label: 'Optional',
        icon: 'toggle_on',
        kind: 'radio',
        palette: 'blue',
        surface: 'tinted',
        active: this.model.optional,
        context: { menu: 'optional', optional: true }
      }
    ];
  }

  protected insertTargetMenuTrigger(): AppMenuTrigger {
    return {
      label: this.insertTargetLabel(),
      icon: 'vertical_align_bottom',
      palette: 'default',
      ariaLabel: this.view.insertFieldLabel,
      shape: 'field'
    };
  }

  protected insertTargetMenuItems(): readonly AppMenuItem<string, EventSubeventStageFormMenuContext>[] {
    return this.view.insertOptions.map(option => ({
      id: `subevent-insert-target-${option.id}`,
      label: option.label,
      icon: 'route',
      kind: 'radio',
      active: option.id === this.view.insertTargetId,
      context: { menu: 'insert-target', targetId: option.id }
    }));
  }

  protected tournamentLeaderboardMenuTrigger(): AppMenuTrigger {
    const value = this.view.tournamentLeaderboardTypeValue;
    return {
      label: value,
      icon: this.view.tournamentLeaderboardTypeIcon,
      palette: this.tournamentLeaderboardPalette(value),
      ariaLabel: 'Leaderboard type',
      shape: 'field'
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
      active: option === this.view.tournamentLeaderboardTypeValue,
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
        this.selectOptional.emit(context.optional);
        break;
      case 'insert-target':
        this.insertTargetChange.emit(context.targetId);
        break;
      case 'leaderboard-type':
        this.tournamentLeaderboardTypeChange.emit(context.leaderboardType);
        break;
    }
  }

  private insertTargetLabel(): string {
    const selected = this.view.insertOptions.find(option => option.id === this.view.insertTargetId);
    return selected?.label ?? this.view.insertOptions[0]?.label ?? 'Select stage';
  }

  private tournamentLeaderboardIcon(option: EventSubeventTournamentLeaderboardType): string {
    return option === 'Fifa' ? 'sports_soccer' : 'leaderboard';
  }

  private tournamentLeaderboardPalette(option: EventSubeventTournamentLeaderboardType): AppMenuPalette {
    return option === 'Fifa' ? 'orange' : 'blue';
  }

  private ensureIsoLocal(value: string): string {
    const parsed = this.parseDateTime(value) ?? new Date();
    return AppUtils.toIsoDateTimeLocal(parsed);
  }

  private normalizeDateRange(): void {
    const boundStart = this.parseDateTime(this.view.timingBoundStartAt);
    const boundEnd = this.parseDateTime(this.view.timingBoundEndAt);
    const defaultStart = boundStart ?? new Date();
    const defaultDurationMs = boundStart && boundEnd && boundEnd.getTime() > boundStart.getTime()
      ? Math.max(15 * 60 * 1000, Math.min(60 * 60 * 1000, boundEnd.getTime() - boundStart.getTime()))
      : (60 * 60 * 1000);

    let start = this.parseDateTime(this.model.startAt) ?? new Date(defaultStart.getTime());
    let safeEnd = this.parseDateTime(this.model.endAt);
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

    this.model.startAt = AppUtils.toIsoDateTimeLocal(start);
    this.model.endAt = AppUtils.toIsoDateTimeLocal(safeEnd);
  }

  private syncDateTimeControlsFromModel(): void {
    this.subEventStartDateValue = this.parseDateTime(this.model.startAt);
    this.subEventStartTimeValue = this.parseDateTime(this.model.startAt);
    this.subEventEndDateValue = this.parseDateTime(this.model.endAt);
    this.subEventEndTimeValue = this.parseDateTime(this.model.endAt);
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
      modeIcon: 'block',
      slotBoundTiming: false,
      timingSummaryTitle: '',
      timingSummaryText: '',
      timingSummaryMeta: '',
      startFieldLabel: 'Start',
      endFieldLabel: 'End',
      timingBoundStartAt: '',
      timingBoundEndAt: '',
      showInsertControls: false,
      insertFieldLabel: 'Insert Stage',
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

    // Handle dd/mm/yyyy, hh:mm formats produced by older local state.
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
}

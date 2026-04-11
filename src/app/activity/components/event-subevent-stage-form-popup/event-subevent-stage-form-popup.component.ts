import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { AppUtils } from '../../../shared/app-utils';
import type * as AppTypes from '../../../shared/core/base/models';
import { PricingEditorComponent } from '../../../shared/ui';

export type EventSubeventStageFormModeClass = 'subevent-mode-mandatory' | 'subevent-mode-optional';
export type EventSubeventStageInsertPlacement = 'before' | 'after';
export type EventSubeventTournamentLeaderboardType = 'Score' | 'Fifa';


export interface EventSubeventStageFormPopupView {
  open: boolean;
  parentTitle: string;
  title: string;
  readOnly: boolean;
  canSave: boolean;
  invalidName: boolean;
  invalidDescription: boolean;
  showOptionalToggle: boolean;
  showOptionalPicker: boolean;
  modeClass: EventSubeventStageFormModeClass;
  modeIcon: string;
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
  pricing?: AppTypes.PricingConfig | null;
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
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatNativeDateModule,
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
  @Output() readonly toggleOptionalPicker = new EventEmitter<Event>();
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

  private ensureIsoLocal(value: string): string {
    const parsed = this.parseDateTime(value) ?? new Date();
    return AppUtils.toIsoDateTimeLocal(parsed);
  }

  private normalizeDateRange(): void {
    const start = this.parseDateTime(this.model.startAt) ?? new Date();
    const currentEnd = this.parseDateTime(this.model.endAt);
    const safeEnd = currentEnd && currentEnd.getTime() > start.getTime()
      ? currentEnd
      : new Date(start.getTime() + (60 * 60 * 1000));

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
      showOptionalPicker: false,
      modeClass: 'subevent-mode-mandatory',
      modeIcon: 'block',
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

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

type SubEventModeClass = 'subevent-mode-mandatory' | 'subevent-mode-optional';
type StageInsertPlacement = 'before' | 'after';
type TournamentLeaderboardType = 'Score' | 'Fifa';

interface StageFormModel {
  name: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  optional: boolean;
  capacityMin: number;
  capacityMax: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
}

@Component({
  selector: 'app-event-subevent-stage-form-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSelectModule],
  templateUrl: './event-subevent-stage-form-popup.component.html',
  styleUrls: ['./event-subevent-stage-form-popup.component.scss']
})
export class EventSubeventStageFormPopupComponent {
  @Input() open = false;
  @Input() parentTitle = '';
  @Input() title = 'Create Stage Event';
  @Input() readOnly = false;
  @Input() canSave = false;
  @Input() invalidName = false;
  @Input() invalidDescription = false;
  @Input() showOptionalToggle = false;
  @Input() showOptionalPicker = false;
  @Input() modeClass: SubEventModeClass = 'subevent-mode-mandatory';
  @Input() modeIcon = 'block';
  @Input() showInsertControls = false;
  @Input() insertFieldLabel = 'Insert Stage';
  @Input() insertPlacement: StageInsertPlacement = 'after';
  @Input() insertTargetId: string | null = null;
  @Input() insertOptions: ReadonlyArray<{ id: string; label: string }> = [];
  @Input() showTournamentFields = false;
  @Input() tournamentLeaderboardTypeOptions: readonly TournamentLeaderboardType[] = ['Score', 'Fifa'];
  @Input() tournamentLeaderboardTypeValue: TournamentLeaderboardType = 'Score';
  @Input() tournamentLeaderboardTypeClass = 'tournament-leaderboard-score';
  @Input() tournamentLeaderboardTypeIcon = 'leaderboard';
  @Input() tournamentEstimatedGroupCountLabel = '0 - 0';
  @Input() model: StageFormModel = {
    name: '',
    description: '',
    location: '',
    startAt: '',
    endAt: '',
    optional: false,
    capacityMin: 0,
    capacityMax: 0
  };

  @Output() readonly save = new EventEmitter<Event>();
  @Output() readonly cancel = new EventEmitter<Event>();
  @Output() readonly toggleOptionalPicker = new EventEmitter<Event>();
  @Output() readonly selectOptional = new EventEmitter<boolean>();
  @Output() readonly selectInsertPlacement = new EventEmitter<StageInsertPlacement>();
  @Output() readonly insertTargetChange = new EventEmitter<string | null>();
  @Output() readonly openLocationMap = new EventEmitter<Event>();
  @Output() readonly capacityMinChange = new EventEmitter<number | string>();
  @Output() readonly capacityMaxChange = new EventEmitter<number | string>();
  @Output() readonly tournamentGroupCapacityMinChange = new EventEmitter<number | string>();
  @Output() readonly tournamentGroupCapacityMaxChange = new EventEmitter<number | string>();
  @Output() readonly tournamentLeaderboardTypeChange = new EventEmitter<TournamentLeaderboardType | string | null | undefined>();
  @Output() readonly tournamentAdvancePerGroupChange = new EventEmitter<number | string>();

  protected trackByInsertOption(_: number, option: { id: string }): string {
    return option.id;
  }
}

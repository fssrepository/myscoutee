import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SubEventFormItem, SubEventsDisplayMode, SubEventTournamentStage } from '../../../shared/app-types';

@Component({
  selector: 'app-sub-event-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="sub-event-list">
      <div class="list-header">
        <h3>Sub-events</h3>
        <button *ngIf="!readOnly" type="button" class="add-btn" (click)="addSubEvent.emit()">
          <mat-icon>add</mat-icon>
        </button>
      </div>
      
      <div class="display-mode-picker" *ngIf="subEvents.length">
        <button 
          type="button"
          [class.active]="displayMode === 'Casual'"
          (click)="onModeChange('Casual')"
          [disabled]="readOnly"
        >Casual</button>
        <button 
          type="button"
          [class.active]="displayMode === 'Tournament'"
          (click)="onModeChange('Tournament')"
          [disabled]="readOnly"
        >Tournament</button>
      </div>
      
      <div class="list-content" *ngIf="subEvents.length; else emptyState">
        <ng-container *ngIf="displayMode === 'Casual'">
          <div class="sub-event-item" *ngFor="let item of subEvents" (click)="select.emit(item)">
            <div class="item-info">
              <span class="item-name">{{ item.name || 'Unnamed' }}</span>
              <span class="item-date">{{ item.startAt | date:'short' }}</span>
            </div>
            <button *ngIf="!readOnly" type="button" class="delete-btn" (click)="onDelete($event, item.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </ng-container>
        
        <ng-container *ngIf="displayMode === 'Tournament'">
          <div class="tournament-stage" *ngFor="let stage of tournamentStages" (click)="editStage.emit(stage)">
            <span class="stage-title">{{ stage.title || 'Stage ' + stage.stageNumber }}</span>
            <span class="stage-subtitle">{{ stage.subtitle }}</span>
          </div>
        </ng-container>
      </div>
      
      <ng-template #emptyState>
        <div class="empty-state">No sub-events yet</div>
      </ng-template>
    </div>
  `,
  styles: [`
    .sub-event-list { padding: 16px; }
    .list-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
      h3 { margin: 0; font-size: 16px; font-weight: 500; }
    }
    .add-btn {
      width: 32px; height: 32px; border-radius: 50%; background: #007bff; color: white;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .display-mode-picker {
      display: flex; gap: 8px; margin-bottom: 16px;
      button {
        padding: 6px 16px; border: 1px solid #ddd; background: white; border-radius: 16px;
        cursor: pointer; font-size: 13px;
        &.active { background: #007bff; color: white; border-color: #007bff; }
        &:disabled { opacity: 0.6; cursor: not-allowed; }
      }
    }
    .sub-event-item {
      display: flex; justify-content: space-between; align-items: center; padding: 12px;
      background: #f8f9fa; border-radius: 4px; margin-bottom: 8px; cursor: pointer;
      &:hover { background: #e9ecef; }
    }
    .item-info { display: flex; flex-direction: column; gap: 2px; }
    .item-name { font-weight: 500; }
    .item-date { font-size: 12px; color: #666; }
    .delete-btn {
      background: none; border: none; color: #dc3545; cursor: pointer; padding: 4px;
    }
    .tournament-stage {
      padding: 12px; background: #f8f9fa; border-radius: 4px; margin-bottom: 8px; cursor: pointer;
      &:hover { background: #e9ecef; }
    }
    .stage-title { font-weight: 500; display: block; }
    .stage-subtitle { font-size: 12px; color: #666; }
    .empty-state { text-align: center; color: #999; padding: 20px; }
  `]
})
export class SubEventListComponent {
  @Input() subEvents: SubEventFormItem[] = [];
  @Input() displayMode: SubEventsDisplayMode = 'Casual';
  @Input() readOnly = false;
  @Input() tournamentStages: SubEventTournamentStage[] = [];
  
  @Output() select = new EventEmitter<SubEventFormItem>();
  @Output() delete = new EventEmitter<string>();
  @Output() addSubEvent = new EventEmitter<void>();
  @Output() editStage = new EventEmitter<SubEventTournamentStage>();
  @Output() displayModeChange = new EventEmitter<SubEventsDisplayMode>();
  
  onModeChange(mode: SubEventsDisplayMode): void {
    this.displayModeChange.emit(mode);
  }
  
  onDelete(event: Event, id: string): void {
    event.stopPropagation();
    this.delete.emit(id);
  }
}

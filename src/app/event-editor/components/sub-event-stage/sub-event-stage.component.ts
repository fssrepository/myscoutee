import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SubEventTournamentStage } from '../../../shared/app-types';

@Component({
  selector: 'app-sub-event-stage',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="stage-card" [class.current]="stage?.isCurrent" [class.readonly]="readOnly">
      <div class="stage-header">
        <span class="stage-number">{{ stage?.stageNumber }}</span>
        <span class="stage-title">{{ stage?.title || 'Stage ' + stage?.stageNumber }}</span>
      </div>
      <div class="stage-subtitle">{{ stage?.subtitle }}</div>
      <div class="stage-range">{{ stage?.rangeLabel }}</div>
      <div class="stage-actions" *ngIf="!readOnly">
        <button type="button" (click)="edit.emit()"><mat-icon>edit</mat-icon></button>
        <button type="button" (click)="viewLeaderboard.emit()"><mat-icon>leaderboard</mat-icon></button>
        <button type="button" class="delete" (click)="delete.emit(stage?.subEvent?.id || '')"><mat-icon>delete</mat-icon></button>
      </div>
    </div>
  `,
  styles: [`
    .stage-card {
      background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;
      &.current { border-left: 4px solid #28a745; }
    }
    .stage-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .stage-number {
      width: 28px; height: 28px; background: #007bff; color: white; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500;
    }
    .stage-title { font-weight: 500; font-size: 16px; }
    .stage-subtitle { font-size: 13px; color: #666; margin-bottom: 4px; }
    .stage-range { font-size: 12px; color: #999; }
    .stage-actions {
      display: flex; gap: 8px; margin-top: 12px;
      button {
        background: white; border: 1px solid #ddd; border-radius: 4px; padding: 4px;
        cursor: pointer; mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &.delete { color: #dc3545; }
      }
    }
  `]
})
export class SubEventStageComponent {
  @Input() stage: SubEventTournamentStage | null = null;
  @Input() readOnly = false;
  
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<string>();
  @Output() addGroup = new EventEmitter<void>();
  @Output() viewLeaderboard = new EventEmitter<void>();
}

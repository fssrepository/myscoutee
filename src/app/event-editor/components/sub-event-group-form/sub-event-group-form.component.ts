import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SubEventTournamentStage, SubEventGroupItem } from '../../../shared/app-types';

@Component({
  selector: 'app-sub-event-group-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="group-form">
      <h3>Edit Stage</h3>
      <label class="form-field">
        <span>Groups</span>
        <div class="groups-list">
          <div class="group-item" *ngFor="let group of (stage?.subEvent?.groups || [])">
            <span>{{ group.name || 'Group ' + group.id }}</span>
            <button *ngIf="!readOnly" type="button" class="delete-btn" (click)="onDeleteGroup(group.id)">×</button>
          </div>
        </div>
      </label>
      <button *ngIf="!readOnly" type="button" class="add-group-btn" (click)="onAddGroup()">+ Add Group</button>
      <div class="form-actions">
        <button type="button" class="btn-cancel" (click)="cancel.emit()">Cancel</button>
        <button type="button" class="btn-save" (click)="save.emit()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    .group-form { padding: 16px; }
    h3 { margin: 0 0 16px; font-size: 18px; }
    .form-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .groups-list { display: flex; flex-direction: column; gap: 8px; }
    .group-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; background: #f8f9fa; border-radius: 4px;
    }
    .delete-btn { background: none; border: none; color: #dc3545; cursor: pointer; font-size: 18px; }
    .add-group-btn {
      padding: 8px 16px; background: #007bff; color: white; border: none;
      border-radius: 4px; cursor: pointer; margin-bottom: 16px;
    }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .btn-cancel { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-save { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
  `]
})
export class SubEventGroupFormComponent {
  @Input() stage: SubEventTournamentStage | null = null;
  @Input() readOnly = false;
  
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() addGroup = new EventEmitter<void>();
  @Output() deleteGroup = new EventEmitter<string>();
  
  onAddGroup(): void {
    this.addGroup.emit();
  }
  
  onDeleteGroup(id: string): void {
    this.deleteGroup.emit(id);
  }
}

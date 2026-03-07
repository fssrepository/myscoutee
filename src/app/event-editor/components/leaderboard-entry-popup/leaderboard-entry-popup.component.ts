import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-leaderboard-entry-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="popup">
      <div class="popup-backdrop" (click)="cancel.emit()"></div>
      <div class="popup-content">
        <h3>{{ entry ? 'Edit Entry' : 'Add Entry' }}</h3>
        <label class="form-field">
          <span>Name</span>
          <input type="text" [(ngModel)]="localEntry.name" [readonly]="readOnly" />
        </label>
        <label class="form-field">
          <span>Score</span>
          <input type="number" [(ngModel)]="localEntry.value" [readonly]="readOnly" />
        </label>
        <label class="form-field">
          <span>Note</span>
          <textarea rows="2" [(ngModel)]="localEntry.note" [readonly]="readOnly"></textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn-cancel" (click)="cancel.emit()">Cancel</button>
          <button type="button" class="btn-save" [disabled]="!canSave()" (click)="onSave()">Save</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .popup { position: fixed; inset: 0; z-index: 1000; }
    .popup-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
    .popup-content {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 24px; border-radius: 8px; min-width: 320px;
    }
    h3 { margin: 0 0 16px; font-size: 18px; }
    .form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    input, textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .btn-cancel { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-save { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-save:disabled { background: #ccc; cursor: not-allowed; }
  `]
})
export class LeaderboardEntryPopupComponent implements OnInit {
  @Input() entry: { id?: string; name: string; value: number; note: string } | null = null;
  @Input() readOnly = false;
  
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  
  localEntry = { name: '', value: 0, note: '' };
  
  ngOnInit(): void {
    if (this.entry) {
      this.localEntry = { ...this.entry };
    }
  }
  
  canSave(): boolean {
    return Boolean(this.localEntry.name.trim());
  }
  
  onSave(): void {
    if (this.canSave()) {
      this.save.emit({ ...this.localEntry, id: this.entry?.id || `entry-${Date.now()}` });
    }
  }
}

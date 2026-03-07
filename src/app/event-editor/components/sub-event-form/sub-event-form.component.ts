import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import type { SubEventFormItem } from '../../../shared/app-types';

@Component({
  selector: 'app-sub-event-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule
  ],
  template: `
    <div class="sub-event-form">
      <h3>{{ subEvent?.id ? 'Edit Sub-event' : 'Add Sub-event' }}</h3>
      
      <label class="form-field">
        <span>Name <span class="required">*</span></span>
        <input type="text" [(ngModel)]="localSubEvent.name" [readonly]="readOnly" />
      </label>
      
      <label class="form-field">
        <span>Description</span>
        <textarea rows="3" [(ngModel)]="localSubEvent.description" [readonly]="readOnly"></textarea>
      </label>
      
      <div class="form-field-row">
        <label class="form-field">
          <span>Start</span>
          <input type="datetime-local" [(ngModel)]="localSubEvent.startAt" [readonly]="readOnly" />
        </label>
        
        <label class="form-field">
          <span>End</span>
          <input type="datetime-local" [(ngModel)]="localSubEvent.endAt" [readonly]="readOnly" />
        </label>
      </div>
      
      <label class="form-field">
        <span>Location</span>
        <input type="text" [(ngModel)]="localSubEvent.location" [readonly]="readOnly" />
      </label>
      
      <div class="form-actions">
        <button type="button" class="btn-cancel" (click)="onCancel()">Cancel</button>
        <button 
          type="button" 
          class="btn-save"
          [disabled]="!canSave()"
          (click)="onSave()"
        >
          Save
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sub-event-form {
      padding: 16px;
    }
    h3 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 500;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
      span {
        font-size: 12px;
        color: #666;
      }
      input, textarea {
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
    }
    .form-field-row {
      display: flex;
      gap: 12px;
      .form-field { flex: 1; }
    }
    .required { color: #dc3545; }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .btn-cancel {
      padding: 8px 16px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn-save {
      padding: 8px 16px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      &:disabled { background: #ccc; cursor: not-allowed; }
    }
  `]
})
export class SubEventFormComponent implements OnChanges {
  @Input() subEvent: SubEventFormItem | null = null;
  @Input() readOnly = false;
  
  @Output() save = new EventEmitter<SubEventFormItem>();
  @Output() cancel = new EventEmitter<void>();
  
  localSubEvent: SubEventFormItem = this.createEmpty();
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subEvent'] && this.subEvent) {
      this.localSubEvent = { ...this.subEvent };
    }
  }
  
  canSave(): boolean {
    return Boolean(this.localSubEvent.name.trim());
  }
  
  onSave(): void {
    if (this.canSave()) {
      this.save.emit(this.localSubEvent);
    }
  }
  
  onCancel(): void {
    this.cancel.emit();
  }
  
  private createEmpty(): SubEventFormItem {
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    return {
      id: `subevent-${Date.now()}`,
      name: '',
      description: '',
      startAt: now.toISOString(),
      endAt: end.toISOString(),
      location: '',
      optional: false,
      capacityMin: 0,
      capacityMax: 0,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0
    };
  }
}

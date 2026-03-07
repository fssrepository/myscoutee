import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { EventVisibility } from '../../../shared/app-types';

@Component({
  selector: 'app-event-visibility-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="visibility-picker">
      <button 
        *ngFor="let option of options"
        type="button"
        class="visibility-btn"
        [class.selected]="visibility === option"
        [class.disabled]="readOnly"
        [disabled]="readOnly"
        (click)="onSelect(option)"
      >
        <span class="visibility-icon" [ngClass]="getIconClass(option)"></span>
        <span class="visibility-label">{{ option }}</span>
      </button>
    </div>
  `,
  styles: [`
    .visibility-picker { display: flex; flex-direction: column; gap: 8px; }
    .visibility-btn {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer;
      transition: all 0.2s;
      &:hover:not(.disabled) { border-color: #007bff; background: #f0f7ff; }
      &.selected { border-color: #007bff; background: #e7f1ff; }
      &.disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .visibility-icon {
      width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      &.public { background: #28a745; }
      &.friends { background: #007bff; }
      &.invite { background: #ffc107; }
    }
    .visibility-label { font-size: 14px; }
  `]
})
export class EventVisibilityPickerComponent {
  @Input() visibility: EventVisibility = 'Public';
  @Input() readOnly = false;
  @Input() options: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  
  @Output() change = new EventEmitter<EventVisibility>();
  
  getIconClass(option: string): string {
    switch (option) {
      case 'Public': return 'public';
      case 'Friends only': return 'friends';
      case 'Invitation only': return 'invite';
      default: return '';
    }
  }
  
  onSelect(option: EventVisibility): void {
    if (!this.readOnly) {
      this.change.emit(option);
    }
  }
}

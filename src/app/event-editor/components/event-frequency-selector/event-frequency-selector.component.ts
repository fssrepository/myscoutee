import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-event-frequency-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="frequency-picker">
      <button 
        *ngFor="let option of options"
        type="button"
        class="frequency-btn"
        [class.selected]="frequency === option"
        [class.disabled]="readOnly"
        [disabled]="readOnly"
        (click)="onSelect(option)"
      >
        <span class="frequency-icon" [ngClass]="getIconClass(option)"></span>
        <span class="frequency-label">{{ option }}</span>
      </button>
    </div>
  `,
  styles: [`
    .frequency-picker { display: flex; flex-direction: column; gap: 8px; }
    .frequency-btn {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer;
      transition: all 0.2s;
      &:hover:not(.disabled) { border-color: #007bff; background: #f0f7ff; }
      &.selected { border-color: #007bff; background: #e7f1ff; }
      &.disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .frequency-icon {
      width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .frequency-label { font-size: 14px; }
  `]
})
export class EventFrequencySelectorComponent {
  @Input() frequency = 'One-time';
  @Input() readOnly = false;
  @Input() options: string[] = ['One-time', 'Daily', 'Weekly', 'Monthly'];
  
  @Output() change = new EventEmitter<string>();
  
  getIconClass(option: string): string {
    switch (option) {
      case 'One-time': return '📅';
      case 'Daily': return '📆';
      case 'Weekly': return '📅';
      case 'Monthly': return '🗓️';
      default: return '📅';
    }
  }
  
  onSelect(option: string): void {
    if (!this.readOnly) {
      this.change.emit(option);
    }
  }
}

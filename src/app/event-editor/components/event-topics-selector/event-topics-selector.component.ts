import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-event-topics-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="topics-selector">
      <div class="selector-backdrop" (click)="close.emit()"></div>
      <div class="selector-content">
        <h3>Select Topics</h3>
        <div class="topics-list">
          <button 
            *ngFor="let topic of availableTopics"
            type="button"
            class="topic-btn"
            [class.selected]="isSelected(topic)"
            (click)="toggleTopic(topic)"
          >
            {{ topic }}
          </button>
        </div>
        <div class="selector-actions">
          <button type="button" class="btn-cancel" (click)="close.emit()">Cancel</button>
          <button type="button" class="btn-save" (click)="close.emit()">Done</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .topics-selector { position: fixed; inset: 0; z-index: 1000; }
    .selector-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
    .selector-content {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 24px; border-radius: 8px; min-width: 320px; max-width: 90vw;
    }
    h3 { margin: 0 0 16px; font-size: 18px; }
    .topics-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .topic-btn {
      padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 20px;
      cursor: pointer; font-size: 13px; transition: all 0.2s;
      &:hover { border-color: #007bff; }
      &.selected { background: #007bff; color: white; border-color: #007bff; }
    }
    .selector-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .btn-cancel { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-save { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
  `]
})
export class EventTopicsSelectorComponent {
  @Input() selectedTopics: string[] = [];
  @Input() maxTopics = 5;
  @Input() availableTopics: string[] = [
    'Sports', 'Music', 'Art', 'Food', 'Gaming', 'Tech', 'Travel', 'Health', 
    'Education', 'Business', 'Social', 'Outdoor', 'Indoor', 'Adventure'
  ];
  
  @Output() change = new EventEmitter<string[]>();
  @Output() close = new EventEmitter<void>();
  
  isSelected(topic: string): boolean {
    return this.selectedTopics.includes(topic);
  }
  
  toggleTopic(topic: string): void {
    if (this.isSelected(topic)) {
      this.selectedTopics = this.selectedTopics.filter(t => t !== topic);
    } else if (this.selectedTopics.length < this.maxTopics) {
      this.selectedTopics = [...this.selectedTopics, topic];
    }
    this.change.emit(this.selectedTopics);
  }
}

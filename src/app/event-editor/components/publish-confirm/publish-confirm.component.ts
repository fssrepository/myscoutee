import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-publish-confirm',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <section class="publish-confirm">
      <div class="publish-confirm-backdrop" (click)="onCancel()"></div>
      <div class="publish-confirm-panel">
        <h4>{{ title }}</h4>
        <p>{{ message }}</p>
        <div class="popup-actions">
          <button type="button" class="link-btn neutral-btn" (click)="onCancel()">Cancel</button>
          <button type="button" class="link-btn publish-btn" (click)="onConfirm()">Publish</button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .publish-confirm { position: fixed; inset: 0; z-index: 1000; }
    .publish-confirm-backdrop {
      position: absolute; inset: 0; background: rgba(0,0,0,0.5);
    }
    .publish-confirm-panel {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 24px; border-radius: 8px; min-width: 300px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    h4 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 16px; color: #666; }
    .popup-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .link-btn {
      padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
    }
    .neutral-btn { background: #6c757d; color: white; }
    .publish-btn { background: #28a745; color: white; }
  `]
})
export class PublishConfirmComponent {
  @Input() title = 'Publish event';
  @Input() message = 'Are you sure you want to publish this event?';
  
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  
  onConfirm(): void {
    this.confirm.emit();
  }
  
  onCancel(): void {
    this.cancel.emit();
  }
}


import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

import type { DemoUserListItemDto } from '../../../shared/core';

@Component({
  selector: 'app-entry-demo-user-selector',
  standalone: true,
  imports: [
    MatButtonModule,
    MatRippleModule
],
  templateUrl: './entry-demo-user-selector.component.html',
  styleUrl: './entry-demo-user-selector.component.scss'
})
export class EntryDemoUserSelectorComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() loadingProgress = 0;
  @Input() loadingLabel = 'Preparing demo data';
  @Input() submitting = false;
  @Input() users: DemoUserListItemDto[] = [];

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly userSelected = new EventEmitter<string>();

  protected requestClose(): void {
    if (this.submitting) {
      return;
    }
    this.closeRequested.emit();
  }

  protected requestUserSelect(userId: string): void {
    if (this.loading || this.submitting) {
      return;
    }
    this.userSelected.emit(userId);
  }
}

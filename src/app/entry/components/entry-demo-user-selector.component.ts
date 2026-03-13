import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import type { DemoUserListItemDto } from '../../shared/core/user.interface';

@Component({
  selector: 'app-entry-demo-user-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule
  ],
  templateUrl: './entry-demo-user-selector.component.html',
  styleUrl: './entry-demo-user-selector.component.scss'
})
export class EntryDemoUserSelectorComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() users: DemoUserListItemDto[] = [];

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly userSelected = new EventEmitter<string>();

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected requestUserSelect(userId: string): void {
    this.userSelected.emit(userId);
  }
}

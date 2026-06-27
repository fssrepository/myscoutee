import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AdminPopupStore } from '../../../shared/ui/context/stores/admin-popup.store';

@Component({
  selector: 'app-admin-item-preview-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './admin-item-preview-popup.component.html',
  styleUrl: './admin-item-preview-popup.component.scss'
})
export class AdminItemPreviewPopupComponent {
  protected readonly admin = inject(AdminPopupStore);

  protected itemIcon(sourceType?: string | null): string {
    switch ((sourceType ?? '').trim()) {
      case 'asset':
        return 'inventory_2';
      case 'chat':
        return 'forum';
      default:
        return 'event';
    }
  }
}

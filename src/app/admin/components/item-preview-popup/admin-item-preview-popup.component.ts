import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import { AdminMenuStore } from '../../../shared/ui/context/stores/admin-menu.store';

@Component({
  selector: 'app-admin-item-preview-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, PopupComponent],
  templateUrl: './admin-item-preview-popup.component.html',
  styleUrl: './admin-item-preview-popup.component.scss'
})
export class AdminItemPreviewPopupComponent {
  protected readonly admin = inject(AdminMenuStore);

  protected itemPreviewPopupModel(): PopupModel {
    return {
      title: 'Reported item',
      subtitle: 'Report-scoped preview only.',
      ariaLabel: 'Reported item',
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      onClose: () => this.admin.closePopup()
    };
  }

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

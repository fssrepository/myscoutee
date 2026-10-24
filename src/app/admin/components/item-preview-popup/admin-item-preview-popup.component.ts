import { I18nPipe } from '@fssrepository/myscoutee-components';
import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { PopupComponent, type PopupModel } from '@fssrepository/myscoutee-components';
import { AdminMenuStore } from '../../../shared/ui/context/stores/admin/admin-menu.store';

@Component({
  selector: 'app-admin-item-preview-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, PopupComponent, I18nPipe],
  templateUrl: './admin-item-preview-popup.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-item-preview-popup.component.scss'
})
export class AdminItemPreviewPopupComponent {
  protected readonly admin = inject(AdminMenuStore);

  protected itemPreviewPopupModel(): PopupModel {
    return {
      title: 'admin.report.preview.title',
      subtitle: 'admin.report.preview.scope.description',
      ariaLabel: 'admin.report.preview.title',
      closeAriaLabel: 'close',
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

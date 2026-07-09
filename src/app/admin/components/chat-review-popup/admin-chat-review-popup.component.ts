import {
  CommonModule
} from '@angular/common';
import {
  Component,
  inject
} from '@angular/core';

import {
  type AdminChatMessageDto
} from '../../../shared/core';
import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';

@Component({
  selector: 'app-admin-chat-review-popup',
  standalone: true,
  imports: [CommonModule, PopupComponent],
  templateUrl: './admin-chat-review-popup.component.html',
  styleUrl: './admin-chat-review-popup.component.scss'
})
export class AdminChatReviewPopupComponent {
  protected readonly admin = inject(AdminMenuStore);

  protected chatReviewPopupModel(): PopupModel {
    return {
      title: 'Reported chat message',
      subtitle: this.admin.selectedReport()?.chatTitle || 'Reported conversation',
      ariaLabel: 'Reported chat message',
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      onClose: () => this.admin.closePopup()
    };
  }

  protected isReportedMessage(message: AdminChatMessageDto): boolean {
    return message.id === this.admin.selectedReport()?.messageId;
  }
}

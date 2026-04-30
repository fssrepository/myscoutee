import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AdminService, type AdminChatMessageDto } from '../admin.service';

@Component({
  selector: 'app-admin-chat-review-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-chat-review-popup.component.html',
  styleUrl: './admin-popups.scss'
})
export class AdminChatReviewPopupComponent {
  protected readonly admin = inject(AdminService);
  protected warnMessage = 'Please update the reported behavior before your account is blocked.';
  protected sending = false;

  protected isReportedMessage(message: AdminChatMessageDto): boolean {
    return message.id === this.admin.selectedReport()?.messageId;
  }

  protected async sendWarning(): Promise<void> {
    const user = this.admin.selectedReportedUser();
    const message = this.warnMessage.trim();
    if (!user || !message || this.sending) {
      return;
    }
    this.sending = true;
    try {
      await this.admin.warnUser(user.userId, message);
      this.admin.closePopup();
    } finally {
      this.sending = false;
    }
  }
}

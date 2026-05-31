import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { ProgressIndicatorComponent } from '../../../shared/ui/components/progress-indicator';
import type { AdminChatMessageDto } from '../../models/admin-moderation.model';
import { AdminModerationService } from '../../services/admin-moderation.service';
import { AdminShellService } from '../../services/admin-shell.service';

@Component({
  selector: 'app-admin-chat-review-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ProgressIndicatorComponent],
  templateUrl: './admin-chat-review-popup.component.html',
  styleUrl: '../admin-popups.scss'
})
export class AdminChatReviewPopupComponent {
  protected readonly admin = inject(AdminShellService);
  private readonly moderation = inject(AdminModerationService);
  protected warnMessage = 'Please update the reported behavior before your account is blocked.';
  protected sending = false;
  protected sendState: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  protected sendStatus = '';

  protected isReportedMessage(message: AdminChatMessageDto): boolean {
    return message.id === this.admin.selectedReport()?.messageId;
  }

  protected warningSendRingState(): 'loading' | 'error' {
    return this.sendState === 'sending' ? 'loading' : 'error';
  }

  protected async sendWarning(): Promise<void> {
    const user = this.admin.selectedReportedUser();
    const message = this.warnMessage.trim();
    if (!user || !message || this.sending) {
      return;
    }
    this.sending = true;
    this.sendState = 'sending';
    this.sendStatus = '';
    try {
      await this.moderation.warnUser(user.userId, message);
      this.sendState = 'success';
      this.sendStatus = 'Warning message was sent to the user.';
      this.warnMessage = '';
    } catch {
      this.sendState = 'error';
      this.sendStatus = 'Warning message could not be sent. Please try again.';
    } finally {
      this.sending = false;
    }
  }
}

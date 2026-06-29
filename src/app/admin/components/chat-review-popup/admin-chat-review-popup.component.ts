import {
  CommonModule
} from '@angular/common';
import {
  Component,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  AdminModerationService as CoreAdminModerationService,
  type AdminChatMessageDto,
  type AdminModerationActionResult,
  type AdminReportedUserDto
} from '../../../shared/core';
import {
  IndicatorComponent
} from '../../../shared/ui/components/core/indicator';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';
import {
  AdminWorkspaceStore
} from '../../../shared/ui/context/stores/admin-workspace.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';

@Component({
  selector: 'app-admin-chat-review-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, IndicatorComponent],
  templateUrl: './admin-chat-review-popup.component.html',
  styleUrl: './admin-chat-review-popup.component.scss'
})
export class AdminChatReviewPopupComponent {
  protected readonly admin = inject(AdminMenuStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly workspace = inject(AdminWorkspaceStore);
  private readonly moderationData = inject(CoreAdminModerationService);
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
      await this.warnUser(user.userId, message);
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

  private async warnUser(userId: string, message: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.warnUser(
      normalizedUserId,
      this.userProfileStore.activeAdminUser(),
      message
    );
    this.applyModerationActionResult(normalizedUserId, result);
  }

  private applyModerationActionResult(
    userId: string,
    result: AdminModerationActionResult | null | undefined
  ): void {
    if (!result) {
      return;
    }
    if (result.dashboard) {
      this.workspace.applyDashboard(result.dashboard);
    }
    if (result.userPatch) {
      this.workspace.patchModerationUser(result.userPatch);
    }
    this.refreshSelectedReportedUser(userId);
  }

  private refreshSelectedReportedUser(userId: string): void {
    const selected = this.admin.selectedReportedUser();
    if (!selected || selected.userId !== userId) {
      return;
    }
    this.admin.setSelectedReportedUser(this.resolveDashboardReportedUser(userId) ?? selected);
  }

  private resolveDashboardReportedUser(userId: string): AdminReportedUserDto | null {
    const dashboard = this.workspace.dashboard();
    if (!dashboard) {
      return null;
    }
    const normalizedUserId = userId.trim();
    return [
      ...(dashboard.reportedUsers ?? []),
      ...(dashboard.blockedUsers ?? [])
    ].find(user => user.userId === normalizedUserId) ?? null;
  }
}

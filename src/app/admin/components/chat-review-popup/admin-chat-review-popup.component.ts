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
  AdminModerationService as CoreAdminModerationService,
  type AdminChatMessageDto,
  type AdminModerationActionResult,
  type AdminReportedUserDto
} from '../../../shared/core';
import {
  FormFlowComponent,
  type FormFlowModel
} from '../../../shared/ui/components/core/form/flow';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
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
  imports: [CommonModule, FormsModule, PopupComponent, FormFlowComponent, AppMenuComponent],
  templateUrl: './admin-chat-review-popup.component.html',
  styleUrl: './admin-chat-review-popup.component.scss'
})
export class AdminChatReviewPopupComponent {
  protected readonly admin = inject(AdminMenuStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly workspace = inject(AdminWorkspaceStore);
  private readonly moderationData = inject(CoreAdminModerationService);
  protected warnMessage = 'Please update the reported behavior before your account is blocked.';
  protected warningFormValue = {
    message: this.warnMessage
  };
  protected sending = false;
  protected sendState: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  protected sendStatus = '';

  protected chatReviewPopupModel(): PopupModel {
    const isWarning = this.admin.activePopup() === 'warn-chat';
    return {
      title: isWarning ? 'Warn user' : 'Reported chat message',
      subtitle: isWarning
        ? 'Send a support chat message before blocking.'
        : (this.admin.selectedReport()?.chatTitle || 'Reported conversation'),
      ariaLabel: isWarning ? 'Warn user' : 'Reported chat message',
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

  protected warningFlowModel(user: AdminReportedUserDto | null | undefined): FormFlowModel {
    return {
      title: 'Warning message',
      subtitle: user ? `${user.name} · ${user.reportCount} reports` : 'Send a support chat message before blocking.',
      layout: 'grouped',
      tone: 'orange',
      header: false,
      summary: { enabled: false },
      completion: { controls: 'required' },
      save: null,
      steps: [
        {
          id: 'warning',
          title: 'Warning',
          icon: 'chat',
          controls: [
            {
              id: 'message',
              bind: 'message',
              kind: 'textarea',
              layout: 'wide',
              label: 'Warning message',
              rows: 5,
              required: true
            }
          ]
        }
      ]
    };
  }

  protected onWarningFlowValueChange(value: unknown): void {
    const record = this.isRecord(value) ? value : {};
    const nextValue = {
      message: `${record['message'] ?? ''}`
    };
    this.warningFormValue = nextValue;
    this.warnMessage = nextValue.message;
  }

  protected warningActionMenuItems(): readonly AppMenuItem<'send-warning'>[] {
    return [{
      id: 'send-warning',
      label: 'send.warning',
      icon: this.sending ? 'hourglass_empty' : 'send',
      layout: 'action',
      palette: 'warning',
      disabled: this.sending || !this.warnMessage.trim() || !this.admin.selectedReportedUser(),
      ariaLabel: 'send.warning',
      progress: this.sending || this.sendState === 'error'
        ? {
            state: this.sending ? 'loading' : 'error',
            shape: 'button'
          }
        : null
    }];
  }

  protected onWarningActionMenuSelect(event: AppMenuItemSelectEvent<'send-warning'>): void {
    if (event.id !== 'send-warning') {
      return;
    }
    void this.sendWarning();
  }

  protected async sendWarning(): Promise<void> {
    const user = this.admin.selectedReportedUser();
    const reportId = this.admin.selectedReport()?.id ?? null;
    const message = this.warnMessage.trim();
    if (!user || !message || this.sending) {
      return;
    }
    this.sending = true;
    this.sendState = 'sending';
    this.sendStatus = '';
    try {
      await this.warnUser(user.userId, message, reportId);
      this.sendState = 'success';
      this.sendStatus = 'Warning message was sent to the user.';
      this.warnMessage = '';
      this.warningFormValue = {
        message: ''
      };
    } catch {
      this.sendState = 'error';
      this.sendStatus = 'Warning message could not be sent. Please try again.';
    } finally {
      this.sending = false;
    }
  }

  private async warnUser(userId: string, message: string, reportId?: string | null): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const result = await this.moderationData.warnUser(
      normalizedUserId,
      this.userProfileStore.activeAdminUser(),
      message,
      reportId
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

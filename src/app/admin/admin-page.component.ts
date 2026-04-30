import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { NavigatorComponent } from '../navigator';
import { EntryDemoUserSelectorComponent } from '../entry/components/entry-demo-user-selector/entry-demo-user-selector.component';
import { SessionService, AppPopupContext } from '../shared/core';
import type { DemoBootstrapProgressStage } from '../shared/core/demo';
import { ConfirmationDialogComponent } from '../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { NavigatorService } from '../navigator/navigator.service';
import { AdminService, type AdminBootstrapProgressState } from './admin.service';
import { AdminReportsPopupComponent } from './components/admin-reports-popup.component';
import { AdminFeedbackPopupComponent } from './components/admin-feedback-popup.component';
import { AdminChatReviewPopupComponent } from './components/admin-chat-review-popup.component';
import { AdminItemPreviewPopupComponent } from './components/admin-item-preview-popup.component';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatRippleModule,
    NavigatorComponent,
    EntryDemoUserSelectorComponent,
    ConfirmationDialogComponent,
    AdminReportsPopupComponent,
    AdminFeedbackPopupComponent,
    AdminChatReviewPopupComponent,
    AdminItemPreviewPopupComponent
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss'
})
export class AdminPageComponent {
  protected readonly admin = inject(AdminService);
  protected readonly sessionService = inject(SessionService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly popupCtx = inject(AppPopupContext);
  private lastHandledAdminRequestMs = 0;

  protected selectorOpen = false;
  protected selectorLoading = false;
  protected selectorSubmitting = false;
  protected selectorLoadingProgress = 0;
  protected selectorLoadingLabel = 'Preparing admin data';
  protected selectorLoadingStage: DemoBootstrapProgressStage = 'selector';
  protected selectorErrorMessage = '';
  constructor() {
    effect(() => {
      const request = this.popupCtx.adminNavigatorRequest();
      if (!request || request.updatedMs <= this.lastHandledAdminRequestMs) {
        return;
      }
      this.lastHandledAdminRequestMs = request.updatedMs;
      this.popupCtx.clearAdminNavigatorRequest();
      switch (request.popup) {
        case 'reports':
          this.admin.openReports();
          break;
        case 'feedback':
          this.admin.openFeedback();
          break;
        case 'chat':
          this.admin.openChat();
          break;
        case 'profile':
          this.navigatorService.openProfileEditor();
          break;
      }
    });
  }

  protected async requestAdminLogin(): Promise<void> {
    this.selectorErrorMessage = '';
    if (!this.admin.isFirebaseAdminMode) {
      this.openSelector();
      return;
    }
    const session = await this.sessionService.startFirebaseSession();
    if (!session) {
      return;
    }
    await this.admin.bootstrapAdmin();
  }

  protected openSelector(): void {
    this.selectorOpen = true;
    this.selectorLoading = false;
    this.selectorSubmitting = false;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingLabel = 'Select an admin user';
    this.selectorLoadingStage = 'selector';
    this.selectorErrorMessage = '';
  }

  protected closeSelector(): void {
    if (this.selectorSubmitting) {
      return;
    }
    this.selectorOpen = false;
    this.selectorLoading = false;
    this.selectorSubmitting = false;
    this.selectorErrorMessage = '';
  }

  protected async onSelectAdminUser(adminUserId: string): Promise<void> {
    if (this.selectorSubmitting) {
      return;
    }
    this.selectorSubmitting = true;
    this.selectorLoading = true;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingStage = 'selector';
    this.selectorLoadingLabel = 'Preparing admin bootstrap';
    if (this.admin.usesHttpAdminApi && !this.admin.isFirebaseAdminMode) {
      this.sessionService.startDemoSession(adminUserId);
    }
    const dashboard = await this.admin.bootstrapAdmin(adminUserId, state => this.applyProgress(state));
    if (dashboard) {
      this.selectorOpen = false;
      this.selectorLoading = false;
      this.selectorSubmitting = false;
      return;
    }
    this.selectorLoading = false;
    this.selectorSubmitting = false;
    this.selectorErrorMessage = this.admin.error() || 'Unable to open admin workspace.';
  }

  protected retrySelector(): void {
    this.openSelector();
  }

  @HostListener('window:adminLogoutRequested')
  protected onAdminLogoutRequested(): void {
    this.admin.clearAdminSession();
  }

  private applyProgress(state: AdminBootstrapProgressState): void {
    this.selectorLoadingProgress = state.percent;
    this.selectorLoadingLabel = state.label;
    this.selectorLoadingStage = this.toDemoProgressStage(state.stage);
  }

  private toDemoProgressStage(stage: AdminBootstrapProgressState['stage']): DemoBootstrapProgressStage {
    switch (stage) {
      case 'indexedDb':
        return 'indexedDb';
      case 'profile':
        return 'session';
      case 'ready':
        return 'sessionReady';
      default:
        return 'selector';
    }
  }
}

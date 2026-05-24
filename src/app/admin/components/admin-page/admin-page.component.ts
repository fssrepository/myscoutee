import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, Type, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { NavigatorComponent } from '../../../navigator';
import { EntryDemoUserSelectorComponent } from '../../../entry/components/entry-demo-user-selector/entry-demo-user-selector.component';
import { SessionService, AppPopupContext } from '../../../shared/core';
import type { DemoBootstrapProgressStage } from '../../../shared/core/demo';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { NavigatorService } from '../../../navigator/navigator.service';
import { AdminService, type AdminBootstrapProgressState } from '../../admin.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatRippleModule,
    NavigatorComponent,
    EntryDemoUserSelectorComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss'
})
export class AdminPageComponent implements OnInit {
  private static readonly DEMO_RESTORE_MIN_DELAY_MS = 1500;

  protected readonly admin = inject(AdminService);
  protected readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);
  private readonly navigatorService = inject(NavigatorService);
  private readonly popupCtx = inject(AppPopupContext);
  private lastHandledAdminRequestMs = 0;
  private readonly reportsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly feedbackPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly helpEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly ideaEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly notificationsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly paramsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly statsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly monitoringPopupComponentRef = signal<Type<unknown> | null>(null);

  protected selectorOpen = false;
  protected selectorLoading = false;
  protected selectorSubmitting = false;
  protected selectorLoadingProgress = 0;
  protected selectorLoadingLabel = 'Preparing admin data';
  protected selectorLoadingStage: DemoBootstrapProgressStage = 'selector';
  protected selectorErrorMessage = '';
  protected readonly restoringWorkspace = signal(this.currentRouteIsWorkspace());
  protected readonly restoreAvatarGateActive = signal(false);
  protected readonly reportsPopupComponent = this.reportsPopupComponentRef.asReadonly();
  protected readonly feedbackPopupComponent = this.feedbackPopupComponentRef.asReadonly();
  protected readonly helpEditorPopupComponent = this.helpEditorPopupComponentRef.asReadonly();
  protected readonly ideaEditorPopupComponent = this.ideaEditorPopupComponentRef.asReadonly();
  protected readonly notificationsPopupComponent = this.notificationsPopupComponentRef.asReadonly();
  protected readonly paramsPopupComponent = this.paramsPopupComponentRef.asReadonly();
  protected readonly statsPopupComponent = this.statsPopupComponentRef.asReadonly();
  protected readonly monitoringPopupComponent = this.monitoringPopupComponentRef.asReadonly();

  constructor() {
    effect(() => {
      switch (this.admin.activePopup()) {
        case 'reports':
          void this.ensureReportsPopupLoaded();
          break;
        case 'feedback':
          void this.ensureFeedbackPopupLoaded();
          break;
        case 'help-editor':
          void this.ensureHelpEditorPopupLoaded();
          break;
        case 'idea-editor':
          void this.ensureIdeaEditorPopupLoaded();
          break;
        case 'notifications':
          void this.ensureNotificationsPopupLoaded();
          break;
        case 'params':
          void this.ensureParamsPopupLoaded();
          break;
        case 'stats':
          void this.ensureStatsPopupLoaded();
          break;
        case 'monitoring':
          void this.ensureMonitoringPopupLoaded();
          break;
      }
    });

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
        case 'help-editor':
          this.admin.openHelpEditor();
          break;
        case 'idea-editor':
          this.admin.openIdeaEditor();
          break;
        case 'notifications':
          this.admin.openNotifications();
          break;
        case 'params':
          this.admin.openParams();
          break;
        case 'stats':
          this.admin.openStats();
          break;
        case 'monitoring':
          this.admin.openMonitoring();
          break;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.isWorkspaceRoute() || this.admin.dashboard()) {
      this.restoringWorkspace.set(false);
      return;
    }
    this.restoringWorkspace.set(true);
    this.restoreAvatarGateActive.set(false);
    const restored = await this.admin.restoreAdminSession();
    if (restored && this.shouldUseDemoAvatarGate()) {
      this.restoreAvatarGateActive.set(true);
      await this.delay(AdminPageComponent.DEMO_RESTORE_MIN_DELAY_MS);
    }
    this.restoreAvatarGateActive.set(false);
    this.restoringWorkspace.set(false);
    if (!restored) {
      await this.router.navigateByUrl(this.admin.accessDenied() ? '/game' : '/admin', { replaceUrl: true });
    }
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
    const dashboard = await this.admin.bootstrapAdmin();
    if (dashboard) {
      await this.router.navigateByUrl('/admin/workspace', { replaceUrl: true });
      return;
    }
    if (this.admin.accessDenied()) {
      await this.router.navigateByUrl('/game', { replaceUrl: true });
    }
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
      this.restoringWorkspace.set(true);
      if (this.shouldUseDemoAvatarGate()) {
        this.restoreAvatarGateActive.set(true);
        await this.delay(AdminPageComponent.DEMO_RESTORE_MIN_DELAY_MS);
      }
      this.restoreAvatarGateActive.set(false);
      this.restoringWorkspace.set(false);
      await this.router.navigateByUrl('/admin/workspace', { replaceUrl: true });
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

  @HostListener('window:adminAccessDenied')
  protected onAdminAccessDenied(): void {
    this.admin.handleAdminAccessDenied();
    if (this.router.url.split('?')[0].startsWith('/admin')) {
      void this.router.navigateByUrl('/game', { replaceUrl: true });
    }
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

  private isWorkspaceRoute(): boolean {
    return this.currentRouteIsWorkspace();
  }

  private currentRouteIsWorkspace(): boolean {
    return this.router.url.split('?')[0] === '/admin/workspace';
  }

  private shouldUseDemoAvatarGate(): boolean {
    return !this.admin.usesHttpAdminApi;
  }

  private async ensureReportsPopupLoaded(): Promise<void> {
    if (this.reportsPopupComponentRef()) {
      return;
    }
    const module = await import('../reports-popup/admin-reports-popup.component');
    this.reportsPopupComponentRef.set(module.AdminReportsPopupComponent);
  }

  private async ensureFeedbackPopupLoaded(): Promise<void> {
    if (this.feedbackPopupComponentRef()) {
      return;
    }
    const module = await import('../feedback-popup/admin-feedback-popup.component');
    this.feedbackPopupComponentRef.set(module.AdminFeedbackPopupComponent);
  }

  private async ensureHelpEditorPopupLoaded(): Promise<void> {
    if (this.helpEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../help-editor-popup/admin-help-editor-popup.component');
    this.helpEditorPopupComponentRef.set(module.AdminHelpEditorPopupComponent);
  }

  private async ensureIdeaEditorPopupLoaded(): Promise<void> {
    if (this.ideaEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../idea-editor-popup/admin-idea-editor-popup.component');
    this.ideaEditorPopupComponentRef.set(module.AdminIdeaEditorPopupComponent);
  }

  private async ensureNotificationsPopupLoaded(): Promise<void> {
    if (this.notificationsPopupComponentRef()) {
      return;
    }
    const module = await import('../notifications-popup/admin-notifications-popup.component');
    this.notificationsPopupComponentRef.set(module.AdminNotificationsPopupComponent);
  }

  private async ensureParamsPopupLoaded(): Promise<void> {
    if (this.paramsPopupComponentRef()) {
      return;
    }
    const module = await import('../params-popup/admin-params-popup.component');
    this.paramsPopupComponentRef.set(module.AdminParamsPopupComponent);
  }

  private async ensureStatsPopupLoaded(): Promise<void> {
    if (this.statsPopupComponentRef()) {
      return;
    }
    const module = await import('../stats-popup/admin-stats-popup.component');
    this.statsPopupComponentRef.set(module.AdminStatsPopupComponent);
  }

  private async ensureMonitoringPopupLoaded(): Promise<void> {
    if (this.monitoringPopupComponentRef()) {
      return;
    }
    const module = await import('../monitoring-popup/admin-monitoring-popup.component');
    this.monitoringPopupComponentRef.set(module.AdminMonitoringPopupComponent);
  }

  private delay(durationMs: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, durationMs)));
  }
}

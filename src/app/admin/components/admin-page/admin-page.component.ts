import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, Type, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { AppPopupContext } from '../../../shared/ui';
import { NavigatorComponent } from '../../../navigator/components/navigator/navigator.component';
import {
  AdminWorkspaceDataService,
  HelpCenterService,
  SessionService,
  type AdminBootstrapProcessState,
  type AdminDashboardDto
} from '../../../shared/core';
import { ConfirmationDialogComponent } from '../../../shared/ui/components';
import { AdminPopupStore } from '../../../shared/ui/context/stores/admin-popup.store';
import { AdminWorkspaceStore } from '../../../shared/ui/context/stores/admin-workspace.store';
import { NavigatorStore } from '../../../shared/ui/context/stores/navigator.store';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatRippleModule,
    NavigatorComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss'
})
export class AdminPageComponent implements OnInit, OnDestroy {
  protected readonly workspace = inject(AdminWorkspaceStore);
  protected readonly adminPopup = inject(AdminPopupStore);
  protected readonly sessionService = inject(SessionService);
  private readonly workspaceData = inject(AdminWorkspaceDataService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly navigatorStore = inject(NavigatorStore);
  private readonly popupCtx = inject(AppPopupContext);
  private lastHandledAdminRequestMs = 0;
  private readonly reportsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly feedbackPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly helpEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly ideaEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly notificationsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly paramsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly statsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly affinityGraphPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly monitoringPopupComponentRef = signal<Type<unknown> | null>(null);

  protected readonly restoringWorkspace = signal(this.currentRouteIsWorkspace());
  protected readonly reportsPopupComponent = this.reportsPopupComponentRef.asReadonly();
  protected readonly feedbackPopupComponent = this.feedbackPopupComponentRef.asReadonly();
  protected readonly helpEditorPopupComponent = this.helpEditorPopupComponentRef.asReadonly();
  protected readonly ideaEditorPopupComponent = this.ideaEditorPopupComponentRef.asReadonly();
  protected readonly notificationsPopupComponent = this.notificationsPopupComponentRef.asReadonly();
  protected readonly paramsPopupComponent = this.paramsPopupComponentRef.asReadonly();
  protected readonly statsPopupComponent = this.statsPopupComponentRef.asReadonly();
  protected readonly affinityGraphPopupComponent = this.affinityGraphPopupComponentRef.asReadonly();
  protected readonly monitoringPopupComponent = this.monitoringPopupComponentRef.asReadonly();

  constructor() {
    this.document.documentElement.classList.add('admin-document-no-scroll');
    this.document.body.classList.add('admin-document-no-scroll');

    effect(() => {
      switch (this.adminPopup.activePopup()) {
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
        case 'affinity-graph':
          void this.ensureAffinityGraphPopupLoaded();
          break;
        case 'monitoring':
          void this.ensureMonitoringPopupLoaded();
          break;
      }
    });

    effect(() => {
      const request = this.popupCtx.popupStore.adminNavigatorRequest();
      if (!request || request.updatedMs <= this.lastHandledAdminRequestMs) {
        return;
      }
      this.lastHandledAdminRequestMs = request.updatedMs;
      this.popupCtx.popupStore.clearAdminNavigatorRequest();
      switch (request.popup) {
        case 'reports':
          this.adminPopup.openReports(this.workspace.dashboard()?.reportedUsers[0] ?? null);
          break;
        case 'feedback':
          this.adminPopup.openFeedback();
          break;
        case 'chat':
          this.popupCtx.popupStore.openNavigatorActivitiesRequest('chats', undefined, { adminServiceOnly: true });
          break;
        case 'profile':
          this.navigatorStore.openProfileEditor();
          break;
        case 'help-editor':
          this.adminPopup.openHelpEditor();
          break;
        case 'idea-editor':
          this.adminPopup.openIdeaEditor();
          break;
        case 'notifications':
          this.adminPopup.openNotifications();
          break;
        case 'params':
          this.adminPopup.openParams();
          break;
        case 'stats':
          this.adminPopup.openStats();
          break;
        case 'affinity-graph':
          this.adminPopup.openAffinityGraph();
          break;
        case 'monitoring':
          this.adminPopup.openMonitoring();
          break;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.isFirebaseAdminMode && !this.workspace.dashboard()) {
      const session = await this.sessionService.ensureSession();
      if (session?.kind === 'firebase') {
        this.restoringWorkspace.set(true);
        const dashboard = await this.bootstrapAdmin();
        this.restoringWorkspace.set(false);
        if (dashboard) {
          await this.router.navigateByUrl('/admin/workspace', { replaceUrl: true });
          return;
        }
      }
    }
    if (!this.isWorkspaceRoute() || this.workspace.dashboard()) {
      this.restoringWorkspace.set(false);
      return;
    }
    this.restoringWorkspace.set(true);
    const restored = await this.restoreAdminSession();
    this.restoringWorkspace.set(false);
    if (!restored) {
      await this.router.navigateByUrl('/admin', { replaceUrl: true });
    }
  }

  ngOnDestroy(): void {
    this.document.documentElement.classList.remove('admin-document-no-scroll');
    this.document.body.classList.remove('admin-document-no-scroll');
  }

  protected async requestAdminLogin(): Promise<void> {
    if (!this.isFirebaseAdminMode) {
      this.openAdminSelector();
      return;
    }
    const session = await this.sessionService.startFirebaseSession();
    if (!session) {
      return;
    }
    const dashboard = await this.bootstrapAdmin();
    if (dashboard) {
      await this.router.navigateByUrl('/admin/workspace', { replaceUrl: true });
      return;
    }
    if (this.workspace.accessDenied()) {
      await this.router.navigateByUrl('/admin', { replaceUrl: true });
    }
  }

  protected get isFirebaseAdminMode(): boolean {
    return this.workspaceData.isFirebaseAdminMode;
  }

  private prepareSelectedAdminSession(adminUserId: string): void {
    const normalizedAdminUserId = this.workspace.prepareSelectedAdminSession(adminUserId);
    if (!normalizedAdminUserId) {
      return;
    }
    this.workspaceData.prepareSelectedAdminSession(normalizedAdminUserId);
  }

  private async restoreAdminSession(): Promise<boolean> {
    const adminId = this.workspace.readStoredAdminId();
    if (!adminId) {
      return false;
    }
    try {
      if (this.isFirebaseAdminMode) {
        const session = await this.sessionService.ensureSession();
        if (session?.kind !== 'firebase') {
          this.clearAdminSession();
          return false;
        }
      }
      this.prepareSelectedAdminSession(adminId);
      return Boolean(await this.bootstrapAdmin(adminId));
    } catch {
      this.clearAdminSession();
      return false;
    }
  }

  private async bootstrapAdmin(
    adminUserId?: string,
    onProgress?: (state: AdminBootstrapProcessState) => void
  ): Promise<AdminDashboardDto | null> {
    if (this.workspace.busy()) {
      return this.workspace.dashboard();
    }
    this.workspace.setBusy(true);
    this.workspace.clearError();
    this.workspace.setAccessDenied(false);
    try {
      const dashboard = this.workspace.applyDashboard(await this.workspaceData.loadDashboard(adminUserId, onProgress));
      await this.refreshAdminMenuCountersFromUserRecord(dashboard.activeAdmin.id);
      void this.helpCenter.preloadAll();
      this.workspace.persistAdminSession(dashboard.activeAdmin.id);
      return dashboard;
    } catch (error) {
      if (this.workspace.isAdminAccessDenied(error)) {
        this.handleAdminAccessDenied();
        return null;
      }
      this.workspace.setError(this.workspace.adminErrorMessage(error));
      return null;
    } finally {
      this.workspace.setBusy(false);
    }
  }

  private clearAdminSession(): void {
    this.workspace.clearAdminSessionState();
  }

  private handleAdminAccessDenied(): void {
    const session = this.sessionService.currentSession();
    this.workspace.handleAdminAccessDeniedState(session?.kind === 'firebase' ? session.profile.id.trim() : '');
  }

  private async refreshAdminMenuCountersFromUserRecord(adminUserId: string): Promise<void> {
    try {
      const counters = await this.workspaceData.loadDashboardMenuCounters(adminUserId);
      if (counters) {
        this.workspace.applyAdminMenuCounters(adminUserId, counters);
      }
    } catch {
      // The periodic user counter poll keeps the admin menu in sync if the first read is unavailable.
    }
  }

  private openAdminSelector(): void {
    this.popupCtx.popupStore.openDemoBootstrapSelector({
      mode: 'admin',
      title: 'Select admin user',
      subtitle: 'Login disabled mode. Choose an admin user to open moderation data.',
      onSelect: adminUserId => this.openSelectedAdmin(adminUserId)
    });
  }

  private openSelectedAdmin(adminUserId: string): boolean {
    const normalizedAdminUserId = adminUserId.trim();
    if (!normalizedAdminUserId) {
      return false;
    }
    this.prepareSelectedAdminSession(normalizedAdminUserId);
    void this.navigateToAdminWorkspaceAfterSelectorClose();
    return true;
  }

  private async navigateToAdminWorkspaceAfterSelectorClose(): Promise<void> {
    await this.waitForDemoSelectorClose();
    await this.router.navigateByUrl('/admin/workspace', { replaceUrl: true });
  }

  private waitForDemoSelectorClose(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        return;
      }
      setTimeout(resolve, 0);
    });
  }

  @HostListener('window:adminLogoutRequested')
  protected onAdminLogoutRequested(): void {
    this.clearAdminSession();
  }

  @HostListener('window:adminAccessDenied')
  protected onAdminAccessDenied(): void {
    this.handleAdminAccessDenied();
    if (this.router.url.split('?')[0].startsWith('/admin')) {
      void this.router.navigateByUrl('/admin', { replaceUrl: true });
    }
  }

  private isWorkspaceRoute(): boolean {
    return this.currentRouteIsWorkspace();
  }

  private currentRouteIsWorkspace(): boolean {
    return this.router.url.split('?')[0] === '/admin/workspace';
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

  private async ensureAffinityGraphPopupLoaded(): Promise<void> {
    if (this.affinityGraphPopupComponentRef()) {
      return;
    }
    const module = await import('../affinity-graph-popup/admin-affinity-graph-popup.component');
    this.affinityGraphPopupComponentRef.set(module.AdminAffinityGraphPopupComponent);
  }

  private async ensureMonitoringPopupLoaded(): Promise<void> {
    if (this.monitoringPopupComponentRef()) {
      return;
    }
    const module = await import('../monitoring-popup/admin-monitoring-popup.component');
    this.monitoringPopupComponentRef.set(module.AdminMonitoringPopupComponent);
  }

}

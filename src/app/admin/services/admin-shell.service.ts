import { Injectable, inject, signal } from '@angular/core';

import { AppPopupContext } from '../../shared/ui';
import { type AdminReportedUserDto, type AdminReportDto } from '../../shared/core';

export type AdminPopupKind =
  | 'reports'
  | 'feedback'
  | 'chat'
  | 'chat-review'
  | 'warn-chat'
  | 'help-editor'
  | 'idea-editor'
  | 'notifications'
  | 'params'
  | 'stats'
  | 'affinity-graph'
  | 'monitoring'
  | 'item-preview';

@Injectable({
  providedIn: 'root'
})
export class AdminShellService {
  private readonly popupCtx = inject(AppPopupContext);
  private readonly activePopupRef = signal<AdminPopupKind | null>(null);
  private readonly selectedReportedUserRef = signal<AdminReportedUserDto | null>(null);
  private readonly selectedReportRef = signal<AdminReportDto | null>(null);

  readonly activePopup = this.activePopupRef.asReadonly();
  readonly selectedReportedUser = this.selectedReportedUserRef.asReadonly();
  readonly selectedReport = this.selectedReportRef.asReadonly();

  openReports(user?: AdminReportedUserDto | null): void {
    const resolvedUser = user ?? null;
    this.selectedReportedUserRef.set(resolvedUser);
    this.selectedReportRef.set(resolvedUser?.reports[0] ?? null);
    this.activePopupRef.set('reports');
  }

  openFeedback(): void {
    this.activePopupRef.set('feedback');
  }

  openChat(): void {
    this.popupCtx.openNavigatorActivitiesRequest('chats', undefined, { adminServiceOnly: true });
  }

  openHelpEditor(): void {
    this.activePopupRef.set('help-editor');
  }

  openIdeaEditor(): void {
    this.activePopupRef.set('idea-editor');
  }

  openNotifications(): void {
    this.activePopupRef.set('notifications');
  }

  openParams(): void {
    this.activePopupRef.set('params');
  }

  openStats(): void {
    this.activePopupRef.set('stats');
  }

  openAffinityGraph(): void {
    this.activePopupRef.set('affinity-graph');
  }

  openMonitoring(): void {
    this.activePopupRef.set('monitoring');
  }

  openReportDetail(user: AdminReportedUserDto, report: AdminReportDto): void {
    this.selectedReportedUserRef.set(user);
    this.selectedReportRef.set(report);
  }

  openChatReview(report: AdminReportDto): void {
    this.selectedReportRef.set(report);
    this.activePopupRef.set('chat-review');
  }

  openWarnChat(user: AdminReportedUserDto): void {
    this.selectedReportedUserRef.set(user);
    this.activePopupRef.set('warn-chat');
  }

  openItemPreview(report: AdminReportDto): void {
    this.selectedReportRef.set(report);
    this.activePopupRef.set('item-preview');
  }

  setSelectedReportedUser(user: AdminReportedUserDto | null): void {
    this.selectedReportedUserRef.set(user);
  }

  closePopup(): void {
    this.activePopupRef.set(null);
  }

  clear(): void {
    this.activePopupRef.set(null);
    this.selectedReportedUserRef.set(null);
    this.selectedReportRef.set(null);
  }
}

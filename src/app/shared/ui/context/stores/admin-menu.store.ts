import { Injectable, signal } from '@angular/core';

import { type AdminReportedUserDto, type AdminReportDto } from '../../../core';

export type AdminMenuKind =
  | 'reports'
  | 'feedback'
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
export class AdminMenuStore {
  private readonly activePopupRef = signal<AdminMenuKind | null>(null);
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

  openWarnChat(user: AdminReportedUserDto, report?: AdminReportDto | null): void {
    this.selectedReportedUserRef.set(user);
    if (report) {
      this.selectedReportRef.set(report);
    }
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

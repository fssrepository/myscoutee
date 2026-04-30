import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import {
  CounterBadgePipe,
  SmartListComponent,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../shared/ui';
import { ConfirmationDialogService } from '../../shared/ui/services/confirmation-dialog.service';
import { AdminService, type AdminReportedUserDto, type AdminReportDto } from '../admin.service';

@Component({
  selector: 'app-admin-reports-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent, CounterBadgePipe],
  templateUrl: './admin-reports-popup.component.html',
  styleUrl: './admin-popups.scss'
})
export class AdminReportsPopupComponent {
  protected readonly admin = inject(AdminService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);

  protected itemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AdminReportedUserDto>>;

  @ViewChild('reportedUserTemplate', { read: TemplateRef })
  private set itemTemplate(value: TemplateRef<SmartListItemTemplateContext<AdminReportedUserDto>> | undefined) {
    this.itemTemplateRef = value;
  }

  protected readonly reportedUsersLoadPage: SmartListLoadPage<AdminReportedUserDto> =
    query => from(this.loadReportedUsers(query));

  protected readonly reportedUsersConfig: SmartListConfig<AdminReportedUserDto> = {
    pageSize: 20,
    defaultView: 'list',
    listLayout: 'stack',
    showStickyHeader: true,
    emptyLabel: 'No reported users',
    emptyDescription: 'Only users with reports are visible to admin moderation.',
    groupBy: () => 'Reported users',
    trackBy: (_index, item) => item.userId
  };

  protected selectUser(user: AdminReportedUserDto): void {
    this.admin.openReportDetail(user, user.reports[0]);
  }

  protected selectReport(user: AdminReportedUserDto, report: AdminReportDto): void {
    this.admin.openReportDetail(user, report);
  }

  protected reviewReport(report: AdminReportDto): void {
    if (report.sourceType === 'chat' || report.chatId) {
      this.admin.openChatReview(report);
      return;
    }
    this.admin.openItemPreview(report);
  }

  protected warnUser(user: AdminReportedUserDto): void {
    this.admin.openWarnChat(user);
  }

  protected blockUser(user: AdminReportedUserDto): void {
    this.confirmationDialog.open({
      title: `Block ${user.name}?`,
      message: 'The user will be blocked and a support chat message will be sent.',
      confirmLabel: 'Block',
      busyConfirmLabel: 'Blocking...',
      confirmTone: 'danger',
      onConfirm: () => this.admin.blockUser(
        user.userId,
        'Your account has been blocked after moderation review. You can reply here to contact MyScoutee support and ask for a review.'
      )
    });
  }

  protected isSelectedUser(user: AdminReportedUserDto): boolean {
    return this.admin.selectedReportedUser()?.userId === user.userId;
  }

  protected isSelectedReport(report: AdminReportDto): boolean {
    return this.admin.selectedReport()?.id === report.id;
  }

  private async loadReportedUsers(query: ListQuery): Promise<{ items: AdminReportedUserDto[]; total: number }> {
    const items = this.admin.dashboard()?.reportedUsers ?? [];
    const pageSize = Math.max(1, query.pageSize || 20);
    const page = Math.max(0, query.page || 0);
    const start = page * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length
    };
  }
}

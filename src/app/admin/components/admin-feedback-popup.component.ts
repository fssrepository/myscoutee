import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import {
  SmartListComponent,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../shared/ui';
import { AdminService, type AdminFeedbackDto } from '../admin.service';

@Component({
  selector: 'app-admin-feedback-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, SmartListComponent],
  templateUrl: './admin-feedback-popup.component.html',
  styleUrl: './admin-popups.scss'
})
export class AdminFeedbackPopupComponent {
  protected readonly admin = inject(AdminService);
  protected itemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AdminFeedbackDto>>;

  @ViewChild('feedbackTemplate', { read: TemplateRef })
  private set itemTemplate(value: TemplateRef<SmartListItemTemplateContext<AdminFeedbackDto>> | undefined) {
    this.itemTemplateRef = value;
  }

  protected readonly feedbackLoadPage: SmartListLoadPage<AdminFeedbackDto> =
    query => from(this.loadFeedback(query));

  protected readonly feedbackConfig: SmartListConfig<AdminFeedbackDto> = {
    pageSize: 20,
    defaultView: 'list',
    listLayout: 'stack',
    showStickyHeader: true,
    emptyLabel: 'No application feedback',
    groupBy: item => item.category || 'Feedback',
    trackBy: (_index, item) => item.id
  };

  private async loadFeedback(query: ListQuery): Promise<{ items: AdminFeedbackDto[]; total: number }> {
    const items = this.admin.dashboard()?.feedback ?? [];
    const pageSize = Math.max(1, query.pageSize || 20);
    const page = Math.max(0, query.page || 0);
    const start = page * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length
    };
  }
}

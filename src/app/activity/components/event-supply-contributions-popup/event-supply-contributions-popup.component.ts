import { CommonModule } from '@angular/common';
import { Component, DoCheck, Input, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { delay, from } from 'rxjs';
import type * as AppTypes from '../../../shared/core/base/models';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';

interface SupplyBringDialogState {
  title: string;
  min: number;
  max: number;
  quantity: number;
}

interface SupplyContributionListFilters {
  revision?: number;
  contextKey?: string;
  showProgress?: boolean;
}

export interface EventSupplyContributionsPopupHost {
  title(): string;
  subtitle(): string;
  summary(): string;
  rows(): AppTypes.SubEventSupplyContributionRow[];
  loadRowsPage(query: ListQuery<SupplyContributionListFilters>): Promise<PageResult<AppTypes.SubEventSupplyContributionRow>>;
  bringDialog(): SupplyBringDialogState | null;
  pendingDelete(): { label: string; busy?: boolean; error?: string | null } | null;
  close(): void;
  openBringDialog(event?: Event): void;
  addedLabel(addedAtIso: string): string;
  quantityLabel(quantity: number): string;
  canDelete(row: AppTypes.SubEventSupplyContributionRow): boolean;
  requestDelete(row: AppTypes.SubEventSupplyContributionRow, event?: Event): void;
  cancelBringDialog(): void;
  canSubmitBringDialog(): boolean;
  onBringQuantityChange(value: number | string): void;
  confirmBringDialog(event?: Event): void;
  cancelDelete(): void;
  pendingDeleteLabel(): string;
  deleteConfirmRingPerimeter(): number;
  isDeletePending(): boolean;
  deleteErrorMessage(): string;
  confirmDelete(): void;
}

@Component({
  selector: 'app-event-supply-contributions-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    SmartListComponent
  ],
  templateUrl: './event-supply-contributions-popup.component.html',
  styleUrls: ['./event-supply-contributions-popup.component.scss']
})
export class EventSupplyContributionsPopupComponent implements DoCheck {
  private lastRowsSignature = '';

  @Input({ required: true }) host!: EventSupplyContributionsPopupHost;

  protected supplyContributionSmartListQuery: Partial<ListQuery<SupplyContributionListFilters>> = {
    filters: {
      revision: 0,
      contextKey: '',
      showProgress: true
    }
  };

  protected supplyContributionItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AppTypes.SubEventSupplyContributionRow, SupplyContributionListFilters>
  >;

  @ViewChild('supplyContributionItemTemplate', { read: TemplateRef })
  private set supplyContributionItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventSupplyContributionRow, SupplyContributionListFilters>> | undefined
  ) {
    this.supplyContributionItemTemplateRef = value;
  }

  protected readonly supplyContributionSmartListLoadPage: SmartListLoadPage<
    AppTypes.SubEventSupplyContributionRow,
    SupplyContributionListFilters
  > = (query) => from(this.host.loadRowsPage(query)).pipe(
    delay(query.filters?.showProgress ? 1500 : 0)
  );

  protected readonly supplyContributionSmartListConfig: SmartListConfig<
    AppTypes.SubEventSupplyContributionRow,
    SupplyContributionListFilters
  > = {
    pageSize: 12,
    loadingDelayMs: 0,
    loadingWindowMs: 3000,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No quantity added yet',
    emptyDescription: 'Use the + button in the header to add your quantity row.',
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'subevent-supply-contribution-list': true
    },
    trackBy: (_index, row) => row.id
  };

  ngDoCheck(): void {
    const rows = this.host?.rows?.() ?? [];
    const contextKey = `${this.host?.title?.() ?? ''}:${this.host?.subtitle?.() ?? ''}`;
    const showProgress = this.lastRowsSignature === '';
    const signature = `${contextKey}:${rows.map(row => [
      row.id,
      row.userId,
      row.quantity,
      row.addedAtIso
    ].join(':')).join('|')}`;
    if (signature === this.lastRowsSignature) {
      return;
    }
    this.lastRowsSignature = signature;
    this.supplyContributionSmartListQuery = {
      filters: {
        revision: Date.now(),
        contextKey,
        showProgress
      }
    };
  }
}

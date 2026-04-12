
import { Component, DoCheck, Input, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { delay, from } from 'rxjs';
import type * as AppTypes from '../../../shared/core/base/models';
import { resolveCurrentDemoDelayMs } from '../../../shared/core/base/services/route-delay.service';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';

interface SupplyBringDialogState {
  title: string;
  min: number;
  max: number;
  quantity: number;
  busy: boolean;
  error: string | null;
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
  bringConfirmRingPerimeter(): number;
  isBringPending(): boolean;
  bringErrorMessage(): string;
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
  private lastContextKey = '';
  private lastRowCount = 0;
  private supplyContributionListReady = false;
  private supplyContributionListVisibleCount = 0;

  @Input({ required: true }) host!: EventSupplyContributionsPopupHost;

  protected supplyContributionSmartListQuery: Partial<ListQuery<SupplyContributionListFilters>> = {
    filters: {
      revision: 0,
      contextKey: '',
      showProgress: true
    }
  };

  @ViewChild('supplyContributionSmartList')
  private supplyContributionSmartList?: SmartListComponent<AppTypes.SubEventSupplyContributionRow, SupplyContributionListFilters>;

  protected supplyContributionItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AppTypes.SubEventSupplyContributionRow, SupplyContributionListFilters>
  >;

  @ViewChild('supplyContributionItemTemplate', { read: TemplateRef, static: true })
  private set supplyContributionItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventSupplyContributionRow, SupplyContributionListFilters>> | undefined
  ) {
    this.supplyContributionItemTemplateRef = value;
  }

  protected readonly supplyContributionSmartListLoadPage: SmartListLoadPage<
    AppTypes.SubEventSupplyContributionRow,
    SupplyContributionListFilters
  > = query => from(this.host.loadRowsPage(query)).pipe(
    delay(resolveCurrentDemoDelayMs(query.filters?.showProgress ? 1500 : 0))
  );

  protected readonly supplyContributionSmartListConfig: SmartListConfig<
    AppTypes.SubEventSupplyContributionRow,
    SupplyContributionListFilters
  > = {
    pageSize: 12,
    loadingDelayMs: resolveCurrentDemoDelayMs(1500),
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
    const signature = `${contextKey}:${rows.map(row => [
      row.id,
      row.userId,
      row.quantity,
      row.addedAtIso
    ].join(':')).join('|')}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      this.lastRowsSignature = signature;
      this.lastRowCount = rows.length;
      this.supplyContributionListReady = false;
      this.supplyContributionListVisibleCount = 0;
      this.supplyContributionSmartListQuery = {
        filters: {
          revision: Date.now(),
          contextKey,
          showProgress: true
        }
      };
      return;
    }

    if (signature === this.lastRowsSignature) {
      return;
    }

    const previousRowCount = this.lastRowCount;
    this.lastRowsSignature = signature;
    this.lastRowCount = rows.length;
    this.syncSupplyContributionVisibleRows(rows, previousRowCount);
  }

  protected onSupplyContributionSmartListStateChange(
    change: SmartListStateChange<AppTypes.SubEventSupplyContributionRow, SupplyContributionListFilters>
  ): void {
    this.supplyContributionListVisibleCount = change.items.length;
    this.supplyContributionListReady = !change.initialLoading;
    if (!this.supplyContributionListReady) {
      return;
    }
    const rows = this.host?.rows?.() ?? [];
    if (change.total !== rows.length) {
      this.syncSupplyContributionVisibleRows(rows, change.total);
    }
  }

  private syncSupplyContributionVisibleRows(
    rows: AppTypes.SubEventSupplyContributionRow[],
    previousRowCount: number
  ): void {
    if (!this.supplyContributionListReady || !this.supplyContributionSmartList) {
      return;
    }

    const visibleCount = Math.max(this.supplyContributionListVisibleCount, this.supplyContributionSmartList.itemsSnapshot().length);
    const allRowsWereVisible = visibleCount >= previousRowCount;
    let nextVisibleCount = Math.min(rows.length, visibleCount);

    if (rows.length > previousRowCount && allRowsWereVisible) {
      nextVisibleCount = Math.min(rows.length, visibleCount + 1);
    }

    this.supplyContributionSmartList.replaceVisibleItems(rows.slice(0, nextVisibleCount), {
      total: rows.length
    });
  }
}

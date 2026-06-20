import type * as AppDTOs from '../../../shared/core/base/dto';

import { Component, DoCheck, Input, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';
import {
  ProgressIndicatorComponent,
  SingleRowComponent,
  SmartListComponent,
  type CardMenuActionEvent,
  type ListQuery,
  type PageResult,
  type SingleRowData,
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
}

export interface EventSupplyContributionsPopupHost {
  title(): string;
  subtitle(): string;
  summary(): string;
  rows(): AppDTOs.SubEventSupplyContributionRowDTO[];
  loadRowsPage(query: ListQuery<SupplyContributionListFilters>): Promise<PageResult<AppDTOs.SubEventSupplyContributionRowDTO>>;
  bringDialog(): SupplyBringDialogState | null;
  pendingDelete(): { label: string; busy?: boolean; error?: string | null } | null;
  close(): void;
  openBringDialog(event?: Event): void;
  addedLabel(addedAtIso: string): string;
  quantityLabel(quantity: number): string;
  canDelete(row: AppDTOs.SubEventSupplyContributionRowDTO): boolean;
  requestDelete(row: AppDTOs.SubEventSupplyContributionRowDTO, event?: Event): void;
  cancelBringDialog(): void;
  canSubmitBringDialog(): boolean;
  onBringQuantityChange(value: number | string): void;
  confirmBringDialog(event?: Event): void;
  isBringPending(): boolean;
  bringErrorMessage(): string;
  cancelDelete(): void;
  pendingDeleteLabel(): string;
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
    ProgressIndicatorComponent,
    SingleRowComponent,
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
      contextKey: ''
    }
  };

  @ViewChild('supplyContributionSmartList')
  private supplyContributionSmartList?: SmartListComponent<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>;

  protected supplyContributionItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>
  >;

  @ViewChild('supplyContributionItemTemplate', { read: TemplateRef })
  private set supplyContributionItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>> | undefined
  ) {
    this.supplyContributionItemTemplateRef = value;
  }

  protected readonly supplyContributionSmartListLoadPage: SmartListLoadPage<
    AppDTOs.SubEventSupplyContributionRowDTO,
    SupplyContributionListFilters
  > = query => from(this.host.loadRowsPage(query));

  protected readonly supplyContributionSmartListConfig: SmartListConfig<
    AppDTOs.SubEventSupplyContributionRowDTO,
    SupplyContributionListFilters
  > = {
    pageSize: 12,
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
          contextKey
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
    change: SmartListStateChange<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>
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

  protected supplyContributionSingleRow(row: AppDTOs.SubEventSupplyContributionRowDTO): SingleRowData {
    return {
      id: row.id,
      title: `${row.name}, ${row.age} · ${row.city}`,
      subtitle: this.host.addedLabel(row.addedAtIso),
      avatarInitials: row.initials,
      avatarAriaLabel: row.name,
      sideLabel: this.host.quantityLabel(row.quantity),
      sideLabelTone: 'inverse',
      menuActions: this.host.canDelete(row) ? ['delete'] : [],
      eagerDetail: row
    };
  }

  protected onSupplyContributionMenuAction(
    row: AppDTOs.SubEventSupplyContributionRowDTO,
    event: CardMenuActionEvent<SingleRowData>
  ): void {
    if (event.actionId !== 'delete' || !this.host.canDelete(row)) {
      return;
    }
    this.host.requestDelete(row);
  }

  private syncSupplyContributionVisibleRows(
    rows: AppDTOs.SubEventSupplyContributionRowDTO[],
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

import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, ViewEncapsulation, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';

import { AssetFacadeService, type AssetTicketListFilters } from '../../asset-facade.service';
import { AssetPopupService } from '../../asset-popup.service';
import { OwnedAssetsPopupService } from '../../owned-assets-popup.service';
import { LazyBgImageDirective } from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import { AssetDeleteConfirmComponent } from '../asset-delete-confirm/asset-delete-confirm.component';
import { AssetFormPopupComponent } from '../asset-form-popup/asset-form-popup.component';
import { AssetBasketPopupComponent } from '../asset-basket-popup/asset-basket-popup.component';
import { AssetMemberPickerPopupComponent } from '../asset-member-picker-popup/asset-member-picker-popup.component';
import { AssetTicketCodePopupComponent } from '../asset-ticket-code-popup/asset-ticket-code-popup.component';
import { AssetTicketScannerPopupComponent } from '../asset-ticket-scanner-popup/asset-ticket-scanner-popup.component';
import {
  InfoCardComponent,
  SmartListComponent,
  type ListQuery,
  type SmartListConfig,
  type SmartListStateChange
} from '../../../shared/ui';

@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    InfoCardComponent,
    LazyBgImageDirective,
    SmartListComponent,
    AssetDeleteConfirmComponent,
    AssetFormPopupComponent,
    AssetBasketPopupComponent,
    AssetMemberPickerPopupComponent,
    AssetTicketCodePopupComponent,
    AssetTicketScannerPopupComponent
  ],
  templateUrl: './asset-popup.component.html',
  styleUrl: './asset-popup.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class AssetPopupComponent implements OnDestroy {
  private readonly assetFacade = inject(AssetFacadeService);
  protected readonly assetPopup = inject(AssetPopupService);
  protected readonly ownedAssets = inject(OwnedAssetsPopupService);
  protected readonly assetFilterOpen = signal(false);
  protected readonly retryTicketScanner = (event?: Event): void => this.assetPopup.retryTicketScanner(event);
  protected readonly closeOwnedAssetForm = (): void => this.ownedAssets.closeAssetForm();
  protected readonly saveOwnedAssetCard = (): void => this.ownedAssets.saveAssetCard();
  protected readonly setOwnedAssetFormRouteStop = (index: number, value: string): void =>
    this.ownedAssets.setAssetFormRouteStop(index, value);
  protected readonly openOwnedAssetFormRouteStopMap = (index: number, event?: Event): void =>
    this.ownedAssets.openAssetFormRouteStopMap(index, event);
  protected readonly refreshOwnedAssetFromSourceLink = (): void => this.ownedAssets.refreshAssetFromSourceLink();
  protected readonly onOwnedAssetImageFileSelected = (file: File): void => this.ownedAssets.applyAssetImageFile(file);
  protected readonly cancelOwnedAssetDelete = (): void => this.ownedAssets.cancelAssetDelete();
  protected readonly confirmOwnedAssetDelete = (): void => this.ownedAssets.confirmAssetDelete();
  protected ticketSmartListQuery: Partial<ListQuery<AssetTicketListFilters>> = {};

  protected readonly ticketSmartListLoadPage = (query: ListQuery<AssetTicketListFilters>) =>
    from(this.assetFacade.loadTicketPage(query));
  protected readonly ticketSmartListConfig: SmartListConfig<AppTypes.ActivityListRow, AssetTicketListFilters> = {
    pageSize: 18,
    loadingDelayMs: 0,
    defaultView: 'list',
    emptyLabel: 'No ticketed events',
    emptyDescription: 'Enable Ticketing On in an event to generate a ticket here.',
    emptyStickyLabel: 'No tickets',
    headerProgress: {
      enabled: true
    },
    showStickyHeader: true,
    stickyHeaderClass: 'activities-sticky-header',
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.8rem',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'activities-scroll-list': true,
      'activities-scroll-list-event-snap': true,
      'tickets-scroll-list': true
    },
    trackBy: (_index, row) => `${row.type}:${row.id}`,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: row => this.assetFacade.ticketGroupLabel(row.dateIso)
  };

  constructor() {
    effect(() => {
      this.ticketSmartListQuery = {
        filters: {
          userId: this.assetFacade.activeUserId(),
          order: this.assetPopup.ticketDateOrder()
        }
      };
    });
  }

  protected ticketInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ) {
    return this.assetFacade.ticketInfoCard(row, options);
  }

  protected onTicketScannerVideoElementChange(element: HTMLVideoElement | null): void {
    this.assetPopup.setTicketScannerVideoElement(element);
  }

  protected onTicketSmartListStateChange(change: SmartListStateChange<AppTypes.ActivityListRow, AssetTicketListFilters>): void {
    this.assetPopup.updateTicketListState(change);
  }

  protected openTicketSource(row: AppTypes.ActivityListRow): void {
    const sourceLink = this.assetFacade.ticketSourceLink(row);
    if (!sourceLink || typeof window === 'undefined') {
      return;
    }
    window.open(sourceLink, '_blank', 'noopener');
  }

  protected onAssetFilterMenuOpenChange(isOpen: boolean): void {
    this.assetFilterOpen.set(isOpen);
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.assetPopup.ticketOverlayMode()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.assetPopup.closeTicketOverlay();
      return;
    }
    if (this.ownedAssets.isPopupOpen()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.ownedAssets.closePopup();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest('.item-action-menu') || target.closest('.experience-action-menu-trigger')) {
      return;
    }
    this.ownedAssets.closeAssetItemActionMenu();
  }

  ngOnDestroy(): void {
    this.assetPopup.setTicketScannerVideoElement(null);
  }
}

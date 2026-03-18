import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { AssetPopupService } from '../../asset-popup.service';
import type { AssetPopupHost } from '../../asset-popup.host';
import { OwnedAssetsPopupService } from '../../owned-assets-popup.service';
import { LazyBgImageDirective } from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import { AssetDeleteConfirmComponent } from '../asset-delete-confirm/asset-delete-confirm.component';
import { AssetFormPopupComponent } from '../asset-form-popup/asset-form-popup.component';
import { AssetBasketPopupComponent } from '../asset-basket-popup/asset-basket-popup.component';
import { AssetMemberPickerPopupComponent } from '../asset-member-picker-popup/asset-member-picker-popup.component';
import { AssetTicketCodePopupComponent } from '../asset-ticket-code-popup/asset-ticket-code-popup.component';
import { AssetTicketScannerPopupComponent } from '../asset-ticket-scanner-popup/asset-ticket-scanner-popup.component';

@Component({
  selector: 'app-asset-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    LazyBgImageDirective,
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

  @ViewChild('ticketScroll')
  protected set ticketScrollRef(ref: ElementRef<HTMLDivElement> | undefined) {
    this.assetPopup.setTicketScrollElement(ref?.nativeElement ?? null);
  }

  protected trackByActivityGroup = (_index: number, group: AppTypes.ActivityGroup): string => group.label;

  protected trackByActivityRow = (_index: number, row: AppTypes.ActivityListRow): string => `${row.type}:${row.id}`;

  protected ticketRowImageUrl(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.activityImageUrl(row) ?? '';
  }

  protected ticketRowSourceLink(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.activitySourceLink(row) ?? '';
  }

  protected ticketRowSourceAvatarClass(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.activitySourceAvatarClass(row) ?? '';
  }

  protected ticketRowSourceAvatarLabel(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.activitySourceAvatarLabel(row) ?? this.fallbackTicketRowAvatarLabel(row);
  }

  protected ticketRowLeadingIconCircleClass(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.activityLeadingIconCircleClass(row) ?? '';
  }

  protected ticketRowLeadingIcon(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.activityLeadingIcon(row) ?? 'confirmation_number';
  }

  protected ticketCardMetaLine(row: AppTypes.ActivityListRow): string {
    return this.currentHost()?.ticketCardMetaLine(row) ?? row.detail ?? '';
  }

  protected onTicketScannerVideoElementChange(element: HTMLVideoElement | null): void {
    this.assetPopup.setTicketScannerVideoElement(element);
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
    this.assetPopup.setTicketScrollElement(null);
    this.assetPopup.setTicketScannerVideoElement(null);
  }

  private currentHost(): AssetPopupHost | null {
    return this.assetPopup.host();
  }

  private fallbackTicketRowAvatarLabel(row: AppTypes.ActivityListRow): string {
    const words = row.title.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return 'T';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }
}

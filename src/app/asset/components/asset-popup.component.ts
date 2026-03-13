import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { AssetPopupService } from '../asset-popup.service';
import { LazyBgImageDirective } from '../../shared/lazy-bg-image.directive';
import type * as AppTypes from '../../shared/app-types';
import { AssetDeleteConfirmComponent } from './asset-delete-confirm.component';
import { AssetFormPopupComponent } from './asset-form-popup.component';
import { AssetBasketPopupComponent } from './asset-basket-popup.component';
import { AssetMemberPickerPopupComponent } from './asset-member-picker-popup.component';
import { AssetTicketCodePopupComponent } from './asset-ticket-code-popup.component';
import { AssetTicketScannerPopupComponent } from './asset-ticket-scanner-popup.component';

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
  protected readonly assetFilterOpen = signal(false);
  protected readonly retryTicketScanner = (event?: Event): void => this.assetPopup.retryTicketScanner(event);

  @ViewChild('ticketScroll')
  protected set ticketScrollRef(ref: ElementRef<HTMLDivElement> | undefined) {
    this.assetPopup.setTicketScrollElement(ref?.nativeElement ?? null);
  }

  protected trackByActivityGroup = (_index: number, group: AppTypes.ActivityGroup): string => group.label;

  protected trackByActivityRow = (_index: number, row: AppTypes.ActivityListRow): string => `${row.type}:${row.id}`;

  protected onTicketScannerVideoElementChange(element: HTMLVideoElement | null): void {
    this.assetPopup.setTicketScannerVideoElement(element);
  }

  protected onAssetFilterMenuOpenChange(isOpen: boolean): void {
    this.assetFilterOpen.set(isOpen);
  }

  ngOnDestroy(): void {
    this.assetPopup.setTicketScrollElement(null);
    this.assetPopup.setTicketScannerVideoElement(null);
  }
}

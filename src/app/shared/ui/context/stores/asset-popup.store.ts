import { Injectable, Type, computed, signal } from '@angular/core';

import type * as AssetContracts from '../../../core/contracts/asset.interface';

export type AssetTicketScanMode = 'ticketCode' | 'ticketScanner';
export type AssetTicketScannerState = 'idle' | 'reading' | 'success';

@Injectable({
  providedIn: 'root'
})
export class AssetPopupStore {
  readonly primaryVisibleRef = signal(false);
  readonly stackedVisibleRef = signal(false);
  readonly basketVisibleRef = signal(false);
  readonly ticketScanModeRef = signal<AssetTicketScanMode | null>(null);
  readonly ticketRowsRef = signal<AssetContracts.AssetTicketDTO[]>([]);
  readonly ticketTotalCountRef = signal(0);
  readonly ticketDateOrderRef = signal<'upcoming' | 'past'>('upcoming');
  readonly selectedTicketRowRef = signal<AssetContracts.AssetTicketDTO | null>(null);
  readonly selectedTicketCodeValueRef = signal('');
  readonly ticketScannerStateRef = signal<AssetTicketScannerState>('idle');
  readonly ticketScannerResultRef = signal<AssetContracts.TicketScanPayloadDTO | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetMemberPickerPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly visible = computed(() =>
    this.primaryVisibleRef()
    || this.stackedVisibleRef()
    || this.basketVisibleRef()
    || this.ticketScanModeRef() !== null
  );
  readonly ticketScanMode = this.ticketScanModeRef.asReadonly();
  readonly selectedTicketRow = this.selectedTicketRowRef.asReadonly();
  readonly ticketScannerState = this.ticketScannerStateRef.asReadonly();
  readonly ticketScannerResult = this.ticketScannerResultRef.asReadonly();
  readonly ticketDateOrder = this.ticketDateOrderRef.asReadonly();
  readonly assetPopupComponent = this.assetPopupComponentRef.asReadonly();
  readonly assetMemberPickerPopupComponent = this.assetMemberPickerPopupComponentRef.asReadonly();
  readonly ticketHeaderSummary = computed(() => {
    const count = this.ticketTotalCountRef();
    return count === 1 ? '1 ticketed event' : `${count} ticketed events`;
  });
  readonly ticketDateOrderLabel = computed(() => this.ticketDateOrderRef() === 'upcoming' ? 'Upcoming' : 'Past');
  readonly ticketDateOrderIcon = computed(() => this.ticketDateOrderRef() === 'upcoming' ? 'schedule' : 'history');

  prepareTicketPopupOpen(totalCount: number): void {
    this.ticketRowsRef.set([]);
    this.ticketTotalCountRef.set(this.normalizedCount(totalCount));
    this.clearTicketSelection();
  }

  resetTicketState(): void {
    this.ticketRowsRef.set([]);
    this.ticketTotalCountRef.set(0);
    this.clearTicketSelection();
  }

  selectTicketDateOrder(order: 'upcoming' | 'past', totalCount: number): boolean {
    if (this.ticketDateOrderRef() === order) {
      return false;
    }
    this.ticketDateOrderRef.set(order);
    this.ticketRowsRef.set([]);
    this.ticketTotalCountRef.set(this.normalizedCount(totalCount));
    return true;
  }

  updateTicketList(items: readonly AssetContracts.AssetTicketDTO[], total: number): void {
    this.ticketRowsRef.set([...items]);
    this.ticketTotalCountRef.set(this.normalizedCount(total));
  }

  openTicketCode(row: AssetContracts.AssetTicketDTO, encodedPayload: string): void {
    this.selectedTicketRowRef.set(row);
    this.selectedTicketCodeValueRef.set(encodedPayload);
    this.ticketScannerResultRef.set(null);
    this.ticketScannerStateRef.set('idle');
    this.ticketScanModeRef.set('ticketCode');
  }

  openTicketScanner(): void {
    this.ticketScannerStateRef.set('reading');
    this.ticketScannerResultRef.set(null);
    this.ticketScanModeRef.set('ticketScanner');
  }

  closeTicketScan(): void {
    this.clearTicketSelection();
  }

  retryTicketScanner(): void {
    this.ticketScannerStateRef.set('reading');
    this.ticketScannerResultRef.set(null);
  }

  applyTicketScannerSuccess(payload: AssetContracts.TicketScanPayloadDTO): void {
    this.ticketScannerResultRef.set(payload);
    this.ticketScannerStateRef.set('success');
  }

  applyTicketScannerIdle(): void {
    this.ticketScannerResultRef.set(null);
    this.ticketScannerStateRef.set('idle');
  }

  async ensureAssetPopupLoaded(): Promise<void> {
    if (this.assetPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../asset/components/asset-popup/asset-popup.component');
    this.assetPopupComponentRef.set(module.AssetPopupComponent);
  }

  async ensureAssetMemberPickerPopupLoaded(): Promise<void> {
    if (this.assetMemberPickerPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../asset/components/asset-member-picker-popup/asset-member-picker-popup.component');
    this.assetMemberPickerPopupComponentRef.set(module.AssetMemberPickerPopupComponent);
  }

  private clearTicketSelection(): void {
    this.selectedTicketRowRef.set(null);
    this.selectedTicketCodeValueRef.set('');
    this.ticketScannerStateRef.set('idle');
    this.ticketScannerResultRef.set(null);
    this.ticketScanModeRef.set(null);
  }

  private normalizedCount(value: number): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }
}

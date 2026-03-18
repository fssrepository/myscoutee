import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type * as AppTypes from '../../../shared/core/base/models';

interface SupplyBringDialogState {
  title: string;
  min: number;
  max: number;
  quantity: number;
}

export interface EventSupplyContributionsPopupHost {
  title(): string;
  subtitle(): string;
  summary(): string;
  rows(): AppTypes.SubEventSupplyContributionRow[];
  bringDialog(): SupplyBringDialogState | null;
  pendingDelete(): { label: string } | null;
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
  confirmDelete(): void;
}

@Component({
  selector: 'app-event-supply-contributions-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './event-supply-contributions-popup.component.html',
  styleUrls: ['./event-supply-contributions-popup.component.scss']
})
export class EventSupplyContributionsPopupComponent {
  @Input({ required: true }) host!: EventSupplyContributionsPopupHost;
}

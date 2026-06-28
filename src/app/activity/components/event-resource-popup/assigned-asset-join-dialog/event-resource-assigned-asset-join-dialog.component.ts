import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type * as ActivityContracts from '../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../shared/core/contracts';
import { IndicatorComponent } from '../../../../shared/ui/components/core/indicator/indicator.component';

export interface AssignedAssetJoinDialogViewState {
  title: string;
  subtitle: string;
  timeframe: string;
  pathLabel: string;
  memberSummary: string;
  lineItems: ActivityContracts.EventCheckoutLineItem[];
  totalAmount: number;
  shareAmount: number;
  shareMemberCount: number;
  currency: string;
  shareLabel: string;
  shareHint: string;
  policies: ContractTypes.EventPolicyDTO[];
  acceptedPolicyIds: string[];
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
}

@Component({
  selector: 'app-event-resource-assigned-asset-join-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule, IndicatorComponent],
  templateUrl: './event-resource-assigned-asset-join-dialog.component.html',
  styleUrl: './event-resource-assigned-asset-join-dialog.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceAssignedAssetJoinDialogComponent {
  @Input() dialog: AssignedAssetJoinDialogViewState | null = null;

  @Output() closeRequested = new EventEmitter<Event | undefined>();
  @Output() policyToggled = new EventEmitter<string>();
  @Output() confirmRequested = new EventEmitter<Event | undefined>();

  protected formatMoney(amount: number, currency = 'USD'): string {
    switch ((currency || '').trim().toUpperCase()) {
      case 'EUR':
        return `EUR ${(Number(amount) || 0).toFixed(2)}`;
      case 'GBP':
        return `GBP ${(Number(amount) || 0).toFixed(2)}`;
      default:
        return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  protected canSubmit(dialog: AssignedAssetJoinDialogViewState): boolean {
    if (dialog.busy) {
      return false;
    }
    const acceptedPolicyIds = new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean));
    return !dialog.policies.some(policy => policy.required !== false && !acceptedPolicyIds.has(policy.id));
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.closeRequested.emit(event);
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    this.confirmRequested.emit(event);
  }
}

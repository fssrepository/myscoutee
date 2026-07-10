import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation, inject } from '@angular/core';

import type * as ActivityContracts from '../../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../../shared/core/contracts';
import { SubEventResourcePopupStore } from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupModel
} from '../../../../shared/ui/components/core/popup';

type AssignedAssetJoinActionId = 'join-cancel' | 'join-confirm';

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
  imports: [CommonModule, PopupComponent, AppMenuComponent],
  templateUrl: './event-resource-assigned-asset-join-dialog.component.html',
  styleUrl: './event-resource-assigned-asset-join-dialog.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceAssignedAssetJoinDialogComponent {
  @Input() dialog: AssignedAssetJoinDialogViewState | null = null;
  @Input() parentZIndex = 2600;

  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);

  protected joinPopupModel(dialog: AssignedAssetJoinDialogViewState): PopupModel {
    return {
      title: dialog.title,
      subtitle: dialog.subtitle,
      ariaLabel: dialog.title,
      closeAriaLabel: 'Close join request',
      closeOnBackdrop: !dialog.busy,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: event => this.close(event)
    };
  }

  protected joinPopupZIndex(): number {
    return this.parentZIndex + 100;
  }

  protected joinFooterMenuItems(
    dialog: AssignedAssetJoinDialogViewState
  ): readonly AppMenuItem<AssignedAssetJoinActionId>[] {
    const hasError = !dialog.busy && !!dialog.error;
    const submitLabel = dialog.busy ? dialog.busyLabel : dialog.submitLabel;
    return [
      {
        id: 'join-cancel',
        label: 'Cancel',
        layout: 'action',
        palette: 'neutral',
        disabled: dialog.busy,
        ariaLabel: 'Cancel'
      },
      {
        id: 'join-confirm',
        label: submitLabel,
        layout: 'action',
        palette: hasError ? 'danger' : 'blue',
        disabled: !this.canSubmit(dialog),
        ariaLabel: submitLabel,
        progress: dialog.busy || hasError
          ? {
              state: dialog.busy ? 'loading' : 'error',
              shape: 'button'
            }
          : null
      }
    ];
  }

  protected onJoinActionMenuSelect(event: AppMenuItemSelectEvent<AssignedAssetJoinActionId>): void {
    if (event.id === 'join-cancel') {
      this.close(event.sourceEvent);
      return;
    }
    this.confirm(event.sourceEvent);
  }

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
    this.resourcePopupStore.requestAssignedAssetJoinClose(event);
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.requestAssignedAssetJoinConfirm(event);
  }

  protected togglePolicy(policyId: string): void {
    this.resourcePopupStore.requestAssignedAssetJoinPolicyToggle(policyId);
  }
}

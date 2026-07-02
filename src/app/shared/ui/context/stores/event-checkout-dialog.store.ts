import { Injectable, signal } from '@angular/core';

import type { EventCheckoutSelection } from '../../../core/contracts/activity.interface';
import type { ActivityEventRecord } from '../../../core/contracts/activity.interface';
import type { ActivityPendingReason } from '../../../core/common/constants';

export interface EventCheckoutDialogConfig {
  mode: 'join' | 'invitation';
  userId: string;
  record: ActivityEventRecord;
  loading?: boolean;
  requiresApprovalBeforePayment?: boolean;
  approvalGranted?: boolean;
  pendingReason?: ActivityPendingReason;
  title?: string | null;
  subtitle?: string | null;
  confirmLabel?: string | null;
  busyConfirmLabel?: string | null;
  allowBackdropClose?: boolean;
  allowEscapeClose?: boolean;
  failureMessage?: string | null;
  onSubmit: (selection: EventCheckoutSelection) => void | Promise<void>;
}

export interface EventCheckoutDialogState {
  id: number;
  mode: 'join' | 'invitation';
  userId: string;
  record: ActivityEventRecord;
  loading: boolean;
  requiresApprovalBeforePayment: boolean;
  approvalGranted: boolean;
  pendingReason: ActivityPendingReason;
  title: string;
  subtitle: string;
  confirmLabel: string;
  busyConfirmLabel: string;
  allowBackdropClose: boolean;
  allowEscapeClose: boolean;
  failureMessage: string;
  onSubmit: (selection: EventCheckoutSelection) => void | Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class EventCheckoutDialogStore {
  private readonly stateRef = signal<EventCheckoutDialogState | null>(null);
  private nextId = 0;

  readonly dialog = this.stateRef.asReadonly();

  open(config: EventCheckoutDialogConfig): EventCheckoutDialogState | null {
    const trimmedUserId = config.userId.trim();
    if (!trimmedUserId) {
      return null;
    }

    const state: EventCheckoutDialogState = {
      id: ++this.nextId,
      mode: config.mode,
      userId: trimmedUserId,
      record: config.record,
      loading: config.loading === true,
      requiresApprovalBeforePayment: config.requiresApprovalBeforePayment === true,
      approvalGranted: config.approvalGranted === true,
      pendingReason: config.pendingReason === 'waitlist'
        ? 'waitlist'
        : config.pendingReason === 'approval'
          ? 'approval'
          : null,
      title: config.title?.trim() || (config.mode === 'invitation' ? 'Accept Invitation' : 'Join Event'),
      subtitle: config.subtitle?.trim() || config.record.title,
      confirmLabel: config.confirmLabel?.trim() || 'Confirm',
      busyConfirmLabel: config.busyConfirmLabel?.trim() || 'Working...',
      allowBackdropClose: config.allowBackdropClose !== false,
      allowEscapeClose: config.allowEscapeClose !== false,
      failureMessage: config.failureMessage?.trim() || 'Unable to complete checkout.',
      onSubmit: config.onSubmit
    };
    this.stateRef.set(state);
    return state;
  }

  isCurrent(id: number | null | undefined): boolean {
    return id != null && this.stateRef()?.id === id;
  }

  close(): void {
    this.stateRef.set(null);
  }
}

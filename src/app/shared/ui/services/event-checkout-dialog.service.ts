import { Injectable, signal } from '@angular/core';

import type { EventCheckoutSelection } from '../../core/base/models';
import type { DemoEventRecord } from '../../core/demo/models/events.model';

export interface EventCheckoutDialogConfig {
  mode: 'join' | 'invitation';
  userId: string;
  record: DemoEventRecord;
  requiresApprovalBeforePayment?: boolean;
  approvalGranted?: boolean;
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
  record: DemoEventRecord;
  requiresApprovalBeforePayment: boolean;
  approvalGranted: boolean;
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
export class EventCheckoutDialogService {
  private readonly stateRef = signal<EventCheckoutDialogState | null>(null);
  private nextId = 0;

  readonly dialog = this.stateRef.asReadonly();

  open(config: EventCheckoutDialogConfig): void {
    const trimmedUserId = config.userId.trim();
    if (!trimmedUserId) {
      return;
    }

    this.stateRef.set({
      id: ++this.nextId,
      mode: config.mode,
      userId: trimmedUserId,
      record: config.record,
      requiresApprovalBeforePayment: config.requiresApprovalBeforePayment === true,
      approvalGranted: config.approvalGranted === true,
      title: config.title?.trim() || (config.mode === 'invitation' ? 'Accept Invitation' : 'Join Event'),
      subtitle: config.subtitle?.trim() || config.record.title,
      confirmLabel: config.confirmLabel?.trim() || 'Confirm',
      busyConfirmLabel: config.busyConfirmLabel?.trim() || 'Working...',
      allowBackdropClose: config.allowBackdropClose !== false,
      allowEscapeClose: config.allowEscapeClose !== false,
      failureMessage: config.failureMessage?.trim() || 'Unable to complete checkout.',
      onSubmit: config.onSubmit
    });
  }

  close(): void {
    this.stateRef.set(null);
  }
}

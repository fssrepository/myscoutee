import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, inject } from '@angular/core';

import { ConfirmationDialogService, type ConfirmationDialogState, type ConfirmationDialogTone } from '../../services/confirmation-dialog.service';

type RenderedConfirmationDialogState = {
  title: string;
  message: string;
  cancelLabel: string | null;
  confirmLabel: string;
  busyConfirmLabel: string;
  confirmTone: ConfirmationDialogTone;
  allowBackdropClose: boolean;
  allowEscapeClose: boolean;
  busy: boolean;
  errorMessage: string;
  ringPerimeter: number;
};

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent {
  @Input() useService = true;
  @Input() visible = false;
  @Input() title = 'Confirmation';
  @Input() message = '';
  @Input() cancelLabel: string | null = 'Cancel';
  @Input() confirmLabel = 'OK';
  @Input() busyConfirmLabel = 'Working...';
  @Input() confirmTone: ConfirmationDialogTone = 'accent';
  @Input() allowBackdropClose = true;
  @Input() allowEscapeClose = true;
  @Input() busy = false;
  @Input() errorMessage = '';
  @Input() ringPerimeter = 100;
  @Input() cancelAction: (() => void | Promise<void>) | null = null;
  @Input() confirmAction: (() => void | Promise<void>) | null = null;

  protected readonly dialogService = inject(ConfirmationDialogService);
  protected readonly dialog = this.dialogService.dialog;

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const dialog = this.dialogState();
    if (!dialog || keyboardEvent.defaultPrevented || !dialog.allowEscapeClose) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.cancel();
  }

  protected dialogState(): RenderedConfirmationDialogState | null {
    if (!this.useService) {
      if (!this.visible) {
        return null;
      }
      return {
        title: this.title.trim() || 'Confirmation',
        message: this.message.trim(),
        cancelLabel: this.cancelLabel,
        confirmLabel: this.confirmLabel.trim() || 'OK',
        busyConfirmLabel: this.busyConfirmLabel.trim() || this.confirmLabel.trim() || 'OK',
        confirmTone: this.confirmTone,
        allowBackdropClose: this.allowBackdropClose,
        allowEscapeClose: this.allowEscapeClose,
        busy: this.busy,
        errorMessage: this.errorMessage.trim(),
        ringPerimeter: this.ringPerimeter
      };
    }

    const state = this.dialog();
    return state ? this.mapServiceState(state) : null;
  }

  protected confirmText(state: RenderedConfirmationDialogState): string {
    return state.busy ? state.busyConfirmLabel : state.confirmLabel;
  }

  protected closeFromBackdrop(event: Event): void {
    event.stopPropagation();
    const dialog = this.dialogState();
    if (!dialog || dialog.busy || !dialog.allowBackdropClose) {
      return;
    }
    this.cancel();
  }

  protected cancel(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.dialogState();
    if (!dialog || dialog.busy) {
      return;
    }
    if (!this.useService) {
      void this.cancelAction?.();
      return;
    }
    this.dialogService.cancel();
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.dialogState();
    if (!dialog || dialog.busy) {
      return;
    }
    if (!this.useService) {
      void this.confirmAction?.();
      return;
    }
    void this.dialogService.confirm();
  }

  private mapServiceState(state: ConfirmationDialogState): RenderedConfirmationDialogState {
    return {
      title: state.title,
      message: state.message,
      cancelLabel: state.cancelLabel,
      confirmLabel: state.confirmLabel,
      busyConfirmLabel: state.busyConfirmLabel,
      confirmTone: state.confirmTone,
      allowBackdropClose: state.allowBackdropClose,
      allowEscapeClose: state.allowEscapeClose,
      busy: state.busy,
      errorMessage: state.errorMessage,
      ringPerimeter: state.ringPerimeter
    };
  }
}

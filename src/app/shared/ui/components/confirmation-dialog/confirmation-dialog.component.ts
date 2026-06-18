
import { Component, HostListener, Input, inject } from '@angular/core';

import { ConfirmationDialogService, type ConfirmationDialogState, type ConfirmationDialogTone } from '../../services/confirmation-dialog.service';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette
} from '../menu';

export interface ConfirmationDialogLocalConfig {
  visible?: boolean;
  title?: string;
  message?: string;
  warningMessage?: string;
  cancelLabel?: string | null;
  confirmLabel?: string;
  busyConfirmLabel?: string;
  confirmTone?: ConfirmationDialogTone;
  allowBackdropClose?: boolean;
  allowEscapeClose?: boolean;
  busy?: boolean;
  errorMessage?: string;
  ringPerimeter?: number;
  cancelAction?: (() => void | Promise<void>) | null;
  confirmAction?: (() => void | Promise<void>) | null;
}

type RenderedConfirmationDialogState = {
  title: string;
  message: string;
  warningMessage: string;
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
  imports: [AppMenuComponent],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent {
  @Input() useService = true;
  @Input() dialog: ConfirmationDialogLocalConfig | null = null;

  protected readonly dialogService = inject(ConfirmationDialogService);

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
      const dialog = this.dialog;
      if (!dialog?.visible) {
        return null;
      }
      const confirmLabel = dialog.confirmLabel?.trim() || 'OK';
      return {
        title: dialog.title?.trim() || 'Confirmation',
        message: dialog.message?.trim() ?? '',
        warningMessage: dialog.warningMessage?.trim() ?? '',
        cancelLabel: dialog.cancelLabel === undefined ? 'Cancel' : dialog.cancelLabel,
        confirmLabel,
        busyConfirmLabel: dialog.busyConfirmLabel?.trim() || confirmLabel,
        confirmTone: dialog.confirmTone ?? 'accent',
        allowBackdropClose: dialog.allowBackdropClose !== false,
        allowEscapeClose: dialog.allowEscapeClose !== false,
        busy: dialog.busy === true,
        errorMessage: dialog.errorMessage?.trim() ?? '',
        ringPerimeter: Number.isFinite(Number(dialog.ringPerimeter)) ? Math.max(0, Number(dialog.ringPerimeter)) : 100
      };
    }

    const state = this.dialogService.dialog();
    return state ? this.mapServiceState(state) : null;
  }

  protected confirmText(state: RenderedConfirmationDialogState): string {
    return state.busy ? state.busyConfirmLabel : state.confirmLabel;
  }

  protected confirmRingState(state: RenderedConfirmationDialogState): 'loading' | 'error' {
    return state.busy ? 'loading' : 'error';
  }

  protected confirmMenuItems(state: RenderedConfirmationDialogState): readonly AppMenuItem<string>[] {
    return [{
      id: 'confirm',
      label: this.confirmText(state),
      icon: state.busy ? 'hourglass_empty' : undefined,
      layout: 'action',
      palette: this.confirmPalette(state),
      disabled: state.busy,
      ariaLabel: this.confirmText(state),
      progress: state.busy || state.errorMessage
        ? {
            state: state.busy ? 'loading' : 'error',
            shape: 'button',
            perimeter: state.ringPerimeter
          }
        : null
    }];
  }

  protected onConfirmMenuSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.id !== 'confirm') {
      return;
    }
    this.confirm(event.sourceEvent);
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
      void this.dialog?.cancelAction?.();
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
      void this.dialog?.confirmAction?.();
      return;
    }
    void this.dialogService.confirm();
  }

  private confirmPalette(state: RenderedConfirmationDialogState): AppMenuPalette {
    if (state.errorMessage) {
      return 'danger';
    }
    if (state.confirmTone === 'danger') {
      return 'danger';
    }
    if (state.confirmTone === 'neutral') {
      return 'slate';
    }
    return 'blue';
  }

  private mapServiceState(state: ConfirmationDialogState): RenderedConfirmationDialogState {
    return {
      title: state.title,
      message: state.message,
      warningMessage: state.warningMessage,
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

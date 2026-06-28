
import { Component, HostListener, Input, inject } from '@angular/core';

import { DialogStore, type DialogState, type DialogTone } from '../../context/stores/dialog.store';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette
} from '../menu';
import { I18nPipe } from '../../pipes';

export interface DialogLocalConfig {
  visible?: boolean;
  title?: string;
  message?: string;
  warningMessage?: string;
  cancelLabel?: string | null;
  confirmLabel?: string;
  busyConfirmLabel?: string;
  confirmTone?: DialogTone;
  confirmPalette?: AppMenuPalette | null;
  allowBackdropClose?: boolean;
  allowEscapeClose?: boolean;
  busy?: boolean;
  errorMessage?: string;
  ringPerimeter?: number;
  cancelAction?: (() => void | Promise<void>) | null;
  confirmAction?: (() => void | Promise<void>) | null;
}

type RenderedDialogState = {
  title: string;
  message: string;
  warningMessage: string;
  cancelLabel: string | null;
  confirmLabel: string;
  busyConfirmLabel: string;
  confirmTone: DialogTone;
  confirmPalette: AppMenuPalette | null;
  allowBackdropClose: boolean;
  allowEscapeClose: boolean;
  busy: boolean;
  errorMessage: string;
  ringPerimeter: number;
};

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [AppMenuComponent, I18nPipe],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss'
})
export class DialogComponent {
  @Input() useStore = true;
  @Input() dialog: DialogLocalConfig | null = null;

  protected readonly dialogStore = inject(DialogStore);

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

  protected dialogState(): RenderedDialogState | null {
    if (!this.useStore) {
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
        confirmPalette: dialog.confirmPalette ?? null,
        allowBackdropClose: dialog.allowBackdropClose !== false,
        allowEscapeClose: dialog.allowEscapeClose !== false,
        busy: dialog.busy === true,
        errorMessage: dialog.errorMessage?.trim() ?? '',
        ringPerimeter: Number.isFinite(Number(dialog.ringPerimeter)) ? Math.max(0, Number(dialog.ringPerimeter)) : 100
      };
    }

    const state = this.dialogStore.dialog();
    return state ? this.mapStoreState(state) : null;
  }

  protected confirmText(state: RenderedDialogState): string {
    return state.busy ? state.busyConfirmLabel : state.confirmLabel;
  }

  protected confirmRingState(state: RenderedDialogState): 'loading' | 'error' {
    return state.busy ? 'loading' : 'error';
  }

  protected dialogActionItems(state: RenderedDialogState): readonly AppMenuItem<string>[] {
    const items: AppMenuItem<string>[] = [];
    if (state.cancelLabel) {
      items.push({
        id: 'cancel',
        label: state.cancelLabel,
        layout: 'action',
        palette: 'slate',
        disabled: state.busy,
        ariaLabel: state.cancelLabel
      });
    }
    items.push({
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
    });
    return items;
  }

  protected onDialogActionSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.id === 'cancel') {
      this.cancel(event.sourceEvent);
    } else if (event.id === 'confirm') {
      this.confirm(event.sourceEvent);
    }
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
    if (!this.useStore) {
      void this.dialog?.cancelAction?.();
      return;
    }
    this.dialogStore.cancel();
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.dialogState();
    if (!dialog || dialog.busy) {
      return;
    }
    if (!this.useStore) {
      void this.dialog?.confirmAction?.();
      return;
    }
    void this.dialogStore.confirm();
  }

  private confirmPalette(state: RenderedDialogState): AppMenuPalette {
    if (state.errorMessage) {
      return 'danger';
    }
    if (state.confirmPalette) {
      return state.confirmPalette;
    }
    if (state.confirmTone === 'danger') {
      return 'danger';
    }
    if (state.confirmTone === 'neutral') {
      return 'slate';
    }
    return 'blue';
  }

  private mapStoreState(state: DialogState): RenderedDialogState {
    return {
      title: state.title,
      message: state.message,
      warningMessage: state.warningMessage,
      cancelLabel: state.cancelLabel,
      confirmLabel: state.confirmLabel,
      busyConfirmLabel: state.busyConfirmLabel,
      confirmTone: state.confirmTone,
      confirmPalette: state.confirmPalette,
      allowBackdropClose: state.allowBackdropClose,
      allowEscapeClose: state.allowEscapeClose,
      busy: state.busy,
      errorMessage: state.errorMessage,
      ringPerimeter: state.ringPerimeter
    };
  }
}

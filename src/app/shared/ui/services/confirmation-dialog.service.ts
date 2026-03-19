import { Injectable, signal } from '@angular/core';

export type ConfirmationDialogTone = 'accent' | 'danger' | 'neutral';

export interface ConfirmationDialogConfig {
  title: string;
  message?: string | null;
  cancelLabel?: string | null;
  confirmLabel?: string;
  confirmTone?: ConfirmationDialogTone;
  allowBackdropClose?: boolean;
  allowEscapeClose?: boolean;
  onConfirm?: (() => void | Promise<void>) | null;
  onCancel?: (() => void | Promise<void>) | null;
}

export interface ConfirmationDialogState {
  id: number;
  title: string;
  message: string;
  cancelLabel: string | null;
  confirmLabel: string;
  confirmTone: ConfirmationDialogTone;
  allowBackdropClose: boolean;
  allowEscapeClose: boolean;
  onConfirm: (() => void | Promise<void>) | null;
  onCancel: (() => void | Promise<void>) | null;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationDialogService {
  private readonly stateRef = signal<ConfirmationDialogState | null>(null);
  private nextId = 0;

  readonly dialog = this.stateRef.asReadonly();

  open(config: ConfirmationDialogConfig): void {
    this.stateRef.set({
      id: ++this.nextId,
      title: config.title.trim() || 'Confirmation',
      message: config.message?.trim() ?? '',
      cancelLabel: config.cancelLabel === undefined ? 'Cancel' : config.cancelLabel,
      confirmLabel: config.confirmLabel?.trim() || 'OK',
      confirmTone: config.confirmTone ?? 'accent',
      allowBackdropClose: config.allowBackdropClose !== false,
      allowEscapeClose: config.allowEscapeClose !== false,
      onConfirm: config.onConfirm ?? null,
      onCancel: config.onCancel ?? null
    });
  }

  openInfo(
    message: string,
    options: Omit<ConfirmationDialogConfig, 'message' | 'cancelLabel'> = { title: 'Notice' }
  ): void {
    this.open({
      ...options,
      message,
      cancelLabel: null,
      confirmLabel: options.confirmLabel?.trim() || 'OK'
    });
  }

  cancel(): void {
    const state = this.stateRef();
    if (!state) {
      return;
    }
    this.stateRef.set(null);
    void state.onCancel?.();
  }

  confirm(): void {
    const state = this.stateRef();
    if (!state) {
      return;
    }
    this.stateRef.set(null);
    void state.onConfirm?.();
  }

  close(): void {
    this.stateRef.set(null);
  }
}

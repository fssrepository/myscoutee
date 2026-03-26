import { Injectable, signal } from '@angular/core';

export type ConfirmationDialogTone = 'accent' | 'danger' | 'neutral';

export interface ConfirmationDialogConfig {
  title: string;
  message?: string | null;
  cancelLabel?: string | null;
  confirmLabel?: string;
  busyConfirmLabel?: string;
  confirmTone?: ConfirmationDialogTone;
  allowBackdropClose?: boolean;
  allowEscapeClose?: boolean;
  failureMessage?: string | null;
  ringPerimeter?: number;
  onConfirm?: (() => void | Promise<void>) | null;
  onCancel?: (() => void | Promise<void>) | null;
}

export interface ConfirmationDialogState {
  id: number;
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
  failureMessage: string;
  ringPerimeter: number;
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
      busyConfirmLabel: config.busyConfirmLabel?.trim() || 'Working...',
      confirmTone: config.confirmTone ?? 'accent',
      allowBackdropClose: config.allowBackdropClose !== false,
      allowEscapeClose: config.allowEscapeClose !== false,
      busy: false,
      errorMessage: '',
      failureMessage: config.failureMessage?.trim() || 'Unable to complete this action.',
      ringPerimeter: Number.isFinite(Number(config.ringPerimeter)) ? Math.max(0, Number(config.ringPerimeter)) : 100,
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

  async confirm(): Promise<void> {
    const state = this.stateRef();
    if (!state || state.busy) {
      return;
    }
    if (!state.onConfirm) {
      this.stateRef.set(null);
      return;
    }
    const dialogId = state.id;
    this.stateRef.update(current => current && current.id === dialogId
      ? { ...current, busy: true, errorMessage: '' }
      : current);
    try {
      await Promise.resolve(state.onConfirm());
      if (this.stateRef()?.id === dialogId) {
        this.stateRef.set(null);
      }
    } catch (error) {
      if (this.stateRef()?.id !== dialogId) {
        return;
      }
      this.stateRef.update(current => current && current.id === dialogId
        ? {
            ...current,
            busy: false,
            errorMessage: this.resolveErrorMessage(error, current.failureMessage)
          }
        : current);
    }
  }

  close(): void {
    this.stateRef.set(null);
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return fallback;
  }
}

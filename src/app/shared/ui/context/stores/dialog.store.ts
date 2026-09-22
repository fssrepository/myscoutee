import { Injectable, signal } from '@angular/core';

import type { AppMenuPalette } from '../../components/core/menu';

export type DialogTone = 'accent' | 'danger' | 'neutral' | 'warning';

export interface DialogConfig {
  title: string;
  message?: string | null;
  warningMessage?: string | null;
  cancelLabel?: string | null;
  confirmLabel?: string;
  busyConfirmLabel?: string;
  confirmTone?: DialogTone;
  confirmPalette?: AppMenuPalette | null;
  allowBackdropClose?: boolean;
  allowEscapeClose?: boolean;
  showActions?: boolean;
  showClose?: boolean;
  failureMessage?: string | null;
  ringPerimeter?: number;
  input?: { label: string; maxLength: number; value?: string } | null;
  onConfirm?: ((input: string) => void | Promise<void>) | null;
  onCancel?: (() => void | Promise<void>) | null;
}

export interface DialogState {
  id: number;
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
  showActions: boolean;
  showClose: boolean;
  busy: boolean;
  errorMessage: string;
  failureMessage: string;
  ringPerimeter: number;
  input: { label: string; maxLength: number; value: string } | null;
  onConfirm: ((input: string) => void | Promise<void>) | null;
  onCancel: (() => void | Promise<void>) | null;
}

@Injectable({
  providedIn: 'root'
})
export class DialogStore {
  private readonly stateRef = signal<DialogState | null>(null);
  private nextId = 0;

  readonly dialog = this.stateRef.asReadonly();

  open(config: DialogConfig): void {
    this.stateRef.set({
      id: ++this.nextId,
      title: config.title.trim() || 'Confirmation',
      message: config.message?.trim() ?? '',
      warningMessage: config.warningMessage?.trim() ?? '',
      cancelLabel: config.cancelLabel === undefined ? 'Cancel' : config.cancelLabel,
      confirmLabel: config.confirmLabel?.trim() || 'OK',
      busyConfirmLabel: config.busyConfirmLabel?.trim() || 'Working...',
      confirmTone: config.confirmTone ?? 'accent',
      confirmPalette: config.confirmPalette ?? null,
      allowBackdropClose: config.allowBackdropClose !== false,
      allowEscapeClose: config.allowEscapeClose !== false,
      showActions: config.showActions !== false,
      showClose: config.showClose === true,
      busy: false,
      errorMessage: '',
      failureMessage: config.failureMessage?.trim() || 'Unable to complete this action.',
      ringPerimeter: Number.isFinite(Number(config.ringPerimeter)) ? Math.max(0, Number(config.ringPerimeter)) : 100,
      input: config.input ? { ...config.input, value: (config.input.value ?? '').slice(0, config.input.maxLength) } : null,
      onConfirm: config.onConfirm ?? null,
      onCancel: config.onCancel ?? null
    });
  }

  openInfo(
    message: string,
    options: Omit<DialogConfig, 'message' | 'cancelLabel'> = { title: 'Notice' }
  ): void {
    this.open({
      ...options,
      message,
      cancelLabel: null,
      confirmLabel: options.confirmLabel?.trim() || 'OK'
    });
  }

  openNotice(
    message: string,
    options: Omit<DialogConfig, 'message' | 'cancelLabel' | 'confirmLabel' | 'onConfirm'> = { title: 'Notice' }
  ): void {
    this.open({
      ...options,
      message,
      cancelLabel: null,
      showActions: false,
      showClose: true,
      onConfirm: null
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
      await Promise.resolve(state.onConfirm(state.input?.value ?? ''));
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

  updateInput(value: string): void {
    this.stateRef.update(current => current?.input && !current.busy
      ? { ...current, input: { ...current.input, value: value.slice(0, current.input.maxLength) } } : current);
  }

  close(): void {
    this.stateRef.set(null);
  }

  clearWarningMessage(): void {
    this.stateRef.update(current => current
      ? { ...current, warningMessage: '' }
      : current);
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

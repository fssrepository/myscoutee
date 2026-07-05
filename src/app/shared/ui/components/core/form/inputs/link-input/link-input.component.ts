import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AppUtils } from '../../../../../../app-utils';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../menu';

export interface LinkInputConfig {
  label?: string | null;
  placeholder?: string | null;
  required?: boolean | null;
  pasteAriaLabel?: string | null;
  openAriaLabel?: string | null;
  deleteAriaLabel?: string | null;
}

type LinkInputAction = 'paste' | 'open' | 'delete';

@Component({
  selector: 'app-link-input',
  standalone: true,
  imports: [CommonModule, FormsModule, AppMenuComponent],
  templateUrl: './link-input.component.html',
  styleUrl: './link-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LinkInputComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LinkInputComponent implements ControlValueAccessor {
  @Input() config: LinkInputConfig = {};
  @Input() readOnly = false;
  @Input() disabled = false;

  protected value = '';

  private controlDisabled = false;
  private onValueChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    this.value = this.toText(value).trim();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onValueChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
  }

  protected label(): string {
    return this.toText(this.config.label).trim() || 'Source link';
  }

  protected placeholder(): string {
    return this.toText(this.config.placeholder).trim() || 'https://...';
  }

  protected required(): boolean {
    return this.config.required === true;
  }

  protected inputDisabled(): boolean {
    return this.disabled || this.controlDisabled;
  }

  protected inputReadOnly(): boolean {
    return true;
  }

  protected normalizedUrl(): string {
    return AppUtils.normalizeHttpUrl(this.value);
  }

  protected actionItems(): readonly AppMenuItem<string, { action: LinkInputAction }>[] {
    const disabled = this.inputDisabled();
    const normalizedUrl = this.normalizedUrl();
    const items: AppMenuItem<string, { action: LinkInputAction }>[] = [
      {
        id: 'link-input-paste',
        icon: 'content_paste',
        layout: 'action',
        palette: 'blue',
        ariaLabel: this.toText(this.config.pasteAriaLabel).trim() || 'Paste link',
        disabled: disabled || this.readOnly,
        context: { action: 'paste' }
      },
      {
        id: 'link-input-open',
        icon: 'link',
        layout: 'action',
        palette: 'teal',
        ariaLabel: this.toText(this.config.openAriaLabel).trim() || 'Open link',
        disabled: disabled || !normalizedUrl,
        context: { action: 'open' }
      },
      {
        id: 'link-input-delete',
        icon: 'delete',
        layout: 'action',
        palette: 'danger',
        ariaLabel: this.toText(this.config.deleteAriaLabel).trim() || 'Remove link',
        disabled: disabled || this.readOnly || !this.value.trim(),
        context: { action: 'delete' }
      }
    ];
    return this.readOnly
      ? items.filter(item => item.context?.action === 'open')
      : items;
  }

  protected onPaste(event: ClipboardEvent): void {
    if (this.inputDisabled() || this.readOnly) {
      return;
    }
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text.trim()) {
      return;
    }
    event.preventDefault();
    this.updateValue(text);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  protected onAction(event: AppMenuItemSelectEvent<string, { action: LinkInputAction }>): void {
    this.onTouched();
    const action = event.context?.action;
    if (action === 'paste') {
      void this.pasteFromClipboard();
      return;
    }
    if (action === 'open') {
      this.openLink();
      return;
    }
    if (action === 'delete') {
      this.updateValue('');
    }
  }

  private async pasteFromClipboard(): Promise<void> {
    if (this.inputDisabled() || this.readOnly || typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      return;
    }
    try {
      this.updateValue(await navigator.clipboard.readText());
    } catch {
      // Clipboard permission can be denied by the browser.
    }
  }

  private openLink(): void {
    const normalizedUrl = this.normalizedUrl();
    if (!normalizedUrl) {
      return;
    }
    AppUtils.openExternalUrl(normalizedUrl);
  }

  private updateValue(value: string): void {
    if (this.inputDisabled() || this.readOnly) {
      return;
    }
    const normalized = this.normalizeLinkValue(value);
    this.value = normalized;
    this.onValueChange(normalized);
  }

  private normalizeLinkValue(value: string): string {
    const raw = this.toText(value).trim();
    return raw ? AppUtils.normalizeHttpUrl(raw) : '';
  }

  private toText(value: unknown): string {
    return `${value ?? ''}`;
  }
}

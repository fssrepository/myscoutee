import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AppUtils } from '../../../../../../app-utils';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPanelMode
} from '../../../menu';

export interface LinkInputConfig {
  label?: string | null;
  placeholder?: string | null;
  required?: boolean | null;
  panelMode?: AppMenuPanelMode | null;
  availableUrls?: readonly (string | LinkInputAvailableUrl)[] | null;
  availableUrlsAriaLabel?: string | null;
  pasteAriaLabel?: string | null;
  openAriaLabel?: string | null;
  deleteAriaLabel?: string | null;
}

export interface LinkInputAvailableUrl {
  url: string;
  label?: string | null;
  description?: string | null;
  disabled?: boolean | null;
}

type LinkInputAction = 'select' | 'paste' | 'open' | 'delete';

interface LinkInputActionContext {
  action: LinkInputAction;
  url?: string;
}

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
  @Input() textReadOnly = false;
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
    return this.readOnly || this.textReadOnly;
  }

  protected normalizedUrl(): string {
    return AppUtils.normalizeHttpUrl(this.value);
  }

  protected actionItems(): readonly AppMenuItem<string, LinkInputActionContext>[] {
    const disabled = this.inputDisabled();
    const normalizedUrl = this.normalizedUrl();
    const items: AppMenuItem<string, LinkInputActionContext>[] = [];
    const availableUrlItems = this.availableUrlItems();
    if (availableUrlItems.length > 0) {
      items.push({
        id: 'link-input-select',
        icon: 'list_alt',
        openIcon: 'list_alt',
        layout: 'action',
        kind: 'branch',
        palette: 'violet',
        ariaLabel: this.toText(this.config.availableUrlsAriaLabel).trim() || 'Select an available URL',
        disabled: disabled || this.readOnly,
        items: availableUrlItems
      });
    }
    items.push(
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
    );
    return this.readOnly
      ? items.filter(item => item.context?.action === 'open')
      : items;
  }

  protected onInput(value: unknown): void {
    if (this.inputDisabled() || this.inputReadOnly()) {
      return;
    }
    this.setValue(this.toText(value), false);
  }

  protected onPaste(event: ClipboardEvent): void {
    if (this.inputDisabled() || this.inputReadOnly()) {
      return;
    }
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text.trim()) {
      return;
    }
    event.preventDefault();
    this.setValue(text, true);
  }

  protected onBlur(): void {
    if (!this.inputDisabled() && !this.inputReadOnly()) {
      const trimmed = this.value.trim();
      const normalized = AppUtils.normalizeHttpUrl(trimmed);
      this.setValue(normalized || trimmed, false);
    }
    this.onTouched();
  }

  protected onAction(event: AppMenuItemSelectEvent<string, LinkInputActionContext>): void {
    this.onTouched();
    const action = event.context?.action;
    if (action === 'select') {
      this.setValue(event.context?.url ?? '', true);
      return;
    }
    if (action === 'paste') {
      void this.pasteFromClipboard();
      return;
    }
    if (action === 'open') {
      this.openLink();
      return;
    }
    if (action === 'delete') {
      this.setValue('', false);
    }
  }

  private async pasteFromClipboard(): Promise<void> {
    if (this.inputDisabled() || this.readOnly || typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      return;
    }
    try {
      this.setValue(await navigator.clipboard.readText(), true);
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

  private availableUrlItems(): readonly AppMenuItem<string, LinkInputActionContext>[] {
    const currentUrl = this.normalizedUrl();
    const seen = new Set<string>();
    return (this.config.availableUrls ?? [])
      .map(option => this.availableUrl(option))
      .filter((option): option is LinkInputAvailableUrl & { normalizedUrl: string } => {
        if (!option.normalizedUrl || seen.has(option.normalizedUrl)) {
          return false;
        }
        seen.add(option.normalizedUrl);
        return true;
      })
      .map((option, index) => ({
        id: `link-input-url-${index}`,
        label: this.toText(option.label).trim() || option.normalizedUrl,
        description: this.toText(option.description).trim() || option.normalizedUrl,
        icon: 'link',
        kind: 'radio',
        palette: 'violet',
        surface: 'tinted',
        active: currentUrl === option.normalizedUrl,
        checked: currentUrl === option.normalizedUrl,
        disabled: option.disabled === true,
        context: {
          action: 'select',
          url: option.normalizedUrl
        }
      }));
  }

  private availableUrl(
    option: string | LinkInputAvailableUrl
  ): LinkInputAvailableUrl & { normalizedUrl: string } {
    const source = typeof option === 'string' ? { url: option } : option;
    return {
      ...source,
      normalizedUrl: AppUtils.normalizeHttpUrl(source.url)
    };
  }

  private setValue(value: string, normalize: boolean): void {
    if (this.inputDisabled() || this.readOnly) {
      return;
    }
    const source = this.toText(value);
    const raw = normalize ? source.trim() : source;
    const nextValue = normalize && raw ? AppUtils.normalizeHttpUrl(raw) : raw;
    this.value = nextValue;
    this.onValueChange(nextValue);
  }

  private toText(value: unknown): string {
    return `${value ?? ''}`;
  }
}

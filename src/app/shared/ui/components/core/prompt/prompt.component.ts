import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { PromptAction, PromptActionEvent, PromptIcon, PromptImageIcon, PromptModel } from './prompt.types';

@Component({
  selector: 'app-prompt',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './prompt.component.html',
  styleUrl: './prompt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromptComponent {
  @Input() model: PromptModel | null = null;

  @Output() readonly action = new EventEmitter<PromptActionEvent>();
  @Output() readonly dismiss = new EventEmitter<Event>();

  protected get promptModel(): PromptModel {
    return this.model ?? {};
  }

  protected get visible(): boolean {
    return Boolean(this.model)
      && this.promptModel.visible !== false
      && (
        this.hasText(this.promptModel.title)
        || this.hasText(this.promptModel.description)
        || Boolean(this.promptModel.icon)
        || Boolean(this.promptModel.action)
      );
  }

  protected get busy(): boolean {
    return this.promptModel.busy === true;
  }

  protected get dismissible(): boolean {
    return this.promptModel.dismissible !== false;
  }

  protected get ariaLabel(): string {
    return this.promptModel.ariaLabel?.trim()
      || this.promptModel.title?.trim()
      || this.promptModel.action?.ariaLabel?.trim()
      || this.promptModel.action?.label.trim()
      || 'Prompt';
  }

  protected get closeAriaLabel(): string {
    return this.promptModel.closeAriaLabel?.trim() || 'Dismiss';
  }

  protected isImageIcon(icon: PromptIcon | null | undefined): icon is PromptImageIcon {
    return typeof icon === 'object' && icon !== null && 'src' in icon;
  }

  protected iconSource(icon: PromptIcon | null | undefined): string | null {
    return this.isImageIcon(icon)
      ? icon.src
      : null;
  }

  protected iconAlt(icon: PromptIcon | null | undefined): string {
    return this.isImageIcon(icon)
      ? `${icon.alt ?? ''}`
      : '';
  }

  protected iconName(icon: PromptIcon | null | undefined): string {
    if (!icon || this.isImageIcon(icon)) {
      return '';
    }
    return typeof icon === 'string' ? icon : icon.name;
  }

  protected iconAriaLabel(icon: PromptIcon | null | undefined): string | null {
    if (!icon || typeof icon === 'string' || this.isImageIcon(icon)) {
      return null;
    }
    return icon.ariaLabel?.trim() || null;
  }

  protected actionLabel(action: PromptAction): string {
    return this.busy && this.hasText(action.busyLabel)
      ? `${action.busyLabel}`
      : action.label;
  }

  protected actionAriaLabel(action: PromptAction): string {
    return action.ariaLabel?.trim() || action.label;
  }

  protected actionDisabled(action: PromptAction): boolean {
    return this.busy || action.disabled === true;
  }

  protected emitAction(action: PromptAction, event: Event): void {
    if (this.actionDisabled(action)) {
      return;
    }
    this.action.emit({ action, sourceEvent: event });
  }

  protected emitDismiss(event: Event): void {
    if (this.busy) {
      return;
    }
    this.dismiss.emit(event);
  }

  private hasText(value: string | null | undefined): boolean {
    return Boolean(value?.trim());
  }
}

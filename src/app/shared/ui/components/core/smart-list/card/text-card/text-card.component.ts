import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuCounter,
  type AppMenuCounterValue,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../menu';

export type TextCardTone =
  | 'neutral'
  | 'slot'
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'violet'
  | 'pink'
  | 'orange'
  | 'amber'
  | 'gold'
  | 'danger'
  | 'muted';

@Component({
  selector: 'app-text-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent
  ],
  templateUrl: './text-card.component.html',
  styleUrl: './text-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() meta = '';
  @Input() detail = '';
  @Input() icon = '';
  @Input() tone: TextCardTone = 'neutral';
  @Input() badge = '';
  @Input() badgeAriaLabel: string | null = null;
  @Input() menuTitle: string | null = null;
  @Input() menuPalette: AppMenuPalette = 'default';
  @Input() menuCounter: AppMenuCounter | AppMenuCounterValue | null = null;
  @Input() menuItems: readonly AppMenuItem<string, unknown>[] = [];
  @Input() selectable = false;
  @Input() selected = false;
  @Input() selectDisabled = false;
  @Input() selectIcon = 'add';
  @Input() selectedIcon = 'check';
  @Input() selectAriaLabel: string | null = null;

  @Output() menuSelect = new EventEmitter<AppMenuItemSelectEvent<string, unknown>>();
  @Output() selectionToggle = new EventEmitter<Event>();

  protected rootClassList(): string[] {
    return [
      'ui-text-card',
      `ui-text-card--tone-${this.tone || 'neutral'}`,
      this.selected ? 'ui-text-card--selected' : '',
      this.hasActions() ? 'ui-text-card--with-actions' : '',
      this.resolvedBadge() ? 'ui-text-card--with-badge' : ''
    ].filter(Boolean);
  }

  protected resolvedTitle(): string {
    return `${this.title ?? ''}`.trim();
  }

  protected resolvedSubtitle(): string {
    return `${this.subtitle ?? ''}`.trim();
  }

  protected resolvedMeta(): string {
    return `${this.meta ?? ''}`.trim();
  }

  protected resolvedDetail(): string {
    return `${this.detail ?? ''}`.trim();
  }

  protected resolvedIcon(): string {
    return `${this.icon ?? ''}`.trim();
  }

  protected resolvedBadge(): string {
    return `${this.badge ?? ''}`.trim();
  }

  protected resolvedBadgeAriaLabel(): string | null {
    const label = `${this.badgeAriaLabel ?? ''}`.trim();
    return label || null;
  }

  protected hasMenu(): boolean {
    return this.menuItems.length > 0;
  }

  protected hasActions(): boolean {
    return this.hasSelectAction() || this.hasMenu();
  }

  protected hasSelectAction(): boolean {
    return this.selectable === true;
  }

  protected selectActionIcon(): string {
    return this.selected ? this.selectedIcon : this.selectIcon;
  }

  protected resolvedSelectAriaLabel(): string {
    const label = `${this.selectAriaLabel ?? ''}`.trim();
    if (label) {
      return label;
    }
    return this.selected ? 'Remove selection' : 'Select';
  }

  protected selectActionClassList(): string[] {
    return [
      'ui-text-card__select-action',
      this.selected ? 'ui-text-card__select-action--selected' : ''
    ].filter(Boolean);
  }

  protected toggleSelection(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.selectDisabled) {
      return;
    }
    this.selectionToggle.emit(event);
  }

  protected resolvedMenuTitle(): string | null {
    const title = `${this.menuTitle ?? this.resolvedTitle()}`.trim();
    return title || null;
  }

  protected menuTrigger(): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: this.menuPalette,
      counter: this.menuCounter,
      ariaLabel: 'Open card menu'
    };
  }
}

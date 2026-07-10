import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  AppMenuComponent,
  AppMenuTriggerComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuCounter,
  type AppMenuCounterValue,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../menu';

export type TextCardTone =
  | 'neutral'
  | 'draft'
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
export type TextCardStatusTone =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted';
export type TextCardBadgeTone =
  | 'default'
  | 'price'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger';
export type TextCardSelectPalette =
  | 'default'
  | 'picker'
  | 'muted';

@Component({
  selector: 'app-text-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuTriggerComponent
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
  @Input() disabled = false;
  @Input() badge = '';
  @Input() badgeIcon = '';
  @Input() badgeAriaLabel: string | null = null;
  @Input() badgeTone: TextCardBadgeTone = 'default';
  @Input() badgeClickable = false;
  @Input() statusBadge = '';
  @Input() statusBadgeIcon = '';
  @Input() statusBadgeAriaLabel: string | null = null;
  @Input() statusBadgeTone: TextCardStatusTone = 'default';
  @Input() menuTitle: string | null = null;
  @Input() menuPalette: AppMenuPalette = 'default';
  @Input() menuCounter: AppMenuCounter | AppMenuCounterValue | null = null;
  @Input() menuItems: readonly AppMenuItem<string, unknown>[] = [];
  @Input() useSharedMenuTrigger = false;
  @Input() sharedMenuId: string | null = null;
  @Input() sharedMenuContext: unknown = null;
  @Input() selectable = false;
  @Input() selected = false;
  @Input() selectDisabled = false;
  @Input() selectPalette: TextCardSelectPalette = 'default';
  @Input() selectIcon = 'add';
  @Input() selectedIcon = 'check';
  @Input() selectAriaLabel: string | null = null;

  @Output() menuSelect = new EventEmitter<AppMenuItemSelectEvent<string, unknown>>();
  @Output() selectionToggle = new EventEmitter<Event>();
  @Output() badgeClick = new EventEmitter<Event>();

  protected rootClassList(): string[] {
    return [
      'ui-text-card',
      `ui-text-card--tone-${this.tone || 'neutral'}`,
      this.disabled ? 'ui-text-card--disabled' : '',
      this.selected ? 'ui-text-card--selected' : '',
      this.hasActions() ? 'ui-text-card--with-actions' : '',
      this.resolvedBadge() ? 'ui-text-card--with-badge' : '',
      this.resolvedBadge() ? `ui-text-card--badge-${this.badgeTone || 'default'}` : '',
      this.resolvedStatusBadge() ? 'ui-text-card--with-status-badge' : '',
      this.resolvedStatusBadge() ? `ui-text-card--status-${this.statusBadgeTone || 'default'}` : ''
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

  protected resolvedBadgeIcon(): string {
    return `${this.badgeIcon ?? ''}`.trim();
  }

  protected resolvedBadgeAriaLabel(): string | null {
    const label = `${this.badgeAriaLabel ?? ''}`.trim();
    return label || null;
  }

  protected resolvedStatusBadge(): string {
    return `${this.statusBadge ?? ''}`.trim();
  }

  protected resolvedStatusBadgeIcon(): string {
    return `${this.statusBadgeIcon ?? ''}`.trim();
  }

  protected resolvedStatusBadgeAriaLabel(): string | null {
    const label = `${this.statusBadgeAriaLabel ?? ''}`.trim();
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
      `ui-text-card__select-action--palette-${this.selectPalette || 'default'}`,
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

  protected emitBadgeClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.badgeClick.emit(event);
  }

  protected resolvedMenuTitle(): string | null {
    const title = `${this.menuTitle ?? this.resolvedTitle()}`.trim();
    return title || null;
  }

  protected resolvedSharedMenuId(): string {
    return `${this.sharedMenuId ?? ''}`.trim();
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

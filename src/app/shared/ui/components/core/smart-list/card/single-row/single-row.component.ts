import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../../../../app-utils';
import { CounterBadgePipe } from '../../../../../pipes/counter-badge.pipe';
import {
  AppMenuComponent,
  type AppMenuKind,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPanelAlign,
  type AppMenuPanelMode,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../menu';
import {
  CARD_MENU_ACTIONS,
  type CardMenuAction,
  type CardMenuActionEvent,
  type CardMenuRequestEvent,
  type CardMenuTriggerRect,
  type SingleRowBadge,
  type SingleRowBadgePosition,
  type SingleRowData
} from '../card.types';

type SingleRowMenuRequestEvent = CardMenuRequestEvent<SingleRowData> & {
  kind?: AppMenuKind;
  items?: readonly AppMenuItem<string, Record<string, unknown>>[];
  panelAlign?: AppMenuPanelAlign;
  panelMode?: AppMenuPanelMode;
  closeOnSelect?: boolean;
};

@Component({
  selector: 'single-row',
  standalone: true,
  imports: [CommonModule, MatIconModule, CounterBadgePipe, AppMenuComponent],
  templateUrl: './single-row.component.html',
  styleUrl: './single-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleRowComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() row: SingleRowData | null = null;
  @Input() clickable = false;
  @Input() ariaLabel: string | null = null;
  @Input() useSharedMenu = false;
  @Input() sharedMenuContext: Record<string, unknown> | null = null;

  @Output() readonly rowClick = new EventEmitter<Event>();
  @Output() readonly menuAction = new EventEmitter<CardMenuActionEvent<SingleRowData>>();
  @Output() readonly menuRequest = new EventEmitter<SingleRowMenuRequestEvent>();

  protected menuOpen = false;

  protected isClickable(): boolean {
    return this.clickable || this.row?.clickable === true;
  }

  protected rootClassList(): string[] {
    const classes = ['ui-single-row'];
    const toneClass = `${this.row?.toneClass ?? ''}`.trim();
    if (toneClass) {
      classes.push(toneClass);
    }
    const surfaceTone = this.row?.surfaceTone ?? 'default';
    if (surfaceTone !== 'default') {
      classes.push(`ui-single-row--tone-${surfaceTone}`);
    }
    if (this.isClickable()) {
      classes.push('ui-single-row--clickable');
    }
    if (!this.hasLeadingVisual()) {
      classes.push('ui-single-row--no-leading');
    }
    if (this.hasTopRightContent()) {
      classes.push('ui-single-row--with-top-right');
    }
    if (this.hasMenuActions()) {
      classes.push('ui-single-row--with-menu-actions');
    }
    return classes;
  }

  protected avatarClassList(): string[] {
    const classes = ['ui-single-row__avatar'];
    const avatarToneClass = `${this.row?.avatarToneClass ?? ''}`.trim();
    if (avatarToneClass) {
      classes.push(avatarToneClass);
    }
    classes.push(`ui-single-row__avatar--${this.row?.avatarShape ?? 'circle'}`);
    return classes;
  }

  protected hasLeadingVisual(): boolean {
    return Boolean(this.row?.avatarUrl || this.row?.icon || this.row?.avatarInitials);
  }

  protected avatarImageUrl(): string {
    return AppUtils.mediaImageVariantUrl(this.row?.avatarUrl, 'small');
  }

  protected inlineBadges(): readonly SingleRowBadge[] {
    return this.badgesFor('inline');
  }

  protected topRightBadges(): readonly SingleRowBadge[] {
    return this.badgesFor('top-right');
  }

  protected sideBadges(): readonly SingleRowBadge[] {
    const badges = this.badgesFor('side');
    const sideLabel = `${this.row?.sideLabel ?? ''}`.trim();
    if (!sideLabel) {
      return badges;
    }
    return [
      {
        label: sideLabel,
        icon: this.row?.sideLabelIcon ?? null,
        tone: this.row?.sideLabelTone ?? 'inverse',
        position: 'side'
      },
      ...badges
    ];
  }

  protected rowCounterValue(): number {
    return this.nonNegativeInteger(this.row?.unread);
  }

  protected hasTopRightContent(): boolean {
    return this.topRightBadges().length > 0 || this.rowCounterValue() > 0;
  }

  protected menuBadgeValue(): number {
    return this.rowCounterValue() > 0 ? 0 : this.nonNegativeInteger(this.row?.badgeCount);
  }

  protected hasSideContent(): boolean {
    return this.sideBadges().length > 0 || this.hasMenuActions();
  }

  protected hasMenuActions(): boolean {
    return (this.row?.menuActions?.length ?? 0) > 0;
  }

  protected badgeClassList(badge: SingleRowBadge): string[] {
    const classes = [
      'ui-single-row__badge-pill',
      `ui-single-row__badge-pill--${badge.tone ?? 'default'}`
    ];
    const className = `${badge.className ?? ''}`.trim();
    if (className) {
      classes.push(className);
    }
    return classes;
  }

  protected rowMenuTitle(): string | null {
    const title = `${this.row?.title ?? ''}`.trim();
    return title || null;
  }

  protected rowMenuTrigger(): AppMenuTrigger {
    const menuBadgeCount = this.menuBadgeValue();
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: 'default',
      counter: menuBadgeCount > 0 ? { value: menuBadgeCount, max: 99 } : null,
      ariaLabel: 'Open menu'
    };
  }

  protected rowMenuItems(): readonly AppMenuItem<string, Record<string, unknown>>[] {
    const row = this.row;
    if (!row?.menuActions?.length) {
      return [];
    }
    return row.menuActions.flatMap(actionId => {
      const config = CARD_MENU_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: CardMenuAction = {
        id: actionId,
        ...config
      };
      return [{
        id: actionId,
        label: config.label,
        icon: config.icon,
        palette: this.sharedMenuActionPalette(config.tone),
        surface: 'tinted',
        context: {
          ...(this.sharedMenuContext ?? {}),
          row,
          card: row,
          action
        }
      }];
    });
  }

  protected trackByBadge(index: number, badge: SingleRowBadge): string | number {
    return `${badge.position ?? 'side'}:${badge.label}:${badge.icon ?? ''}:${badge.tone ?? ''}:${index}`;
  }

  protected onRowClick(event: Event): void {
    if (!this.isClickable()) {
      return;
    }
    this.rowClick.emit(event);
  }

  protected onRowKeydown(event: KeyboardEvent): void {
    if (!this.isClickable() || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    event.preventDefault();
    this.rowClick.emit(event);
  }

  protected onSharedMenuTriggerPointerDown(event: Event): void {
    event.stopPropagation();
  }

  protected onSharedMenuTriggerClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const row = this.row;
    if (!row || !this.hasMenuActions()) {
      return;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    this.menuOpen = true;
    this.menuRequest.emit({
      id: row.id,
      card: row,
      actions: row.menuActions ?? [],
      kind: 'select',
      title: this.rowMenuTitle(),
      items: this.rowMenuItems(),
      triggerRect: this.resolveMenuTriggerRect(trigger),
      openUp: false,
      panelAlign: 'auto',
      closeOnSelect: true,
      closeTrigger: () => {
        this.menuOpen = false;
        this.cdr.markForCheck();
      }
    });
    this.cdr.markForCheck();
  }

  protected onMenuActionSelected(event: AppMenuItemSelectEvent<string, unknown>): void {
    const action = (event.context as { action?: CardMenuAction } | undefined)?.action;
    if (!this.row || !action) {
      return;
    }
    this.menuAction.emit({
      id: this.row.id,
      actionId: action.id,
      action,
      card: this.row
    });
  }

  private sharedMenuActionPalette(tone: CardMenuAction['tone']): AppMenuPalette {
    switch (tone) {
      case 'accent':
        return 'brown';
      case 'warning':
      case 'review':
        return 'orange';
      case 'destructive':
        return 'danger';
      default:
        return 'default';
    }
  }

  private badgesFor(position: SingleRowBadgePosition): readonly SingleRowBadge[] {
    return (this.row?.badges ?? []).filter(badge => (badge.position ?? 'side') === position);
  }

  private nonNegativeInteger(value: number | null | undefined): number {
    return Math.max(0, Math.trunc(Number(value ?? 0) || 0));
  }

  private resolveMenuTriggerRect(trigger: HTMLElement | null): CardMenuTriggerRect | null {
    if (typeof window === 'undefined' || !trigger) {
      return null;
    }
    const rect = trigger.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

}

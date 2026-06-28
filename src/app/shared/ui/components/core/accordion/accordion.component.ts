import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppMenuComponent, type AppMenuItemSelectEvent } from '../menu';
import type {
  UiAccordionActionMenu,
  UiAccordionActionMenuSelectEvent,
  UiAccordionBadge,
  UiAccordionItem,
  UiAccordionModel,
  UiAccordionSelectionToggleEvent,
  UiAccordionToggleEvent
} from './accordion.types';

@Component({
  selector: 'app-accordion',
  standalone: true,
  imports: [CommonModule, MatIconModule, AppMenuComponent],
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccordionComponent<TId extends string = string, TContext = unknown, TMenuContext = unknown> {
  @Input() model: UiAccordionModel<TId, TContext, TMenuContext> | null = null;
  @Input() itemTemplate: TemplateRef<unknown> | null = null;

  @Output() readonly itemToggle = new EventEmitter<UiAccordionToggleEvent<TId, TContext, TMenuContext>>();
  @Output() readonly itemSelectionToggle = new EventEmitter<UiAccordionSelectionToggleEvent<TId, TContext, TMenuContext>>();
  @Output() readonly itemActionSelect = new EventEmitter<UiAccordionActionMenuSelectEvent<TId, TContext, TMenuContext>>();

  protected items(): readonly UiAccordionItem<TId, TContext, TMenuContext>[] {
    return this.model?.items ?? [];
  }

  protected trackById(_: number, item: UiAccordionItem<TId, TContext, TMenuContext>): string {
    return item.id;
  }

  protected trackByBadge(index: number, badge: UiAccordionBadge): string {
    return badge.id ?? `${badge.icon ?? ''}:${badge.label}:${badge.palette ?? ''}:${index}`;
  }

  protected isOpen(item: UiAccordionItem<TId, TContext, TMenuContext>): boolean {
    return item.open === true;
  }

  protected isSelectable(item: UiAccordionItem<TId, TContext, TMenuContext>): boolean {
    return item.selectable === true;
  }

  protected isSelected(item: UiAccordionItem<TId, TContext, TMenuContext>): boolean {
    return item.selected === true;
  }

  protected selectionAriaLabel(item: UiAccordionItem<TId, TContext, TMenuContext>): string {
    return item.selectionAriaLabel?.trim()
      || `${this.isSelected(item) ? 'Deselect' : 'Select'} ${item.title}`;
  }

  protected actionMenu(item: UiAccordionItem<TId, TContext, TMenuContext>): UiAccordionActionMenu<TMenuContext> | null {
    return item.actionMenu ?? null;
  }

  protected badges(item: UiAccordionItem<TId, TContext, TMenuContext>): readonly UiAccordionBadge[] {
    const explicitBadges = item.badges?.filter(badge => this.hasBadgeValue(badge.label)) ?? [];
    if (explicitBadges.length > 0) {
      return explicitBadges;
    }
    if (!this.hasBadgeValue(item.badge)) {
      return [];
    }
    return [{ label: item.badge }];
  }

  protected toggle(item: UiAccordionItem<TId, TContext, TMenuContext>, event: Event): void {
    event.stopPropagation();
    if (item.disabled) {
      return;
    }
    this.itemToggle.emit({
      id: item.id,
      item,
      open: !this.isOpen(item),
      sourceEvent: event
    });
  }

  protected toggleSelection(item: UiAccordionItem<TId, TContext, TMenuContext>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (item.disabled || !this.isSelectable(item)) {
      return;
    }
    this.itemSelectionToggle.emit({
      id: item.id,
      item,
      selected: !this.isSelected(item),
      sourceEvent: event
    });
  }

  protected onActionMenuSelect(
    item: UiAccordionItem<TId, TContext, TMenuContext>,
    itemSelect: AppMenuItemSelectEvent<string, TMenuContext>
  ): void {
    this.itemActionSelect.emit({
      id: item.id,
      item,
      itemSelect,
      sourceEvent: itemSelect.sourceEvent
    });
  }

  protected itemPalette(item: UiAccordionItem<TId, TContext, TMenuContext>): string {
    return item.palette ?? 'default';
  }

  private hasBadgeValue(value: string | number | null | undefined): value is string | number {
    return value !== null && value !== undefined && `${value}`.trim() !== '';
  }
}

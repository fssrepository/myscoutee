import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { UiAccordionItem, UiAccordionModel, UiAccordionToggleEvent } from './accordion.types';

@Component({
  selector: 'app-accordion',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccordionComponent<TId extends string = string, TContext = unknown> {
  @Input() model: UiAccordionModel<TId, TContext> | null = null;
  @Input() itemTemplate: TemplateRef<unknown> | null = null;
  @Input() actionTemplate: TemplateRef<unknown> | null = null;

  @Output() readonly itemToggle = new EventEmitter<UiAccordionToggleEvent<TId, TContext>>();

  protected items(): readonly UiAccordionItem<TId, TContext>[] {
    return this.model?.items ?? [];
  }

  protected trackById(_: number, item: UiAccordionItem<TId, TContext>): string {
    return item.id;
  }

  protected isOpen(item: UiAccordionItem<TId, TContext>): boolean {
    return item.open === true;
  }

  protected toggle(item: UiAccordionItem<TId, TContext>, event: Event): void {
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

  protected itemPalette(item: UiAccordionItem<TId, TContext>): string {
    return item.palette ?? 'default';
  }
}

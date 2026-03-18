import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../lazy-bg-image.directive';
import type { CardBadgeConfig, CardImageSlide, CardPresentation, CardRenderState, PairCardSlot } from '../card.types';

export interface PairCardSlideSelectEvent {
  slotKey: string;
  index: number;
  event: Event;
}

export interface PairCardSplitHandleEvent<TEvent extends Event = Event> {
  event: TEvent;
  container: HTMLElement;
}

@Component({
  selector: 'app-pair-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective],
  templateUrl: './pair-card.component.html',
  styleUrl: './pair-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PairCardComponent {
  @ViewChild('splitContainer', { read: ElementRef })
  private splitContainerRef?: ElementRef<HTMLElement>;

  @Input() rowId = '';
  @Input() groupLabel: string | null = null;
  @Input() slots: readonly PairCardSlot[] = [];
  @Input() stackClasses: readonly string[] = [];
  @Input() activeIndexByKey: Readonly<Record<string, number>> | null = null;
  @Input() loadingByKey: Readonly<Record<string, boolean>> | null = null;
  @Input() interactive = true;
  @Input() presentation: CardPresentation = 'list';
  @Input() state: CardRenderState = 'default';
  @Input() badge: CardBadgeConfig | null = null;
  @Input() splitCssValue: string | null = null;
  @Input() isResizing = false;
  @Input() showSplitHandle = false;

  @Output() readonly slotSelect = new EventEmitter<PairCardSlideSelectEvent>();
  @Output() readonly badgeClick = new EventEmitter<MouseEvent>();
  @Output() readonly splitHandlePointerDown = new EventEmitter<PairCardSplitHandleEvent<PointerEvent>>();
  @Output() readonly splitHandleTouchStart = new EventEmitter<PairCardSplitHandleEvent<TouchEvent>>();

  protected trackBySlot(_index: number, slot: PairCardSlot): string {
    return slot.key;
  }

  protected trackBySlide(index: number, slide: CardImageSlide): string {
    return `${index}:${slide.imageUrl}`;
  }

  protected currentSlide(slot: PairCardSlot): CardImageSlide | null {
    if (slot.slides.length === 0) {
      return null;
    }
    const index = this.activeIndex(slot);
    return slot.slides[index] ?? slot.slides[0] ?? null;
  }

  protected activeIndex(slot: PairCardSlot): number {
    const rawIndex = this.activeIndexByKey?.[slot.key] ?? 0;
    if (slot.slides.length <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(rawIndex, slot.slides.length - 1));
  }

  protected isLoading(slot: PairCardSlot): boolean {
    return this.loadingByKey?.[slot.key] ?? false;
  }

  protected isBadgeInteractive(): boolean {
    return this.badge?.interactive !== false;
  }

  protected usesFloatingBadge(): boolean {
    const layout = this.badge?.layout ?? 'between';
    return layout === 'floating' || layout === 'pair-overlap';
  }

  protected usesBetweenBadge(): boolean {
    const layout = this.badge?.layout ?? 'between';
    return layout === 'between' || layout === 'pair-overlap';
  }

  protected usesPairOverlapBadge(): boolean {
    return (this.badge?.layout ?? 'between') === 'pair-overlap';
  }

  protected onSlotSelect(slot: PairCardSlot, index: number, event: Event): void {
    event.stopPropagation();
    this.slotSelect.emit({ slotKey: slot.key, index, event });
  }

  protected onBadgeClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isBadgeInteractive() || this.badge?.disabled) {
      return;
    }
    this.badgeClick.emit(event);
  }

  protected consumeClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected emitSplitHandlePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const container = this.splitContainerRef?.nativeElement;
    if (!container) {
      return;
    }
    this.splitHandlePointerDown.emit({ event, container });
  }

  protected emitSplitHandleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const container = this.splitContainerRef?.nativeElement;
    if (!container) {
      return;
    }
    this.splitHandleTouchStart.emit({ event, container });
  }
}

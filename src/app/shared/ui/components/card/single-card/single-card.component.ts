import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../lazy-bg-image.directive';
import type { CardBadgeConfig, CardImageSlide, CardPresentation, CardRenderState } from '../card.types';

export interface SingleCardSlideSelectEvent {
  index: number;
  event: Event;
}

@Component({
  selector: 'app-single-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective],
  templateUrl: './single-card.component.html',
  styleUrl: './single-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleCardComponent {
  @Input() rowId = '';
  @Input() groupLabel: string | null = null;
  @Input() slides: readonly CardImageSlide[] = [];
  @Input() stackClasses: readonly string[] = [];
  @Input() activeIndex = 0;
  @Input() loading = false;
  @Input() interactive = true;
  @Input() presentation: CardPresentation = 'list';
  @Input() state: CardRenderState = 'default';
  @Input() badge: CardBadgeConfig | null = null;

  @Output() readonly slideSelect = new EventEmitter<SingleCardSlideSelectEvent>();
  @Output() readonly badgeClick = new EventEmitter<MouseEvent>();

  protected trackBySlide(index: number, slide: CardImageSlide): string {
    return `${index}:${slide.imageUrl}`;
  }

  protected currentSlide(): CardImageSlide | null {
    if (this.slides.length === 0) {
      return null;
    }
    return this.slides[this.clampedActiveIndex()] ?? this.slides[0] ?? null;
  }

  protected clampedActiveIndex(): number {
    if (this.slides.length <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(this.activeIndex, this.slides.length - 1));
  }

  protected hasOverlay(slide: CardImageSlide | null): boolean {
    return !!slide?.primaryLine && !!slide?.secondaryLine;
  }

  protected isBadgeInteractive(): boolean {
    return this.badge?.interactive !== false;
  }

  protected usesFloatingBadge(): boolean {
    const layout = this.badge?.layout ?? 'floating';
    return layout === 'floating' || layout === 'pair-overlap';
  }

  protected usesBetweenBadge(): boolean {
    const layout = this.badge?.layout ?? 'floating';
    return layout === 'between' || layout === 'pair-overlap';
  }

  protected usesPairOverlapBadge(): boolean {
    return (this.badge?.layout ?? 'floating') === 'pair-overlap';
  }

  protected onSlideSelect(index: number, event: Event): void {
    event.stopPropagation();
    this.slideSelect.emit({ index, event });
  }

  protected onBadgeClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isBadgeInteractive() || this.badge?.disabled) {
      return;
    }
    this.badgeClick.emit(event);
  }
}

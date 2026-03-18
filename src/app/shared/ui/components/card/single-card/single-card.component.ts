import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../lazy-bg-image.directive';
import type { CardImageSlide, SingleCardData } from '../card.types';

@Component({
  selector: 'app-single-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective],
  templateUrl: './single-card.component.html',
  styleUrl: './single-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleCardComponent implements OnChanges, OnDestroy {
  private static readonly IMAGE_PULSE_DURATION_MS = 500;
  private static readonly activeIndexByRowId: Record<string, number> = {};

  private readonly cdr = inject(ChangeDetectorRef);
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private previousRowId = '';
  private previousBadgeActive = false;

  @Input() card: SingleCardData | null = null;

  @Output() readonly badgeClick = new EventEmitter<string>();

  protected activeIndex = 0;
  protected loading = false;

  @HostBinding('attr.data-card-presentation')
  protected get hostPresentationAttr(): string {
    return this.resolvedPresentation();
  }

  @HostBinding('style.height')
  protected get hostHeight(): string | null {
    return this.resolvedPresentation() === 'fullscreen' ? '100%' : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['card']) {
      return;
    }

    const rowId = this.card?.rowId ?? '';
    const badgeActive = !!this.card?.badge?.active;

    if (rowId !== this.previousRowId) {
      this.syncStateFromCard();
    }

    if (badgeActive && (!this.previousBadgeActive || rowId !== this.previousRowId)) {
      this.startLoadingPulse();
    }

    this.previousRowId = rowId;
    this.previousBadgeActive = badgeActive;
  }

  ngOnDestroy(): void {
    if (!this.loadingTimer) {
      return;
    }
    clearTimeout(this.loadingTimer);
    this.loadingTimer = null;
  }

  protected trackBySlide(index: number, slide: CardImageSlide): string {
    return `${index}:${slide.imageUrl}`;
  }

  protected resolvedPresentation(): 'list' | 'fullscreen' {
    return this.card?.presentation ?? 'list';
  }

  protected resolvedState(): 'default' | 'active' | 'leaving' {
    return this.card?.state ?? 'default';
  }

  protected resolvedSlides(): readonly CardImageSlide[] {
    return this.card?.slides ?? [];
  }

  protected resolvedStackClasses(): readonly string[] {
    return this.card?.stackClasses ?? [];
  }

  protected currentSlide(): CardImageSlide | null {
    const slides = this.resolvedSlides();
    if (slides.length === 0) {
      return null;
    }
    return slides[this.clampedActiveIndex()] ?? slides[0] ?? null;
  }

  protected clampedActiveIndex(): number {
    const slides = this.resolvedSlides();
    if (slides.length <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(this.activeIndex, slides.length - 1));
  }

  protected hasOverlay(slide: CardImageSlide | null): boolean {
    return !!slide?.primaryLine && !!slide?.secondaryLine;
  }

  protected isInteractive(): boolean {
    return this.resolvedPresentation() === 'list' || this.resolvedState() === 'active';
  }

  protected isBadgeInteractive(): boolean {
    return this.card?.badge?.interactive !== false;
  }

  protected usesFloatingBadge(): boolean {
    const layout = this.card?.badge?.layout ?? 'floating';
    return layout === 'floating' || layout === 'pair-overlap';
  }

  protected usesBetweenBadge(): boolean {
    const layout = this.card?.badge?.layout ?? 'floating';
    return layout === 'between' || layout === 'pair-overlap';
  }

  protected usesPairOverlapBadge(): boolean {
    return (this.card?.badge?.layout ?? 'floating') === 'pair-overlap';
  }

  protected onSlideSelect(index: number, event: Event): void {
    event.stopPropagation();
    if (!this.isInteractive()) {
      return;
    }
    this.activeIndex = this.clampIndex(index);
    if (this.card?.rowId) {
      SingleCardComponent.activeIndexByRowId[this.card.rowId] = this.activeIndex;
    }
    this.startLoadingPulse();
  }

  protected onBadgeClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isBadgeInteractive() || this.card?.badge?.disabled || !this.card?.rowId) {
      return;
    }
    this.badgeClick.emit(this.card.rowId);
  }

  private syncStateFromCard(): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    const rowId = this.card?.rowId ?? '';
    const storedIndex = rowId ? SingleCardComponent.activeIndexByRowId[rowId] : undefined;
    const initialIndex = storedIndex ?? this.card?.initialActiveIndex ?? 0;
    this.activeIndex = this.clampIndex(initialIndex);
    this.loading = false;
    this.cdr.markForCheck();
  }

  private clampIndex(index: number): number {
    const slides = this.resolvedSlides();
    if (slides.length <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(index, slides.length - 1));
  }

  private startLoadingPulse(): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    this.loading = true;
    this.cdr.markForCheck();
    this.loadingTimer = setTimeout(() => {
      this.loading = false;
      this.loadingTimer = null;
      this.cdr.markForCheck();
    }, SingleCardComponent.IMAGE_PULSE_DURATION_MS);
  }
}

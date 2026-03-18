import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../lazy-bg-image.directive';
import type { CardImageSlide, PairCardData, PairCardSlot } from '../card.types';

@Component({
  selector: 'app-pair-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective],
  templateUrl: './pair-card.component.html',
  styleUrl: './pair-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PairCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly IMAGE_PULSE_DURATION_MS = 500;
  private static readonly MOBILE_FULLSCREEN_ASPECT_RATIO = 3 / 4;
  private static readonly FULLSCREEN_ASPECT_RATIO = 5 / 4;
  private static readonly SPLIT_DEFAULT_PERCENT = 50;
  private static readonly SPLIT_MIN_PERCENT = 0;
  private static readonly SPLIT_MAX_PERCENT = 100;
  private static readonly activeIndexByRowSlotKey: Record<string, number> = {};
  private static lastCompactSplitPercent = PairCardComponent.SPLIT_DEFAULT_PERCENT;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly loadingTimersByKey: Record<string, ReturnType<typeof setTimeout>> = {};
  private fullscreenResizeObserver: ResizeObserver | null = null;
  private previousRowId = '';
  private previousBadgeActive = false;
  private splitPointerId: number | null = null;
  private splitBounds: { left: number; width: number } | null = null;
  private splitDragStartClientX: number | null = null;
  private splitDragStartPercent: number | null = null;
  private dragListenersBound = false;
  private fullscreenShellElementRef?: ElementRef<HTMLElement>;
  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    if (!this.isResizing || this.splitPointerId !== event.pointerId) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.updateSplitFromDragDelta(event.clientX);
  };
  private readonly onWindowPointerUp = (event: PointerEvent): void => {
    if (this.splitPointerId !== event.pointerId) {
      return;
    }
    this.stopSplitDrag();
  };
  private readonly onWindowPointerCancel = (event: PointerEvent): void => {
    if (this.splitPointerId !== event.pointerId) {
      return;
    }
    this.stopSplitDrag();
  };
  private readonly onWindowTouchMove = (event: TouchEvent): void => {
    if (!this.isResizing || this.splitPointerId !== -1) {
      return;
    }
    const touch = event.touches?.[0] ?? event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.updateSplitFromDragDelta(touch.clientX);
  };
  private readonly onWindowTouchEnd = (event: TouchEvent): void => {
    if (this.splitPointerId !== -1 || !event.changedTouches?.length) {
      return;
    }
    this.stopSplitDrag();
  };
  private readonly onWindowTouchCancel = (event: TouchEvent): void => {
    if (this.splitPointerId !== -1 || !event.changedTouches?.length) {
      return;
    }
    this.stopSplitDrag();
  };

  @Input() card: PairCardData | null = null;

  @Output() readonly badgeClick = new EventEmitter<string>();

  protected readonly activeIndexByKey: Record<string, number> = {};
  protected readonly loadingByKey: Record<string, boolean> = {};
  protected splitPercent = PairCardComponent.SPLIT_DEFAULT_PERCENT;
  protected isResizing = false;
  protected fullscreenCardWidth: string | null = null;
  protected fullscreenCardHeight: string | null = null;

  @ViewChild('fullscreenShell', { read: ElementRef })
  protected set fullscreenShellRef(value: ElementRef<HTMLElement> | undefined) {
    this.fullscreenShellElementRef = value;
    this.bindFullscreenObserver();
    this.scheduleFullscreenLayoutSync();
  }

  @HostBinding('attr.data-card-presentation')
  protected get hostPresentationAttr(): string {
    return this.resolvedPresentation();
  }

  @HostBinding('style.height')
  protected get hostHeight(): string | null {
    return this.resolvedPresentation() === 'fullscreen' ? '100%' : null;
  }

  ngAfterViewInit(): void {
    this.bindFullscreenObserver();
    this.scheduleFullscreenLayoutSync();
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
      this.pulseAllSlots();
    }

    this.previousRowId = rowId;
    this.previousBadgeActive = badgeActive;
    this.scheduleFullscreenLayoutSync();
  }

  ngOnDestroy(): void {
    Object.values(this.loadingTimersByKey).forEach(timer => clearTimeout(timer));
    this.disconnectFullscreenObserver();
    this.stopSplitDrag();
  }

  protected trackBySlot(_index: number, slot: PairCardSlot): string {
    return slot.key;
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

  protected resolvedSlots(): readonly PairCardSlot[] {
    return this.card?.slots ?? [];
  }

  protected resolvedStackClasses(): readonly string[] {
    return this.card?.stackClasses ?? [];
  }

  protected currentSlide(slot: PairCardSlot): CardImageSlide | null {
    if (slot.slides.length === 0) {
      return null;
    }
    return slot.slides[this.activeIndex(slot)] ?? slot.slides[0] ?? null;
  }

  protected activeIndex(slot: PairCardSlot): number {
    const rawIndex = this.activeIndexByKey[slot.key] ?? 0;
    if (slot.slides.length <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(rawIndex, slot.slides.length - 1));
  }

  protected isLoading(slot: PairCardSlot): boolean {
    return this.loadingByKey[slot.key] ?? false;
  }

  protected isInteractive(): boolean {
    return this.resolvedPresentation() === 'list' || this.resolvedState() === 'active';
  }

  protected isBadgeInteractive(): boolean {
    return this.card?.badge?.interactive !== false;
  }

  protected usesFloatingBadge(): boolean {
    const layout = this.card?.badge?.layout ?? 'between';
    return layout === 'floating' || layout === 'pair-overlap';
  }

  protected usesBetweenBadge(): boolean {
    const layout = this.card?.badge?.layout ?? 'between';
    return layout === 'between' || layout === 'pair-overlap';
  }

  protected usesPairOverlapBadge(): boolean {
    return (this.card?.badge?.layout ?? 'between') === 'pair-overlap';
  }

  protected resolvedSplitCssValue(): string {
    if (!this.isCompactViewport()) {
      return `${PairCardComponent.SPLIT_DEFAULT_PERCENT}%`;
    }
    return `${this.splitPercent}%`;
  }

  protected isSplitEnabled(): boolean {
    return this.resolvedPresentation() === 'fullscreen'
      && this.resolvedState() === 'active'
      && this.isCompactViewport()
      && (this.card?.split?.enabled ?? true);
  }

  protected isSlotCollapsed(slot: PairCardSlot): boolean {
    if (!this.isSplitEnabled()) {
      return false;
    }
    if (slot.key === 'woman') {
      return this.splitPercent <= 0.1;
    }
    if (slot.key === 'man') {
      return this.splitPercent >= 99.9;
    }
    return !!slot.collapsed;
  }

  protected onSlotSelect(slot: PairCardSlot, index: number, event: Event): void {
    event.stopPropagation();
    if (!this.isInteractive()) {
      return;
    }
    const nextIndex = this.clampIndex(index, slot.slides.length);
    this.activeIndexByKey[slot.key] = nextIndex;
    if (this.card?.rowId) {
      PairCardComponent.activeIndexByRowSlotKey[this.rowSlotKey(this.card.rowId, slot.key)] = nextIndex;
    }
    this.startLoadingPulse(slot.key);
  }

  protected onBadgeClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isBadgeInteractive() || this.card?.badge?.disabled || !this.card?.rowId) {
      return;
    }
    this.badgeClick.emit(this.card.rowId);
  }

  protected consumeClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onSplitHandlePointerDown(event: PointerEvent, splitContainerElement: HTMLElement): void {
    if (!this.isSplitEnabled() || !splitContainerElement) {
      return;
    }
    const bounds = splitContainerElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    this.splitBounds = { left: bounds.left, width: bounds.width };
    this.splitPointerId = event.pointerId;
    this.splitDragStartClientX = event.clientX;
    this.splitDragStartPercent = this.splitPercent;
    this.isResizing = true;
    this.bindDragListeners();
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement | null;
    if (target?.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }
    this.cdr.markForCheck();
  }

  protected onSplitHandleTouchStart(event: TouchEvent, splitContainerElement: HTMLElement): void {
    if (!this.isSplitEnabled() || !splitContainerElement) {
      return;
    }
    const touch = event.touches?.[0] ?? event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    const bounds = splitContainerElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    this.splitBounds = { left: bounds.left, width: bounds.width };
    this.splitPointerId = -1;
    this.splitDragStartClientX = touch.clientX;
    this.splitDragStartPercent = this.splitPercent;
    this.isResizing = true;
    this.bindDragListeners();
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    this.cdr.markForCheck();
  }

  private syncStateFromCard(): void {
    const rowId = this.card?.rowId ?? '';
    Object.values(this.loadingTimersByKey).forEach(timer => clearTimeout(timer));
    Object.keys(this.loadingTimersByKey).forEach(key => delete this.loadingTimersByKey[key]);
    Object.keys(this.activeIndexByKey).forEach(key => delete this.activeIndexByKey[key]);
    Object.keys(this.loadingByKey).forEach(key => delete this.loadingByKey[key]);

    this.resolvedSlots().forEach(slot => {
      const storedIndex = rowId ? PairCardComponent.activeIndexByRowSlotKey[this.rowSlotKey(rowId, slot.key)] : undefined;
      const initialIndex = storedIndex ?? this.card?.initialActiveIndexByKey?.[slot.key] ?? 0;
      this.activeIndexByKey[slot.key] = this.clampIndex(initialIndex, slot.slides.length);
    });

    this.splitPercent = this.card?.split?.initialPercent ?? PairCardComponent.lastCompactSplitPercent;
    this.isResizing = false;
    this.stopSplitDrag();
    this.cdr.markForCheck();
  }

  private pulseAllSlots(): void {
    this.resolvedSlots().forEach(slot => this.startLoadingPulse(slot.key));
  }

  private startLoadingPulse(slotKey: string): void {
    const timer = this.loadingTimersByKey[slotKey];
    if (timer) {
      clearTimeout(timer);
    }
    this.loadingByKey[slotKey] = true;
    this.cdr.markForCheck();
    this.loadingTimersByKey[slotKey] = setTimeout(() => {
      this.loadingByKey[slotKey] = false;
      delete this.loadingTimersByKey[slotKey];
      this.cdr.markForCheck();
    }, PairCardComponent.IMAGE_PULSE_DURATION_MS);
  }

  private clampIndex(index: number, slideCount: number): number {
    if (slideCount <= 1) {
      return 0;
    }
    return Math.max(0, Math.min(index, slideCount - 1));
  }

  private rowSlotKey(rowId: string, slotKey: string): string {
    return `${rowId}:${slotKey}`;
  }

  private isCompactViewport(): boolean {
    return typeof globalThis.innerWidth === 'number' && globalThis.innerWidth <= 760;
  }

  private updateSplitFromDragDelta(clientX: number): void {
    if (!this.splitBounds || this.splitBounds.width <= 0) {
      return;
    }
    const startX = this.splitDragStartClientX;
    const startPercent = this.splitDragStartPercent;
    if (startX === null || startPercent === null) {
      return;
    }
    const deltaPercent = ((clientX - startX) / this.splitBounds.width) * 100;
    this.splitPercent = Math.max(
      PairCardComponent.SPLIT_MIN_PERCENT,
      Math.min(startPercent + deltaPercent, PairCardComponent.SPLIT_MAX_PERCENT)
    );
    PairCardComponent.lastCompactSplitPercent = this.splitPercent;
    this.cdr.detectChanges();
  }

  private stopSplitDrag(): void {
    this.unbindDragListeners();
    this.isResizing = false;
    this.splitPointerId = null;
    this.splitBounds = null;
    this.splitDragStartClientX = null;
    this.splitDragStartPercent = null;
    this.cdr.detectChanges();
  }

  private bindDragListeners(): void {
    if (this.dragListenersBound || typeof globalThis.addEventListener !== 'function') {
      return;
    }
    globalThis.addEventListener('pointermove', this.onWindowPointerMove);
    globalThis.addEventListener('pointerup', this.onWindowPointerUp);
    globalThis.addEventListener('pointercancel', this.onWindowPointerCancel);
    globalThis.addEventListener('touchmove', this.onWindowTouchMove, { passive: false });
    globalThis.addEventListener('touchend', this.onWindowTouchEnd);
    globalThis.addEventListener('touchcancel', this.onWindowTouchCancel);
    this.dragListenersBound = true;
  }

  private unbindDragListeners(): void {
    if (!this.dragListenersBound || typeof globalThis.removeEventListener !== 'function') {
      return;
    }
    globalThis.removeEventListener('pointermove', this.onWindowPointerMove);
    globalThis.removeEventListener('pointerup', this.onWindowPointerUp);
    globalThis.removeEventListener('pointercancel', this.onWindowPointerCancel);
    globalThis.removeEventListener('touchmove', this.onWindowTouchMove);
    globalThis.removeEventListener('touchend', this.onWindowTouchEnd);
    globalThis.removeEventListener('touchcancel', this.onWindowTouchCancel);
    this.dragListenersBound = false;
  }

  private bindFullscreenObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const shell = this.fullscreenShellElementRef?.nativeElement;
    if (!shell) {
      this.disconnectFullscreenObserver();
      return;
    }
    if (!this.fullscreenResizeObserver) {
      this.fullscreenResizeObserver = new ResizeObserver(() => this.updateFullscreenCardSize());
    }
    this.fullscreenResizeObserver.disconnect();
    this.fullscreenResizeObserver.observe(shell);
  }

  private disconnectFullscreenObserver(): void {
    if (!this.fullscreenResizeObserver) {
      return;
    }
    this.fullscreenResizeObserver.disconnect();
    this.fullscreenResizeObserver = null;
  }

  private scheduleFullscreenLayoutSync(): void {
    if (this.resolvedPresentation() !== 'fullscreen') {
      this.setFullscreenCardSize(null, null);
      return;
    }
    const sync = () => this.updateFullscreenCardSize();
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => sync());
      return;
    }
    setTimeout(sync, 0);
  }

  private updateFullscreenCardSize(): void {
    if (this.resolvedPresentation() !== 'fullscreen') {
      this.setFullscreenCardSize(null, null);
      return;
    }
    const shell = this.fullscreenShellElementRef?.nativeElement;
    if (!shell) {
      return;
    }
    const availableWidth = shell.clientWidth;
    const availableHeight = shell.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }
    const aspectRatio = this.isCompactViewport()
      ? PairCardComponent.MOBILE_FULLSCREEN_ASPECT_RATIO
      : PairCardComponent.FULLSCREEN_ASPECT_RATIO;
    const nextWidth = Math.min(availableWidth, availableHeight * aspectRatio);
    const nextHeight = nextWidth / aspectRatio;
    this.setFullscreenCardSize(`${nextWidth}px`, `${nextHeight}px`);
  }

  private setFullscreenCardSize(width: string | null, height: string | null): void {
    if (this.fullscreenCardWidth === width && this.fullscreenCardHeight === height) {
      return;
    }
    this.fullscreenCardWidth = width;
    this.fullscreenCardHeight = height;
    this.cdr.markForCheck();
  }
}

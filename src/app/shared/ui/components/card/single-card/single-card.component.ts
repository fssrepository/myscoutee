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

import { LazyBgImageDirective } from '../../../directives/lazy-bg-image.directive';
import { ProgressIndicatorComponent } from '../../progress-indicator';
import type {
  CardContextBadgeConfig,
  CardImageSlide,
  CardMenuRequestEvent,
  CardMenuTriggerRect,
  CardProfileViewData,
  SingleCardData
} from '../card.types';

@Component({
  selector: 'app-single-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, ProgressIndicatorComponent],
  templateUrl: './single-card.component.html',
  styleUrl: './single-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly IMAGE_PULSE_DURATION_MS = 500;
  private static readonly BADGE_BLINK_DURATION_MS = 420;
  private static readonly FULLSCREEN_ASPECT_RATIO = 3 / 4;
  private static readonly activeIndexByRowId: Record<string, number> = {};

  private readonly cdr = inject(ChangeDetectorRef);
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private badgeBlinkTimer: ReturnType<typeof setTimeout> | null = null;
  private fullscreenResizeObserver: ResizeObserver | null = null;
  private previousRowId = '';
  private previousBadgeLabel = '';
  private fullscreenShellElementRef?: ElementRef<HTMLElement>;

  @Input() card: SingleCardData | null = null;

  @Output() readonly badgeClick = new EventEmitter<string>();
  @Output() readonly menuRequest = new EventEmitter<CardMenuRequestEvent<SingleCardData>>();
  @Output() readonly detailClick = new EventEmitter<CardProfileViewData>();

  protected activeIndex = 0;
  protected loading = false;
  protected transientBadgeBlink = false;
  protected badgeMenuOpen = false;
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
    const badgeLabel = this.card?.badge?.label ?? '';

    if (rowId !== this.previousRowId) {
      this.syncStateFromCard();
    }

    if (rowId === this.previousRowId && badgeLabel !== this.previousBadgeLabel && this.card?.badge?.blink !== true) {
      this.startTransientBadgeBlink();
    }

    this.previousRowId = rowId;
    this.previousBadgeLabel = badgeLabel;
    this.scheduleFullscreenLayoutSync();
  }

  ngOnDestroy(): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.badgeBlinkTimer) {
      clearTimeout(this.badgeBlinkTimer);
      this.badgeBlinkTimer = null;
    }
    this.disconnectFullscreenObserver();
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

  protected contextBadgeLabel(badge: CardContextBadgeConfig): string {
    return badge.label.trim().slice(0, 3).toUpperCase();
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

  protected isBadgeBlinking(): boolean {
    return !!this.card?.badge?.blink || this.transientBadgeBlink;
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

  protected onBadgePointerDown(event: Event): void {
    event.stopPropagation();
  }

  protected onBadgeClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const card = this.card;
    const badge = card?.badge;
    if (!this.isBadgeInteractive() || badge?.disabled || !card?.rowId || !badge) {
      return;
    }
    if (badge.menuRequest === true) {
      const trigger = event.currentTarget as HTMLElement | null;
      this.badgeMenuOpen = true;
      this.cdr.markForCheck();
      this.menuRequest.emit({
        id: card.rowId,
        card,
        actions: [],
        badge,
        triggerRect: this.resolveBadgeTriggerRect(trigger),
        openUp: this.shouldOpenBadgeMenuUp(trigger),
        closeTrigger: () => this.closeBadgeMenu()
      });
      return;
    }
    this.badgeClick.emit(card.rowId);
  }

  protected onProfileClick(profileView: CardProfileViewData | null | undefined, event: MouseEvent): void {
    event.stopPropagation();
    const userId = `${profileView?.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    this.emitDetailClick({
      ...profileView,
      userId
    });
  }

  protected onContextBadgeClick(badge: CardContextBadgeConfig, event: MouseEvent): void {
    event.stopPropagation();
    const profileView = badge.profileView;
    const userId = `${profileView?.userId ?? ''}`.trim();
    if (!profileView || !userId) {
      return;
    }
    this.emitDetailClick({
      ...profileView,
      userId
    });
  }

  private emitDetailClick(event: CardProfileViewData): void {
    this.detailClick.emit(event);
  }

  private syncStateFromCard(): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.badgeBlinkTimer) {
      clearTimeout(this.badgeBlinkTimer);
      this.badgeBlinkTimer = null;
    }
    const rowId = this.card?.rowId ?? '';
    const storedIndex = rowId ? SingleCardComponent.activeIndexByRowId[rowId] : undefined;
    const initialIndex = storedIndex ?? this.card?.initialActiveIndex ?? 0;
    this.activeIndex = this.clampIndex(initialIndex);
    this.loading = false;
    this.transientBadgeBlink = false;
    this.badgeMenuOpen = false;
    this.cdr.markForCheck();
  }

  private closeBadgeMenu(): void {
    if (!this.badgeMenuOpen) {
      return;
    }
    this.badgeMenuOpen = false;
    this.cdr.markForCheck();
  }

  private shouldOpenBadgeMenuUp(trigger: HTMLElement | null): boolean {
    if (typeof window === 'undefined' || !trigger) {
      return false;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 128;
    return viewportHeight - rect.bottom < estimatedMenuHeight && rect.top > viewportHeight - rect.bottom;
  }

  private resolveBadgeTriggerRect(trigger: HTMLElement | null): CardMenuTriggerRect | null {
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

  private startTransientBadgeBlink(): void {
    if (this.badgeBlinkTimer) {
      clearTimeout(this.badgeBlinkTimer);
      this.badgeBlinkTimer = null;
    }
    this.transientBadgeBlink = false;
    this.cdr.detectChanges();

    const startBlink = () => {
      this.transientBadgeBlink = true;
      this.cdr.detectChanges();
      this.badgeBlinkTimer = setTimeout(() => {
        this.badgeBlinkTimer = null;
        this.transientBadgeBlink = false;
        this.cdr.detectChanges();
      }, SingleCardComponent.BADGE_BLINK_DURATION_MS);
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
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
    const nextWidth = Math.min(availableWidth, availableHeight * SingleCardComponent.FULLSCREEN_ASPECT_RATIO);
    const nextHeight = nextWidth / SingleCardComponent.FULLSCREEN_ASPECT_RATIO;
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

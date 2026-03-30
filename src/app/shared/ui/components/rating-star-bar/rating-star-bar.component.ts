import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, OnDestroy, Output, inject } from '@angular/core';

export type RatingStarBarPresentation = 'list' | 'fullscreen';
export type RatingStarBarAnimation = 'default' | 'blink' | 'none';
export type RatingStarBarDockState = 'hidden' | 'open' | 'closing' | 'permanent';

export interface RatingStarBarDockConfig {
  enabled?: boolean;
  state?: RatingStarBarDockState;
}

export interface RatingStarBarConfig {
  scale?: readonly number[];
  readonly?: boolean;
  label?: string | null;
  presentation?: RatingStarBarPresentation;
  animation?: RatingStarBarAnimation;
  blinkOnSelect?: boolean;
  dock?: RatingStarBarDockConfig | null;
}

@Component({
  selector: 'app-rating-star-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-star-bar.component.html',
  styleUrl: './rating-star-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatingStarBarComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private transientBlink = false;

  @HostBinding('class.rating-star-bar-host')
  protected readonly hostClass = true;

  @HostBinding('class.rating-star-bar-host--dockable')
  protected get hostDockableClass(): boolean {
    return this.dockEnabled;
  }

  @HostBinding('class.rating-star-bar-host--dock-open')
  protected get hostDockOpenClass(): boolean {
    return this.dockEnabled && this.dockState === 'open';
  }

  @HostBinding('class.rating-star-bar-host--dock-closing')
  protected get hostDockClosingClass(): boolean {
    return this.dockEnabled && this.dockState === 'closing';
  }

  @HostBinding('class.rating-star-bar-host--dock-permanent')
  protected get hostDockPermanentClass(): boolean {
    return this.dockEnabled && this.dockState === 'permanent';
  }

  @HostBinding('attr.data-rating-star-bar-dock')
  protected get hostDockAttr(): string | null {
    return this.dockEnabled ? 'true' : null;
  }

  @Input() config: RatingStarBarConfig | null = null;
  @Input() value = 0;

  @Output() readonly scoreSelect = new EventEmitter<number>();

  protected get resolvedScale(): readonly number[] {
    return this.config?.scale ?? [];
  }

  protected get resolvedReadonly(): boolean {
    return this.config?.readonly ?? false;
  }

  protected get resolvedLabel(): string | null {
    return this.config?.label ?? null;
  }

  protected get resolvedPresentation(): RatingStarBarPresentation {
    return this.config?.presentation ?? 'list';
  }

  protected get resolvedAnimation(): RatingStarBarAnimation {
    if (this.transientBlink) {
      return 'blink';
    }
    return this.config?.animation ?? 'default';
  }

  protected get dockEnabled(): boolean {
    return this.config?.dock?.enabled ?? false;
  }

  protected get dockState(): RatingStarBarDockState {
    return this.dockEnabled ? (this.config?.dock?.state ?? 'hidden') : 'hidden';
  }

  protected selectScore(score: number, event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly) {
      return;
    }
    if (this.config?.blinkOnSelect !== false) {
      this.triggerTransientBlink();
    }
    this.scoreSelect.emit(score);
  }

  protected isFilled(score: number): boolean {
    return score <= this.value;
  }

  ngOnDestroy(): void {
    if (!this.blinkTimer) {
      return;
    }
    clearTimeout(this.blinkTimer);
    this.blinkTimer = null;
  }

  private triggerTransientBlink(): void {
    if (this.config?.animation === 'none') {
      return;
    }
    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
    this.transientBlink = false;
    this.cdr.markForCheck();
    const startBlink = () => {
      this.transientBlink = true;
      this.cdr.markForCheck();
      this.blinkTimer = setTimeout(() => {
        this.blinkTimer = null;
        this.transientBlink = false;
        this.cdr.markForCheck();
      }, 420);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => startBlink());
      return;
    }
    setTimeout(() => startBlink(), 0);
  }
}

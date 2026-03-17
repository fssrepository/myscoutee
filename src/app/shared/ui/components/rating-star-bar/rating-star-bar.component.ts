import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';

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
export class RatingStarBarComponent {
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
    this.scoreSelect.emit(score);
  }

  protected isFilled(score: number): boolean {
    return score <= this.value;
  }
}

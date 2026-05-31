import { ChangeDetectionStrategy, Component, HostBinding, Input, inject } from '@angular/core';

import { AppContext } from '../../../core';

export type ProgressIndicatorKind = 'bar' | 'load-ring' | 'action-ring';
export type ProgressIndicatorPlacement = 'edge' | 'inline';
export type ProgressIndicatorShape = 'circle' | 'button';
export type ProgressIndicatorSize = 'sm' | 'md';
export type ProgressIndicatorState = 'idle' | 'scrolling' | 'loading' | 'loading-overdue' | 'error' | 'success' | 'offline';
export type ProgressIndicatorTone = 'default' | 'chat' | 'accent' | 'danger' | 'success';

export interface ProgressIndicatorBarConfig {
  position?: number;
  state?: ProgressIndicatorState;
  tone?: ProgressIndicatorTone;
  placement?: ProgressIndicatorPlacement;
}

let progressIndicatorId = 0;

@Component({
  selector: 'app-progress-indicator',
  standalone: true,
  imports: [],
  templateUrl: './progress-indicator.component.html',
  styleUrl: './progress-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressIndicatorComponent {
  private readonly appCtx = inject(AppContext);

  @Input() kind: ProgressIndicatorKind = 'bar';
  @Input() placement: ProgressIndicatorPlacement = 'edge';
  @Input() shape: ProgressIndicatorShape = 'circle';
  @Input() size: ProgressIndicatorSize = 'md';
  @Input() state: ProgressIndicatorState = 'scrolling';
  @Input() tone: ProgressIndicatorTone = 'default';
  @Input() position = 0;
  @Input() perimeter = 100;
  @Input() durationMs = 3000;

  protected readonly actionGradientId = `app-progress-action-gradient-${++progressIndicatorId}`;
  protected readonly actionErrorGradientId = `app-progress-action-error-gradient-${progressIndicatorId}`;
  protected readonly actionAccentGradientId = `app-progress-action-accent-gradient-${progressIndicatorId}`;

  @HostBinding('class.app-progress-indicator-host')
  protected readonly hostClass = true;

  @HostBinding('class.app-progress-indicator-host--kind-bar')
  protected get hostBarKindClass(): boolean {
    return this.kind === 'bar';
  }

  @HostBinding('class.app-progress-indicator-host--kind-load-ring')
  protected get hostLoadRingKindClass(): boolean {
    return this.kind === 'load-ring';
  }

  @HostBinding('class.app-progress-indicator-host--kind-action-ring')
  protected get hostActionRingKindClass(): boolean {
    return this.kind === 'action-ring';
  }

  @HostBinding('class.app-progress-indicator-host--placement-edge')
  protected get hostEdgePlacementClass(): boolean {
    return this.placement === 'edge';
  }

  @HostBinding('class.app-progress-indicator-host--placement-inline')
  protected get hostInlinePlacementClass(): boolean {
    return this.placement === 'inline';
  }

  @HostBinding('class.app-progress-indicator-host--shape-button')
  protected get hostButtonShapeClass(): boolean {
    return this.shape === 'button';
  }

  @HostBinding('class.app-progress-indicator-host--shape-circle')
  protected get hostCircleShapeClass(): boolean {
    return this.shape === 'circle';
  }

  @HostBinding('class.app-progress-indicator-host--size-sm')
  protected get hostSmallSizeClass(): boolean {
    return this.size === 'sm';
  }

  @HostBinding('class.app-progress-indicator-host--size-md')
  protected get hostMediumSizeClass(): boolean {
    return this.size === 'md';
  }

  @HostBinding('class.app-progress-indicator-host--tone-chat')
  protected get hostChatToneClass(): boolean {
    return this.tone === 'chat';
  }

  @HostBinding('style.--app-progress-duration')
  protected get durationStyle(): string {
    return `${Math.max(0, Math.trunc(Number(this.durationMs) || 0))}ms`;
  }

  @HostBinding('attr.aria-hidden')
  protected readonly ariaHidden = 'true';

  protected get isBarKind(): boolean {
    return this.kind === 'bar';
  }

  protected get isLoadRingKind(): boolean {
    return this.kind === 'load-ring';
  }

  protected get isActionRingKind(): boolean {
    return this.kind === 'action-ring';
  }

  protected get isActionButtonShape(): boolean {
    return this.shape === 'button';
  }

  protected get isLoadingState(): boolean {
    return this.resolvedState === 'loading';
  }

  protected get isLoadingOverdueState(): boolean {
    return this.resolvedState === 'loading-overdue';
  }

  protected get isErrorState(): boolean {
    return this.resolvedState === 'error';
  }

  protected get isSuccessState(): boolean {
    return this.resolvedState === 'success';
  }

  protected get isOfflineState(): boolean {
    return this.resolvedState === 'offline';
  }

  protected get isScrollingState(): boolean {
    return this.resolvedState === 'scrolling';
  }

  protected get resolvedState(): ProgressIndicatorState {
    if (this.kind === 'bar' && !this.appCtx.isOnline()) {
      return 'offline';
    }
    return this.state;
  }

  protected progressTransform(): string {
    if (this.isOfflineState) {
      return 'scaleX(1)';
    }
    return `scaleX(${this.clampUnit(this.position)})`;
  }

  protected loadRingDashOffset(): number {
    return this.resolvedPerimeter * (1 - this.clampUnit(this.position));
  }

  protected actionRingDashOffset(): number {
    return this.isErrorState || this.isSuccessState ? 0 : this.resolvedPerimeter;
  }

  protected actionProgressStroke(): string {
    if (this.isErrorState) {
      return `url(#${this.actionErrorGradientId})`;
    }
    if (this.isSuccessState || this.tone === 'success') {
      return '#2f8f5b';
    }
    if (this.tone === 'accent') {
      return `url(#${this.actionAccentGradientId})`;
    }
    if (this.tone === 'danger') {
      return `url(#${this.actionErrorGradientId})`;
    }
    return `url(#${this.actionGradientId})`;
  }

  protected get resolvedPerimeter(): number {
    const value = Number(this.perimeter);
    return Number.isFinite(value) && value > 0 ? value : 100;
  }

  private clampUnit(value: number): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, numericValue));
  }
}

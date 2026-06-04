import { ChangeDetectionStrategy, Component, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';

import { AppContext } from '../../../core';

export type ProgressIndicatorKind = 'bar' | 'load-ring' | 'action-ring' | 'spinner-ring';
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
export class ProgressIndicatorComponent implements OnChanges, OnDestroy {
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
  @Input() autoProgress = true;

  protected readonly actionGradientId = `app-progress-action-gradient-${++progressIndicatorId}`;
  protected readonly actionErrorGradientId = `app-progress-action-error-gradient-${progressIndicatorId}`;
  protected readonly actionAccentGradientId = `app-progress-action-accent-gradient-${progressIndicatorId}`;
  private readonly timedLoadPosition = signal(0);
  private timedLoadStartedAtMs = 0;
  private timedLoadFrameId: number | null = null;
  private timedLoadTimerId: ReturnType<typeof setTimeout> | null = null;
  private manualPositionInput = false;

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

  @HostBinding('class.app-progress-indicator-host--kind-spinner-ring')
  protected get hostSpinnerRingKindClass(): boolean {
    return this.kind === 'spinner-ring';
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['position']) {
      this.manualPositionInput = true;
    }
    this.syncTimedLoadProgress();
  }

  ngOnDestroy(): void {
    this.clearTimedLoadProgress();
  }

  protected get isBarKind(): boolean {
    return this.kind === 'bar';
  }

  protected get isLoadRingKind(): boolean {
    return this.kind === 'load-ring';
  }

  protected get isActionRingKind(): boolean {
    return this.kind === 'action-ring';
  }

  protected get isSpinnerRingKind(): boolean {
    return this.kind === 'spinner-ring';
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
    if (this.isSuccessState) {
      return 0;
    }
    const position = this.usesTimedLoadProgress()
      ? this.timedLoadPosition()
      : this.position;
    return this.resolvedPerimeter * (1 - this.clampUnit(position));
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

  private syncTimedLoadProgress(): void {
    if (!this.usesTimedLoadProgress()) {
      this.clearTimedLoadProgress();
      return;
    }
    if (this.timedLoadStartedAtMs > 0) {
      return;
    }
    this.timedLoadStartedAtMs = this.nowMs();
    this.timedLoadPosition.set(0.02);
    this.scheduleTimedLoadProgress();
  }

  private updateTimedLoadProgress(): void {
    this.timedLoadFrameId = null;
    this.timedLoadTimerId = null;
    if (!this.usesTimedLoadProgress() || this.timedLoadStartedAtMs <= 0) {
      this.clearTimedLoadProgress();
      return;
    }
    const elapsedMs = Math.max(0, this.nowMs() - this.timedLoadStartedAtMs);
    const durationMs = Math.max(1, Math.trunc(Number(this.durationMs) || 0));
    this.timedLoadPosition.set(Math.min(0.92, elapsedMs / durationMs));
    this.scheduleTimedLoadProgress();
  }

  private scheduleTimedLoadProgress(): void {
    this.clearTimedLoadProgressHandle();
    if (typeof globalThis.requestAnimationFrame === 'function') {
      this.timedLoadFrameId = globalThis.requestAnimationFrame(() => this.updateTimedLoadProgress());
      return;
    }
    this.timedLoadTimerId = setTimeout(() => this.updateTimedLoadProgress(), 80);
  }

  private clearTimedLoadProgress(): void {
    this.clearTimedLoadProgressHandle();
    this.timedLoadStartedAtMs = 0;
    this.timedLoadPosition.set(0);
  }

  private clearTimedLoadProgressHandle(): void {
    if (this.timedLoadFrameId !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.timedLoadFrameId);
    }
    if (this.timedLoadTimerId !== null) {
      clearTimeout(this.timedLoadTimerId);
    }
    this.timedLoadFrameId = null;
    this.timedLoadTimerId = null;
  }

  private usesTimedLoadProgress(): boolean {
    return this.autoProgress && !this.manualPositionInput && this.isLoadRingKind && this.isLoadingState;
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
}

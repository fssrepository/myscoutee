import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';

export type ProgressIndicatorKind = 'bar' | 'pill-bar' | 'load-ring' | 'action-ring' | 'spinner-ring';
export type ProgressIndicatorPlacement = 'edge' | 'inline';
export type ProgressIndicatorShape = 'circle' | 'button';
export type ProgressIndicatorSize = 'sm' | 'md';
export type ProgressIndicatorState = 'idle' | 'scrolling' | 'loading' | 'loading-overdue' | 'error' | 'success' | 'inactive';
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
export class ProgressIndicatorComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
  private readonly actionButtonSize = signal({ width: 104, height: 48 });
  private timedLoadStartedAtMs = 0;
  private timedLoadFrameId: number | null = null;
  private timedLoadTimerId: ReturnType<typeof setTimeout> | null = null;
  private actionButtonResizeObserver: ResizeObserver | null = null;
  private actionButtonMeasureFrameId: number | null = null;
  private manualPositionInput = false;

  @HostBinding('class.app-progress-indicator-host')
  protected readonly hostClass = true;

  @HostBinding('class.app-progress-indicator-host--kind-bar')
  protected get hostBarKindClass(): boolean {
    return this.kind === 'bar';
  }

  @HostBinding('class.app-progress-indicator-host--kind-pill-bar')
  protected get hostPillBarKindClass(): boolean {
    return this.kind === 'pill-bar';
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

  ngAfterViewInit(): void {
    this.syncActionButtonSizeObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['position']) {
      this.manualPositionInput = true;
    }
    this.syncTimedLoadProgress();
    this.syncActionButtonSizeObserver();
  }

  ngOnDestroy(): void {
    this.clearTimedLoadProgress();
    this.clearActionButtonSizeObserver();
  }

  protected get isBarKind(): boolean {
    return this.kind === 'bar';
  }

  protected get isPillBarKind(): boolean {
    return this.kind === 'pill-bar';
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

  protected get isInactiveState(): boolean {
    return this.resolvedState === 'inactive';
  }

  protected get isScrollingState(): boolean {
    return this.resolvedState === 'scrolling';
  }

  protected get resolvedState(): ProgressIndicatorState {
    return this.state;
  }

  protected progressTransform(): string {
    if (this.isInactiveState) {
      return 'scaleX(1)';
    }
    const position = this.usesTimedLoadProgress()
      ? this.timedLoadPosition()
      : this.position;
    return `scaleX(${this.clampUnit(position)})`;
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

  protected actionButtonViewBox(): string {
    const { width, height } = this.actionButtonSize();
    return `0 0 ${width} ${height}`;
  }

  protected actionButtonPath(): string {
    const { width, height } = this.actionButtonSize();
    const inset = 2;
    const left = inset;
    const right = Math.max(left + 1, width - inset);
    const top = inset;
    const bottom = Math.max(top + 1, height - inset);
    const centerY = height / 2;
    const radius = Math.max(0, (bottom - top) / 2);
    const startX = width / 2;
    const rightArcX = Math.max(left, right - radius);
    const leftArcX = Math.min(right, left + radius);

    return [
      `M${startX} ${top}`,
      `H${rightArcX}`,
      `A${radius} ${radius} 0 0 1 ${right} ${centerY}`,
      `A${radius} ${radius} 0 0 1 ${rightArcX} ${bottom}`,
      `H${leftArcX}`,
      `A${radius} ${radius} 0 0 1 ${left} ${centerY}`,
      `A${radius} ${radius} 0 0 1 ${leftArcX} ${top}`,
      `H${startX}`
    ].join(' ');
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

  private syncActionButtonSizeObserver(): void {
    if (!this.isActionRingKind || !this.isActionButtonShape) {
      this.clearActionButtonSizeObserver();
      return;
    }
    this.measureActionButtonSize();
    if (this.actionButtonResizeObserver || typeof ResizeObserver !== 'function') {
      return;
    }
    this.actionButtonResizeObserver = new ResizeObserver(() => this.measureActionButtonSize());
    this.actionButtonResizeObserver.observe(this.host.nativeElement);
  }

  private measureActionButtonSize(): void {
    this.clearActionButtonMeasureFrame();
    const measure = (): void => {
      this.actionButtonMeasureFrameId = null;
      const rect = this.host.nativeElement.getBoundingClientRect();
      const width = Math.max(24, Math.round(rect.width));
      const height = Math.max(24, Math.round(rect.height));
      const current = this.actionButtonSize();
      if (current.width === width && current.height === height) {
        return;
      }
      this.actionButtonSize.set({ width, height });
    };
    if (typeof requestAnimationFrame === 'function') {
      this.actionButtonMeasureFrameId = requestAnimationFrame(measure);
      return;
    }
    measure();
  }

  private clearActionButtonSizeObserver(): void {
    this.actionButtonResizeObserver?.disconnect();
    this.actionButtonResizeObserver = null;
    this.clearActionButtonMeasureFrame();
  }

  private clearActionButtonMeasureFrame(): void {
    if (this.actionButtonMeasureFrameId === null) {
      return;
    }
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.actionButtonMeasureFrameId);
    }
    this.actionButtonMeasureFrameId = null;
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
    return this.autoProgress
      && !this.manualPositionInput
      && this.isLoadingState
      && (this.isLoadRingKind || this.isBarKind);
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
}

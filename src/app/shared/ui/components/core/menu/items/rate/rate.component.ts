
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, OnDestroy, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { I18nPipe } from '../../../../../pipes';
import type {
  AppMenuRateAnimation,
  AppMenuRateConfig,
  AppMenuRateDockState,
  AppMenuRatePresentation
} from '../../menu.types';

@Component({
  selector: 'app-menu-rate',
  standalone: true,
  imports: [MatIconModule, I18nPipe],
  templateUrl: './rate.component.html',
  styleUrl: './rate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RateComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private transientBlink = false;
  private stagedValue = 0;
  private dirty = false;

  @HostBinding('class.rate-host')
  protected readonly hostClass = true;

  @HostBinding('class.rate-host--dockable')
  protected get hostDockableClass(): boolean {
    return this.dockEnabled;
  }

  @HostBinding('class.rate-host--dock-open')
  protected get hostDockOpenClass(): boolean {
    return this.dockEnabled && this.dockState === 'open';
  }

  @HostBinding('class.rate-host--dock-closing')
  protected get hostDockClosingClass(): boolean {
    return this.dockEnabled && this.dockState === 'closing';
  }

  @HostBinding('class.rate-host--dock-permanent')
  protected get hostDockPermanentClass(): boolean {
    return this.dockEnabled && this.dockState === 'permanent';
  }

  @HostBinding('attr.data-rate-dock')
  protected get hostDockAttr(): string | null {
    return this.dockEnabled ? 'true' : null;
  }

  @Input() config: AppMenuRateConfig | null = null;
  @Input() value = 0;

  @Output() readonly valueChange = new EventEmitter<number>();
  @Output() readonly scoreSelect = new EventEmitter<number>();

  protected get resolvedScale(): readonly number[] {
    return this.config?.scale ?? [];
  }

  protected get resolvedReadonly(): boolean {
    return this.config?.readonly ?? false;
  }

  protected get resolvedLabel(): string | null {
    return this.config?.label ?? 'Affinity';
  }

  protected get resolvedActionLabel(): string {
    return this.config?.actionLabel?.trim() || 'Go';
  }

  protected get resolvedPresentation(): AppMenuRatePresentation {
    return this.config?.presentation ?? 'list';
  }

  protected get resolvedAnimation(): AppMenuRateAnimation {
    if (this.transientBlink) {
      return 'blink';
    }
    return this.config?.animation ?? 'default';
  }

  protected get dockEnabled(): boolean {
    return this.config?.dock?.enabled ?? false;
  }

  protected get dockState(): AppMenuRateDockState {
    return this.dockEnabled ? (this.config?.dock?.state ?? 'hidden') : 'hidden';
  }

  protected get minimumScore(): number {
    return this.resolvedScale.length > 0 ? Math.min(...this.resolvedScale) : 1;
  }

  protected get maximumScore(): number {
    return this.resolvedScale.length > 0 ? Math.max(...this.resolvedScale) : 10;
  }

  protected get displayValue(): number {
    if (this.dirty) {
      return this.stagedValue;
    }
    const configuredValue = this.config?.value;
    const normalizedValue = this.normalizeScore(
      Number.isFinite(Number(configuredValue)) ? Number(configuredValue) : this.value
    );
    return normalizedValue > 0 ? normalizedValue : this.defaultScore();
  }

  protected get valuePercent(): number {
    const range = Math.max(1, this.maximumScore - this.minimumScore);
    return ((this.displayValue - this.minimumScore) / range) * 100;
  }

  protected get sliderAccentColor(): string {
    const hue = Math.round(210 - (this.valuePercent / 100) * 230);
    return `hsl(${hue} 82% 48%)`;
  }

  protected get sliderAccentShadow(): string {
    const hue = Math.round(210 - (this.valuePercent / 100) * 230);
    return `hsla(${hue}, 82%, 42%, 0.28)`;
  }

  protected get sliderAccentTextColor(): string {
    return this.valuePercent >= 38 && this.valuePercent <= 82 ? '#172033' : '#ffffff';
  }

  protected get sliderAccentTextShadow(): string {
    return this.sliderAccentTextColor === '#ffffff'
      ? '0 1px 1px rgba(0, 0, 0, 0.34)'
      : '0 1px 1px rgba(255, 255, 255, 0.42)';
  }

  protected get shouldShowCommitButton(): boolean {
    return !this.resolvedReadonly;
  }

  protected onSliderInput(event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly) {
      return;
    }
    const input = event.target instanceof HTMLInputElement ? inputValue(event.target) : this.defaultScore();
    this.stagedValue = this.normalizeScore(input) || this.defaultScore();
    this.dirty = true;
    this.valueChange.emit(this.stagedValue);
    this.cdr.markForCheck();
  }

  protected commitScore(event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly) {
      return;
    }
    const score = this.normalizeScore(this.dirty ? this.stagedValue : this.displayValue) || this.defaultScore();
    if (this.config?.blinkOnSelect !== false) {
      this.triggerTransientBlink();
    }
    this.dirty = false;
    this.scoreSelect.emit(score);
  }

  protected isFilled(score: number): boolean {
    return score <= this.displayValue;
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

  private normalizeScore(value: number | string | null | undefined): number {
    const numeric = Math.round(Number(value) || 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    const scale = this.resolvedScale.length > 0 ? this.resolvedScale : Array.from({ length: 10 }, (_, index) => index + 1);
    return scale.includes(numeric)
      ? numeric
      : Math.min(this.maximumScore, Math.max(this.minimumScore, numeric));
  }

  private defaultScore(): number {
    return Math.round((this.minimumScore + this.maximumScore) / 2);
  }
}

function inputValue(input: HTMLInputElement): number {
  return Number(input.value);
}

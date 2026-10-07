
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, ElementRef, Output, inject } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet, NgStyle } from '@angular/common';
import { PopupComponent } from '../../../popup/popup.component';
import type { PopupModel } from '../../../popup/popup.types';
import { ratingAverage, shiftRatingCriteria, type RatingSnapshot } from '../../../../../../core/contracts/rating-snapshot';
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
  imports: [MatIconModule, I18nPipe, DecimalPipe, NgTemplateOutlet, NgStyle, PopupComponent],
  templateUrl: './rate.component.html',
  styleUrl: './rate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RateComponent implements OnDestroy, OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected detailModel: PopupModel | null = null;
  protected criterionValues: number[] = [];
  // Keep the unrounded group shape while successive base-slider ticks distribute whole units.
  private criterionShiftOrigin: number[] | null = null;
  private subjectKey: string | undefined;
  private profileType: string | undefined;

  ngOnChanges(): void {
    if (this.subjectKey !== this.config?.subjectKey || this.profileType !== this.config?.criteriaDefinition?.profileType) {
      this.subjectKey = this.config?.subjectKey;
      this.profileType = this.config?.criteriaDefinition?.profileType;
      this.dirty = false;
      this.detailModel = null;
      this.criterionValues = [];
      this.criterionShiftOrigin = null;
    }
  }

  protected get criteria() { return this.config?.criteriaDefinition?.criteria ?? []; }
  protected get baseStep(): number { return 1 / Math.max(1, this.criteria.length); }

  protected openDetails(event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly) return;
    if (this.detailModel) { this.detailModel = null; return; }
    this.ensureCriteria();
    const rect = (this.host.nativeElement.closest('.app-menu__panel') ?? this.host.nativeElement).getBoundingClientRect();
    this.detailModel = { title: 'rating.details', ariaLabel: 'rating.details', size: 'default',
      backdrop: false, hideFloatingControls: true, closeOnBackdrop: false, mobilePresentation: 'compact',
      anchorRect: { left: rect.left, top: rect.top, width: rect.width } };
  }

  private ensureCriteria(): void {
    if (this.criterionValues.length === this.criteria.length) return;
    const snapshot = this.config?.ratingSnapshot;
    const values = this.criteria.map(criterion => {
      const value = snapshot && snapshot.profileType === this.profileType ? snapshot.criteria[criterion.id] : undefined;
      return Number.isFinite(value) ? Math.min(this.maximumScore, Math.max(this.minimumScore, value!)) : this.displayValue;
    });
    this.criterionValues = shiftRatingCriteria(values, ratingAverage(values), this.minimumScore, this.maximumScore);
  }

  protected changeCriterion(index: number, event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly || !(event.target instanceof HTMLInputElement)) return;
    this.criterionValues = this.criterionValues.map((value, i) => i === index ? Math.round(Number((event.target as HTMLInputElement).value)) : value);
    this.criterionShiftOrigin = null;
    this.stagedValue = ratingAverage(this.criterionValues);
    this.dirty = true;
    this.valueChange.emit(this.stagedValue);
  }

  private snapshot(): RatingSnapshot | undefined {
    if (!this.config?.criteriaDefinition || !this.criteria.length) return undefined;
    this.ensureCriteria();
    return { version: 1, profileType: this.config.criteriaDefinition.profileType,
      criteria: Object.fromEntries(this.criteria.map((criterion, index) => [criterion.id, this.criterionValues[index]])),
      average: ratingAverage(this.criterionValues) };
  }

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

  @HostBinding('attr.aria-hidden')
  protected get hostHidden(): string | null {
    return this.dockEnabled && (this.dockState === 'hidden' || this.dockState === 'closing') ? 'true' : null;
  }

  @Input() config: AppMenuRateConfig | null = null;
  @Input() value = 0;

  @Output() readonly valueChange = new EventEmitter<number>();
  @Output() readonly scoreSelect = new EventEmitter<{ score: number; ratingSnapshot?: RatingSnapshot }>();

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

  protected percent(score: number): number {
    return ((score - this.minimumScore) / Math.max(1, this.maximumScore - this.minimumScore)) * 100;
  }

  protected sliderStyle(score: number): Record<string, string> {
    const states = this.config?.stateColors;
    if (states?.length) {
      const index = Math.round(this.percent(score) * (states.length - 1) / 100);
      const selected = states[Math.max(0, Math.min(states.length - 1, index))];
      const stops = states.flatMap((state, i) => [
        `${state.background} ${i === 0 ? 0 : (i - .5) * 100 / (states.length - 1)}%`,
        `${state.background} ${i === states.length - 1 ? 100 : (i + .5) * 100 / (states.length - 1)}%`
      ]);
      return {'--rate-slider-accent': selected.background, '--rate-slider-accent-shadow': 'rgba(12, 24, 40, .2)',
        '--rate-slider-accent-text': selected.text, '--rate-slider-accent-text-shadow': 'none',
        '--rate-state-track': `linear-gradient(90deg, ${stops.join(', ')})`};
    }
    const percent = this.percent(score);
    const hue = Math.round(210 - (percent / 100) * 230);
    const darkText = percent >= 38 && percent <= 82;
    return {
      '--rate-slider-accent': `hsl(${hue} 82% 48%)`,
      '--rate-slider-accent-shadow': `hsla(${hue}, 82%, 42%, 0.28)`,
      '--rate-slider-accent-text': darkText ? '#172033' : '#ffffff',
      '--rate-slider-accent-text-shadow': darkText
        ? '0 1px 1px rgba(255, 255, 255, 0.42)' : '0 1px 1px rgba(0, 0, 0, 0.34)'
    };
  }

  protected get shouldShowCommitButton(): boolean {
    return !this.resolvedReadonly && this.config?.showCommit !== false;
  }

  protected onSliderInput(event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly) {
      return;
    }
    const input = event.target instanceof HTMLInputElement ? inputValue(event.target) : this.defaultScore();
    this.ensureCriteria();
    this.stagedValue = Math.min(this.maximumScore, Math.max(this.minimumScore, input));
    this.criterionShiftOrigin ??= [...this.criterionValues];
    this.criterionValues = shiftRatingCriteria(this.criterionShiftOrigin, this.stagedValue, this.minimumScore, this.maximumScore);
    this.stagedValue = this.criterionValues.length ? ratingAverage(this.criterionValues) : Math.round(this.stagedValue);
    this.dirty = true;
    this.valueChange.emit(this.stagedValue);
    this.cdr.markForCheck();
  }

  protected commitScore(event: Event): void {
    event.stopPropagation();
    if (this.resolvedReadonly) {
      return;
    }
    const ratingSnapshot = this.snapshot();
    const score = ratingSnapshot?.average ?? (this.normalizeScore(this.displayValue) || this.defaultScore());
    if (this.config?.blinkOnSelect !== false) {
      this.triggerTransientBlink();
    }
    this.detailModel = null;
    this.dirty = false;
    this.scoreSelect.emit({ score, ratingSnapshot });
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
    const numeric = Number(value) || 0;
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.min(this.maximumScore, Math.max(this.minimumScore, numeric));
  }

  private defaultScore(): number {
    return Math.round((this.minimumScore + this.maximumScore) / 2);
  }
}

function inputValue(input: HTMLInputElement): number {
  return Number(input.value);
}

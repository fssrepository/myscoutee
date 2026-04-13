import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { PricingBuilder } from '../../../core/base/builders';
import type * as AppTypes from '../../../core/base/models';

@Component({
  selector: 'app-pricing-slot-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule
  ],
  templateUrl: './pricing-slot-panel.component.html',
  styleUrl: './pricing-slot-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PricingSlotPanelComponent implements OnChanges {
  @Input() enabled = false;
  @Output() readonly enabledChange = new EventEmitter<boolean>();

  @Input() overrides: readonly AppTypes.PricingSlotOverride[] = [];
  @Output() readonly overridesChange = new EventEmitter<AppTypes.PricingSlotOverride[]>();

  @Input() slotCatalog: readonly AppTypes.PricingSlotReference[] = [];
  @Input() currency = 'USD';
  @Input() readOnly = false;
  @Input() title = 'Customize pricing per slot';
  @Input() description = 'Override global rules with slot-specific pricing.';

  protected workingOverrides: AppTypes.PricingSlotOverride[] = [];
  protected slotWindowLabels: Map<string, string> = new Map();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['overrides'] || changes['slotCatalog'] || changes['currency']) {
      this.syncWorkingOverrides();
    }
  }

  protected toggleEnabled(): void {
    if (this.readOnly) {
      return;
    }
    const nextValue = !this.enabled;
    this.enabled = nextValue;
    this.enabledChange.emit(nextValue);
    if (nextValue && this.workingOverrides.length === 0) {
      this.addOverride();
    }
  }

  protected addOverride(): void {
    if (this.readOnly) {
      return;
    }
    const availableSlot = this.remainingSlots()[0] ?? null;
    if (!availableSlot) {
      return;
    }
    this.workingOverrides = [
      ...this.workingOverrides,
      PricingBuilder.slotOverrideFromReference(availableSlot, null, this.currency)
    ];
    this.emitOverrides();
  }

  protected removeOverride(index: number): void {
    if (this.readOnly || index < 0 || index >= this.workingOverrides.length) {
      return;
    }
    this.workingOverrides = this.workingOverrides.filter((_, itemIndex) => itemIndex !== index);
    this.emitOverrides();
  }

  protected onSlotIdChange(index: number, slotId: string | null | undefined): void {
    if (this.readOnly) {
      return;
    }
    const normalizedSlotId = `${slotId ?? ''}`.trim();
    const slot = this.slotCatalog.find(item => item.id === normalizedSlotId) ?? null;
    if (!slot || index < 0 || index >= this.workingOverrides.length) {
      return;
    }
    this.workingOverrides = this.workingOverrides.map((override, itemIndex) => itemIndex === index
      ? {
          ...override,
          id: `slot-override-${slot.id}`,
          slotId: slot.id,
          label: slot.label,
          startAt: slot.startAt ?? null,
          endAt: slot.endAt ?? null,
          currency: this.currency
        }
      : override);
    this.emitOverrides();
  }

  protected onPriceChange(index: number, value: number | string): void {
    if (this.readOnly || index < 0 || index >= this.workingOverrides.length) {
      return;
    }
    this.workingOverrides = this.workingOverrides.map((override, itemIndex) => itemIndex === index
      ? {
          ...override,
          currency: this.currency,
          price: this.parseNullableMoney(value)
        }
      : override);
    this.emitOverrides();
  }

  protected availableSlotsFor(override: AppTypes.PricingSlotOverride): AppTypes.PricingSlotReference[] {
    const selectedSlotIds = new Set(
      this.workingOverrides
        .map(item => item.slotId?.trim() || '')
        .filter(slotId => slotId.length > 0)
    );
    if (override.slotId?.trim()) {
      selectedSlotIds.delete(override.slotId.trim());
    }
    return this.slotCatalog.filter(slot => !selectedSlotIds.has(slot.id));
  }

  protected hasRemainingSlots(): boolean {
    return this.remainingSlots().length > 0;
  }

  protected trackByOverride(_: number, override: AppTypes.PricingSlotOverride): string {
    return override.id;
  }

  protected slotWindowLabel(override: AppTypes.PricingSlotOverride): string {
    return this.slotWindowLabels.get(override.id) || '';
  }

  protected currencySymbol(currency: string): string {
    switch (`${currency ?? ''}`.trim().toUpperCase()) {
      case 'EUR':
        return 'EUR';
      case 'GBP':
        return 'GBP';
      case 'CZK':
        return 'CZK';
      default:
        return '$';
    }
  }

  private syncWorkingOverrides(): void {
    const normalized = PricingBuilder.syncSlotOverrides({
      ...PricingBuilder.createDefaultPricingConfig('event'),
      currency: this.currency,
      slotOverrides: (this.overrides ?? []).map(item => ({ ...item }))
    }, this.slotCatalog);
    this.workingOverrides = normalized.slotOverrides.map(item => ({ ...item }));
    this.refreshLabels();
  }

  private emitOverrides(): void {
    const normalized = PricingBuilder.syncSlotOverrides({
      ...PricingBuilder.createDefaultPricingConfig('event'),
      currency: this.currency,
      slotOverrides: this.workingOverrides.map(item => ({ ...item }))
    }, this.slotCatalog);
    this.workingOverrides = normalized.slotOverrides.map(item => ({ ...item }));
    this.refreshLabels();
    this.overridesChange.emit(this.workingOverrides.map(item => ({ ...item })));
  }

  private refreshLabels(): void {
    this.slotWindowLabels.clear();
    for (const override of this.workingOverrides) {
      this.slotWindowLabels.set(override.id, this.calculateSlotWindowLabel(override));
    }
  }

  private calculateSlotWindowLabel(override: AppTypes.PricingSlotOverride): string {
    const start = this.formatDateTime(override.startAt);
    const end = this.formatDateTime(override.endAt);
    if (!start && !end) {
      return 'Time window will follow the selected slot.';
    }
    if (!start) {
      return `Ends ${end}`;
    }
    if (!end) {
      return `Starts ${start}`;
    }
    return `${start} - ${end}`;
  }

  private remainingSlots(): AppTypes.PricingSlotReference[] {
    const selectedSlotIds = new Set(
      this.workingOverrides
        .map(item => item.slotId?.trim() || '')
        .filter(slotId => slotId.length > 0)
    );
    return this.slotCatalog.filter(slot => !selectedSlotIds.has(slot.id));
  }

  private parseNullableMoney(value: number | string): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.round(parsed * 100) / 100);
  }

  private formatDateTime(value: string | null | undefined): string {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return '';
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}

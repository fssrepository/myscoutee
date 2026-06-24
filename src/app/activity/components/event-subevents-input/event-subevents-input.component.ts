import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../shared/app-utils';
import { ActivityEventDetailDTO } from '../../../shared/core/contracts/activity.interface';
import type * as ContractTypes from '../../../shared/core/contracts';
import { PricingBuilder } from '../../../shared/core/base/builders';
import { EventSubeventsPopupComponent, type EventSubeventsItem } from '../event-subevents-popup/event-subevents-popup.component';

@Component({
  selector: 'app-event-subevents-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    EventSubeventsPopupComponent
  ],
  templateUrl: './event-subevents-input.component.html',
  styleUrl: './event-subevents-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EventSubeventsInputComponent),
      multi: true
    }
  ]
})
export class EventSubeventsInputComponent implements ControlValueAccessor {
  @Input() open = false;
  @Output() readonly openChange = new EventEmitter<boolean>();

  @Input() readOnly = false;
  @Input() structureReadOnly = false;
  @Input() parentTitle = '';
  @Input() ownerId: string | null = null;
  @Input() mode: ContractTypes.EventMode = 'Casual';

  @Input() slotsEnabled = false;
  @Input() slotTemplates: readonly ContractTypes.EventSlotTemplateDTO[] = [];
  @Input() parentStartAt = '';
  @Input() parentEndAt = '';

  protected subEvents: ContractTypes.SubEventDTO[] = [];

  private controlDisabled = false;
  private onModelChange: (value: ContractTypes.SubEventDTO[]) => void = () => {};
  private onModelTouched: () => void = () => {};

  constructor(private readonly cdr: ChangeDetectorRef) {}

  writeValue(value: readonly ContractTypes.SubEventDTO[] | null | undefined): void {
    this.subEvents = ActivityEventDetailDTO.normalizeSubEvents(value ?? []);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: ContractTypes.SubEventDTO[]) => void): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected isReadOnly(): boolean {
    return this.readOnly || this.controlDisabled;
  }

  protected openSubEvents(): void {
    this.open = true;
    this.openChange.emit(true);
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  protected closeSubEvents(): void {
    this.open = false;
    this.openChange.emit(false);
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  protected onPopupSubEventsChange(items: readonly EventSubeventsItem[]): void {
    const nextSubEvents = ActivityEventDetailDTO.normalizeSubEvents(
      items.map((item, index) => this.toSubEventDTO(item, index))
    );
    this.subEvents = nextSubEvents;
    this.onModelTouched();
    this.onModelChange([...nextSubEvents]);
    this.cdr.markForCheck();
  }

  protected subEventsCountLabel(): string {
    const count = this.subEvents.length;
    return count === 1 ? '1 item' : `${count} items`;
  }

  protected subEventsCurrentHeaderLabel(): string {
    const current = this.currentSubEventPanelState();
    return current ? this.subEventPanelChipTitle(current.item, current.index) : '';
  }

  protected subEventLocationLabel(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    const location = ActivityEventDetailDTO.normalizeLocation(subEvent?.location).trim();
    return location || 'Location pending';
  }

  protected subEventPanelChipTitle(subEvent: ContractTypes.SubEventDTO, index: number): string {
    const baseName = this.subEventName(subEvent).trim() || 'Untitled';
    return this.mode === 'Tournament' ? `Stage ${index + 1} - ${baseName}` : baseName;
  }

  protected subEventPanelChipTrackId(index: number, subEvent: ContractTypes.SubEventDTO): string {
    const id = `${subEvent.id ?? ''}`.trim();
    return id || [
      index,
      `${subEvent.startAt ?? ''}`.trim(),
      `${subEvent.endAt ?? ''}`.trim(),
      this.subEventName(subEvent).trim()
    ].join(':');
  }

  protected subEventCardRange(subEvent: ContractTypes.SubEventDTO): string {
    const start = AppUtils.parseDate(subEvent.startAt);
    const end = AppUtils.parseDate(subEvent.endAt);
    if (!start || !end) {
      return 'Date pending';
    }
    const startLabel = `${AppUtils.pad2(start.getMonth() + 1)}/${AppUtils.pad2(start.getDate())} ${AppUtils.pad2(start.getHours())}:${AppUtils.pad2(start.getMinutes())}`;
    const endLabel = `${AppUtils.pad2(end.getMonth() + 1)}/${AppUtils.pad2(end.getDate())} ${AppUtils.pad2(end.getHours())}:${AppUtils.pad2(end.getMinutes())}`;
    return `${startLabel} - ${endLabel}`;
  }

  protected subEventPanelChipIsCurrent(subEvent: ContractTypes.SubEventDTO): boolean {
    const source = ActivityEventDetailDTO.sortSubEventsByStartAsc(this.subEvents);
    const current = source[this.resolveCurrentSubEventIndex(source)] ?? source[0] ?? null;
    if (!current) {
      return false;
    }
    if (current === subEvent || (current.id && subEvent.id && current.id === subEvent.id)) {
      return true;
    }
    return current.startAt === subEvent.startAt
      && current.endAt === subEvent.endAt
      && this.subEventName(current) === this.subEventName(subEvent);
  }

  protected subEventPanelChipStyle(index: number): Record<string, string> {
    if (this.mode === 'Tournament') {
      const totalStages = Math.max(1, this.subEvents.length);
      const stageNumber = AppUtils.clampNumber(index + 1, 1, totalStages);
      const hue = this.subEventStageAccentHue(stageNumber, totalStages);
      return {
        borderColor: `hsl(${hue} 54% 58% / 0.52)`,
        background: `linear-gradient(180deg, hsl(${hue} 92% 96%) 0%, hsl(${hue} 84% 90%) 100%)`,
        color: `hsl(${hue} 48% 34%)`
      };
    }

    const subEvent = this.subEvents[index] ?? null;
    if (!subEvent) {
      return {};
    }
    return subEvent.optional
      ? {
          borderColor: 'rgba(63, 118, 188, 0.34)',
          background: 'linear-gradient(180deg, #f1f9ff 0%, #e8f3ff 100%)',
          color: '#2b5c95'
        }
      : {
          borderColor: 'rgba(175, 78, 78, 0.34)',
          background: 'linear-gradient(180deg, #fff3f3 0%, #ffe9e9 100%)',
          color: '#8f3a3a'
        };
  }

  protected subEventsModeClass(mode: string = this.mode): string {
    return mode === 'Tournament' ? 'subevents-mode-tournament' : 'subevents-mode-casual';
  }

  protected subEventsModeIcon(mode: string = this.mode): string {
    return mode === 'Tournament' ? 'emoji_events' : 'groups';
  }

  private toSubEventDTO(item: EventSubeventsItem, index: number): ContractTypes.SubEventDTO {
    const fallbackName = `Sub Event ${index + 1}`;
    return {
      id: `${item.id ?? ''}`.trim() || `subevent-${index + 1}`,
      name: `${item.name ?? item.title ?? fallbackName}`.trim() || fallbackName,
      description: `${item.description ?? ''}`.trim(),
      startAt: `${item.startAt ?? ''}`.trim(),
      endAt: `${item.endAt ?? ''}`.trim(),
      location: ActivityEventDetailDTO.normalizeLocation(item.location),
      optional: item.optional === true,
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing ?? undefined,
      capacityMin: this.nonNegativeInteger(item.capacityMin),
      capacityMax: this.nonNegativeInteger(item.capacityMax),
      membersAccepted: this.nonNegativeInteger(item.membersAccepted),
      membersPending: this.nonNegativeInteger(item.membersPending),
      carsPending: this.nonNegativeInteger(item.carsPending),
      accommodationPending: this.nonNegativeInteger(item.accommodationPending),
      suppliesPending: this.nonNegativeInteger(item.suppliesPending),
      carsAccepted: this.optionalNonNegativeInteger(item.carsAccepted),
      accommodationAccepted: this.optionalNonNegativeInteger(item.accommodationAccepted),
      suppliesAccepted: this.optionalNonNegativeInteger(item.suppliesAccepted),
      carsCapacityMin: this.optionalNonNegativeInteger(item.carsCapacityMin),
      carsCapacityMax: this.optionalNonNegativeInteger(item.carsCapacityMax),
      accommodationCapacityMin: this.optionalNonNegativeInteger(item.accommodationCapacityMin),
      accommodationCapacityMax: this.optionalNonNegativeInteger(item.accommodationCapacityMax),
      suppliesCapacityMin: this.optionalNonNegativeInteger(item.suppliesCapacityMin),
      suppliesCapacityMax: this.optionalNonNegativeInteger(item.suppliesCapacityMax),
      tournamentGroupCount: this.optionalNonNegativeInteger(item.tournamentGroupCount),
      tournamentGroupCapacityMin: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMin),
      tournamentGroupCapacityMax: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMax),
      tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      tournamentAdvancePerGroup: this.optionalNonNegativeInteger(item.tournamentAdvancePerGroup),
      groups: (item.groups ?? []).map((group, groupIndex) => ({
        id: `${group.id ?? ''}`.trim() || `group-${index + 1}-${groupIndex + 1}`,
        name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
        source: group.source === 'manual' ? 'manual' : 'generated',
        capacityMin: this.optionalNonNegativeInteger(group.capacityMin),
        capacityMax: this.optionalNonNegativeInteger(group.capacityMax)
      })),
      slotStartOffsetMinutes: this.optionalNonNegativeInteger(item.slotStartOffsetMinutes),
      slotDurationMinutes: this.optionalNonNegativeInteger(item.slotDurationMinutes),
      stageStatus: item.stageStatus,
      stageStatusReason: item.stageStatusReason,
      stageStatusUpdatedAt: item.stageStatusUpdatedAt,
      stageFinalizedAt: item.stageFinalizedAt,
      stageFinalizedByUserId: item.stageFinalizedByUserId
    };
  }

  private currentSubEventPanelState(): { item: ContractTypes.SubEventDTO; index: number } | null {
    const source = ActivityEventDetailDTO.sortSubEventsByStartAsc(this.subEvents);
    const current = source[this.resolveCurrentSubEventIndex(source)] ?? source[0] ?? null;
    return current ? { item: current, index: source.indexOf(current) } : null;
  }

  private resolveCurrentSubEventIndex(items: readonly ContractTypes.SubEventDTO[]): number {
    if (items.length === 0) {
      return 0;
    }
    const now = Date.now();
    for (let index = 0; index < items.length; index += 1) {
      const startMs = new Date(items[index]?.startAt ?? '').getTime();
      const endMs = new Date(items[index]?.endAt ?? '').getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs <= now && now <= endMs) {
        return index;
      }
    }
    for (let index = 0; index < items.length; index += 1) {
      const startMs = new Date(items[index]?.startAt ?? '').getTime();
      if (!Number.isNaN(startMs) && startMs > now) {
        return index;
      }
    }
    return Math.max(0, items.length - 1);
  }

  private subEventStageAccentHue(stageNumber: number, totalStages: number): number {
    if (totalStages <= 1) {
      return 210;
    }
    const ratio = AppUtils.clampNumber((stageNumber - 1) / (totalStages - 1), 0, 1);
    return Math.round(210 - (210 * ratio));
  }

  private subEventName(subEvent: ContractTypes.SubEventDTO): string {
    return `${subEvent.name || 'Untitled'}`;
  }

  private nonNegativeInteger(value: unknown): number {
    return this.toNonNegativeIntegerOrNull(value) ?? 0;
  }

  private optionalNonNegativeInteger(value: unknown): number | undefined {
    return this.toNonNegativeIntegerOrNull(value) ?? undefined;
  }

  private toNonNegativeIntegerOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }
}

import { AppUtils } from '../../app-utils';
import { ActivityEventDetailDTO, type SubEventsSlotDTO } from '../../core/contracts/activity.interface';
import type { EventSlotTemplateDTO, SubEventDTO } from '../../core/contracts/event.interface';

export type EventSubeventsSlotTone = 'blue' | 'green' | 'cyan' | 'violet' | 'amber' | 'gold';

export interface EventSubeventsSlotConverterEvent {
  frequency?: string | null;
  slotTemplates?: EventSlotTemplateDTO[];
}

export interface EventSubeventsSlotConverterOptions {
  event?: EventSubeventsSlotConverterEvent | null;
  order?: 'upcoming' | 'past' | string | null;
}

export interface EventSubeventsSlotModel {
  id: string;
  title: string;
  subtitle: string;
  startAt: string | null;
  endAt: string | null;
  tone: EventSubeventsSlotTone;
  isSlot: boolean;
  slot: SubEventsSlotDTO;
  items: SubEventDTO[];
}

export class EventSubeventsSlotConverter {
  static convertList(
    slots: readonly SubEventsSlotDTO[],
    options: EventSubeventsSlotConverterOptions = {}
  ): EventSubeventsSlotModel[] {
    return slots
      .map((slot, index) => this.convert(slot, index, options))
      .sort((left, right) => this.compareSlots(left, right, options.order));
  }

  static convert(
    slot: SubEventsSlotDTO,
    index: number,
    options: EventSubeventsSlotConverterOptions = {}
  ): EventSubeventsSlotModel {
    const id = `${slot.id ?? ''}`.trim() || `${slot.parentEventId ?? 'event'}:${index}`;
    const items = Array.isArray(slot.subEventItems) ? slot.subEventItems : [];
    const firstItem = items[0] ?? null;
    const isSlot = this.isGeneratedSlot(slot);
    const title = isSlot
      ? this.slotTitle(slot, index + 1, options.event)
      : 'Sub events';
    const subtitle = this.slotSubtitle(slot, firstItem, options.event);
    return {
      id,
      title,
      subtitle,
      startAt: `${slot.startAt ?? ''}`.trim() || firstItem?.startAt || null,
      endAt: `${slot.endAt ?? ''}`.trim() || firstItem?.endAt || slot.startAt || null,
      tone: this.slotTone(options.event),
      isSlot,
      slot,
      items
    };
  }

  static slotOwnerId(model: EventSubeventsSlotModel): string {
    return `${model.slot.slotSourceId ?? model.slot.parentEventId ?? ''}`.trim();
  }

  static itemKey(model: EventSubeventsSlotModel, item: SubEventDTO, index = 0): string {
    const itemId = `${item.id ?? ''}`.trim() || `subevent-${index + 1}`;
    return `${model.id}:${itemId}`;
  }

  static headerLabel(model: EventSubeventsSlotModel): string {
    const title = `${model.title ?? ''}`.trim();
    const subtitle = `${model.subtitle ?? ''}`.trim();
    return subtitle ? `${title} - ${subtitle}` : title;
  }

  private static compareSlots(
    left: EventSubeventsSlotModel,
    right: EventSubeventsSlotModel,
    order: 'upcoming' | 'past' | string | null | undefined
  ): number {
    const direction = `${order ?? ''}`.trim().toLowerCase() === 'past' ? -1 : 1;
    const dateCompare = direction * (this.dateMs(left.startAt) - this.dateMs(right.startAt));
    return dateCompare !== 0 ? dateCompare : left.id.localeCompare(right.id);
  }

  private static isGeneratedSlot(slot: SubEventsSlotDTO): boolean {
    return Boolean(`${slot.slotSourceId ?? ''}`.trim() || `${slot.slotTemplateId ?? ''}`.trim());
  }

  private static slotTitle(
    slot: SubEventsSlotDTO,
    fallbackIndex: number,
    event: EventSubeventsSlotConverterEvent | null | undefined
  ): string {
    const templateId = `${slot.slotTemplateId ?? ''}`.trim();
    const templateIndex = templateId
      ? (event?.slotTemplates ?? []).findIndex(template => `${template.id ?? ''}`.trim() === templateId)
      : -1;
    return `Slot ${templateIndex >= 0 ? templateIndex + 1 : fallbackIndex}`;
  }

  private static slotSubtitle(
    slot: SubEventsSlotDTO,
    firstItem: SubEventDTO | null,
    event: EventSubeventsSlotConverterEvent | null | undefined
  ): string {
    const template = this.slotTemplate(slot, event);
    const templateStart = AppUtils.parseDate(template?.startAt) ?? AppUtils.parseDate(slot.startAt ?? firstItem?.startAt);
    const frequency = ActivityEventDetailDTO.normalizeFrequency(event?.frequency ?? '');
    if (templateStart && frequency !== 'One-time' && frequency !== 'Custom') {
      return this.formatRecurringSlotLabel(frequency, templateStart);
    }
    return `${slot.timeframe ?? ''}`.trim()
      || AppUtils.dateTimeRangeLabel(slot.startAt ?? firstItem?.startAt, slot.endAt ?? firstItem?.endAt, '');
  }

  private static slotTemplate(
    slot: SubEventsSlotDTO,
    event: EventSubeventsSlotConverterEvent | null | undefined
  ): EventSlotTemplateDTO | null {
    const templateId = `${slot.slotTemplateId ?? ''}`.trim();
    if (!templateId) {
      return null;
    }
    return (event?.slotTemplates ?? []).find(template => `${template.id ?? ''}`.trim() === templateId) ?? null;
  }

  private static slotTone(
    event: EventSubeventsSlotConverterEvent | null | undefined
  ): EventSubeventsSlotTone {
    switch (ActivityEventDetailDTO.normalizeFrequency(event?.frequency ?? '')) {
      case 'Daily':
        return 'green';
      case 'Weekly':
        return 'cyan';
      case 'Bi-weekly':
        return 'violet';
      case 'Monthly':
        return 'amber';
      case 'Yearly':
        return 'gold';
      default:
        return 'blue';
    }
  }

  private static formatRecurringSlotLabel(frequency: string, start: Date): string {
    const time = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Daily':
        return `Every day at ${time}`;
      case 'Weekly':
        return `Every ${start.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
      case 'Bi-weekly':
        return `Every second ${start.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
      case 'Monthly':
        return `Every month on day ${start.getDate()} at ${time}`;
      case 'Yearly':
        return `Every year on ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      default:
        return AppUtils.dateTimeRangeLabel(start.toISOString(), '', '');
    }
  }

  private static dateMs(value: string | null | undefined): number {
    return AppUtils.parseDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
  }
}

export const eventSubeventsSlotConverter = new EventSubeventsSlotConverter();

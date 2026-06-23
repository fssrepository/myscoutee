import type * as ContractTypes from '../../contracts';
import { AppUtils } from '../../../app-utils';

export class EventEditorBuilder {
  static buildCreatedEventEditorId(
    target: ContractTypes.EventEditorTarget,
    timestampMs = Date.now()
  ): string {
    return target === 'hosting' ? `h${timestampMs}` : `e${timestampMs}`;
  }

  static buildEventEditorTimeframeLabel(startAt: string, endAt: string, frequency: string): string {
    const start = AppUtils.parseDate(startAt);
    const end = AppUtils.parseDate(endAt);
    if (!start || !end) {
      return startAt || endAt || '';
    }

    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const normalizedFrequency = this.normalizeEventEditorFrequency(frequency);

    if (normalizedFrequency === 'One-time') {
      return `${dateLabel} · ${startTime} - ${endTime}`;
    }

    return `${normalizedFrequency} · ${dateLabel} · ${startTime} - ${endTime}`;
  }

  private static normalizeEventEditorFrequency(value: unknown): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'daily') {
      return 'Daily';
    }
    if (normalized === 'weekly') {
      return 'Weekly';
    }
    if (normalized.includes('bi-week') || normalized.includes('bi week')) {
      return 'Bi-weekly';
    }
    if (normalized === 'monthly') {
      return 'Monthly';
    }
    if (normalized === 'yearly' || normalized === 'annual' || normalized === 'annually') {
      return 'Yearly';
    }
    return 'One-time';
  }
}

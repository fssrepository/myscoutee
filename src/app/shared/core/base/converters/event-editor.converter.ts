import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../models';
import type { DemoEventRecord } from '../../demo/models/events.model';

export class EventEditorConverter {
  static normalizeEventEditorTextValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  static normalizeEventEditorLocation(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  static normalizeEventEditorVisibility(value: unknown): AppTypes.EventVisibility {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'private' || normalized.includes('friend')) {
      return 'Friends only';
    }
    if (normalized.includes('invitation')) {
      return 'Invitation only';
    }
    return 'Public';
  }

  static normalizeEventEditorFrequency(value: unknown): string {
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
    return 'One-time';
  }

  static normalizeEventEditorBlindMode(value: unknown): AppTypes.EventBlindMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('blind') ? 'Blind Event' : 'Open Event';
  }

  static normalizeEventEditorAutoInviter(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized.includes('off') || normalized.includes('close') || normalized.includes('manual')) {
      return false;
    }
    return normalized.includes('on') || normalized.includes('open') || normalized.includes('auto');
  }

  static normalizeEventEditorTicketing(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (!normalized || normalized.includes('none') || normalized.includes('off') || normalized.includes('free')) {
      return false;
    }
    return normalized.includes('on') || normalized.includes('required') || normalized.includes('ticket');
  }

  static normalizeEventEditorTopics(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
      .filter(item => item.length > 0)
      .slice(0, 5);
  }

  static normalizeEventEditorTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  static parseEventEditorDateValue(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }

    const parsed = new Date(raw.replace(/\//g, '-'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  static toEventEditorCapacityInputValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  static normalizeEventEditorSubEvents(value: unknown): AppTypes.EventEditorSubEventItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry, index) => {
      const item = (typeof entry === 'object' && entry !== null) ? entry as Record<string, unknown> : {};
      const resolvedName = `${item['name'] ?? item['title'] ?? `Sub event ${index + 1}`}`.trim() || `Sub event ${index + 1}`;
      const startAtDate = this.parseEventEditorDateValue(item['startAt'] ?? item['startDate']);
      const endAtDate = this.parseEventEditorDateValue(item['endAt'] ?? item['endDate']);
      const groups = Array.isArray(item['groups']) ? item['groups'] : [];
      return {
        ...item,
        name: resolvedName,
        title: `${item['title'] ?? resolvedName}`.trim() || resolvedName,
        location: this.normalizeEventEditorLocation(item['location']),
        optional: Boolean(item['optional']),
        startAt: startAtDate ? AppUtils.toIsoDateTimeLocal(startAtDate) : '',
        endAt: endAtDate ? AppUtils.toIsoDateTimeLocal(endAtDate) : '',
        groups: groups.map(group => ({ ...(group as Record<string, unknown>) })) as AppTypes.EventEditorSubEventGroupItem[]
      };
    });
  }

  static normalizeEventEditorSubEventsDisplayMode(
    value: unknown,
    subEvents: readonly AppTypes.EventEditorSubEventItem[] = []
  ): AppTypes.SubEventsDisplayMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'tournament') {
      return 'Tournament';
    }
    const hasTournamentGroup = subEvents.some(item => Array.isArray(item.groups) && item.groups.length > 0);
    return hasTournamentGroup ? 'Tournament' : 'Casual';
  }

  static resolveEventEditorSourceImage(sourceEvent: Record<string, unknown>): string {
    const directImage = sourceEvent['imageUrl']
      ?? sourceEvent['image']
      ?? sourceEvent['coverImage']
      ?? sourceEvent['photoUrl']
      ?? sourceEvent['bannerImage']
      ?? sourceEvent['banner'];

    if (typeof directImage === 'string' && directImage.trim()) {
      return directImage.trim();
    }

    const images = sourceEvent['images'];
    if (Array.isArray(images) && images.length > 0) {
      const first = images[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
    }

    return '';
  }

  static toEventEditorSourceFromRecord(
    record: DemoEventRecord,
    target: AppTypes.EventEditorTarget
  ): Record<string, unknown> {
    return {
      id: record.id,
      avatar: record.creatorInitials,
      title: record.title,
      description: record.subtitle,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: target === 'hosting' ? true : record.isAdmin,
      imageUrl: record.imageUrl,
      visibility: record.visibility,
      frequency: record.frequency ?? 'One-time',
      location: record.location,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      blindMode: record.blindMode,
      autoInviter: record.autoInviter ?? false,
      ticketing: record.ticketing,
      topics: [...record.topics],
      subEvents: this.normalizeEventEditorSubEvents(record.subEvents ?? []),
      subEventsDisplayMode: record.subEventsDisplayMode,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      published: record.published,
      pendingMembersCount: record.pendingMembers,
      distanceKm: record.distanceKm,
      sourceLink: record.sourceLink,
      locationCoordinates: record.locationCoordinates
    };
  }

  static toEventEditorFallbackSource(
    row: AppTypes.ActivityListRow,
    readOnly: boolean,
    target: AppTypes.EventEditorTarget
  ): Record<string, unknown> {
    const rowSource = row.source as unknown as Partial<Record<string, unknown>> | null;
    const title = this.normalizeEventEditorTextValue(rowSource?.['title']) || row.title;
    const description = this.normalizeEventEditorTextValue(rowSource?.['shortDescription'] ?? rowSource?.['description']) || row.subtitle;

    return {
      id: row.id,
      avatar: this.normalizeEventEditorTextValue(rowSource?.['avatar']),
      title,
      description,
      shortDescription: description,
      timeframe: this.normalizeEventEditorTextValue(rowSource?.['timeframe']) || row.detail,
      activity: Math.max(0, Math.trunc(Number(row.unread) || 0)),
      isAdmin: row.isAdmin === true,
      imageUrl: this.normalizeEventEditorTextValue(rowSource?.['imageUrl']),
      visibility: target === 'hosting' ? 'Invitation only' : 'Public',
      frequency: 'One-time',
      location: this.normalizeEventEditorTextValue(rowSource?.['location']),
      capacityMin: this.toEventEditorCapacityInputValue(rowSource?.['capacityMin']),
      capacityMax: this.toEventEditorCapacityInputValue(rowSource?.['capacityMax']),
      blindMode: 'Open Event',
      autoInviter: false,
      ticketing: Boolean(rowSource?.['ticketing']),
      topics: Array.isArray(rowSource?.['topics']) ? rowSource['topics'] : [],
      subEvents: [],
      subEventsDisplayMode: 'Casual',
      startAt: this.normalizeEventEditorTextValue(rowSource?.['startAt']) || row.dateIso,
      endAt: this.normalizeEventEditorTextValue(rowSource?.['endAt']) || row.dateIso,
      published: true,
      pendingMembersCount: this.toEventEditorCapacityInputValue(
        rowSource?.['pendingMembersCount']
        ?? rowSource?.['pendingCount']
        ?? rowSource?.['pendingMembers']
        ?? rowSource?.['pending']
        ?? rowSource?.['pendingInvites']
      ) ?? 0,
      distanceKm: row.distanceKm,
      sourceLink: this.normalizeEventEditorTextValue(rowSource?.['sourceLink']),
      readOnly
    };
  }

  static toEventEditorFormState(sourceEvent: Record<string, unknown>): AppTypes.EventEditorFormState {
    const sourceCapacity = (typeof sourceEvent['capacity'] === 'object' && sourceEvent['capacity'] !== null)
      ? sourceEvent['capacity'] as Record<string, unknown>
      : null;
    const startAtDate = this.parseEventEditorDateValue(sourceEvent['startAt'] ?? sourceEvent['startDate']);
    const endAtDate = this.parseEventEditorDateValue(sourceEvent['endAt'] ?? sourceEvent['endDate']);
    const resolvedStart = startAtDate ?? new Date();
    const resolvedEnd = endAtDate ?? new Date(resolvedStart.getTime() + (60 * 60 * 1000));
    const subEvents = this.normalizeEventEditorSubEvents(
      sourceEvent['subEvents'] ?? sourceEvent['subevents'] ?? sourceEvent['sub_events']
    );

    return {
      form: {
        id: `${sourceEvent['id'] ?? sourceEvent['eventId'] ?? ''}`.trim(),
        title: `${sourceEvent['title'] ?? ''}`.trim(),
        description: `${sourceEvent['description'] ?? sourceEvent['shortDescription'] ?? ''}`.trim(),
        imageUrl: this.resolveEventEditorSourceImage(sourceEvent),
        visibility: this.normalizeEventEditorVisibility(sourceEvent['visibility']),
        frequency: this.normalizeEventEditorFrequency(sourceEvent['frequency']),
        location: this.normalizeEventEditorLocation(sourceEvent['location']),
        capacityMin: this.toEventEditorCapacityInputValue(sourceEvent['capacityMin'] ?? sourceCapacity?.['min']) ?? 0,
        capacityMax: this.toEventEditorCapacityInputValue(sourceEvent['capacityMax'] ?? sourceCapacity?.['max']) ?? 0,
        blindMode: this.normalizeEventEditorBlindMode(sourceEvent['blindMode'] ?? sourceEvent['matchingMode']),
        autoInviter: this.normalizeEventEditorAutoInviter(sourceEvent['autoInviter'] ?? sourceEvent['inviteMode']),
        ticketing: this.normalizeEventEditorTicketing(sourceEvent['ticketing'] ?? sourceEvent['ticketType']),
        topics: this.normalizeEventEditorTopics(sourceEvent['topics'] ?? sourceEvent['tags']),
        subEvents,
        startAt: AppUtils.toIsoDateTimeLocal(resolvedStart),
        endAt: AppUtils.toIsoDateTimeLocal(resolvedEnd)
      },
      subEventsDisplayMode: this.normalizeEventEditorSubEventsDisplayMode(sourceEvent['subEventsDisplayMode'], subEvents)
    };
  }
}

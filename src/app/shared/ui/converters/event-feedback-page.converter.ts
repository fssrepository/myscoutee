import { AppUtils } from '../../app-utils';
import { APP_STATIC_DATA } from '../../app-static-data';
import type { EventFeedbackListFilter } from '../../core/common/constants';
import type {
  EventFeedbackFilterCountDelta,
  EventFeedbackDto,
  EventFeedbackPageResultDto,
  EventFeedbackReceivedEntryDto,
  EventFeedbackStatDto,
  EventFeedbackStatSectionDto,
  SubmittedEventFeedbackAnswer
} from '../../core/contracts/activity.interface';
import type { AppMenuItem, AppMenuPalette, AppMenuTrigger } from '../components/core/menu';
import type { UiConverter, UiListConverter } from './converter.types';

export interface EventFeedbackFilterOption {
  key: EventFeedbackListFilter;
  label: string;
  icon: string;
}

export interface EventFeedbackFilterMenuContext {
  menu: 'filter';
  filter: EventFeedbackListFilter;
}

export interface EventFeedbackFilterMenuInput {
  result: EventFeedbackPageResultDto | null | undefined;
  activeFilter: EventFeedbackListFilter;
  delta?: EventFeedbackFilterCountDelta;
}

export interface EventFeedbackFilterMenuModel {
  trigger: AppMenuTrigger;
  items: readonly AppMenuItem<string, EventFeedbackFilterMenuContext>[];
}

export class EventFeedbackFilterMenuConverter {
  private static readonly filterOptions: readonly EventFeedbackFilterOption[] = APP_STATIC_DATA.eventFeedbackListFilters;

  static convert(input: EventFeedbackFilterMenuInput): EventFeedbackFilterMenuModel {
    const result = input.result ?? null;
    const activeFilter = input.activeFilter;
    const delta = input.delta ?? {};
    return {
      trigger: this.trigger(result, activeFilter, delta),
      items: this.items(result, activeFilter, delta)
    };
  }

  private static trigger(
    result: EventFeedbackPageResultDto | null,
    filter: EventFeedbackListFilter,
    delta: EventFeedbackFilterCountDelta
  ): AppMenuTrigger {
    const count = result?.filterCountWithDelta(filter, delta) ?? 0;
    return {
      label: this.filterLabel(filter),
      icon: this.filterIcon(filter),
      ariaLabel: 'Open event feedback filter',
      palette: this.filterPalette(filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      layout: 'pill'
    };
  }

  private static items(
    result: EventFeedbackPageResultDto | null,
    activeFilter: EventFeedbackListFilter,
    delta: EventFeedbackFilterCountDelta
  ): readonly AppMenuItem<string, EventFeedbackFilterMenuContext>[] {
    return this.filterOptions.map(option => {
      const count = result?.filterCountWithDelta(option.key, delta) ?? 0;
      return {
        id: `feedback-filter-${option.key}`,
        label: option.label,
        icon: option.icon,
        kind: 'radio',
        active: option.key === activeFilter,
        checked: option.key === activeFilter,
        palette: this.filterPalette(option.key),
        surface: 'tinted',
        counter: count > 0 ? { value: count, max: 99 } : null,
        context: { menu: 'filter', filter: option.key }
      };
    });
  }

  private static filterLabel(filter: EventFeedbackListFilter): string {
    return this.filterOptions.find(item => item.key === filter)?.label ?? 'Pending';
  }

  private static filterIcon(filter: EventFeedbackListFilter): string {
    return this.filterOptions.find(item => item.key === filter)?.icon ?? 'schedule';
  }

  private static filterPalette(filter: EventFeedbackListFilter): AppMenuPalette {
    switch (filter) {
      case 'feedbacked':
        return 'green';
      case 'removed':
        return 'slate';
      case 'own-events':
        return 'violet';
      default:
        return 'amber';
    }
  }
}

export const eventFeedbackFilterMenuConverter =
  EventFeedbackFilterMenuConverter satisfies UiConverter<
    EventFeedbackFilterMenuInput,
    EventFeedbackFilterMenuModel
  >;

export interface EventFeedbackListPresentationInput {
  result: EventFeedbackPageResultDto | null | undefined;
  filter: EventFeedbackListFilter;
  itemId?: string | null;
}

export interface EventFeedbackListPresentationModel {
  emptyDescription: string;
  groupLabel: string;
}

export class EventFeedbackListPresentationConverter {
  static convert(input: EventFeedbackListPresentationInput): EventFeedbackListPresentationModel {
    return {
      emptyDescription: this.emptyDescription(input.filter),
      groupLabel: this.groupLabel(input.result ?? null, input.itemId ?? '', input.filter)
    };
  }

  private static emptyDescription(filter: EventFeedbackListFilter): string {
    switch (filter) {
      case 'own-events':
        return 'No own events yet. Hosted events with received feedback will show here.';
      case 'feedbacked':
        return 'No feedbacked events yet.';
      case 'removed':
        return 'No removed events.';
      case 'pending':
      default:
        return 'No pending events yet. New items appear about 2 hours after event start.';
    }
  }

  private static groupLabel(
    result: EventFeedbackPageResultDto | null,
    itemId: string,
    filter: EventFeedbackListFilter
  ): string {
    const item = result?.itemById(itemId) ?? null;
    const timestampMs = item ? result?.groupTimestampMs(item, filter) ?? null : null;
    const timestampDate = AppUtils.parseDate(timestampMs);
    if (!timestampDate) {
      return 'No date';
    }
    return AppUtils.weekdayMonthDayYearLabel(timestampDate);
  }
}

export const eventFeedbackListPresentationConverter =
  EventFeedbackListPresentationConverter satisfies UiConverter<
    EventFeedbackListPresentationInput,
    EventFeedbackListPresentationModel
  >;

export interface EventFeedbackOrganizerItemData {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number | null;
  responseCount: number;
  noteCount: number;
  latestActivityAtMs: number | null;
}

export interface EventFeedbackOrganizerItemConverterOptions {
  result: EventFeedbackPageResultDto;
}

export class EventFeedbackOrganizerItemConverter {
  static convert(
    item: EventFeedbackDto,
    options: EventFeedbackOrganizerItemConverterOptions
  ): EventFeedbackOrganizerItemData {
    const eventId = item.eventId?.trim() ?? '';
    const entries = options.result.receivedEntries(eventId);
    return {
      eventId,
      title: item.title,
      subtitle: item.subtitle,
      timeframe: item.timeframe,
      imageUrl: item.imageUrl,
      startAtMs: this.numberOrNull(item.startAtMs),
      responseCount: entries.length || item.totalCards,
      noteCount: entries.filter(entry => entry.organizerNote.trim().length > 0).length,
      latestActivityAtMs: options.result.entriesLatestAtMs(entries) ?? item.feedbackedAtMs
    };
  }

  static convertList(
    items: readonly EventFeedbackDto[],
    options: EventFeedbackOrganizerItemConverterOptions
  ): EventFeedbackOrganizerItemData[] {
    return items
      .map(item => this.convert(item, options))
      .filter(item => item.eventId.length > 0 && item.responseCount > 0);
  }

  private static numberOrNull(value: number | null | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : null;
  }
}

export const eventFeedbackOrganizerItemConverter =
  EventFeedbackOrganizerItemConverter satisfies UiListConverter<
    EventFeedbackDto,
    EventFeedbackOrganizerItemData,
    EventFeedbackOrganizerItemConverterOptions
  >;

export interface EventFeedbackOrganizerStatItemData {
  key: string;
  label: string;
  icon: string;
  count: number;
}

export interface EventFeedbackOrganizerCarouselSectionData {
  key: string;
  label: string;
  icon: string;
  subtitle: string;
  toneClass: string;
  topLabel: string;
  topCount: number;
  optionCount: number;
  responseCount: number;
  progressPercent: number;
  items: EventFeedbackOrganizerStatItemData[];
}

export interface EventFeedbackOrganizerEventInput {
  result: EventFeedbackPageResultDto | null | undefined;
  eventId: string;
}

export interface EventFeedbackOrganizerStatInput {
  stat: EventFeedbackStatDto | null | undefined;
}

export class EventFeedbackOrganizerCarouselSectionConverter {
  static convert(input: EventFeedbackOrganizerStatInput): EventFeedbackOrganizerCarouselSectionData[] {
    const stat = input.stat ?? null;
    const sectionByKey = new Map((stat?.sections ?? []).map(section => [section.key, section]));
    const totalResponses = Math.max(0, Math.trunc(Number(stat?.totalResponses) || 0));
    return [
      this.buildSection(
        totalResponses,
        'overall',
        'Overall',
        'sentiment_satisfied',
        'Most selected event impression',
        'event-feedback-organizer-carousel-card-tone-overall',
        this.optionStats(
          APP_STATIC_DATA.eventFeedbackEventOverallOptions,
          sectionByKey.get('overall')
        )
      ),
      this.buildSection(
        totalResponses,
        'improve',
        'Improve Next',
        'campaign',
        'Most requested improvement next time',
        'event-feedback-organizer-carousel-card-tone-improve',
        this.optionStats(
          APP_STATIC_DATA.eventFeedbackHostImproveOptions,
          sectionByKey.get('improve')
        )
      ),
      this.buildSection(
        totalResponses,
        'traits',
        'Host Traits',
        'groups',
        'Traits attendees mentioned most',
        'event-feedback-organizer-carousel-card-tone-traits',
        this.traitStats(sectionByKey.get('traits'))
      )
    ].filter((section): section is EventFeedbackOrganizerCarouselSectionData => section !== null);
  }

  private static buildSection(
    totalEntries: number,
    key: string,
    label: string,
    icon: string,
    subtitle: string,
    toneClass: string,
    items: readonly EventFeedbackOrganizerStatItemData[]
  ): EventFeedbackOrganizerCarouselSectionData | null {
    if (items.length === 0) {
      return null;
    }
    const topItem = items[0];
    const topCount = Math.max(0, topItem?.count ?? 0);
    const progressPercent = totalEntries > 0
      ? Math.max(8, Math.min(100, Math.round((topCount / totalEntries) * 100)))
      : 0;
    return {
      key,
      label,
      icon,
      subtitle,
      toneClass,
      topLabel: topItem?.label ?? label,
      topCount,
      optionCount: items.length,
      responseCount: totalEntries,
      progressPercent,
      items: items.map(item => ({ ...item }))
    };
  }

  private static traitStats(section: EventFeedbackStatSectionDto | undefined): EventFeedbackOrganizerStatItemData[] {
    const countsByTraitId = this.optionCountByKey(section);
    return APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions
      .map(option => ({
        key: option.id,
        label: option.label,
        icon: option.icon,
        count: countsByTraitId.get(option.id) ?? 0
      }))
      .filter(item => item.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }

  private static optionStats(
    options: readonly { value: string; label: string; icon: string }[],
    section: EventFeedbackStatSectionDto | undefined
  ): EventFeedbackOrganizerStatItemData[] {
    const countsByValue = this.optionCountByKey(section);
    return options
      .map(option => ({
        key: option.value,
        label: option.label,
        icon: option.icon,
        count: countsByValue.get(option.value) ?? 0
      }))
      .filter(item => item.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }

  private static optionCountByKey(section: EventFeedbackStatSectionDto | undefined): Map<string, number> {
    const countsByKey = new Map<string, number>();
    for (const option of section?.options ?? []) {
      const key = option.key?.trim() ?? '';
      const count = Math.max(0, Math.trunc(Number(option.count) || 0));
      if (!key || count <= 0) {
        continue;
      }
      countsByKey.set(key, count);
    }
    return countsByKey;
  }
}

export const eventFeedbackOrganizerCarouselSectionConverter =
  EventFeedbackOrganizerCarouselSectionConverter satisfies UiConverter<
    EventFeedbackOrganizerStatInput,
    EventFeedbackOrganizerCarouselSectionData[]
  >;

export interface EventFeedbackOrganizerMessageItemData {
  id: string;
  viewerUserId: string;
  viewerName: string;
  viewerInitials: string;
  viewerGender: string;
  viewerImageUrl: string;
  timestampIso: string;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  organizerNote: string;
  overallLabel: string | null;
  improveLabel: string | null;
  traitLabels: string[];
  responseCount: number;
}

export interface EventFeedbackOrganizerMessageGroupData {
  dayKey: string;
  label: string;
  items: EventFeedbackOrganizerMessageItemData[];
}

export class EventFeedbackOrganizerMessageGroupConverter {
  static convert(input: EventFeedbackOrganizerEventInput): EventFeedbackOrganizerMessageGroupData[] {
    const groups = new Map<string, EventFeedbackOrganizerMessageGroupData>();
    for (const entry of input.result?.organizerEntries(input.eventId) ?? []) {
      const timestampIso = this.entryTimestampIso(entry);
      const timestampDate = AppUtils.parseDate(timestampIso);
      const answer = this.entryEventAnswer(entry);
      const viewerName = entry.viewerName?.trim() || entry.viewerUserId.trim() || 'Member';
      const viewerInitials = entry.viewerInitials?.trim() || AppUtils.initialsFromText(viewerName);
      const viewerGender = entry.viewerGender === 'woman' ? 'woman' : 'man';
      const viewerImageUrl = entry.viewerImageUrl?.trim() || '';
      const dayKey = timestampDate ? AppUtils.toIsoDate(timestampDate) : 'undated';
      const dayLabel = timestampDate
        ? AppUtils.weekdayMonthDayLabel(timestampDate)
        : 'No date';
      const timeLabel = timestampDate
        ? AppUtils.clockTimeLabel(timestampDate)
        : '';
      const group = groups.get(dayKey) ?? { dayKey, label: dayLabel, items: [] };
      group.items.push({
        id: `${entry.viewerUserId}:${timestampIso || dayKey}`,
        viewerUserId: entry.viewerUserId,
        viewerName,
        viewerInitials,
        viewerGender,
        viewerImageUrl,
        timestampIso,
        dayKey,
        dayLabel,
        timeLabel,
        organizerNote: entry.organizerNote.trim(),
        overallLabel: answer ? this.optionLabel(answer.primaryValue ?? '', APP_STATIC_DATA.eventFeedbackEventOverallOptions) : null,
        improveLabel: answer ? this.optionLabel(answer.secondaryValue ?? '', APP_STATIC_DATA.eventFeedbackHostImproveOptions) : null,
        traitLabels: answer
          ? (answer.personalityTraitIds ?? [])
            .map(traitId => APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions.find(option => option.id === traitId)?.label ?? '')
            .filter(label => label.length > 0)
          : [],
        responseCount: entry.answers.length
      });
      groups.set(dayKey, group);
    }
    return [...groups.values()]
      .map(group => ({
        ...group,
        items: [...group.items].sort((left, right) => {
          const leftMs = AppUtils.dateTimeMs(left.timestampIso) ?? 0;
          const rightMs = AppUtils.dateTimeMs(right.timestampIso) ?? 0;
          return rightMs - leftMs || left.viewerName.localeCompare(right.viewerName);
        })
      }))
      .sort((left, right) => {
        if (left.dayKey === 'undated') {
          return 1;
        }
        if (right.dayKey === 'undated') {
          return -1;
        }
        return right.dayKey.localeCompare(left.dayKey);
      });
  }

  private static optionLabel(
    value: string,
    options: readonly { value: string; label: string }[]
  ): string | null {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }
    return options.find(option => option.value === normalizedValue)?.label ?? null;
  }

  private static entryTimestampIso(entry: EventFeedbackReceivedEntryDto): string {
    const updatedAtIso = entry.updatedAtIso?.trim() ?? '';
    if (updatedAtIso) {
      return updatedAtIso;
    }
    const submittedAtIso = entry.submittedAtIso?.trim() ?? '';
    if (submittedAtIso) {
      return submittedAtIso;
    }
    return '';
  }

  private static entryEventAnswer(entry: EventFeedbackReceivedEntryDto): SubmittedEventFeedbackAnswer | null {
    return (entry.answers ?? []).find(answer => answer.kind === 'event') ?? null;
  }
}

export const eventFeedbackOrganizerMessageGroupConverter =
  EventFeedbackOrganizerMessageGroupConverter satisfies UiConverter<
    EventFeedbackOrganizerEventInput,
    EventFeedbackOrganizerMessageGroupData[]
  >;

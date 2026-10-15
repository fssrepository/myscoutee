import {
  UiDateUtils,
  type AppMenuItem,
  type AppMenuTrigger,
  type UiConverter,
  type UiListConverter
} from '@fssrepository/myscoutee-components';
import { AppUtils } from '../../../core/base/app-utils';
import { APP_STATIC_DATA } from '../../../core/common/app-static-data';
import type { FeedbackListFilter } from '../../../core/common/constants';
import type { FeedbackFilterCountDelta, FeedbackDto, FeedbackPageCountsDto, FeedbackPageResultDto, FeedbackReceivedEntryDto, FeedbackStatDto, FeedbackStatSectionDto, SubmittedFeedbackAnswer } from '../../../core/contracts/feedback/feedback.interface';

export interface FeedbackFilterOption {
  key: FeedbackListFilter;
  label: string;
  icon: string;
}

export interface FeedbackFilterMenuContext {
  menu: 'filter';
  filter: FeedbackListFilter;
}

export interface FeedbackFilterMenuInput {
  result: FeedbackPageResultDto | null | undefined;
  counts?: FeedbackPageCountsDto;
  activeFilter: FeedbackListFilter;
  delta?: FeedbackFilterCountDelta;
}

export interface FeedbackFilterMenuModel {
  trigger: AppMenuTrigger;
  items: readonly AppMenuItem<string, FeedbackFilterMenuContext>[];
}

export class FeedbackFilterMenuConverter {
  private static readonly filterOptions: readonly FeedbackFilterOption[] = APP_STATIC_DATA.feedbackListFilters;

  static convert(input: FeedbackFilterMenuInput): FeedbackFilterMenuModel {
    const result = input.result ?? null;
    const activeFilter = input.activeFilter;
    const delta = input.delta ?? {};
    return {
      trigger: this.trigger(result, activeFilter, delta, input.counts),
      items: this.items(result, activeFilter, delta, input.counts)
    };
  }

  private static trigger(
    result: FeedbackPageResultDto | null,
    filter: FeedbackListFilter,
    delta: FeedbackFilterCountDelta,
    counts?: FeedbackPageCountsDto
  ): AppMenuTrigger {
    const count = counts ? counts[filter === 'own-events' ? 'ownEvents' : filter]
      : result?.filterCountWithDelta(filter, delta) ?? 0;
    return {
      label: this.filterLabel(filter),
      icon: this.filterIcon(filter),
      ariaLabel: 'feedback.filter',
      palette: this.filterPalette(filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      layout: 'pill'
    };
  }

  private static items(
    result: FeedbackPageResultDto | null,
    activeFilter: FeedbackListFilter,
    delta: FeedbackFilterCountDelta,
    counts?: FeedbackPageCountsDto
  ): readonly AppMenuItem<string, FeedbackFilterMenuContext>[] {
    return this.filterOptions.map(option => {
      const count = counts ? counts[option.key === 'own-events' ? 'ownEvents' : option.key]
        : result?.filterCountWithDelta(option.key, delta) ?? 0;
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

  private static filterLabel(filter: FeedbackListFilter): string {
    return this.filterOptions.find(item => item.key === filter)?.label ?? 'Pending';
  }

  private static filterIcon(filter: FeedbackListFilter): string {
    return this.filterOptions.find(item => item.key === filter)?.icon ?? 'schedule';
  }

  static filterPalette(filter: FeedbackListFilter): 'green' | 'slate' | 'violet' | 'amber' {
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

export const feedbackFilterMenuConverter =
  FeedbackFilterMenuConverter satisfies UiConverter<
    FeedbackFilterMenuInput,
    FeedbackFilterMenuModel
  >;

export interface FeedbackListPresentationInput {
  result: FeedbackPageResultDto | null | undefined;
  filter: FeedbackListFilter;
  itemId?: string | null;
}

export interface FeedbackListPresentationModel {
  emptyDescription: string;
  groupLabel: string;
}

export class FeedbackListPresentationConverter {
  static convert(input: FeedbackListPresentationInput): FeedbackListPresentationModel {
    return {
      emptyDescription: this.emptyDescription(input.filter),
      groupLabel: this.groupLabel(input.result ?? null, input.itemId ?? '', input.filter)
    };
  }

  private static emptyDescription(filter: FeedbackListFilter): string {
    switch (filter) {
      case 'own-events':
        return 'feedback.empty.own';
      case 'feedbacked':
        return 'feedback.empty.feedbacked';
      case 'removed':
        return 'feedback.empty.removed';
      case 'pending':
      default:
        return 'feedback.empty.pending';
    }
  }

  private static groupLabel(
    result: FeedbackPageResultDto | null,
    itemId: string,
    filter: FeedbackListFilter
  ): string {
    const item = result?.itemById(itemId) ?? null;
    const timestampMs = item ? result?.groupTimestampMs(item, filter) ?? null : null;
    const timestampDate = UiDateUtils.parseDate(timestampMs);
    if (!timestampDate) {
      return 'No date';
    }
    return UiDateUtils.weekdayMonthDayYearLabel(timestampDate);
  }
}

export const feedbackListPresentationConverter =
  FeedbackListPresentationConverter satisfies UiConverter<
    FeedbackListPresentationInput,
    FeedbackListPresentationModel
  >;

export interface FeedbackOrganizerItemData {
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

export interface FeedbackOrganizerItemConverterOptions {
  result: FeedbackPageResultDto;
}

export class FeedbackOrganizerItemConverter {
  static convert(
    item: FeedbackDto,
    options: FeedbackOrganizerItemConverterOptions
  ): FeedbackOrganizerItemData {
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
    items: readonly FeedbackDto[],
    options: FeedbackOrganizerItemConverterOptions
  ): FeedbackOrganizerItemData[] {
    return items
      .map(item => this.convert(item, options))
      .filter(item => item.eventId.length > 0);
  }

  private static numberOrNull(value: number | null | undefined): number | null {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : null;
  }
}

export const feedbackOrganizerItemConverter =
  FeedbackOrganizerItemConverter satisfies UiListConverter<
    FeedbackDto,
    FeedbackOrganizerItemData,
    FeedbackOrganizerItemConverterOptions
  >;

export interface FeedbackOrganizerStatItemData {
  key: string;
  label: string;
  icon: string;
  count: number;
}

export interface FeedbackOrganizerCarouselSectionData {
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
  items: FeedbackOrganizerStatItemData[];
}

export interface FeedbackOrganizerEventInput {
  result: FeedbackPageResultDto | null | undefined;
  eventId: string;
}

export interface FeedbackOrganizerStatInput {
  stat: FeedbackStatDto | null | undefined;
}

export class FeedbackOrganizerCarouselSectionConverter {
  static convert(input: FeedbackOrganizerStatInput): FeedbackOrganizerCarouselSectionData[] {
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
        'feedback-organizer-carousel-card-tone-overall',
        this.optionStats(
          APP_STATIC_DATA.feedbackEventOverallOptions,
          sectionByKey.get('overall')
        )
      ),
      this.buildSection(
        totalResponses,
        'improve',
        'Improve Next',
        'campaign',
        'Most requested improvement next time',
        'feedback-organizer-carousel-card-tone-improve',
        this.optionStats(
          APP_STATIC_DATA.feedbackHostImproveOptions,
          sectionByKey.get('improve')
        )
      ),
      this.buildSection(
        totalResponses,
        'traits',
        'Host Traits',
        'groups',
        'Traits attendees mentioned most',
        'feedback-organizer-carousel-card-tone-traits',
        this.traitStats(sectionByKey.get('traits'))
      )
    ].filter((section): section is FeedbackOrganizerCarouselSectionData => section !== null);
  }

  private static buildSection(
    totalEntries: number,
    key: string,
    label: string,
    icon: string,
    subtitle: string,
    toneClass: string,
    items: readonly FeedbackOrganizerStatItemData[]
  ): FeedbackOrganizerCarouselSectionData | null {
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

  private static traitStats(section: FeedbackStatSectionDto | undefined): FeedbackOrganizerStatItemData[] {
    const countsByTraitId = this.optionCountByKey(section);
    return APP_STATIC_DATA.feedbackPersonalityTraitOptions
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
    section: FeedbackStatSectionDto | undefined
  ): FeedbackOrganizerStatItemData[] {
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

  private static optionCountByKey(section: FeedbackStatSectionDto | undefined): Map<string, number> {
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

export const feedbackOrganizerCarouselSectionConverter =
  FeedbackOrganizerCarouselSectionConverter satisfies UiConverter<
    FeedbackOrganizerStatInput,
    FeedbackOrganizerCarouselSectionData[]
  >;

export interface FeedbackOrganizerMessageItemData {
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
  eventComment: string;
  overallLabel: string | null;
  improveLabel: string | null;
  traitLabels: string[];
  responseCount: number;
}

export interface FeedbackOrganizerMessageGroupData {
  dayKey: string;
  label: string;
  items: FeedbackOrganizerMessageItemData[];
}

export class FeedbackOrganizerMessageGroupConverter {
  static convert(input: FeedbackOrganizerEventInput): FeedbackOrganizerMessageGroupData[] {
    const groups = new Map<string, FeedbackOrganizerMessageGroupData>();
    for (const entry of input.result?.organizerEntries(input.eventId) ?? []) {
      const timestampIso = this.entryTimestampIso(entry);
      const timestampDate = UiDateUtils.parseDate(timestampIso);
      const answer = this.entryEventAnswer(entry);
      const viewerName = entry.viewerName?.trim() || entry.viewerUserId.trim() || 'Member';
      const viewerInitials = entry.viewerInitials?.trim() || AppUtils.initialsFromText(viewerName);
      const viewerGender = entry.viewerGender === 'woman' ? 'woman' : 'man';
      const viewerImageUrl = entry.viewerImageUrl?.trim() || '';
      const dayKey = timestampDate ? UiDateUtils.toIsoDate(timestampDate) : 'undated';
      const dayLabel = timestampDate
        ? UiDateUtils.weekdayMonthDayLabel(timestampDate)
        : 'No date';
      const timeLabel = timestampDate
        ? UiDateUtils.clockTimeLabel(timestampDate)
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
        eventComment: answer?.eventComment?.trim() ?? '',
        overallLabel: answer ? this.optionLabel(answer.primaryValue ?? '', APP_STATIC_DATA.feedbackEventOverallOptions) : null,
        improveLabel: answer ? this.optionLabel(answer.secondaryValue ?? '', APP_STATIC_DATA.feedbackHostImproveOptions) : null,
        traitLabels: answer
          ? (answer.personalityTraitIds ?? [])
            .map(traitId => APP_STATIC_DATA.feedbackPersonalityTraitOptions.find(option => option.id === traitId)?.label ?? '')
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
          const leftMs = UiDateUtils.dateTimeMs(left.timestampIso) ?? 0;
          const rightMs = UiDateUtils.dateTimeMs(right.timestampIso) ?? 0;
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

  private static entryTimestampIso(entry: FeedbackReceivedEntryDto): string {
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

  private static entryEventAnswer(entry: FeedbackReceivedEntryDto): SubmittedFeedbackAnswer | null {
    return (entry.answers ?? []).find(answer => answer.kind === 'event') ?? null;
  }
}

export const feedbackOrganizerMessageGroupConverter =
  FeedbackOrganizerMessageGroupConverter satisfies UiConverter<
    FeedbackOrganizerEventInput,
    FeedbackOrganizerMessageGroupData[]
  >;

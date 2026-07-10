import type {
  ListQuery,
  SmartListConfig,
  SmartListConfigValue,
  SmartListFilters,
  SmartListTimelineConfig,
  SmartListTimelinePage,
  SmartListTimelineRange,
  SmartListTimelineSpan,
  SmartListTimelineTick
} from './smart-list.types';
import type {
  AnySmartListPageAdapter,
  SmartListPageAdapter,
  SmartListPageBuildContext,
  SmartListPageMode
} from './smart-list-page.adapter';

export type SmartListTimelinePageBuildContext<T, TFilters extends SmartListFilters = SmartListFilters>
  = SmartListPageBuildContext<T, TFilters, SmartListTimelineConfig<T, TFilters>>;

export type SmartListTimelinePageAdapter<T, TFilters extends SmartListFilters = SmartListFilters>
  = SmartListPageAdapter<
    T,
    TFilters,
    SmartListTimelineConfig<T, TFilters>,
    SmartListTimelinePage<T>
  > & { mode: 'timeline' };

interface TimelineSpanCandidate<T> {
  item: T;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  visibleStartOffsetMinutes: number;
  visibleEndOffsetMinutes: number;
  collisionStartOffsetMinutes: number;
  collisionEndOffsetMinutes: number;
  row: number | null;
}

const TIMELINE_EPOCH_MS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
const DEFAULT_TIMELINE_STEP_MINUTES = 30;
const DEFAULT_TIMELINE_VISIBLE_DURATION_MINUTES = 4 * 60;
const DEFAULT_TIMELINE_ROW_HEIGHT_PX = 64;

const smartListTimelineAdapter = createTimelineAdapter<unknown, SmartListFilters>();

export const SmartListTimelineAdapter = {
  getInstance<T, TFilters extends SmartListFilters = SmartListFilters>(
    mode: SmartListPageMode
  ): AnySmartListPageAdapter<T, TFilters> | null {
    if (mode === 'timeline') {
      return smartListTimelineAdapter as unknown as SmartListTimelinePageAdapter<T, TFilters>;
    }
    return null;
  }
} as const;

function createTimelineAdapter<
  T,
  TFilters extends SmartListFilters
>(): SmartListTimelinePageAdapter<T, TFilters> {
  return {
    mode: 'timeline',
    config: timelineConfig,
    variant: () => 'default',
    anchorRadius,
    initialAnchor,
    initialAnchorKey,
    normalizeAnchor,
    keyForAnchor,
    shiftAnchor,
    queryForAnchor,
    anchorForPage: page => page.anchor,
    labelForPage: page => page.label,
    buildPage: context => buildTimelinePage(context)
  };
}

function timelineConfig<T, TFilters extends SmartListFilters>(
  config: SmartListConfig<T, TFilters>
): SmartListTimelineConfig<T, TFilters> | null {
  return config.timeline ?? null;
}

function anchorRadius<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null
): number {
  return Math.max(0, Math.trunc(timeline?.anchorRadius ?? 1));
}

function initialAnchor<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): Date | null {
  const offset = initialOffsetMinutes(timeline, query);
  return dateFromOffsetMinutes(offset);
}

function initialAnchorKey<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): string {
  return keyForOffsetMinutes(initialOffsetMinutes(timeline, query));
}

function normalizeAnchor<T, TFilters extends SmartListFilters>(
  anchor: Date,
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): Date {
  const startOffset = startOffsetMinutes(timeline, query);
  const pageStep = pageStepMinutes(timeline, query);
  const offset = offsetMinutesFromDate(anchor);
  const pageIndex = Math.round((offset - startOffset) / pageStep);
  return dateFromOffsetMinutes(startOffset + (pageIndex * pageStep));
}

function keyForAnchor<T, TFilters extends SmartListFilters>(
  anchor: Date,
  _timeline: SmartListTimelineConfig<T, TFilters> | null,
  _query: ListQuery<TFilters>
): string {
  return keyForOffsetMinutes(offsetMinutesFromDate(anchor));
}

function shiftAnchor<T, TFilters extends SmartListFilters>(
  anchor: Date,
  direction: -1 | 1,
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): Date {
  const normalized = normalizeAnchor(anchor, timeline, query);
  return dateFromOffsetMinutes(offsetMinutesFromDate(normalized) + (direction * pageStepMinutes(timeline, query)));
}

function queryForAnchor<T, TFilters extends SmartListFilters>(
  query: ListQuery<TFilters>,
  anchor: Date,
  timeline: SmartListTimelineConfig<T, TFilters> | null
): ListQuery<TFilters> {
  const startOffset = offsetMinutesFromDate(anchor);
  const endOffset = startOffset + visibleDurationMinutes(timeline, query);
  return {
    ...query,
    page: 0,
    cursor: undefined,
    anchorDate: `${startOffset}`,
    rangeStart: `${startOffset}`,
    rangeEnd: `${endOffset}`
  };
}

function buildTimelinePage<T, TFilters extends SmartListFilters>(
  context: SmartListTimelinePageBuildContext<T, TFilters>
): SmartListTimelinePage<T> {
  const startOffset = offsetMinutesFromDate(context.anchor);
  const visibleDuration = visibleDurationMinutes(context.viewConfig, context.query);
  const endOffset = startOffset + visibleDuration;
  const step = stepMinutes(context.viewConfig, context.query);
  const rowHeightPx = timelineRowHeightPx(context.viewConfig, context.query);
  const ticks = timelineTicks(startOffset, endOffset, step, context.viewConfig, context.query);
  const candidates = timelineSpanCandidates(context.items, startOffset, endOffset, context);
  const rows = assignTimelineRows(candidates);
  const configuredRows = resolvedOptionalPositiveInteger(context.viewConfig.rowCount, null, context.query);
  const rowCount = Math.max(1, configuredRows ?? 0, rows.rowCount);
  const spans = rows.candidates.map(candidate =>
    timelineSpanFromCandidate(candidate, startOffset, visibleDuration, rowHeightPx, context)
  );

  return {
    key: keyForOffsetMinutes(startOffset),
    label: `${formatOffsetMinutes(startOffset)} - ${formatOffsetMinutes(endOffset)}`,
    anchor: dateFromOffsetMinutes(startOffset),
    startOffsetMinutes: startOffset,
    endOffsetMinutes: endOffset,
    visibleDurationMinutes: visibleDuration,
    stepMinutes: step,
    rowCount,
    rowHeightPx,
    ticks,
    spans
  };
}

function timelineTicks<T, TFilters extends SmartListFilters>(
  startOffset: number,
  endOffset: number,
  step: number,
  timeline: SmartListTimelineConfig<T, TFilters>,
  query: ListQuery<TFilters>
): SmartListTimelineTick[] {
  const count = Math.max(1, Math.ceil((endOffset - startOffset) / step));
  return Array.from({ length: count }, (_item, index) => {
    const offset = startOffset + (index * step);
    const customLabel = timeline.offsetLabel?.(offset, query);
    return {
      key: `${offset}`,
      offsetMinutes: offset,
      label: typeof customLabel === 'string' && customLabel.trim()
        ? customLabel
        : formatOffsetMinutes(offset)
    };
  });
}

function timelineSpanCandidates<T, TFilters extends SmartListFilters>(
  items: readonly T[],
  pageStartOffset: number,
  pageEndOffset: number,
  context: SmartListTimelinePageBuildContext<T, TFilters>
): TimelineSpanCandidate<T>[] {
  const candidates: TimelineSpanCandidate<T>[] = [];
  const minimumLaneDuration = minimumLaneDurationMinutes(context.viewConfig, context.query);
  for (const item of items) {
    const range = normalizeTimelineRange(context.viewConfig.resolveRange(item, context.query));
    if (!range) {
      continue;
    }
    if (range.startOffsetMinutes >= pageEndOffset || range.endOffsetMinutes <= pageStartOffset) {
      continue;
    }
    const visibleStartOffsetMinutes = Math.max(range.startOffsetMinutes, pageStartOffset);
    const visibleEndOffsetMinutes = Math.min(range.endOffsetMinutes, pageEndOffset);
    candidates.push({
      item,
      startOffsetMinutes: range.startOffsetMinutes,
      endOffsetMinutes: range.endOffsetMinutes,
      visibleStartOffsetMinutes,
      visibleEndOffsetMinutes,
      collisionStartOffsetMinutes: visibleStartOffsetMinutes,
      collisionEndOffsetMinutes: Math.min(
        pageEndOffset,
        Math.max(visibleEndOffsetMinutes, visibleStartOffsetMinutes + minimumLaneDuration)
      ),
      row: normalizedRow(range.row)
    });
  }
  return candidates.sort((first, second) =>
    first.visibleStartOffsetMinutes - second.visibleStartOffsetMinutes
    || second.visibleEndOffsetMinutes - first.visibleEndOffsetMinutes
  );
}

function assignTimelineRows<T>(candidates: readonly TimelineSpanCandidate<T>[]): {
  candidates: TimelineSpanCandidate<T>[];
  rowCount: number;
} {
  const lanes: Array<Array<{ startOffsetMinutes: number; endOffsetMinutes: number }>> = [];
  const assigned: TimelineSpanCandidate<T>[] = [];
  for (const candidate of candidates) {
    const row = candidate.row ?? firstAvailableTimelineRow(lanes, candidate);
    if (!lanes[row]) {
      lanes[row] = [];
    }
    lanes[row].push({
      startOffsetMinutes: candidate.collisionStartOffsetMinutes,
      endOffsetMinutes: candidate.collisionEndOffsetMinutes
    });
    assigned.push({ ...candidate, row });
  }
  return {
    candidates: assigned,
    rowCount: lanes.length
  };
}

function firstAvailableTimelineRow<T>(
  lanes: Array<Array<{ startOffsetMinutes: number; endOffsetMinutes: number }>>,
  candidate: TimelineSpanCandidate<T>
): number {
  let row = 0;
  while (row < lanes.length) {
    const conflict = lanes[row].some(item =>
      candidate.collisionStartOffsetMinutes < item.endOffsetMinutes
      && candidate.collisionEndOffsetMinutes > item.startOffsetMinutes
    );
    if (!conflict) {
      return row;
    }
    row += 1;
  }
  return row;
}

function timelineSpanFromCandidate<T, TFilters extends SmartListFilters>(
  candidate: TimelineSpanCandidate<T>,
  pageStartOffset: number,
  visibleDuration: number,
  rowHeightPx: number,
  context: SmartListTimelinePageBuildContext<T, TFilters>
): SmartListTimelineSpan<T> {
  const row = candidate.row ?? 0;
  const label = timelineBadgeLabel(candidate.item, context);
  const meta = context.viewConfig.badgeMeta?.(candidate.item, context.query)?.trim() || null;
  const toneClass = context.viewConfig.badgeToneClass?.(candidate.item, context.query) ?? null;
  const customAriaLabel = context.viewConfig.badgeAriaLabel?.(candidate.item, context.query)?.trim();
  const rangeLabel = `${formatOffsetMinutes(candidate.startOffsetMinutes)} - ${formatOffsetMinutes(candidate.endOffsetMinutes)}`;
  return {
    key: [
      context.trackByKey(candidate.item),
      pageStartOffset,
      candidate.visibleStartOffsetMinutes,
      candidate.visibleEndOffsetMinutes,
      row
    ].join(':'),
    item: candidate.item,
    startOffsetMinutes: candidate.startOffsetMinutes,
    endOffsetMinutes: candidate.endOffsetMinutes,
    visibleStartOffsetMinutes: candidate.visibleStartOffsetMinutes,
    visibleEndOffsetMinutes: candidate.visibleEndOffsetMinutes,
    row,
    leftPct: ((candidate.visibleStartOffsetMinutes - pageStartOffset) / visibleDuration) * 100,
    widthPct: Math.max(1.4, ((candidate.visibleEndOffsetMinutes - candidate.visibleStartOffsetMinutes) / visibleDuration) * 100),
    topPx: (row * rowHeightPx) + 6,
    heightPx: Math.max(32, rowHeightPx - 12),
    label,
    meta,
    ariaLabel: customAriaLabel || `${label}, ${rangeLabel}`,
    toneClass,
    continuesBefore: candidate.startOffsetMinutes < candidate.visibleStartOffsetMinutes,
    continuesAfter: candidate.endOffsetMinutes > candidate.visibleEndOffsetMinutes
  };
}

function normalizeTimelineRange(range: SmartListTimelineRange | null): SmartListTimelineRange | null {
  if (!range) {
    return null;
  }
  const start = Math.trunc(Number(range.startOffsetMinutes));
  const end = Math.trunc(Number(range.endOffsetMinutes));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return {
    startOffsetMinutes: start,
    endOffsetMinutes: Math.max(start + 1, end),
    row: range.row
  };
}

function timelineBadgeLabel<T, TFilters extends SmartListFilters>(
  item: T,
  context: SmartListTimelinePageBuildContext<T, TFilters>
): string {
  const custom = context.viewConfig.badgeLabel?.(item, context.query);
  if (typeof custom === 'string' && custom.trim()) {
    return custom;
  }
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item);
  }
  if (item && typeof item === 'object') {
    const candidate = (item as { title?: unknown; name?: unknown; label?: unknown }).title
      ?? (item as { name?: unknown }).name
      ?? (item as { label?: unknown }).label;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return 'Item';
}

function initialOffsetMinutes<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): number {
  const configured = resolveConfigValue(timeline?.initialOffsetMinutes, null, query);
  if (Number.isFinite(Number(configured))) {
    return Math.trunc(Number(configured));
  }
  return startOffsetMinutes(timeline, query);
}

function startOffsetMinutes<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): number {
  return resolvedInteger(timeline?.startOffsetMinutes, 0, query);
}

function stepMinutes<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): number {
  return Math.max(1, resolvedInteger(timeline?.stepMinutes, DEFAULT_TIMELINE_STEP_MINUTES, query));
}

function visibleDurationMinutes<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): number {
  const visible = Math.max(
    1,
    resolvedInteger(timeline?.visibleDurationMinutes, DEFAULT_TIMELINE_VISIBLE_DURATION_MINUTES, query)
  );
  return Math.max(stepMinutes(timeline, query), visible);
}

function pageStepMinutes<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters> | null,
  query: ListQuery<TFilters>
): number {
  return Math.max(1, resolvedInteger(timeline?.pageStepMinutes, visibleDurationMinutes(timeline, query), query));
}

function timelineRowHeightPx<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters>,
  query: ListQuery<TFilters>
): number {
  return Math.max(44, resolvedInteger(timeline.rowHeightPx, DEFAULT_TIMELINE_ROW_HEIGHT_PX, query));
}

function minimumLaneDurationMinutes<T, TFilters extends SmartListFilters>(
  timeline: SmartListTimelineConfig<T, TFilters>,
  query: ListQuery<TFilters>
): number {
  return Math.max(1, resolvedInteger(timeline.minimumLaneDurationMinutes, 1, query));
}

function resolvedInteger<TFilters extends SmartListFilters>(
  value: SmartListConfigValue<number, TFilters> | undefined,
  fallback: number,
  query: ListQuery<TFilters>
): number {
  const resolved = resolveConfigValue(value, fallback, query);
  const parsed = Math.trunc(Number(resolved));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvedOptionalPositiveInteger<TFilters extends SmartListFilters>(
  value: SmartListConfigValue<number | null | undefined, TFilters> | undefined,
  fallback: number | null,
  query: ListQuery<TFilters>
): number | null {
  const resolved = resolveConfigValue(value, fallback, query);
  const parsed = Math.trunc(Number(resolved));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveConfigValue<TValue, TFilters extends SmartListFilters>(
  value: SmartListConfigValue<TValue, TFilters> | undefined,
  fallback: TValue,
  query: ListQuery<TFilters>
): TValue {
  if (typeof value === 'function') {
    return (value as (query: ListQuery<TFilters>) => TValue)(query);
  }
  return value ?? fallback;
}

function normalizedRow(value: number | null | undefined): number | null {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function dateFromOffsetMinutes(offsetMinutes: number): Date {
  return new Date(TIMELINE_EPOCH_MS + (Math.trunc(offsetMinutes) * 60000));
}

function offsetMinutesFromDate(value: Date): number {
  const timestamp = value instanceof Date ? value.getTime() : Number.NaN;
  return Number.isFinite(timestamp)
    ? Math.trunc((timestamp - TIMELINE_EPOCH_MS) / 60000)
    : 0;
}

function keyForOffsetMinutes(offsetMinutes: number): string {
  return `timeline:${Math.trunc(offsetMinutes)}`;
}

function formatOffsetMinutes(totalMinutes: number): string {
  const normalized = Math.trunc(totalMinutes);
  const sign = normalized < 0 ? '-' : '';
  const absolute = Math.abs(normalized);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  if (hours <= 0) {
    return `${sign}${minutes}m`;
  }
  if (minutes <= 0) {
    return `${sign}${hours}h`;
  }
  return `${sign}${hours}h ${minutes}m`;
}

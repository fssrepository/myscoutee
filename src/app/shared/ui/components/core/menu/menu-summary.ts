import type {
  AppMenuCounter,
  AppMenuCounterValue,
  AppMenuGroup,
  AppMenuItem,
  AppMenuLiveValue,
  AppMenuModel,
  AppMenuValueKey
} from './menu.types';

export interface AppMenuModelSummaryResult {
  label: string;
  counter: AppMenuCounter | AppMenuCounterValue | null;
  selectedCount: number;
}

export interface AppMenuModelSummarySelection {
  active: boolean;
  value: unknown;
  valueKey?: AppMenuValueKey | null;
}

export function appMenuModelGroups<TId extends string = string, TContext = unknown>(
  model: AppMenuModel<TId, TContext> | null | undefined,
  fallback: readonly AppMenuGroup<TId, TContext>[] = []
): readonly AppMenuGroup<TId, TContext>[] {
  return model?.groups ?? model?.nodes ?? fallback;
}

export function appMenuModelSummary<TId extends string = string, TContext = unknown>(
  model: AppMenuModel<TId, TContext> | null | undefined,
  fallbackGroups: readonly AppMenuGroup<TId, TContext>[] = [],
  selection: AppMenuModelSummarySelection | null = null
): AppMenuModelSummaryResult {
  const summary = model?.summary ?? null;
  if (!summary) {
    return {
      label: '',
      counter: null,
      selectedCount: 0
    };
  }

  const labels = appMenuSelectedLabels(appMenuModelGroups(model, fallbackGroups), selection);
  const maxLabels = Math.max(1, Math.trunc(Number(summary.maxLabels) || 1));
  const visibleLabels = labels.slice(0, maxLabels);
  const label = visibleLabels.length > 0
    ? visibleLabels.join(', ')
    : `${appMenuResolveLiveValue(summary.emptyLabel) ?? ''}`.trim();
  const counter = appMenuSummaryCounter(labels.length, maxLabels, summary.counter ?? 'overflow');

  return {
    label,
    counter,
    selectedCount: labels.length
  };
}

export function appMenuResolveLiveValue<T>(value: AppMenuLiveValue<T> | null | undefined): T | null | undefined {
  if (typeof value === 'function') {
    return (value as () => T)();
  }
  return value;
}

function appMenuSelectedLabels<TId extends string, TContext>(
  groups: readonly AppMenuGroup<TId, TContext>[],
  selection: AppMenuModelSummarySelection | null
): string[] {
  const selectedLabels: string[] = [];
  const seenLabels = new Set<string>();
  for (const group of groups) {
    for (const item of group.items ?? []) {
      collectSelectedItemLabels(item, selectedLabels, seenLabels, selection);
    }
  }
  return selectedLabels;
}

function collectSelectedItemLabels<TId extends string, TContext>(
  item: AppMenuItem<TId, TContext>,
  selectedLabels: string[],
  seenLabels: Set<string>,
  selection: AppMenuModelSummarySelection | null
): void {
  const kind = item.kind ?? 'action';
  if (kind !== 'divider' && kind !== 'section' && isActiveItem(item, selection)) {
    const label = `${appMenuResolveLiveValue(item.label) ?? ''}`.trim();
    const key = label.toLowerCase();
    if (label && !seenLabels.has(key)) {
      selectedLabels.push(label);
      seenLabels.add(key);
    }
  }
  for (const child of item.items ?? []) {
    collectSelectedItemLabels(child, selectedLabels, seenLabels, selection);
  }
  for (const group of appMenuModelGroups(item.model, item.groups ?? [])) {
    for (const child of group.items ?? []) {
      collectSelectedItemLabels(child, selectedLabels, seenLabels, selection);
    }
  }
}

function isActiveItem<TId extends string, TContext>(
  item: AppMenuItem<TId, TContext>,
  selection: AppMenuModelSummarySelection | null
): boolean {
  return appMenuResolveLiveValue(item.active) === true
    || appMenuResolveLiveValue(item.checked) === true
    || isSelectedByValue(item, selection);
}

function isSelectedByValue<TId extends string, TContext>(
  item: AppMenuItem<TId, TContext>,
  selection: AppMenuModelSummarySelection | null
): boolean {
  if (!selection?.active) {
    return false;
  }
  const itemValue = item.value !== undefined ? item.value : item.id;
  const selectedValue = selection.value;
  if (Array.isArray(selectedValue)) {
    return selectedValue.some(value => appMenuValuesEqual(value, itemValue, selection.valueKey));
  }
  return appMenuValuesEqual(selectedValue, itemValue, selection.valueKey);
}

function appMenuValuesEqual(first: unknown, second: unknown, valueKey: AppMenuValueKey | null | undefined): boolean {
  if (!valueKey) {
    return Object.is(first, second);
  }
  return Object.is(appMenuValueIdentity(first, valueKey), appMenuValueIdentity(second, valueKey));
}

function appMenuValueIdentity(value: unknown, valueKey: AppMenuValueKey): unknown {
  if (typeof valueKey === 'function') {
    return valueKey(value);
  }
  if (value && typeof value === 'object' && valueKey in value) {
    return (value as Record<string, unknown>)[valueKey];
  }
  return value;
}

function appMenuSummaryCounter(
  selectedCount: number,
  maxLabels: number,
  mode: 'overflow' | 'count' | 'none'
): AppMenuCounterValue | null {
  if (selectedCount <= 0 || mode === 'none') {
    return null;
  }
  if (mode === 'count') {
    return selectedCount;
  }
  const overflow = selectedCount - maxLabels;
  return overflow > 0 ? `+${overflow}` : null;
}

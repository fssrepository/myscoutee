import type { Signal } from '@angular/core';
import type {
  ProgressIndicatorShape,
  ProgressIndicatorState,
  ProgressIndicatorTone
} from '../progress-indicator';
import type { RatingStarBarConfig } from '../rating-star-bar';

export type AppMenuKind =
  | 'fab'
  | 'inline'
  | 'select';

export type AppMenuItemKind =
  | 'action'
  | 'branch'
  | 'checkbox'
  | 'divider'
  | 'radio'
  | 'rating-bar'
  | 'section'
  | 'select-trigger'
  | 'toggle';
export type AppMenuPalette =
  | 'default'
  | 'neutral'
  | 'slate'
  | 'blue'
  | 'sky'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'mint'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'amber'
  | 'gold'
  | 'brown'
  | 'filter'
  | 'muted'
  | 'danger'
  | 'warning'
  | 'success';

export type AppMenuTriggerLayout = 'default' | 'field' | 'pill' | 'icon';
export type AppMenuTriggerAction = 'menu' | 'custom';
export type AppMenuItemSelectAction = 'select' | 'remove';
export type AppMenuItemSurface = 'plain' | 'tinted';
export type AppMenuLayout = 'row' | 'grid' | 'list' | 'tabs';
export type AppMenuItemLayout = 'default' | 'pill' | 'action' | 'big';
export type AppMenuPanelAlign = 'auto' | 'start' | 'end';
export type AppMenuPanelMode = 'auto' | 'anchored' | 'sheet' | 'dock' | 'fixed';
export type AppMenuSummaryCounter = 'overflow' | 'count' | 'none';
export type AppMenuValueKey = string | ((value: unknown) => unknown);

export type AppMenuLiveValue<T> = T | Signal<T> | (() => T);
export type AppMenuCounterValue = AppMenuLiveValue<number | string | null | undefined>;

export interface AppMenuCounter {
  value: AppMenuCounterValue;
  max?: number;
  ariaLabel?: string | null;
}

export type AppMenuValueMap<TId extends string = string> = Partial<Record<TId, AppMenuCounter | AppMenuCounterValue | null | undefined>>;

export interface AppMenuTrigger {
  id?: string;
  label?: AppMenuLiveValue<string | null | undefined>;
  icon?: AppMenuLiveValue<string | null | undefined>;
  openIcon?: AppMenuLiveValue<string | null | undefined>;
  closeIcon?: AppMenuLiveValue<string | null | undefined>;
  trailingIcon?: AppMenuLiveValue<string | null | undefined>;
  openTrailingIcon?: AppMenuLiveValue<string | null | undefined>;
  closeTrailingIcon?: AppMenuLiveValue<string | null | undefined>;
  ariaLabel?: AppMenuLiveValue<string | null | undefined>;
  palette?: AppMenuPalette;
  counter?: AppMenuCounter | AppMenuCounterValue | null;
  disabled?: AppMenuLiveValue<boolean | null | undefined>;
  hideLabel?: boolean;
  layout?: AppMenuTriggerLayout;
  action?: AppMenuTriggerAction;
  context?: unknown;
}

export interface AppMenuItemProgress {
  state: AppMenuLiveValue<ProgressIndicatorState | null | undefined>;
  tone?: AppMenuLiveValue<ProgressIndicatorTone | null | undefined>;
  shape?: ProgressIndicatorShape;
  perimeter?: AppMenuLiveValue<number | null | undefined>;
  durationMs?: AppMenuLiveValue<number | null | undefined>;
}

export interface AppMenuSegment {
  id: string;
  label?: AppMenuLiveValue<string | null | undefined>;
  description?: AppMenuLiveValue<string | null | undefined>;
  icon?: AppMenuLiveValue<string | null | undefined>;
  palette?: AppMenuPalette;
}

export interface AppMenuItem<TId extends string = string, TContext = unknown> {
  id: TId;
  label?: AppMenuLiveValue<string | null | undefined>;
  description?: AppMenuLiveValue<string | null | undefined>;
  detail?: AppMenuLiveValue<string | null | undefined>;
  icon?: AppMenuLiveValue<string | null | undefined>;
  openIcon?: AppMenuLiveValue<string | null | undefined>;
  closeIcon?: AppMenuLiveValue<string | null | undefined>;
  kind?: AppMenuItemKind;
  palette?: AppMenuPalette;
  surface?: AppMenuItemSurface;
  layout?: AppMenuItemLayout;
  counter?: AppMenuCounter | AppMenuCounterValue | null;
  disabled?: AppMenuLiveValue<boolean | null | undefined>;
  active?: AppMenuLiveValue<boolean | null | undefined>;
  checked?: AppMenuLiveValue<boolean | null | undefined>;
  removable?: AppMenuLiveValue<boolean | null | undefined>;
  removeIcon?: AppMenuLiveValue<string | null | undefined>;
  removeAriaLabel?: AppMenuLiveValue<string | null | undefined>;
  closeOnSelect?: boolean;
  value?: unknown;
  context?: TContext;
  ariaLabel?: AppMenuLiveValue<string | null | undefined>;
  href?: AppMenuLiveValue<string | null | undefined>;
  target?: AppMenuLiveValue<string | null | undefined>;
  rel?: AppMenuLiveValue<string | null | undefined>;
  ratingBarConfig?: RatingStarBarConfig | null;
  progress?: AppMenuItemProgress | null;
  segments?: readonly AppMenuSegment[];
  span?: AppMenuLiveValue<number | null | undefined>;
  items?: readonly AppMenuItem<TId, TContext>[];
  model?: AppMenuModel<TId, TContext> | null;
  groups?: readonly AppMenuGroup<TId, TContext>[];
  filterable?: boolean;
  headerActions?: readonly AppMenuItem<TId, TContext>[];
}

export interface AppMenuGroup<TId extends string = string, TContext = unknown> {
  id: string;
  label?: AppMenuLiveValue<string | null | undefined>;
  icon?: AppMenuLiveValue<string | null | undefined>;
  palette?: AppMenuPalette;
  items?: readonly AppMenuItem<TId, TContext>[];
  headerActions?: readonly AppMenuItem<TId, TContext>[];
  ariaLabel?: AppMenuLiveValue<string | null | undefined>;
}

export interface AppMenuSummary {
  emptyLabel?: AppMenuLiveValue<string | null | undefined>;
  maxLabels?: number;
  counter?: AppMenuSummaryCounter;
}

export interface AppMenuModel<TId extends string = string, TContext = unknown> {
  layout?: AppMenuLayout;
  summary?: AppMenuSummary | null;
  valueKey?: AppMenuValueKey | null;
  maxSelected?: number | null;
  groups?: readonly AppMenuGroup<TId, TContext>[];
  nodes?: readonly AppMenuGroup<TId, TContext>[];
}

export interface AppMenuItemSelectEvent<TId extends string = string, TContext = unknown> {
  id: TId;
  item: AppMenuItem<TId, TContext>;
  context?: TContext;
  sourceEvent: Event;
  value?: unknown;
  controlValue?: unknown;
  action?: AppMenuItemSelectAction;
}

export interface AppMenuAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface AppMenuDispatchConfig<TId extends string = string, TContext = unknown> {
  id: string;
  kind?: AppMenuKind;
  layout?: AppMenuLayout;
  title?: AppMenuLiveValue<string | null | undefined>;
  filterable?: boolean;
  items?: readonly AppMenuItem<TId, TContext>[];
  model?: AppMenuModel<TId, TContext> | null;
  groups?: readonly AppMenuGroup<TId, TContext>[];
  value?: AppMenuValueMap<TId> | null;
  trigger?: AppMenuTrigger | null;
  context?: TContext;
  openUp?: boolean;
  panelAlign?: AppMenuPanelAlign;
  panelMode?: AppMenuPanelMode;
  mobileBreakpointPx?: number;
  closeOnSelect?: boolean;
  triggerRect?: AppMenuAnchorRect | null;
  onClose?: (() => void) | null;
}

export interface AppMenuDispatchState<TId extends string = string, TContext = unknown>
  extends AppMenuDispatchConfig<TId, TContext> {
  kind: AppMenuKind;
  layout: AppMenuLayout;
  filterable: boolean;
  items: readonly AppMenuItem<TId, TContext>[];
  model: AppMenuModel<TId, TContext> | null;
  groups: readonly AppMenuGroup<TId, TContext>[];
  value: AppMenuValueMap<TId> | null;
  trigger: AppMenuTrigger | null;
  openUp: boolean;
  panelAlign: AppMenuPanelAlign;
  panelMode: AppMenuPanelMode;
  mobileBreakpointPx: number;
  closeOnSelect: boolean;
  triggerElement: HTMLElement | null;
  triggerRect: AppMenuAnchorRect | null;
  onClose: (() => void) | null;
}

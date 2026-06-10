import type { Signal } from '@angular/core';

export type AppMenuKind =
  | 'action'
  | 'context'
  | 'button-row'
  | 'dropdown-list'
  | 'filter'
  | 'quick-actions'
  | 'select'
  | 'shortcut-grid';

export type AppMenuItemKind =
  | 'action'
  | 'branch'
  | 'checkbox'
  | 'divider'
  | 'radio'
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
  | 'muted'
  | 'danger'
  | 'warning'
  | 'success';

export type AppMenuLiveValue<T> = T | Signal<T> | (() => T);
export type AppMenuCounterValue = AppMenuLiveValue<number | string | null | undefined>;

export interface AppMenuCounter {
  value: AppMenuCounterValue;
  max?: number;
  ariaLabel?: string | null;
}

export type AppMenuValueMap<TId extends string = string> = Partial<Record<TId, AppMenuCounter | AppMenuCounterValue | null | undefined>>;

export interface AppMenuTrigger {
  label?: AppMenuLiveValue<string | null | undefined>;
  icon?: AppMenuLiveValue<string | null | undefined>;
  openIcon?: AppMenuLiveValue<string | null | undefined>;
  closeIcon?: AppMenuLiveValue<string | null | undefined>;
  ariaLabel?: AppMenuLiveValue<string | null | undefined>;
  palette?: AppMenuPalette;
  counter?: AppMenuCounter | AppMenuCounterValue | null;
  disabled?: AppMenuLiveValue<boolean | null | undefined>;
  hideLabel?: boolean;
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
  kind?: AppMenuItemKind;
  palette?: AppMenuPalette;
  counter?: AppMenuCounter | AppMenuCounterValue | null;
  disabled?: AppMenuLiveValue<boolean | null | undefined>;
  active?: AppMenuLiveValue<boolean | null | undefined>;
  checked?: AppMenuLiveValue<boolean | null | undefined>;
  closeOnSelect?: boolean;
  context?: TContext;
  ariaLabel?: AppMenuLiveValue<string | null | undefined>;
  href?: AppMenuLiveValue<string | null | undefined>;
  target?: AppMenuLiveValue<string | null | undefined>;
  rel?: AppMenuLiveValue<string | null | undefined>;
  segments?: readonly AppMenuSegment[];
  span?: AppMenuLiveValue<number | null | undefined>;
  children?: readonly AppMenuItem<TId, TContext>[];
  headerActions?: readonly AppMenuItem<TId, TContext>[];
}

export interface AppMenuBranch<TId extends string = string, TContext = unknown> {
  id: string;
  label?: AppMenuLiveValue<string | null | undefined>;
  icon?: AppMenuLiveValue<string | null | undefined>;
  palette?: AppMenuPalette;
  children?: readonly AppMenuItem<TId, TContext>[];
  items?: readonly AppMenuItem<TId, TContext>[];
  ariaLabel?: AppMenuLiveValue<string | null | undefined>;
}

export interface AppMenuModel<TId extends string = string, TContext = unknown> {
  nodes: readonly AppMenuBranch<TId, TContext>[];
}

export type AppMenuGroup<TId extends string = string, TContext = unknown> = AppMenuBranch<TId, TContext>;

export interface AppMenuItemSelectEvent<TId extends string = string, TContext = unknown> {
  id: TId;
  item: AppMenuItem<TId, TContext>;
  context?: TContext;
  sourceEvent: Event;
}

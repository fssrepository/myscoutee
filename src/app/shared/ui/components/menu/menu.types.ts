import type { Signal } from '@angular/core';

export type AppMenuKind =
  | 'button-row'
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

export type AppMenuTriggerShape = 'default' | 'field' | 'pill' | 'icon';
export type AppMenuItemSurface = 'plain' | 'tinted';
export type AppMenuItemLayout = 'default' | 'summary';
export type AppMenuPanelAlign = 'auto' | 'start' | 'end';

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
  shape?: AppMenuTriggerShape;
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
  headerActions?: readonly AppMenuItem<TId, TContext>[];
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
  scope?: string;
  kind?: AppMenuKind;
  title?: AppMenuLiveValue<string | null | undefined>;
  items?: readonly AppMenuItem<TId, TContext>[];
  model?: AppMenuModel<TId, TContext> | null;
  groups?: readonly AppMenuGroup<TId, TContext>[];
  value?: AppMenuValueMap<TId> | null;
  trigger?: AppMenuTrigger | null;
  context?: TContext;
  openUp?: boolean;
  panelAlign?: AppMenuPanelAlign;
  mobileBreakpointPx?: number;
  closeOnSelect?: boolean;
  triggerRect?: AppMenuAnchorRect | null;
  onClose?: (() => void) | null;
}

export interface AppMenuDispatchState<TId extends string = string, TContext = unknown>
  extends AppMenuDispatchConfig<TId, TContext> {
  scope: string;
  kind: AppMenuKind;
  items: readonly AppMenuItem<TId, TContext>[];
  model: AppMenuModel<TId, TContext> | null;
  groups: readonly AppMenuGroup<TId, TContext>[];
  value: AppMenuValueMap<TId> | null;
  trigger: AppMenuTrigger | null;
  openUp: boolean;
  panelAlign: AppMenuPanelAlign;
  mobileBreakpointPx: number;
  closeOnSelect: boolean;
  triggerElement: HTMLElement | null;
  triggerRect: AppMenuAnchorRect | null;
  onClose: (() => void) | null;
}

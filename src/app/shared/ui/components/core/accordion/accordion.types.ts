import type {
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuKind,
  AppMenuModel,
  AppMenuPalette,
  AppMenuPanelAlign,
  AppMenuPanelMode,
  AppMenuTrigger
} from '../menu';

export interface UiAccordionActionMenu<TContext = unknown> {
  kind?: AppMenuKind;
  trigger?: AppMenuTrigger | null;
  items?: readonly AppMenuItem<string, TContext>[];
  model?: AppMenuModel<string, TContext> | null;
  panelAlign?: AppMenuPanelAlign;
  panelMode?: AppMenuPanelMode;
  mobileBreakpointPx?: number;
  closeOnSelect?: boolean;
}

export interface UiAccordionBadge {
  id?: string;
  label: string | number;
  icon?: string | null;
  palette?: AppMenuPalette | null;
  ariaLabel?: string | null;
  title?: string | null;
}

export interface UiAccordionItem<TId extends string = string, TContext = unknown, TMenuContext = unknown> {
  id: TId;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  badge?: string | number | null;
  badges?: readonly UiAccordionBadge[] | null;
  palette?: AppMenuPalette;
  disabled?: boolean;
  open?: boolean;
  selectable?: boolean;
  selected?: boolean;
  selectionAriaLabel?: string | null;
  actionMenu?: UiAccordionActionMenu<TMenuContext> | null;
  context?: TContext;
}

export interface UiAccordionModel<TId extends string = string, TContext = unknown, TMenuContext = unknown> {
  items: readonly UiAccordionItem<TId, TContext, TMenuContext>[];
  multi?: boolean;
  emptyTitle?: string | null;
  emptyDescription?: string | null;
}

export interface UiAccordionToggleEvent<TId extends string = string, TContext = unknown, TMenuContext = unknown> {
  id: TId;
  item: UiAccordionItem<TId, TContext, TMenuContext>;
  open: boolean;
  sourceEvent: Event;
}

export interface UiAccordionSelectionToggleEvent<TId extends string = string, TContext = unknown, TMenuContext = unknown> {
  id: TId;
  item: UiAccordionItem<TId, TContext, TMenuContext>;
  selected: boolean;
  sourceEvent: Event;
}

export interface UiAccordionActionMenuSelectEvent<TId extends string = string, TContext = unknown, TMenuContext = unknown> {
  id: TId;
  item: UiAccordionItem<TId, TContext, TMenuContext>;
  itemSelect: AppMenuItemSelectEvent<string, TMenuContext>;
  sourceEvent: Event;
}

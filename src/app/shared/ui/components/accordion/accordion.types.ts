import type { AppMenuPalette } from '../menu';

export interface UiAccordionItem<TId extends string = string, TContext = unknown> {
  id: TId;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  badge?: string | number | null;
  palette?: AppMenuPalette;
  disabled?: boolean;
  open?: boolean;
  context?: TContext;
}

export interface UiAccordionModel<TId extends string = string, TContext = unknown> {
  items: readonly UiAccordionItem<TId, TContext>[];
  multi?: boolean;
  emptyTitle?: string | null;
  emptyDescription?: string | null;
}

export interface UiAccordionToggleEvent<TId extends string = string, TContext = unknown> {
  id: TId;
  item: UiAccordionItem<TId, TContext>;
  open: boolean;
  sourceEvent: Event;
}

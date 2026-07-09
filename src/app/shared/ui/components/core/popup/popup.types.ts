import type {
  AppMenuCounter,
  AppMenuCounterValue,
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuGroup,
  AppMenuKind,
  AppMenuModel,
  AppMenuPanelAlign,
  AppMenuPanelMode,
  AppMenuPalette,
  AppMenuTrigger
} from '../menu';
import type {
  DateInputModel,
  DateInputValue
} from '../form/inputs/date-input/date-input.component';

export type PopupSize = 'small' | 'default' | 'wide';
export type PopupHeight = 'auto' | 'full';
export type PopupHeaderTone = 'default' | 'accent';
export type PopupHeaderLayout = 'default' | 'article';
export type PopupBodyLayout = 'default' | 'fill' | 'flush';
export type PopupControlAlign = 'start' | 'end';
export type PopupBackdropTone = 'default' | 'dim';

export interface PopupControlBase {
  id: string;
  align?: PopupControlAlign;
}

export interface PopupAction extends PopupControlBase {
  icon: string;
  label?: string | null;
  ariaLabel?: string | null;
  palette?: AppMenuPalette;
  counter?: AppMenuCounter | AppMenuCounterValue | null;
  active?: boolean;
  disabled?: boolean;
  compactOnMobile?: boolean;
}

export interface PopupMenuControl<TContext = unknown> extends PopupControlBase {
  kind: 'menu';
  menuKind?: AppMenuKind;
  title?: string | null;
  trigger?: AppMenuTrigger | null;
  items?: readonly AppMenuItem<string, TContext>[];
  groups?: readonly AppMenuGroup<string, TContext>[];
  model?: AppMenuModel<string, TContext> | null;
  panelAlign?: AppMenuPanelAlign;
  panelMode?: AppMenuPanelMode;
  mobileBreakpointPx?: number;
  closeOnSelect?: boolean;
}

export interface PopupDateInputControl<TContext = unknown> extends PopupControlBase {
  kind: 'date-input';
  model: DateInputModel;
  value: DateInputValue;
  context?: TContext;
}

export type PopupControl<TContext = unknown> =
  | PopupAction
  | PopupMenuControl<TContext>
  | PopupDateInputControl<TContext>;

export interface PopupModel<TContext = unknown> {
  headerLabel?: string | null;
  headerLabelIcon?: string | null;
  title?: string | null;
  subtitle?: string | null;
  secondarySubtitle?: string | null;
  ariaLabel?: string | null;
  closeAriaLabel?: string | null;
  translateHeaderLabel?: boolean;
  translateTitle?: boolean;
  translateSubtitle?: boolean;
  translateSecondarySubtitle?: boolean;
  closeOnBackdrop?: boolean;
  showHeader?: boolean;
  showClose?: boolean;
  size?: PopupSize;
  height?: PopupHeight;
  headerLayout?: PopupHeaderLayout;
  headerTone?: PopupHeaderTone;
  bodyLayout?: PopupBodyLayout;
  backdropTone?: PopupBackdropTone;
  showToolbar?: boolean;
  headerControls?: readonly PopupControl<TContext>[];
  toolbarControls?: readonly PopupControl<TContext>[];
  headerActions?: readonly PopupAction[];
  onClose?: ((event: Event) => void) | null;
  onAction?: ((event: PopupActionEvent) => void) | null;
  onMenuSelect?: ((event: PopupMenuSelectEvent<TContext>) => void) | null;
  onDateInputChange?: ((event: PopupDateInputChangeEvent<TContext>) => void) | null;
}

export interface PopupMenuSelectEvent<TContext = unknown> {
  control: PopupMenuControl<TContext>;
  itemSelect: AppMenuItemSelectEvent<string, TContext>;
}

export interface PopupActionEvent {
  action: PopupAction;
  sourceEvent: Event;
}

export interface PopupDateInputChangeEvent<TContext = unknown> {
  control: PopupDateInputControl<TContext>;
  value: DateInputValue;
}

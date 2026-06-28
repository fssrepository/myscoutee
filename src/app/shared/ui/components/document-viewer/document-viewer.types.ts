import type { AppMenuItemProgress, AppMenuPalette } from '../core/menu';

export type DocumentViewerShell = 'page' | 'popup';
export type DocumentViewerHeaderPalette = 'amber' | 'blue' | 'green' | 'rose' | 'violet' | 'slate' | 'teal';
export type DocumentViewerSectionTone = 'default' | 'mandatory' | 'optional';
export type DocumentViewerActionVisibility = boolean | 'dirty';
export type DocumentViewerStatusTone = 'default' | 'error';

export interface DocumentViewerSection {
  id: string;
  icon?: string | null;
  title: string;
  blurb?: string | null;
  contentHtml?: string | null;
  points?: readonly string[] | null;
  details?: readonly string[] | null;
  tone?: DocumentViewerSectionTone;
  selected?: boolean;
  toggleable?: boolean;
}

export interface DocumentViewerEmptyState {
  icon?: string | null;
  title: string;
  description?: string | null;
}

export interface DocumentViewerAction {
  id: string;
  label: string;
  icon?: string | null;
  palette?: AppMenuPalette;
  disabled?: boolean;
  visible?: DocumentViewerActionVisibility;
  progress?: AppMenuItemProgress | null;
}

export interface DocumentViewerConfig {
  shell?: DocumentViewerShell;
  ariaLabel?: string | null;
  open?: boolean;
  onClose?: (() => void) | null;
  closeOnBackdrop?: boolean;
  closeAriaLabel?: string | null;
  title: string;
  description?: string | null;
  versionLabel?: string | null;
  headerPalette?: DocumentViewerHeaderPalette | null;
  showBrand?: boolean;
  loading?: boolean;
  loadingLabel?: string | null;
  emptyState?: DocumentViewerEmptyState | null;
  sections: readonly DocumentViewerSection[];
  selectedSectionIds?: readonly string[] | null;
  actions?: readonly DocumentViewerAction[];
  statusMessage?: string | null;
  statusTone?: DocumentViewerStatusTone;
}

export interface DocumentViewerRouteData {
  documentKind?: string | null;
  title?: string | null;
  description?: string | null;
  ariaLabel?: string | null;
  loadingLabel?: string | null;
  emptyIcon?: string | null;
  emptyTitle?: string | null;
  emptyDescription?: string | null;
  headerPalette?: DocumentViewerHeaderPalette | null;
}

export interface DocumentViewerActionEvent {
  id: string;
  action: DocumentViewerAction;
  selectedSectionIds: readonly string[];
  sourceEvent: Event;
}

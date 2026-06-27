export interface PopupHeaderThumb {
  id: string;
  label?: string | null;
  initials: string;
  imageUrl?: string | null;
}

export type PopupHeaderControlVisual =
  | { kind: 'icon'; icon: string }
  | { kind: 'thumbStack'; thumbs: PopupHeaderThumb[]; maxVisible?: number };

export interface PopupHeaderControlBadge {
  value: number;
  tone?: 'neutral' | 'warning' | 'danger';
}

export interface PopupHeaderLookup {
  type: string;
  id: string;
}

export interface PopupHeaderControlGroup {
  id: string;
  label?: string | null;
  controls: PopupHeaderControl[];
}

export interface PopupHeaderControlMenu {
  title?: string | null;
  groups: PopupHeaderControlGroup[];
}

export interface PopupHeaderControl {
  id: string;
  label: string;
  summary?: string | null;
  visual?: PopupHeaderControlVisual | null;
  badge?: PopupHeaderControlBadge | null;
  lookup?: PopupHeaderLookup | null;
  menu?: PopupHeaderControlMenu | null;
}

export interface PopupHeaderContext {
  revision?: string | number;
  title?: string | null;
  subtitle?: string | null;
  controls?: PopupHeaderControl[];
}

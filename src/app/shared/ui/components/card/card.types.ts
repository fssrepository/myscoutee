export type CardPresentation = 'list' | 'fullscreen';
export type CardRenderState = 'default' | 'active' | 'leaving';
export type CardBadgeLayout = 'floating' | 'between' | 'pair-overlap';
export type InfoCardSurfaceTone = 'default' | 'draft' | 'full';
export type InfoCardOverlayVariant = 'avatar' | 'badge' | 'toggle';
export type InfoCardOverlayLayout = 'default' | 'avatar-metric' | 'badge-with-leading-accessory';
export type InfoCardOverlayTone =
  | 'default'
  | 'full'
  | 'inactive'
  | 'selected'
  | 'cool'
  | 'cool-mid'
  | 'neutral'
  | 'warm-mid'
  | 'warm'
  | 'public'
  | 'friends'
  | 'invitation'
  | 'woman'
  | 'man'
  | 'tone-1'
  | 'tone-2'
  | 'tone-3'
  | 'tone-4'
  | 'tone-5'
  | 'tone-6'
  | 'tone-7'
  | 'tone-8';
export type InfoCardOverlayAccessoryTone =
  | 'default'
  | 'positive'
  | 'negative'
  | 'woman'
  | 'man'
  | 'tone-1'
  | 'tone-2'
  | 'tone-3'
  | 'tone-4'
  | 'tone-5'
  | 'tone-6'
  | 'tone-7'
  | 'tone-8';
export type InfoCardMenuActionTone = 'default' | 'accent' | 'warning' | 'destructive';
export type InfoCardDetailStyle = 'default' | 'mono';

export interface CardBadgeConfig {
  label: string;
  ariaLabel?: string | null;
  active?: boolean;
  pending?: boolean;
  disabled?: boolean;
  blink?: boolean;
  interactive?: boolean;
  layout?: CardBadgeLayout;
}

export interface CardImageSlide {
  imageUrl: string;
  primaryLine?: string | null;
  secondaryLine?: string | null;
  placeholderLabel?: string | null;
}

export interface PairCardSlot {
  key: string;
  label: string;
  tone?: 'woman' | 'man' | null;
  slides: readonly CardImageSlide[];
  collapsed?: boolean;
}

export interface SingleCardData {
  rowId: string;
  groupLabel?: string | null;
  slides: readonly CardImageSlide[];
  stackClasses?: readonly string[];
  badge?: CardBadgeConfig | null;
  presentation?: CardPresentation;
  state?: CardRenderState;
  initialActiveIndex?: number;
}

export interface PairCardSplitConfig {
  enabled?: boolean;
  initialPercent?: number;
}

export interface PairCardData {
  rowId: string;
  groupLabel?: string | null;
  slots: readonly PairCardSlot[];
  stackClasses?: readonly string[];
  badge?: CardBadgeConfig | null;
  presentation?: CardPresentation;
  state?: CardRenderState;
  initialActiveIndexByKey?: Readonly<Record<string, number>>;
  split?: PairCardSplitConfig | null;
}

export interface InfoCardLeadingIconConfig {
  icon: string;
  tone?: Extract<InfoCardOverlayTone, 'default' | 'public' | 'friends' | 'invitation'> | null;
}

export interface InfoCardOverlayAccessory {
  label?: string | null;
  icon?: string | null;
  tone?: InfoCardOverlayAccessoryTone | null;
}

export interface InfoCardOverlayAction {
  variant?: InfoCardOverlayVariant;
  layout?: InfoCardOverlayLayout | null;
  tone?: InfoCardOverlayTone | null;
  label?: string | null;
  icon?: string | null;
  leadingAccessory?: InfoCardOverlayAccessory | null;
  detailLabel?: string | null;
  detailIcon?: string | null;
  ariaLabel?: string | null;
  interactive?: boolean;
  disabled?: boolean;
  pendingCount?: number;
  selected?: boolean;
  selectedLabel?: string | null;
  selectedIcon?: string | null;
}

export interface InfoCardMenuAction {
  id: string;
  label: string;
  icon: string;
  tone?: InfoCardMenuActionTone;
}

export interface InfoCardFooterChip {
  label: string;
  toneClass?: string | null;
}

export interface InfoCardData {
  rowId: string;
  groupLabel?: string | null;
  title: string;
  imageUrl?: string | null;
  metaRows?: readonly string[];
  metaRowsLimit?: number | null;
  description?: string | null;
  descriptionLines?: number | null;
  detailRows?: readonly string[];
  detailStyle?: InfoCardDetailStyle | null;
  footerChips?: readonly InfoCardFooterChip[];
  surfaceTone?: InfoCardSurfaceTone | null;
  leadingIcon?: InfoCardLeadingIconConfig | null;
  mediaStart?: InfoCardOverlayAction | null;
  mediaEnd?: InfoCardOverlayAction | null;
  menuActions?: readonly InfoCardMenuAction[];
  clickable?: boolean;
}

export interface InfoCardClickEvent {
  rowId: string;
  card: InfoCardData;
}

export interface InfoCardMenuActionEvent {
  rowId: string;
  actionId: string;
  action: InfoCardMenuAction;
  card: InfoCardData;
}

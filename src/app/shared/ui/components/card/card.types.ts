export type CardPresentation = 'list' | 'fullscreen';
export type CardRenderState = 'default' | 'active' | 'leaving';
export type CardBadgeLayout = 'floating' | 'between' | 'pair-overlap';

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

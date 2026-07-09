import type { AppMenuPalette } from '../../menu/menu.types';
import type { SmartListItemKey } from '../smart-list-item-key';
import type { SmartListLocalSortKey } from '../smart-list-local-sort';

export type CardPresentation = 'list' | 'fullscreen';
export type CardRenderState = 'default' | 'active' | 'leaving';
export type CardBadgeLayout = 'floating' | 'between' | 'pair-overlap';
export type InfoCardSurfaceTone =
  | 'default'
  | 'draft'
  | 'stage'
  | 'stage-runtime'
  | 'full'
  | 'pending'
  | 'published'
  | 'series'
  | 'waitlist'
  | 'review'
  | 'blocked'
  | 'deleted'
  | 'inactive';
export type InfoCardOverlayVariant = 'avatar' | 'badge' | 'toggle';
export type InfoCardOverlayLayout = 'default' | 'avatar-metric' | 'badge-with-leading-accessory';
export type InfoCardOverlayShape = 'default' | 'circle';
export type InfoCardOverlayTone =
  | 'default'
  | 'stage'
  | 'stage-active'
  | 'stage-scheduled'
  | 'stage-blocked'
  | 'stage-start'
  | 'stage-review'
  | 'stage-finalized'
  | 'stage-suspended'
  | 'full'
  | 'inactive'
  | 'selected'
  | 'review'
  | 'blocked'
  | 'deleted'
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
export type CardMenuActionTone = 'default' | 'accent' | 'warning' | 'destructive' | 'review';
export type InfoCardDetailStyle = 'default' | 'mono';
export type InfoCardMediaMode = 'image' | 'title';
export type InfoCardMediaTone = 'default' | 'neutral';

export interface CardBadgeConfig {
  label: string;
  ariaLabel?: string | null;
  className?: string | null;
  active?: boolean;
  pending?: boolean;
  disabled?: boolean;
  blink?: boolean;
  interactive?: boolean;
  menuRequest?: boolean;
  layout?: CardBadgeLayout;
}

export interface CardContextBadgeConfig {
  label: string;
  ariaLabel?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  counterLabel?: string | null;
  profileView?: CardProfileViewData | null;
}

export interface CardImageSlide {
  imageUrl: string;
  primaryLine?: string | null;
  secondaryLine?: string | null;
  placeholderLabel?: string | null;
}

export interface CardProfileViewData {
  userId: string;
  label?: string | null;
}

export interface PairCardSlot {
  key: string;
  label: string;
  tone?: 'woman' | 'man' | null;
  slides: readonly CardImageSlide[];
  statusBadgeLabel?: string | null;
  collapsed?: boolean;
  profileView?: CardProfileViewData | null;
}

export interface SingleCardData {
  rowId: string;
  groupLabel?: string | null;
  slides: readonly CardImageSlide[];
  statusBadgeLabel?: string | null;
  profileView?: CardProfileViewData | null;
  stackClasses?: readonly string[];
  badge?: CardBadgeConfig | null;
  contextBadge?: CardContextBadgeConfig | null;
  presentation?: CardPresentation;
  state?: CardRenderState;
  initialActiveIndex?: number;
}

export interface PairCardSplitConfig {
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
  tone?: Extract<InfoCardOverlayTone, 'default' | 'stage' | 'public' | 'friends' | 'invitation'> | 'pending' | null;
}

export interface InfoCardOverlayAccessory {
  label?: string | null;
  icon?: string | null;
  tone?: InfoCardOverlayAccessoryTone | null;
}

export interface InfoCardOverlayAction {
  actionId?: CardMenuActionId | null;
  actionTone?: CardMenuActionTone | null;
  variant?: InfoCardOverlayVariant;
  layout?: InfoCardOverlayLayout | null;
  shape?: InfoCardOverlayShape | null;
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
  progressRing?: boolean;
}

export type CardMenuActionId = string;

export interface CardMenuActionConfig {
  label: string;
  icon: string;
  tone?: CardMenuActionTone;
}

export interface CardMenuAction {
  id: CardMenuActionId;
  label: string;
  icon: string;
  tone?: CardMenuActionTone;
}

export const CARD_MENU_ACTIONS: Readonly<Record<CardMenuActionId, CardMenuActionConfig>> = {
  accept: { label: 'accept', icon: 'done', tone: 'accent' },
  addOrganizerNote: { label: 'add.organizer.note', icon: 'edit_note' },
  askOrganizer: { label: 'ask.organizer', icon: 'support_agent' },
  assetAvailability: { label: 'asset.availability', icon: 'event_available', tone: 'accent' },
  bookEvent: { label: 'book.event', icon: 'person_add', tone: 'accent' },
  borrowAsset: { label: 'borrow', icon: 'volunteer_activism', tone: 'accent' },
  capacity: { label: 'capacity', icon: 'groups' },
  contactOwner: { label: 'contact.owner', icon: 'support_agent' },
  continueBooking: { label: 'Foglalás folytatása', icon: 'shopping_basket', tone: 'accent' },
  continueBookingPending: { label: 'Foglalás folytatása', icon: 'shopping_basket', tone: 'warning' },
  delete: { label: 'delete', icon: 'delete', tone: 'destructive' },
  deleteEvent: { label: 'delete.event', icon: 'delete', tone: 'destructive' },
  edit: { label: 'edit', icon: 'edit', tone: 'accent' },
  editAsset: { label: 'edit.asset', icon: 'edit' },
  editEvent: { label: 'edit.event', icon: 'edit' },
  editOrganizerNote: { label: 'edit.organizer.note', icon: 'edit_note' },
  externalInfo: { label: 'External Info', icon: 'open_in_new', tone: 'accent' },
  feature: { label: 'feature', icon: 'star', tone: 'accent' },
  joinResource: { label: 'join.resource', icon: 'login', tone: 'accent' },
  joinWaitlist: { label: 'join.waiting.list', icon: 'hourglass_empty', tone: 'accent' },
  leaveEvent: { label: 'leave.event', icon: 'exit_to_app', tone: 'warning' },
  leaveResource: { label: 'leave.resource', icon: 'logout' },
  makeManager: { label: 'asset.requests.promote.to.manager', icon: 'manage_accounts', tone: 'accent' },
  manage: { label: 'manage', icon: 'settings', tone: 'accent' },
  manageEvent: { label: 'manage.event', icon: 'settings' },
  markSolved: { label: 'Mark solved', icon: 'check_circle', tone: 'accent' },
  markUnresolved: { label: 'Mark unresolved', icon: 'restart_alt', tone: 'warning' },
  notifyParticipants: { label: 'notify.participants', icon: 'support_agent' },
  paymentSummary: { label: 'Fizetési összegzés', icon: 'receipt_long' },
  publish: { label: 'publish', icon: 'campaign', tone: 'accent' },
  rejectInvitation: { label: 'reject.invitation', icon: 'block', tone: 'destructive' },
  remove: { label: 'reject', icon: 'delete', tone: 'destructive' },
  removeAssignment: { label: 'remove', icon: 'link_off', tone: 'destructive' },
  removeFeedback: { label: 'remove', icon: 'remove_circle', tone: 'destructive' },
  reportManager: { label: 'report.manager', icon: 'flag', tone: 'warning' },
  reportOrganizer: { label: 'report.organizer', icon: 'flag', tone: 'warning' },
  reportOwner: { label: 'report.owner', icon: 'flag', tone: 'warning' },
  requestJoin: { label: 'request.join', icon: 'person_add', tone: 'accent' },
  restore: { label: 'restore', icon: 'restore_from_trash' },
  restoreFeedback: { label: 'restore.feedback', icon: 'restore' },
  route: { label: 'route', icon: 'route' },
  share: { label: 'share', icon: 'ios_share' },
  shareAsset: { label: 'share.asset', icon: 'ios_share' },
  shareEvent: { label: 'share.event', icon: 'ios_share' },
  startFeedback: { label: 'start.feedback', icon: 'play_arrow' },
  supportBlock: { label: 'activities.support.case.action.block', icon: 'block', tone: 'destructive' },
  supportPick: { label: 'activities.support.case.action.pick', icon: 'person_add', tone: 'accent' },
  supportReopen: { label: 'activities.support.case.action.reopen', icon: 'restart_alt' },
  supportSolve: { label: 'activities.support.case.action.solve', icon: 'check_circle', tone: 'accent' },
  supportUnpick: { label: 'activities.support.case.action.unpick', icon: 'person_remove' },
  takeOver: { label: 'take.over', icon: 'verified_user', tone: 'review' },
  unfeature: { label: 'unfeature', icon: 'star_outline', tone: 'warning' },
  unpublish: { label: 'unpublish', icon: 'visibility_off', tone: 'warning' },
  view: { label: 'view.event', icon: 'visibility' },
  viewArticle: { label: 'Read more', icon: 'auto_stories', tone: 'accent' },
  viewAsset: { label: 'view.asset', icon: 'edit_square' },
  viewInvitation: { label: 'view.invitation', icon: 'visibility' }
};

export interface InfoCardFooterChip {
  label: string;
  toneClass?: string | null;
  icon?: string | null;
  actionId?: CardMenuActionId | null;
  ariaLabel?: string | null;
}

export interface DisplayData<TEagerDetail = unknown> {
  id: string;
  smartListKey?: SmartListItemKey | null;
  status?: string | null;
  dateIso?: string | null;
  distanceMetersExact?: number | null;
  badgeCount?: number | null;
  sortScore?: number | null;
  localSortKey?: SmartListLocalSortKey | null;
  menuActions?: readonly CardMenuActionId[];
  ownerId?: string | null;
  ownerUserId?: string | null;
  eagerDetail?: TEagerDetail | null;
}

export type SingleRowAvatarShape = 'circle' | 'rounded' | 'square';
export type SingleRowSurfaceTone = 'default' | 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger' | 'muted';
export type SingleRowBadgeTone = SingleRowSurfaceTone | 'inverse';
export type SingleRowBadgePosition = 'inline' | 'side' | 'top-right';

export interface SingleRowBadge {
  label: string;
  icon?: string | null;
  ariaLabel?: string | null;
  title?: string | null;
  tone?: SingleRowBadgeTone | null;
  position?: SingleRowBadgePosition | null;
  className?: string | null;
}

export interface InfoCardData<TEagerDetail = unknown> extends DisplayData<TEagerDetail> {
  status?: string | null;
  groupLabel?: string | null;
  title: string;
  mediaMode?: InfoCardMediaMode | null;
  mediaTone?: InfoCardMediaTone | null;
  mediaTitle?: string | null;
  mediaSubtitle?: string | null;
  mediaIcon?: string | null;
  imageUrl?: string | null;
  placeholderLabel?: string | null;
  metaRows?: readonly string[];
  metaRowsLimit?: number | null;
  description?: string | null;
  descriptionLines?: number | null;
  detailRows?: readonly string[];
  detailStyle?: InfoCardDetailStyle | null;
  i18nIgnoreContent?: boolean;
  footerChips?: readonly InfoCardFooterChip[];
  surfaceTone?: InfoCardSurfaceTone | null;
  accentHue?: number | null;
  leadingIcon?: InfoCardLeadingIconConfig | null;
  mediaStart?: InfoCardOverlayAction | null;
  mediaEnd?: InfoCardOverlayAction | null;
  hasMenuOptions?: boolean;
  menuActions?: readonly CardMenuActionId[];
  menuTitle?: string | null;
  menuBadgeCount?: number | null;
  clickable?: boolean;
  state?: CardRenderState;
}

export type ImageCardMode = 'individual' | 'pair' | string;
export type ImageCardDirection = 'given' | 'received' | 'mutual' | 'met' | string;
export type ImageCardGender = 'woman' | 'man';
export type ImageCardSocialContext = 'separated-friends' | 'friends-in-common';
export type ImageCardLayout = 'stacked' | 'overlay';
export type ImageCardMediaActionPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ImageCardMediaActionTone = 'default' | 'accent' | 'info' | 'success' | 'warning' | 'destructive';

export interface ImageCardPerson {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: ImageCardGender;
  profile?: unknown | null;
}

export interface ImageCardStatusChip {
  icon?: string | null;
  label?: string | null;
  ariaLabel?: string | null;
  title?: string | null;
  tone?: ImageCardMediaActionTone | null;
  palette?: AppMenuPalette | null;
  className?: string | null;
}

export interface ImageCardMediaAction {
  id: string;
  icon: string;
  selectedIcon?: string | null;
  ariaLabel?: string | null;
  title?: string | null;
  tone?: ImageCardMediaActionTone | null;
  position?: ImageCardMediaActionPosition | null;
  selected?: boolean;
  disabled?: boolean;
  className?: string | null;
}

export interface ImageCardData<TEagerDetail = unknown> extends DisplayData<TEagerDetail> {
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  imageUrl?: string | null;
  placeholderIcon?: string | null;
  placeholderLabel?: string | null;
  layout?: ImageCardLayout | null;
  toneClass?: string | null;
  statusChip?: ImageCardStatusChip | null;
  mediaActions?: readonly ImageCardMediaAction[];
  menuTitle?: string | null;
  menuBadgeCount?: number | null;
  mode?: ImageCardMode | null;
  direction?: ImageCardDirection | null;
  displayedDirection?: ImageCardDirection | null;
  eventName?: string | null;
  happenedOnLabel?: string | null;
  primaryUser?: ImageCardPerson | null;
  pairUsers?: readonly ImageCardPerson[];
  availableUsers?: readonly ImageCardPerson[];
  singleImageUrls?: readonly string[];
  pairSlots?: readonly PairCardSlot[];
  stackClasses?: readonly string[];
  badge?: CardBadgeConfig | null;
  contextBadge?: CardContextBadgeConfig | null;
  presentation?: CardPresentation;
  state?: CardRenderState;
  userId?: string | null;
  secondaryUserId?: string | null;
  socialContext?: ImageCardSocialContext | null;
  bridgeUserId?: string | null;
  bridgeCount?: number | null;
  scoreGiven?: number | null;
  scoreReceived?: number | null;
}

export interface ImageCardMediaActionEvent<TCard extends ImageCardData = ImageCardData> {
  id: string;
  action: ImageCardMediaAction;
  card: TCard;
  sourceEvent: Event;
}

export interface SingleRowData<TEagerDetail = unknown> extends DisplayData<TEagerDetail> {
  title: string;
  groupLabel?: string | null;
  subtitle?: string | null;
  detail?: string | null;
  avatarInitials?: string | null;
  avatarToneClass?: string | null;
  avatarUrl?: string | null;
  avatarShape?: SingleRowAvatarShape | null;
  avatarAriaLabel?: string | null;
  icon?: string | null;
  toneClass?: string | null;
  surfaceTone?: SingleRowSurfaceTone | null;
  sideLabel?: string | null;
  sideLabelIcon?: string | null;
  sideLabelTone?: SingleRowBadgeTone | null;
  metaRows?: readonly string[];
  badges?: readonly SingleRowBadge[];
  clickable?: boolean;
  unread?: number | null;
  memberCount?: number | null;
}

export interface CardClickEvent<TCard extends DisplayData = DisplayData> {
  id: string;
  card: TCard;
}

export interface CardMenuActionEvent<TCard extends DisplayData = DisplayData> {
  id: string;
  actionId: CardMenuActionId;
  action: CardMenuAction;
  card: TCard;
}

export interface CardMenuTriggerRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface CardMenuRequestEvent<TCard = DisplayData> {
  id: string;
  card: TCard;
  actions?: readonly CardMenuActionId[];
  badge?: CardBadgeConfig | null;
  title?: string | null;
  triggerRect: CardMenuTriggerRect | null;
  openUp: boolean;
  closeRequested?: boolean;
  closeTrigger: () => void;
}

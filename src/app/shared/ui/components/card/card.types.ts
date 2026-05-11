export type CardPresentation = 'list' | 'fullscreen';
export type CardRenderState = 'default' | 'active' | 'leaving';
export type CardBadgeLayout = 'floating' | 'between' | 'pair-overlap';
export type InfoCardSurfaceTone =
  | 'default'
  | 'draft'
  | 'full'
  | 'pending'
  | 'series'
  | 'waitlist'
  | 'review'
  | 'blocked'
  | 'deleted'
  | 'inactive';
export type InfoCardOverlayVariant = 'avatar' | 'badge' | 'toggle';
export type InfoCardOverlayLayout = 'default' | 'avatar-metric' | 'badge-with-leading-accessory';
export type InfoCardOverlayTone =
  | 'default'
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
export type InfoCardMenuActionTone = 'default' | 'accent' | 'warning' | 'destructive' | 'review';
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
  user?: unknown | null;
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
  tone?: Extract<InfoCardOverlayTone, 'default' | 'public' | 'friends' | 'invitation'> | 'pending' | null;
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
  progressRing?: boolean;
}

export type InfoCardMenuAction = string;

export interface InfoCardMenuActionConfig {
  label: string;
  icon: string;
  tone?: InfoCardMenuActionTone;
}

export interface InfoCardResolvedMenuAction extends InfoCardMenuActionConfig {
  id: string;
}

export const INFO_CARD_AVAILABLE_ACTIONS: Readonly<Record<string, InfoCardMenuActionConfig>> = {
  accept: { label: 'accept', icon: 'done', tone: 'accent' },
  addOrganizerNote: { label: 'add.organizer.note', icon: 'edit_note' },
  askOrganizer: { label: 'ask.organizer', icon: 'support_agent' },
  bookEvent: { label: 'book.event', icon: 'person_add', tone: 'accent' },
  borrowAsset: { label: 'borrow', icon: 'volunteer_activism', tone: 'accent' },
  capacity: { label: 'capacity', icon: 'groups' },
  contactOrganizer: { label: 'contact.organizer', icon: 'support_agent' },
  contactOwner: { label: 'contact.owner', icon: 'support_agent' },
  delete: { label: 'delete', icon: 'delete', tone: 'destructive' },
  deleteEvent: { label: 'delete.event', icon: 'delete', tone: 'destructive' },
  edit: { label: 'edit', icon: 'edit', tone: 'accent' },
  editAsset: { label: 'edit.asset', icon: 'edit' },
  editEvent: { label: 'edit.event', icon: 'edit' },
  editOrganizerNote: { label: 'edit.organizer.note', icon: 'edit_note' },
  feature: { label: 'feature', icon: 'star', tone: 'accent' },
  joinResource: { label: 'join.resource', icon: 'login', tone: 'accent' },
  joinWaitlist: { label: 'join.waiting.list', icon: 'hourglass_empty', tone: 'accent' },
  leaveEvent: { label: 'leave.event', icon: 'exit_to_app', tone: 'warning' },
  leaveResource: { label: 'leave.resource', icon: 'logout' },
  notifyParticipants: { label: 'notify.participants', icon: 'support_agent' },
  publish: { label: 'publish', icon: 'campaign', tone: 'accent' },
  rejectInvitation: { label: 'reject.invitation', icon: 'block', tone: 'destructive' },
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
  takeOver: { label: 'take.over', icon: 'verified_user', tone: 'review' },
  unfeature: { label: 'unfeature', icon: 'star_outline', tone: 'warning' },
  unpublish: { label: 'unpublish', icon: 'visibility_off', tone: 'warning' },
  view: { label: 'view.event', icon: 'visibility' },
  viewArticle: { label: 'view', icon: 'visibility' },
  viewAsset: { label: 'view.asset', icon: 'edit_square' },
  viewInvitation: { label: 'view.invitation', icon: 'visibility' }
};

export interface InfoCardFooterChip {
  label: string;
  toneClass?: string | null;
}

export interface DisplayData<TDetailRecord = unknown> {
  rowId: string;
  ownerId?: string | null;
  detailRecord?: TDetailRecord | null;
}

export interface InfoCardData<TDetailRecord = unknown> extends DisplayData<TDetailRecord> {
  status?: string | null;
  groupLabel?: string | null;
  title: string;
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
  leadingIcon?: InfoCardLeadingIconConfig | null;
  mediaStart?: InfoCardOverlayAction | null;
  mediaEnd?: InfoCardOverlayAction | null;
  menuActions?: readonly InfoCardMenuAction[];
  menuTitle?: string | null;
  menuBadgeCount?: number | null;
  clickable?: boolean;
  state?: CardRenderState;
}

export interface InfoCardClickEvent {
  rowId: string;
  card: InfoCardData;
}

export interface InfoCardMenuActionEvent {
  rowId: string;
  actionId: string;
  action: InfoCardResolvedMenuAction;
  card: InfoCardData;
}

export interface InfoCardMenuTriggerRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface InfoCardMenuRequestEvent {
  rowId: string;
  card: InfoCardData;
  actions: readonly InfoCardMenuAction[];
  triggerRect: InfoCardMenuTriggerRect | null;
  openUp: boolean;
  closeTrigger: () => void;
}

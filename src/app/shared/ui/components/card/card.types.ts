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
  accept: { label: 'Accept', icon: 'done', tone: 'accent' },
  addOrganizerNote: { label: 'Add Organizer Note', icon: 'edit_note' },
  askOrganizer: { label: 'Ask Organizer', icon: 'support_agent' },
  bookEvent: { label: 'Book Event', icon: 'person_add', tone: 'accent' },
  borrowAsset: { label: 'Borrow', icon: 'volunteer_activism', tone: 'accent' },
  capacity: { label: 'Capacity', icon: 'groups' },
  contactOrganizer: { label: 'Contact Organizer', icon: 'support_agent' },
  contactOwner: { label: 'Contact Owner', icon: 'support_agent' },
  delete: { label: 'Delete', icon: 'delete', tone: 'destructive' },
  deleteEvent: { label: 'Delete Event', icon: 'delete', tone: 'destructive' },
  edit: { label: 'Edit', icon: 'edit', tone: 'accent' },
  editAsset: { label: 'Edit Asset', icon: 'edit' },
  editEvent: { label: 'Edit Event', icon: 'edit' },
  editOrganizerNote: { label: 'Edit Organizer Note', icon: 'edit_note' },
  feature: { label: 'Feature', icon: 'star', tone: 'accent' },
  joinResource: { label: 'Join', icon: 'login', tone: 'accent' },
  joinWaitlist: { label: 'Join waiting list', icon: 'hourglass_empty', tone: 'accent' },
  leaveEvent: { label: 'Leave Event', icon: 'exit_to_app', tone: 'warning' },
  leaveResource: { label: 'Leave', icon: 'logout' },
  notifyParticipants: { label: 'Notify Participants', icon: 'support_agent' },
  publish: { label: 'Publish', icon: 'campaign', tone: 'accent' },
  rejectInvitation: { label: 'Reject Invitation', icon: 'block', tone: 'destructive' },
  removeFeedback: { label: 'Remove', icon: 'remove_circle', tone: 'destructive' },
  reportManager: { label: 'Report Manager', icon: 'flag', tone: 'warning' },
  reportOrganizer: { label: 'Report Organizer', icon: 'flag', tone: 'warning' },
  reportOwner: { label: 'Report Owner', icon: 'flag', tone: 'warning' },
  requestJoin: { label: 'Request join', icon: 'person_add', tone: 'accent' },
  restore: { label: 'Restore', icon: 'restore_from_trash' },
  restoreFeedback: { label: 'Restore', icon: 'restore' },
  route: { label: 'Route', icon: 'route' },
  shareAsset: { label: 'Share Asset', icon: 'ios_share' },
  shareEvent: { label: 'Share Event', icon: 'ios_share' },
  startFeedback: { label: 'Start Feedback', icon: 'play_arrow' },
  takeOver: { label: 'Take Over', icon: 'verified_user', tone: 'review' },
  unfeature: { label: 'Unfeature', icon: 'star_outline', tone: 'warning' },
  unpublish: { label: 'Unpublish', icon: 'visibility_off', tone: 'warning' },
  view: { label: 'View Event', icon: 'visibility' },
  viewArticle: { label: 'View', icon: 'visibility' },
  viewAsset: { label: 'View Asset', icon: 'edit_square' },
  viewInvitation: { label: 'View Invitation', icon: 'visibility' }
};

export interface InfoCardFooterChip {
  label: string;
  toneClass?: string | null;
}

export interface InfoCardData {
  rowId: string;
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

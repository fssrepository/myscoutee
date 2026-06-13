import type { AssetType, SubEventResourceFilter } from '../../common/constants';
import type { SubEventFormItem } from '../../contracts/event.interface';

export type MenuSection = 'game' | 'chat' | 'invitations' | 'events' | 'hosting';

export type PopupType =
  | 'activities'
  | 'eventFeedback'
  | 'eventFeedbackNote'
  | 'tickets'
  | 'chat'
  | 'chatMembers'
  | 'assetsCar'
  | 'assetsAccommodation'
  | 'assetsSupplies'
  | 'assetsTickets'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'invitationActions'
  | 'eventEditor'
  | 'eventExplore'
  | 'subEventMembers'
  | 'subEventAssets'
  | 'profileEditor'
  | 'imageEditor'
  | 'imageUpload'
  | 'supplyDetail'
  | 'assetMembers'
  | 'subEventSupplyContributions'
  | 'ticketCode'
  | 'ticketScanner'
  | 'activityMembers'
  | 'valuesSelector'
  | 'interestSelector'
  | 'experienceSelector'
  | 'deleteAccountConfirm'
  | 'logoutConfirm'
  | null;

export interface SupplyContext {
  subEventId: string;
  subEventTitle: string;
  type: string;
}

export interface SubEventBadgeContext {
  subEvent: SubEventFormItem;
  type: SubEventResourceFilter;
  groupId?: string;
  groupName?: string;
}

export interface BrowserBarcodeDetectorResult {
  rawValue?: string;
}

export interface BrowserBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<BrowserBarcodeDetectorResult[]>;
}

export interface BrowserBarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): BrowserBarcodeDetector;
}

export interface SubEventAssetBadgeContext {
  subEventId: string;
  assetType: AssetType;
}

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

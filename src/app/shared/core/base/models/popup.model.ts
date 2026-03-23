import type { AssetType } from './asset.model';
import type { SubEventFormItem } from './event.model';

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
  type: 'Members' | 'Car' | 'Accommodation' | 'Supplies';
  groupId?: string;
  groupName?: string;
}

export interface HelpCenterSection {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  details: string[];
  points: string[];
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


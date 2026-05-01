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
  contentHtml: string;
  details?: string[];
  points?: string[];
}

export type HelpCenterAuditAction = 'seed' | 'create' | 'update' | 'activate' | 'delete';

export interface HelpCenterRevision {
  id: string;
  version: number;
  title: string;
  summary: string;
  description: string;
  sections: HelpCenterSection[];
  active: boolean;
  createdAtIso: string;
  createdByUserId: string;
  updatedAtIso: string;
  updatedByUserId: string;
}

export interface HelpCenterAuditEntry {
  id: string;
  revisionId: string | null;
  version: number | null;
  action: HelpCenterAuditAction;
  actorUserId: string;
  createdAtIso: string;
  message: string;
}

export interface HelpCenterState {
  activeRevision: HelpCenterRevision | null;
  revisions: HelpCenterRevision[];
  auditTrail: HelpCenterAuditEntry[];
}

export interface HelpCenterRevisionSaveRequest {
  actorUserId: string;
  baseRevisionId?: string | null;
  title: string;
  summary: string;
  description: string;
  sections: HelpCenterSection[];
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

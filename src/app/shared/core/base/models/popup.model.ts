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
  imageUrls?: string[];
  optional?: boolean;
  details?: string[];
  points?: string[];
}

export type HelpCenterDocumentKind = 'help' | 'privacy' | 'explanation';
export type HelpCenterHeaderColor = 'amber' | 'blue' | 'green' | 'rose' | 'violet' | 'slate';

export type HelpCenterAuditAction = 'seed' | 'create' | 'update' | 'activate' | 'delete';

export interface ContentLanguage {
  lang: string;
  label: string;
}

export interface ExplainableSurface {
  key: string;
  label: string;
  icon: string;
  owner: 'route' | 'popup' | 'navigator';
  order: number;
  enabled: boolean;
}

export interface HelpCenterRevision {
  id: string;
  documentKind?: HelpCenterDocumentKind;
  contextKey?: string | null;
  lang: string;
  languageLabel: string;
  version: number;
  title: string;
  summary: string;
  description: string;
  headerColor?: HelpCenterHeaderColor;
  sections: HelpCenterSection[];
  active: boolean;
  createdAtIso: string;
  createdByUserId: string;
  updatedAtIso: string;
  updatedByUserId: string;
}

export interface HelpCenterAuditEntry {
  id: string;
  documentKind?: HelpCenterDocumentKind;
  lang?: string;
  languageLabel?: string;
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
  availableLanguages: ContentLanguage[];
}

export type PrivacyConsentSource = 'entry' | 'settings';

export interface PrivacyConsentRecord {
  id: string;
  userId: string;
  revisionId: string;
  revisionVersion: number;
  approvedOptionalSectionIds: string[];
  acceptedAtIso: string;
  updatedAtIso: string;
  source: PrivacyConsentSource;
}

export interface PrivacyConsentSaveRequest {
  userId: string;
  revisionId: string;
  revisionVersion: number;
  approvedOptionalSectionIds: string[];
  source?: PrivacyConsentSource;
}

export interface HelpCenterRevisionSaveRequest {
  actorUserId: string;
  baseRevisionId?: string | null;
  contextKey?: string | null;
  lang?: string | null;
  title: string;
  summary: string;
  description: string;
  headerColor?: HelpCenterHeaderColor;
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

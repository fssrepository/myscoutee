import type { UserLocationEligibilityResponseDto } from './user.interface';

export interface IdeaPostDto {
  id: string;
  contentKey: string;
  lang: string;
  languageLabel: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  trashed: boolean;
  trashedAtIso: string;
  trashedByUserId: string;
  submittedAtIso: string;
  createdAtIso: string;
  createdByUserId: string;
  updatedAtIso: string;
  updatedByUserId: string;
}

export interface IdeaPostSaveRequestDto {
  actorUserId: string;
  id?: string | null;
  contentKey?: string | null;
  lang?: string | null;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  submittedAtIso: string;
}

export interface IdeaArticleDetailDto {
  id: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  dateLabel: string;
  sortAtIso: string;
  featured: boolean;
}

export interface HelpCenterSection {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  contentHtml: string;
  imageUrls?: string[];
  panelSpan?: HelpCenterSectionPanelSpan;
  optional?: boolean;
  details?: string[];
  points?: string[];
}

export type HelpCenterSectionPanelSpan = 'span-1' | 'span-2' | 'span-3';

export type HelpCenterDocumentKind = 'help' | 'privacy' | 'terms' | 'explanation';
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

export interface LandingContentState {
  privacy: HelpCenterState;
  terms: HelpCenterState;
  ideas: IdeaPostDto[];
  loginAvailability: UserLocationEligibilityResponseDto | null;
}

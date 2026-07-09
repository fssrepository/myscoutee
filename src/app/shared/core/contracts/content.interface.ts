import type * as UserContracts from './user.interface';

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

export type IdeaPostAdminFilter = 'all' | 'featured' | 'published' | 'drafts' | 'trashed';

export interface IdeaPostAdminCountsDto {
  all: number;
  featured: number;
  published: number;
  drafts: number;
  trashed: number;
}

export interface IdeaPostAdminPageQueryDto {
  status?: IdeaPostAdminFilter | string | null;
  page?: number | null;
  pageSize?: number | null;
  cursor?: string | null;
}

export interface IdeaPostAdminPageResultDto {
  records: IdeaPostDto[];
  total: number;
  nextCursor: string | null;
  counts: IdeaPostAdminCountsDto;
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

export interface HelpCenterSectionDto {
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

export interface HelpCenterRevisionDto {
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
  sections: HelpCenterSectionDto[];
  active: boolean;
  createdAtIso: string;
  createdByUserId: string;
  updatedAtIso: string;
  updatedByUserId: string;
}

export interface HelpCenterAuditEntryDto {
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

export interface HelpCenterStateDto {
  activeRevision: HelpCenterRevisionDto | null;
  revisions: HelpCenterRevisionDto[];
  auditTrail: HelpCenterAuditEntryDto[];
  availableLanguages: ContentLanguage[];
}

export type PrivacyConsentSource = 'entry' | 'settings';

export interface PrivacyConsentDto {
  id: string;
  userId: string;
  revisionId: string;
  revisionVersion: number;
  approvedOptionalSectionIds: string[];
  acceptedAtIso: string;
  updatedAtIso: string;
  source: PrivacyConsentSource;
}

export interface PrivacyConsentSaveRequestDto {
  userId: string;
  revisionId: string;
  revisionVersion: number;
  approvedOptionalSectionIds: string[];
  source?: PrivacyConsentSource;
}

export interface HelpCenterRevisionSaveRequestDto {
  actorUserId: string;
  baseRevisionId?: string | null;
  contextKey?: string | null;
  lang?: string | null;
  title: string;
  summary: string;
  description: string;
  headerColor?: HelpCenterHeaderColor;
  sections: HelpCenterSectionDto[];
}

export interface LandingContentStateDto {
  privacy: HelpCenterStateDto;
  terms: HelpCenterStateDto;
  ideas: IdeaPostDto[];
  loginAvailability: UserContracts.UserLocationEligibilityResponseDto | null;
}

import type { HelpCenterState } from './popup.model';
import type { UserLocationEligibilityResponseDto } from '../interfaces/user.interface';

export interface IdeaPost {
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

export interface IdeaPostSaveRequest {
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

export interface IdeaArticleDetail {
  id: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  dateLabel: string;
  sortAtIso: string;
  featured: boolean;
}

export interface LandingContentState {
  privacy: HelpCenterState;
  terms: HelpCenterState;
  ideas: IdeaPost[];
  loginAvailability: UserLocationEligibilityResponseDto | null;
}

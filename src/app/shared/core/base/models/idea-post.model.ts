import type { HelpCenterState } from './popup.model';

export interface IdeaPost {
  id: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  submittedAtIso: string;
  createdAtIso: string;
  createdByUserId: string;
  updatedAtIso: string;
  updatedByUserId: string;
}

export interface IdeaPostSaveRequest {
  actorUserId: string;
  id?: string | null;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  submittedAtIso: string;
}

export interface LandingContentState {
  privacy: HelpCenterState;
  ideas: IdeaPost[];
}

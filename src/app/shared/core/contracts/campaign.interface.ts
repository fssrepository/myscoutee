import type { RatingSnapshot } from './rating-snapshot';
import type { DocumentAttachment } from './document-attachment.interface';
import type { ListQuery, PageResult } from './list.interface';

export const CAMPAIGN_KINDS = ['work', 'business', 'both'] as const;
export type CampaignKind = typeof CAMPAIGN_KINDS[number];
export const CAMPAIGN_CATEGORIES = ['technology', 'creative', 'services', 'education', 'community', 'other'] as const;
export type CampaignCategory = typeof CAMPAIGN_CATEGORIES[number];
export type CampaignStatus = 'draft' | 'published' | 'trash';
export type CampaignAction = 'publish' | 'unpublish' | 'trash' | 'restore';
export interface CampaignFields {
  title: string; description: string; kind: CampaignKind; category: CampaignCategory;
  imageUrls: string[]; attachments: DocumentAttachment[];
}
export interface Campaign extends CampaignFields {
  id: string; workspaceGroupId: string; ownerUserId: string;
  ownerName: string; ownerAvatarUrl: string | null; ownerCity: string; distanceKm: number | null;
  viewerRating?: number;
  viewerRatingSnapshot?: RatingSnapshot;
  status: CampaignStatus; createdAtIso: string; updatedAtIso: string; version: number;
}
export interface SaveCampaign extends CampaignFields { userId: string; id?: string; version?: number; }
export interface CampaignHistoryItem {
  campaign: Campaign;
  lastInteractionAtIso: string;
}
export interface CampaignFilters {
  status?: CampaignStatus; scope?: 'own' | 'discover' | 'all'; search?: string;
  kind?: CampaignKind | null; category?: CampaignCategory | null;
}
export interface ICampaignsService {
  history(userId: string, targetUserId: string, query: ListQuery, signal?: AbortSignal): Promise<PageResult<CampaignHistoryItem>>;
  page(userId: string, query: ListQuery<CampaignFilters>, signal?: AbortSignal): Promise<PageResult<Campaign>>;
  detail(userId: string, id: string, signal?: AbortSignal): Promise<Campaign>;
  save(request: SaveCampaign): Promise<Campaign>;
  action(userId: string, id: string, action: CampaignAction, version: number): Promise<Campaign>;
}

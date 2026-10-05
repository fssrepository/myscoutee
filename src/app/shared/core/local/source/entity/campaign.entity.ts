import type { Campaign } from '../../../contracts/campaign.interface';
export const CAMPAIGNS_TABLE_NAME = 'campaigns' as const;
export type CampaignRecord = Omit<Campaign, 'ownerName' | 'ownerAvatarUrl' | 'ownerCity' | 'distanceKm' | 'viewerRating'>;
export interface CampaignsMemorySchema {
  [CAMPAIGNS_TABLE_NAME]: { byId: Record<string, CampaignRecord>; ids: string[] };
}

export interface IntegrationTokenDto {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  claimedAddress: string | null;
  lastUsedAt: string | null;
}

export interface AffiliateRevenueDto {
  euroSummary?: import('./payment-method.interface').PaymentEuroSummaryDto | null;
  currencies: Record<string, { gross: number; refunded: number; net: number }>;
  purchases: number;
  eventBookings: number;
}

export interface IntegrationSettingsDto {
  baseUrl: string;
  maxActiveTokens: number;
  maxBatchSize: number;
  tokens: IntegrationTokenDto[];
  affiliate: { url: string; registered: number; revenue?: AffiliateRevenueDto };
  participants: { registered: number; imported: number };
}

export interface IntegrationTokenCreatedDto {
  token: IntegrationTokenDto;
  value: string;
}

export interface ExternalInviteLinkRequest {
  ownerType: 'event' | 'community' | 'asset'; entityId: string; userId: string;
  assetType?: import('../common/constants').AssetType;
}

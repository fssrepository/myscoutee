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

export interface IntegrationSettingsDto {
  baseUrl: string;
  maxActiveTokens: number;
  maxBatchSize: number;
  tokens: IntegrationTokenDto[];
}

export interface IntegrationTokenCreatedDto {
  token: IntegrationTokenDto;
  value: string;
}

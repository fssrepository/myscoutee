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
  affiliate: { url: string; registered: number };
  participants: { registered: number; imported: number };
}

export interface IntegrationTokenCreatedDto {
  token: IntegrationTokenDto;
  value: string;
}

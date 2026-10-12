import type { IntegrationTokenDto } from '../../../../contracts/integrations/integration.interface';

export interface LocalIntegrationTokenRecord extends IntegrationTokenDto {
  value: string;
  scope?: 'integration' | 'admin-client' | 'mcp';
  redirectUri?: string;
}

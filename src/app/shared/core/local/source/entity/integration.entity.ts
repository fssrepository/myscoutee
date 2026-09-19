import type { IntegrationTokenDto } from '../../../contracts/integration.interface';

export interface LocalIntegrationTokenRecord extends IntegrationTokenDto {
  value: string;
}

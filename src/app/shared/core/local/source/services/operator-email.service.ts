import { Injectable } from '@angular/core';
import type { OperatorEmailConfiguration, OperatorEmailSave } from '../../../contracts/operator-email.interface';
/** Provider credentials are never persisted in the browser-only demo adapter. */
@Injectable({ providedIn: 'root' })
export class LocalOperatorEmailService {
  async load(): Promise<OperatorEmailConfiguration> {
    return { revision: 0, enabled: false, providerId: '', fromEmail: '', fromName: '', credentialConfigured: false, availableProviders: [] };
  }
  async save(_request: OperatorEmailSave): Promise<OperatorEmailConfiguration> { throw new Error('operator.email.backendRequired'); }
}

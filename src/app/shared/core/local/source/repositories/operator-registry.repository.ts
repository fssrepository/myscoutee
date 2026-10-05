import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
import type { OperatorRegistryStateRecord } from '../entity/operator.entity';
import type { DeploymentConfigurationDto } from '../../../contracts/deployment-configuration.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalOperatorRegistryRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private hydrationPromise: Promise<void> | null = null;
  private hydrated = false;
  private cachedRecord: OperatorRegistryStateRecord | null = null;

  async whenReady(): Promise<void> {
    if (this.hydrated) {
      return;
    }
    if (!this.hydrationPromise) {
      this.hydrationPromise = this.hydrate();
    }
    await this.hydrationPromise;
  }

  async read(): Promise<OperatorRegistryStateRecord | null> {
    await this.whenReady();
    return this.cloneRecord(this.cachedRecord);
  }

  async readPublicConfiguration(): Promise<DeploymentConfigurationDto> {
    await this.whenReady();
    if (this.cachedRecord) {
      const configuration = this.cachedRecord.configuration;
      return structuredClone({
        ...configuration.branding,
        paymentProviderId: configuration.payment.providerId,
        firebaseMessagingConfigured: configuration.firebase.messagingCredentialConfigured,
        socialLinks: configuration.socialLinks,
        privacyContact: configuration.privacyContact
      });
    }
    // The public local site has its own small catalog before any operator demo exists.
    // Reading it does not create an operator, ledger or registry record.
    const { default: configurationData } = await import('../../seed/data/deployment-configuration.json');
    return structuredClone(configurationData);
  }

  async write(record: OperatorRegistryStateRecord): Promise<void> {
    await this.whenReady();
    const saved = this.cloneRecord(record);
    if (!saved) {
      return;
    }
    this.cachedRecord = saved;
    await this.memoryDb.writeIndexedDbTableEntry(
      APP_INDEXED_DB_KEYS.operatorRegistry,
      this.cloneRecord(saved)
    );
  }

  async clear(): Promise<void> {
    await this.whenReady();
    this.cachedRecord = null;
    await this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.operatorRegistry);
  }

  private async hydrate(): Promise<void> {
    await this.memoryDb.whenReady();
    this.cachedRecord = this.cloneRecord(
      await this.memoryDb.readIndexedDbTableEntry<OperatorRegistryStateRecord>(
        APP_INDEXED_DB_KEYS.operatorRegistry
      )
    );
    this.hydrated = true;
  }

  private cloneRecord(
    record: OperatorRegistryStateRecord | null | undefined
  ): OperatorRegistryStateRecord | null {
    return record ? structuredClone(record) : null;
  }
}

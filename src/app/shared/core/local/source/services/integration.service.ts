import { Injectable, inject } from '@angular/core';

import { SessionService } from '../../../base/services/session.service';
import type {
  IntegrationSettingsDto,
  IntegrationTokenCreatedDto
} from '../../../contracts/integration.interface';
import { LocalIntegrationRepository } from '../repositories/integration.repository';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import { LocalRouteDelayService } from './route-delay.service';

const INTEGRATIONS_ROUTE = '/integrations';

@Injectable({ providedIn: 'root' })
export class LocalIntegrationService extends LocalRouteDelayService {
  private readonly repository = inject(LocalIntegrationRepository);
  private readonly operatorRepository = inject(LocalOperatorRegistryRepository);
  private readonly session = inject(SessionService);

  async loadSettings(): Promise<IntegrationSettingsDto> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(`${INTEGRATIONS_ROUTE}/settings`);
    const settings = this.repository.settings(this.requireUserId(), await this.publicBaseUrl());
    await this.repository.flushToIndexedDb();
    return settings;
  }

  async createToken(
    name: string,
    expiresInDays: number
  ): Promise<IntegrationTokenCreatedDto> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(`${INTEGRATIONS_ROUTE}/tokens`);
    const created = this.repository.createToken(
      this.requireUserId(),
      name,
      expiresInDays
    );
    await this.repository.flushToIndexedDb();
    return created;
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(`${INTEGRATIONS_ROUTE}/tokens`);
    this.repository.revokeToken(this.requireUserId(), tokenId);
    await this.repository.flushToIndexedDb();
  }

  private requireUserId(): string {
    const userId = this.session.activeUserId().trim();
    if (!userId) {
      throw new Error('integration.user.missing');
    }
    return userId;
  }

  private async publicBaseUrl(): Promise<string> {
    const configured = (await this.operatorRepository.read())
      ?.configuration.integration?.publicBaseUrl?.trim();
    const fallback = '/api/integrations/v1';
    try {
      return new URL(
        configured || fallback,
        globalThis.location?.origin ?? 'http://localhost'
      ).toString().replace(/\/$/, '');
    } catch {
      return fallback;
    }
  }
}

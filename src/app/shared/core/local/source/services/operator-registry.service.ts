import { Injectable, inject } from '@angular/core';

import type {
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryServiceContract,
  OperatorRegistryStatusDto
} from '../../../contracts/operator.interface';
import { LocalOperatorRegistryMapper } from '../mappers/operator-registry.mapper';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import { SeedOperatorRegistryBuilder } from '../../seed/builders/operator-registry-seed.builder';
import { LocalRouteDelayService } from './route-delay.service';
import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from '../../../base/operator-registry-candidate';

const OPERATOR_REGISTRY_ROUTE = '/operator/registry';
const OPERATOR_REGISTRY_INSPECT_ROUTE = '/operator/registry/inspect';
const OPERATOR_REGISTRY_CONFIRM_ROUTE = '/operator/registry/confirm';
const OPERATOR_REGISTRY_RETRY_ROUTE = '/operator/registry/retry';
const OPERATOR_REGISTRY_DISCONNECT_ROUTE = '/operator/registry/disconnect';

@Injectable({
  providedIn: 'root'
})
export class LocalOperatorRegistryService extends LocalRouteDelayService implements OperatorRegistryServiceContract {
  readonly source = 'demo' as const;
  private readonly repository = inject(LocalOperatorRegistryRepository);

  async loadStatus(): Promise<OperatorRegistryStatusDto> {
    await this.waitForArtificialLocalRouteDelay(OPERATOR_REGISTRY_ROUTE);
    return LocalOperatorRegistryMapper.toStatusDto(await this.readOrCreate());
  }

  async inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto> {
    await this.waitForArtificialLocalRouteDelay(OPERATOR_REGISTRY_INSPECT_ROUTE);
    const current = await this.readOrCreate();
    const baseUrl = this.requireBaseUrl(request.baseUrl);
    const requestedScope = request.expectedScope?.trim() ?? '';
    const scopeValidationError = validateOperatorRegistryScope(requestedScope);
    if (scopeValidationError) {
      throw new Error(scopeValidationError);
    }
    const registryScope = requestedScope || SeedOperatorRegistryBuilder.SAMPLE_SCOPE;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const inspectionToken = this.sampleToken('inspection');
    const next = LocalOperatorRegistryMapper.toRecord({
      ...current.status,
      lifecycle: 'INSPECTED',
      enabled: false,
      simulation: true,
      draftInspection: {
        baseUrl,
        registryScope,
        registryKeyId: `registry_${SeedOperatorRegistryBuilder.SAMPLE_REGISTRY_FINGERPRINT.slice(0, 16)}`,
        registryPublicKeyFingerprint: SeedOperatorRegistryBuilder.SAMPLE_REGISTRY_FINGERPRINT,
        inspectedAt: now.toISOString(),
        expiresAt
      },
      lastError: null,
      audit: this.updatedAudit(current.status, now)
    }, inspectionToken);
    await this.repository.write(next);
    const inspection = LocalOperatorRegistryMapper.toInspectionDto(next);
    if (!inspection) {
      throw new Error('Sample registry inspection was not created.');
    }
    return inspection;
  }

  async confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto> {
    await this.waitForArtificialLocalRouteDelay(OPERATOR_REGISTRY_CONFIRM_ROUTE);
    const current = await this.readOrCreate();
    const draft = current.status.draftInspection;
    if (!draft || !current.inspectionToken || current.inspectionToken !== inspectionToken.trim()) {
      throw new Error('The sample registry inspection expired. Inspect it again before confirming.');
    }
    if (!draft.expiresAt || Date.parse(draft.expiresAt) <= Date.now()) {
      throw new Error('The sample registry inspection expired. Inspect it again before confirming.');
    }
    const now = new Date();
    const seed = this.sampleIdSeed(draft.baseUrl, draft.registryScope);
    const next = LocalOperatorRegistryMapper.toRecord({
      ...current.status,
      lifecycle: 'REGISTERED',
      enabled: true,
      simulation: true,
      draftInspection: null,
      selection: {
        baseUrl: draft.baseUrl,
        registryIdentity: {
          identityEndpoint: `${draft.baseUrl.replace(/\/+$/, '')}/v1/registry/identity`,
          protocolVersion: '1',
          registryScope: draft.registryScope,
          registryKeyId: draft.registryKeyId,
          registryPublicKeyFingerprint: draft.registryPublicKeyFingerprint
        },
        confirmedAt: now.toISOString()
      },
      nodeIdentity: {
        state: 'SIMULATED',
        publicKeyFingerprint: SeedOperatorRegistryBuilder.SAMPLE_NODE_FINGERPRINT,
        initializedAt: now.toISOString()
      },
      enrollment: {
        deploymentCode: `dep_${seed.slice(0, 32)}`,
        installationTestBatchId: `batch_${seed.slice(32, 64)}`,
        installationTestAcceptedAt: now.toISOString(),
        installationTestLedgerIndex: 1,
        completedAt: now.toISOString()
      },
      audit: {
        ...this.updatedAudit(current.status, now),
        lastAttemptAt: now.toISOString(),
        lastSuccessAt: now.toISOString(),
        disabledAt: null
      },
      lastError: null
    });
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  async retry(): Promise<OperatorRegistryStatusDto> {
    await this.waitForArtificialLocalRouteDelay(OPERATOR_REGISTRY_RETRY_ROUTE);
    const current = await this.readOrCreate();
    const now = new Date();
    const next = LocalOperatorRegistryMapper.toRecord({
      ...current.status,
      lifecycle: current.status.enrollment ? 'REGISTERED' : current.status.lifecycle,
      enabled: Boolean(current.status.enrollment),
      audit: {
        ...this.updatedAudit(current.status, now),
        lastAttemptAt: now.toISOString(),
        lastSuccessAt: current.status.enrollment ? now.toISOString() : current.status.audit.lastSuccessAt
      },
      lastError: null
    }, current.inspectionToken);
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  async disconnect(): Promise<OperatorRegistryStatusDto> {
    await this.waitForArtificialLocalRouteDelay(OPERATOR_REGISTRY_DISCONNECT_ROUTE);
    const current = await this.readOrCreate();
    const now = new Date();
    const next = LocalOperatorRegistryMapper.toRecord({
      ...current.status,
      lifecycle: 'DISABLED',
      enabled: false,
      draftInspection: null,
      audit: {
        ...this.updatedAudit(current.status, now),
        disabledAt: now.toISOString()
      },
      lastError: null
    });
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  private async readOrCreate(): Promise<import('../entity/operator.entity').OperatorRegistryStateRecord> {
    await this.repository.whenReady();
    const existing = await this.repository.read();
    if (existing) {
      return existing;
    }
    const initial = SeedOperatorRegistryBuilder.buildInitialRecord();
    await this.repository.write(initial);
    return initial;
  }

  private requireBaseUrl(value: string): string {
    return normalizeOperatorRegistryBaseUrl(value, false);
  }

  private updatedAudit(status: OperatorRegistryStatusDto, now: Date): OperatorRegistryStatusDto['audit'] {
    return {
      ...status.audit,
      updatedAt: now.toISOString(),
      updatedBy: 'operator-demo-dev'
    };
  }

  private sampleToken(prefix: string): string {
    const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
      ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${random}`;
  }

  private sampleIdSeed(...values: string[]): string {
    let state = 2166136261;
    const source = values.join('\n');
    for (let index = 0; index < source.length; index += 1) {
      state ^= source.charCodeAt(index);
      state = Math.imul(state, 16777619);
    }
    const word = (state >>> 0).toString(16).padStart(8, '0');
    return word.repeat(8);
  }
}

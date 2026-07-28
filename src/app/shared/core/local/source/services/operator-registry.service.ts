import { Injectable, inject } from '@angular/core';

import {
  DEFAULT_DEPLOYMENT_BRANDING,
  DEPLOYMENT_THEME_PRESETS
} from '../../../contracts/deployment-configuration.interface';
import type { ListQuery } from '../../../contracts/list.interface';
import type {
  OperatorGroupLinkRequestDto,
  OperatorGroupingTokenDto,
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityAvailability,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorConfigurationTestRequestDto,
  OperatorConfigurationTestResultDto,
  OperatorDeploymentUpdateDto,
  OperatorDeploymentUpdatePhase,
  OperatorDeploymentUpdateProgressDto,
  OperatorDeploymentUpdateProgressHandler,
  OperatorLeaderboardPageDto,
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryRegisterRequestDto,
  OperatorRegistryServiceContract,
  OperatorRegistryStatusDto
} from '../../../contracts/operator.interface';
import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from '../../../base/operator-registry-candidate';
import { LocalOperatorRegistryMapper } from '../mappers/operator-registry.mapper';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import type { OperatorRegistryStateRecord } from '../entity/operator.entity';
import { LocalRouteDelayService } from './route-delay.service';

const OPERATOR_REGISTRY_ROUTE = '/operator/registry';
const OPERATOR_REGISTRY_INSPECT_ROUTE = '/operator/registry/inspect';
const OPERATOR_REGISTRY_CONFIRM_ROUTE = '/operator/registry/confirm';
const OPERATOR_REGISTRY_REGISTER_ROUTE = '/operator/registry/register';
const OPERATOR_REGISTRY_RETRY_ROUTE = '/operator/registry/retry';
const OPERATOR_REGISTRY_DISCONNECT_ROUTE = '/operator/registry/disconnect';
const OPERATOR_LEADERBOARD_ROUTE = '/operator/leaderboard';
const OPERATOR_CLAIM_ROUTE = '/operator/claim';
const OPERATOR_CLAIM_APPLY_ROUTE = '/operator/claim/apply';
const OPERATOR_CLAIM_TOKEN_ROUTE = '/operator/claim/client-token';
const OPERATOR_CLAIM_REDEEM_ROUTE = '/operator/claim/redeem';
const OPERATOR_UPDATE_ROUTE = '/operator/update';
const OPERATOR_UPDATE_APPLY_ROUTE = '/operator/update/apply';
const OPERATOR_CONFIGURATION_ROUTE = '/operator/configuration';
const OPERATOR_CONFIGURATION_TEST_ROUTE = '/operator/configuration/test';
const OPERATOR_COMMUNITY_ROUTE = '/operator/community';

@Injectable({
  providedIn: 'root'
})
export class LocalOperatorRegistryService extends LocalRouteDelayService implements OperatorRegistryServiceContract {
  readonly source = 'demo' as const;
  private readonly repository = inject(LocalOperatorRegistryRepository);

  async loadStatus(): Promise<OperatorRegistryStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_ROUTE);
    return LocalOperatorRegistryMapper.toStatusDto(await this.readStored());
  }

  async inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_INSPECT_ROUTE);
    const current = await this.readStored();
    const baseUrl = this.requireBaseUrl(request.baseUrl);
    const registryScope = this.requireRegistryScope(
      request.expectedScope,
      this.scopeForBaseUrl(current, baseUrl)
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const inspectionToken = this.createToken('inspection');
    const next = LocalOperatorRegistryMapper.withStatus(current, {
      ...current.status,
      lifecycle: 'INSPECTED',
      enabled: false,
      simulation: true,
      draftInspection: {
        baseUrl,
        registryScope,
        inspectedAt: now.toISOString(),
        expiresAt
      },
      lastError: null,
      audit: this.updatedAudit(current.status, now)
    }, inspectionToken);
    await this.repository.write(this.appendAudit(
      next,
      'INSPECT',
      `Registry candidate inspected: ${baseUrl}`
    ));
    const inspection = LocalOperatorRegistryMapper.toInspectionDto(next);
    if (!inspection) {
      throw new Error('operator.registration.error.inspection.missing');
    }
    return inspection;
  }

  async confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_CONFIRM_ROUTE);
    const current = await this.readStored();
    const draft = current.status.draftInspection;
    if (!draft || !current.inspectionToken || current.inspectionToken !== inspectionToken.trim()) {
      throw new Error('operator.registration.error.inspection.expired');
    }
    if (!draft.expiresAt || Date.parse(draft.expiresAt) <= Date.now()) {
      throw new Error('operator.registration.error.inspection.expired');
    }
    const now = new Date();
    const next = this.appendAudit(LocalOperatorRegistryMapper.withStatus(current, {
      ...current.status,
      lifecycle: 'CONFIGURED',
      enabled: false,
      draftInspection: null,
      selection: {
        baseUrl: draft.baseUrl,
        registryScope: draft.registryScope,
        registryIdentity: {
          identityEndpoint: `${draft.baseUrl.replace(/\/+$/, '')}/v1/registry/identity`,
          protocolVersion: '1',
          registryScope: draft.registryScope
        },
        confirmedAt: now.toISOString()
      },
      registryOptions: this.selectRegistryOption(current.status, draft.baseUrl),
      audit: this.updatedAudit(current.status, now),
      lastError: null
    }, null), 'CONFIGURE', `Registry configured: ${draft.baseUrl}`);
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  async register(request: OperatorRegistryRegisterRequestDto): Promise<OperatorRegistryStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_REGISTER_ROUTE);
    const current = await this.readStored();
    const baseUrl = this.requireBaseUrl(request.registryBaseUrl);
    const registryScope = this.requireRegistryScope(
      request.expectedRegistryScope,
      this.scopeForBaseUrl(current, baseUrl)
    );
    const now = new Date();
    const seed = this.stableIdSeed(baseUrl, registryScope);
    const registering = this.appendAudit(LocalOperatorRegistryMapper.withStatus(current, {
      ...current.status,
      lifecycle: 'REGISTERING',
      enabled: false,
      audit: {
        ...this.updatedAudit(current.status, now),
        lastAttemptAt: now.toISOString()
      }
    }), 'REGISTER', `Node registration requested: ${baseUrl}`);
    await this.repository.write(registering);
    const next = LocalOperatorRegistryMapper.withStatus(registering, {
      ...current.status,
      lifecycle: 'REGISTERED',
      enabled: true,
      simulation: true,
      draftInspection: null,
      selection: {
        baseUrl,
        registryScope,
        registryIdentity: {
          identityEndpoint: `${baseUrl.replace(/\/+$/, '')}/v1/registry/identity`,
          protocolVersion: '1',
          registryScope
        },
        confirmedAt: now.toISOString()
      },
      registryOptions: this.selectRegistryOption(current.status, baseUrl),
      nodeIdentity: {
        state: 'SIMULATED',
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
        ...this.updatedAudit(registering.status, now),
        lastAttemptAt: now.toISOString(),
        lastSuccessAt: now.toISOString(),
        disabledAt: null
      },
      lastError: null
    }, null);
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  async retry(): Promise<OperatorRegistryStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_RETRY_ROUTE);
    const current = await this.readStored();
    if (current.status.lifecycle !== 'PENDING' && current.status.lifecycle !== 'REGISTERING') {
      return LocalOperatorRegistryMapper.toStatusDto(current);
    }
    const now = new Date();
    const next = this.appendAudit(LocalOperatorRegistryMapper.withStatus(current, {
      ...current.status,
      audit: {
        ...this.updatedAudit(current.status, now),
        lastAttemptAt: now.toISOString()
      },
      lastError: null
    }), 'REGISTER', 'Explicit registration retry requested.');
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  async disconnect(): Promise<OperatorRegistryStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_DISCONNECT_ROUTE);
    const current = await this.readStored();
    const now = new Date();
    const next = this.appendAudit(LocalOperatorRegistryMapper.withStatus(current, {
      ...current.status,
      lifecycle: 'DISABLED',
      enabled: false,
      draftInspection: null,
      audit: {
        ...this.updatedAudit(current.status, now),
        disabledAt: now.toISOString()
      },
      lastError: null
    }, null), 'DISCONNECT', 'Outbound registry synchronization disabled.');
    await this.repository.write(next);
    return LocalOperatorRegistryMapper.toStatusDto(next);
  }

  async leaderboardPage(
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardPageDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_LEADERBOARD_ROUTE, signal);
    return LocalOperatorRegistryMapper.toLeaderboardPage(await this.readStored(), query);
  }

  async loadClaimStatus(): Promise<OperatorClaimStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_ROUTE);
    return structuredClone((await this.readStored()).claimStatus);
  }

  async claimShare(_request: OperatorClaimRequestDto): Promise<OperatorClaimStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_APPLY_ROUTE);
    const current = await this.readStored();
    if (current.claimStatus.claimed) {
      return structuredClone(current.claimStatus);
    }
    if (!current.status.enabled || current.status.lifecycle !== 'REGISTERED') {
      throw new Error('operator.claim.error.registration.required');
    }
    const claimedAt = new Date().toISOString();
    const claimIdentity = current.claimIdentity;
    const operatorGroupId = claimIdentity.operatorGroupId;
    const ledger = current.ledger.map(item =>
      item.nodeId === claimIdentity.nodeId
        ? {
            ...item,
            claimed: true,
            claimantUserId: claimIdentity.claimantUserId,
            claimantName: claimIdentity.claimantName,
            claimantAvatarUrl: claimIdentity.claimantAvatarUrl,
            claimedAt
          }
        : item
    );
    const groupLinks = [
      ...current.groupLinks.filter(link => link.nodeId !== claimIdentity.nodeId),
      {
        nodeId: claimIdentity.nodeId,
        operatorGroupId,
        linkedAt: claimedAt
      }
    ];
    const leaderboard = LocalOperatorRegistryMapper.deriveLeaderboard(ledger, groupLinks);
    const claimedGroup = leaderboard.find(
      item => item.group === 'CLAIMED' && item.operatorGroupId === operatorGroupId
    );
    const claimStatus: OperatorClaimStatusDto = {
      claimed: true,
      claimedAt,
      claimantUserId: claimIdentity.claimantUserId,
      claimantName: claimIdentity.claimantName,
      claimantAvatarUrl: claimIdentity.claimantAvatarUrl,
      operatorGroupId,
      sharePercent: claimedGroup?.sharePercent ?? 0
    };
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      ledger,
      groupLinks,
      leaderboard,
      claimStatus
    }, 'CLAIM', 'This deployment share was claimed.', claimIdentity.nodeId));
    return structuredClone(claimStatus);
  }

  async issueGroupingToken(): Promise<OperatorGroupingTokenDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_TOKEN_ROUTE);
    const current = await this.readStored();
    const operatorGroupId = current.claimStatus.operatorGroupId?.trim() ?? '';
    if (!current.claimStatus.claimed || !operatorGroupId) {
      throw new Error('operator.group.error.claim.required');
    }
    const now = new Date();
    const token: OperatorGroupingTokenDto = {
      clientToken: this.createToken('group'),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString()
    };
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      groupingTokens: [
        ...current.groupingTokens.filter(item => Date.parse(item.expiresAt) > now.getTime()),
        {
          token: token.clientToken,
          expiresAt: token.expiresAt,
          redeemedAt: null,
          operatorGroupId
        }
      ]
    }, 'GROUP_TOKEN', 'Temporary grouping token issued.'));
    return token;
  }

  async linkOperatorGroup(
    request: OperatorGroupLinkRequestDto
  ): Promise<OperatorClaimStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_REDEEM_ROUTE);
    const current = await this.readStored();
    const token = request.clientToken.trim();
    const tokenRecord = current.groupingTokens.find(item => item.token === token);
    if (!tokenRecord || tokenRecord.redeemedAt || Date.parse(tokenRecord.expiresAt) <= Date.now()) {
      throw new Error('operator.group.error.token.invalid');
    }
    if (!current.claimStatus.claimed) {
      throw new Error('operator.group.error.claim.required');
    }
    const nowIso = new Date().toISOString();
    const groupLinks = [
      ...current.groupLinks.filter(link => link.nodeId !== current.claimIdentity.nodeId),
      {
        nodeId: current.claimIdentity.nodeId,
        operatorGroupId: tokenRecord.operatorGroupId,
        linkedAt: nowIso
      }
    ];
    const recalculated = LocalOperatorRegistryMapper.deriveLeaderboard(
      current.ledger,
      groupLinks
    );
    const claimedGroup = recalculated.find(
      item => item.group === 'CLAIMED'
        && item.operatorGroupId === tokenRecord.operatorGroupId
    );
    const claimStatus: OperatorClaimStatusDto = {
      ...current.claimStatus,
      operatorGroupId: tokenRecord.operatorGroupId,
      sharePercent: claimedGroup?.sharePercent ?? current.claimStatus.sharePercent
    };
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      groupLinks,
      leaderboard: recalculated,
      claimStatus,
      groupingTokens: current.groupingTokens.map(item =>
        item.token === token ? { ...item, redeemedAt: nowIso } : item
      )
    }, 'GROUP_LINK', 'Claimed deployment linked to an operator group.', current.claimIdentity.nodeId));
    return structuredClone(claimStatus);
  }

  async loadDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_UPDATE_ROUTE);
    return structuredClone((await this.readStored()).deploymentUpdate);
  }

  async applyDeploymentUpdate(
    onProgress?: OperatorDeploymentUpdateProgressHandler
  ): Promise<OperatorDeploymentUpdateDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_UPDATE_APPLY_ROUTE);
    let current = await this.readStored();
    const totalBytes = Math.max(0, current.deploymentUpdate.progress.bytesTotal);
    try {
      const steps: readonly [
        OperatorDeploymentUpdatePhase,
        number,
        number
      ][] = [
        ['CHECKING', 0, 0],
        ['DOWNLOADING', 0, 0],
        ['DOWNLOADING', Math.round(totalBytes * 0.35), 35],
        ['DOWNLOADING', Math.round(totalBytes * 0.78), 78],
        ['DOWNLOADING', totalBytes, 100],
        ['VERIFYING', totalBytes, 100],
        ['INSTALLING', totalBytes, 100]
      ];
      for (const [phase, bytesDownloaded, percent] of steps) {
        current = await this.publishUpdateProgress(
          current,
          {
            phase,
            bytesDownloaded,
            bytesTotal: totalBytes,
            percent,
            message: null,
            updatedAt: new Date().toISOString()
          },
          onProgress
        );
        await this.waitForDelay(70);
      }

      const nowIso = new Date().toISOString();
      const deploymentUpdate: OperatorDeploymentUpdateDto = {
        ...current.deploymentUpdate,
        currentVersion: current.deploymentUpdate.availableVersion,
        updateAvailable: false,
        lastCheckedAt: nowIso,
        lastUpdatedAt: nowIso,
        progress: {
          phase: 'COMPLETED',
          bytesDownloaded: totalBytes,
          bytesTotal: totalBytes,
          percent: 100,
          message: null,
          updatedAt: nowIso
        }
      };
      const completed = this.appendAudit({
        ...structuredClone(current),
        deploymentUpdate
      }, 'UPDATE', `Deployment updated to ${deploymentUpdate.currentVersion}.`);
      await this.repository.write(completed);
      onProgress?.(structuredClone(deploymentUpdate.progress));
      return structuredClone(deploymentUpdate);
    } catch (error) {
      const failedAt = new Date().toISOString();
      const progress: OperatorDeploymentUpdateProgressDto = {
        ...current.deploymentUpdate.progress,
        phase: 'FAILED',
        message: error instanceof Error ? error.message : 'operator.update.error.failed',
        updatedAt: failedAt
      };
      onProgress?.(structuredClone(progress));
      try {
        await this.repository.write({
          ...structuredClone(current),
          deploymentUpdate: {
            ...current.deploymentUpdate,
            progress
          }
        });
      } catch {
        // The original update error remains authoritative.
      }
      throw error;
    }
  }

  async loadConfiguration(): Promise<OperatorConfigurationDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_ROUTE);
    return structuredClone((await this.readStored()).configuration);
  }

  async saveConfiguration(
    request: OperatorConfigurationSaveRequestDto
  ): Promise<OperatorConfigurationDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_ROUTE);
    const current = await this.readStored();
    const previousPaymentProvider = current.configuration.payment.providerId;
    const themePreset = this.deploymentThemePreset(request.branding.themePreset);
    const productName = `${request.branding.productName ?? ''}`.trim().slice(0, 80);
    const homeLabel = `${request.branding.homeLabel ?? ''}`.trim().slice(0, 120);
    const logoUrl = `${request.branding.logoUrl ?? ''}`.trim()
      || DEFAULT_DEPLOYMENT_BRANDING.logoUrl;
    if (!productName || !homeLabel) {
      throw new Error('operator.configuration.branding.label.required');
    }
    const paymentProvider = this.operatorPaymentProvider(
      request.payment.providerId,
      current.configuration.payment.availableProviders
    );
    const paymentCredentialInput = `${request.payment.credential ?? ''}`.trim();
    const paymentCredentialConfigured = paymentProvider !== null
      && (
        Boolean(paymentCredentialInput)
        || (
          paymentProvider === previousPaymentProvider
          && current.configuration.payment.credentialConfigured
        )
      );
    const projectId = `${request.firebase.projectId ?? ''}`.trim().slice(0, 160);
    const authenticationCredentialConfigured =
      Boolean(`${request.firebase.authenticationCredential ?? ''}`.trim())
      || current.configuration.firebase.authenticationCredentialConfigured;
    const messagingCredentialConfigured =
      Boolean(`${request.firebase.messagingCredential ?? ''}`.trim())
      || current.configuration.firebase.messagingCredentialConfigured;
    const updatedAt = new Date().toISOString();
    const configuration: OperatorConfigurationDto = {
      capability: 'AVAILABLE',
      unavailableReason: null,
      branding: {
        productName,
        homeLabel,
        logoUrl,
        themePreset,
        revision: current.configuration.branding.revision + 1
      },
      payment: {
        availableProviders: structuredClone(
          current.configuration.payment.availableProviders
        ),
        providerId: paymentProvider,
        credentialConfigured: paymentCredentialConfigured,
        credentialMask: paymentCredentialInput
          ? this.maskCredential(paymentCredentialInput)
          : paymentProvider === previousPaymentProvider
            ? current.configuration.payment.credentialMask
            : null
      },
      firebase: {
        projectId,
        authenticationCredentialConfigured,
        messagingCredentialConfigured
      },
      updatedAt
    };
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      configuration
    }, 'CONFIGURATION_SAVE', 'Operator configuration updated.'));
    return structuredClone(configuration);
  }

  async testConfiguration(
    request: OperatorConfigurationTestRequestDto
  ): Promise<OperatorConfigurationTestResultDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_TEST_ROUTE);
    const current = await this.readStored();
    const configured = request.kind === 'FIREBASE_AUTHENTICATION'
      ? Boolean(
          current.configuration.firebase.projectId.trim()
          && current.configuration.firebase.authenticationCredentialConfigured
        )
      : Boolean(
          current.configuration.firebase.projectId.trim()
          && current.configuration.firebase.messagingCredentialConfigured
        );
    const testedAt = new Date().toISOString();
    await this.repository.write(this.appendAudit({
      ...structuredClone(current)
    }, 'CONFIGURATION_TEST', `Configuration test completed: ${request.kind}.`));
    return {
      kind: request.kind,
      success: configured,
      message: configured
        ? 'operator.configuration.test.success'
        : 'operator.configuration.credentials.missing',
      testedAt
    };
  }

  async loadCommunityStatus(): Promise<OperatorCommunityStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_COMMUNITY_ROUTE);
    return structuredClone((await this.readStored()).community);
  }

  async setCommunityAvailability(
    availability: OperatorCommunityAvailability
  ): Promise<OperatorCommunityStatusDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_COMMUNITY_ROUTE);
    const current = await this.readStored();
    const community: OperatorCommunityStatusDto = {
      ...current.community,
      availability,
      updatedAt: new Date().toISOString()
    };
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      community
    }, 'COMMUNITY', `Community availability changed to ${availability}.`));
    return structuredClone(community);
  }

  private async readStored(): Promise<OperatorRegistryStateRecord> {
    await this.repository.whenReady();
    const stored = await this.repository.read();
    if (!stored) {
      throw new Error('operator.workspace.error.unavailable');
    }
    return stored;
  }

  private async publishUpdateProgress(
    record: OperatorRegistryStateRecord,
    progress: OperatorDeploymentUpdateProgressDto,
    onProgress?: OperatorDeploymentUpdateProgressHandler
  ): Promise<OperatorRegistryStateRecord> {
    const next: OperatorRegistryStateRecord = {
      ...structuredClone(record),
      deploymentUpdate: {
        ...record.deploymentUpdate,
        progress: structuredClone(progress)
      }
    };
    await this.repository.write(next);
    onProgress?.(structuredClone(progress));
    return next;
  }

  private requireBaseUrl(value: string): string {
    return normalizeOperatorRegistryBaseUrl(value, false);
  }

  private deploymentThemePreset(
    value: OperatorConfigurationSaveRequestDto['branding']['themePreset']
  ): OperatorConfigurationSaveRequestDto['branding']['themePreset'] {
    return DEPLOYMENT_THEME_PRESETS.includes(value)
      ? value
      : 'AURORA';
  }

  private operatorPaymentProvider(
    value: string | null | undefined,
    availableProviders: OperatorConfigurationDto['payment']['availableProviders']
  ): string | null {
    const providerId = `${value ?? ''}`.trim().toLowerCase();
    if (!providerId) {
      return null;
    }
    return availableProviders.some(provider => provider.id.trim().toLowerCase() === providerId)
      ? providerId
      : null;
  }

  private maskCredential(value: string): string {
    const normalized = value.trim();
    const suffix = normalized.slice(-4);
    return suffix ? `••••${suffix}` : '••••';
  }

  private requireScope(value: string | null | undefined): string {
    const scope = `${value ?? ''}`.trim();
    const validationError = validateOperatorRegistryScope(scope);
    if (validationError) {
      throw new Error(validationError);
    }
    return scope;
  }

  private requireRegistryScope(
    requestedScope: string | null | undefined,
    storedScope: string
  ): string {
    const scope = this.requireScope(requestedScope) || this.requireScope(storedScope);
    if (!scope) {
      throw new Error('operator.registration.error.scope.required');
    }
    return scope;
  }

  private scopeForBaseUrl(record: OperatorRegistryStateRecord, baseUrl: string): string {
    return record.status.registryOptions
      ?.find(option => this.sameBaseUrl(option.baseUrl, baseUrl))
      ?.registryScope
      ?.trim() ?? '';
  }

  private selectRegistryOption(
    status: OperatorRegistryStatusDto,
    selectedBaseUrl: string
  ): OperatorRegistryStatusDto['registryOptions'] {
    return status.registryOptions?.map(option => ({
      ...option,
      selected: this.sameBaseUrl(option.baseUrl, selectedBaseUrl)
    })) ?? [];
  }

  private sameBaseUrl(left: string, right: string): boolean {
    try {
      return normalizeOperatorRegistryBaseUrl(left, false)
        === normalizeOperatorRegistryBaseUrl(right, false);
    } catch {
      return false;
    }
  }

  private async waitForOperatorRouteDelay(
    route: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.waitForRouteDelay(route, signal, 'operator.request.aborted');
  }

  private updatedAudit(status: OperatorRegistryStatusDto, now: Date): OperatorRegistryStatusDto['audit'] {
    return {
      ...status.audit,
      updatedAt: now.toISOString(),
      updatedBy: status.audit.updatedBy
    };
  }

  private appendAudit(
    record: OperatorRegistryStateRecord,
    kind: OperatorRegistryStateRecord['auditHistory'][number]['kind'],
    detail: string,
    nodeId: string | null = null
  ): OperatorRegistryStateRecord {
    const at = new Date().toISOString();
    return {
      ...structuredClone(record),
      auditHistory: [
        ...record.auditHistory,
        {
          id: this.createToken('audit'),
          kind,
          at,
          nodeId,
          detail
        }
      ]
    };
  }

  private createToken(prefix: string): string {
    const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
      ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${random}`;
  }

  private stableIdSeed(...values: string[]): string {
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

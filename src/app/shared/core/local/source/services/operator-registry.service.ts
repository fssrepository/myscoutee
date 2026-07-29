import { Injectable, inject } from '@angular/core';

import { OperatorConfigurationMapper } from '../../../base/mappers/operator-configuration.mapper';
import {
  DEFAULT_DEPLOYMENT_BRANDING,
  DEPLOYMENT_THEME_PRESETS
} from '../../../contracts/deployment-configuration.interface';
import type { ListQuery } from '../../../contracts/list.interface';
import type {
  OperatorGroupLinkRequestDto,
  OperatorGroupingTokenDto,
  OperatorClaimMutationResultDto,
  OperatorClaimOverviewDto,
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityAvailability,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorConfigurationTestRequestDto,
  OperatorConfigurationTestResultDto,
  OperatorTlsConfigurationDto,
  OperatorTlsConfigurationUpdateDto,
  OperatorTlsJobDto,
  OperatorTlsTestRequestDto,
  OperatorDeploymentUpdateDto,
  OperatorDeploymentUpdatePhase,
  OperatorDeploymentUpdateProgressDto,
  OperatorDeploymentUpdateProgressHandler,
  OperatorLeaderboardDeploymentPageDto,
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardMutationDto,
  OperatorLeaderboardPageDto,
  OperatorMeasurementReportDto,
  OperatorMeasurementReportFilters,
  OperatorMeasurementReportPageDto,
  OperatorMeasurementSyncDto,
  OperatorRevenueDto,
  OperatorRevenueReportDto,
  OperatorRevenueReportFilters,
  OperatorRevenueReportPageDto,
  OperatorRevenueSyncDto,
  OperatorSettlementDto,
  OperatorSettlementFilters,
  OperatorSettlementPageDto,
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryMutationResultDto,
  OperatorRegistryRegisterRequestDto,
  OperatorRegistryServiceContract,
  OperatorRegistryStatusDto
} from '../../../contracts/operator.interface';
import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from '../../../base/operator-registry-candidate';
import { LocalOperatorRegistryMapper } from '../mappers/operator-registry.mapper';
import { LocalOperatorTlsMapper } from '../mappers/operator-tls.mapper';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import type {
  OperatorLedgerNodeRecord,
  OperatorRegistryStateRecord
} from '../entity/operator.entity';
import { LocalRouteDelayService } from './route-delay.service';

const OPERATOR_REGISTRY_ROUTE = '/operator/registry';
const OPERATOR_REGISTRY_INSPECT_ROUTE = '/operator/registry/inspect';
const OPERATOR_REGISTRY_CONFIRM_ROUTE = '/operator/registry/confirm';
const OPERATOR_REGISTRY_REGISTER_ROUTE = '/operator/registry/register';
const OPERATOR_REGISTRY_RETRY_ROUTE = '/operator/registry/retry';
const OPERATOR_REGISTRY_DISCONNECT_ROUTE = '/operator/registry/disconnect';
const OPERATOR_MEASUREMENTS_SYNCHRONIZE_ROUTE =
  '/operator/measurements/synchronize';
const OPERATOR_MEASUREMENTS_REPORTS_ROUTE = '/operator/measurements/reports';
const OPERATOR_LEADERBOARD_ROUTE = '/operator/leaderboard';
const OPERATOR_LEADERBOARD_DEPLOYMENTS_ROUTE =
  '/operator/leaderboard/groups/deployments';
const OPERATOR_CLAIM_ROUTE = '/operator/claim';
const OPERATOR_CLAIM_APPLY_ROUTE = '/operator/claim/apply';
const OPERATOR_CLAIM_TOKEN_ROUTE = '/operator/claim/client-token';
const OPERATOR_CLAIM_REDEEM_ROUTE = '/operator/claim/redeem';
const OPERATOR_UPDATE_ROUTE = '/operator/update';
const OPERATOR_UPDATE_APPLY_ROUTE = '/operator/update/apply';
const OPERATOR_CONFIGURATION_ROUTE = '/operator/configuration';
const OPERATOR_CONFIGURATION_TEST_ROUTE = '/operator/configuration/test';
const OPERATOR_REVENUE_ROUTE = '/operator/revenue';
const OPERATOR_REVENUE_SYNCHRONIZE_ROUTE = '/operator/revenue/synchronize';
const OPERATOR_REVENUE_REPORTS_ROUTE = '/operator/revenue/reports';
const OPERATOR_REVENUE_SETTLEMENTS_ROUTE =
  '/operator/revenue/settlements';
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

  async register(
    request: OperatorRegistryRegisterRequestDto
  ): Promise<OperatorRegistryMutationResultDto> {
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
    const nextStatus = LocalOperatorRegistryMapper.withStatus(registering, {
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
    const deploymentCode = nextStatus.status.enrollment?.deploymentCode ?? '';
    const previousNodeId = current.claimIdentity.nodeId.trim();
    const existingDeployment = current.ledger.find(item =>
      item.nodeId === deploymentCode
      || item.nodeId === previousNodeId
    );
    const created = !current.ledger.some(item =>
      item.nodeId === deploymentCode
    );
    const deploymentEntry: OperatorLedgerNodeRecord = existingDeployment
      ? {
          ...existingDeployment,
          id: deploymentCode,
          nodeId: deploymentCode,
          label: deploymentCode,
          active: true,
          eligibilityStatus: existingDeployment.claimed
            ? existingDeployment.eligibilityStatus
            : 'INACTIVE'
        }
      : {
          id: deploymentCode,
          nodeId: deploymentCode,
          label: deploymentCode,
          active: true,
          founder: false,
          verifiedWeight: 0,
          claimed: false,
          eligibilityStatus: 'INACTIVE',
          claimantUserId: null,
          claimantName: null,
          claimantAvatarUrl: null,
          measuredAt: now.toISOString(),
          claimedAt: null
        };
    const ledger = [
      ...current.ledger.filter(item =>
        item.nodeId !== previousNodeId
        && item.nodeId !== deploymentCode
      ),
      deploymentEntry
    ];
    const groupLinks = current.groupLinks.map(link =>
      link.nodeId === previousNodeId
        ? { ...link, nodeId: deploymentCode }
        : link
    );
    const next: OperatorRegistryStateRecord = {
      ...nextStatus,
      ledger,
      groupLinks,
      claimIdentity: {
        ...current.claimIdentity,
        nodeId: deploymentCode
      },
      leaderboard: LocalOperatorRegistryMapper.deriveLeaderboard(
        ledger,
        groupLinks
      )
    };
    await this.repository.write(next);
    const leaderboardEntry = next.leaderboard.find(item =>
      item.id === deploymentCode
      || item.nodeId === deploymentCode
    ) ?? null;
    return {
      status: LocalOperatorRegistryMapper.toStatusDto(next),
      ...this.leaderboardMutation(
        current.leaderboard,
        next.leaderboard,
        leaderboardEntry
      ),
      created
    };
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

  async disconnect(): Promise<OperatorRegistryMutationResultDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REGISTRY_DISCONNECT_ROUTE);
    const current = await this.readStored();
    const now = new Date();
    const statusRecord = LocalOperatorRegistryMapper.withStatus(current, {
      ...current.status,
      lifecycle: 'DISABLED',
      enabled: false,
      draftInspection: null,
      audit: {
        ...this.updatedAudit(current.status, now),
        disabledAt: now.toISOString()
      },
      lastError: null
    }, null);
    const activeNodeId = current.status.enrollment?.deploymentCode?.trim()
      || current.claimIdentity.nodeId.trim();
    const hadClaim = current.claimStatus.claimed
      || current.claimStatus.verificationStatus !== 'NOT_SUBMITTED';
    const previousOperatorGroupId =
      current.claimStatus.operatorGroupId?.trim() ?? '';
    const ledger: OperatorLedgerNodeRecord[] = current.ledger.map(item =>
      item.nodeId === activeNodeId
        ? {
            ...item,
            active: false,
            claimed: false,
            eligibilityStatus: 'INACTIVE',
            claimantUserId: null,
            claimantName: null,
            claimantAvatarUrl: null,
            claimedAt: null
          }
        : item
    );
    const groupLinks = current.groupLinks.filter(
      link => link.nodeId !== activeNodeId
    );
    const leaderboard = LocalOperatorRegistryMapper.deriveLeaderboard(
      ledger,
      groupLinks
    );
    const leaderboardEntry = previousOperatorGroupId
      ? leaderboard.find(
          item => item.operatorGroupId === previousOperatorGroupId
        ) ?? null
      : null;
    const next = this.appendAudit({
      ...statusRecord,
      ledger,
      groupLinks,
      leaderboard,
      claimStatus: {
        ...current.claimStatus,
        claimed: false,
        claimedAt: null,
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        operatorGroupId: null,
        activeLinkId: null,
        sharePercent: 0,
        shareNumerator: '0',
        shareDenominator: '1',
        verificationStatus: hadClaim ? 'WITHDRAWN' : 'NOT_SUBMITTED',
        legalName: null,
        eligibilityStatus: 'INACTIVE'
      },
      claimVerificationRequest: null
    }, 'DISCONNECT', 'Registry deployment deactivated and claim withdrawn.');
    await this.repository.write(next);
    return {
      status: LocalOperatorRegistryMapper.toStatusDto(next),
      ...this.leaderboardMutation(
        current.leaderboard,
        next.leaderboard,
        leaderboardEntry
      ),
      created: false
    };
  }

  async synchronizeMeasurements(): Promise<OperatorMeasurementSyncDto> {
    await this.waitForOperatorRouteDelay(
      OPERATOR_MEASUREMENTS_SYNCHRONIZE_ROUTE
    );
    return {
      state: 'DORMANT',
      code: 'LOCAL_FALLBACK',
      message: 'operator.measurements.delivery.not.sent',
      materialized: 0,
      submitted: 0,
      accepted: 0,
      pending: 0,
      blocked: 0,
      synchronizedAt: new Date().toISOString()
    };
  }

  async measurementReportPage(
    _query: ListQuery<OperatorMeasurementReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorMeasurementReportPageDto> {
    await this.waitForOperatorRouteDelay(
      OPERATOR_MEASUREMENTS_REPORTS_ROUTE,
      signal
    );
    return {
      items: [],
      total: 0
    };
  }

  async requeueMeasurementReport(
    _reportId: string
  ): Promise<OperatorMeasurementReportDto> {
    await this.waitForOperatorRouteDelay(
      `${OPERATOR_MEASUREMENTS_REPORTS_ROUTE}/requeue`
    );
    throw new Error('operator.measurements.report.requeue.unavailable');
  }

  async leaderboardPage(
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardPageDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_LEADERBOARD_ROUTE, signal);
    return LocalOperatorRegistryMapper.toLeaderboardPage(await this.readStored(), query);
  }

  async leaderboardDeploymentPage(
    groupId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardDeploymentPageDto> {
    await this.waitForOperatorRouteDelay(
      OPERATOR_LEADERBOARD_DEPLOYMENTS_ROUTE,
      signal
    );
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) {
      throw new Error(
        'operator.leaderboard.deployments.error.group.invalid'
      );
    }
    return LocalOperatorRegistryMapper.toLeaderboardDeploymentPage(
      await this.readStored(),
      normalizedGroupId,
      query
    );
  }

  async loadClaimStatus(): Promise<OperatorClaimOverviewDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_ROUTE);
    const record = await this.readStored();
    return structuredClone({
      status: record.claimStatus,
      submission: record.claimVerificationRequest
    });
  }

  async claimShare(
    request: OperatorClaimRequestDto
  ): Promise<OperatorClaimMutationResultDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_APPLY_ROUTE);
    const current = await this.readStored();
    if (current.claimStatus.claimed) {
      return this.claimMutation(current, current.claimStatus);
    }
    if (current.claimStatus.verificationStatus === 'PENDING_REVIEW') {
      return this.claimMutation(current, current.claimStatus);
    }
    if (!current.status.enabled || current.status.lifecycle !== 'REGISTERED') {
      throw new Error('operator.claim.error.registration.required');
    }
    const verificationRequest = this.requireClaimVerificationRequest(request);
    const submittedAt = new Date().toISOString();
    const claimIdentity = current.claimIdentity;
    const operatorGroupId = claimIdentity.operatorGroupId;
    const ledger: OperatorLedgerNodeRecord[] = current.ledger.map(item =>
      item.nodeId === claimIdentity.nodeId
        ? {
            ...item,
            claimed: true,
            eligibilityStatus: 'INACTIVE',
            claimantUserId: claimIdentity.claimantUserId,
            claimantName: verificationRequest.legalName,
            claimantAvatarUrl: claimIdentity.claimantAvatarUrl,
            claimedAt: submittedAt
          }
        : item
    );
    const groupLinks = [
      ...current.groupLinks.filter(link => link.nodeId !== claimIdentity.nodeId),
      {
        nodeId: claimIdentity.nodeId,
        operatorGroupId,
        linkedAt: submittedAt
      }
    ];
    const provisionalLeaderboard = LocalOperatorRegistryMapper.deriveLeaderboard(
      ledger,
      groupLinks
    );
    const claimStatus: OperatorClaimStatusDto = {
      ...current.claimStatus,
      claimed: true,
      claimedAt: submittedAt,
      claimantUserId: claimIdentity.claimantUserId,
      claimantName: verificationRequest.legalName,
      claimantAvatarUrl: claimIdentity.claimantAvatarUrl,
      operatorGroupId,
      sharePercent: 0,
      verificationCapability: 'AVAILABLE',
      verificationUnavailableReason: null,
      verificationStatus: 'PENDING_REVIEW',
      verificationSubmittedAt: submittedAt,
      legalName: verificationRequest.legalName,
      eligibilityStatus: 'INACTIVE'
    };
    const leaderboard = LocalOperatorRegistryMapper.recalculateLeaderboard(
      LocalOperatorRegistryMapper.withCurrentClaimVerification(
        provisionalLeaderboard,
        claimStatus
      )
    );
    const next = this.appendAudit({
      ...structuredClone(current),
      ledger,
      groupLinks,
      leaderboard,
      claimStatus,
      claimVerificationRequest: verificationRequest
    }, 'CLAIM', 'Company verification submitted for review.', current.claimIdentity.nodeId);
    await this.repository.write(next);
    return this.claimMutation(next, claimStatus, current.leaderboard);
  }

  async issueGroupingToken(): Promise<OperatorGroupingTokenDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_TOKEN_ROUTE);
    const current = await this.readStored();
    const operatorGroupId = current.claimStatus.operatorGroupId?.trim() ?? '';
    const verificationApproved =
      current.claimStatus.verificationStatus === 'APPROVED'
      || current.claimStatus.verificationStatus === 'VERIFIED';
    if (
      !current.claimStatus.claimed
      || !operatorGroupId
      || !verificationApproved
      || current.claimStatus.eligibilityStatus !== 'ACTIVE'
    ) {
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
  ): Promise<OperatorClaimMutationResultDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CLAIM_REDEEM_ROUTE);
    const current = await this.readStored();
    if (!current.status.enabled || current.status.lifecycle !== 'REGISTERED') {
      throw new Error('operator.claim.error.registration.required');
    }
    const token = request.clientToken.trim();
    const tokenRecord = current.groupingTokens.find(item => item.token === token);
    if (!tokenRecord || tokenRecord.redeemedAt || Date.parse(tokenRecord.expiresAt) <= Date.now()) {
      throw new Error('operator.group.error.token.invalid');
    }
    const nowIso = new Date().toISOString();
    if (
      current.claimStatus.claimed
      && current.claimStatus.operatorGroupId === tokenRecord.operatorGroupId
    ) {
      const updated = this.appendAudit({
        ...structuredClone(current),
        groupingTokens: current.groupingTokens.map(item =>
          item.token === token ? { ...item, redeemedAt: nowIso } : item
        )
      }, 'GROUP_LINK',
      'Temporary client code redeemed by an already linked deployment.',
      current.claimIdentity.nodeId);
      await this.repository.write(updated);
      return this.claimMutation(
        updated,
        updated.claimStatus,
        current.leaderboard
      );
    }
    const groupNodeIds = new Set(
      current.groupLinks
        .filter(link => link.operatorGroupId === tokenRecord.operatorGroupId)
        .map(link => link.nodeId)
    );
    const groupClaimant = current.ledger.find(
      item => item.nodeId && groupNodeIds.has(item.nodeId) && item.claimed
    );
    const ledger: OperatorLedgerNodeRecord[] = current.claimStatus.claimed
      ? current.ledger
      : current.ledger.map(item =>
          item.nodeId === current.claimIdentity.nodeId
            ? {
                ...item,
                claimed: true,
                eligibilityStatus: 'INACTIVE',
                claimantUserId:
                  groupClaimant?.claimantUserId
                  ?? current.claimIdentity.claimantUserId,
                claimantName:
                  groupClaimant?.claimantName
                  ?? current.claimIdentity.claimantName,
                claimantAvatarUrl:
                  groupClaimant?.claimantAvatarUrl
                  ?? current.claimIdentity.claimantAvatarUrl,
                claimedAt: nowIso
              }
            : item
        );
    const groupLinks = [
      ...current.groupLinks.filter(link => link.nodeId !== current.claimIdentity.nodeId),
      {
        nodeId: current.claimIdentity.nodeId,
        operatorGroupId: tokenRecord.operatorGroupId,
        linkedAt: nowIso
      }
    ];
    const provisionalLeaderboard = LocalOperatorRegistryMapper.deriveLeaderboard(
      ledger,
      groupLinks
    );
    const provisionalClaimStatus: OperatorClaimStatusDto = {
      ...current.claimStatus,
      claimed: true,
      claimedAt: current.claimStatus.claimedAt ?? nowIso,
      claimantUserId: current.claimStatus.claimed
        ? current.claimStatus.claimantUserId
        : groupClaimant?.claimantUserId ?? current.claimIdentity.claimantUserId,
      claimantName: current.claimStatus.claimed
        ? current.claimStatus.claimantName
        : groupClaimant?.claimantName ?? current.claimIdentity.claimantName,
      claimantAvatarUrl: current.claimStatus.claimed
        ? current.claimStatus.claimantAvatarUrl
        : groupClaimant?.claimantAvatarUrl ?? current.claimIdentity.claimantAvatarUrl,
      operatorGroupId: tokenRecord.operatorGroupId,
      sharePercent: current.claimStatus.claimed
        ? current.claimStatus.sharePercent
        : 0,
      verificationCapability: 'AVAILABLE',
      verificationUnavailableReason: null,
      verificationStatus: current.claimStatus.claimed
        ? current.claimStatus.verificationStatus
        : 'PENDING_REVIEW',
      verificationSubmittedAt:
        current.claimStatus.verificationSubmittedAt ?? nowIso,
      legalName: current.claimStatus.claimed
        ? current.claimStatus.legalName
        : groupClaimant?.claimantName ?? null,
      eligibilityStatus: current.claimStatus.claimed
        ? current.claimStatus.eligibilityStatus
        : 'INACTIVE'
    };
    const leaderboard = LocalOperatorRegistryMapper.recalculateLeaderboard(
      LocalOperatorRegistryMapper.withCurrentClaimVerification(
        provisionalLeaderboard,
        provisionalClaimStatus
      )
    );
    const claimedGroup = leaderboard.find(
      item => item.group === 'CLAIMED'
        && item.operatorGroupId === tokenRecord.operatorGroupId
    );
    const claimStatus: OperatorClaimStatusDto = {
      ...provisionalClaimStatus,
      sharePercent: claimedGroup?.sharePercent ?? 0
    };
    const updated = this.appendAudit({
      ...structuredClone(current),
      ledger,
      groupLinks,
      leaderboard,
      claimStatus,
      groupingTokens: current.groupingTokens.map(item =>
        item.token === token ? { ...item, redeemedAt: nowIso } : item
      )
    },
    current.claimStatus.claimed ? 'GROUP_LINK' : 'CLAIM',
    current.claimStatus.claimed
      ? 'Claimed deployment linked to an operator group.'
      : 'Client code claim submitted for registry review.',
    current.claimIdentity.nodeId);
    await this.repository.write(updated);
    return this.claimMutation(
      updated,
      claimStatus,
      current.leaderboard
    );
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

  async loadTlsConfiguration(): Promise<OperatorTlsConfigurationDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_ROUTE);
    const current = await this.readStored();
    return LocalOperatorTlsMapper.configuration(current.tlsConfiguration);
  }

  async saveTlsConfiguration(
    request: OperatorTlsConfigurationUpdateDto
  ): Promise<OperatorTlsJobDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_ROUTE);
    const updatedAt = new Date().toISOString();
    const current = await this.readStored();
    const tlsConfiguration = LocalOperatorTlsMapper.updated(
      current.tlsConfiguration,
      request,
      updatedAt
    );
    await this.repository.write({
      ...structuredClone(current),
      tlsConfiguration
    });
    return {
      jobId: this.createToken('tls'),
      phase: 'COMPLETED',
      percent: 100,
      message: 'operator.configuration.tls.saved',
      updatedAt,
      configuration: structuredClone(tlsConfiguration)
    };
  }

  async testTlsConfiguration(
    request: OperatorTlsTestRequestDto
  ): Promise<OperatorTlsJobDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_TEST_ROUTE);
    const updatedAt = new Date().toISOString();
    const configured = request.kind === 'DOMAIN'
      ? Boolean(request.configuration.domain.trim())
      : request.configuration.mode === 'AUTOMATIC'
        || Boolean(
          request.configuration.certificate.trim()
          && request.configuration.privateKey.trim()
        )
        || LocalOperatorTlsMapper.configuration(
          (await this.readStored()).tlsConfiguration
        ).certificateConfigured;
    if (!configured) {
      throw new Error(
        request.kind === 'DOMAIN'
          ? 'operator.configuration.tls.domain.invalid'
          : 'operator.configuration.tls.certificate.required'
      );
    }
    return {
      jobId: this.createToken('tls'),
      phase: 'COMPLETED',
      percent: 100,
      message: request.kind === 'DOMAIN'
        ? 'operator.configuration.tls.test.domain.success'
        : 'operator.configuration.tls.test.certificate.success',
      updatedAt,
      configuration: null
    };
  }

  async saveConfiguration(
    request: OperatorConfigurationSaveRequestDto
  ): Promise<OperatorConfigurationDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_CONFIGURATION_ROUTE);
    const current = await this.readStored();
    const adminEmailValidationKey =
      OperatorConfigurationMapper.adminEmailValidationKey(request.adminEmails);
    if (adminEmailValidationKey) {
      throw new Error(adminEmailValidationKey);
    }
    const adminEmails = OperatorConfigurationMapper.adminEmails(
      request.adminEmails
    );
    const privacyContactValidationKey =
      OperatorConfigurationMapper.privacyContactValidationKey(
        request.privacyContact
      );
    if (privacyContactValidationKey) {
      throw new Error(privacyContactValidationKey);
    }
    const privacyContact = OperatorConfigurationMapper.privacyContact(
      request.privacyContact
    );
    const socialLinkValidationKey =
      OperatorConfigurationMapper.socialLinksValidationKey(request.socialLinks);
    if (socialLinkValidationKey) {
      throw new Error(socialLinkValidationKey);
    }
    const socialLinks = OperatorConfigurationMapper.socialLinks(
      request.socialLinks
    );
    const previousPaymentProvider = current.configuration.payment.providerId;
    const themePreset = this.deploymentThemePreset(request.branding.themePreset);
    const productName = `${request.branding.productName ?? ''}`.trim().slice(0, 80);
    const logoUrl = `${request.branding.logoUrl ?? ''}`.trim()
      || DEFAULT_DEPLOYMENT_BRANDING.logoUrl;
    if (!productName) {
      throw new Error('operator.configuration.branding.label.required');
    }
    const logoCharacterIndex = request.branding.logoCharacterIndex;
    if (
      logoCharacterIndex !== null
      && (
        !Number.isInteger(logoCharacterIndex)
        || logoCharacterIndex < 0
        || logoCharacterIndex >= Array.from(productName).length
      )
    ) {
      throw new Error('operator.configuration.branding.logo.character.index.invalid');
    }
    const paymentProvider = this.operatorPaymentProvider(
      request.payment.providerId,
      current.configuration.payment.availableProviders
    );
    const paymentPublicBaseUrl = paymentProvider
      ? OperatorConfigurationMapper.paymentPublicBaseUrl(
        request.payment.publicBaseUrl
      )
      : null;
    const paymentMerchantAccount = paymentProvider
      ? OperatorConfigurationMapper.paymentMerchantAccount(
        request.payment.merchantAccount
      ) || null
      : null;
    const paymentValidationKey =
      OperatorConfigurationMapper.paymentValidationKey({
        providerId: paymentProvider,
        publicBaseUrl: request.payment.publicBaseUrl,
        merchantAccount: request.payment.merchantAccount
      });
    if (paymentValidationKey) {
      throw new Error(paymentValidationKey);
    }
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
    const publicConfigurationFields = {
      apiKey: `${request.firebase.apiKey ?? ''}`.trim().slice(0, 256),
      authDomain: `${request.firebase.authDomain ?? ''}`.trim().slice(0, 253),
      projectId,
      storageBucket: `${request.firebase.storageBucket ?? ''}`.trim().slice(0, 512),
      messagingSenderId:
        `${request.firebase.messagingSenderId ?? ''}`.trim().slice(0, 64),
      appId: `${request.firebase.appId ?? ''}`.trim().slice(0, 256),
      measurementId:
        `${request.firebase.measurementId ?? ''}`.trim().slice(0, 64) || null,
      vapidKey: `${request.firebase.vapidKey ?? ''}`.trim().slice(0, 512) || null
    };
    const currentPublicConfiguration =
      current.configuration.firebase.publicConfiguration;
    const currentPublicConfigurationFields = {
      apiKey: currentPublicConfiguration.apiKey,
      authDomain: currentPublicConfiguration.authDomain,
      projectId: currentPublicConfiguration.projectId,
      storageBucket: currentPublicConfiguration.storageBucket,
      messagingSenderId: currentPublicConfiguration.messagingSenderId,
      appId: currentPublicConfiguration.appId,
      measurementId: currentPublicConfiguration.measurementId,
      vapidKey: currentPublicConfiguration.vapidKey
    };
    const firebaseChanged =
      projectId !== current.configuration.firebase.projectId
      || JSON.stringify(publicConfigurationFields)
        !== JSON.stringify(currentPublicConfigurationFields)
      || Boolean(`${request.firebase.authenticationCredential ?? ''}`.trim())
      || Boolean(`${request.firebase.messagingCredential ?? ''}`.trim());
    if (
      firebaseChanged
      && current.configuration.firebase.publicConfiguration.revision
        >= Number.MAX_SAFE_INTEGER
    ) {
      throw new Error('operator.request.failed');
    }
    const publicConfiguration = {
      revision: firebaseChanged
        ? current.configuration.firebase.publicConfiguration.revision + 1
        : current.configuration.firebase.publicConfiguration.revision,
      ...publicConfigurationFields
    };
    const updatedAt = new Date().toISOString();
    const configuration: OperatorConfigurationDto = {
      capability: 'AVAILABLE',
      unavailableReason: null,
      adminEmails,
      privacyContact,
      socialLinks,
      branding: {
        productName,
        homeLabel: current.configuration.branding.homeLabel,
        logoUrl,
        logoCharacterIndex,
        themePreset,
        revision: current.configuration.branding.revision + 1
      },
      payment: {
        availableProviders: structuredClone(
          current.configuration.payment.availableProviders
        ),
        providerId: paymentProvider,
        publicBaseUrl: paymentPublicBaseUrl,
        merchantAccount: paymentMerchantAccount,
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
        messagingCredentialConfigured,
        publicConfiguration,
        active: firebaseChanged
          ? false
          : current.configuration.firebase.active,
        readyToActivate: firebaseChanged
          ? false
          : current.configuration.firebase.readyToActivate,
        authenticationTestedAt: firebaseChanged
          ? null
          : current.configuration.firebase.authenticationTestedAt,
        messagingTestedAt: firebaseChanged
          ? null
          : current.configuration.firebase.messagingTestedAt,
        activatedAt: firebaseChanged
          ? null
          : current.configuration.firebase.activatedAt
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
          && request.browserReadinessToken?.trim()
          && request.browserConfigurationRevision
            === current.configuration.firebase.publicConfiguration.revision
          && request.browserAppId?.trim()
            === current.configuration.firebase.publicConfiguration.appId.trim()
        );
    const testedAt = new Date().toISOString();
    const firebase = structuredClone(current.configuration.firebase);
    if (request.kind === 'FIREBASE_AUTHENTICATION') {
      firebase.authenticationTestedAt = configured ? testedAt : null;
    }
    if (request.kind === 'FIREBASE_MESSAGING') {
      firebase.messagingTestedAt = configured ? testedAt : null;
    }
    if (!configured) {
      firebase.active = false;
      firebase.activatedAt = null;
    }
    firebase.readyToActivate = Boolean(
      firebase.authenticationTestedAt
      && firebase.messagingTestedAt
      && firebase.authenticationCredentialConfigured
      && firebase.messagingCredentialConfigured
      && firebase.publicConfiguration.apiKey.trim()
      && firebase.publicConfiguration.authDomain.trim()
      && firebase.publicConfiguration.projectId.trim()
      && firebase.publicConfiguration.messagingSenderId.trim()
      && firebase.publicConfiguration.appId.trim()
      && firebase.publicConfiguration.vapidKey?.trim()
    );
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      configuration: {
        ...structuredClone(current.configuration),
        firebase,
        updatedAt: testedAt
      }
    }, 'CONFIGURATION_TEST', `Configuration test completed: ${request.kind}.`));
    return {
      kind: request.kind,
      success: configured,
      message: configured
        ? 'operator.configuration.test.success'
        : 'operator.configuration.test.failed',
      testedAt,
      firebase: structuredClone(firebase)
    };
  }

  async activateFirebase(): Promise<OperatorConfigurationDto> {
    await this.waitForOperatorRouteDelay(
      `${OPERATOR_CONFIGURATION_ROUTE}/firebase/activate`
    );
    const current = await this.readStored();
    if (!current.configuration.firebase.readyToActivate) {
      throw new Error('operator.configuration.firebase.activation.not.ready');
    }
    const activatedAt = new Date().toISOString();
    const configuration: OperatorConfigurationDto = {
      ...structuredClone(current.configuration),
      firebase: {
        ...structuredClone(current.configuration.firebase),
        active: true,
        activatedAt
      },
      updatedAt: activatedAt
    };
    await this.repository.write(this.appendAudit({
      ...structuredClone(current),
      configuration
    }, 'CONFIGURATION_ACTIVATE', 'Firebase configuration activated.'));
    return structuredClone(configuration);
  }

  async loadRevenue(): Promise<OperatorRevenueDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REVENUE_ROUTE);
    return structuredClone((await this.readStored()).revenue);
  }

  async synchronizeRevenue(): Promise<OperatorRevenueSyncDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REVENUE_SYNCHRONIZE_ROUTE);
    return {
      state: 'DORMANT',
      code: 'LOCAL_FALLBACK',
      message: 'operator.revenue.delivery.not.sent',
      materialized: 0,
      submitted: 0,
      accepted: 0,
      pending: 0,
      blocked: 0,
      synchronizedAtIso: new Date().toISOString()
    };
  }

  async revenueReportPage(
    _query: ListQuery<OperatorRevenueReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorRevenueReportPageDto> {
    await this.waitForOperatorRouteDelay(OPERATOR_REVENUE_REPORTS_ROUTE, signal);
    return {
      items: [],
      total: 0
    };
  }

  async requeueRevenueReport(
    _reportId: string
  ): Promise<OperatorRevenueReportDto> {
    await this.waitForOperatorRouteDelay(
      `${OPERATOR_REVENUE_REPORTS_ROUTE}/requeue`
    );
    throw new Error('operator.revenue.delivery.requeue.unavailable');
  }

  async settlementPage(
    query: ListQuery<OperatorSettlementFilters>,
    signal?: AbortSignal
  ): Promise<OperatorSettlementPageDto> {
    await this.waitForOperatorRouteDelay(
      OPERATOR_REVENUE_SETTLEMENTS_ROUTE,
      signal
    );
    const pageSize = Math.max(
      1,
      Math.min(100, Math.trunc(Number(query.pageSize) || 10))
    );
    const currencyCode =
      `${query.filters?.currencyCode ?? ''}`.trim().toUpperCase();
    const fromPeriod = `${query.filters?.fromPeriod ?? ''}`.trim();
    const throughPeriod = `${query.filters?.throughPeriod ?? ''}`.trim();
    if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error('operator.revenue.settlement.currency.invalid');
    }
    if (
      (fromPeriod && !this.validSettlementPeriod(fromPeriod))
      || (throughPeriod && !this.validSettlementPeriod(throughPeriod))
      || (fromPeriod && throughPeriod && fromPeriod > throughPeriod)
    ) {
      throw new Error('operator.revenue.settlement.period.invalid');
    }
    const cursor = this.decodeSettlementCursor(query.cursor);
    const stored = await this.readStored();
    const settlements = stored.settlements ?? [];
    const generatedAtIso = settlements.reduce(
      (latest, item) =>
        item.acceptedAtIso > latest ? item.acceptedAtIso : latest,
      ''
    );
    const superseded = new Set(
      settlements
        .map(item => item.supersedesSettlementId?.trim() ?? '')
        .filter(Boolean)
    );
    const filtered = settlements
      .filter(item =>
        (!currencyCode || item.currencyCode === currencyCode)
        && (!fromPeriod || item.period >= fromPeriod)
        && (!throughPeriod || item.period <= throughPeriod)
        && (
          query.filters?.includeSuperseded === true
          || !superseded.has(item.settlementId)
        )
        && (
          !cursor
          || item.period < cursor.afterPeriod
          || (
            item.period === cursor.afterPeriod
            && item.settlementId > cursor.afterSettlementId
          )
        )
      )
      .sort((left, right) =>
        right.period.localeCompare(left.period)
        || left.settlementId.localeCompare(right.settlementId)
      );
    const items = filtered.slice(0, pageSize);
    const last = items.at(-1) ?? null;
    const nextCursor = filtered.length > items.length && last
      ? this.encodeSettlementCursor(
          last.period,
          last.settlementId
        )
      : null;
    const pageOffset =
      Math.max(0, Math.trunc(Number(query.page) || 0)) * pageSize;
    return {
      items: structuredClone(items),
      total: pageOffset + items.length + (nextCursor ? 1 : 0),
      nextCursor,
      context: {
        generatedAtIso: generatedAtIso || new Date(0).toISOString()
      }
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

  private claimMutation(
    record: OperatorRegistryStateRecord,
    status: OperatorClaimStatusDto,
    previousLeaderboard: readonly OperatorLeaderboardEntryDto[] = record.leaderboard
  ): OperatorClaimMutationResultDto {
    const currentLeaderboard = LocalOperatorRegistryMapper.recalculateLeaderboard(
      LocalOperatorRegistryMapper.withCurrentClaimVerification(
        record.leaderboard,
        status
      )
    );
    const operatorGroupId = status.operatorGroupId?.trim() ?? '';
    const leaderboardEntry = operatorGroupId
      ? currentLeaderboard.find(item =>
          item.group === 'CLAIMED'
          && item.operatorGroupId === operatorGroupId
        ) ?? null
      : null;
    return structuredClone({
      status,
      submission: record.claimVerificationRequest,
      ...this.leaderboardMutation(
        previousLeaderboard,
        currentLeaderboard,
        leaderboardEntry
      )
    });
  }

  private leaderboardMutation(
    previousLeaderboard: readonly OperatorLeaderboardEntryDto[],
    currentLeaderboard: readonly OperatorLeaderboardEntryDto[],
    leaderboardEntry: OperatorLeaderboardEntryDto | null
  ): OperatorLeaderboardMutationDto {
    const previousById = new Map(
      previousLeaderboard.map(entry => [entry.id.trim(), entry])
    );
    const currentIds = new Set(
      currentLeaderboard.map(entry => entry.id.trim()).filter(Boolean)
    );
    const leaderboardUpserts = currentLeaderboard.filter(entry => {
      const previous = previousById.get(entry.id.trim());
      return !previous || JSON.stringify(previous) !== JSON.stringify(entry);
    });
    const removedLeaderboardEntryIds = previousLeaderboard
      .map(entry => entry.id.trim())
      .filter(id => id && !currentIds.has(id));
    return {
      leaderboardEntry: leaderboardEntry
        ? structuredClone(leaderboardEntry)
        : null,
      leaderboardUpserts: structuredClone(leaderboardUpserts),
      removedLeaderboardEntryIds,
      leaderboardTotalDelta:
        currentLeaderboard.length - previousLeaderboard.length
    };
  }

  private deploymentThemePreset(
    value: OperatorConfigurationSaveRequestDto['branding']['themePreset']
  ): OperatorConfigurationSaveRequestDto['branding']['themePreset'] {
    return DEPLOYMENT_THEME_PRESETS.includes(value)
      ? value
      : 'AURORA';
  }

  private requireClaimVerificationRequest(
    request: OperatorClaimRequestDto
  ): OperatorClaimRequestDto {
    const normalized: OperatorClaimRequestDto = {
      legalName: `${request.legalName ?? ''}`.trim().slice(0, 160),
      registrationNumber: `${request.registrationNumber ?? ''}`.trim().slice(0, 80),
      jurisdiction: `${request.jurisdiction ?? ''}`.trim().slice(0, 80),
      registeredAddress: `${request.registeredAddress ?? ''}`.trim().slice(0, 500),
      website: this.normalizedPublicWebsite(request.website),
      verificationContactName:
        `${request.verificationContactName ?? ''}`.trim().slice(0, 120),
      verificationContactRole:
        `${request.verificationContactRole ?? ''}`.trim().slice(0, 120),
      verificationContactEmail:
        `${request.verificationContactEmail ?? ''}`.trim().toLowerCase().slice(0, 254),
      authorityAttested: request.authorityAttested === true
    };
    if (
      !normalized.legalName
      || !normalized.registrationNumber
      || !normalized.jurisdiction
      || !normalized.registeredAddress
      || !normalized.website
      || !normalized.verificationContactName
      || !normalized.verificationContactRole
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.verificationContactEmail)
      || !normalized.authorityAttested
    ) {
      throw new Error('operator.claim.verification.error.required');
    }
    return normalized;
  }

  private normalizedPublicWebsite(value: string | null | undefined): string {
    const source = `${value ?? ''}`.trim();
    if (!source || source.length > 2048) {
      throw new Error('operator.claim.verification.error.website');
    }
    try {
      const url = new URL(source);
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
      }
      if (
        url.protocol === 'https:'
        && !url.username
        && !url.password
      ) {
        return url.toString();
      }
    } catch {
      // Fall through to the public website validation error.
    }
    throw new Error('operator.claim.verification.error.website');
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

  private encodeSettlementCursor(
    afterPeriod: string,
    afterSettlementId: string
  ): string {
    return `operator-settlement:${
      encodeURIComponent(JSON.stringify({
        afterPeriod,
        afterSettlementId
      }))
    }`;
  }

  private decodeSettlementCursor(
    cursor: string | null | undefined
  ): {
    afterPeriod: string;
    afterSettlementId: string;
  } | null {
    const normalized = `${cursor ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    if (!normalized.startsWith('operator-settlement:')) {
      throw new Error('operator.revenue.settlement.cursor.invalid');
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(
        normalized.slice('operator-settlement:'.length)
      )) as {
        afterPeriod?: unknown;
        afterSettlementId?: unknown;
      };
      const afterPeriod = `${parsed.afterPeriod ?? ''}`.trim();
      const afterSettlementId =
        `${parsed.afterSettlementId ?? ''}`.trim();
      if (
        !this.validSettlementPeriod(afterPeriod)
        || !/^stl_[0-9a-f]{32}$/.test(afterSettlementId)
      ) {
        throw new Error();
      }
      return { afterPeriod, afterSettlementId };
    } catch {
      throw new Error('operator.revenue.settlement.cursor.invalid');
    }
  }

  private validSettlementPeriod(value: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
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

import type { ListQuery } from '../../../contracts/list.interface';
import { OperatorConfigurationMapper } from '../../../base/mappers/operator-configuration.mapper';
import type {
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorDeploymentEligibilityStatus,
  OperatorDeploymentUpdateDto,
  OperatorLeaderboardDeploymentClaimState,
  OperatorLeaderboardDeploymentDto,
  OperatorLeaderboardDeploymentPageDto,
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardGroup,
  OperatorLeaderboardPageDto,
  OperatorRevenueDto,
  OperatorTlsConfigurationDto,
  OperatorSettlementDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../../contracts/operator.interface';
import type {
  OperatorGroupingTokenRecord,
  OperatorClaimIdentityRecord,
  OperatorLedgerNodeRecord,
  OperatorNodeGroupLinkRecord,
  OperatorRegistryAuditEventRecord,
  OperatorRegistrySeedMemory,
  OperatorRegistryStateRecord
} from '../entity/operator.entity';

export interface OperatorRegistryRecordExtras {
  seedVersion: string;
  ledger: readonly OperatorLedgerNodeRecord[];
  groupLinks: readonly OperatorNodeGroupLinkRecord[];
  claimIdentity: OperatorClaimIdentityRecord;
  auditHistory: readonly OperatorRegistryAuditEventRecord[];
  claimStatus: OperatorClaimStatusDto;
  claimVerificationRequest?: OperatorClaimRequestDto | null;
  groupingTokens?: readonly OperatorGroupingTokenRecord[];
  deploymentUpdate: OperatorDeploymentUpdateDto;
  configuration: OperatorConfigurationDto;
  tlsConfiguration?: OperatorTlsConfigurationDto;
  revenue: OperatorRevenueDto;
  settlements: readonly OperatorSettlementDto[];
  community: OperatorCommunityStatusDto;
}

export class LocalOperatorRegistryMapper {
  private static readonly GROUP_ORDER: Readonly<Record<OperatorLeaderboardGroup, number>> = {
    FOUNDER: 0,
    CLAIMED: 1,
    UNCLAIMED: 2
  };

  static toStatusDto(record: OperatorRegistryStateRecord): OperatorRegistryStatusDto {
    return structuredClone(record.status);
  }

  static toRecord(
    status: OperatorRegistryStatusDto,
    extras: OperatorRegistryRecordExtras,
    inspectionToken: string | null = null
  ): OperatorRegistryStateRecord {
    return {
      seedVersion: extras.seedVersion.trim(),
      status: structuredClone(status),
      inspectionToken: inspectionToken?.trim() || null,
      ledger: [...structuredClone(extras.ledger)],
      groupLinks: [...structuredClone(extras.groupLinks)],
      claimIdentity: structuredClone(extras.claimIdentity),
      auditHistory: [...structuredClone(extras.auditHistory)],
      leaderboard: this.deriveLeaderboard(extras.ledger, extras.groupLinks),
      claimStatus: structuredClone(extras.claimStatus),
      claimVerificationRequest: structuredClone(
        extras.claimVerificationRequest ?? null
      ),
      groupingTokens: [...structuredClone(extras.groupingTokens ?? [])],
      deploymentUpdate: structuredClone(extras.deploymentUpdate),
      configuration: structuredClone(extras.configuration),
      tlsConfiguration: structuredClone(
        extras.tlsConfiguration ?? this.defaultTlsConfiguration()
      ),
      revenue: structuredClone(extras.revenue),
      settlements: [...structuredClone(extras.settlements)],
      community: structuredClone(extras.community)
    };
  }

  static withStatus(
    record: OperatorRegistryStateRecord,
    status: OperatorRegistryStatusDto,
    inspectionToken: string | null = record.inspectionToken
  ): OperatorRegistryStateRecord {
    return {
      ...structuredClone(record),
      status: structuredClone(status),
      inspectionToken: inspectionToken?.trim() || null
    };
  }

  static toSeedRecord(
    memory: OperatorRegistrySeedMemory,
    initialRecord: OperatorRegistryStateRecord
  ): OperatorRegistryStateRecord {
    const existing = memory.registryRecord;
    if (!existing) {
      return structuredClone(initialRecord);
    }
    const refreshSeedOwnedData =
      `${existing.seedVersion ?? ''}`.trim() !== initialRecord.seedVersion;
    const migrateDefaultTheme =
      initialRecord.seedVersion === 'operator-workspace-v8'
      && (
        (`${existing.seedVersion ?? ''}`.trim() === 'operator-workspace-v6'
          && existing.configuration?.branding?.themePreset === 'AURORA')
        || (`${existing.seedVersion ?? ''}`.trim() === 'operator-workspace-v7'
          && existing.configuration?.branding?.themePreset === 'OCEAN')
      );
    const storedLedger = existing.ledger?.length
      ? structuredClone(existing.ledger)
      : existing.leaderboard?.length
        ? this.legacyLedger(existing.leaderboard, initialRecord.ledger)
        : structuredClone(initialRecord.ledger);
    const ledger = this.normalizeLedgerEligibility(
      storedLedger,
      refreshSeedOwnedData ? initialRecord.ledger : []
    );
    const groupLinks = existing.groupLinks?.length
      ? structuredClone(existing.groupLinks)
      : structuredClone(initialRecord.groupLinks);
    return {
      seedVersion: initialRecord.seedVersion,
      status: {
        ...structuredClone(initialRecord.status),
        ...structuredClone(existing.status),
        registryOptions: existing.status.registryOptions?.length
          ? structuredClone(existing.status.registryOptions)
          : structuredClone(initialRecord.status.registryOptions)
      },
      inspectionToken: existing.inspectionToken?.trim() || null,
      ledger,
      groupLinks,
      claimIdentity: structuredClone(
        existing.claimIdentity ?? initialRecord.claimIdentity
      ),
      auditHistory: structuredClone(
        existing.auditHistory?.length
          ? existing.auditHistory
          : initialRecord.auditHistory
      ),
      leaderboard: this.deriveLeaderboard(ledger, groupLinks),
      claimStatus: this.normalizeClaimStatus(
        existing.claimStatus,
        initialRecord.claimStatus
      ),
      claimVerificationRequest: structuredClone(
        existing.claimVerificationRequest ?? initialRecord.claimVerificationRequest
      ),
      groupingTokens: structuredClone(existing.groupingTokens ?? []),
      deploymentUpdate: structuredClone(
        existing.deploymentUpdate
          ? {
              ...structuredClone(initialRecord.deploymentUpdate),
              ...structuredClone(existing.deploymentUpdate),
              progress: structuredClone(
                existing.deploymentUpdate.progress
                  ?? initialRecord.deploymentUpdate.progress
              )
            }
          : initialRecord.deploymentUpdate
      ),
      configuration: this.normalizeConfiguration(
        existing.configuration,
        initialRecord.configuration,
        refreshSeedOwnedData,
        migrateDefaultTheme
      ),
      tlsConfiguration: this.normalizeTlsConfiguration(
        existing.tlsConfiguration,
        initialRecord.tlsConfiguration
      ),
      revenue: structuredClone(
        !refreshSeedOwnedData && existing.revenue
          ? existing.revenue
          : initialRecord.revenue
      ),
      settlements: structuredClone(
        !refreshSeedOwnedData && existing.settlements
          ? existing.settlements
          : initialRecord.settlements
      ),
      community: existing.community
        ? {
            ...structuredClone(initialRecord.community),
            ...structuredClone(existing.community),
            providers: structuredClone(
              existing.community.providers ?? initialRecord.community.providers
            ),
            announcements: structuredClone(
              existing.community.announcements
                ?? initialRecord.community.announcements
            )
          }
        : structuredClone(initialRecord.community)
    };
  }

  static seedRecordChanged(
    current: OperatorRegistryStateRecord | null,
    next: OperatorRegistryStateRecord
  ): boolean {
    return !current || JSON.stringify(current) !== JSON.stringify(next);
  }

  private static normalizeConfiguration(
    existing: OperatorConfigurationDto | null | undefined,
    initial: OperatorConfigurationDto,
    refreshSeedOwnedData: boolean,
    migrateDefaultTheme = false
  ): OperatorConfigurationDto {
    if (!existing) {
      return structuredClone(initial);
    }
    const legacy = existing as Partial<OperatorConfigurationDto> & {
      firebaseAuthenticationConfigured?: boolean;
      firebaseMessagingConfigured?: boolean;
      branding?: Partial<OperatorConfigurationDto['branding']> & {
        theme?: string;
        landingLabel?: string;
        icon?: string;
      };
      payment?: Partial<OperatorConfigurationDto['payment']> & {
        provider?: string;
      };
    };
    const branding = (legacy.branding ?? {}) as
      Partial<OperatorConfigurationDto['branding']> & {
        theme?: string;
        landingLabel?: string;
        icon?: string;
      };
    const payment = (legacy.payment ?? {}) as
      Partial<OperatorConfigurationDto['payment']> & {
        provider?: string;
      };
    const availableProviders = structuredClone(
      refreshSeedOwnedData
        ? initial.payment.availableProviders
        : payment.availableProviders ?? initial.payment.availableProviders
    );
    const requestedProviderId = `${
      payment.providerId
      ?? (payment.provider && payment.provider !== 'NONE'
        ? payment.provider
        : initial.payment.providerId)
      ?? ''
    }`.trim().toLowerCase();
    const providerId = availableProviders.find(
      provider => provider.id.trim().toLowerCase() === requestedProviderId
    )?.id ?? null;
    return {
      capability: legacy.capability ?? initial.capability,
      unavailableReason: legacy.unavailableReason ?? initial.unavailableReason,
      adminEmails: OperatorConfigurationMapper.adminEmails(
        legacy.adminEmails ?? initial.adminEmails
      ),
      privacyContact: OperatorConfigurationMapper.privacyContact(
        legacy.privacyContact ?? initial.privacyContact
      ),
      socialLinks: OperatorConfigurationMapper.socialLinks(
        legacy.socialLinks ?? initial.socialLinks
      ),
      branding: {
        productName: branding.productName ?? initial.branding.productName,
        homeLabel:
          branding.homeLabel
          ?? branding.landingLabel
          ?? initial.branding.homeLabel,
        logoUrl: branding.logoUrl
          ?? (branding.icon === 'HEART_PNG'
            ? 'assets/logo/heart.png'
            : initial.branding.logoUrl),
        logoCharacterIndex:
          branding.logoCharacterIndex
          ?? initial.branding.logoCharacterIndex,
        themePreset:
          (migrateDefaultTheme ? initial.branding.themePreset : branding.themePreset)
          ?? initial.branding.themePreset,
        revision: branding.revision ?? initial.branding.revision
      },
      payment: {
        availableProviders,
        providerId,
        publicBaseUrl: providerId
          ? OperatorConfigurationMapper.paymentPublicBaseUrl(
            payment.publicBaseUrl
          ) || null
          : null,
        merchantAccount: providerId
          ? OperatorConfigurationMapper.paymentMerchantAccount(
            payment.merchantAccount
          ) || null
          : null,
        credentialConfigured: providerId
          ? payment.credentialConfigured ?? initial.payment.credentialConfigured
          : false,
        credentialMask: providerId
          ? payment.credentialMask ?? initial.payment.credentialMask
          : null
      },
      firebase: {
        ...structuredClone(initial.firebase),
        ...structuredClone(legacy.firebase ?? {}),
        publicConfiguration: {
          ...structuredClone(initial.firebase.publicConfiguration),
          ...structuredClone(
            legacy.firebase?.publicConfiguration ?? {}
          ),
          projectId:
            legacy.firebase?.projectId
            ?? initial.firebase.projectId
        },
        authenticationCredentialConfigured:
          legacy.firebase?.authenticationCredentialConfigured
          ?? legacy.firebaseAuthenticationConfigured
          ?? initial.firebase.authenticationCredentialConfigured,
        messagingCredentialConfigured:
          legacy.firebase?.messagingCredentialConfigured
          ?? legacy.firebaseMessagingConfigured
          ?? initial.firebase.messagingCredentialConfigured
      },
      updatedAt: legacy.updatedAt ?? initial.updatedAt
    };
  }

  private static normalizeTlsConfiguration(
    existing: OperatorTlsConfigurationDto | null | undefined,
    initial: OperatorTlsConfigurationDto | null | undefined
  ): OperatorTlsConfigurationDto {
    const fallback = initial ?? this.defaultTlsConfiguration();
    if (!existing) {
      return structuredClone(fallback);
    }
    return {
      capability: 'AVAILABLE',
      unavailableReason: null,
      enabled: existing.enabled === true,
      mode: existing.mode === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC',
      domain: `${existing.domain ?? ''}`.trim().toLowerCase(),
      contactEmail: `${existing.contactEmail ?? ''}`.trim().toLowerCase(),
      autoRenew: existing.mode !== 'MANUAL' && existing.autoRenew !== false,
      certificateConfigured: existing.certificateConfigured === true,
      certificateIssuer: `${existing.certificateIssuer ?? ''}`.trim() || null,
      certificateExpiresAt:
        `${existing.certificateExpiresAt ?? ''}`.trim() || null,
      updatedAt: `${existing.updatedAt ?? ''}`.trim() || null
    };
  }

  private static defaultTlsConfiguration(): OperatorTlsConfigurationDto {
    return {
      capability: 'AVAILABLE',
      unavailableReason: null,
      enabled: false,
      mode: 'AUTOMATIC',
      domain: '',
      contactEmail: '',
      autoRenew: true,
      certificateConfigured: false,
      certificateIssuer: null,
      certificateExpiresAt: null,
      updatedAt: null
    };
  }

  private static normalizeClaimStatus(
    existing: OperatorClaimStatusDto | null | undefined,
    initial: OperatorClaimStatusDto
  ): OperatorClaimStatusDto {
    if (!existing) {
      return structuredClone(initial);
    }
    return {
      ...structuredClone(initial),
      ...structuredClone(existing),
      verificationCapability: existing.verificationCapability ?? 'AVAILABLE',
      verificationUnavailableReason: existing.verificationUnavailableReason ?? null,
      verificationStatus: existing.verificationStatus
        ?? (existing.claimed ? 'VERIFIED' : 'NOT_SUBMITTED'),
      verificationSubmittedAt: existing.verificationSubmittedAt
        ?? existing.claimedAt
        ?? null,
      legalName: existing.legalName ?? existing.claimantName ?? null,
      eligibilityStatus: this.claimEligibilityStatus(existing)
    };
  }

  static toInspectionDto(record: OperatorRegistryStateRecord): OperatorRegistryInspectionDto | null {
    const draft = record.status.draftInspection;
    const inspectionToken = record.inspectionToken?.trim() ?? '';
    if (!draft || !inspectionToken) {
      return null;
    }
    return {
      inspectionToken,
      expiresAt: draft.expiresAt,
      baseUrl: draft.baseUrl,
      simulation: true,
      registryIdentity: {
        identityEndpoint: `${draft.baseUrl.replace(/\/+$/, '')}/v1/registry/identity`,
        protocolVersion: '1',
        registryScope: draft.registryScope
      }
    };
  }

  static toLeaderboardPage(
    record: OperatorRegistryStateRecord,
    query: ListQuery
  ): OperatorLeaderboardPageDto {
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 20)));
    const cursorOffset = this.cursorOffset(query.cursor);
    const ordered = this.recalculateLeaderboard(
      this.withCurrentClaimVerification(
        record.leaderboard,
        record.claimStatus
      )
    );
    const items = ordered.slice(cursorOffset, cursorOffset + pageSize);
    const nextOffset = cursorOffset + items.length;
    return {
      items: structuredClone(items),
      total: ordered.length,
      nextCursor: nextOffset < ordered.length ? `operator:${nextOffset}` : null,
      context: {
        snapshotBoundary: null,
        groupSummaries: (['FOUNDER', 'CLAIMED', 'UNCLAIMED'] as const).map(group => {
          const groupItems = ordered.filter(item => item.group === group);
          return {
            group,
            itemCount: groupItems.length,
            verifiedWeight: groupItems.reduce(
              (total, item) => total + Math.max(0, item.verifiedWeight),
              0
            ),
            sharePercent: groupItems.reduce(
              (total, item) => total + Math.max(0, item.sharePercent),
              0
            )
          };
        })
      }
    };
  }

  static toLeaderboardDeploymentPage(
    record: OperatorRegistryStateRecord,
    groupId: string,
    query: ListQuery
  ): OperatorLeaderboardDeploymentPageDto {
    const normalizedGroupId = groupId.trim();
    const pageSize = Math.max(
      1,
      Math.min(100, Math.trunc(Number(query.pageSize) || 20))
    );
    const groupIdByNodeId = new Map(
      record.groupLinks.map(link => [link.nodeId, link.operatorGroupId])
    );
    const deployments = record.ledger
      .filter(entry => {
        const nodeId = entry.nodeId?.trim() ?? '';
        return entry.active !== false
          && entry.claimed
          && !entry.founder
          && Boolean(nodeId)
          && (
            groupIdByNodeId.get(nodeId)
              ?? `isolated:${nodeId}`
          ) === normalizedGroupId;
      })
      .sort((left, right) =>
        Math.max(0, Number(right.verifiedWeight) || 0)
          - Math.max(0, Number(left.verifiedWeight) || 0)
        || `${left.nodeId ?? left.id}`.localeCompare(
          `${right.nodeId ?? right.id}`
        )
      );
    const groupEntry = this.recalculateLeaderboard(
      this.withCurrentClaimVerification(
        record.leaderboard,
        record.claimStatus
      )
    ).find(entry =>
      entry.group === 'CLAIMED'
      && entry.operatorGroupId === normalizedGroupId
    );
    const eligibleGroupWeight = deployments.reduce(
      (total, entry) =>
        total + (
          this.ledgerEligibilityStatus(entry) === 'ACTIVE'
            ? Math.max(0, Number(entry.verifiedWeight) || 0)
            : 0
        ),
      0
    );
    const groupSharePercent = Math.max(
      0,
      Number(groupEntry?.sharePercent) || 0
    );
    const explicitOwnerNodeId =
      record.claimIdentity.operatorGroupId === normalizedGroupId
        ? record.claimIdentity.nodeId.trim()
        : '';
    const ownerNodeId = deployments.some(
      entry => entry.nodeId === explicitOwnerNodeId
    )
      ? explicitOwnerNodeId
      : deployments[0]?.nodeId?.trim() ?? '';
    const claimState =
      this.leaderboardDeploymentClaimState(record, normalizedGroupId);
    const rows: OperatorLeaderboardDeploymentDto[] = deployments.map(entry => {
      const deploymentId = entry.nodeId?.trim() || entry.id.trim();
      const verifiedWeight = Math.max(
        0,
        Number(entry.verifiedWeight) || 0
      );
      const eligibilityStatus = this.ledgerEligibilityStatus(entry);
      return {
        deploymentId,
        groupId: normalizedGroupId,
        claimState,
        eligibilityStatus,
        membershipState: deploymentId === ownerNodeId ? 'owner' : 'linked',
        verifiedWeight,
        sharePercent:
          eligibilityStatus === 'ACTIVE' && eligibleGroupWeight > 0
          ? groupSharePercent * verifiedWeight / eligibleGroupWeight
          : 0
      };
    });
    const cursorOffset = this.deploymentCursorOffset(
      normalizedGroupId,
      query.cursor
    );
    const items = rows.slice(cursorOffset, cursorOffset + pageSize);
    const nextOffset = cursorOffset + items.length;
    return {
      items: structuredClone(items),
      total: rows.length,
      nextCursor: nextOffset < rows.length
        ? `operator-deployments:${
            encodeURIComponent(normalizedGroupId)
          }:${nextOffset}`
        : null
    };
  }

  static recalculateLeaderboard(
    entries: readonly OperatorLeaderboardEntryDto[]
  ): OperatorLeaderboardEntryDto[] {
    const cloned = structuredClone(entries);
    const founderUnits = cloned
      .filter(item => item.group === 'FOUNDER')
      .reduce((total, item) => total + Math.max(0, Number(item.verifiedWeight) || 0), 0);
    const deploymentWeight = cloned
      .filter(item => item.group !== 'FOUNDER')
      .reduce((total, item) => total + Math.max(0, Number(item.verifiedWeight) || 0), 0);
    const claimedWeight = cloned
      .filter(item =>
        item.group === 'CLAIMED'
        && (
          item.claimVerificationStatus === 'PENDING_REVIEW'
          || item.eligibilityStatus === 'ACTIVE'
          || item.eligibilityStatus === 'PARTIALLY_SUSPENDED'
        )
        && item.claimVerificationStatus !== 'REJECTED'
      )
      .reduce(
        (total, item) =>
          total + this.displayLocalWeight(item),
        0
      );
    const totalUnits = founderUnits + deploymentWeight;
    const founderShare = totalUnits > 0
      ? Math.max(10, (founderUnits / totalUnits) * 100)
      : 100;
    const operatorPool = Math.max(0, 100 - founderShare);

    return cloned
      .map(item => {
        const weight = Math.max(0, Number(item.verifiedWeight) || 0);
        const claimedShareEligible = item.group === 'CLAIMED'
          && (
            item.claimVerificationStatus === 'PENDING_REVIEW'
            || item.eligibilityStatus === 'ACTIVE'
            || item.eligibilityStatus === 'PARTIALLY_SUSPENDED'
          )
          && item.claimVerificationStatus !== 'REJECTED';
        const sharePercent = item.group === 'FOUNDER'
          ? founderUnits > 0
            ? founderShare * weight / founderUnits
            : 0
          : claimedShareEligible && claimedWeight > 0
            ? operatorPool * this.displayLocalWeight(item) / claimedWeight
            : 0;
        return {
          ...item,
          verifiedWeight: weight,
          sharePercent
        };
      })
      .sort((left, right) =>
        this.GROUP_ORDER[left.group] - this.GROUP_ORDER[right.group]
        || right.sharePercent - left.sharePercent
        || right.verifiedWeight - left.verifiedWeight
        || left.label.localeCompare(right.label)
      );
  }

  static withCurrentClaimVerification(
    entries: readonly OperatorLeaderboardEntryDto[],
    claimStatus: OperatorClaimStatusDto
  ): OperatorLeaderboardEntryDto[] {
    const operatorGroupId = claimStatus.operatorGroupId?.trim() ?? '';
    if (
      !operatorGroupId
      || claimStatus.verificationStatus !== 'PENDING_REVIEW'
    ) {
      return Array.from(entries, entry => structuredClone(entry));
    }
    return entries.map(entry =>
      entry.group === 'CLAIMED'
      && entry.operatorGroupId === operatorGroupId
        ? {
            ...structuredClone(entry),
            claimVerificationStatus: 'PENDING_REVIEW'
          }
        : structuredClone(entry)
    );
  }

  static deriveLeaderboard(
    ledger: readonly OperatorLedgerNodeRecord[],
    groupLinks: readonly OperatorNodeGroupLinkRecord[]
  ): OperatorLeaderboardEntryDto[] {
    const groupIdByNodeId = new Map(
      groupLinks.map(link => [link.nodeId, link.operatorGroupId])
    );
    const rows: OperatorLeaderboardEntryDto[] = [];
    const claimedGroups = new Map<string, OperatorLedgerNodeRecord[]>();

    for (const entry of ledger) {
      if (entry.active === false) {
        continue;
      }
      if (entry.founder || !entry.claimed || !entry.nodeId) {
        rows.push({
          id: entry.id,
          nodeId: entry.nodeId,
          label: entry.label,
          group: entry.founder ? 'FOUNDER' : 'UNCLAIMED',
          verifiedWeight: entry.verifiedWeight,
          sharePercent: 0,
          claimed: entry.claimed,
          claimantUserId: entry.claimantUserId,
          claimantName: entry.claimantName,
          claimantAvatarUrl: entry.claimantAvatarUrl,
          operatorGroupId: null,
          deploymentCount: 1,
          eligibilityStatus: entry.founder ? 'ACTIVE' : 'INACTIVE'
        });
        continue;
      }
      const operatorGroupId = groupIdByNodeId.get(entry.nodeId)
        ?? `isolated:${entry.nodeId}`;
      const groupEntries = claimedGroups.get(operatorGroupId) ?? [];
      groupEntries.push(entry);
      claimedGroups.set(operatorGroupId, groupEntries);
    }

    for (const [operatorGroupId, entries] of claimedGroups) {
      const primary = entries[0]!;
      rows.push({
        id: `claimed-group:${operatorGroupId}`,
        nodeId: entries.length === 1 ? primary.nodeId : null,
        label: primary.claimantName || primary.label,
        group: 'CLAIMED',
        verifiedWeight: entries.reduce(
          (total, entry) => total + Math.max(0, entry.verifiedWeight),
          0
        ),
        eligibleWeight: entries.reduce(
          (total, entry) =>
            total + (
              this.ledgerEligibilityStatus(entry) === 'ACTIVE'
                ? Math.max(0, entry.verifiedWeight)
                : 0
            ),
          0
        ),
        sharePercent: 0,
        claimed: true,
        claimantUserId: primary.claimantUserId,
        claimantName: primary.claimantName,
        claimantAvatarUrl: primary.claimantAvatarUrl,
        operatorGroupId,
        deploymentCount: entries.length,
        eligibilityStatus: this.groupEligibilityStatus(entries)
      });
    }

    return this.recalculateLeaderboard(rows);
  }

  private static cursorOffset(cursor: string | null | undefined): number {
    const match = /^operator:(\d+)$/.exec(`${cursor ?? ''}`.trim());
    return match ? Math.max(0, Number(match[1]) || 0) : 0;
  }

  private static deploymentCursorOffset(
    groupId: string,
    cursor: string | null | undefined
  ): number {
    const prefix = `operator-deployments:${encodeURIComponent(groupId)}:`;
    const value = `${cursor ?? ''}`.trim();
    if (!value.startsWith(prefix)) {
      return 0;
    }
    const offset = value.slice(prefix.length);
    return /^\d+$/.test(offset)
      ? Math.max(0, Number(offset) || 0)
      : 0;
  }

  private static leaderboardDeploymentClaimState(
    record: OperatorRegistryStateRecord,
    groupId: string
  ): OperatorLeaderboardDeploymentClaimState {
    if (record.claimStatus.operatorGroupId?.trim() !== groupId) {
      return 'claimed';
    }
    switch (record.claimStatus.verificationStatus) {
      case 'PENDING_REVIEW':
        return 'pending-review';
      case 'APPROVED':
      case 'VERIFIED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'WITHDRAWN':
        return 'withdrawn';
      default:
        return 'claimed';
    }
  }

  private static legacyLedger(
    leaderboard: readonly OperatorLeaderboardEntryDto[],
    fallback: readonly OperatorLedgerNodeRecord[]
  ): OperatorLedgerNodeRecord[] {
    const measuredAt = fallback[0]?.measuredAt ?? new Date(0).toISOString();
    const fallbackEligibilityById = new Map(
      fallback.map(entry => [entry.id, entry.eligibilityStatus])
    );
    return leaderboard.map(entry => ({
      id: entry.id,
      nodeId: entry.nodeId,
      label: entry.label,
      active: true,
      founder: entry.group === 'FOUNDER',
      verifiedWeight: entry.verifiedWeight,
      claimed: entry.claimed,
      eligibilityStatus: entry.group === 'FOUNDER'
        ? 'ACTIVE'
        : entry.group === 'UNCLAIMED' || !entry.claimed
          ? 'INACTIVE'
          : this.deploymentEligibilityStatus(
            entry.eligibilityStatus,
            fallbackEligibilityById.get(entry.id)
          ),
      claimantUserId: entry.claimantUserId ?? null,
      claimantName: entry.claimantName ?? null,
      claimantAvatarUrl: entry.claimantAvatarUrl ?? null,
      measuredAt,
      claimedAt: entry.claimed ? measuredAt : null
    }));
  }

  private static normalizeLedgerEligibility(
    ledger: readonly OperatorLedgerNodeRecord[],
    seedFallback: readonly OperatorLedgerNodeRecord[] = []
  ): OperatorLedgerNodeRecord[] {
    const fallbackById = new Map(
      seedFallback.map(entry => [entry.id, entry.eligibilityStatus])
    );
    return ledger.map(entry => ({
      ...entry,
      eligibilityStatus: this.ledgerEligibilityStatus({
        ...entry,
        eligibilityStatus:
          entry.eligibilityStatus
          ?? fallbackById.get(entry.id)
          ?? 'INACTIVE'
      })
    }));
  }

  private static ledgerEligibilityStatus(
    entry: OperatorLedgerNodeRecord
  ): OperatorLedgerNodeRecord['eligibilityStatus'] {
    if (entry.founder) {
      return 'ACTIVE';
    }
    if (entry.active === false || !entry.claimed) {
      return 'INACTIVE';
    }
    switch (entry.eligibilityStatus) {
      case 'ACTIVE':
      case 'SUSPENDED':
      case 'INACTIVE':
        return entry.eligibilityStatus;
      default:
        return 'INACTIVE';
    }
  }

  private static deploymentEligibilityStatus(
    value: OperatorLeaderboardEntryDto['eligibilityStatus'] | null | undefined,
    fallback: OperatorDeploymentEligibilityStatus | undefined
  ): OperatorDeploymentEligibilityStatus {
    switch (value) {
      case 'ACTIVE':
      case 'SUSPENDED':
      case 'INACTIVE':
        return value;
      case 'PARTIALLY_SUSPENDED':
        /*
         * PARTIALLY_SUSPENDED is a group aggregate, never a deployment
         * state. Preserve an available per-deployment fallback; otherwise
         * migrate conservatively without granting eligible weight.
         */
        return fallback ?? 'SUSPENDED';
      default:
        return fallback ?? 'INACTIVE';
    }
  }

  private static groupEligibilityStatus(
    entries: readonly OperatorLedgerNodeRecord[]
  ): OperatorLeaderboardEntryDto['eligibilityStatus'] {
    const active = entries.filter(
      entry => this.ledgerEligibilityStatus(entry) === 'ACTIVE'
    ).length;
    const suspended = entries.filter(
      entry => this.ledgerEligibilityStatus(entry) === 'SUSPENDED'
    ).length;
    if (active > 0 && suspended > 0) {
      return 'PARTIALLY_SUSPENDED';
    }
    if (active > 0) {
      return 'ACTIVE';
    }
    if (suspended > 0) {
      return 'SUSPENDED';
    }
    return 'INACTIVE';
  }

  private static eligibleLocalWeight(
    entry: OperatorLeaderboardEntryDto
  ): number {
    if (entry.eligibilityStatus === 'ACTIVE') {
      return Math.max(0, Number(entry.verifiedWeight) || 0);
    }
    if (entry.eligibilityStatus !== 'PARTIALLY_SUSPENDED') {
      return 0;
    }
    return Math.max(
      0,
      Math.min(
        Number(entry.verifiedWeight) || 0,
        Number(entry.eligibleWeight) || 0
      )
    );
  }

  private static displayLocalWeight(
    entry: OperatorLeaderboardEntryDto
  ): number {
    if (entry.claimVerificationStatus === 'PENDING_REVIEW') {
      return Math.max(0, Number(entry.verifiedWeight) || 0);
    }
    return this.eligibleLocalWeight(entry);
  }

  private static claimEligibilityStatus(
    status: OperatorClaimStatusDto
  ): OperatorClaimStatusDto['eligibilityStatus'] {
    switch (status.eligibilityStatus) {
      case 'ACTIVE':
      case 'SUSPENDED':
      case 'INACTIVE':
        return status.eligibilityStatus;
      default:
        return 'INACTIVE';
    }
  }
}

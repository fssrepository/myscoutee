import type { ListQuery } from '../../../contracts/list.interface';
import { OperatorConfigurationMapper } from '../../../base/mappers/operator-configuration.mapper';
import type {
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorDeploymentUpdateDto,
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardGroup,
  OperatorLeaderboardPageDto,
  OperatorRevenueDto,
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
  revenue: OperatorRevenueDto;
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
      revenue: structuredClone(extras.revenue),
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
    const ledger = existing.ledger?.length
      ? structuredClone(existing.ledger)
      : existing.leaderboard?.length
        ? this.legacyLedger(existing.leaderboard, initialRecord.ledger)
        : structuredClone(initialRecord.ledger);
    const groupLinks = existing.groupLinks?.length
      ? structuredClone(existing.groupLinks)
      : structuredClone(initialRecord.groupLinks);
    const refreshSeedOwnedData =
      `${existing.seedVersion ?? ''}`.trim() !== initialRecord.seedVersion;
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
        refreshSeedOwnedData
      ),
      revenue: structuredClone(
        !refreshSeedOwnedData && existing.revenue
          ? existing.revenue
          : initialRecord.revenue
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
    refreshSeedOwnedData: boolean
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
        logoCharacterIndex: branding.logoCharacterIndex === undefined
          ? initial.branding.logoCharacterIndex
          : branding.logoCharacterIndex,
        themePreset:
          branding.themePreset
          ?? (branding.theme === 'DEFAULT' ? 'AURORA' : initial.branding.themePreset),
        revision: branding.revision ?? initial.branding.revision
      },
      payment: {
        availableProviders,
        providerId,
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
      legalName: existing.legalName ?? existing.claimantName ?? null
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
        && item.claimVerificationStatus !== 'PENDING_REVIEW'
      )
      .reduce((total, item) => total + Math.max(0, Number(item.verifiedWeight) || 0), 0);
    const totalUnits = founderUnits + deploymentWeight;
    const founderShare = totalUnits > 0
      ? Math.max(10, (founderUnits / totalUnits) * 100)
      : 100;
    const operatorPool = Math.max(0, 100 - founderShare);

    return cloned
      .map(item => {
        const weight = Math.max(0, Number(item.verifiedWeight) || 0);
        const claimedShareEligible = item.group === 'CLAIMED'
          && item.claimVerificationStatus !== 'PENDING_REVIEW';
        const sharePercent = item.group === 'FOUNDER'
          ? founderUnits > 0
            ? founderShare * weight / founderUnits
            : 0
          : claimedShareEligible && claimedWeight > 0
            ? operatorPool * weight / claimedWeight
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
          deploymentCount: 1
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
        sharePercent: 0,
        claimed: true,
        claimantUserId: primary.claimantUserId,
        claimantName: primary.claimantName,
        claimantAvatarUrl: primary.claimantAvatarUrl,
        operatorGroupId,
        deploymentCount: entries.length
      });
    }

    return this.recalculateLeaderboard(rows);
  }

  private static cursorOffset(cursor: string | null | undefined): number {
    const match = /^operator:(\d+)$/.exec(`${cursor ?? ''}`.trim());
    return match ? Math.max(0, Number(match[1]) || 0) : 0;
  }

  private static legacyLedger(
    leaderboard: readonly OperatorLeaderboardEntryDto[],
    fallback: readonly OperatorLedgerNodeRecord[]
  ): OperatorLedgerNodeRecord[] {
    const measuredAt = fallback[0]?.measuredAt ?? new Date(0).toISOString();
    return leaderboard.map(entry => ({
      id: entry.id,
      nodeId: entry.nodeId,
      label: entry.label,
      active: true,
      founder: entry.group === 'FOUNDER',
      verifiedWeight: entry.verifiedWeight,
      claimed: entry.claimed,
      claimantUserId: entry.claimantUserId ?? null,
      claimantName: entry.claimantName ?? null,
      claimantAvatarUrl: entry.claimantAvatarUrl ?? null,
      measuredAt,
      claimedAt: entry.claimed ? measuredAt : null
    }));
  }
}

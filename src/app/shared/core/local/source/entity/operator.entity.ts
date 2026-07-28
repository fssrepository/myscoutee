import type {
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorDeploymentUpdateDto,
  OperatorLeaderboardEntryDto,
  OperatorRevenueDto,
  OperatorRegistryStatusDto
} from '../../../contracts/operator.interface';

export interface OperatorGroupingTokenRecord {
  token: string;
  expiresAt: string;
  redeemedAt: string | null;
  operatorGroupId: string;
}

export interface OperatorNodeGroupLinkRecord {
  nodeId: string;
  operatorGroupId: string;
  linkedAt: string;
}

export interface OperatorClaimIdentityRecord {
  nodeId: string;
  claimantUserId: string;
  claimantName: string;
  claimantAvatarUrl: string | null;
  operatorGroupId: string;
}

export interface OperatorLedgerNodeRecord {
  id: string;
  nodeId: string | null;
  label: string;
  founder: boolean;
  verifiedWeight: number;
  claimed: boolean;
  claimantUserId: string | null;
  claimantName: string | null;
  claimantAvatarUrl: string | null;
  measuredAt: string;
  claimedAt: string | null;
}

export interface OperatorRegistryAuditEventRecord {
  id: string;
  kind:
    | 'SEED'
    | 'INSPECT'
    | 'CONFIGURE'
    | 'REGISTER'
    | 'DISCONNECT'
    | 'CLAIM'
    | 'GROUP_TOKEN'
    | 'GROUP_LINK'
    | 'UPDATE'
    | 'CONFIGURATION_SAVE'
    | 'CONFIGURATION_TEST'
    | 'COMMUNITY';
  at: string;
  nodeId: string | null;
  detail: string;
}

export interface OperatorRegistryStateRecord {
  seedVersion: string;
  status: OperatorRegistryStatusDto;
  inspectionToken: string | null;
  ledger: OperatorLedgerNodeRecord[];
  groupLinks: OperatorNodeGroupLinkRecord[];
  claimIdentity: OperatorClaimIdentityRecord;
  auditHistory: OperatorRegistryAuditEventRecord[];
  leaderboard: OperatorLeaderboardEntryDto[];
  claimStatus: OperatorClaimStatusDto;
  claimVerificationRequest: OperatorClaimRequestDto | null;
  groupingTokens: OperatorGroupingTokenRecord[];
  deploymentUpdate: OperatorDeploymentUpdateDto;
  configuration: OperatorConfigurationDto;
  revenue: OperatorRevenueDto;
  community: OperatorCommunityStatusDto;
}

export interface OperatorRegistrySeedMemory {
  readonly registryRecord: OperatorRegistryStateRecord | null;
}

import type { ListQuery, PageResult } from './list.interface';
import type {
  DeploymentBrandingDto,
  DeploymentThemePreset
} from './deployment-configuration.interface';

export type OperatorRegistryMode = 'DEMO' | 'REAL';

export type OperatorRegistryLifecycle =
  | 'UNCONFIGURED'
  | 'INSPECTED'
  | 'CONFIGURED'
  | 'PENDING'
  | 'REGISTERING'
  | 'REGISTERED'
  | 'ERROR'
  | 'DISABLED';

export type OperatorNodeIdentityState = 'MISSING' | 'READY' | 'INCOMPLETE' | 'SIMULATED';

export interface OperatorRegistryCandidateDefaultsDto {
  baseUrl: string | null;
  registryScope: string | null;
}

export interface OperatorRegistryOptionDto {
  id: string;
  label: string;
  baseUrl: string;
  description?: string | null;
  registryScope?: string | null;
  selected?: boolean;
}

export interface OperatorRegistryIdentityDto {
  identityEndpoint: string;
  protocolVersion: string;
  registryScope: string;
}

export interface OperatorRegistryDraftInspectionDto {
  baseUrl: string;
  registryScope: string;
  inspectedAt: string | null;
  expiresAt: string | null;
}

export interface OperatorRegistrySelectionDto {
  baseUrl: string;
  registryScope?: string | null;
  registryIdentity?: OperatorRegistryIdentityDto | null;
  confirmedAt: string | null;
}

export interface OperatorNodeIdentityDto {
  state: OperatorNodeIdentityState;
  initializedAt: string | null;
}

export interface OperatorRegistryEnrollmentDto {
  deploymentCode: string;
  installationTestBatchId: string;
  installationTestAcceptedAt: string | null;
  installationTestLedgerIndex: number | null;
  completedAt: string | null;
}

export interface OperatorRegistryAuditDto {
  createdAt: string | null;
  updatedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  disabledAt: string | null;
  updatedBy: string | null;
}

export interface OperatorRegistryErrorDto {
  code: string;
  message: string;
  at: string | null;
  retryable: boolean;
}

export interface OperatorRegistryStatusDto {
  mode: OperatorRegistryMode;
  lifecycle: OperatorRegistryLifecycle;
  enabled: boolean;
  simulation: boolean;
  candidateDefaults: OperatorRegistryCandidateDefaultsDto | null;
  registryOptions?: readonly OperatorRegistryOptionDto[];
  draftInspection: OperatorRegistryDraftInspectionDto | null;
  selection: OperatorRegistrySelectionDto | null;
  nodeIdentity: OperatorNodeIdentityDto;
  enrollment: OperatorRegistryEnrollmentDto | null;
  audit: OperatorRegistryAuditDto;
  lastError: OperatorRegistryErrorDto | null;
}

export interface OperatorRegistryInspectRequestDto {
  baseUrl: string;
  expectedScope?: string;
}

export interface OperatorRegistryInspectionDto {
  inspectionToken: string;
  expiresAt: string | null;
  baseUrl: string;
  simulation: boolean;
  registryIdentity: OperatorRegistryIdentityDto;
}

export interface OperatorRegistryConfirmRequestDto {
  inspectionToken: string;
}

export interface OperatorRegistryRegisterRequestDto {
  registryBaseUrl: string;
  expectedRegistryScope?: string;
}

export type OperatorLeaderboardGroup = 'FOUNDER' | 'CLAIMED' | 'UNCLAIMED';

export interface OperatorLeaderboardEntryDto {
  id: string;
  nodeId: string | null;
  label: string;
  group: OperatorLeaderboardGroup;
  verifiedWeight: number;
  sharePercent: number;
  claimed: boolean;
  claimantUserId?: string | null;
  claimantName?: string | null;
  claimantAvatarUrl?: string | null;
  operatorGroupId?: string | null;
  deploymentCount?: number;
}

export interface OperatorLeaderboardMutationDto {
  leaderboardEntry: OperatorLeaderboardEntryDto | null;
  removedLeaderboardEntryIds: readonly string[];
}

export interface OperatorRegistryMutationResultDto
  extends OperatorLeaderboardMutationDto {
  status: OperatorRegistryStatusDto;
  created: boolean;
}

export interface OperatorClaimOverviewDto {
  status: OperatorClaimStatusDto;
  submission: OperatorClaimRequestDto | null;
}

export interface OperatorClaimMutationResultDto
  extends OperatorLeaderboardMutationDto, OperatorClaimOverviewDto {
}

export interface OperatorLeaderboardGroupSummaryDto {
  group: OperatorLeaderboardGroup;
  itemCount: number;
  verifiedWeight: number;
  sharePercent: number;
}

export interface OperatorLeaderboardPageContextDto {
  groupSummaries: readonly OperatorLeaderboardGroupSummaryDto[];
}

export type OperatorLeaderboardPageDto = PageResult<
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardPageContextDto
>;

export type OperatorClaimVerificationCapability =
  | 'AVAILABLE'
  | 'BACKEND_UNAVAILABLE';

export type OperatorClaimVerificationStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface OperatorClaimStatusDto {
  claimed: boolean;
  claimedAt: string | null;
  claimantUserId: string | null;
  claimantName: string | null;
  claimantAvatarUrl: string | null;
  operatorGroupId: string | null;
  activeLinkId?: string | null;
  sharePercent: number;
  shareNumerator?: string | null;
  shareDenominator?: string | null;
  verificationCapability: OperatorClaimVerificationCapability;
  verificationUnavailableReason: string | null;
  verificationStatus: OperatorClaimVerificationStatus;
  verificationSubmittedAt: string | null;
  legalName: string | null;
}

export interface OperatorGroupingTokenDto {
  clientToken: string;
  expiresAt: string;
}

export interface OperatorClaimRequestDto {
  legalName: string;
  registrationNumber: string;
  jurisdiction: string;
  registeredAddress: string;
  website: string;
  verificationContactName: string;
  verificationContactRole: string;
  verificationContactEmail: string;
  authorityAttested: boolean;
}

export interface OperatorGroupLinkRequestDto {
  clientToken: string;
}

export type OperatorDeploymentUpdatePhase =
  | 'IDLE'
  | 'CHECKING'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'INSTALLING'
  | 'COMPLETED'
  | 'FAILED';

export interface OperatorDeploymentUpdateProgressDto {
  phase: OperatorDeploymentUpdatePhase;
  bytesDownloaded: number;
  bytesTotal: number;
  percent: number;
  message: string | null;
  updatedAt: string | null;
}

export type OperatorDeploymentUpdateProgressHandler = (
  progress: OperatorDeploymentUpdateProgressDto
) => void;

export interface OperatorDeploymentUpdateDto {
  currentVersion: string;
  availableVersion: string;
  updateAvailable: boolean;
  lastCheckedAt: string | null;
  lastUpdatedAt: string | null;
  progress: OperatorDeploymentUpdateProgressDto;
}

export type OperatorConfigurationTestKind = 'FIREBASE_AUTHENTICATION' | 'FIREBASE_MESSAGING';

export type OperatorConfigurationCapability = 'AVAILABLE' | 'BACKEND_UNAVAILABLE';

export type OperatorPaymentProviderPalette =
  | 'slate'
  | 'blue'
  | 'sky'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'mint'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'gold'
  | 'brown';

export interface OperatorPaymentProviderDto {
  id: string;
  label: string;
  logoUrl?: string | null;
  logoAlt?: string | null;
  palette?: OperatorPaymentProviderPalette | null;
}

export interface OperatorPaymentConfigurationDto {
  availableProviders: readonly OperatorPaymentProviderDto[];
  providerId: string | null;
  credentialConfigured: boolean;
  credentialMask: string | null;
}

export interface OperatorFirebaseConfigurationDto {
  projectId: string;
  authenticationCredentialConfigured: boolean;
  messagingCredentialConfigured: boolean;
}

export interface OperatorConfigurationDto {
  capability: OperatorConfigurationCapability;
  unavailableReason: string | null;
  branding: DeploymentBrandingDto;
  payment: OperatorPaymentConfigurationDto;
  firebase: OperatorFirebaseConfigurationDto;
  updatedAt: string | null;
}

export interface OperatorConfigurationSaveRequestDto {
  branding: {
    productName: string;
    homeLabel: string;
    logoUrl: string;
    logoCharacterIndex: number | null;
    themePreset: DeploymentThemePreset;
  };
  payment: {
    providerId: string | null;
    credential: string;
  };
  firebase: {
    projectId: string;
    authenticationCredential: string;
    messagingCredential: string;
  };
}

export interface OperatorConfigurationTestRequestDto {
  kind: OperatorConfigurationTestKind;
}

export interface OperatorConfigurationTestResultDto {
  kind: OperatorConfigurationTestKind;
  success: boolean;
  message: string;
  testedAt: string;
}

export type OperatorRevenueTone =
  | 'blue'
  | 'green'
  | 'gold'
  | 'red'
  | 'purple'
  | 'slate';

export interface OperatorRevenueAssetCategoryDto {
  key: string;
  labelKey: string;
  label?: string;
  icon?: string;
  tone?: OperatorRevenueTone;
  payableAssets: number;
  projectedMinor: number;
}

export interface OperatorRevenueTimelinePointDto {
  dateKey: string;
  label: string;
  payableEvents: number;
  payableAssets: number;
  projectedEventMinor: number;
  projectedAssetMinor: number;
  capturedPaymentMinor: number;
  refundedPaymentMinor: number;
  netPaymentMinor: number;
  commissionBasisMinor: number;
  estimatedCommissionMinor: number;
  paymentCount: number;
  payingUsers: number;
}

export interface OperatorRevenueCurrencyDto {
  currencyCode: string;
  fractionDigits: number;
  payableEvents: number;
  payableAssets: number;
  projectedEventMinor: number;
  projectedAssetMinor: number;
  capturedPaymentMinor: number;
  refundedPaymentMinor: number;
  netPaymentMinor: number;
  commissionBasisMinor: number;
  estimatedCommissionMinor: number;
  paymentCount: number;
  payingUsers: number;
  eventBuyers: number;
  assetBorrowers: number;
  assetCategories: readonly OperatorRevenueAssetCategoryDto[];
  timeline: readonly OperatorRevenueTimelinePointDto[];
}

export interface OperatorRevenueDto {
  generatedAtIso: string;
  rulesetVersion: string;
  commissionRateBasisPoints: number;
  currencies: readonly OperatorRevenueCurrencyDto[];
}

export type OperatorCommunityAvailability =
  | 'ONLINE'
  | 'AVAILABLE'
  | 'BUSY'
  | 'INVISIBLE';

export interface OperatorCommunityProviderDto {
  id: string;
  name: string;
  purpose: string;
  url: string;
  configured: boolean;
  available: boolean;
}

export type OperatorCommunityAnnouncementKind =
  | 'GENERAL'
  | 'UPDATE'
  | 'MAINTENANCE'
  | 'SECURITY';

export type OperatorCommunityAnnouncementSeverity =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'CRITICAL';

export type OperatorCommunityAnnouncementStatus =
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'WITHDRAWN';

export interface OperatorCommunityAnnouncementLinkDto {
  id: string;
  label: string;
  url: string;
  verified: boolean;
}

export interface OperatorCommunityAnnouncementUpdateDto {
  version: string;
  purpose: string;
  releaseNotes: readonly string[];
  artifact: {
    downloadUrl: string;
    downloadUrlVerified: boolean;
    sha256Digest: string;
    signature: string;
    sizeBytes: number;
    compatibility: string;
  };
}

export interface OperatorCommunityAnnouncementDto {
  id: string;
  kind: OperatorCommunityAnnouncementKind;
  severity: OperatorCommunityAnnouncementSeverity;
  status: OperatorCommunityAnnouncementStatus;
  unread: boolean;
  title: string;
  body: string;
  publishedAt: string;
  expiresAt: string | null;
  links: readonly OperatorCommunityAnnouncementLinkDto[];
  update?: OperatorCommunityAnnouncementUpdateDto | null;
}

export interface OperatorCommunityStatusDto {
  availability: OperatorCommunityAvailability;
  updatedAt: string | null;
  providers: readonly OperatorCommunityProviderDto[];
  announcements: readonly OperatorCommunityAnnouncementDto[];
}

export interface OperatorRegistryServiceContract {
  loadStatus(): Promise<OperatorRegistryStatusDto>;
  inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto>;
  confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto>;
  register(
    request: OperatorRegistryRegisterRequestDto
  ): Promise<OperatorRegistryMutationResultDto>;
  retry(): Promise<OperatorRegistryStatusDto>;
  disconnect(): Promise<OperatorRegistryMutationResultDto>;
  leaderboardPage(
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardPageDto>;
  loadClaimStatus(): Promise<OperatorClaimOverviewDto>;
  claimShare(
    request: OperatorClaimRequestDto
  ): Promise<OperatorClaimMutationResultDto>;
  issueGroupingToken(): Promise<OperatorGroupingTokenDto>;
  linkOperatorGroup(request: OperatorGroupLinkRequestDto): Promise<OperatorClaimStatusDto>;
  loadDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto>;
  applyDeploymentUpdate(
    onProgress?: OperatorDeploymentUpdateProgressHandler
  ): Promise<OperatorDeploymentUpdateDto>;
  loadConfiguration(): Promise<OperatorConfigurationDto>;
  saveConfiguration(
    request: OperatorConfigurationSaveRequestDto
  ): Promise<OperatorConfigurationDto>;
  testConfiguration(
    request: OperatorConfigurationTestRequestDto
  ): Promise<OperatorConfigurationTestResultDto>;
  loadRevenue(): Promise<OperatorRevenueDto>;
  loadCommunityStatus(): Promise<OperatorCommunityStatusDto>;
  setCommunityAvailability(
    availability: OperatorCommunityAvailability
  ): Promise<OperatorCommunityStatusDto>;
}

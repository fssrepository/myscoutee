import type { ListQuery, PageResult } from './list.interface';
import type {
  DeploymentBrandingDto,
  DeploymentPrivacyContactDto,
  DeploymentSocialLinkDto,
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

export type OperatorMeasurementSyncState =
  | 'DORMANT'
  | 'BLOCKED'
  | 'READY'
  | 'BUSY'
  | 'ERROR';

export interface OperatorMeasurementSyncDto {
  state: OperatorMeasurementSyncState;
  code: string | null;
  message: string | null;
  materialized: number;
  submitted: number;
  accepted: number;
  pending: number;
  blocked: number;
  synchronizedAt: string;
}

export type OperatorMeasurementReportStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'BLOCKED';

export interface OperatorMeasurementReportFilters {
  status?: OperatorMeasurementReportStatus;
  revision?: string;
}

export interface OperatorMeasurementReportDto {
  id: string;
  period: string;
  windowStart: string;
  windowEnd: string;
  revision: number;
  rulesetVersion: string;
  qualifiedMauCount: number;
  actionCount: number;
  status: OperatorMeasurementReportStatus;
  attemptCount: number;
  nextRetryAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  batchId: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type OperatorMeasurementReportPageDto =
  PageResult<OperatorMeasurementReportDto>;

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
  claimVerificationStatus?: OperatorClaimVerificationStatus | null;
}

export interface OperatorLeaderboardMutationDto {
  leaderboardEntry: OperatorLeaderboardEntryDto | null;
  leaderboardUpserts: readonly OperatorLeaderboardEntryDto[];
  removedLeaderboardEntryIds: readonly string[];
  leaderboardTotalDelta: number;
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

export type OperatorLeaderboardDeploymentClaimState =
  | 'claimed'
  | 'pending-review'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type OperatorLeaderboardDeploymentMembershipState =
  | 'owner'
  | 'linked';

export interface OperatorLeaderboardDeploymentDto {
  deploymentId: string;
  groupId: string;
  claimState: OperatorLeaderboardDeploymentClaimState;
  membershipState: OperatorLeaderboardDeploymentMembershipState;
  verifiedWeight: number;
  sharePercent: number;
}

export type OperatorLeaderboardDeploymentPageDto =
  PageResult<OperatorLeaderboardDeploymentDto>;

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
  publicConfiguration: OperatorFirebasePublicConfigurationDto;
  active: boolean;
  readyToActivate: boolean;
  authenticationTestedAt: string | null;
  messagingTestedAt: string | null;
  activatedAt: string | null;
}

export interface OperatorFirebasePublicConfigurationDto {
  revision: number;
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string | null;
  vapidKey: string | null;
}

export interface OperatorConfigurationDto {
  capability: OperatorConfigurationCapability;
  unavailableReason: string | null;
  adminEmails: readonly string[];
  privacyContact: DeploymentPrivacyContactDto;
  socialLinks: readonly DeploymentSocialLinkDto[];
  branding: DeploymentBrandingDto;
  payment: OperatorPaymentConfigurationDto;
  firebase: OperatorFirebaseConfigurationDto;
  updatedAt: string | null;
}

export interface OperatorConfigurationSaveRequestDto {
  adminEmails: readonly string[];
  privacyContact: {
    dataControllerName: string;
    privacyContactEmail: string;
  };
  socialLinks: readonly DeploymentSocialLinkDto[];
  branding: {
    productName: string;
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
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
    vapidKey: string;
    authenticationCredential: string;
    messagingCredential: string;
  };
}

export interface OperatorConfigurationTestRequestDto {
  kind: OperatorConfigurationTestKind;
  destinationToken?: string;
  browserReadinessToken?: string;
  browserConfigurationRevision?: number;
  browserAppId?: string;
}

export interface OperatorConfigurationTestResultDto {
  kind: OperatorConfigurationTestKind;
  success: boolean;
  message: string;
  testedAt: string;
  firebase: OperatorFirebaseConfigurationDto | null;
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

export type OperatorRevenueSyncState =
  | 'SYNCHRONIZED'
  | 'PENDING'
  | 'BLOCKED'
  | 'BUSY'
  | 'DORMANT'
  | 'ERROR';

export interface OperatorRevenueSyncDto {
  state: OperatorRevenueSyncState;
  code: string | null;
  message: string | null;
  materialized: number;
  submitted: number;
  accepted: number;
  pending: number;
  blocked: number;
  synchronizedAtIso: string;
}

export type OperatorRevenueReportStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export interface OperatorRevenueReportFilters {
  status?: OperatorRevenueReportStatus;
  revision?: string;
}

export interface OperatorRevenueReportCurrencyDto {
  currencyCode: string;
  fractionDigits: number;
  capturedMinor: number;
  refundedMinor: number;
  netMinor: number;
  commissionBasisMinor: number;
  estimatedCommissionMinor: number;
  paymentCount: number;
}

export interface OperatorRevenueReportDto {
  id: string;
  period: string;
  revision: number;
  supersedesBatchId: string | null;
  rulesetVersion: string;
  commissionRateBasisPoints: number;
  currencies: readonly OperatorRevenueReportCurrencyDto[];
  payloadHash: string;
  status: OperatorRevenueReportStatus;
  attemptCount: number;
  nextRetryAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  failureRetryable: boolean | null;
  failedAt: string | null;
  acceptedBatchId: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type OperatorRevenueReportPageDto = PageResult<OperatorRevenueReportDto>;

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
  synchronizeMeasurements(): Promise<OperatorMeasurementSyncDto>;
  measurementReportPage(
    query: ListQuery<OperatorMeasurementReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorMeasurementReportPageDto>;
  requeueMeasurementReport(
    reportId: string
  ): Promise<OperatorMeasurementReportDto>;
  leaderboardPage(
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardPageDto>;
  leaderboardDeploymentPage(
    groupId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardDeploymentPageDto>;
  loadClaimStatus(): Promise<OperatorClaimOverviewDto>;
  claimShare(
    request: OperatorClaimRequestDto
  ): Promise<OperatorClaimMutationResultDto>;
  issueGroupingToken(): Promise<OperatorGroupingTokenDto>;
  linkOperatorGroup(
    request: OperatorGroupLinkRequestDto
  ): Promise<OperatorClaimMutationResultDto>;
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
  activateFirebase(): Promise<OperatorConfigurationDto>;
  loadRevenue(): Promise<OperatorRevenueDto>;
  synchronizeRevenue(): Promise<OperatorRevenueSyncDto>;
  revenueReportPage(
    query: ListQuery<OperatorRevenueReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorRevenueReportPageDto>;
  requeueRevenueReport(reportId: string): Promise<OperatorRevenueReportDto>;
  loadCommunityStatus(): Promise<OperatorCommunityStatusDto>;
  setCommunityAvailability(
    availability: OperatorCommunityAvailability
  ): Promise<OperatorCommunityStatusDto>;
}

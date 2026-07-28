export type OperatorRegistryMode = 'DEMO' | 'REAL';

export type OperatorRegistryLifecycle =
  | 'UNCONFIGURED'
  | 'INSPECTED'
  | 'PENDING'
  | 'REGISTERED'
  | 'ERROR'
  | 'DISABLED';

export type OperatorNodeIdentityState = 'MISSING' | 'READY' | 'INCOMPLETE' | 'SIMULATED';

export interface OperatorRegistryCandidateDefaultsDto {
  baseUrl: string;
  registryScope: string;
}

export interface OperatorRegistryIdentityDto {
  identityEndpoint: string;
  protocolVersion: string;
  registryScope: string;
  registryKeyId: string;
  registryPublicKeyFingerprint: string;
}

export interface OperatorRegistryDraftInspectionDto {
  baseUrl: string;
  registryScope: string;
  registryKeyId: string;
  registryPublicKeyFingerprint: string;
  inspectedAt: string | null;
  expiresAt: string | null;
}

export interface OperatorRegistrySelectionDto {
  baseUrl: string;
  registryIdentity: OperatorRegistryIdentityDto;
  confirmedAt: string | null;
}

export interface OperatorNodeIdentityDto {
  state: OperatorNodeIdentityState;
  publicKeyFingerprint: string | null;
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
  candidateDefaults: OperatorRegistryCandidateDefaultsDto;
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

export interface OperatorRegistryServiceContract {
  loadStatus(): Promise<OperatorRegistryStatusDto>;
  inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto>;
  confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto>;
  retry(): Promise<OperatorRegistryStatusDto>;
  disconnect(): Promise<OperatorRegistryStatusDto>;
}

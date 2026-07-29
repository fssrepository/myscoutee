export type GlobalIdentityState =
  | 'UNAVAILABLE'
  | 'UNLINKED'
  | 'PENDING'
  | 'LINK'
  | 'CORRECT'
  | 'UNLINK'
  | 'ACTIVE';

export interface GlobalIdentityStatusDto {
  state: GlobalIdentityState;
  linked: boolean;
  consentVersion: string;
  keyVersion: number | null;
  suite: string;
  activeFromPeriod: string | null;
  inactiveFromPeriod: string | null;
  verifiedAt: string | null;
  rotationRequired: boolean | null;
  syncAvailable: boolean;
  updatedAt: string | null;
}

export interface GlobalIdentityConsentRequestDto {
  accepted: boolean;
}

export interface GlobalIdentityUnlinkRequestDto {
  confirmed: boolean;
}

export interface GlobalIdentityServiceContract {
  loadStatus(): Promise<GlobalIdentityStatusDto>;
  link(
    request: GlobalIdentityConsentRequestDto
  ): Promise<GlobalIdentityStatusDto>;
  rotate(): Promise<GlobalIdentityStatusDto>;
  unlink(
    request: GlobalIdentityUnlinkRequestDto
  ): Promise<GlobalIdentityStatusDto>;
}

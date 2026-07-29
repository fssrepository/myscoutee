import type {
  GlobalIdentityState,
  GlobalIdentityStatusDto
} from '../../contracts/global-identity.interface';

const GLOBAL_IDENTITY_STATES = new Set<GlobalIdentityState>([
  'UNAVAILABLE',
  'UNLINKED',
  'PENDING',
  'LINK',
  'CORRECT',
  'UNLINK',
  'ACTIVE'
]);

export class GlobalIdentityMapper {
  static toStatusDto(
    value: Partial<GlobalIdentityStatusDto> | null | undefined
  ): GlobalIdentityStatusDto {
    const state = this.state(value?.state);
    const keyVersion = Number(value?.keyVersion);
    return {
      state,
      linked: value?.linked === true && state !== 'UNAVAILABLE',
      consentVersion: this.text(value?.consentVersion),
      keyVersion: Number.isSafeInteger(keyVersion) && keyVersion > 0
        ? keyVersion
        : null,
      suite: this.text(value?.suite),
      activeFromPeriod: this.nullableText(value?.activeFromPeriod),
      inactiveFromPeriod: this.nullableText(value?.inactiveFromPeriod),
      verifiedAt: this.isoTimestamp(value?.verifiedAt),
      rotationRequired: typeof value?.rotationRequired === 'boolean'
        ? value.rotationRequired
        : null,
      syncAvailable: value?.syncAvailable === true,
      updatedAt: this.isoTimestamp(value?.updatedAt)
    };
  }

  static unavailableStatus(): GlobalIdentityStatusDto {
    return {
      state: 'UNAVAILABLE',
      linked: false,
      consentVersion: 'global-dedup-consent-v1',
      keyVersion: null,
      suite: 'P256-SHA256',
      activeFromPeriod: null,
      inactiveFromPeriod: null,
      verifiedAt: null,
      rotationRequired: null,
      syncAvailable: false,
      updatedAt: null
    };
  }

  private static state(value: unknown): GlobalIdentityState {
    const normalized = this.text(value).toUpperCase() as GlobalIdentityState;
    return GLOBAL_IDENTITY_STATES.has(normalized)
      ? normalized
      : 'UNAVAILABLE';
  }

  private static nullableText(value: unknown): string | null {
    return this.text(value) || null;
  }

  private static isoTimestamp(value: unknown): string | null {
    const normalized = this.text(value);
    return normalized && Number.isFinite(Date.parse(normalized))
      ? normalized
      : null;
  }

  private static text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}

import type {
  OperatorTlsConfigurationDto,
  OperatorTlsConfigurationUpdateDto
} from '../../../contracts/operator.interface';

export class LocalOperatorTlsMapper {
  static configuration(
    value: OperatorTlsConfigurationDto | null | undefined
  ): OperatorTlsConfigurationDto {
    return {
      capability: 'AVAILABLE',
      unavailableReason: null,
      enabled: value?.enabled === true,
      mode: value?.mode === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC',
      domain: `${value?.domain ?? ''}`.trim().toLowerCase(),
      contactEmail: `${value?.contactEmail ?? ''}`.trim().toLowerCase(),
      autoRenew: value?.mode !== 'MANUAL' && value?.autoRenew !== false,
      certificateConfigured: value?.certificateConfigured === true,
      certificateIssuer:
        `${value?.certificateIssuer ?? ''}`.trim() || null,
      certificateExpiresAt:
        `${value?.certificateExpiresAt ?? ''}`.trim() || null,
      updatedAt: `${value?.updatedAt ?? ''}`.trim() || null
    };
  }

  static updated(
    current: OperatorTlsConfigurationDto | null | undefined,
    request: OperatorTlsConfigurationUpdateDto,
    updatedAt: string
  ): OperatorTlsConfigurationDto {
    const mode = request.mode === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC';
    const enabled = request.enabled === true;
    const domain = request.domain.trim().toLowerCase();
    const reusableCertificate = current?.certificateConfigured === true
      && current.mode === mode
      && current.domain.trim().toLowerCase() === domain;
    return this.configuration({
      capability: 'AVAILABLE',
      unavailableReason: null,
      enabled,
      mode,
      domain,
      contactEmail: request.contactEmail,
      autoRenew: mode === 'AUTOMATIC' && request.autoRenew,
      certificateConfigured: enabled
        ? Boolean(
          request.certificate.trim() && request.privateKey.trim()
        ) || reusableCertificate || mode === 'AUTOMATIC'
        : current?.certificateConfigured === true,
      certificateIssuer: enabled
        ? mode === 'AUTOMATIC'
          ? 'Let’s Encrypt'
          : 'Operator supplied'
        : current?.certificateIssuer ?? null,
      certificateExpiresAt: enabled
        ? new Date(Date.parse(updatedAt) + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
        : current?.certificateExpiresAt ?? null,
      updatedAt
    });
  }
}

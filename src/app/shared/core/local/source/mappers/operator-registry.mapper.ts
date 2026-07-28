import type {
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../../contracts/operator.interface';
import type {
  OperatorRegistrySeedMemory,
  OperatorRegistryStateRecord
} from '../entity/operator.entity';

export class LocalOperatorRegistryMapper {
  static toStatusDto(record: OperatorRegistryStateRecord): OperatorRegistryStatusDto {
    return structuredClone(record.status);
  }

  static toRecord(
    status: OperatorRegistryStatusDto,
    inspectionToken: string | null = null
  ): OperatorRegistryStateRecord {
    return {
      status: structuredClone(status),
      inspectionToken: inspectionToken?.trim() || null
    };
  }

  static toSeedRecord(
    memory: OperatorRegistrySeedMemory,
    initialStatus: OperatorRegistryStatusDto
  ): OperatorRegistryStateRecord {
    return memory.registryRecord
      ? structuredClone(memory.registryRecord)
      : this.toRecord(initialStatus);
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
        registryScope: draft.registryScope,
        registryKeyId: draft.registryKeyId,
        registryPublicKeyFingerprint: draft.registryPublicKeyFingerprint
      }
    };
  }
}

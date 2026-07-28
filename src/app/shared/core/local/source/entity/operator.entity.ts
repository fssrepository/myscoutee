import type { OperatorRegistryStatusDto } from '../../../contracts/operator.interface';

export interface OperatorRegistryStateRecord {
  status: OperatorRegistryStatusDto;
  inspectionToken: string | null;
}

export interface OperatorRegistrySeedMemory {
  readonly registryRecord: OperatorRegistryStateRecord | null;
}

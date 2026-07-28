import type { OperatorRegistryStatusDto } from '../../../contracts/operator.interface';
import type { AppMemorySchema } from '../../common/memory.schema';
import { USERS_TABLE_NAME, type UserRecord } from '../../source/entity/user.entity';
import { LocalOperatorRegistryMapper } from '../../source/mappers/operator-registry.mapper';
import type {
  OperatorRegistrySeedMemory,
  OperatorRegistryStateRecord
} from '../../source/entity/operator.entity';

export interface OperatorBootstrapSeedMemory extends OperatorRegistrySeedMemory {
  readonly appState: AppMemorySchema;
}

export interface OperatorBootstrapSeedResult {
  readonly appState: AppMemorySchema;
  readonly registryRecord: OperatorRegistryStateRecord;
  readonly registryChanged: boolean;
  readonly usersChanged: boolean;
}

export class SeedOperatorRegistryBuilder {
  static readonly SAMPLE_BASE_URL = 'https://sample-registry.myscoutee.invalid';
  static readonly SAMPLE_SCOPE = 'demo:sample';
  static readonly SAMPLE_REGISTRY_FINGERPRINT =
    '6f72f63c45731d3ba81018bbf747065b27f2b31f2cb24f6884da5b4fb54f67c1';
  static readonly SAMPLE_NODE_FINGERPRINT =
    '99ec62ed62f6377e8d4f0b3a70cf443ed71f925ffae7767667d022008bf8f60e';

  static buildInitialRecord(now = new Date()): OperatorRegistryStateRecord {
    return LocalOperatorRegistryMapper.toRecord(this.buildInitialStatus(now));
  }

  static buildInitialStatus(now = new Date()): OperatorRegistryStatusDto {
    const nowIso = now.toISOString();
    return {
      mode: 'DEMO',
      lifecycle: 'UNCONFIGURED',
      enabled: false,
      simulation: true,
      candidateDefaults: {
        baseUrl: this.SAMPLE_BASE_URL,
        registryScope: this.SAMPLE_SCOPE
      },
      draftInspection: null,
      selection: null,
      nodeIdentity: {
        state: 'MISSING',
        publicKeyFingerprint: null,
        initializedAt: null
      },
      enrollment: null,
      audit: {
        createdAt: nowIso,
        updatedAt: nowIso,
        lastAttemptAt: null,
        lastSuccessAt: null,
        disabledAt: null,
        updatedBy: 'operator-demo-dev'
      },
      lastError: null
    };
  }

  static buildBootstrapMemory(
    memory: OperatorBootstrapSeedMemory,
    now = new Date()
  ): OperatorBootstrapSeedResult {
    const usersTable = memory.appState[USERS_TABLE_NAME];
    const seededOperator = this.buildDemoOperatorUser();
    const existingOperator = usersTable.byId[seededOperator.id] ?? null;
    const usersChanged = this.operatorNeedsUpdate(existingOperator);
    const operator = usersChanged
      ? this.mergeOperator(existingOperator, seededOperator)
      : existingOperator!;
    const appState = usersChanged
      ? {
          ...memory.appState,
          [USERS_TABLE_NAME]: {
            byId: {
              ...usersTable.byId,
              [operator.id]: operator
            },
            ids: usersTable.ids.includes(operator.id)
              ? [...usersTable.ids]
              : [...usersTable.ids, operator.id]
          }
        }
      : memory.appState;

    return {
      appState,
      registryRecord: LocalOperatorRegistryMapper.toSeedRecord(
        memory,
        this.buildInitialStatus(now)
      ),
      registryChanged: memory.registryRecord === null,
      usersChanged
    };
  }

  static buildDemoOperatorUser(): UserRecord {
    return {
      id: 'operator-demo-dev',
      name: 'Demo Operator',
      age: 0,
      birthday: '',
      city: 'Demo deployment',
      height: '',
      physique: '',
      languages: ['English'],
      horoscope: '',
      initials: 'DO',
      gender: 'woman',
      statusText: 'Operator workspace',
      hostTier: 'Operator',
      traitLabel: 'Independent',
      completion: 100,
      profileFormVersion: 2,
      headline: 'Independent deployment operator',
      about: 'Configures this deployment and its signed registry connection.',
      images: [],
      profileStatus: 'public',
      operator: true,
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
        notifications: 0,
        adminJobs: 0,
        adminMetrics: 0
      }
    };
  }

  private static operatorNeedsUpdate(existing: UserRecord | null): boolean {
    return !existing
      || existing.operator !== true
      || existing.admin === true
      || `${existing.hostTier ?? ''}`.trim().toLowerCase() !== 'operator'
      || `${existing.statusText ?? ''}`.trim().length === 0
      || Math.trunc(Number(existing.profileFormVersion) || 0) < 2;
  }

  private static mergeOperator(
    existing: UserRecord | null,
    seeded: UserRecord
  ): UserRecord {
    if (!existing) {
      return seeded;
    }
    return {
      ...existing,
      operator: true,
      admin: false,
      hostTier: 'Operator',
      statusText: `${existing.statusText ?? ''}`.trim() || seeded.statusText,
      profileFormVersion: Math.max(2, Math.trunc(Number(existing.profileFormVersion) || 0))
    };
  }
}

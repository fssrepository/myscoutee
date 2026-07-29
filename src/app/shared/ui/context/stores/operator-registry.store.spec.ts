import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type { OperatorRegistryStatusDto } from '../../../core/contracts/operator.interface';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';
import {
  OperatorRegistryStore,
  operatorRegistryStoreContextKey
} from './operator-registry.store';

describe('OperatorRegistryStore registration', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads seeded registry options and enables explicit registration for a new URL', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const service = {
      loadStatus: vi.fn().mockResolvedValue(unconfiguredStatus())
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: OperatorRegistryService, useValue: service },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);

    await store.loadStatus();

    expect(store.registryOptions()).toHaveLength(2);
    expect(store.registryBaseUrl()).toBe('https://registry.example.com');
    expect(store.canRegister()).toBe(true);
  });

  it('uses the one-button register endpoint without hidden inspect or confirm phases', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const registered = registeredStatus();
    const registeredEntry = {
      id: 'dep_demo',
      nodeId: 'dep_demo',
      label: 'dep_demo',
      group: 'UNCLAIMED' as const,
      verifiedWeight: 0,
      sharePercent: 0,
      claimed: false,
      eligibilityStatus: 'INACTIVE' as const,
      deploymentCount: 1
    };
    const mutationResult = {
      status: registered,
      leaderboardEntry: registeredEntry,
      leaderboardUpserts: [registeredEntry],
      removedLeaderboardEntryIds: [],
      leaderboardTotalDelta: 1,
      created: true
    };
    const service = {
      loadStatus: vi.fn().mockResolvedValue(unconfiguredStatus()),
      register: vi.fn().mockResolvedValue(mutationResult),
      inspect: vi.fn(),
      confirm: vi.fn()
    };
    const applyMutation = vi.fn();
    const invalidateLeaderboard = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: OperatorRegistryService, useValue: service },
        {
          provide: OperatorLeaderboardStore,
          useValue: {
            applyMutation,
            invalidate: invalidateLeaderboard
          }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);
    await store.loadStatus();

    const result = await store.register();

    expect(result?.lifecycle).toBe('REGISTERED');
    expect(service.register).toHaveBeenCalledWith({
      registryBaseUrl: 'https://registry.example.com',
      expectedRegistryScope: 'demo:registry'
    });
    expect(service.inspect).not.toHaveBeenCalled();
    expect(service.confirm).not.toHaveBeenCalled();
    expect(store.canRegister()).toBe(false);
    expect(applyMutation).toHaveBeenCalledWith(mutationResult);
    expect(invalidateLeaderboard).not.toHaveBeenCalled();
  });

  it('applies disconnect and register mutations in order when the selected endpoint changes', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const disconnected = registryMutation(disconnectedStatus(), {
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: -1
    });
    const registered = registryMutation(registeredAtSecondary(), {
      leaderboardUpserts: [{
        id: 'dep_secondary',
        nodeId: 'dep_secondary',
        label: 'dep_secondary',
        group: 'UNCLAIMED',
        verifiedWeight: 0,
        sharePercent: 0,
        claimed: false,
        eligibilityStatus: 'INACTIVE',
        deploymentCount: 1
      }],
      leaderboardTotalDelta: 1,
      created: true
    });
    const service = {
      loadStatus: vi.fn().mockResolvedValue(registeredStatus()),
      register: vi.fn(),
      replaceRegistration: vi.fn().mockResolvedValue({
        disconnected,
        registered,
        registrationError: null
      })
    };
    const applyMutation = vi.fn();
    const invalidate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: OperatorRegistryService, useValue: service },
        {
          provide: OperatorLeaderboardStore,
          useValue: { applyMutation, invalidate }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);
    await store.loadStatus();
    store.setRegistryBaseUrl('https://registry-two.example.com');
    store.setExpectedRegistryScope('demo:secondary');

    const result = await store.register();

    expect(service.replaceRegistration).toHaveBeenCalledWith({
      registryBaseUrl: 'https://registry-two.example.com',
      expectedRegistryScope: 'demo:secondary'
    });
    expect(service.register).not.toHaveBeenCalled();
    expect(applyMutation).toHaveBeenCalledOnce();
    expect(applyMutation).toHaveBeenCalledWith({
      ...registered,
      leaderboardUpserts: registered.leaderboardUpserts,
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: 0
    });
    expect(result).toEqual(registered.status);
    expect(store.status()).toEqual(registered.status);
    expect(store.error()).toBe('');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('preserves and reports the disconnected state when replacement registration fails', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const disconnected = registryMutation(disconnectedStatus(), {
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: -1
    });
    const service = {
      loadStatus: vi.fn().mockResolvedValue(registeredStatus()),
      replaceRegistration: vi.fn().mockResolvedValue({
        disconnected,
        registered: null,
        registrationError: new Error('selected registry unavailable')
      })
    };
    const applyMutation = vi.fn();
    const invalidate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: OperatorRegistryService, useValue: service },
        {
          provide: OperatorLeaderboardStore,
          useValue: { applyMutation, invalidate }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);
    await store.loadStatus();
    store.setRegistryBaseUrl('https://registry-two.example.com');
    store.setExpectedRegistryScope('demo:secondary');

    const result = await store.register();

    expect(result).toBeNull();
    expect(store.status()).toEqual(disconnected.status);
    expect(store.registryBaseUrl()).toBe('https://registry-two.example.com');
    expect(store.expectedRegistryScope()).toBe('demo:secondary');
    expect(store.canRegister()).toBe(true);
    expect(store.error()).toBe('operator.registration.error.switch.partial');
    expect(applyMutation).toHaveBeenCalledTimes(1);
    expect(applyMutation).toHaveBeenCalledWith(disconnected);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('applies a targeted leaderboard removal after a successful disconnect mutation', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const mutationResult = {
      status: {
        ...registeredStatus(),
        enabled: false,
        lifecycle: 'DISABLED'
      },
      leaderboardEntry: null,
      leaderboardUpserts: [],
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: -1,
      created: false
    };
    const service = {
      disconnect: vi.fn().mockResolvedValue(mutationResult)
    };
    const applyMutation = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: OperatorRegistryService, useValue: service },
        {
          provide: OperatorLeaderboardStore,
          useValue: { applyMutation }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);

    await store.disconnect();

    expect(applyMutation).toHaveBeenCalledWith(mutationResult);
  });

  it('updates only QMAU delivery state when one blocked report is requeued', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const synchronization = {
      state: 'BLOCKED' as const,
      code: 'MEASUREMENT_OUTBOX_BLOCKED',
      message: 'A QMAU report requires operator review.',
      materialized: 1,
      submitted: 1,
      accepted: 0,
      pending: 0,
      blocked: 1,
      synchronizedAt: '2026-07-01T00:04:00.000Z'
    };
    const report = {
      id: '0123456789abcdef01234567',
      period: '2026-06',
      windowStart: '2026-05-03',
      windowEnd: '2026-06-01',
      revision: 1,
      rulesetVersion: 'qmau-v1',
      qualifiedMauCount: 248,
      actionCount: 731,
      status: 'PENDING' as const,
      attemptCount: 2,
      nextRetryAt: null,
      failureCode: 'RECEIPT_INVALID',
      failureMessage: 'The registry receipt was invalid.',
      batchId: null,
      acceptedAt: null,
      createdAt: '2026-07-01T00:01:00.000Z',
      updatedAt: '2026-07-01T00:05:00.000Z'
    };
    const service = {
      synchronizeMeasurements: vi.fn().mockResolvedValue(synchronization),
      requeueMeasurementReport: vi.fn().mockResolvedValue(report)
    };
    const applyMutation = vi.fn();
    const invalidate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: OperatorRegistryService, useValue: service },
        {
          provide: OperatorLeaderboardStore,
          useValue: { applyMutation, invalidate }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);

    await store.synchronizeMeasurements();
    const result = await store.requeueMeasurementReport(report.id);

    expect(result).toEqual(report);
    expect(service.requeueMeasurementReport).toHaveBeenCalledWith(report.id);
    expect(store.measurementSync()).toEqual({
      ...synchronization,
      state: 'READY',
      code: null,
      message: 'operator.measurements.delivery.requeued.pending',
      pending: 1,
      blocked: 0
    });
    expect(store.notice()).toBe('operator.measurements.delivery.requeued');
    expect(applyMutation).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('clears cached state when the operator session identity changes', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OperatorRegistryService,
          useValue: { loadStatus: vi.fn().mockResolvedValue(unconfiguredStatus()) }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorRegistryStore);
    await store.loadStatus();

    session.set({
      kind: 'firebase',
      profile: {
        id: 'firebase-operator',
        name: 'Firebase Operator',
        email: 'operator@example.com',
        initials: 'FO'
      }
    });
    TestBed.tick();

    expect(store.status()).toBeNull();
    expect(store.registryBaseUrl()).toBe('');
    expect(store.expectedRegistryScope()).toBe('');
  });

  it('binds cached state to both data source and session identity', () => {
    const session: AppSession = {
      kind: 'demo',
      userId: 'operator-demo-dev'
    };

    expect(operatorRegistryStoreContextKey('local', session))
      .not.toBe(operatorRegistryStoreContextKey('http', session));
    expect(operatorRegistryStoreContextKey('session', session))
      .not.toBe(operatorRegistryStoreContextKey('session', {
        kind: 'demo',
        userId: 'another-operator'
      }));
  });

  it('binds bootstrap state to the dedicated operator email identity', () => {
    expect(operatorRegistryStoreContextKey('http', {
      kind: 'operator-bootstrap',
      email: 'first@example.test',
      expiresAt: '2099-07-29T12:00:00Z'
    })).not.toBe(operatorRegistryStoreContextKey('http', {
      kind: 'operator-bootstrap',
      email: 'second@example.test',
      expiresAt: '2099-07-29T12:00:00Z'
    }));
  });
});

function unconfiguredStatus(): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'UNCONFIGURED',
    enabled: false,
    simulation: true,
    candidateDefaults: {
      baseUrl: 'https://registry.example.com',
      registryScope: 'demo:registry'
    },
    registryOptions: [
      {
        id: 'registry-primary',
        label: 'Primary registry',
        baseUrl: 'https://registry.example.com',
        registryScope: 'demo:registry',
        selected: false
      },
      {
        id: 'registry-secondary',
        label: 'Secondary registry',
        baseUrl: 'https://registry-two.example.com',
        registryScope: 'demo:secondary',
        selected: false
      }
    ],
    draftInspection: null,
    selection: null,
    nodeIdentity: {
      state: 'MISSING',
      initializedAt: null
    },
    enrollment: null,
    audit: {
      createdAt: null,
      updatedAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      disabledAt: null,
      updatedBy: null
    },
    lastError: null
  };
}

function registeredStatus(): OperatorRegistryStatusDto {
  const status = unconfiguredStatus();
  return {
    ...status,
    lifecycle: 'REGISTERED',
    enabled: true,
    registryOptions: status.registryOptions?.map(option => ({
      ...option,
      selected: option.id === 'registry-primary'
    })),
    selection: {
      baseUrl: 'https://registry.example.com',
      registryScope: 'demo:registry',
      confirmedAt: '2026-07-28T10:00:00.000Z'
    },
    nodeIdentity: {
      state: 'SIMULATED',
      initializedAt: '2026-07-28T10:00:00.000Z'
    },
    enrollment: {
      deploymentCode: 'dep_demo',
      installationTestBatchId: 'batch_demo',
      installationTestAcceptedAt: '2026-07-28T10:00:00.000Z',
      installationTestLedgerIndex: 1,
      completedAt: '2026-07-28T10:00:00.000Z'
    }
  };
}

function disconnectedStatus(): OperatorRegistryStatusDto {
  const status = registeredStatus();
  return {
    ...status,
    lifecycle: 'UNCONFIGURED',
    enabled: false,
    registryOptions: status.registryOptions?.map(option => ({
      ...option,
      selected: false
    })),
    selection: null,
    enrollment: null
  };
}

function registeredAtSecondary(): OperatorRegistryStatusDto {
  const status = registeredStatus();
  return {
    ...status,
    registryOptions: status.registryOptions?.map(option => ({
      ...option,
      selected: option.id === 'registry-secondary'
    })),
    selection: {
      baseUrl: 'https://registry-two.example.com',
      registryScope: 'demo:secondary',
      confirmedAt: '2026-07-29T10:00:00.000Z'
    },
    enrollment: status.enrollment
      ? {
          ...status.enrollment,
          deploymentCode: 'dep_secondary'
        }
      : null
  };
}

function registryMutation(
  status: OperatorRegistryStatusDto,
  patch: Partial<{
    leaderboardUpserts: Array<{
      id: string;
      nodeId: string;
      label: string;
      group: 'UNCLAIMED';
      verifiedWeight: number;
      sharePercent: number;
      claimed: boolean;
      eligibilityStatus: 'INACTIVE';
      deploymentCount: number;
    }>;
    removedLeaderboardEntryIds: string[];
    leaderboardTotalDelta: number;
    created: boolean;
  }> = {}
) {
  return {
    status,
    leaderboardEntry: null,
    leaderboardUpserts: patch.leaderboardUpserts ?? [],
    removedLeaderboardEntryIds: patch.removedLeaderboardEntryIds ?? [],
    leaderboardTotalDelta: patch.leaderboardTotalDelta ?? 0,
    created: patch.created ?? false
  };
}

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type { OperatorRegistryStatusDto } from '../../../core/contracts/operator.interface';
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
    const service = {
      loadStatus: vi.fn().mockResolvedValue(unconfiguredStatus()),
      register: vi.fn().mockResolvedValue(registered),
      inspect: vi.fn(),
      confirm: vi.fn()
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

    const result = await store.register();

    expect(result?.lifecycle).toBe('REGISTERED');
    expect(service.register).toHaveBeenCalledWith({
      registryBaseUrl: 'https://registry.example.com',
      expectedRegistryScope: 'demo:registry'
    });
    expect(service.inspect).not.toHaveBeenCalled();
    expect(service.confirm).not.toHaveBeenCalled();
    expect(store.canRegister()).toBe(false);
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

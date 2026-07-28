import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type { OperatorRegistryInspectionDto } from '../../../core/contracts/operator.interface';
import type { OperatorRegistryStatusDto } from '../../../core/contracts/operator.interface';
import {
  OperatorRegistryStore,
  operatorRegistryStoreContextKey
} from './operator-registry.store';

describe('OperatorRegistryStore candidate form', () => {
  it('reactively enables inspection when the operator types a registry URL', async () => {
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
    expect(store.canInspect()).toBe(false);

    store.setRegistryBaseUrl('https://registry.example.com');
    expect(store.registryBaseUrl()).toBe('https://registry.example.com');
    expect(store.canInspect()).toBe(true);

    store.setRegistryBaseUrl('');
    expect(store.canInspect()).toBe(false);
  });

  it('clears status and inspection when the operator session identity changes', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const service = {
      loadStatus: vi.fn().mockResolvedValue(unconfiguredStatus()),
      inspect: vi.fn().mockResolvedValue(inspection())
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
    await store.inspect({
      baseUrl: 'https://registry.example.com',
      expectedScope: 'demo:sample'
    });

    expect(store.status()).not.toBeNull();
    expect(store.inspection()?.inspectionToken).toBe('inspection_demo');

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
    expect(store.inspection()).toBeNull();
    expect(store.registryBaseUrl()).toBe('');
    expect(store.expectedRegistryScope()).toBe('');
  });

  it('invalidates an inspected identity when its URL or expected scope changes', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const service = {
      loadStatus: vi.fn().mockResolvedValue(unconfiguredStatus()),
      inspect: vi.fn().mockResolvedValue(inspection())
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
    await store.inspect({
      baseUrl: 'https://registry.example.com',
      expectedScope: 'demo:sample'
    });

    expect(store.inspection()?.inspectionToken).toBe('inspection_demo');
    store.setRegistryBaseUrl('https://registry.partner.example');
    expect(store.inspection()).toBeNull();

    await store.inspect({
      baseUrl: 'https://registry.example.com',
      expectedScope: 'demo:sample'
    });
    store.setExpectedRegistryScope('partner:sample');
    expect(store.inspection()).toBeNull();
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
      baseUrl: '',
      registryScope: ''
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

function inspection(): OperatorRegistryInspectionDto {
  return {
    inspectionToken: 'inspection_demo',
    expiresAt: '2026-07-28T06:00:00.000Z',
    baseUrl: 'https://registry.example.com',
    simulation: true,
    registryIdentity: {
      identityEndpoint: 'https://registry.example.com/v1/registry/identity',
      protocolVersion: '1',
      registryScope: 'demo:sample',
      registryKeyId: 'registry_demo',
      registryPublicKeyFingerprint: 'fingerprint'
    }
  };
}

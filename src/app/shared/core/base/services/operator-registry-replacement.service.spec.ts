import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import type {
  OperatorRegistryMutationResultDto,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
import { HttpOperatorRegistryService } from '../../http/services/operator-registry.service';
import { LocalOperatorRegistryService } from '../../local/source/services/operator-registry.service';
import { SessionService } from './session.service';
import { OperatorRegistryService } from './operator-registry.service';

describe('OperatorRegistryService endpoint replacement', () => {
  const originalDataSource = environment.operatorRegistryDataSource;
  const disconnect = vi.fn();
  const register = vi.fn();

  beforeEach(() => {
    environment.operatorRegistryDataSource = 'http';
    disconnect.mockReset();
    register.mockReset();
    TestBed.configureTestingModule({
      providers: [
        OperatorRegistryService,
        {
          provide: HttpOperatorRegistryService,
          useValue: { disconnect, register }
        },
        {
          provide: LocalOperatorRegistryService,
          useValue: {
            disconnect: vi.fn(),
            register: vi.fn()
          }
        },
        {
          provide: SessionService,
          useValue: {
            currentSession: () => ({
              kind: 'demo',
              userId: 'operator-demo-dev'
            })
          }
        }
      ]
    });
  });

  afterEach(() => {
    environment.operatorRegistryDataSource = originalDataSource;
    TestBed.resetTestingModule();
  });

  it('disconnects the active binding before registering the selected endpoint', async () => {
    const calls: string[] = [];
    const disconnected = mutation(disconnectedStatus());
    const registered = mutation(registeredStatus(
      'https://registry-two.example.com',
      'demo:secondary'
    ));
    disconnect.mockImplementation(async () => {
      calls.push('disconnect');
      return disconnected;
    });
    register.mockImplementation(async () => {
      calls.push('register');
      return registered;
    });

    const result = await TestBed.inject(OperatorRegistryService)
      .replaceRegistration({
        registryBaseUrl: 'https://registry-two.example.com',
        expectedRegistryScope: 'demo:secondary'
      });

    expect(calls).toEqual(['disconnect', 'register']);
    expect(result).toEqual({
      disconnected,
      registered,
      registrationError: null
    });
  });

  it('returns the durable disconnected state when the second step fails', async () => {
    const calls: string[] = [];
    const disconnected = mutation(disconnectedStatus());
    const registrationError = new Error('selected registry unavailable');
    disconnect.mockImplementation(async () => {
      calls.push('disconnect');
      return disconnected;
    });
    register.mockImplementation(async () => {
      calls.push('register');
      throw registrationError;
    });

    const result = await TestBed.inject(OperatorRegistryService)
      .replaceRegistration({
        registryBaseUrl: 'https://registry-two.example.com',
        expectedRegistryScope: 'demo:secondary'
      });

    expect(calls).toEqual(['disconnect', 'register']);
    expect(result).toEqual({
      disconnected,
      registered: null,
      registrationError
    });
  });
});

function mutation(
  status: OperatorRegistryStatusDto
): OperatorRegistryMutationResultDto {
  return {
    status,
    leaderboardEntry: null,
    leaderboardUpserts: [],
    removedLeaderboardEntryIds: [],
    leaderboardTotalDelta: 0,
    created: false
  };
}

function disconnectedStatus(): OperatorRegistryStatusDto {
  return {
    ...registeredStatus('https://registry.example.com', 'demo:registry'),
    lifecycle: 'UNCONFIGURED',
    enabled: false,
    selection: null,
    enrollment: null
  };
}

function registeredStatus(
  baseUrl: string,
  registryScope: string
): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'REGISTERED',
    enabled: true,
    simulation: true,
    candidateDefaults: {
      baseUrl,
      registryScope
    },
    registryOptions: [],
    draftInspection: null,
    selection: {
      baseUrl,
      registryScope,
      confirmedAt: '2026-07-29T10:00:00.000Z'
    },
    nodeIdentity: {
      state: 'SIMULATED',
      initializedAt: '2026-07-29T10:00:00.000Z'
    },
    enrollment: {
      deploymentCode: 'dep_demo',
      installationTestBatchId: 'batch_demo',
      installationTestAcceptedAt: '2026-07-29T10:00:00.000Z',
      installationTestLedgerIndex: 1,
      completedAt: '2026-07-29T10:00:00.000Z'
    },
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

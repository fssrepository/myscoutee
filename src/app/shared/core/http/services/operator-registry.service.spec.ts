import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RouteDelayService } from '../../base/services/route-delay.service';
import { SessionService } from '../../base/services/session.service';
import type {
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
import { HttpOperatorRegistryService } from './operator-registry.service';

describe('HttpOperatorRegistryService', () => {
  const get = vi.fn();
  const post = vi.fn();
  const withRequestTimeout = vi.fn();
  let currentSession: unknown;

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    withRequestTimeout
      .mockReset()
      .mockImplementation((_route: string, task: Promise<unknown>) => task);
    currentSession = {
      kind: 'demo',
      userId: ' operator-demo-dev '
    };
    TestBed.configureTestingModule({
      providers: [
        HttpOperatorRegistryService,
        { provide: HttpClient, useValue: { get, post } },
        {
          provide: SessionService,
          useValue: {
            currentSession: () => currentSession
          }
        },
        { provide: RouteDelayService, useValue: { withRequestTimeout } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sends the current demo operator identity through Java and centralizes the 30 second timeout', async () => {
    const status = registryStatus();
    get.mockReturnValue(of(status));

    const result = await TestBed.inject(HttpOperatorRegistryService).loadStatus();

    expect(result).toEqual(status);
    expect(get).toHaveBeenCalledTimes(1);
    const [, options] = get.mock.calls[0] as [string, { headers?: HttpHeaders }];
    expect(options.headers?.get('X-Demo-User-Id')).toBe('operator-demo-dev');
    expect(withRequestTimeout).toHaveBeenCalledWith(
      '/operator/registry',
      expect.any(Promise),
      'Operator registry request timed out.'
    );
  });

  it('posts only the normalized inspection contract and does not send a demo identity for Firebase', async () => {
    currentSession = {
      kind: 'firebase',
      profile: {
        id: 'operator-real',
        name: 'Real Operator',
        email: 'operator@example.com',
        initials: 'RO'
      }
    };
    const inspection = registryInspection();
    post.mockReturnValue(of(inspection));

    const result = await TestBed.inject(HttpOperatorRegistryService).inspect({
      baseUrl: ' https://registry.example.com ',
      expectedScope: ' partner:europe '
    });

    expect(result).toEqual(inspection);
    expect(post).toHaveBeenCalledWith(
      '/api/operator/registry/inspect',
      {
        baseUrl: 'https://registry.example.com',
        expectedScope: 'partner:europe'
      },
      {}
    );
  });

  it('uses exact confirm and null-body retry/disconnect payloads', async () => {
    const status = registryStatus();
    post.mockReturnValue(of(status));
    const service = TestBed.inject(HttpOperatorRegistryService);

    await service.confirm(' inspection_1 ');
    await service.retry();
    await service.disconnect();

    expect(post.mock.calls.map((call: unknown[]) => [call[0], call[1]])).toEqual([
      ['/api/operator/registry/confirm', { inspectionToken: 'inspection_1' }],
      ['/api/operator/registry/retry', null],
      ['/api/operator/registry/disconnect', null]
    ]);
    for (const call of post.mock.calls as Array<[string, unknown, { headers?: HttpHeaders }]>) {
      expect(call[2].headers?.get('X-Demo-User-Id')).toBe('operator-demo-dev');
    }
  });
});

function registryStatus(): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'UNCONFIGURED',
    enabled: false,
    simulation: false,
    candidateDefaults: {
      baseUrl: 'https://registry.example.com',
      registryScope: 'partner:europe'
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

function registryInspection(): OperatorRegistryInspectionDto {
  return {
    inspectionToken: 'inspection_1',
    expiresAt: '2026-07-28T04:00:00.000Z',
    baseUrl: 'https://registry.example.com',
    simulation: false,
    registryIdentity: {
      identityEndpoint: 'https://registry.example.com/v1/registry/identity',
      protocolVersion: '1',
      registryScope: 'partner:europe',
      registryKeyId: 'registry_key_1',
      registryPublicKeyFingerprint: 'registry-fingerprint'
    }
  };
}

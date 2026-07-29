import { TestBed } from '@angular/core/testing';
import {
  type FirebaseApp,
  deleteApp,
  getApps,
  initializeApp
} from 'firebase/app';

import { SessionService } from './session.service';
import {
  FirebaseAppService,
  type FirebaseConfigFile
} from './firebase-app.service';

vi.mock('firebase/app', () => ({
  deleteApp: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn()
}));

describe('FirebaseAppService reconciliation', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.mocked(deleteApp).mockReset();
    vi.mocked(deleteApp).mockResolvedValue(undefined);
    vi.mocked(getApps).mockReset();
    vi.mocked(getApps).mockReturnValue([]);
    vi.mocked(initializeApp).mockReset();
    vi.mocked(initializeApp).mockImplementation((options, name) => ({
      name: `${name}`,
      options,
      automaticDataCollectionEnabled: false
    }) as FirebaseApp);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [
        FirebaseAppService,
        {
          provide: SessionService,
          useValue: {
            currentSession: () => ({
              kind: 'firebase'
            })
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('makes ensure wait for an in-flight refresh instead of returning the old app', async () => {
    const firstConfiguration = firebaseConfiguration(1);
    const secondConfiguration = firebaseConfiguration(2);
    fetchMock.mockResolvedValueOnce(jsonResponse(firstConfiguration));
    const service = TestBed.inject(FirebaseAppService);
    const firstRuntime = await service.ensureFirebaseRuntime();
    let resolveRefresh:
      ((response: Response) => void) | null = null;
    fetchMock.mockImplementationOnce(() =>
      new Promise<Response>(resolve => {
        resolveRefresh = resolve;
      })
    );

    const refresh = service.refreshFirebaseApp();
    const ensureDuringRefresh = service.ensureFirebaseRuntime();
    resolveRefresh?.(jsonResponse(secondConfiguration));
    const [refreshedApp, ensuredRuntime] = await Promise.all([
      refresh,
      ensureDuringRefresh
    ]);

    expect(firstRuntime?.config.revision).toBe(1);
    expect(ensuredRuntime?.config.revision).toBe(2);
    expect(ensuredRuntime?.app).toBe(refreshedApp);
    expect(ensuredRuntime?.app).not.toBe(firstRuntime?.app);
    expect(deleteApp).toHaveBeenCalledWith(firstRuntime?.app);
  });

  it('retries after an unavailable configuration instead of caching null', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(firebaseConfiguration(3)));
    const service = TestBed.inject(FirebaseAppService);

    expect(await service.ensureFirebaseRuntime()).toBeNull();
    expect((await service.ensureFirebaseRuntime())?.config.revision).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function firebaseConfiguration(revision: number): FirebaseConfigFile {
  return {
    revision,
    apiKey: 'browser-api-key',
    authDomain: 'community-project.firebaseapp.com',
    projectId: 'community-project',
    storageBucket: 'community-project.firebasestorage.app',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:operator',
    vapidKey: 'public-vapid-key'
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

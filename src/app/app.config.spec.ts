import { TestBed } from '@angular/core/testing';

import { environment } from '../environments/environment';
import { environment as githubEnvironment } from '../environments/environment.github';
import { environment as productionEnvironment } from '../environments/environment.production';
import { ROUTE_CONFIG } from './shared/core/base/config';
import { prepareDemoFailover } from './shared/core/common/demo-failover';
import * as adapters from './shared/core/base/adapter-loaders';
import { AdapterProxyService } from './shared/core/base/services/platform/adapter-proxy.service';
import { appConfig, loadAppConfig } from './app.config';

describe('Bootstrap adapter selection', () => {
  const originalEnvironment = { ...environment };
  const originalEntries = [...ROUTE_CONFIG.entries];

  beforeEach(() => {
    vi.spyOn(adapters.ADAPTER_MODE_LOADERS, 'local');
    vi.spyOn(adapters.ADAPTER_MODE_LOADERS, 'http');
  });

  afterEach(() => {
    Object.assign(environment, originalEnvironment);
    ROUTE_CONFIG.entries = [...originalEntries];
    document.getElementById('myscoutee-runtime-status')?.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it.each(['anonymous', 'demo', 'firebase'])('prepares only HTTP adapters for the %s HTTP bootstrap', async kind => {
    Object.assign(environment, productionEnvironment);
    if (kind !== 'anonymous') localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({ kind, userId: 'actor' }));
    expect(await loadAppConfig()).toBe(appConfig);
    expect(adapters.ADAPTER_MODE_LOADERS.http).toHaveBeenCalledExactlyOnceWith();
    expect(adapters.ADAPTER_MODE_LOADERS.local).not.toHaveBeenCalled();
  });

  it.each(['npm', 'github'])('prepares only local adapters for the %s standalone profile', async profile => {
    Object.assign(environment, profile === 'github' ? githubEnvironment : originalEnvironment,
      { activitiesDataSource: 'local' });
    expect(await loadAppConfig()).toBe(appConfig);
    expect(adapters.ADAPTER_MODE_LOADERS.local).toHaveBeenCalledExactlyOnceWith();
    expect(adapters.ADAPTER_MODE_LOADERS.http).not.toHaveBeenCalled();
    const key = adapters.LOCAL_ADAPTER.USERS;
    const constructor = adapters.cachedAdapterType(key)!;
    const instance = { marker: profile };
    TestBed.configureTestingModule({ providers: [{ provide: constructor, useValue: instance }] });
    expect(await TestBed.inject(AdapterProxyService).get(key)).toBe(TestBed.inject(constructor));
  });

  it('prepares both sides for an explicitly local route in an otherwise HTTP profile', async () => {
    Object.assign(environment, productionEnvironment);
    ROUTE_CONFIG.entries = [...originalEntries, { routePrefix: '/auth/demo-users', mode: 'local' }];
    await loadAppConfig();
    expect(adapters.ADAPTER_MODE_LOADERS.http).toHaveBeenCalledExactlyOnceWith();
    expect(adapters.ADAPTER_MODE_LOADERS.local).toHaveBeenCalledExactlyOnceWith();
  });

  it('preserves an explicit HTTP route in a standalone profile', async () => {
    environment.activitiesDataSource = 'local';
    ROUTE_CONFIG.entries = [...originalEntries, { routePrefix: '/auth/me', http: true }];
    await loadAppConfig();
    expect(adapters.ADAPTER_MODE_LOADERS.local).toHaveBeenCalledExactlyOnceWith();
    expect(adapters.ADAPTER_MODE_LOADERS.http).toHaveBeenCalledExactlyOnceWith();
  });

  it('prepares local adapters after the existing startup failover selects local mode', async () => {
    Object.assign(environment, productionEnvironment);
    localStorage.clear();
    const snapshot = document.createElement('script');
    snapshot.id = 'myscoutee-runtime-status';
    snapshot.type = 'application/json';
    snapshot.textContent = JSON.stringify({ ready: false, checkedAt: Math.floor(Date.now() / 1000) });
    document.head.append(snapshot);
    await prepareDemoFailover();
    expect(environment.activitiesDataSource).toBe('local');
    await loadAppConfig();
    expect(adapters.ADAPTER_MODE_LOADERS.local).toHaveBeenCalledExactlyOnceWith();
    expect(adapters.ADAPTER_MODE_LOADERS.http).not.toHaveBeenCalled();
  });
});

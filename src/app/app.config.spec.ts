import { LazyBgImageDirective } from '@fssrepository/myscoutee-components';
import { I18nService } from './shared/core/base/services/localization/i18n.service';
import { LandingContentService } from './shared/core/base/services/content/landing-content.service';
import { SessionService } from './shared/core/base/services/accounts/session.service';
import { TestBed } from '@angular/core/testing';

import { environment } from '../environments/environment';
import { environment as githubEnvironment } from '../environments/environment.github';
import { environment as productionEnvironment } from '../environments/environment.production';
import { ROUTE_CONFIG } from './shared/core/base/config';
import { prepareDemoFailover } from './shared/core/common/demo-failover';
import * as adapters from './shared/core/base/adapter-loaders';
import { AdapterProxyService } from './shared/core/base/services/platform/adapter-proxy.service';
import { appConfig, initializeApplication, loadAppConfig } from './app.config';

describe('Bootstrap adapter selection', () => {
  const originalEnvironment = { ...environment };
  const originalEntries = [...ROUTE_CONFIG.entries];
  const originalUrl = location.href;
  let base: HTMLBaseElement;

  beforeEach(() => {
    history.replaceState(null, '', '/');
    base = document.createElement('base');
    base.href = '/';
    document.head.prepend(base);
    vi.spyOn(adapters.ADAPTER_MODE_LOADERS, 'local');
    vi.spyOn(adapters.ADAPTER_MODE_LOADERS, 'http');
  });

  afterEach(() => {
    Object.assign(environment, originalEnvironment);
    ROUTE_CONFIG.entries = [...originalEntries];
    document.getElementById('myscoutee-runtime-status')?.remove();
    localStorage.clear();
    history.replaceState(null, '', originalUrl);
    base.remove();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it.each(['anonymous', 'demo', 'firebase'])('prepares only HTTP adapters for the %s HTTP bootstrap', async kind => {
    Object.assign(environment, productionEnvironment);
    if (kind !== 'anonymous') localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({ kind, userId: 'actor' }));
    expect(await loadAppConfig()).toBe(appConfig);
    expect(adapters.ADAPTER_MODE_LOADERS.http).toHaveBeenCalledTimes(kind === 'anonymous' ? 0 : 1);
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
    expect(adapters.ADAPTER_MODE_LOADERS.http).not.toHaveBeenCalled();
    expect(adapters.ADAPTER_MODE_LOADERS.local).toHaveBeenCalledExactlyOnceWith();
  });

  it('prepares the full HTTP side for direct workspace navigation without a session', async () => {
    Object.assign(environment, productionEnvironment);
    history.replaceState(null, '', '/game');
    await loadAppConfig();
    expect(adapters.ADAPTER_MODE_LOADERS.http).toHaveBeenCalledExactlyOnceWith();
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

describe('application startup requests', () => {
  let originalMode: 'local' | 'http';
  let originalUrl: string;
  let base: HTMLBaseElement;
  let finishTranslations: () => void;
  let finishContent: (state: { slides: { imageUrl: string }[] }) => void;
  const initialize = vi.fn();
  const loadOnce = vi.fn();
  const currentSession = vi.fn();

  beforeEach(() => {
    originalMode = environment.activitiesDataSource;
    originalUrl = location.href;
    environment.activitiesDataSource = 'http';
    history.replaceState(null, '', '/');
    base = document.createElement('base');
    base.href = '/';
    document.head.prepend(base);
    initialize.mockReset().mockReturnValue(new Promise<void>(resolve => finishTranslations = resolve));
    loadOnce.mockReset().mockReturnValue(new Promise(resolve => finishContent = resolve));
    currentSession.mockReset().mockReturnValue(null);
    vi.spyOn(LazyBgImageDirective, 'preloadImageUrl').mockResolvedValue(true);
    TestBed.configureTestingModule({ providers: [
      { provide: I18nService, useValue: { initialize } },
      { provide: LandingContentService, useValue: { loadOnce } },
      { provide: SessionService, useValue: { currentSession } }
    ] });
  });

  afterEach(() => {
    environment.activitiesDataSource = originalMode;
    history.replaceState(null, '', originalUrl);
    base.remove();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('starts the shared landing request and actual first image before translations finish', async () => {
    let ready = false;
    const startup = TestBed.runInInjectionContext(initializeApplication).then(() => ready = true);
    expect(loadOnce).toHaveBeenCalledTimes(1);
    finishContent({ slides: [{ imageUrl: '/configured-first.webp' }, { imageUrl: '/later.webp' }] });
    await vi.waitFor(() => expect(LazyBgImageDirective.preloadImageUrl)
      .toHaveBeenCalledWith('/configured-first.webp', { fetchPriority: 'high' }));
    expect(LazyBgImageDirective.preloadImageUrl).toHaveBeenCalledTimes(1);
    expect(ready).toBe(false);
    finishTranslations();
    await startup;
    expect(ready).toBe(true);
  });

  it('does not hold translated startup for the image to finish', async () => {
    vi.mocked(LazyBgImageDirective.preloadImageUrl).mockReturnValue(new Promise(() => {}));
    const startup = TestBed.runInInjectionContext(initializeApplication);
    finishContent({ slides: [{ imageUrl: '/configured-first.webp' }] });
    finishTranslations();
    await startup;
  });

  it('leaves a failed landing request to the routed loading/error flow', async () => {
    loadOnce.mockRejectedValueOnce(new Error('offline'));
    const startup = TestBed.runInInjectionContext(initializeApplication);
    finishTranslations();
    await startup;
    expect(LazyBgImageDirective.preloadImageUrl).not.toHaveBeenCalled();
  });

  it.each(['/game', '/admin', '/operator'])('does not fetch landing content for %s', path => {
    history.replaceState(null, '', path);
    TestBed.runInInjectionContext(initializeApplication);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(loadOnce).not.toHaveBeenCalled();
  });

  it('keeps standalone startup with its existing local loading flow', () => {
    environment.activitiesDataSource = 'local';
    TestBed.runInInjectionContext(initializeApplication);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(loadOnce).not.toHaveBeenCalled();
  });

  it('does not load landing content when the entry guard will redirect a retained session', () => {
    currentSession.mockReturnValue({ kind: 'demo', userId: 'retained' });
    TestBed.runInInjectionContext(initializeApplication);
    expect(loadOnce).not.toHaveBeenCalled();
  });
});

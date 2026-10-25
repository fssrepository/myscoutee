import { ExplanationGuideService } from '../help/explanation-guide.service';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { provideUiTranslations } from '@fssrepository/myscoutee-components';

import { environment } from '../../../../../../environments/environment';
import { version as catalogVersion } from '../../../../../../assets/i18n/en.json';
import { I18nBundleRepository } from '../../repositories/localization/i18n-bundle.repository';
import { I18nService } from './i18n.service';
import { type AppSession, SessionService } from '../accounts/session.service';

describe('I18nService', () => {
  const get = vi.fn();
  const bundleRepository = {
    firstStoredBundle: vi.fn(),
    readStoredBundle: vi.fn(),
    writeStoredBundle: vi.fn()
  };
  const session = signal<AppSession | null>(null);
  let originalDataSource: 'local' | 'http';

  beforeEach(() => {
    originalDataSource = environment.activitiesDataSource;
    environment.activitiesDataSource = 'http';
    session.set(null);
    get.mockReset();
    bundleRepository.firstStoredBundle.mockReset().mockResolvedValue(null);
    bundleRepository.readStoredBundle.mockReset().mockResolvedValue(null);
    bundleRepository.writeStoredBundle.mockReset().mockResolvedValue(undefined);
    get.mockImplementation((url: string) => {
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.1',
          messages: {
            'add.myscoutee.to.your.home.screen':
              'Add static {productName} to your home screen',
            'install.prompt.description':
              'Install static {productName} from your home screen'
          }
        });
      }
      if (url === `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`) {
        return of({
          lang: 'en',
          version: 'remote.2',
          data: {
            'add.myscoutee.to.your.home.screen':
              'Add server {productName} to your home screen',
            'install.prompt.description':
              'Install server {productName} from your home screen'
          }
        });
      }
      throw new Error(`Unexpected i18n request: ${url}`);
    });

    TestBed.configureTestingModule({
      providers: [
        I18nService,
        { provide: HttpClient, useValue: { get } },
        { provide: I18nBundleRepository, useValue: bundleRepository },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    environment.activitiesDataSource = originalDataSource;
    TestBed.inject(DOCUMENT).body.replaceChildren();
    TestBed.resetTestingModule();
  });

  it('uses Mongo-backed English install-prompt text in HTTP mode', async () => {
    const service = TestBed.inject(I18nService);

    service.initialize();

    await vi.waitFor(() => {
      expect(service.translateParams(
        'add.myscoutee.to.your.home.screen',
        { productName: 'Operator Brand' }
      )).toBe('Add server Operator Brand to your home screen');
      expect(service.translateParams(
        'install.prompt.description',
        { productName: 'Operator Brand' }
      )).toBe('Install server Operator Brand from your home screen');
    });
    expect(get).toHaveBeenCalledWith(
      `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`,
      expect.objectContaining({
        params: expect.objectContaining({})
      })
    );
    expect(bundleRepository.writeStoredBundle).toHaveBeenCalledWith(
      'real',
      expect.objectContaining({
        lang: 'en',
        version: 'remote.2'
      })
    );
    expect(localAssetRequestCount()).toBe(0);
  });

  it('keeps the guide in the browser language while initialization waits for its catalog', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['hu-HU', 'en-US']);
    const response = new Subject<unknown>();
    get.mockImplementation((url, options) => {
      expect(url).toBe(`${environment.apiBaseUrl ?? '/api'}/i18n/bundle`);
      expect(options.params.get('lang')).toBe('hu');
      return response;
    });
    TestBed.configureTestingModule({ providers: [provideUiTranslations(I18nService)] });
    const service = TestBed.inject(I18nService);
    const loadGuide = vi.fn().mockResolvedValue({ activeRevision: null, revisions: [], guideFields: [], availableLanguages: [], auditTrail: [] });
    const guide = TestBed.runInInjectionContext(() => new ExplanationGuideService({
      isExplainableContext: () => true, loadState: loadGuide
    }));
    expect(service.currentLanguage()).toBe('hu');
    const ready = service.initialize();
    const initialized = vi.fn();
    void ready.then(initialized);
    guide.registerContext('landing.home');
    guide.openCurrent();
    await vi.waitFor(() => expect(apiRequestCount()).toBe(1));
    expect(initialized).not.toHaveBeenCalled();
    TestBed.tick();
    expect(loadGuide).toHaveBeenCalledExactlyOnceWith('landing.home', 'hu');
    response.next({ lang: 'hu', version: 'remote.hu.2', data: { greeting: 'Szia', 'network.offline': 'Nincs hálózat' } });
    response.complete();
    await ready;
    TestBed.tick();
    expect(service.translate('greeting')).toBe('Szia');
    expect(service.translate('network.offline')).toBe('Nincs hálózat');
    expect(service.currentLanguage()).toBe('hu');
    expect(document.documentElement.lang).toBe('hu');
    expect(loadGuide).toHaveBeenCalledTimes(1);
    expect(apiRequestCount()).toBe(1);
    expect(localAssetRequestCount()).toBe(0);
  });

  it.each(['real', 'demo'] as const)('processes the cached %s English catalog once across startup and unchanged validation', async scope => {
    if (scope === 'demo') session.set({ kind: 'demo', userId: 'demo-user' });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const cached = { lang: 'en', version: catalogVersion, data: { greeting: `${scope} Hello` }, storedAt: 1 };
    bundleRepository.firstStoredBundle.mockImplementation(async () => structuredClone(cached));
    bundleRepository.readStoredBundle.mockImplementation(async (requestedScope, lang) => {
      expect(requestedScope).toBe(scope);
      return lang === 'en' ? structuredClone(cached) : null;
    });
    const response = new Subject<unknown>();
    get.mockImplementation((_url, options) => {
      expect(options.params.get('lang')).toBe('en');
      expect(options.params.get('version')).toBe(catalogVersion);
      return response;
    });
    const service = TestBed.inject(I18nService);
    const buildIndex = vi.spyOn(service as any, 'buildSourceKeyIndex');
    const initialized = service.initialize();
    try {
      await vi.waitFor(() => expect(apiRequestCount()).toBe(1));
      await initialized;
      expect(service.translate('greeting')).toBe(`${scope} Hello`);
      const validating = service.revalidate();
      response.next({ lang: 'en', version: catalogVersion, data: null });
      response.complete();
      await validating;
      expect(service.translate('greeting')).toBe(`${scope} Hello`);
      expect(buildIndex).toHaveBeenCalledOnce();
      expect(bundleRepository.writeStoredBundle).not.toHaveBeenCalled();
      expect(apiRequestCount()).toBe(1);
    } finally {
      response.complete();
    }
  });

  it('keeps English when it precedes Hungarian in the browser preferences', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US', 'hu-HU']);
    const service = TestBed.inject(I18nService);
    await service.initialize();
    expect(service.currentLanguage()).toBe('en');
    expect(get.mock.calls.filter(([url]) => url === `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`)
      .map(([, options]) => options.params.get('lang'))).toEqual(['en']);
    expect(localAssetRequestCount()).toBe(0);
  });

  it.each([
    ['local', 'en', ['en-GB', 'en-US', 'en', 'hu']],
    ['http', 'en', ['en-GB', 'en-US', 'en', 'hu']],
    ['local', 'hu', ['hu-HU', 'en-US']],
    ['http', 'hu', ['hu-HU', 'en-US']],
    ['local', 'en', []],
    ['http', 'en', []],
    ['local', 'en', ['ja-JP']],
    ['http', 'en', ['ja-JP']],
    ['local', 'hu', ['ja-JP', 'hu-HU']],
    ['http', 'hu', ['ja-JP', 'hu-HU']]
  ] as const)('uses only the preferred %s/%s catalog', async (mode, preferred, languages) => {
    environment.activitiesDataSource = mode;
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([...languages]);
    if (!languages.length) vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('');
    get.mockImplementation((url: string, options) => {
      const lang = mode === 'http' ? options.params.get('lang') : url.endsWith('/hu.json') ? 'hu' : 'en';
      const messages = { greeting: `${lang} greeting` };
      return of({ lang, version: 'static.1', messages, data: messages });
    });
    const service = TestBed.inject(I18nService);
    await service.initialize();
    expect(service.currentLanguage()).toBe(preferred);
    const requestUrl = mode === 'local' ? `assets/i18n/${preferred}.json` : `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`;
    expect(get.mock.calls.map(([url]) => url)).toEqual([requestUrl]);
    if (mode === 'http') {
      expect(get.mock.calls[0][1].params.get('lang')).toBe(preferred);
      expect(localAssetRequestCount()).toBe(0);
    }
  });

  it.each(['hu', 'en'] as const)('starts from the cached %s catalog while server revalidation is pending', async lang => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([lang]);
    const cached = { lang, version: catalogVersion, data: { greeting: lang === 'hu' ? 'Szia' : 'Hello' }, storedAt: 1 };
    bundleRepository.firstStoredBundle.mockResolvedValue(cached);
    bundleRepository.readStoredBundle.mockImplementation(async (_scope, requested) => requested === lang ? cached : null);
    const response = new Subject<unknown>();
    get.mockReturnValue(response);
    const service = TestBed.inject(I18nService);
    const initialized = vi.fn();
    void service.initialize().then(initialized);
    try {
      await vi.waitFor(() => expect(apiRequestCount()).toBe(1));
      expect(service.translate('greeting')).toBe(cached.data.greeting);
      await vi.waitFor(() => expect(initialized).toHaveBeenCalledOnce(), { timeout: 100 });
      const refreshing = service.revalidate();
      expect(apiRequestCount()).toBe(1);
      response.next({ lang, version: cached.version, data: null });
      response.complete();
      await refreshing;
      expect(service.translate('greeting')).toBe(cached.data.greeting);
      expect(localAssetRequestCount()).toBe(0);
    } finally {
      response.complete();
    }
  });

  it('does not show a cached secondary language before the preferred catalog arrives', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['hu-HU', 'en-US']);
    const english = { lang: 'en', version: catalogVersion, data: { greeting: 'Hello' }, storedAt: 1 };
    bundleRepository.firstStoredBundle.mockResolvedValue(english);
    bundleRepository.readStoredBundle.mockImplementation(async (_scope, lang) => lang === 'en' ? english : null);
    const response = new Subject<unknown>();
    get.mockReturnValue(response);
    const service = TestBed.inject(I18nService);
    const initialized = vi.fn();
    const ready = service.initialize().then(initialized);
    await vi.waitFor(() => expect(apiRequestCount()).toBe(1));
    expect(get.mock.calls[0][1].params.get('lang')).toBe('hu');
    expect(service.currentLanguage()).toBe('hu');
    expect(service.translate('greeting')).toBe('greeting');
    expect(initialized).not.toHaveBeenCalled();
    response.next({ lang: 'hu', version: catalogVersion, data: { greeting: 'Szia' } });
    response.complete();
    await ready;
    expect(service.translate('greeting')).toBe('Szia');
    expect(service.currentLanguage()).toBe('hu');
    expect(apiRequestCount()).toBe(1);
    expect(localAssetRequestCount()).toBe(0);
  });

  it('uses the cached secondary language when the preferred catalog cannot be fetched', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['hu-HU', 'en-US']);
    const english = { lang: 'en', version: catalogVersion, data: { greeting: 'Hello' }, storedAt: 1 };
    bundleRepository.firstStoredBundle.mockResolvedValue(english);
    bundleRepository.readStoredBundle.mockImplementation(async (_scope, lang) => lang === 'en' ? english : null);
    get.mockReturnValue(throwError(() => new Error('offline')));
    const service = TestBed.inject(I18nService);
    await service.initialize();
    expect(service.currentLanguage()).toBe('en');
    expect(service.translate('greeting')).toBe('Hello');
    expect(apiRequestCount()).toBe(1);
    expect(localAssetRequestCount()).toBe(0);
  });

  it.each(['2026.10.21.1', '2026.10.20.2'])('waits for updated keys when the cached full version is %s', async version => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['hu']);
    const cached = { lang: 'hu', version, data: { greeting: 'Szia' }, storedAt: 1 };
    bundleRepository.firstStoredBundle.mockResolvedValue(cached);
    bundleRepository.readStoredBundle.mockResolvedValue(cached);
    const response = new Subject<unknown>();
    get.mockReturnValue(response);
    const service = TestBed.inject(I18nService);
    const initialized = vi.fn();
    const ready = service.initialize().then(initialized);
    await vi.waitFor(() => expect(apiRequestCount()).toBe(1));
    expect(initialized).not.toHaveBeenCalled();
    response.next({ lang: 'hu', version: catalogVersion, data: { greeting: 'Szia', 'network.offline': 'Nincs hálózat' } });
    response.complete();
    await ready;
    expect(service.translate('network.offline')).toBe('Nincs hálózat');
    expect(apiRequestCount()).toBe(1);
    expect(localAssetRequestCount()).toBe(0);
  });

  it('keeps the first source alias across whitespace and case variants', () => {
    const service = TestBed.inject(I18nService);
    const index = (service as any).buildSourceKeyIndex({
      ' first.key ': ' Hello   world ',
      second: 'hello world',
      third: 'HELLO WORLD',
      blank: '  '
    });
    expect(index).toEqual({
      'Hello world': 'first.key',
      'hello world': 'first.key',
      'HELLO WORLD': 'first.key'
    });
  });

  it('resolves source text aliases in explicit language translations', () => {
    const service = TestBed.inject(I18nService);
    (service as any).applySourceBundle({ 'action.save': 'Save changes' });
    (service as any).applyBundle('hu', 'test', { 'action.save': 'Módosítások mentése' });

    expect(service.translateForLanguage(' Save   changes ', 'hu')).toBe('Módosítások mentése');
    expect(service.translateForLanguage('Save changes', 'en')).toBe('Save changes');
    expect(service.translateForLanguage('action.save', 'hu')).toBe('Módosítások mentése');
    expect(service.translateForLanguage('Unknown label', 'hu', 'Fallback')).toBe('Fallback');
  });

  it('translates composite labels from the English source bundle', async () => {
    get.mockImplementation((url: string) => {
      const bundle = {
        'activity.rates.group.preferences': 'Preferences',
        given: 'Given'
      };
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.1',
          messages: bundle
        });
      }
      if (url === `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`) {
        return of({
          lang: 'en',
          version: 'remote.2',
          data: bundle
        });
      }
      throw new Error(`Unexpected i18n request: ${url}`);
    });
    const service = TestBed.inject(I18nService);

    service.initialize();

    await vi.waitFor(() => {
      expect(service.translate('activity.rates.group.preferences · Given'))
        .toBe('Preferences · Given');
    });
  });

  it.each(['real', 'demo'] as const)('reuses the %s EN/HU cache when complete catalog versions match', async scope => {
    if (scope === 'demo') session.set({ kind: 'demo', userId: 'demo-user' });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['hu-HU', 'en-US']);
    const cached = {
      en: { lang: 'en', version: '2026.10.21.4', data: { greeting: `${scope} Hello` }, storedAt: 1 },
      hu: { lang: 'hu', version: '2026.10.21.4', data: { greeting: `${scope} Szia` }, storedAt: 1 }
    };
    bundleRepository.firstStoredBundle.mockResolvedValue(cached.hu);
    bundleRepository.readStoredBundle.mockImplementation(async (requestedScope, lang: keyof typeof cached) => {
      expect(requestedScope).toBe(scope);
      return cached[lang] ?? null;
    });
    get.mockImplementation((url, options) => {
      expect(url).toBe(`${environment.apiBaseUrl ?? '/api'}/i18n/bundle`);
      expect(options.params.get('version')).toBe('2026.10.21.4');
      return of({ lang: options.params.get('lang'), version: '2026.10.21.4', data: null });
    });
    const service = TestBed.inject(I18nService);
    service.initialize();
    await service.revalidate();
    expect(service.currentLanguage()).toBe('hu');
    expect(service.translate('greeting')).toBe(`${scope} Szia`);
    expect(apiRequestCount()).toBe(1);
    await service.ensureLanguageLoaded('en');
    expect(service.translateForLanguage('greeting', 'en')).toBe(`${scope} Hello`);
    expect(apiRequestCount()).toBe(2);
    expect(localAssetRequestCount()).toBe(0);
    expect(bundleRepository.writeStoredBundle).not.toHaveBeenCalled();
  });

  it('replaces cached entries and removes deleted keys when the complete version advances', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const cached = { lang: 'en', version: '2026.10.21.4', data: { greeting: 'Before', deleted: 'Old' }, storedAt: 1 };
    bundleRepository.readStoredBundle.mockResolvedValue(cached);
    get.mockImplementation((url, options) => {
      expect(url).toBe(`${environment.apiBaseUrl ?? '/api'}/i18n/bundle`);
      expect(options.params.get('version')).toBe('2026.10.21.4');
      return of({ lang: 'en', version: '2026.10.21.5', data: { greeting: 'After' } });
    });
    const service = TestBed.inject(I18nService);
    service.initialize();
    await service.revalidate();
    expect(service.translate('greeting')).toBe('After');
    expect(service.translate('deleted')).toBe('deleted');
    expect(bundleRepository.writeStoredBundle).toHaveBeenCalledWith('real', expect.objectContaining({
      version: '2026.10.21.5', data: { greeting: 'After' }
    }));
  });

  it('translates composite labels from the backend Hungarian bundle', async () => {
    vi.spyOn(window.navigator, 'languages', 'get')
      .mockReturnValue(['hu-HU', 'en-US']);
    get.mockImplementation((url: string, options?: { params?: { get(key: string): string | null } }) => {
      if (url !== `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`) {
        throw new Error(`Unexpected i18n request: ${url}`);
      }
      const lang = options?.params?.get('lang');
      return lang === 'hu'
        ? of({
          lang: 'hu',
          version: 'remote.hu.2',
          data: {
            'activity.rates.group.preferences': 'Szimpátiák',
            given: 'Adott'
          }
        })
        : of({
          lang: 'en',
          version: 'remote.en.2',
          data: {
            'activity.rates.group.preferences': 'Preferences',
            given: 'Given'
          }
        });
    });
    const service = TestBed.inject(I18nService);

    service.initialize();

    await vi.waitFor(() => {
      expect(service.translate('activity.rates.group.preferences · Given'))
        .toBe('Szimpátiák · Adott');
    });
    expect(localAssetRequestCount()).toBe(0);
  });

  it('uses Mongo-backed Hungarian install-prompt text in HTTP mode', async () => {
    vi.spyOn(window.navigator, 'languages', 'get')
      .mockReturnValue(['hu-HU', 'en-US']);
    get.mockImplementation((url: string, options?: { params?: { get(key: string): string | null } }) => {
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.en.1',
          messages: {
            'add.myscoutee.to.your.home.screen':
              'Add static {productName} to your home screen',
            'install.prompt.description':
              'Install static {productName} from your home screen'
          }
        });
      }
      if (url === 'assets/i18n/hu.json') {
        return of({
          lang: 'hu',
          version: 'static.hu.1',
          messages: {
            'add.myscoutee.to.your.home.screen':
              'Statikus {productName} hozzáadása',
            'install.prompt.description':
              'Statikus {productName} telepítése'
          }
        });
      }
      const lang = options?.params?.get('lang');
      return lang === 'hu'
        ? of({
          lang: 'hu',
          version: 'remote.hu.2',
          data: {
            'add.myscoutee.to.your.home.screen':
              'Szerveres {productName} hozzáadása',
            'install.prompt.description':
              'Szerveres {productName} telepítése'
          }
        })
        : of({
          lang: 'en',
          version: 'remote.en.2',
          data: {
            'add.myscoutee.to.your.home.screen':
              'Add server {productName} to your home screen',
            'install.prompt.description':
              'Install server {productName} from your home screen'
          }
        });
    });
    const service = TestBed.inject(I18nService);

    service.initialize();

    await vi.waitFor(() => {
      expect(service.translateParams(
        'add.myscoutee.to.your.home.screen',
        { productName: 'Operátor Márka' }
      )).toBe('Szerveres Operátor Márka hozzáadása');
      expect(service.translateParams(
        'install.prompt.description',
        { productName: 'Operátor Márka' }
      )).toBe('Szerveres Operátor Márka telepítése');
    });
    expect(bundleRepository.writeStoredBundle)
      .toHaveBeenCalledWith(
        'real',
        expect.objectContaining({ lang: 'hu', version: 'remote.hu.2' })
      );
    expect(localAssetRequestCount()).toBe(0);
  });

  it('does not use a local seed fallback in HTTP mode when Mongo is unavailable', async () => {
    get.mockImplementation((url: string) => {
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.1',
          messages: {
            'add.myscoutee.to.your.home.screen':
              'Add static {productName} to your home screen',
            'install.prompt.description':
              'Install static {productName} from your home screen'
          }
        });
      }
      return throwError(() => new Error('Mongo bundle unavailable'));
    });
    const service = TestBed.inject(I18nService);

    service.initialize();

    await vi.waitFor(() => {
      expect(apiRequestCount()).toBeGreaterThanOrEqual(1);
    });
    expect(service.translate('install.prompt.description'))
      .toBe('install.prompt.description');
    expect(localAssetRequestCount()).toBe(0);
  });

  it('revalidates the backend bundle when a newly deployed translation key is missing', async () => {
    let latestBundleAvailable = false;
    get.mockImplementation((url: string) => {
      if (url !== `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`) {
        throw new Error(`Unexpected i18n request: ${url}`);
      }
      return of(latestBundleAvailable
        ? {
          lang: 'en',
          version: 'remote.3',
          data: { 'event.editor.mingle.title': 'Mingle configuration' }
        }
        : {
          lang: 'en',
          version: 'remote.2',
          data: { existing: 'Existing translation' }
        });
    });
    const service = TestBed.inject(I18nService);
    service.initialize();

    await vi.waitFor(() => {
      expect(service.translate('existing')).toBe('Existing translation');
    });
    latestBundleAvailable = true;
    expect(service.translate('event.editor.mingle.title')).toBe('event.editor.mingle.title');

    await vi.waitFor(() => {
      expect(service.translate('event.editor.mingle.title')).toBe('Mingle configuration');
    });
    expect(apiRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it('shares the initial bundle load with revalidation and missing-key requests', async () => {
    const response = new Subject<unknown>();
    get.mockReturnValue(response);
    const service = TestBed.inject(I18nService);
    service.initialize();
    await vi.waitFor(() => expect(apiRequestCount()).toBe(1));
    const refresh = service.revalidate();
    expect(service.translate('initial.translation.key')).toBe('initial.translation.key');
    expect((service as any).missingKeyRefreshTimer).toBeNull();
    expect(apiRequestCount()).toBe(1);
    response.next({lang:'en', version:'remote.2', data:{'initial.translation.key':'Ready'}});
    response.complete();
    await refresh;
    expect(service.translate('initial.translation.key')).toBe('Ready');
    expect(apiRequestCount()).toBe(1);
  });

  it('uses local seed bundles when the application has no backend', async () => {
    environment.activitiesDataSource = 'local';
    get.mockImplementation((url: string) => {
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.1',
          messages: {
            'install.prompt.description':
              'Install static {productName} from your home screen'
          }
        });
      }
      throw new Error(`Unexpected i18n request: ${url}`);
    });
    const service = TestBed.inject(I18nService);

    service.initialize();

    await vi.waitFor(() => {
      expect(service.translateParams(
        'install.prompt.description',
        { productName: 'Local Brand' }
      )).toBe('Install static Local Brand from your home screen');
    });
    expect(apiRequestCount()).toBe(0);
    expect(localAssetRequestCount()).toBe(1);
  });

  it.each(['hu', 'de', 'es'])('loads only the browser language %s for the standalone landing', async lang => {
    environment.activitiesDataSource = 'local';
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([lang, 'en-US']);
    get.mockImplementation(url => {
      expect(url).toBe(`assets/i18n/${lang}.json`);
      return of({ lang, version: 'static.1', messages: { greeting: `${lang} greeting` } });
    });
    const service = TestBed.inject(I18nService);
    await service.initialize();
    expect(service.currentLanguage()).toBe(lang);
    expect(service.translate('greeting')).toBe(`${lang} greeting`);
    expect(localAssetRequestCount()).toBe(1);
    expect(apiRequestCount()).toBe(0);
  });

  it('reloads from the isolated demo bundle when the HTTP session changes', async () => {
    get.mockImplementation((url: string) => {
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.1',
          messages: { greeting: 'Static greeting' }
        });
      }
      const demo = session()?.kind === 'demo';
      return of({
        lang: 'en',
        version: demo ? 'demo.2' : 'real.2',
        data: { greeting: demo ? 'Demo greeting' : 'Real greeting' }
      });
    });
    const service = TestBed.inject(I18nService);
    service.initialize();
    await vi.waitFor(() => {
      expect(service.translate('greeting')).toBe('Real greeting');
    });

    session.set({ kind: 'demo', userId: 'demo-user' });
    TestBed.tick();

    await vi.waitFor(() => {
      expect(service.translate('greeting')).toBe('Demo greeting');
    });
    expect(bundleRepository.writeStoredBundle)
      .toHaveBeenCalledWith(
        'demo',
        expect.objectContaining({ lang: 'en', version: 'demo.2' })
      );
  });

  it('ignores a late response from the previous HTTP session', async () => {
    const realResponse = new Subject<{
      lang: string;
      version: string;
      data: Record<string, string>;
    }>();
    const demoResponse = new Subject<{
      lang: string;
      version: string;
      data: Record<string, string>;
    }>();
    get.mockImplementation((url: string) => {
      if (url === 'assets/i18n/en.json') {
        return of({
          lang: 'en',
          version: 'static.1',
          messages: { greeting: 'Static greeting' }
        });
      }
      return session()?.kind === 'demo'
        ? demoResponse
        : realResponse;
    });
    const service = TestBed.inject(I18nService);
    service.initialize();
    await vi.waitFor(() => {
      expect(apiRequestCount()).toBe(1);
    });

    session.set({ kind: 'demo', userId: 'demo-user' });
    TestBed.tick();
    await vi.waitFor(() => {
      expect(apiRequestCount()).toBe(2);
    });
    demoResponse.next({
      lang: 'en',
      version: 'demo.2',
      data: { greeting: 'Demo greeting' }
    });
    demoResponse.complete();
    await vi.waitFor(() => {
      expect(service.translate('greeting')).toBe('Demo greeting');
    });

    realResponse.next({
      lang: 'en',
      version: 'real.2',
      data: { greeting: 'Stale real greeting' }
    });
    realResponse.complete();
    await Promise.resolve();

    expect(service.translate('greeting')).toBe('Demo greeting');
  });

  describe('incremental DOM translation', () => {
    let dom: {
      installDomObserver(): void;
      applySourceBundle(messages: Record<string, string>): void;
      applyBundle(lang: string, version: string, messages: Record<string, string>): void;
      domObserver: MutationObserver | null;
      translateTextNode(node: Text): void;
    };
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      frames = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
        frames.push(callback);
        return frames.length;
      });
      dom = TestBed.inject(I18nService) as unknown as typeof dom;
      dom.applySourceBundle({ save: 'Save', cancel: 'Cancel' });
      dom.applyBundle('hu', 'test', { save: 'Mentés', cancel: 'Mégse' });
      dom.installDomObserver();
    });

    afterEach(() => dom.domObserver?.disconnect());

    async function flushDom(): Promise<void> {
      await Promise.resolve();
      const pending = frames.splice(0);
      pending.forEach(callback => callback(0));
      await Promise.resolve();
    }

    it('translates inserted descendants and attributes without rescanning unchanged text', async () => {
      const document = TestBed.inject(DOCUMENT);
      document.body.innerHTML = '<span id="retained">Save</span>';
      await flushDom();
      await flushDom();
      const retained = document.getElementById('retained')!.firstChild as Text;
      const translate = vi.spyOn(dom, 'translateTextNode');
      const added = document.createElement('section');
      added.innerHTML = '<button title="Cancel"><span>Save</span></button>';
      document.body.append(added);
      await flushDom();
      expect(added.textContent).toBe('Mentés');
      expect(added.querySelector('button')!.title).toBe('Mégse');
      expect(translate.mock.calls.some(([node]) => node === retained)).toBe(false);
    });

    it('updates changed text and attributes and ignores a removed subtree', async () => {
      const document = TestBed.inject(DOCUMENT);
      document.body.innerHTML = '<button title="Save">Save</button>';
      await flushDom();
      await flushDom();
      const button = document.querySelector('button')!;
      button.firstChild!.textContent = 'Cancel';
      button.title = 'Cancel';
      const removed = document.createElement('span');
      removed.textContent = 'Save';
      document.body.append(removed);
      removed.remove();
      await flushDom();
      expect(button.textContent).toBe('Mégse');
      expect(button.title).toBe('Mégse');
      expect(removed.textContent).toBe('Save');
    });

    it('visits overlapping inserted subtrees once', async () => {
      const document = TestBed.inject(DOCUMENT);
      await flushDom();
      const translate = vi.spyOn(dom, 'translateTextNode');
      const parent = document.createElement('section');
      document.body.append(parent);
      const child = document.createElement('span');
      parent.append(child);
      child.textContent = 'Save';
      await flushDom();
      expect(child.textContent).toBe('Mentés');
      expect(translate.mock.calls.filter(([node]) => node === child.firstChild)).toHaveLength(1);
    });

    it('retranslates unchanged content when the language bundle changes', async () => {
      const document = TestBed.inject(DOCUMENT);
      document.body.innerHTML = '<button title="Cancel">Save</button>';
      await flushDom();
      await flushDom();
      dom.applyBundle('en', 'test', { save: 'Save', cancel: 'Cancel' });
      await flushDom();
      expect(document.querySelector('button')!.textContent).toBe('Save');
      expect(document.querySelector('button')!.title).toBe('Cancel');
    });
  });

  function apiRequestCount(): number {
    return get.mock.calls.filter(
      ([url]) => url === `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`
    ).length;
  }

  function localAssetRequestCount(): number {
    return get.mock.calls.filter(
      ([url]) => `${url}`.startsWith('assets/i18n/')
    ).length;
  }
});

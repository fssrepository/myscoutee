import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { I18nBundleRepository } from '../repositories/i18n-bundle.repository';
import { I18nService } from './i18n.service';
import { type AppSession, SessionService } from './session.service';

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
      expect(apiRequestCount()).toBe(1);
    });
    expect(service.translate('install.prompt.description'))
      .toBe('install.prompt.description');
    expect(localAssetRequestCount()).toBe(0);
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

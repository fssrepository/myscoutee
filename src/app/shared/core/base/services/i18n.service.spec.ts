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

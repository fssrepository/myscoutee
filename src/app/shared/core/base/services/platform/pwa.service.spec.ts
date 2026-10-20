import { Injector, runInInjectionContext } from '@angular/core';
import { PwaService } from './pwa.service';
import { environment } from '../../../../../../environments/environment';

describe('Browser opening without a browser-brand allowlist', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fixture(userAgent: string, href = 'https://myscoutee.com/?mode=work&utm_source=instagram#about', standalone = false) {
    const assign = vi.fn(), open = vi.fn();
    vi.stubGlobal('navigator', { userAgent });
    vi.stubGlobal('window', { open, navigator: {}, matchMedia: () => ({ matches: standalone }), location: { href, assign } });
    const service = Object.create(PwaService.prototype) as PwaService;
    return { service, assign, open };
  }

  it.each([
    'Mozilla/5.0 (Linux; Android 13; wv) Chrome/140.0 Instagram 400.0',
    'Mozilla/5.0 (Linux; Android 13) Chrome/140.0 [FBAN/FB4A;FBAV/500.0]',
    'Mozilla/5.0 (Linux; Android 13) Chrome/140.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
    'Android UnknownBrowser'
  ])('retains Android URL handling without filtering browser names: %s', userAgent => {
    const { service, assign, open } = fixture(userAgent);
    expect(service.externalBrowserAvailable).toBe(true);
    service.openInBrowser();
    expect(assign).toHaveBeenCalledExactlyOnceWith('intent://myscoutee.com/?mode=work&utm_source=instagram#about#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end');
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0',
    'UnknownBrowser'
  ])('offers standard browser navigation on other platforms: %s', userAgent => {
    const { service, assign, open } = fixture(userAgent);
    expect(service.externalBrowserAvailable).toBe(true);
    service.openInBrowser();
    expect(open).toHaveBeenCalledExactlyOnceWith('https://myscoutee.com/?mode=work&utm_source=instagram#about', '_blank', 'noopener,noreferrer');
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_2 like Mac OS X) Version/18.3.1 Mobile Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 400.0',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Safari/604.1'
  ])('requests Safari on iOS without a browser-brand filter: %s', userAgent => {
    const { service, assign, open } = fixture(userAgent);
    expect(service.externalBrowserAvailable).toBe(true);
    service.openInBrowser();
    expect(open).toHaveBeenCalledExactlyOnceWith('x-safari-https://myscoutee.com/?mode=work&utm_source=instagram#about', '_blank', 'noopener,noreferrer');
    expect(assign).not.toHaveBeenCalled();
  });

  it('recognizes an iPad using its desktop user agent', () => {
    const { service, open } = fixture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1');
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1', platform: 'MacIntel', maxTouchPoints: 5 });
    service.openInBrowser();
    expect(open).toHaveBeenCalledExactlyOnceWith('x-safari-https://myscoutee.com/?mode=work&utm_source=instagram#about', '_blank', 'noopener,noreferrer');
  });

  it('changes only the leading scheme and preserves URLs inside the query', () => {
    const { service, open } = fixture('iPhone', 'https://myscoutee.com/?next=https://example.test/path#anchor');
    service.openInBrowser();
    expect(open).toHaveBeenCalledExactlyOnceWith('x-safari-https://myscoutee.com/?next=https://example.test/path#anchor', '_blank', 'noopener,noreferrer');
  });

  it('keeps ordinary HTTP navigation on iOS instead of applying an HTTPS-only scheme', () => {
    const { service, open } = fixture('iPhone', 'http://localhost/');
    service.openInBrowser();
    expect(open).toHaveBeenCalledExactlyOnceWith('http://localhost/', '_blank', 'noopener,noreferrer');
  });

  it('offers browser navigation from an installed app as well', () => {
    const { service, open } = fixture('iPhone Safari', 'https://myscoutee.com/', true);
    expect(service.externalBrowserAvailable).toBe(true);
    service.openInBrowser();
    expect(open).toHaveBeenCalledOnce();
  });

  it.each(['javascript:alert(1)', 'https://name:password@myscoutee.com/'])('does not forward unsafe URLs: %s', href => {
    const { service, assign, open } = fixture('Android Instagram', href);
    service.openInBrowser();
    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('does not offer an opening action when the browser has no window-opening API', () => {
    const { service, assign } = fixture('UnknownBrowser');
    vi.stubGlobal('window', { location: { href: 'https://myscoutee.com/', assign } });
    expect(service.externalBrowserAvailable).toBe(false);
    service.openInBrowser();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('PWA service-worker configuration', () => {
  it('does not use a browser preference to override deployment configuration', () => {
    const service = Object.create(PwaService.prototype);
    expect(service.shouldEnableServiceWorker()).toBe('serviceWorker' in navigator && environment.serviceWorkerEnabled);
  });
});

describe('PWA native install decision and completion', () => {
  function fixture() {
    const service = runInInjectionContext(Injector.create({ providers: [] }), () => new PwaService());
    vi.spyOn(service as any, 'setInstallDismissed').mockImplementation(() => {});
    let decide!: (value: { outcome: 'accepted' | 'dismissed' }) => void;
    const userChoice = new Promise<{ outcome: 'accepted' | 'dismissed' }>(resolve => { decide = resolve; });
    const prompt = vi.fn(async () => {});
    (service as any).onBeforeInstallPrompt({ preventDefault() {}, prompt, userChoice });
    return { service, prompt, decide, installed: () => (service as any).onAppInstalled() };
  }

  it('disables while the native dialog is open without a ring, and cancels without installation', async () => {
    const f = fixture();
    const result = f.service.promptInstall();
    expect(f.service.installActionPending()).toBe(true);
    expect(f.service.installBusy()).toBe(false);
    expect(await f.service.promptInstall()).toBe(false);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    f.decide({ outcome: 'dismissed' });
    expect(await result).toBe(false);
    expect(f.service.installActionPending()).toBe(false);
    expect(f.service.installBusy()).toBe(false);
    expect(await f.service.promptInstall()).toBe(false);
  });

  it('shows installation progress only after acceptance and clears it on appinstalled', async () => {
    const f = fixture();
    const result = f.service.promptInstall();
    f.decide({ outcome: 'accepted' });
    expect(await result).toBe(true);
    expect(f.service.installActionPending()).toBe(true);
    expect(f.service.installBusy()).toBe(true);
    f.installed();
    expect(f.service.installActionPending()).toBe(false);
    expect(f.service.installBusy()).toBe(false);
  });

  it('does not restart the ring when appinstalled precedes the choice continuation', async () => {
    const f = fixture();
    const result = f.service.promptInstall();
    f.installed();
    f.decide({ outcome: 'accepted' });
    expect(await result).toBe(true);
    expect(f.service.installActionPending()).toBe(false);
    expect(f.service.installBusy()).toBe(false);
  });

  it('releases the action on native prompt failure without reusing the consumed event', async () => {
    const f = fixture();
    f.prompt.mockRejectedValueOnce(new Error('Native prompt unavailable'));
    expect(await f.service.promptInstall()).toBe(false);
    expect(f.service.installActionPending()).toBe(false);
    expect(f.service.installBusy()).toBe(false);
    expect(await f.service.promptInstall()).toBe(false);
    expect(f.prompt).toHaveBeenCalledTimes(1);
  });
});

describe('PWA refresh after a completed deployment', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fixture() {
    const service = runInInjectionContext(Injector.create({ providers: [] }), () => new PwaService());
    const reload = vi.spyOn(service as any, 'reloadPage').mockImplementation(() => {});
    return { service, reload };
  }

  it('activates the installed worker before reload, including a rollback to an older bundle', async () => {
    const events: string[] = [];
    const workers = new EventTarget();
    const worker = { postMessage: vi.fn(() => {
      events.push('activate');
      workers.dispatchEvent(new Event('controllerchange'));
    }) };
    const registration = {
      update: vi.fn(async () => { events.push('update'); }),
      waiting: worker
    };
    vi.stubGlobal('navigator', { serviceWorker: Object.assign(workers, {
      getRegistration: vi.fn(async () => registration)
    }) });
    const { service, reload } = fixture();
    reload.mockImplementation(() => { events.push('reload'); });
    await service.reloadAfterDeploymentChange();
    expect(events).toEqual(['update', 'activate', 'reload']);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once when no service worker is configured', async () => {
    vi.stubGlobal('navigator', {});
    const { service, reload } = fixture();
    await service.reloadAfterDeploymentChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not report an installation failure if the worker refresh fails', async () => {
    vi.stubGlobal('navigator', { serviceWorker: {
      getRegistration: vi.fn(async () => ({ update: vi.fn().mockRejectedValue(new Error('offline')) }))
    } });
    const { service, reload } = fixture();
    await expect(service.reloadAfterDeploymentChange()).resolves.toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('PWA automatic frontend release checks', () => {
  const originalProduction = environment.production;

  afterEach(() => {
    environment.production = originalProduction;
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function fixture() {
    return runInInjectionContext(Injector.create({ providers: [] }), () => new PwaService());
  }

  it('shares startup version metadata with the label and still fetches a later deployment', async () => {
    const fetchVersion = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({version:'1.4.4',buildId:'current-build'})))
      .mockResolvedValueOnce(new Response(JSON.stringify({version:'1.4.4',buildId:'next-build'})));
    vi.stubGlobal('fetch', fetchVersion);
    const service = fixture();
    await (service as any).loadAppVersionLabel();
    expect(service.appVersionLabel()).toBe('v1.4.4');
    expect(await (service as any).fetchLatestBuildId()).toBe('current-build');
    expect(fetchVersion).toHaveBeenCalledTimes(1);
    expect(await (service as any).fetchLatestBuildId()).toBe('next-build');
    expect(fetchVersion).toHaveBeenCalledTimes(2);
  });

  it('checks on registration and whenever a visible browser or WebView returns to the foreground', async () => {
    const registration = new EventTarget() as ServiceWorkerRegistration;
    const register = vi.fn(async () => registration);
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    const service = fixture();
    const check = vi.spyOn(service as any, 'requestBundleUpdateCheck').mockResolvedValue(undefined);
    const windowListeners = vi.spyOn(window, 'addEventListener');
    const documentListeners = vi.spyOn(document, 'addEventListener');

    await (service as any).registerServiceWorker();

    expect(register).toHaveBeenCalledWith(
      new URL('app-sw.js', document.baseURI).toString(),
      { updateViaCache: 'none' }
    );
    expect(check).toHaveBeenCalledWith(registration);
    expect(windowListeners).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(windowListeners).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(windowListeners).toHaveBeenCalledWith('online', expect.any(Function));
    expect(documentListeners).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    (service as any).onApplicationForegrounded();
    expect(check).toHaveBeenLastCalledWith(registration);

    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    const checksBeforeHiddenEvent = check.mock.calls.length;
    (service as any).onApplicationForegrounded();
    expect(check).toHaveBeenCalledTimes(checksBeforeHiddenEvent);
    if (visibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    }
  });

  it('rechecks when installation finishes after the initial update check has already returned', async () => {
    const worker = Object.assign(new EventTarget(), { state: 'installing' });
    const registration = Object.assign(new EventTarget(), { installing: worker });
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn(async () => registration) } });
    const service = fixture();
    const check = vi.spyOn(service as any, 'requestBundleUpdateCheck').mockResolvedValue(undefined);

    await (service as any).registerServiceWorker();
    expect(check).toHaveBeenCalledTimes(1);
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    expect(check).toHaveBeenCalledTimes(2);
    expect(check).toHaveBeenLastCalledWith(registration);
  });

  it('downloads and activates a different public build automatically, then reloads once', async () => {
    environment.production = true;
    const service = fixture();
    const waitingWorker = {} as ServiceWorker;
    const registration = { update: vi.fn(async () => undefined) } as unknown as ServiceWorkerRegistration;
    vi.spyOn(service as any, 'readDocumentBuildId').mockReturnValue('old-build');
    vi.spyOn(service as any, 'fetchLatestBuildId').mockResolvedValue('new-build');
    vi.spyOn(service as any, 'waitForWaitingWorker').mockResolvedValue(waitingWorker);
    const activate = vi.spyOn(service as any, 'activateWaitingWorker').mockResolvedValue(undefined);
    const reload = vi.spyOn(service as any, 'reloadPage').mockImplementation(() => {});

    await (service as any).requestBundleUpdateCheck(registration);

    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(waitingWorker);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('activates the cached release when the network already served its current page without another reload', async () => {
    environment.production = true;
    const service = fixture();
    const waitingWorker = {} as ServiceWorker;
    const registration = { update: vi.fn(async () => undefined) } as unknown as ServiceWorkerRegistration;
    vi.spyOn(service as any, 'readDocumentBuildId').mockReturnValue('current-build');
    vi.spyOn(service as any, 'fetchLatestBuildId').mockResolvedValue('current-build');
    vi.spyOn(service as any, 'waitForWaitingWorker').mockResolvedValue(waitingWorker);
    const activate = vi.spyOn(service as any, 'activateWaitingWorker').mockResolvedValue(undefined);
    const reload = vi.spyOn(service as any, 'reloadPage').mockImplementation(() => {});

    await (service as any).requestBundleUpdateCheck(registration);

    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(waitingWorker);
    expect(reload).not.toHaveBeenCalled();
  });

  it('deduplicates simultaneous foreground checks without suppressing the next later check', async () => {
    environment.production = true;
    const service = fixture();
    const registration = {} as ServiceWorkerRegistration;
    let finishCheck!: () => void;
    const check = vi.spyOn(service as any, 'checkForBundleUpdate').mockImplementation(
      () => new Promise<void>(resolve => { finishCheck = resolve; })
    );

    const first = (service as any).requestBundleUpdateCheck(registration);
    const simultaneous = (service as any).requestBundleUpdateCheck(registration);
    expect(check).toHaveBeenCalledTimes(1);
    finishCheck();
    await Promise.all([first, simultaneous]);

    const later = (service as any).requestBundleUpdateCheck(registration);
    finishCheck();
    await later;
    expect(check).toHaveBeenCalledTimes(2);
  });
});

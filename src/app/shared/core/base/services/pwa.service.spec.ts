import { Injector, runInInjectionContext } from '@angular/core';
import { PwaService } from './pwa.service';
import { environment } from '../../../../../environments/environment';

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

  it('checks on registration and whenever a visible browser or WebView returns to the foreground', async () => {
    const registration = {} as ServiceWorkerRegistration;
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

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

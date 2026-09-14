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

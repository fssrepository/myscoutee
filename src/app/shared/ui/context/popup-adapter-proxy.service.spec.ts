import { TestBed } from '@angular/core/testing';
import { POPUP_ADAPTER, POPUP_ADAPTER_LOADERS, POPUP_WARMUP } from './popup-adapter-loaders';
import { PopupAdapterProxyService } from './popup-adapter-proxy.service';
import { ActivitiesPopupStore } from './stores/activity/activities-popup.store';
import { ProfileStore } from './stores/profile/profile.store';
import { ADAPTER_MODE_LOADERS } from '../../core/base/adapter-loaders';
import { environment } from '../../../../environments/environment';

describe('PopupAdapterProxyService', () => {
  const originalMode = environment.activitiesDataSource;
  const frames = new Map<number, FrameRequestCallback>();
  let frame = 0;
  function paint() {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(0);
    }
  }
  beforeEach(() => {
    environment.activitiesDataSource = 'local';
    vi.spyOn(ADAPTER_MODE_LOADERS, 'local').mockResolvedValue({} as any);
    frames.clear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frame, callback);
      return frame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });
  afterEach(() => {
    environment.activitiesDataSource = originalMode;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('does not load features when stores and the shared proxy are constructed', () => {
    const loaders = Object.values(POPUP_ADAPTER).map(key => vi.spyOn(POPUP_ADAPTER_LOADERS, key));
    TestBed.inject(ProfileStore);
    TestBed.inject(ActivitiesPopupStore);
    expect(loaders.every(loader => loader.mock.calls.length === 0)).toBe(true);
    expect(ADAPTER_MODE_LOADERS.local).not.toHaveBeenCalled();
  });

  it('waits for workspace adapters and the popup together before returning the component', async () => {
    let ready!: () => void;
    vi.mocked(ADAPTER_MODE_LOADERS.local).mockReturnValue(new Promise(resolve => ready = () => resolve({} as any)));
    const module = { ProfileViewPopupComponent: class {} };
    vi.spyOn(POPUP_ADAPTER_LOADERS, POPUP_ADAPTER.PROFILE_VIEW_POPUP).mockResolvedValue(module as any);
    let completed = false;
    const pending = TestBed.inject(PopupAdapterProxyService).load(POPUP_ADAPTER.PROFILE_VIEW_POPUP)
      .then(value => { completed = true; return value; });
    await Promise.resolve();
    await Promise.resolve();
    expect(completed).toBe(false);
    ready();
    expect(await pending).toBe(module);
    expect(ADAPTER_MODE_LOADERS.local).toHaveBeenCalledTimes(1);
  });

  it('shares a pending preparation with explicit opening and keeps it cached', async () => {
    let finish!: (value: any) => void;
    const pending = new Promise<any>(resolve => { finish = resolve; });
    const loader = vi.spyOn(POPUP_ADAPTER_LOADERS, POPUP_ADAPTER.PROFILE_VIEW_POPUP).mockReturnValue(pending);
    const proxy = TestBed.inject(PopupAdapterProxyService);
    const profiles = TestBed.inject(ProfileStore);
    proxy.prepare(POPUP_WARMUP.activityRates);
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    paint(); paint();
    await Promise.resolve();
    expect(loader).toHaveBeenCalledOnce();
    expect(profiles.profileViewOpen()).toBe(false);
    expect(profiles.profileViewPopupComponent()).toBeNull();
    const opening = profiles.ensureProfileViewPopupLoaded();
    class ProfileView {}
    const module = { ProfileViewPopupComponent: ProfileView };
    finish(module);
    await opening;
    expect(profiles.profileViewPopupComponent()).toBe(ProfileView);
    expect(profiles.profileViewOpen()).toBe(false);
    expect(await proxy.load(POPUP_ADAPTER.PROFILE_VIEW_POPUP)).toBe(module);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('allows a failed warmup to retry on demand and exposes an opening failure', async () => {
    const error = new Error('network unavailable');
    const loader = vi.spyOn(POPUP_ADAPTER_LOADERS, POPUP_ADAPTER.PROFILE_VIEW_POPUP).mockRejectedValue(error);
    const proxy = TestBed.inject(PopupAdapterProxyService);
    proxy.prepare(POPUP_WARMUP.activityRates);
    paint(); paint();
    await new Promise(resolve => setTimeout(resolve));
    await expect(proxy.load(POPUP_ADAPTER.PROFILE_VIEW_POPUP)).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(2);
    loader.mockResolvedValue({} as any);
    await proxy.load(POPUP_ADAPTER.PROFILE_VIEW_POPUP);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('cancels preparation if its list closes before painting', async () => {
    const loader = vi.spyOn(POPUP_ADAPTER_LOADERS, POPUP_ADAPTER.PROFILE_VIEW_POPUP);
    const controller = new AbortController();
    TestBed.inject(PopupAdapterProxyService).prepare(POPUP_WARMUP.activityRates, controller.signal);
    controller.abort();
    paint(); paint();
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('uses one module promise for different callers of the shared member picker', async () => {
    const module = {} as any;
    const loader = vi.spyOn(POPUP_ADAPTER_LOADERS, POPUP_ADAPTER.ASSET_MEMBER_PICKER_POPUP).mockResolvedValue(module);
    const proxy = TestBed.inject(PopupAdapterProxyService);
    const first = proxy.load(POPUP_ADAPTER.ASSET_MEMBER_PICKER_POPUP);
    expect(proxy.load(POPUP_ADAPTER.ASSET_MEMBER_PICKER_POPUP)).toBe(first);
    expect(await first).toBe(module);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('loads public surfaces without starting workspace adapters', async () => {
    const proxy = TestBed.inject(PopupAdapterProxyService);
    for (const key of [POPUP_ADAPTER.EXPLANATION_GUIDE, POPUP_ADAPTER.EXPLANATION_DOCUMENT, POPUP_ADAPTER.APP_SETUP, POPUP_ADAPTER.PAYMENT_AUTHORIZATION, POPUP_ADAPTER.DOCUMENT_VIEWER]) {
      const module = {} as any;
      const loader = vi.spyOn(POPUP_ADAPTER_LOADERS, key).mockResolvedValue(module);
      const first = proxy.load(key);
      expect(proxy.load(key)).toBe(first);
      expect(await first).toBe(module);
      expect(loader).toHaveBeenCalledOnce();
    }
    expect(ADAPTER_MODE_LOADERS.local).not.toHaveBeenCalled();
  });
});

import { TestBed } from '@angular/core/testing';
import { POPUP_ADAPTER, POPUP_ADAPTER_LOADERS, POPUP_WARMUP } from './popup-adapter-loaders';
import { PopupAdapterProxyService } from './popup-adapter-proxy.service';
import { ActivitiesPopupStore } from './stores/activity/activities-popup.store';
import { ProfileStore } from './stores/profile/profile.store';

describe('PopupAdapterProxyService', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frame = 0;
  function paint() {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(0);
    }
  }
  beforeEach(() => {
    frames.clear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frame, callback);
      return frame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('does not load features when stores and the shared proxy are constructed', () => {
    const loaders = Object.values(POPUP_ADAPTER).map(key => vi.spyOn(POPUP_ADAPTER_LOADERS, key));
    TestBed.inject(ProfileStore);
    TestBed.inject(ActivitiesPopupStore);
    expect(loaders.every(loader => loader.mock.calls.length === 0)).toBe(true);
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
});

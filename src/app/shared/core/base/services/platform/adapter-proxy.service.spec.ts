import { TestBed } from '@angular/core/testing';

import { ADAPTER_LOADERS, cachedAdapterType, HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { HttpUserExperiencesService } from '../../../http/services/accounts/user-experiences.service';
import { LocalUserExperiencesService } from '../../../local/source/services/accounts/user-experiences.service';
import { AdapterProxyService } from './adapter-proxy.service';

describe('AdapterProxyService', () => {
  const local = { queryUserExperiences: vi.fn(), saveUserExperiences: vi.fn() };
  const http = { queryUserExperiences: vi.fn(), saveUserExperiences: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: LocalUserExperiencesService, useValue: local },
      { provide: HttpUserExperiencesService, useValue: http }
    ] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads neither implementation when the proxy is constructed', () => {
    const localLoader = vi.spyOn(ADAPTER_LOADERS, LOCAL_ADAPTER.USER_EXPERIENCES);
    const httpLoader = vi.spyOn(ADAPTER_LOADERS, HTTP_ADAPTER.USER_EXPERIENCES);
    TestBed.inject(AdapterProxyService);
    expect(localLoader).not.toHaveBeenCalled();
    expect(httpLoader).not.toHaveBeenCalled();
  });

  it('shares an in-flight import and keeps the existing Angular singleton', async () => {
    let finish!: (value: typeof LocalUserExperiencesService) => void;
    const imported = new Promise<typeof LocalUserExperiencesService>(resolve => { finish = resolve; });
    const loader = vi.spyOn(ADAPTER_LOADERS, LOCAL_ADAPTER.USER_EXPERIENCES).mockReturnValue(imported);
    const unusedLoader = vi.spyOn(ADAPTER_LOADERS, HTTP_ADAPTER.USER_EXPERIENCES);
    const proxy = TestBed.inject(AdapterProxyService);
    const first = proxy.get(LOCAL_ADAPTER.USER_EXPERIENCES);
    const second = proxy.get(LOCAL_ADAPTER.USER_EXPERIENCES);
    expect(first).toBe(second);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    finish(LocalUserExperiencesService);
    expect(await first).toBe(TestBed.inject(LocalUserExperiencesService));
    expect(await proxy.get(LOCAL_ADAPTER.USER_EXPERIENCES)).toBe(local);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(unusedLoader).not.toHaveBeenCalled();
  });

  it('loads HTTP independently without loading local code', async () => {
    const localLoader = vi.spyOn(ADAPTER_LOADERS, LOCAL_ADAPTER.USER_EXPERIENCES);
    const httpLoader = vi.spyOn(ADAPTER_LOADERS, HTTP_ADAPTER.USER_EXPERIENCES)
      .mockResolvedValue(HttpUserExperiencesService);
    expect(await TestBed.inject(AdapterProxyService).get(HTTP_ADAPTER.USER_EXPERIENCES)).toBe(http);
    expect(httpLoader).toHaveBeenCalledTimes(1);
    expect(localLoader).not.toHaveBeenCalled();
  });

  it('propagates a failed import and permits a subsequent caller to retry it', async () => {
    const failure = new Error('chunk unavailable');
    const loader = vi.spyOn(ADAPTER_LOADERS, LOCAL_ADAPTER.USER_EXPERIENCES)
      .mockRejectedValueOnce(failure).mockResolvedValue(LocalUserExperiencesService);
    const proxy = TestBed.inject(AdapterProxyService);
    await expect(proxy.get(LOCAL_ADAPTER.USER_EXPERIENCES)).rejects.toBe(failure);
    expect(await proxy.get(LOCAL_ADAPTER.USER_EXPERIENCES)).toBe(local);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('preserves synchronous reads and method binding while leaving the counterpart unconstructed', async () => {
    const items: unknown[] = [];
    const localInstance = { items, peekItemsByUser() { return this.items; } };
    const localFactory = vi.fn(() => localInstance);
    const httpFactory = vi.fn(() => ({}));
    const localType = cachedAdapterType(LOCAL_ADAPTER.EVENTS)!;
    const httpType = cachedAdapterType(HTTP_ADAPTER.EVENTS)!;
    TestBed.configureTestingModule({ providers: [
      { provide: localType, useFactory: localFactory },
      { provide: httpType, useFactory: httpFactory }
    ] });
    const proxy = TestBed.inject(AdapterProxyService);
    const localReference = proxy.reference(LOCAL_ADAPTER.EVENTS);
    proxy.reference(HTTP_ADAPTER.EVENTS);
    expect(localFactory).not.toHaveBeenCalled();
    expect(httpFactory).not.toHaveBeenCalled();
    expect(localReference.peekItemsByUser('actor')).toBe(items);
    expect(localReference.peekItemsByUser('actor')).toBe(items);
    expect(await proxy.get(LOCAL_ADAPTER.EVENTS)).toBe(TestBed.inject(localType));
    expect(localFactory).toHaveBeenCalledTimes(1);
    expect(httpFactory).not.toHaveBeenCalled();
  });
});

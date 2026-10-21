import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../../environments/environment';
import { cachedAdapterType, HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { SessionService } from './session.service';
import { FollowingService } from './following.service';

describe('FollowingService selected-adapter lifecycle', () => {
  const original = environment.activitiesDataSource;
  afterEach(() => {
    environment.activitiesDataSource = original;
    TestBed.resetTestingModule();
  });
  it.each(['local', 'http'] as const)('activates the %s adapter at owner construction without constructing the counterpart', mode => {
    environment.activitiesDataSource = mode;
    const local = vi.fn(() => ({ members: vi.fn() }));
    const http = vi.fn(() => ({ members: vi.fn() }));
    TestBed.configureTestingModule({ providers: [
      { provide: SessionService, useValue: {} },
      { provide: cachedAdapterType(LOCAL_ADAPTER.FOLLOWING)!, useFactory: local },
      { provide: cachedAdapterType(HTTP_ADAPTER.FOLLOWING)!, useFactory: http }
    ] });
    TestBed.inject(FollowingService);
    expect(mode === 'local' ? local : http).toHaveBeenCalledOnce();
    expect(mode === 'local' ? http : local).not.toHaveBeenCalled();
  });
});

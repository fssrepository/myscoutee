import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../../../../environments/environment';
import type { ExperienceEntry } from '../../../contracts/accounts/profile.interface';
import { ADAPTER_LOADERS, HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { HttpUserExperiencesService } from '../../../http/services/accounts/user-experiences.service';
import { LocalUserExperiencesService } from '../../../local/source/services/accounts/user-experiences.service';
import { LocalMemoryDb } from '../../../common/app.db';
import { PROFILE_EXPERIENCES_TABLE_NAME } from '../../../local/source/entity/accounts/profile.entity';
import { RouteDelayService } from '../platform/route-delay.service';
import { ExperienceDocumentImportService } from './experience-document-import.service';
import { SessionService } from './session.service';
import { UserExperiencesService } from './user-experiences.service';

describe('UserExperiencesService adapter boundary', () => {
  const originalMode = environment.activitiesDataSource;
  const entries: ExperienceEntry[] = [{ id: 'experience', type: 'Workspace', title: 'Engineer',
    org: 'Team', city: '', dateFrom: '', dateTo: 'Present', description: '' }];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: SessionService, useValue: {} },
      { provide: ExperienceDocumentImportService, useValue: {} },
      { provide: LocalUserExperiencesService, useValue: {
        queryUserExperiences: vi.fn().mockResolvedValue(entries),
        saveUserExperiences: vi.fn().mockResolvedValue(entries)
      } },
      { provide: HttpUserExperiencesService, useValue: {
        queryUserExperiences: vi.fn().mockResolvedValue(entries),
        saveUserExperiences: vi.fn().mockResolvedValue(entries)
      } }
    ] });
    vi.spyOn(ADAPTER_LOADERS, LOCAL_ADAPTER.USER_EXPERIENCES).mockResolvedValue(LocalUserExperiencesService);
    vi.spyOn(ADAPTER_LOADERS, HTTP_ADAPTER.USER_EXPERIENCES).mockResolvedValue(HttpUserExperiencesService);
  });

  afterEach(() => {
    environment.activitiesDataSource = originalMode;
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it.each(['local', 'http'] as const)('loads and saves through only the %s adapter', async mode => {
    environment.activitiesDataSource = mode;
    const service = TestBed.inject(UserExperiencesService);
    expect(ADAPTER_LOADERS[LOCAL_ADAPTER.USER_EXPERIENCES]).not.toHaveBeenCalled();
    expect(ADAPTER_LOADERS[HTTP_ADAPTER.USER_EXPERIENCES]).not.toHaveBeenCalled();
    expect(await service.loadUserExperiences(' actor ')).toEqual(entries);
    expect(await service.saveUserExperiences(' actor ', entries)).toEqual(entries);
    const selected = mode === 'local' ? TestBed.inject(LocalUserExperiencesService) : TestBed.inject(HttpUserExperiencesService);
    expect(selected.queryUserExperiences).toHaveBeenCalledWith('actor');
    expect(selected.saveUserExperiences).toHaveBeenCalledWith('actor', entries);
    const usedKey = mode === 'local' ? LOCAL_ADAPTER.USER_EXPERIENCES : HTTP_ADAPTER.USER_EXPERIENCES;
    const unusedKey = mode === 'local' ? HTTP_ADAPTER.USER_EXPERIENCES : LOCAL_ADAPTER.USER_EXPERIENCES;
    expect(ADAPTER_LOADERS[usedKey]).toHaveBeenCalledTimes(1);
    expect(ADAPTER_LOADERS[unusedKey]).not.toHaveBeenCalled();
  });

  it.each(['local', 'http'] as const)('preserves an explicit %s override in the opposite profile', async mode => {
    environment.activitiesDataSource = mode === 'http' ? 'local' : 'http';
    const service = TestBed.inject(UserExperiencesService);
    await service.loadUserExperiences('actor', { mode });
    const usedKey = mode === 'local' ? LOCAL_ADAPTER.USER_EXPERIENCES : HTTP_ADAPTER.USER_EXPERIENCES;
    const unusedKey = mode === 'local' ? HTTP_ADAPTER.USER_EXPERIENCES : LOCAL_ADAPTER.USER_EXPERIENCES;
    expect(ADAPTER_LOADERS[usedKey]).toHaveBeenCalledTimes(1);
    expect(ADAPTER_LOADERS[unusedKey]).not.toHaveBeenCalled();
  });

  it('does not download adapters for empty user IDs', async () => {
    const service = TestBed.inject(UserExperiencesService);
    expect(await service.loadUserExperiences(' ')).toEqual([]);
    expect(await service.saveUserExperiences('', entries)).toEqual([]);
    expect(ADAPTER_LOADERS[LOCAL_ADAPTER.USER_EXPERIENCES]).not.toHaveBeenCalled();
    expect(ADAPTER_LOADERS[HTTP_ADAPTER.USER_EXPERIENCES]).not.toHaveBeenCalled();
  });

  it('keeps local persisted records isolated when callers edit returned entries', async () => {
    environment.activitiesDataSource = 'local';
    let state = { [PROFILE_EXPERIENCES_TABLE_NAME]: {
      byUserId: { actor: entries.map(entry => ({ ...entry })) }, userIds: ['actor']
    } };
    TestBed.configureTestingModule({ providers: [
      { provide: LocalMemoryDb, useValue: {
        read: () => state,
        write: (update: (value: typeof state) => typeof state) => { state = update(state); }
      } },
      { provide: RouteDelayService, useValue: { waitForRouteDelay: () => Promise.resolve() } }
    ] });
    TestBed.overrideProvider(LocalUserExperiencesService, { useFactory: () => new LocalUserExperiencesService() });
    const service = TestBed.inject(UserExperiencesService);
    const loaded = await service.loadUserExperiences('actor');
    loaded[0].title = 'Unsaved edit';
    expect((await service.loadUserExperiences('actor'))[0].title).toBe('Engineer');
    const saved = await service.saveUserExperiences('actor', [{ ...entries[0], title: 'Saved edit' }]);
    saved[0].title = 'Another unsaved edit';
    expect((await service.loadUserExperiences('actor'))[0].title).toBe('Saved edit');
  });

  it('keeps the HTTP cache isolated when callers edit returned entries', async () => {
    environment.activitiesDataSource = 'http';
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    TestBed.overrideProvider(HttpUserExperiencesService, { useFactory: () => new HttpUserExperiencesService() });
    const service = TestBed.inject(UserExperiencesService);
    const transport = TestBed.inject(HttpTestingController);
    const first = service.loadUserExperiences('actor');
    const firstRequest = await vi.waitFor(() => transport.expectOne(request => request.url.endsWith('/auth/me/experiences')));
    firstRequest.flush({ entries });
    (await first)[0].title = 'Unsaved edit';
    const second = service.loadUserExperiences('actor');
    const secondRequest = await vi.waitFor(() => transport.expectOne(request => request.url.endsWith('/auth/me/experiences')));
    secondRequest.flush(null, { status: 503, statusText: 'Unavailable' });
    expect((await second)[0].title).toBe('Engineer');
    transport.verify();
  });
});

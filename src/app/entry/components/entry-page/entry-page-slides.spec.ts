import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { EntryLandingComponent } from '../entry-landing/entry-landing.component';
import { IdeaPostsService } from '../../../shared/core/base/services/idea-posts.service';
import { DeploymentConfigurationService } from '../../../shared/core/base/services/deployment-configuration.service';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { PwaService } from '../../../shared/core/base/services/pwa.service';
import { DEFAULT_DEPLOYMENT_BRANDING } from '../../../shared/core/contracts';
import { baseGroupId, type GroupType } from '../../../shared/core/contracts/group-type';
import type { LandingSlideDto } from '../../../shared/core/contracts/content.interface';
import { LandingContentService } from '../../../shared/core/base/services/landing-content.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('Landing slide availability', () => {
  it('shares the in-flight landing response between carousel and page consumers', async () => {
    const content = deferred<{ slides: LandingSlideDto[] }>();
    const loadContent = vi.fn(() => content.promise);
    const service = Object.assign(Object.create(LandingContentService.prototype), {
      states: new Map(), loads: new Map(),
      landingService: () => ({ loadContent }),
      cloneState: (state: unknown) => state
    });
    const carouselContent = service.loadOnce('base-dating');
    const pageContent = service.loadOnce('base-dating');
    expect(loadContent).toHaveBeenCalledTimes(1);
    const state = { slides: [] };
    content.resolve(state);
    expect(await carouselContent).toBe(state);
    expect(await pageContent).toBe(state);
  });

  function carousel(loadOnce: ReturnType<typeof vi.fn>) {
    const mode = signal<GroupType>('dating');
    TestBed.configureTestingModule({
      imports: [EntryLandingComponent],
      providers: [
        { provide: LandingContentService, useValue: { mode, loadOnce } },
        { provide: IdeaPostsService, useValue: {} },
        { provide: DeploymentConfigurationService, useValue: {
          initialize: () => Promise.resolve(), branding: signal(DEFAULT_DEPLOYMENT_BRANDING), socialLinks: signal([])
        } },
        { provide: I18nService, useValue: { revision: signal(0), translate: (key: string) => key } },
        { provide: PwaService, useValue: { appVersionLabel: signal('test') } }
      ]
    }).overrideComponent(EntryLandingComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(EntryLandingComponent);
    return { fixture, component: fixture.componentInstance, mode };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('keeps SmartList loading until the shared landing response arrives', async () => {
    const content = deferred<{ slides: LandingSlideDto[] }>();
    const loadOnce = vi.fn(() => content.promise);
    const { component, fixture } = carousel(loadOnce);
    component.articlesLoading = true;
    const received = vi.fn();
    component['entryHowSmartListLoadPage']({ page: 0, pageSize: 4 }).subscribe(received);
    expect(received).not.toHaveBeenCalled();
    expect(component['entryHowSmartListConfig'].headerProgress).toEqual({ enabled: true, kind: 'load-ring', tone: 'bright' });
    expect(component['entryHowSmartListConfig'].showEmptyState).toBe(false);
    expect(loadOnce).toHaveBeenCalledWith(baseGroupId('dating'));
    const metadata = [{ id: 'slide', index: '01', title: 'Title', titleKey: 'title', message: '', messageKey: '', imageUrl: '/assets/slide.png' }];
    content.resolve({ slides: metadata });
    await Promise.resolve();
    expect(received).toHaveBeenCalledExactlyOnceWith({ items: metadata, total: 1, nextCursor: null });
    expect(component.articlesLoading).toBe(true);
    fixture.destroy();
  });

  it('scopes the existing SmartList loader by landing mode', async () => {
    const loadOnce = vi.fn().mockResolvedValue({ slides: [] });
    const { component, fixture, mode } = carousel(loadOnce);
    await firstValueFrom(component['entryHowSmartListLoadPage']({ page: 0, pageSize: 4 }));
    const firstScope = component['howSmartListFilters']().groupId;
    expect(loadOnce).toHaveBeenLastCalledWith(firstScope);
    mode.set('work');
    const nextScope = component['howSmartListFilters']().groupId;
    expect(nextScope).not.toBe(firstScope);
    await firstValueFrom(component['entryHowSmartListLoadPage']({ page: 0, pageSize: 4 }));
    expect(loadOnce).toHaveBeenLastCalledWith(nextScope);
    fixture.destroy();
  });
});

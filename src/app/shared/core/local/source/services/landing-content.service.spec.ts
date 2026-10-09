import { TestBed } from '@angular/core/testing';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedStaticContentService } from '../../seed/services/static-content.service';
import { LocalCountryPartitionsRepository } from '../repositories/country-partitions.repository';
import { LocalHelpCenterRepository } from '../repositories/help-center.repository';
import { LocalLandingContentRepository } from '../repositories/landing-content.repository';
import { LocalHelpCenterService } from './help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';
import { LocalLandingContentService } from './landing-content.service';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

const revisions = ['privacy', 'terms'].map(documentKind => ({
  id: documentKind, documentKind, lang: 'en', languageLabel: 'English', version: 1,
  title: documentKind, summary: '', description: '', sections: [], active: true,
  createdAtIso: '', createdByUserId: '', updatedAtIso: '', updatedByUserId: ''
}));

describe('Local landing request timing', () => {
  let preparation: ReturnType<typeof gate>;
  let delay: ReturnType<typeof gate>;
  const ensureReady = vi.fn();
  const waitForRouteDelay = vi.fn();
  const querySlides = vi.fn();

  beforeEach(() => {
    preparation = gate(); delay = gate();
    ensureReady.mockReset().mockReturnValue(preparation.promise);
    waitForRouteDelay.mockReset().mockReturnValue(delay.promise);
    querySlides.mockReset().mockResolvedValue([{ id: 'slide', imageUrl: '/not-yet-loaded.webp' }]);
    TestBed.configureTestingModule({ providers: [
      LocalLandingContentService, LocalHelpCenterService,
      { provide: SeedStaticContentService, useValue: { ensureReady } },
      { provide: RouteDelayService, useValue: { waitForRouteDelay } },
      { provide: LocalLandingContentRepository, useValue: { querySlides } },
      { provide: LocalHelpCenterRepository, useValue: {
        whenReady: () => Promise.resolve(),
        readTable: () => ({ seeded: true, activeRevisionId: null,
          revisionsById: Object.fromEntries(revisions.map(record => [record.id, record])),
          revisionIds: revisions.map(record => record.id), auditIds: [], auditById: {} })
      } },
      { provide: LocalIdeaPostsService, useValue: {
        loadPublishedFeaturedPostPreview: () => Promise.resolve({ records: [], total: 0 })
      } },
      { provide: LocalCountryPartitionsRepository, useValue: { querySupportedCountries: () => [] } }
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('prepares content during one outer delay and releases it when that delay ends', async () => {
    const finished = vi.fn();
    const pending = TestBed.inject(LocalLandingContentService).loadContent().then(state => { finished(); return state; });
    expect(waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/landing/content');
    await vi.waitFor(() => expect(ensureReady).toHaveBeenCalledOnce());
    preparation.resolve();
    await vi.waitFor(() => expect(querySlides).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    delay.resolve();
    const state = await pending;
    expect(state.privacy.activeRevision?.id).toBe('privacy');
    expect(state.terms.activeRevision?.id).toBe('terms');
    expect(state.slides?.[0].imageUrl).toBe('/not-yet-loaded.webp');
    expect(waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/landing/content');
  });

  it('waits for slower preparation without starting another delay afterwards', async () => {
    const finished = vi.fn();
    const pending = TestBed.inject(LocalLandingContentService).loadContent().then(finished);
    delay.resolve();
    await vi.waitFor(() => expect(ensureReady).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    preparation.resolve();
    await pending;
    expect(finished).toHaveBeenCalledOnce();
    expect(waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/landing/content');
  });

  it('retains the standalone help request delay', async () => {
    const pending = TestBed.inject(LocalHelpCenterService).loadState('privacy', 'en');
    expect(waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/privacy/active');
    delay.resolve();
    expect((await pending).activeRevision?.id).toBe('privacy');
  });
});

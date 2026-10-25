import { TestBed } from '@angular/core/testing';
import { RouteDelayService } from '../../../../base/services/platform/route-delay.service';
import { SeedStaticContentService } from '../../../seed/services/platform/static-content.service';
import { LocalCountryPartitionsRepository } from '../../repositories/platform/country-partitions.repository';
import { LocalHelpCenterRepository } from '../../repositories/help/help-center.repository';
import { LocalLandingContentRepository } from '../../repositories/content/landing-content.repository';
import { LocalHelpCenterService } from '../help/help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';
import { LocalLandingContentService } from './landing-content.service';
import { I18nService } from '../../../../base/services/localization/i18n.service';

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
      { provide: I18nService, useValue: { currentLanguage: () => 'en' } },
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

  it('lets the loader paint before lazy content preparation while the route delay already runs', async () => {
    const frames: FrameRequestCallback[] = [];
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const pending = TestBed.inject(LocalLandingContentService).loadContent();
      expect(waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/landing/content');
      expect(ensureReady).not.toHaveBeenCalled();
      frames.shift()!(0);
      await Promise.resolve();
      expect(ensureReady).not.toHaveBeenCalled();
      frames.shift()!(16);
      await vi.waitFor(() => expect(ensureReady).toHaveBeenCalledOnce());
      preparation.resolve();
      delay.resolve();
      await pending;
    } finally {
      frame.mockRestore();
    }
  });

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

  it('keeps the existing loading window when preparation fails and then reports the failure', async () => {
    const failed = vi.fn();
    const error = new Error('Content preparation failed');
    const pending = TestBed.inject(LocalLandingContentService).loadContent().catch(failed);
    await vi.waitFor(() => expect(ensureReady).toHaveBeenCalledOnce());
    preparation.resolve();
    querySlides.mockRejectedValue(error);
    await vi.waitFor(() => expect(querySlides).toHaveBeenCalledOnce());
    expect(failed).not.toHaveBeenCalled();
    delay.resolve();
    await pending;
    expect(failed).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('loads both carousel and article data in the selected browser language when another language follows English', async () => {
    const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'en-US', 'en', 'hu']);
    const preview = vi.spyOn(TestBed.inject(LocalIdeaPostsService), 'loadPublishedFeaturedPostPreview');
    try {
      const pending = TestBed.inject(LocalLandingContentService).loadContent().then(
        state => ({ state, error: null }), error => ({ state: null, error })
      );
      preparation.resolve();
      await vi.waitFor(() => expect(querySlides).toHaveBeenCalledOnce());
      delay.resolve();
      const result = await pending;
      expect(result.error).toBeNull();
      expect(result.state?.slides?.map(slide => slide.id)).toEqual(['slide']);
      expect(result.state?.privacy.activeRevision?.lang).toBe('en');
      expect(result.state?.terms.activeRevision?.lang).toBe('en');
      expect(preview).toHaveBeenCalledExactlyOnceWith('en', null);
      expect(waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/landing/content');
    } finally {
      languages.mockRestore();
    }
  });
});

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { reportBackendReadiness } from '../../common/backend-connectivity';
import { LandingContentService } from './landing-content.service';
import { I18nService } from './i18n.service';
import { LANDING_EXPLANATION_GUIDE } from './landing-explanation-guide';

describe('landing guide readiness', () => {
  const previousMode = environment.activitiesDataSource;
  const load = vi.fn();
  beforeEach(() => {
    load.mockReset().mockResolvedValue({ activeRevision: null, revisions: [], guideFields: [], availableLanguages: [], auditTrail: [] });
    TestBed.configureTestingModule({ providers: [
      { provide: LandingContentService, useValue: { loadExplanationState: load } },
      { provide: I18nService, useValue: { currentLanguage: signal('en') } }
    ] });
  });
  afterEach(() => {
    environment.activitiesDataSource = previousMode;
    reportBackendReadiness(true);
    TestBed.resetTestingModule();
  });

  it('shows the existing error in the same microtask turn without an HTTP request when unavailable', async () => {
    environment.activitiesDataSource = 'http';
    reportBackendReadiness(false);
    const guide = TestBed.inject(LANDING_EXPLANATION_GUIDE);
    guide.registerContext('landing.home');
    guide.openCurrent();
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    expect(guide.loading()).toBe(false);
    expect(guide.loadError()).toBe(true);
    expect(guide.hasVisiblePopup()).toBe(true);
  });

  it('performs one load for a guide opening while the local response is pending', async () => {
    environment.activitiesDataSource = 'local';
    let complete!: (value: unknown) => void;
    load.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const guide = TestBed.inject(LANDING_EXPLANATION_GUIDE);
    guide.registerContext('landing.home');
    guide.openCurrent();
    TestBed.tick();
    expect(guide.loading()).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    complete({ activeRevision: null, revisions: [], guideFields: [], availableLanguages: [], auditTrail: [] });
    await Promise.resolve();
    TestBed.tick();
    expect(guide.loading()).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the GitHub Pages local guide available without the backend', async () => {
    environment.activitiesDataSource = 'local';
    reportBackendReadiness(false);
    const guide = TestBed.inject(LANDING_EXPLANATION_GUIDE);
    guide.registerContext('landing.home');
    guide.openCurrent();
    await Promise.resolve();
    expect(load).toHaveBeenCalledWith('landing.home', 'en');
    expect(guide.loadError()).toBe(false);
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { IdeaPostsService } from '../../../shared/core/base/services/idea-posts.service';
import { DeploymentConfigurationService } from '../../../shared/core/base/services/deployment-configuration.service';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { DEFAULT_DEPLOYMENT_BRANDING } from '../../../shared/core/contracts';
import type { IdeaArticleDetailDto } from '../../../shared/core/contracts/content.interface';
import type { PageResult, SmartListConfig, SmartListLoadPage } from '../../../shared/ui/components/core/smart-list';
import type { InfoCardData } from '../../../shared/ui/components/core/smart-list/card';
import { EntryLandingComponent } from './entry-landing.component';

describe('EntryLandingComponent article lists', () => {
  const loadPublishedIdeaCardsPage = vi.fn();
  const branding = signal({ ...DEFAULT_DEPLOYMENT_BRANDING });
  const i18nRevision = signal(0);
  const translations: Readonly<Record<string, string>> = {
    'landing.articles.title': '{productName} articles',
    'landing.articles.count.one': '{count} article',
    'landing.articles.count.many': '{count} articles',
    'landing.partners.title': 'For Partners',
    'landing.partners.open.aria': 'Open partner overview',
    'landing.preview.open.guide': 'Open preview guide',
    'bug.report': 'Bug report',
    'close.articles': 'Close articles'
  };
  const socialLinks = signal([
    {
      provider: 'community',
      label: 'Community',
      url: 'https://community.example.test/',
      icon: null,
      handle: '@community'
    }
  ]);

  beforeEach(() => {
    loadPublishedIdeaCardsPage.mockReset();
    branding.set({ ...DEFAULT_DEPLOYMENT_BRANDING });
    i18nRevision.set(0);
    TestBed.configureTestingModule({
      imports: [EntryLandingComponent],
      providers: [
        {
          provide: IdeaPostsService,
          useValue: { loadPublishedIdeaCardsPage }
        },
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding,
            socialLinks
          }
        },
        {
          provide: I18nService,
          useValue: {
            revision: i18nRevision.asReadonly(),
            translate: (key: string, fallback?: string) =>
              translations[key] ?? fallback ?? key,
            translateParams: (
              key: string,
              values: Readonly<Record<string, string | number>>,
              fallback?: string
            ) => interpolate(
              translations[key] ?? fallback ?? key,
              values
            )
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('keeps non-featured articles out of the horizontal list', () => {
    const component = TestBed.createComponent(EntryLandingComponent).componentInstance;
    component.ideaCards = [
      ...Array.from({ length: 10 }, (_, index) => card(`featured-${index}`, true)),
      card('regular', false)
    ];

    expect(view(component).featuredIdeaCards().map(item => item.eagerDetail?.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `featured-${index}`)
    );
  });

  it('loads popup pages through the service with header progress enabled', async () => {
    const lazyCard = card('lazy-page-article', false);
    loadPublishedIdeaCardsPage.mockResolvedValue({
      items: [lazyCard],
      total: 21,
      nextCursor: 'next-page'
    } satisfies PageResult<InfoCardData<IdeaArticleDetailDto>>);
    const component = TestBed.createComponent(EntryLandingComponent).componentInstance;

    const result = await firstValueFrom(view(component).entryIdeaSmartListLoadPage({
      page: 0,
      pageSize: 10,
      cursor: null
    }));

    expect(loadPublishedIdeaCardsPage).toHaveBeenCalledOnce();
    expect(loadPublishedIdeaCardsPage).toHaveBeenCalledWith({
      page: 0,
      pageSize: 10,
      cursor: null
    }, { signal: undefined });
    expect(result).toEqual({ items: [lazyCard], total: 21, nextCursor: 'next-page' });
    expect(view(component).entryIdeaSmartListConfig.headerProgress?.enabled).toBe(true);

    view(component).onFeaturedIdeaCardAction(lazyCard, 'viewArticle');
    expect(view(component).selectedIdeaDetail()?.id).toBe('lazy-page-article');
  });

  it('keeps the article CTA available when only regular published articles exist', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    const component = fixture.componentInstance;
    component.ideaCards = [];
    component.ideaCount = 4;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#articles')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.entry-ideas-more-btn')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.entry-ideas-carousel-smart-list')).toBeNull();
    view(component).openIdeasPopup();
    expect(view(component).ideasPopupOpen).toBe(true);
    expect(view(component).ideasPopupModel().subtitle).toBe('4 articles');
  });

  it('keeps Start exploring active while only login eligibility is unavailable or awaiting location', () => {
    const component = TestBed.createComponent(EntryLandingComponent).componentInstance;
    const demoRequested = vi.fn();
    component.demoRequested.subscribe(demoRequested);
    component.networkUnavailable = false;

    component.authUnavailable = true;
    component.authLocationRequired = false;
    view(component).requestDemo();

    component.authUnavailable = false;
    component.authLocationRequired = true;
    view(component).requestDemo();

    expect(demoRequested).toHaveBeenCalledTimes(2);

    component.networkUnavailable = true;
    view(component).requestDemo();
    expect(demoRequested).toHaveBeenCalledTimes(2);
  });

  it('uses deployment branding and singular count in the article popup', () => {
    branding.set({
      ...DEFAULT_DEPLOYMENT_BRANDING,
      productName: 'Community Hub',
      revision: 7
    });
    const component =
      TestBed.createComponent(EntryLandingComponent).componentInstance;
    component.ideaCount = 1;

    view(component).openIdeasPopup();

    expect(view(component).ideasPopupModel()).toMatchObject({
      title: 'Community Hub articles',
      subtitle: '1 article'
    });
  });

  it('keeps the hero focused and opens the partner overview from the footer', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.detectChanges();

    const ctaMenu = fixture.nativeElement.querySelector(
      'app-menu.entry-hero-cta-menu'
    ) as HTMLElement | null;
    const heroButtons = Array.from(
      ctaMenu?.querySelectorAll<HTMLButtonElement>('.app-menu__button-row-item') ?? []
    );
    const partnerButton = fixture.nativeElement.querySelector(
      '.entry-footer-partners-action'
    ) as HTMLButtonElement | null;
    const bugReportButton = fixture.nativeElement.querySelector(
      '.entry-footer-bug-report-action'
    ) as HTMLButtonElement | null;
    expect(ctaMenu).not.toBeNull();
    expect(heroButtons).toHaveLength(1);
    expect(ctaMenu?.textContent).not.toContain('For Partners');
    expect(ctaMenu?.textContent).not.toContain('Bug report');
    expect(ctaMenu?.textContent).not.toContain('see.how.it.works');
    expect(partnerButton).not.toBeNull();
    expect(bugReportButton).not.toBeNull();
    expect(bugReportButton?.parentElement).toBe(partnerButton?.parentElement);
    expect(partnerButton?.nextElementSibling).toBe(bugReportButton);

    partnerButton?.click();
    fixture.detectChanges();

    expect(view(fixture.componentInstance).partnersPopupOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('.entry-shell')?.hasAttribute('inert')).toBe(true);
    const popupBody = fixture.nativeElement.querySelector('.entry-partners-popup-body') as HTMLElement | null;
    expect(popupBody).not.toBeNull();
    expect(popupBody?.querySelectorAll('.entry-partner-role')).toHaveLength(4);

    const popupText = popupBody?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(popupText).toContain('virtual private server (VPS)');
    expect(popupText).toContain('Booking commission belongs to that operator');
    expect(popupText).toContain('Aggregate telemetry is sent either way');
    expect(popupText).toContain('monthly active users (MAU)');
    expect(popupText).toContain('allocation weight used only for exit math');
    expect(popupText).toContain('100,000 ÷ total verified MAU');
    expect(popupText).toContain('Founder share is capped at 10%');
    expect(popupText).toContain('never operator commissions');
    const operatorAccess = popupBody?.querySelector(
      '.entry-partner-operator-access-button'
    ) as HTMLButtonElement | null;
    const operatorRequested = vi.fn();
    fixture.componentInstance.operatorRequested.subscribe(operatorRequested);
    expect(operatorAccess).not.toBeNull();
    operatorAccess?.click();
    fixture.detectChanges();
    expect(operatorRequested).toHaveBeenCalledOnce();
    expect(view(fixture.componentInstance).partnersPopupOpen).toBe(false);

    partnerButton?.click();
    fixture.detectChanges();
    const closeButton = fixture.nativeElement.querySelector(
      '.ui-popup__close'
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    closeButton?.click();
    fixture.detectChanges();

    expect(view(fixture.componentInstance).partnersPopupOpen).toBe(false);
    expect(fixture.nativeElement.querySelector('.entry-shell')?.hasAttribute('inert')).toBe(false);
    expect(fixture.nativeElement.querySelector('.entry-partners-popup-body')).toBeNull();
  });

  it('opens the preview guide from the footer bug-report link', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.detectChanges();

    const bugReportButton = fixture.nativeElement.querySelector(
      '.entry-footer-bug-report-action'
    ) as HTMLButtonElement | null;
    expect(bugReportButton).not.toBeNull();

    bugReportButton?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.entry-preview-guide-body')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.entry-preview-guide-report-btn')?.getAttribute('href'))
      .toBe('https://github.com/fssrepository/myscoutee/issues');
  });

  it('renders deployment-controlled social links with the generic icon fallback', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.entry-footer-socials a'
    ) as HTMLAnchorElement | null;
    expect(link?.href).toBe('https://community.example.test/');
    expect(link?.getAttribute('aria-label')).toBe('Community · @community');
    expect(link?.querySelector('.mat-icon')?.textContent?.trim()).toBe('public');
    expect(fixture.nativeElement.textContent).not.toContain(
      'github.com/fssrepository/myscoutee/issues'
    );
  });

  it('renders article body images without repeating the card cover', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    const component = fixture.componentInstance;
    const article = card('article-with-image', true);
    article.eagerDetail = {
      ...article.eagerDetail!,
      imageUrl: '/cover.webp',
      contentHtml: `<p>Article body</p><img src="${managedImageUrl('medium')}" alt="Body image">`
    };
    component.ideaCards = [article];

    view(component).onFeaturedIdeaCardAction(article, 'viewArticle');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.entry-ideas-article-image')).toBeNull();
    const bodyImages = fixture.nativeElement.querySelectorAll('.entry-ideas-article-html img');
    expect(bodyImages).toHaveLength(1);
    expect(bodyImages[0].getAttribute('src')).toBe(managedImageUrl('large'));
    expect(getComputedStyle(bodyImages[0]).marginLeft).toBe('auto');
    expect(getComputedStyle(bodyImages[0]).marginRight).toBe('auto');
  });
});

interface EntryLandingTestView {
  featuredIdeaCards: () => InfoCardData<IdeaArticleDetailDto>[];
  entryIdeaSmartListLoadPage: SmartListLoadPage<InfoCardData<IdeaArticleDetailDto>>;
  entryIdeaSmartListConfig: SmartListConfig<InfoCardData<IdeaArticleDetailDto>>;
  onFeaturedIdeaCardAction: (card: InfoCardData<IdeaArticleDetailDto>, actionId: string) => void;
  selectedIdeaDetail: () => IdeaArticleDetailDto | null;
  openIdeasPopup: () => void;
  ideasPopupOpen: boolean;
  partnersPopupOpen: boolean;
  ideasPopupModel: () => { title?: string; subtitle?: string };
  requestDemo: () => void;
}

function view(component: EntryLandingComponent): EntryLandingTestView {
  return component as unknown as EntryLandingTestView;
}

function card(id: string, featured: boolean): InfoCardData<IdeaArticleDetailDto> {
  return {
    id: `entry-idea:${id}`,
    title: id,
    eagerDetail: {
      id,
      title: id,
      excerpt: `${id} excerpt`,
      contentHtml: `<p>${id}</p>`,
      imageUrl: '',
      dateLabel: 'Jul 20, 2026',
      sortAtIso: '2026-07-20T10:00:00.000Z',
      featured
    }
  };
}

function managedImageUrl(variant: 'medium' | 'large'): string {
  return `/api/media/public?key=${encodeURIComponent(`images/owner/article/upload-1/${variant}.webp`)}`;
}

function interpolate(
  value: string,
  values: Readonly<Record<string, string | number>>
): string {
  return Object.entries(values).reduce(
    (result, [key, item]) => result.replaceAll(`{${key}}`, `${item}`),
    value
  );
}

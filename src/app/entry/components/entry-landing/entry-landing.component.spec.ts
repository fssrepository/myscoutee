import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { IdeaPostsService } from '../../../shared/core/base/services/content/idea-posts.service';
import { LandingContentService } from '../../../shared/core/base/services/content/landing-content.service';
import { DeploymentConfigurationService } from '../../../shared/core/base/services/platform/deployment-configuration.service';
import { I18nService } from '../../../shared/core/base/services/localization/i18n.service';
import { DEFAULT_DEPLOYMENT_BRANDING } from '../../../shared/core/contracts';
import type { IdeaArticleDetailDto } from '../../../shared/core/contracts/content/content.interface';
import {
  provideUiTranslations,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage,
  type InfoCardData
} from '@fssrepository/myscoutee-components';

import { EntryLandingComponent } from './entry-landing.component';
import huBundle from '../../../../assets/i18n/hu.json';

describe('EntryLandingComponent article lists', () => {
  const loadPublishedIdeaCardsPage = vi.fn();
  const branding = signal({ ...DEFAULT_DEPLOYMENT_BRANDING });
  const i18nRevision = signal(0);
  const translations: Readonly<Record<string, string>> = {
    'landing.login': 'Login',
    'landing.articles.title': '{productName} articles',
    'landing.articles.count.one': '{count} article',
    'landing.articles.count.many': '{count} articles',
    'landing.about.title': 'About MyScoutee',
    'landing.about.open.aria': 'Open the MyScoutee overview',
    'landing.about.header.badge': 'Independent project',
    'landing.about.subtitle': 'Who built it, what it does, and why it is free to join.',
    'landing.about.aria': 'About MyScoutee',
    'landing.about.close.aria': 'Close the MyScoutee overview',
    'landing.partners.title': 'For Partners',
    'landing.partners.open.aria': 'Open partner overview',
    'landing.preview.open.guide': 'Open preview guide',
    'landing.hero.history': 'Meeting people was once social.',
    'landing.hero.return': 'We’re making it social again.',
    'landing.hero.graph': '6 people · 6 priority lists → 1 team',
    'landing.hero.free.to.join': 'Free to join',
    'landing.hero.event.formats': 'Standard · Tournament · Speed meeting',
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
        provideUiTranslations(I18nService),
        {
          provide: IdeaPostsService,
          useValue: { loadPublishedIdeaCardsPage }
        },
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding,
            socialLinks,
            initialize: vi.fn().mockResolvedValue(DEFAULT_DEPLOYMENT_BRANDING)
          }
        },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: () => 'en',
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

  it('keeps both content surfaces visible with their existing error state after a failed load', async () => {
    TestBed.overrideProvider(LandingContentService, { useValue: {
      mode: signal('dating'),
      loadOnce: () => Promise.reject(new Error('Content preparation failed'))
    } });
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.componentRef.setInput('authMode', 'firebase');
    fixture.componentRef.setInput('articlesLoading', false);
    fixture.componentRef.setInput('contentError', 'Unable to load content');
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      for (const selector of ['.entry-how-smart-list', '.entry-ideas-carousel-smart-list']) {
        const surface = fixture.nativeElement.querySelector(selector);
        expect(surface).not.toBeNull();
        expect(surface.textContent).toContain('Unable to load content');
      }
    });
    fixture.destroy();
  });

  it('renders landing actions and policy links using only the Hungarian catalog', () => {
    const messages = huBundle.messages as Record<string, string>;
    const requested: string[] = [];
    TestBed.overrideProvider(I18nService, { useValue: {
      currentLanguage: () => 'hu', revision: () => 0,
      translate: (key: string, fallback?: string) => {
        requested.push(key);
        return messages[key] ?? fallback ?? key;
      },
      translateParams: (key: string, values: Readonly<Record<string, string | number>>, fallback?: string) =>
        interpolate(messages[key] ?? fallback ?? key, values)
    } });
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.componentInstance.authMode = 'firebase';
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain(messages['landing.explore.action']);
    expect(text).toContain(messages['privacy.data']);
    expect(text).toContain(messages['terms']);
    expect(text).not.toContain('Start exploring');
    expect(text).not.toContain('Data privacy');
    fixture.componentRef.setInput('networkUnavailable', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(messages['landing.login']);
    expect(fixture.nativeElement.textContent).not.toContain(messages['entry.auth.unavailable']);
    const login = fixture.nativeElement.querySelector('.entry-auth-btn');
    expect(login.disabled).toBe(true);
    expect(login.textContent).toContain(messages['landing.login']);
    expect(login.querySelector('mat-icon').textContent.trim()).toBe('login');
    expect(login.classList.contains('entry-auth-btn-unavailable')).toBe(false);
    expect(login.classList.contains('entry-auth-btn-network')).toBe(false);
    const actions = view(fixture.componentInstance).entryHeroCtaItems();
    expect(actions.find(item => item.id === 'explore')).toMatchObject({ label: 'landing.explore.action', icon: 'rocket_launch', disabled: true });
    expect(actions.find(item => item.id === 'join')).toMatchObject({ label: 'landing.hero.free.to.join', icon: 'login', disabled: true });
    expect(fixture.nativeElement.textContent).not.toContain(messages['network.offline']);
    expect(requested).not.toContain('No network');
    expect(requested).not.toContain('Start exploring');
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
      groupId: null,
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

  it('places footer sections directly below the page heading', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('h1')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('footer h2')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('footer h3')).toBeNull();
  });

  it('keeps Start exploring active while only login eligibility is unavailable', () => {
    const component = TestBed.createComponent(EntryLandingComponent).componentInstance;
    const demoRequested = vi.fn();
    component.demoRequested.subscribe(demoRequested);
    component.networkUnavailable = false;

    component.authUnavailable = true;
    view(component).requestDemo();

    component.authUnavailable = false;
    view(component).requestDemo();

    expect(demoRequested).toHaveBeenCalledTimes(2);

    component.networkUnavailable = true;
    view(component).requestDemo();
    expect(demoRequested).toHaveBeenCalledTimes(2);
  });

  it('opens authentication from Free to join and keeps exploring independently available', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    const component = fixture.componentInstance;
    component.authMode = 'firebase';
    const authRequested = vi.fn();
    const demoRequested = vi.fn();
    component.firebaseAuthRequested.subscribe(authRequested);
    component.demoRequested.subscribe(demoRequested);
    fixture.detectChanges();
    const headerLogin = fixture.nativeElement.querySelector('.entry-auth-btn') as HTMLButtonElement;
    expect(headerLogin.textContent).toContain('Login');
    expect(headerLogin.querySelector('mat-icon')?.textContent).toBe('login');
    expect(headerLogin.classList.contains('entry-auth-btn-avatar')).toBe(false);
    expect(headerLogin.querySelector('.entry-auth-avatar')).toBeNull();
    const buttons = fixture.nativeElement.querySelectorAll(
      '.entry-hero-cta-menu .app-menu__button-row-item'
    ) as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    expect(authRequested).toHaveBeenCalledOnce();
    expect(demoRequested).not.toHaveBeenCalled();

    component.authUnavailable = true;
    fixture.detectChanges();
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[0].disabled).toBe(false);
    buttons[0].click();
    expect(demoRequested).toHaveBeenCalledOnce();

    component.networkUnavailable = true;
    fixture.detectChanges();
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
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

  it('keeps the hero focused and opens the about and partner overviews from the footer', () => {
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
    const aboutButton = fixture.nativeElement.querySelector(
      '.entry-footer-about-action'
    ) as HTMLButtonElement | null;
    const bugReportButton = fixture.nativeElement.querySelector(
      '.entry-footer-bug-report-action'
    ) as HTMLButtonElement | null;
    const previewBadge = fixture.nativeElement.querySelector(
      '.entry-preview-badge'
    ) as HTMLElement | null;
    expect(ctaMenu).not.toBeNull();
    expect(heroButtons).toHaveLength(2);
    expect(heroButtons[1].textContent).toContain('Free to join');
    expect(ctaMenu?.textContent).not.toContain('For Partners');
    expect(ctaMenu?.textContent).not.toContain('Bug report');
    expect(ctaMenu?.textContent).not.toContain('see.how.it.works');
    const heroText = fixture.nativeElement.querySelector('.entry-hero-content')?.textContent ?? '';
    expect(heroText).toContain('Meeting people was once social.');
    expect(heroText).toContain('We’re making it social again.');
    expect(heroText).toContain('6 people · 6 priority lists → 1 team');
    expect(heroText.toLowerCase()).not.toContain('swip');
    expect(previewBadge).toBeNull();
    expect(aboutButton).not.toBeNull();
    expect(partnerButton).not.toBeNull();
    expect(bugReportButton).not.toBeNull();
    expect(aboutButton?.parentElement).toBe(partnerButton?.parentElement);
    expect(bugReportButton?.parentElement).toBe(partnerButton?.parentElement);

    aboutButton?.click();
    fixture.detectChanges();

    expect(view(fixture.componentInstance).aboutPopupOpen).toBe(true);
    const aboutText = fixture.nativeElement.querySelector('.entry-about-popup-body')
      ?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(aboutText).toContain('MyScoutee');
    expect(aboutText).not.toContain('Peter');
    expect(aboutText).toContain('A platform behind meetings, not swipes');
    expect(aboutText).toContain('Free to join');
    expect(aboutText).toContain('event, ticket, venue, travel, and partner services');
    branding.set({ ...DEFAULT_DEPLOYMENT_BRANDING, productName: 'Operator Brand' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.entry-about-founder h3')?.textContent).toContain('Operator Brand');
    (fixture.nativeElement.querySelector('.ui-popup__close') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
    expect(view(fixture.componentInstance).aboutPopupOpen).toBe(false);

    partnerButton?.click();
    fixture.detectChanges();

    expect(view(fixture.componentInstance).partnersPopupOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('.entry-shell')?.hasAttribute('inert')).toBe(true);
    const popupBody = fixture.nativeElement.querySelector('.entry-partners-popup-body') as HTMLElement | null;
    expect(popupBody).not.toBeNull();
    expect(popupBody?.querySelectorAll('.entry-partner-role')).toHaveLength(6);

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
      .toBe('https://github.com/fssrepository/myscoutee-frontend/issues');
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
      'github.com/fssrepository/myscoutee-frontend/issues'
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
  entryHeroCtaItems(): Array<{ id: string; label: string; icon: string; disabled: boolean }>;
  featuredIdeaCards: () => InfoCardData<IdeaArticleDetailDto>[];
  entryIdeaSmartListLoadPage: SmartListLoadPage<InfoCardData<IdeaArticleDetailDto>>;
  entryIdeaSmartListConfig: SmartListConfig<InfoCardData<IdeaArticleDetailDto>>;
  onFeaturedIdeaCardAction: (card: InfoCardData<IdeaArticleDetailDto>, actionId: string) => void;
  selectedIdeaDetail: () => IdeaArticleDetailDto | null;
  openIdeasPopup: () => void;
  ideasPopupOpen: boolean;
  partnersPopupOpen: boolean;
  aboutPopupOpen: boolean;
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

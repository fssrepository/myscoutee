import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { IdeaPostsService } from '../../../shared/core/base/services/idea-posts.service';
import { DeploymentConfigurationService } from '../../../shared/core/base/services/deployment-configuration.service';
import { DEFAULT_DEPLOYMENT_BRANDING } from '../../../shared/core/contracts';
import type { IdeaArticleDetailDto } from '../../../shared/core/contracts/content.interface';
import type { PageResult, SmartListConfig, SmartListLoadPage } from '../../../shared/ui/components/core/smart-list';
import type { InfoCardData } from '../../../shared/ui/components/core/smart-list/card';
import { EntryLandingComponent } from './entry-landing.component';

describe('EntryLandingComponent article lists', () => {
  const loadPublishedIdeaCardsPage = vi.fn();

  beforeEach(() => {
    loadPublishedIdeaCardsPage.mockReset();
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
            branding: signal(DEFAULT_DEPLOYMENT_BRANDING)
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

    expect(view(component).showHowItWorksCta()).toBe(true);
    expect(fixture.nativeElement.querySelector('#articles')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.entry-ideas-more-btn')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.entry-ideas-carousel-smart-list')).toBeNull();
    view(component).openIdeasPopup();
    expect(view(component).ideasPopupOpen).toBe(true);
    expect(view(component).ideasPopupModel().subtitle).toBe('4 articles');
  });

  it('opens a concise partner role overview and keeps the two economics separate', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    fixture.detectChanges();

    const partnerButton = fixture.nativeElement.querySelector('.entry-cta-partners') as HTMLButtonElement | null;
    const bugReportButton = fixture.nativeElement.querySelector('.entry-cta-bug') as HTMLButtonElement | null;
    expect(partnerButton).not.toBeNull();
    expect(partnerButton?.textContent).toContain('For Partners');
    expect(partnerButton?.getAttribute('aria-expanded')).toBe('false');
    expect(bugReportButton?.parentElement).toBe(partnerButton?.parentElement);
    expect(bugReportButton?.nextElementSibling).toBe(partnerButton);

    partnerButton?.click();
    fixture.detectChanges();

    expect(view(fixture.componentInstance).partnersPopupOpen).toBe(true);
    expect(partnerButton?.getAttribute('aria-expanded')).toBe('true');
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

    const closeButton = fixture.nativeElement.querySelector('.ui-popup__close') as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    closeButton?.click();
    fixture.detectChanges();

    expect(view(fixture.componentInstance).partnersPopupOpen).toBe(false);
    expect(partnerButton?.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.entry-shell')?.hasAttribute('inert')).toBe(false);
    expect(fixture.nativeElement.querySelector('.entry-partners-popup-body')).toBeNull();
  });

  it('renders article body images without repeating the card cover', () => {
    const fixture = TestBed.createComponent(EntryLandingComponent);
    const component = fixture.componentInstance;
    const article = card('article-with-image', true);
    article.eagerDetail = {
      ...article.eagerDetail!,
      imageUrl: '/cover.webp',
      contentHtml: '<p>Article body</p><img src="/cover.webp" alt="Body image">'
    };
    component.ideaCards = [article];

    view(component).onFeaturedIdeaCardAction(article, 'viewArticle');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.entry-ideas-article-image')).toBeNull();
    const bodyImages = fixture.nativeElement.querySelectorAll('.entry-ideas-article-html img');
    expect(bodyImages).toHaveLength(1);
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
  showHowItWorksCta: () => boolean;
  openIdeasPopup: () => void;
  ideasPopupOpen: boolean;
  partnersPopupOpen: boolean;
  ideasPopupModel: () => { subtitle?: string };
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

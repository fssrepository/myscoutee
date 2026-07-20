import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { IdeaPostsService } from '../../../shared/core/base/services/idea-posts.service';
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

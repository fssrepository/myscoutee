import { TestBed } from '@angular/core/testing';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import type { IdeaPostDto } from '../../../contracts/content.interface';
import { LocalIdeaPostsRepository } from '../repositories/idea-posts.repository';
import { LocalIdeaPostsService } from './idea-posts.service';

describe('LocalIdeaPostsService public pages', () => {
  const whenReady = vi.fn();
  const queryPublishedPostPage = vi.fn();
  const createPostId = vi.fn();
  const savePostSnapshot = vi.fn();
  const flushToIndexedDb = vi.fn();
  const waitForRouteDelay = vi.fn();

  beforeEach(() => {
    whenReady.mockReset().mockResolvedValue(undefined);
    queryPublishedPostPage.mockReset().mockReturnValue({
      records: [post('published')],
      total: 12,
      nextCursor: '10'
    });
    createPostId.mockReset().mockReturnValue('idea-created');
    savePostSnapshot.mockReset().mockImplementation((record: IdeaPostDto) => record);
    flushToIndexedDb.mockReset().mockResolvedValue(undefined);
    waitForRouteDelay.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        LocalIdeaPostsService,
        {
          provide: LocalIdeaPostsRepository,
          useValue: {
            whenReady,
            queryPublishedPostPage,
            createPostId,
            savePostSnapshot,
            flushToIndexedDb
          }
        },
        {
          provide: RouteDelayService,
          useValue: { waitForRouteDelay }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('waits on the popup route before querying the repository page', async () => {
    const service = TestBed.inject(LocalIdeaPostsService);
    const signal = new AbortController().signal;

    const result = await service.loadPublishedPostsPage('en', {
      page: 0,
      pageSize: 10,
      cursor: null
    }, signal);

    expect(whenReady).toHaveBeenCalledOnce();
    expect(waitForRouteDelay).toHaveBeenCalledWith('/landing/articles', signal);
    expect(queryPublishedPostPage).toHaveBeenCalledWith('en', {
      page: 0,
      pageSize: 10,
      cursor: null
    });
    expect(waitForRouteDelay.mock.invocationCallOrder[0])
      .toBeLessThan(queryPublishedPostPage.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({
      total: 12,
      nextCursor: '10',
      records: [{ id: 'published' }]
    });
  });

  it('waits for the configured admin route before mapping and saving a repository snapshot', async () => {
    const service = TestBed.inject(LocalIdeaPostsService);

    const result = await service.savePost({
      id: null,
      contentKey: '',
      lang: 'en',
      title: 'Saved article',
      excerpt: '',
      contentHtml: '<p>Saved body</p>',
      imageUrl: '',
      imageUrls: [],
      featured: false,
      published: false,
      submittedAtIso: '',
      actorUserId: 'admin'
    });

    expect(waitForRouteDelay).toHaveBeenCalledWith('/admin/ideas');
    expect(waitForRouteDelay.mock.invocationCallOrder[0])
      .toBeLessThan(savePostSnapshot.mock.invocationCallOrder[0]);
    expect(savePostSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      id: 'idea-created',
      title: 'Saved article',
      published: false
    }));
    expect(flushToIndexedDb).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      id: 'idea-created',
      title: 'Saved article',
      published: false
    });
  });
});

function post(id: string): IdeaPostDto {
  return {
    id,
    contentKey: id,
    lang: 'en',
    languageLabel: 'English',
    title: id,
    excerpt: `${id} excerpt`,
    contentHtml: `<p>${id}</p>`,
    imageUrl: '',
    imageUrls: [],
    featured: false,
    published: true,
    trashed: false,
    trashedAtIso: '',
    trashedByUserId: '',
    submittedAtIso: '2026-07-20T10:00:00.000Z',
    createdAtIso: '2026-07-20T10:00:00.000Z',
    createdByUserId: 'admin',
    updatedAtIso: '2026-07-20T10:00:00.000Z',
    updatedByUserId: 'admin'
  };
}

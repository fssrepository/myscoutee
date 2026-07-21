import { TestBed } from '@angular/core/testing';

import { LocalMemoryDb } from '../../../common/app.db';
import type { IdeaPostDto } from '../../../contracts/content.interface';
import { IDEA_POSTS_TABLE_NAME } from '../entity/content.entity';
import { LocalIdeaPostsMapper } from '../mappers';
import { LocalIdeaPostsService } from '../services/idea-posts.service';
import { LocalIdeaPostsRepository } from './idea-posts.repository';

describe('LocalIdeaPostsRepository public pages', () => {
  let memoryDb: LocalMemoryDb;
  let repository: LocalIdeaPostsRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
    repository = TestBed.inject(LocalIdeaPostsRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('filters in the repository before sorting and cursor pagination', () => {
    seedPosts([
      post('article-a', '2026-07-18T10:00:00.000Z'),
      post('article-b', '2026-07-18T10:00:00.000Z'),
      post('article-c', '2026-07-17T10:00:00.000Z'),
      post('draft', '2026-07-20T10:00:00.000Z', { published: false }),
      post('trashed', '2026-07-20T09:00:00.000Z', { trashed: true }),
      post('hungarian', '2026-07-20T08:00:00.000Z', { lang: 'hu' })
    ]);

    const first = repository.queryPublishedPostPage('en', { page: 0, pageSize: 2 });
    const second = repository.queryPublishedPostPage('en', { page: 1, pageSize: 2, cursor: first.nextCursor });

    expect(first.records.map(item => item.id)).toEqual(['article-b', 'article-a']);
    expect(first.total).toBe(3);
    expect(first.nextCursor).toBe('en:2');
    expect(second.records.map(item => item.id)).toEqual(['article-c']);
    expect(second.total).toBe(3);
    expect(second.nextCursor).toBeNull();
  });

  it('keeps an English fallback cursor on English records across later pages', () => {
    seedPosts([
      post('english-a', '2026-07-20T12:00:00.000Z'),
      post('english-b', '2026-07-20T11:00:00.000Z'),
      post('hungarian-new', '2026-07-20T13:00:00.000Z', { lang: 'hu' })
    ]);

    const first = repository.queryPublishedPostPage('en', { pageSize: 1 });
    const continuation = repository.queryPublishedPostPage('hu', {
      pageSize: 1,
      cursor: first.nextCursor
    });

    expect(first.records.map(item => item.id)).toEqual(['english-a']);
    expect(first.nextCursor).toBe('en:1');
    expect(continuation.records.map(item => item.id)).toEqual(['english-b']);
  });

  it('keeps the local mapper limited to DTO conversion', () => {
    const draft = post('draft', '2026-07-20T10:00:00.000Z', { published: false });
    const mapped = LocalIdeaPostsMapper.toDtoPage({
      records: [draft],
      total: 1,
      nextCursor: null
    });

    expect(mapped.records.map(item => item.id)).toEqual(['draft']);
    expect(mapped.records[0]).not.toBe(draft);
    expect(mapped.records[0].imageUrls).not.toBe(draft.imageUrls);
  });

  it('returns a bounded featured preview while counting every public article', () => {
    seedPosts([
      post('regular-newest', '2026-07-20T12:00:00.000Z'),
      post('featured-new', '2026-07-20T11:00:00.000Z', { featured: true }),
      post('featured-old', '2026-07-20T10:00:00.000Z', { featured: true }),
      post('draft', '2026-07-20T13:00:00.000Z', { featured: true, published: false }),
      post('trashed', '2026-07-20T14:00:00.000Z', { featured: true, trashed: true }),
      post('hungarian', '2026-07-20T15:00:00.000Z', { featured: true, lang: 'hu' })
    ]);

    const preview = repository.queryPublishedFeaturedPostPreview('en', 1);

    expect(preview.records.map(item => item.id)).toEqual(['featured-new']);
    expect(preview.total).toBe(3);
    expect(preview.nextCursor).toBeNull();
  });

  it('does not substitute English featured cards when the requested language has regular articles', async () => {
    seedPosts([
      post('hungarian-regular', '2026-07-20T12:00:00.000Z', { lang: 'hu' }),
      post('english-featured', '2026-07-20T11:00:00.000Z', { featured: true })
    ]);

    const preview = await TestBed.inject(LocalIdeaPostsService)
      .loadPublishedFeaturedPostPreview('hu');

    expect(preview.records).toEqual([]);
    expect(preview.total).toBe(1);
  });

  function seedPosts(posts: readonly IdeaPostDto[]): void {
    memoryDb.write(state => ({
      ...state,
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: true,
        byId: Object.fromEntries(posts.map(item => [item.id, item])),
        ids: posts.map(item => item.id)
      }
    }));
  }
});

function post(
  id: string,
  submittedAtIso: string,
  overrides: Partial<IdeaPostDto> = {}
): IdeaPostDto {
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
    submittedAtIso,
    createdAtIso: submittedAtIso,
    createdByUserId: 'admin',
    updatedAtIso: submittedAtIso,
    updatedByUserId: 'admin',
    ...overrides
  };
}

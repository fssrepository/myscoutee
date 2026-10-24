import '@angular/compiler';

import { signal, type WritableSignal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import type { IdeaPostAdminPageResultDto, IdeaPostDto } from '../../../contracts/content/content.interface';
import { IdeaPostsService } from './idea-posts.service';

describe('IdeaPostsService admin pagination', () => {
  it('does not reset loaded posts when an offset page has no cursor', async () => {
    const post = ideaPost('article-1');
    const loadAdminPostsPage = vi.fn()
      .mockResolvedValueOnce(adminPage([post]))
      .mockResolvedValueOnce(adminPage([]));
    const service = ideaPostsServiceWith(loadAdminPostsPage);

    await service.loadAdminPostsPage('admin', 'en', { page: 0, pageSize: 10 });
    await service.loadAdminPostsPage('admin', 'en', { page: 1, pageSize: 10 });

    expect(service.adminPostsRef()).toEqual([post]);
  });
});

describe('IdeaPostsService card captions', () => {
  it('uses UI keys while preserving article content', () => {
    const service = ideaPostsServiceWith(vi.fn());
    const post = { ...ideaPost('article'), featured: true, published: true, title: 'Cancel' };
    const [card] = service.publishedIdeaInfoCards([post]);
    expect(card.title).toBe('Cancel');
    expect(card.description).toBe(post.excerpt);
    expect(card.placeholderLabel).toBe('no.image');
    expect(card.footerChips).toEqual([{ label: 'read.more', actionId: 'viewArticle' }]);
    expect(card.mediaEnd).toMatchObject({ label: 'featured', selectedLabel: 'featured', ariaLabel: 'featured.article' });
  });

  it('reuses the date formatter across card/detail projections without changing the labels', () => {
    const OriginalFormatter = Intl.DateTimeFormat;
    const expected = new OriginalFormatter(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      .format(new Date('2026-09-04T10:00:00.000Z'));
    const formatter = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function(locales, options) {
      return new OriginalFormatter(locales, options);
    });
    try {
      const service = ideaPostsServiceWith(vi.fn());
      const posts = [ideaPost('article-1'), ideaPost('article-2')];
      for (const card of [...service.publishedIdeaInfoCards(posts), ...service.adminIdeaInfoCards(posts)]) {
        expect(card.metaRows).toEqual([expected]);
        expect(card.eagerDetail?.dateLabel).toBe(expected);
      }
      expect(formatter).toHaveBeenCalledTimes(1);
    } finally {
      formatter.mockRestore();
    }
  });

  it('translates missing-date captions before placing them beside article data', () => {
    const service = ideaPostsServiceWith(vi.fn());
    const post = { ...ideaPost('article'), submittedAtIso: '', updatedAtIso: '', createdAtIso: '' };
    const [card] = service.publishedIdeaInfoCards([post]);
    expect(card.metaRows).toEqual(['Friss cikk']);
    expect(card.eagerDetail?.dateLabel).toBe('Friss cikk');
    expect(service.adminIdeaInfoCards([post])[0].metaRows).toEqual(['Nincs dátum']);
  });

  it.each([
    { published: true, trashed: true, label: 'trashed' },
    { published: false, trashed: false, label: 'draft' },
    { published: true, trashed: false, label: 'published' }
  ])('uses the $label key for the admin status', ({ published, trashed, label }) => {
    const service = ideaPostsServiceWith(vi.fn());
    const [card] = service.adminIdeaInfoCards([{ ...ideaPost('article'), published, trashed }]);
    expect(card.mediaStart).toMatchObject({ label, ariaLabel: label });
  });
});

function ideaPostsServiceWith(
  loadAdminPostsPage: () => Promise<IdeaPostAdminPageResultDto>
): IdeaPostsServiceTestView {
  const service = Object.create(IdeaPostsService.prototype) as IdeaPostsServiceTestView;
  service.adminPostsRef = signal<IdeaPostDto[]>([]);
  service.adminPostsLang = 'en';
  service.i18n = { translate: key => key === 'fresh.article' ? 'Friss cikk' : key === 'no.date' ? 'Nincs dátum' : key };
  service.ideaService = () => ({ loadAdminPostsPage });
  return service;
}

interface IdeaPostsServiceTestView {
  adminPostsRef: WritableSignal<IdeaPostDto[]>;
  adminPostsLang: string;
  i18n: { translate: (key: string) => string };
  publishedIdeaInfoCards: IdeaPostsService['publishedIdeaInfoCards'];
  adminIdeaInfoCards: IdeaPostsService['adminIdeaInfoCards'];
  ideaService: () => {
    loadAdminPostsPage: () => Promise<IdeaPostAdminPageResultDto>;
  };
  loadAdminPostsPage: IdeaPostsService['loadAdminPostsPage'];
}

function adminPage(records: IdeaPostDto[]): IdeaPostAdminPageResultDto {
  return {
    records,
    total: records.length,
    nextCursor: null,
    counts: {
      all: records.length,
      featured: 0,
      published: 0,
      drafts: records.length,
      trashed: 0
    }
  };
}

function ideaPost(id: string): IdeaPostDto {
  return {
    id,
    contentKey: id,
    lang: 'en',
    languageLabel: 'English',
    title: 'Article',
    excerpt: 'Article excerpt',
    contentHtml: '<p>Article</p>',
    imageUrl: '',
    imageUrls: [],
    featured: false,
    published: false,
    trashed: false,
    trashedAtIso: '',
    trashedByUserId: '',
    submittedAtIso: '2026-09-04T10:00:00.000Z',
    createdAtIso: '2026-09-04T10:00:00.000Z',
    createdByUserId: 'admin',
    updatedAtIso: '2026-09-04T10:00:00.000Z',
    updatedByUserId: 'admin'
  };
}

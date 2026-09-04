import '@angular/compiler';

import { signal, type WritableSignal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import type { IdeaPostAdminPageResultDto, IdeaPostDto } from '../../contracts/content.interface';
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

function ideaPostsServiceWith(
  loadAdminPostsPage: () => Promise<IdeaPostAdminPageResultDto>
): IdeaPostsServiceTestView {
  const service = Object.create(IdeaPostsService.prototype) as IdeaPostsServiceTestView;
  service.adminPostsRef = signal<IdeaPostDto[]>([]);
  service.adminPostsLang = 'en';
  service.ideaService = () => ({ loadAdminPostsPage });
  return service;
}

interface IdeaPostsServiceTestView {
  adminPostsRef: WritableSignal<IdeaPostDto[]>;
  adminPostsLang: string;
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

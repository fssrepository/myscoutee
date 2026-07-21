import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import type { HelpCenterStateDto, IdeaPostDto } from '../../contracts';
import { HttpHelpCenterService } from './help-center.service';
import { HttpIdeaPostsService } from './idea-posts.service';
import { HttpLandingContentService } from './landing-content.service';

describe('HttpLandingContentService', () => {
  const get = vi.fn();
  const normalizeExternalState = vi.fn();
  const normalizePosts = vi.fn();

  beforeEach(() => {
    get.mockReset();
    normalizeExternalState.mockReset().mockReturnValue(helpCenterState());
    normalizePosts.mockReset();
    TestBed.configureTestingModule({
      providers: [
        HttpLandingContentService,
        { provide: HttpClient, useValue: { get } },
        { provide: HttpHelpCenterService, useValue: { normalizeExternalState } },
        { provide: HttpIdeaPostsService, useValue: { normalizePosts } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('preserves the all-published total alongside the featured preview', async () => {
    const preview = [post('featured-article')];
    get.mockReturnValue(of({ ideas: preview, ideasTotal: 21 }));
    normalizePosts.mockReturnValue(preview);

    const state = await TestBed.inject(HttpLandingContentService).loadContent();

    expect(state.ideas).toEqual(preview);
    expect(state.ideasTotal).toBe(21);
  });

  it('never reports a malformed total below the normalized preview size', async () => {
    const preview = [post('featured-a'), post('featured-b')];
    get.mockReturnValue(of({ ideas: preview, ideasTotal: -5 }));
    normalizePosts.mockReturnValue(preview);

    const state = await TestBed.inject(HttpLandingContentService).loadContent();

    expect(state.ideasTotal).toBe(2);
  });
});

function helpCenterState(): HelpCenterStateDto {
  return {
    activeRevision: null,
    revisions: [],
    auditTrail: [],
    availableLanguages: []
  };
}

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
    featured: true,
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

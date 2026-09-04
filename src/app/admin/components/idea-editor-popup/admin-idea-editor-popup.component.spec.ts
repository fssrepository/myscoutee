import '@angular/compiler';

import { describe, expect, it, vi } from 'vitest';

import type { IdeaPostDto } from '../../../shared/core/contracts/content.interface';
import { AdminIdeaEditorPopupComponent } from './admin-idea-editor-popup.component';

describe('AdminIdeaEditorPopupComponent SmartList actions', () => {
  it('resolves a cached visible card from its SmartList source item', () => {
    const post = ideaPost('article-1');
    const sourceItemSnapshot = vi.fn(() => post);
    const component = Object.create(AdminIdeaEditorPopupComponent.prototype) as AdminIdeaEditorPopupTestView;
    component.ideaSmartList = { sourceItemSnapshot };
    component.adminPostIndex = new Map();

    const result = component.ideaPostFromCard({
      id: 'idea:article-1',
      eagerDetail: { id: 'article-1' }
    });

    expect(sourceItemSnapshot).toHaveBeenCalledWith('idea:article-1');
    expect(result).toBe(post);
  });

  it('keeps the stable content key and HTML in a publication update', async () => {
    const post = {
      ...ideaPost('article-1'),
      contentKey: 'stable-content-key',
      contentHtml: '<p>Stable</p><figure><img src="/media/public?key=stable"></figure>',
      published: false,
      trashed: false
    };
    const savePost = vi.fn(async () => ({ ...post, published: true }));
    const component = Object.create(AdminIdeaEditorPopupComponent.prototype) as AdminIdeaEditorPopupTestView;
    component.ideaPosts = { savePost };
    component.actorUserId = () => 'admin';
    component.viewerPostId = '';
    component.viewerPost = null;
    component.draft = null;
    component.saving = false;
    component.error = '';
    component.refreshView = vi.fn();

    await component.confirmPublishedToggle(post, true);

    expect(savePost).toHaveBeenCalledWith(expect.objectContaining({
      id: 'article-1',
      contentKey: 'stable-content-key',
      contentHtml: post.contentHtml,
      published: true
    }));
  });
});

interface AdminIdeaEditorPopupTestView {
  ideaSmartList: {
    sourceItemSnapshot: (identity: string) => unknown;
  };
  adminPostIndex: Map<string, IdeaPostDto>;
  ideaPosts: {
    savePost: (request: unknown) => Promise<IdeaPostDto>;
  };
  actorUserId: () => string;
  viewerPostId: string;
  viewerPost: IdeaPostDto | null;
  draft: unknown;
  saving: boolean;
  error: string;
  refreshView: () => void;
  ideaPostFromCard: (card: {
    id: string;
    eagerDetail: { id: string };
  }) => IdeaPostDto | null;
  confirmPublishedToggle: (post: IdeaPostDto, nextPublished: boolean) => Promise<void>;
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
    trashed: true,
    trashedAtIso: '2026-09-04T10:00:00.000Z',
    trashedByUserId: 'admin',
    submittedAtIso: '2026-09-04T10:00:00.000Z',
    createdAtIso: '2026-09-04T10:00:00.000Z',
    createdByUserId: 'admin',
    updatedAtIso: '2026-09-04T10:00:00.000Z',
    updatedByUserId: 'admin'
  };
}

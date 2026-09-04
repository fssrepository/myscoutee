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
});

interface AdminIdeaEditorPopupTestView {
  ideaSmartList: {
    sourceItemSnapshot: (identity: string) => unknown;
  };
  adminPostIndex: Map<string, IdeaPostDto>;
  ideaPostFromCard: (card: {
    id: string;
    eagerDetail: { id: string };
  }) => IdeaPostDto | null;
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

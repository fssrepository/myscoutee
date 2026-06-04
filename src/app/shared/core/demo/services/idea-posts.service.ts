import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import type { IdeaPost, IdeaPostSaveRequest } from '../../base/models';
import type { DemoIdeaPostsTable } from '../models/idea-posts.model';
import { DemoIdeaPostsRepository } from '../repositories/idea-posts.repository';
import { RouteDelayService } from '../../base/services/route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class DemoIdeaPostsService {
  private static readonly MAX_IMAGE_URLS = 24;
  private readonly ideaPostsRepository = inject(DemoIdeaPostsRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async init(): Promise<boolean> {
    await this.ideaPostsRepository.whenReady();
    return this.ideaPostsRepository.seedDefaults();
  }

  async loadPublishedPosts(lang?: string | null): Promise<IdeaPost[]> {
    await this.ideaPostsRepository.whenReady();
    await this.ideaPostsRepository.seedDefaults();
    const language = this.requestContentLang(lang);
    const posts = this.sortedPosts(this.table()).filter(post => post.published && !post.trashed && post.lang === language);
    return posts.length > 0 ? posts : this.sortedPosts(this.table()).filter(post => post.published && !post.trashed && post.lang === 'en');
  }

  async loadAdminPosts(_adminUserId = '', lang = 'en'): Promise<IdeaPost[]> {
    await this.ideaPostsRepository.whenReady();
    this.ideaPostsRepository.assertSeeded();
    await this.routeDelay.waitForRouteDelay('/admin/ideas');
    const language = this.normalizeLang(lang);
    return this.sortedPosts(this.table()).filter(post => post.lang === language);
  }

  async savePost(request: IdeaPostSaveRequest): Promise<IdeaPost> {
    await this.ideaPostsRepository.whenReady();
    this.ideaPostsRepository.assertSeeded();
    const nowIso = new Date().toISOString();
    const language = this.normalizeLang(request.lang);
    const requestedContentKey = `${request.contentKey ?? ''}`.trim();
    const matchingTranslation = !request.id && requestedContentKey
      ? this.sortedPosts(this.table()).find(post => post.contentKey === requestedContentKey && post.lang === language) ?? null
      : null;
    const existing = request.id ? this.table().byId[request.id] ?? null : matchingTranslation;
    const id = request.id?.trim() || existing?.id || this.newId('idea');
    const contentKey = requestedContentKey || existing?.contentKey || this.contentKeyFromId(id);
    const contentHtml = this.normalizeHtml(request.contentHtml);
    const imageUrls = this.imageUrls(request.imageUrls, request.imageUrl);
    const post: IdeaPost = {
      id,
      contentKey,
      lang: language,
      languageLabel: this.languageLabel(language),
      title: request.title.trim() || 'Untitled idea',
      excerpt: this.excerpt(request.excerpt, contentHtml),
      contentHtml,
      imageUrl: request.imageUrl.trim() || imageUrls[0] || '',
      imageUrls,
      featured: request.featured === true,
      published: request.published !== false,
      trashed: false,
      trashedAtIso: '',
      trashedByUserId: '',
      submittedAtIso: this.submittedAtIso(request.submittedAtIso, existing?.submittedAtIso, nowIso),
      createdAtIso: existing?.createdAtIso || nowIso,
      createdByUserId: existing?.createdByUserId || request.actorUserId.trim() || 'admin',
      updatedAtIso: nowIso,
      updatedByUserId: request.actorUserId.trim() || 'admin'
    };
    await Promise.all([
      this.ideaPostsRepository.updateTableAndPersist(table => ({
        ...table,
        seeded: true,
        byId: {
          ...table.byId,
          [id]: post
        },
        ids: [...new Set([...table.ids.filter(currentId => currentId !== id), id])]
      })),
      this.routeDelay.waitForRouteDelay('/admin/ideas')
    ]);
    return this.clonePost(post);
  }

  async deletePost(postId: string, actorUserId = ''): Promise<IdeaPost[]> {
    await this.ideaPostsRepository.whenReady();
    const normalizedPostId = postId.trim();
    if (!normalizedPostId) {
      return this.sortedPosts(this.table());
    }
    const nowIso = new Date().toISOString();
    const actor = actorUserId.trim() || 'admin';
    await Promise.all([
      this.ideaPostsRepository.updateTableAndPersist(table => {
        const post = table.byId[normalizedPostId];
        if (!post) {
          return table;
        }
        return {
          ...table,
          byId: {
            ...table.byId,
            [normalizedPostId]: {
              ...this.normalizePost(post),
              featured: false,
              published: false,
              trashed: true,
              trashedAtIso: nowIso,
              trashedByUserId: actor,
              updatedAtIso: nowIso,
              updatedByUserId: actor
            }
          }
        };
      }),
      this.routeDelay.waitForRouteDelay('/admin/ideas')
    ]);
    return this.sortedPosts(this.table());
  }

  async restorePost(postId: string, actorUserId = ''): Promise<IdeaPost> {
    await this.ideaPostsRepository.whenReady();
    const normalizedPostId = postId.trim();
    const nowIso = new Date().toISOString();
    const actor = actorUserId.trim() || 'admin';
    let restored: IdeaPost | null = null;
    await Promise.all([
      this.ideaPostsRepository.updateTableAndPersist(table => {
        const post = table.byId[normalizedPostId];
        if (!normalizedPostId || !post) {
          return table;
        }
        restored = {
          ...this.normalizePost(post),
          featured: false,
          published: false,
          trashed: false,
          trashedAtIso: '',
          trashedByUserId: '',
          updatedAtIso: nowIso,
          updatedByUserId: actor
        };
        return {
          ...table,
          byId: {
            ...table.byId,
            [normalizedPostId]: restored
          }
        };
      }),
      this.routeDelay.waitForRouteDelay('/admin/ideas')
    ]);
    if (!restored) {
      throw new Error('Article could not be restored.');
    }
    return this.clonePost(restored);
  }

  private table(): DemoIdeaPostsTable {
    return this.ideaPostsRepository.readTable();
  }

  private sortedPosts(table: DemoIdeaPostsTable): IdeaPost[] {
    return table.ids
      .map(id => table.byId[id])
      .filter((post): post is IdeaPost => Boolean(post))
      .map(post => this.clonePost(this.normalizePost(post)))
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  private normalizePost(post: IdeaPost): IdeaPost {
    const contentHtml = this.normalizeHtml(post.contentHtml);
    const imageUrls = this.imageUrls(post.imageUrls, post.imageUrl);
    return {
      id: `${post.id ?? ''}`.trim(),
      contentKey: this.contentKeyFromId(`${post.contentKey ?? post.id ?? ''}`),
      lang: this.normalizeLang(post.lang),
      languageLabel: this.languageLabel(post.lang),
      title: `${post.title ?? ''}`.trim() || 'Untitled idea',
      excerpt: this.excerpt(post.excerpt, contentHtml),
      contentHtml,
      imageUrl: `${post.imageUrl ?? ''}`.trim() || imageUrls[0] || '',
      imageUrls,
      featured: post.featured === true,
      published: post.published !== false,
      trashed: post.trashed === true,
      trashedAtIso: `${post.trashedAtIso ?? ''}`.trim(),
      trashedByUserId: `${post.trashedByUserId ?? ''}`.trim(),
      submittedAtIso: `${post.submittedAtIso ?? ''}`.trim() || `${post.updatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      createdAtIso: `${post.createdAtIso ?? ''}`.trim(),
      createdByUserId: `${post.createdByUserId ?? ''}`.trim(),
      updatedAtIso: `${post.updatedAtIso ?? post.createdAtIso ?? ''}`.trim(),
      updatedByUserId: `${post.updatedByUserId ?? post.createdByUserId ?? ''}`.trim()
    };
  }

  private clonePost(post: IdeaPost): IdeaPost {
    return {
      ...post,
      imageUrls: [...post.imageUrls]
    };
  }

  private normalizeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
      .trim();
  }

  private excerpt(explicitExcerpt: string | null | undefined, contentHtml: string): string {
    const normalized = `${explicitExcerpt ?? ''}`.trim();
    if (normalized) {
      return this.truncate(normalized);
    }
    const text = this.htmlToText(contentHtml);
    return this.truncate(text);
  }

  private htmlToText(value: string): string {
    if (typeof document === 'undefined') {
      return `${value ?? ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const template = document.createElement('template');
    template.innerHTML = value;
    return `${template.content.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  private truncate(value: string): string {
    const normalized = `${value ?? ''}`.replace(/\s+/g, ' ').trim();
    return normalized.length <= 180 ? normalized : `${normalized.slice(0, 179).trim()}...`;
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private requestContentLang(lang: string | null | undefined): string {
    const explicit = this.supportedContentLang(lang);
    if (explicit) {
      return explicit;
    }
    return this.supportedContentLang(this.browserLanguage()) || 'en';
  }

  private browserLanguage(): string {
    const languages = this.browserLanguages()
      .map(value => this.normalizeRequestLanguage(value))
      .filter(Boolean);
    return languages.find(lang => lang !== 'en') ?? languages[0] ?? 'en';
  }

  private browserLanguages(): string[] {
    if (typeof navigator === 'undefined') {
      return [];
    }
    return Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  }

  private supportedContentLang(lang: string | null | undefined): string | null {
    const requested = this.normalizeRequestLanguage(lang);
    return APP_STATIC_DATA.contentLanguages.some(language => this.normalizeLang(language.lang) === requested)
      ? requested
      : null;
  }

  private normalizeRequestLanguage(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
    return normalized;
  }

  private languageLabel(lang: string | null | undefined): string {
    return this.normalizeLang(lang) === 'hu' ? 'Magyar' : 'English';
  }

  private contentKeyFromId(id: string | null | undefined): string {
    const normalized = `${id ?? ''}`.trim();
    return normalized.endsWith('-hu') ? normalized.slice(0, -3) : normalized;
  }

  private imageUrls(imageUrls: readonly string[] | null | undefined, primaryImageUrl: string | null | undefined): string[] {
    const urls = new Set<string>();
    const primary = `${primaryImageUrl ?? ''}`.trim();
    if (primary) {
      urls.add(primary);
    }
    for (const imageUrl of imageUrls ?? []) {
      const normalized = `${imageUrl ?? ''}`.trim();
      if (normalized) {
        urls.add(normalized);
      }
      if (urls.size >= DemoIdeaPostsService.MAX_IMAGE_URLS) {
        break;
      }
    }
    return [...urls];
  }

  private submittedAtIso(requested: string, existing: string | undefined, fallback: string): string {
    const normalized = requested.trim();
    if (normalized) {
      const parsed = Date.parse(normalized);
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : normalized;
    }
    return existing?.trim() || fallback;
  }

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

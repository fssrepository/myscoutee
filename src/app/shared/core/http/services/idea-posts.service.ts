import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { IdeaPost, IdeaPostSaveRequest } from '../../base/models';

@Injectable({
  providedIn: 'root'
})
export class HttpIdeaPostsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadPublishedPosts(lang?: string | null): Promise<IdeaPost[]> {
    const requestLang = this.requestLang(lang);
    const response = await this.http
      .get<{ ideas?: Array<Partial<IdeaPost>> | null } | null>(`${this.apiBaseUrl}/landing/content`, {
        params: { lang: requestLang }
      })
      .toPromise();
    return this.normalizePosts(response?.ideas);
  }

  async loadAdminPosts(adminUserId: string, lang = 'en'): Promise<IdeaPost[]> {
    const params: Record<string, string> = { lang: this.normalizeLang(lang) };
    if (adminUserId.trim()) {
      params['adminUserId'] = adminUserId.trim();
    }
    const response = await this.http
      .get<Array<Partial<IdeaPost>> | null>(`${this.apiBaseUrl}/admin/ideas`, {
        params
      })
      .toPromise();
    return this.normalizePosts(response);
  }

  async prepareAdminArticlePanelLoad(): Promise<void> {
    return;
  }

  adminArticlePanelLoadProgressDurationMs(): number {
    return 0;
  }

  async savePost(request: IdeaPostSaveRequest): Promise<IdeaPost> {
    const response = await this.http
      .post<Partial<IdeaPost> | null>(`${this.apiBaseUrl}/admin/ideas`, request)
      .toPromise();
    const post = this.normalizePost(response);
    if (!post) {
      throw new Error('Idea post could not be saved.');
    }
    return post;
  }

  async deletePost(postId: string, actorUserId: string): Promise<IdeaPost[]> {
    const response = await this.http
      .request<Array<Partial<IdeaPost>> | null>(
        'delete',
        `${this.apiBaseUrl}/admin/ideas/${encodeURIComponent(postId)}`,
        { body: { actorUserId } }
      )
      .toPromise();
    return this.normalizePosts(response);
  }

  async restorePost(postId: string, actorUserId: string): Promise<IdeaPost> {
    const response = await this.http
      .post<Partial<IdeaPost> | null>(
        `${this.apiBaseUrl}/admin/ideas/${encodeURIComponent(postId)}/restore`,
        { actorUserId }
      )
      .toPromise();
    const post = this.normalizePost(response);
    if (!post) {
      throw new Error('Idea post could not be restored.');
    }
    return post;
  }

  normalizePosts(value: Array<Partial<IdeaPost>> | null | undefined): IdeaPost[] {
    return (Array.isArray(value) ? value : [])
      .map(post => this.normalizePost(post))
      .filter((post): post is IdeaPost => Boolean(post))
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  normalizePost(value: Partial<IdeaPost> | null | undefined): IdeaPost | null {
    const id = `${value?.id ?? ''}`.trim();
    const title = `${value?.title ?? ''}`.trim();
    const contentHtml = `${value?.contentHtml ?? ''}`.trim();
    if (!id || !title || !contentHtml) {
      return null;
    }
    const imageUrls = Array.from(new Set(
      (Array.isArray(value?.imageUrls) ? value.imageUrls : [])
        .map(imageUrl => `${imageUrl ?? ''}`.trim())
        .filter(Boolean)
    ));
    const imageUrl = `${value?.imageUrl ?? ''}`.trim() || imageUrls[0] || '';
    if (imageUrl && !imageUrls.includes(imageUrl)) {
      imageUrls.unshift(imageUrl);
    }
    return {
      id,
      contentKey: this.contentKey(value?.contentKey, id),
      lang: this.normalizeLang(value?.lang),
      languageLabel: this.languageLabel(value?.lang, value?.languageLabel),
      title,
      excerpt: `${value?.excerpt ?? ''}`.trim() || this.excerptFromHtml(contentHtml),
      contentHtml,
      imageUrl,
      imageUrls,
      featured: value?.featured === true,
      published: value?.published !== false,
      trashed: value?.trashed === true,
      trashedAtIso: `${value?.trashedAtIso ?? ''}`.trim(),
      trashedByUserId: `${value?.trashedByUserId ?? ''}`.trim(),
      submittedAtIso: `${value?.submittedAtIso ?? value?.updatedAtIso ?? value?.createdAtIso ?? ''}`.trim(),
      createdAtIso: `${value?.createdAtIso ?? ''}`.trim(),
      createdByUserId: `${value?.createdByUserId ?? ''}`.trim(),
      updatedAtIso: `${value?.updatedAtIso ?? value?.createdAtIso ?? ''}`.trim(),
      updatedByUserId: `${value?.updatedByUserId ?? value?.createdByUserId ?? ''}`.trim()
    };
  }

  private excerptFromHtml(value: string): string {
    const text = `${value ?? ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length <= 180 ? text : `${text.slice(0, 179).trim()}...`;
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private requestLang(lang?: string | null): string {
    const explicit = this.normalizeRequestLanguage(lang);
    if (explicit) {
      return explicit;
    }
    return this.browserLanguage();
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

  private normalizeRequestLanguage(lang?: string | null): string {
    return `${lang ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
  }

  private contentKey(value: string | null | undefined, id: string): string {
    const explicit = `${value ?? ''}`.trim();
    if (explicit) {
      return explicit;
    }
    return id.endsWith('-hu') ? id.slice(0, -3) : id;
  }

  private languageLabel(lang: string | null | undefined, label: string | null | undefined): string {
    const explicit = `${label ?? ''}`.trim();
    return explicit || (this.normalizeLang(lang) === 'hu' ? 'Magyar' : 'English');
  }

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

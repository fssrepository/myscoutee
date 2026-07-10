import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  IdeaPostAdminCountsDto,
  IdeaPostAdminPageQueryDto,
  IdeaPostAdminPageResultDto,
  IdeaPostDto,
  IdeaPostSaveRequestDto
} from '../../contracts/content.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpIdeaPostsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadPublishedPosts(lang?: string | null): Promise<IdeaPostDto[]> {
    const requestLang = this.requestLang(lang);
    const response = await this.http
      .get<{ ideas?: Array<Partial<IdeaPostDto>> | null } | null>(`${this.apiBaseUrl}/landing/content`, {
        params: { lang: requestLang }
      })
      .toPromise();
    return this.normalizePosts(response?.ideas);
  }

  async loadAdminPosts(adminUserId: string, lang = 'en'): Promise<IdeaPostDto[]> {
    const params: Record<string, string> = { lang: this.normalizeLang(lang) };
    if (adminUserId.trim()) {
      params['adminUserId'] = adminUserId.trim();
    }
    const response = await this.http
      .get<Array<Partial<IdeaPostDto>> | null>(`${this.apiBaseUrl}/admin/ideas`, {
        params
      })
      .toPromise();
    return this.normalizePosts(response);
  }

  async loadAdminPostsPage(
    adminUserId: string,
    lang = 'en',
    query: IdeaPostAdminPageQueryDto = {}
  ): Promise<IdeaPostAdminPageResultDto> {
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const params: Record<string, string> = {
      lang: this.normalizeLang(lang),
      status: this.normalizeAdminStatus(query.status),
      page: String(page),
      pageSize: String(pageSize)
    };
    if (adminUserId.trim()) {
      params['adminUserId'] = adminUserId.trim();
    }
    const cursor = `${query.cursor ?? ''}`.trim();
    if (cursor) {
      params['cursor'] = cursor;
    }
    const response = await this.http
      .get<Array<Partial<IdeaPostDto>> | Partial<IdeaPostAdminPageResultDto> | null>(`${this.apiBaseUrl}/admin/ideas`, {
        params
      })
      .toPromise();
    return this.normalizeAdminPage(response);
  }

  async savePost(request: IdeaPostSaveRequestDto): Promise<IdeaPostDto> {
    const response = await this.http
      .post<Partial<IdeaPostDto> | null>(`${this.apiBaseUrl}/admin/ideas`, request)
      .toPromise();
    const post = this.normalizePost(response);
    if (!post) {
      throw new Error('Idea post could not be saved.');
    }
    return post;
  }

  async deletePost(postId: string, actorUserId: string): Promise<IdeaPostDto[]> {
    const response = await this.http
      .request<Array<Partial<IdeaPostDto>> | null>(
        'delete',
        `${this.apiBaseUrl}/admin/ideas/${encodeURIComponent(postId)}`,
        { body: { actorUserId } }
      )
      .toPromise();
    return this.normalizePosts(response);
  }

  async restorePost(postId: string, actorUserId: string): Promise<IdeaPostDto> {
    const response = await this.http
      .post<Partial<IdeaPostDto> | null>(
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

  normalizePosts(value: Array<Partial<IdeaPostDto>> | null | undefined): IdeaPostDto[] {
    return (Array.isArray(value) ? value : [])
      .map(post => this.normalizePost(post))
      .filter((post): post is IdeaPostDto => Boolean(post))
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  normalizePost(value: Partial<IdeaPostDto> | null | undefined): IdeaPostDto | null {
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

  private normalizeAdminPage(
    value: Array<Partial<IdeaPostDto>> | Partial<IdeaPostAdminPageResultDto> | null | undefined
  ): IdeaPostAdminPageResultDto {
    if (Array.isArray(value)) {
      const records = this.normalizePosts(value);
      return {
        records,
        total: records.length,
        nextCursor: null,
        counts: this.countPosts(records)
      };
    }
    const records = this.normalizePosts(Array.isArray(value?.records) ? value.records : []);
    const explicitTotal = Math.trunc(Number(value?.total));
    return {
      records,
      total: Number.isFinite(explicitTotal) && explicitTotal >= 0 ? explicitTotal : records.length,
      nextCursor: typeof value?.nextCursor === 'string' && value.nextCursor.trim().length > 0
        ? value.nextCursor.trim()
        : null,
      counts: this.normalizeCounts(value?.counts, records)
    };
  }

  private normalizeCounts(
    value: Partial<IdeaPostAdminCountsDto> | null | undefined,
    fallbackPosts: readonly IdeaPostDto[]
  ): IdeaPostAdminCountsDto {
    const fallback = this.countPosts(fallbackPosts);
    return {
      all: this.nonNegativeInteger(value?.all, fallback.all),
      featured: this.nonNegativeInteger(value?.featured, fallback.featured),
      published: this.nonNegativeInteger(value?.published, fallback.published),
      drafts: this.nonNegativeInteger(value?.drafts, fallback.drafts),
      trashed: this.nonNegativeInteger(value?.trashed, fallback.trashed)
    };
  }

  private countPosts(posts: readonly IdeaPostDto[]): IdeaPostAdminCountsDto {
    return posts.reduce<IdeaPostAdminCountsDto>((counts, post) => {
      if (post.trashed) {
        counts.trashed += 1;
        return counts;
      }
      counts.all += 1;
      if (post.featured) {
        counts.featured += 1;
      }
      if (post.published) {
        counts.published += 1;
      } else {
        counts.drafts += 1;
      }
      return counts;
    }, {
      all: 0,
      featured: 0,
      published: 0,
      drafts: 0,
      trashed: 0
    });
  }

  private nonNegativeInteger(value: number | null | undefined, fallback: number): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private normalizeAdminStatus(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    switch (normalized) {
      case 'featured':
      case 'published':
      case 'drafts':
      case 'trashed':
        return normalized;
      case 'draft':
        return 'drafts';
      case 'trash':
        return 'trashed';
      default:
        return 'all';
    }
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

  private sortValue(post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

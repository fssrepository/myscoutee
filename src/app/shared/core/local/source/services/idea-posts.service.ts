import type { IdeaPostsTable } from '../entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../../app-static-data';
import type {
  IdeaPostAdminPageQueryDto,
  IdeaPostAdminPageResultDto,
  IdeaPostDto,
  IdeaPostPublicPageQueryDto,
  IdeaPostPublicPageResultDto,
  IdeaPostSaveRequestDto
} from '../../../contracts/content.interface';

import { LocalIdeaPostsRepository } from '../repositories/idea-posts.repository';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalIdeaPostsMapper } from '../mappers';

@Injectable({
  providedIn: 'root'
})
export class LocalIdeaPostsService {
  private static readonly ADMIN_IDEAS_ROUTE = '/admin/ideas';
  private static readonly PUBLIC_IDEAS_ROUTE = '/landing/articles';
  private static readonly LANDING_FEATURED_PREVIEW_LIMIT = 8;
  private readonly ideaPostsRepository = inject(LocalIdeaPostsRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async loadPublishedPosts(lang?: string | null): Promise<IdeaPostDto[]> {
    await this.ideaPostsRepository.whenReady();
    const language = this.requestContentLang(lang);
    const posts = this.sortedPosts(this.table()).filter(post => post.published && !post.trashed && post.lang === language);
    return posts.length > 0 ? posts : this.sortedPosts(this.table()).filter(post => post.published && !post.trashed && post.lang === 'en');
  }

  async loadPublishedPostsPage(
    lang: string | null | undefined,
    query: IdeaPostPublicPageQueryDto = {},
    signal?: AbortSignal
  ): Promise<IdeaPostPublicPageResultDto> {
    await this.ideaPostsRepository.whenReady();
    await this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.PUBLIC_IDEAS_ROUTE, signal);
    const language = this.requestContentLang(lang);
    let page = this.ideaPostsRepository.queryPublishedPostPage(language, query);
    if (page.total === 0 && language !== 'en') {
      page = this.ideaPostsRepository.queryPublishedPostPage('en', query);
    }
    return LocalIdeaPostsMapper.toDtoPage(page);
  }

  async loadPublishedFeaturedPostPreview(
    lang?: string | null
  ): Promise<IdeaPostPublicPageResultDto> {
    await this.ideaPostsRepository.whenReady();
    const language = this.requestContentLang(lang);
    let preview = this.ideaPostsRepository.queryPublishedFeaturedPostPreview(
      language,
      LocalIdeaPostsService.LANDING_FEATURED_PREVIEW_LIMIT
    );
    if (preview.total === 0 && language !== 'en') {
      preview = this.ideaPostsRepository.queryPublishedFeaturedPostPreview(
        'en',
        LocalIdeaPostsService.LANDING_FEATURED_PREVIEW_LIMIT
      );
    }
    return LocalIdeaPostsMapper.toDtoPage(preview);
  }

  async loadAdminPosts(_adminUserId = '', lang = 'en'): Promise<IdeaPostDto[]> {
    await this.ideaPostsRepository.whenReady();
    await this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE);
    const language = this.normalizeLang(lang);
    return this.sortedPosts(this.table()).filter(post => post.lang === language);
  }

  async loadAdminPostsPage(
    _adminUserId = '',
    lang = 'en',
    query: IdeaPostAdminPageQueryDto = {}
  ): Promise<IdeaPostAdminPageResultDto> {
    await this.ideaPostsRepository.whenReady();
    await this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE);
    return LocalIdeaPostsMapper.toAdminDtoPage(
      this.ideaPostsRepository.queryAdminPostPage(this.normalizeLang(lang), query)
    );
  }

  async savePost(request: IdeaPostSaveRequestDto): Promise<IdeaPostDto> {
    await this.ideaPostsRepository.whenReady();
    await this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE);
    const nowIso = new Date().toISOString();
    const record = LocalIdeaPostsMapper.toRecord(request, {
      id: request.id?.trim() || this.ideaPostsRepository.createPostId(),
      nowIso
    });
    const saved = this.ideaPostsRepository.savePostSnapshot(record);
    await this.ideaPostsRepository.flushToIndexedDb();
    return LocalIdeaPostsMapper.toDto(saved);
  }

  async deletePost(postId: string, actorUserId = ''): Promise<IdeaPostDto> {
    await this.ideaPostsRepository.whenReady();
    const normalizedPostId = postId.trim();
    if (!normalizedPostId) {
      throw new Error('Article id is required.');
    }
    const nowIso = new Date().toISOString();
    const actor = actorUserId.trim() || 'admin';
    let trashed: IdeaPostDto | null = null;
    await Promise.all([
      this.ideaPostsRepository.updateTableAndPersist(table => {
        const post = table.byId[normalizedPostId];
        if (!post) {
          return table;
        }
        trashed = {
          ...LocalIdeaPostsMapper.toDto(post),
          featured: false,
          published: false,
          trashed: true,
          trashedAtIso: nowIso,
          trashedByUserId: actor,
          updatedAtIso: nowIso,
          updatedByUserId: actor
        };
        return {
          ...table,
          byId: {
            ...table.byId,
            [normalizedPostId]: trashed
          }
        };
      }),
      this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE)
    ]);
    if (!trashed) {
      throw new Error('Article could not be moved to trash.');
    }
    return this.clonePost(trashed);
  }

  async restorePost(postId: string, actorUserId = ''): Promise<IdeaPostDto> {
    await this.ideaPostsRepository.whenReady();
    const normalizedPostId = postId.trim();
    const nowIso = new Date().toISOString();
    const actor = actorUserId.trim() || 'admin';
    let restored: IdeaPostDto | null = null;
    await Promise.all([
      this.ideaPostsRepository.updateTableAndPersist(table => {
        const post = table.byId[normalizedPostId];
        if (!normalizedPostId || !post) {
          return table;
        }
        restored = {
          ...LocalIdeaPostsMapper.toDto(post),
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
      this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE)
    ]);
    if (!restored) {
      throw new Error('Article could not be restored.');
    }
    return this.clonePost(restored);
  }

  private table(): IdeaPostsTable {
    return this.ideaPostsRepository.readTable();
  }

  private sortedPosts(table: IdeaPostsTable): IdeaPostDto[] {
    return table.ids
      .map(id => table.byId[id])
      .filter((post): post is IdeaPostDto => Boolean(post))
      .map(post => LocalIdeaPostsMapper.toDto(post))
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  private clonePost(post: IdeaPostDto): IdeaPostDto {
    return LocalIdeaPostsMapper.toDto(post);
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

  private sortValue(post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

}

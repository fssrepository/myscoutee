import { HelpCenterContentBuilder } from '../../../../base/builders/help/help-center-content.builder';
import SUPPORTED_CONTENT_LANGUAGES from '../../../../common/content-languages.json';
import { LocalUsersRepository } from "../../repositories/accounts/users.repository";
import type { IdeaPostsTable } from '../../entity/content/content.entity';
import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../../common/app-static-data';
import type {
  IdeaPostAdminPageQueryDto,
  IdeaPostAdminPageResultDto,
  IdeaPostDto,
  IdeaPostPublicPageQueryDto,
  IdeaPostPublicPageResultDto,
  IdeaPostSaveRequestDto
} from '../../../../contracts/content/content.interface';

import { LocalIdeaPostsRepository } from '../../repositories/content/idea-posts.repository';
import { RouteDelayService } from '../../../../base/services/platform/route-delay.service';
import { LocalIdeaPostsMapper } from '../../mappers';

@Injectable({
  providedIn: 'root'
})
export class LocalIdeaPostsService {
  private readonly users = inject(LocalUsersRepository);
  private groupId(actorId: string) { return this.users.queryUserById(actorId)?.workspaceGroupId ?? null; }
  private static readonly ADMIN_IDEAS_ROUTE = '/admin/ideas';
  private static readonly PUBLIC_IDEAS_ROUTE = '/landing/articles';
  private static readonly LANDING_FEATURED_PREVIEW_LIMIT = 8;
  private readonly ideaPostsRepository = inject(LocalIdeaPostsRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async loadPublishedPosts(lang?: string | null, groupId: string | null = null): Promise<IdeaPostDto[]> {
    await this.ideaPostsRepository.whenReady();
    const language = this.requestContentLang(lang);
    const posts = this.sortedPosts(this.table()).filter(post => (post.workspaceGroupId ?? null) === groupId && post.published && !post.trashed && post.lang === language);
    return posts.length > 0 ? posts : this.sortedPosts(this.table()).filter(post => (post.workspaceGroupId ?? null) === groupId && post.published && !post.trashed && post.lang === 'en');
  }

  async loadPublishedPostsPage(
    lang: string | null | undefined,
    query: IdeaPostPublicPageQueryDto = {},
    signal?: AbortSignal
  ): Promise<IdeaPostPublicPageResultDto> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.PUBLIC_IDEAS_ROUTE, signal),
      (async (): Promise<IdeaPostPublicPageResultDto> => {
        await this.ideaPostsRepository.whenReady();
        const language = this.requestContentLang(lang);
        let page = this.ideaPostsRepository.queryPublishedPostPage(language, query);
        if (page.total === 0 && language !== 'en') {
          page = this.ideaPostsRepository.queryPublishedPostPage('en', query);
        }
        return LocalIdeaPostsMapper.toDtoPage(page);
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }

  async loadPublishedFeaturedPostPreview(
    lang?: string | null,
    groupId: string | null = null
  ): Promise<IdeaPostPublicPageResultDto> {
    await this.ideaPostsRepository.whenReady();
    const language = this.requestContentLang(lang);
    let preview = this.ideaPostsRepository.queryPublishedFeaturedPostPreview(
      language,
      LocalIdeaPostsService.LANDING_FEATURED_PREVIEW_LIMIT,
      groupId
    );
    if (preview.total === 0 && language !== 'en') {
      preview = this.ideaPostsRepository.queryPublishedFeaturedPostPreview(
        'en',
        LocalIdeaPostsService.LANDING_FEATURED_PREVIEW_LIMIT,
      groupId
      );
    }
    return LocalIdeaPostsMapper.toDtoPage(preview);
  }

  async loadAdminPosts(adminUserId = '', lang = 'en'): Promise<IdeaPostDto[]> {
    const [, response] = await Promise.all([
      this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE),
      (async (): Promise<IdeaPostDto[]> => {
        await this.ideaPostsRepository.whenReady();
        const language = this.normalizeLang(lang);
        return this.sortedPosts(this.table()).filter(post => post.lang === language && (post.workspaceGroupId ?? null) === this.groupId(adminUserId));
      })()
    ]);
    return response;
  }

  async loadAdminPostsPage(
    adminUserId = '',
    lang = 'en',
    query: IdeaPostAdminPageQueryDto = {}
  ): Promise<IdeaPostAdminPageResultDto> {
    const [, response] = await Promise.all([
      this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE),
      (async (): Promise<IdeaPostAdminPageResultDto> => {
        await this.ideaPostsRepository.whenReady();
        return LocalIdeaPostsMapper.toAdminDtoPage(
          this.ideaPostsRepository.queryAdminPostPage(this.normalizeLang(lang), query, this.groupId(adminUserId))
        );
      })()
    ]);
    return response;
  }

  async savePost(request: IdeaPostSaveRequestDto): Promise<IdeaPostDto> {
    const [, result] = await Promise.all([
      this.routeDelay.waitForRouteDelay(LocalIdeaPostsService.ADMIN_IDEAS_ROUTE),
      (async (): Promise<IdeaPostDto> => {
        await this.ideaPostsRepository.whenReady();
        const nowIso = new Date().toISOString();
        const groupId = this.groupId(request.actorUserId);
        const existing = request.id ? this.table().byId[request.id] : null;
        if (existing && (existing.workspaceGroupId ?? null) !== groupId) throw new Error('Forbidden');
        const record = LocalIdeaPostsMapper.toRecord(request, {
          id: request.id?.trim() || this.ideaPostsRepository.createPostId(),
          nowIso
        });
        record.workspaceGroupId = groupId;
        const saved = this.ideaPostsRepository.savePostSnapshot(record);
        await this.ideaPostsRepository.flushToIndexedDb();
        return LocalIdeaPostsMapper.toDto(saved);
      })()
    ]);
    return result;
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
        if ((post.workspaceGroupId ?? null) !== this.groupId(actorUserId)) throw new Error('Forbidden');
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
        if ((post.workspaceGroupId ?? null) !== this.groupId(actorUserId)) throw new Error('Forbidden');
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
    return HelpCenterContentBuilder.normalizeLang(lang);
  }

  private requestContentLang(lang: string | null | undefined): string {
    return HelpCenterContentBuilder.requestContentLanguage(lang, APP_STATIC_DATA.contentLanguages.map(language => ({ lang: this.normalizeLang(language.lang) })));
  }

  private browserLanguage(): string {
    return HelpCenterContentBuilder.browserLanguage();
  }

  private browserLanguages(): string[] {
    return HelpCenterContentBuilder.browserLanguages();
  }

  private supportedContentLang(lang: string | null | undefined): string | null {
    const requested = this.normalizeRequestLanguage(lang);
    return APP_STATIC_DATA.contentLanguages.some(language => this.normalizeLang(language.lang) === requested)
      ? requested
      : null;
  }

  private normalizeRequestLanguage(lang: string | null | undefined): string {
    return HelpCenterContentBuilder.normalizeRequestLanguage(lang);
  }

  private sortValue(post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

}

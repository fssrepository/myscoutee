import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import SUPPORTED_CONTENT_LANGUAGES from '../../../common/content-languages.json';
import { Injectable, inject, signal } from '@angular/core';

import type {
  IdeaArticleDetailDto,
  IdeaPostAdminFilter,
  IdeaPostAdminPageQueryDto,
  IdeaPostAdminPageResultDto,
  IdeaPostDto,
  IdeaPostPublicPageQueryDto,
  IdeaPostPublicPageResultDto,
  IdeaPostSaveRequestDto
} from '../../../contracts/content/content.interface';
import { type PageResult, type InfoCardData, type CardMenuActionId } from '@fssrepository/myscoutee-components';

import { I18nService } from '../localization/i18n.service';

import { BaseRouteModeService } from '../platform/base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class IdeaPostsService extends BaseRouteModeService {
  private readonly i18n = inject(I18nService);
  private readonly transportAdapters = inject(AdapterProxyService);
  private static readonly ARTICLE_FALLBACK_IMAGE_URL = 'assets/idea/article-fallback.svg';
  private static readonly PUBLIC_IDEAS_ROUTE = '/landing/articles';

  private readonly localIdeaPostsService = this.transportAdapters.reference(LOCAL_ADAPTER.IDEA_POSTS);
  private readonly httpIdeaPostsService = this.transportAdapters.reference(HTTP_ADAPTER.IDEA_POSTS);
  private readonly postsRef = signal<IdeaPostDto[]>([]);
  private readonly adminPostsRef = signal<IdeaPostDto[]>([]);
  private readonly adminPostSyncRef = signal<IdeaPostDto | null>(null);
  private adminPostsLang = 'en';

  readonly posts = this.postsRef.asReadonly();
  readonly adminPosts = this.adminPostsRef.asReadonly();
  readonly adminPostSync = this.adminPostSyncRef.asReadonly();

  applyPublishedPosts(posts: readonly IdeaPostDto[]): void {
    this.postsRef.set(this.clonePosts(posts)
      .filter(post => post.published && !post.trashed)
      .sort((left, right) => this.sortValue(right) - this.sortValue(left)));
  }

  async loadPublishedPosts(lang?: string | null, groupId: string | null = null): Promise<IdeaPostDto[]> {
    const posts = await this.ideaService().loadPublishedPosts(lang, groupId);
    this.applyPublishedPosts(posts);
    return this.clonePosts(this.postsRef());
  }

  async loadPublishedPostsPage(
    lang: string | null | undefined,
    query: IdeaPostPublicPageQueryDto = {},
    signal?: AbortSignal
  ): Promise<IdeaPostPublicPageResultDto> {
    const result = await this.publicIdeaService().loadPublishedPostsPage(lang, query, signal);
    return {
      records: this.clonePosts(result.records),
      total: Math.max(0, Math.trunc(Number(result.total) || 0)),
      nextCursor: `${result.nextCursor ?? ''}`.trim() || null
    };
  }

  async loadPublishedIdeaCardsPage(
    query: IdeaPostPublicPageQueryDto = {},
    options: { lang?: string | null; signal?: AbortSignal } = {}
  ): Promise<PageResult<InfoCardData<IdeaArticleDetailDto>>> {
    const result = await this.loadPublishedPostsPage(options.lang, query, options.signal);
    return {
      items: this.publishedIdeaInfoCards(result.records),
      total: result.total,
      nextCursor: result.nextCursor
    };
  }

  async loadAdminPosts(adminUserId: string, lang = 'en'): Promise<IdeaPostDto[]> {
    const posts = await this.ideaService().loadAdminPosts(adminUserId, lang);
    const cloned = this.clonePosts(posts).sort((left, right) => this.compareAdminPosts(left, right));
    this.adminPostsLang = this.normalizeLang(lang);
    this.adminPostsRef.set(cloned);
    this.applyPublishedPosts(cloned.filter(post => post.published));
    return this.clonePosts(cloned);
  }

  async loadAdminPostsSnapshot(adminUserId: string, lang = 'en'): Promise<IdeaPostDto[]> {
    const posts = await this.ideaService().loadAdminPosts(adminUserId, lang);
    return this.clonePosts(posts).sort((left, right) => this.compareAdminPosts(left, right));
  }

  async loadAdminPostsPage(
    adminUserId: string,
    lang = 'en',
    query: IdeaPostAdminPageQueryDto = {}
  ): Promise<IdeaPostAdminPageResultDto> {
    const page = await this.ideaService().loadAdminPostsPage(adminUserId, lang, query);
    const records = this.clonePosts(page.records).sort((left, right) => this.compareAdminPosts(left, right));
    this.adminPostsLang = this.normalizeLang(lang);
    this.adminPostsRef.set(this.shouldResetAdminPage(query)
      ? records
      : this.mergePostLists(this.adminPostsRef(), records));
    return {
      records,
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: `${page.nextCursor ?? ''}`.trim() || null,
      counts: {
        all: Math.max(0, Math.trunc(Number(page.counts?.all) || 0)),
        featured: Math.max(0, Math.trunc(Number(page.counts?.featured) || 0)),
        published: Math.max(0, Math.trunc(Number(page.counts?.published) || 0)),
        drafts: Math.max(0, Math.trunc(Number(page.counts?.drafts) || 0)),
        trashed: Math.max(0, Math.trunc(Number(page.counts?.trashed) || 0))
      }
    };
  }

  async savePost(request: IdeaPostSaveRequestDto): Promise<IdeaPostDto> {
    const post = await this.ideaService().savePost(request);
    this.mergeAdminPost(post);
    const sync = { ...post, imageUrls: [...post.imageUrls] };
    this.adminPostSyncRef.set(sync);
    return sync;
  }

  async deletePost(postId: string, actorUserId: string): Promise<IdeaPostDto> {
    const post = await this.ideaService().deletePost(postId, actorUserId);
    this.mergeAdminPost(post);
    const sync = { ...post, imageUrls: [...post.imageUrls] };
    this.adminPostSyncRef.set(sync);
    return sync;
  }

  async restorePost(postId: string, actorUserId: string): Promise<IdeaPostDto> {
    const post = await this.ideaService().restorePost(postId, actorUserId);
    this.mergeAdminPost(post);
    const sync = { ...post, imageUrls: [...post.imageUrls] };
    this.adminPostSyncRef.set(sync);
    return sync;
  }

  clearAdminPostSync(): void {
    this.adminPostSyncRef.set(null);
  }

  publishedIdeaInfoCards(
    posts: readonly IdeaPostDto[] = this.postsRef()
  ): InfoCardData<IdeaArticleDetailDto>[] {
    return posts.map(post => this.entryIdeaInfoCard(post));
  }

  adminIdeaInfoCards(
    posts: readonly IdeaPostDto[] = this.adminPostsRef()
  ): InfoCardData<IdeaArticleDetailDto>[] {
    return posts.map(post => this.adminIdeaInfoCard(post));
  }

  private entryIdeaInfoCard(post: IdeaPostDto): InfoCardData<IdeaArticleDetailDto> {
    return {
      id: `entry-idea:${post.id}`,
      status: post.published ? 'published' : 'draft',
      dateIso: post.submittedAtIso,
      title: post.title,
      imageUrl: this.ideaImageUrl(post) || null,
      placeholderLabel: 'no.image',
      metaRows: [this.ideaDateLabel(post, 'fresh.article')],
      metaRowsLimit: 1,
      description: post.excerpt,
      descriptionLines: 3,
      i18nIgnoreContent: true,
      leadingIcon: {
        icon: 'calendar_today',
        tone: 'public'
      },
      mediaEnd: post.featured
        ? {
            variant: 'badge',
            tone: 'selected',
            icon: 'star',
            label: 'featured',
            selected: true,
            selectedIcon: 'star',
            selectedLabel: 'featured',
            ariaLabel: 'featured.article',
            interactive: false
          }
        : null,
      footerChips: [
        { label: 'read.more', actionId: 'viewArticle' }
      ],
      clickable: true,
      eagerDetail: this.ideaArticleDetail(post, 'fresh.article')
    };
  }

  adminIdeaInfoCard(post: IdeaPostDto): InfoCardData<IdeaArticleDetailDto> {
    const statusLabel = this.adminPostStatusLabel(post);
    const publicationAction: CardMenuActionId = post.published ? 'unpublish' : 'publish';
    const featuredAction: CardMenuActionId = post.featured ? 'unfeature' : 'feature';
    const menuActions: readonly CardMenuActionId[] = post.trashed
      ? ['restore']
      : [
          'viewArticle',
          'edit',
          publicationAction,
          ...(post.published ? [featuredAction] : []),
          'delete'
        ];
    return {
      id: `idea:${post.id}`,
      localSortKey: [-this.sortValue(post), `idea:${post.id}`],
      status: post.trashed ? 'trashed' : post.published ? 'published' : 'draft',
      dateIso: post.submittedAtIso,
      title: post.title,
      imageUrl: this.ideaImageUrl(post) || null,
      placeholderLabel: 'no.image',
      metaRows: [this.ideaDateLabel(post, 'no.date')],
      metaRowsLimit: 1,
      description: post.excerpt,
      descriptionLines: 3,
      i18nIgnoreContent: true,
      surfaceTone: post.trashed ? 'draft' : !post.published ? 'draft' : post.featured ? 'series' : 'default',
      leadingIcon: {
        icon: post.trashed ? 'delete_outline' : post.published ? 'article' : 'drafts',
        tone: post.published && !post.trashed ? 'public' : 'pending'
      },
      mediaStart: {
        variant: 'badge',
        tone: post.trashed ? 'full' : post.published ? 'public' : 'inactive',
        icon: post.trashed ? 'delete_outline' : post.published ? 'visibility' : 'drafts',
        label: statusLabel,
        ariaLabel: statusLabel
      },
      mediaEnd: post.trashed || !post.published || !post.featured ? null : {
        variant: 'badge',
        tone: 'selected',
        icon: 'star',
        label: 'featured',
        selected: true,
        selectedLabel: 'featured',
        selectedIcon: 'star',
        ariaLabel: 'featured.article',
        interactive: false
      },
      menuActions,
      menuTitle: null,
      footerChips: [],
      clickable: false,
      eagerDetail: this.ideaArticleDetail(post, 'no.date')
    };
  }

  private mergeAdminPost(post: IdeaPostDto): void {
    if (this.normalizeLang(post.lang) !== this.adminPostsLang) {
      return;
    }
    const merged = this.clonePosts([
      ...this.adminPostsRef().filter(current => current.id !== post.id),
      post
    ]).sort((left, right) => this.compareAdminPosts(left, right));
    this.adminPostsRef.set(merged);
    this.applyPublishedPosts(merged.filter(current => current.published));
  }

  adminPostMatchesFilter(post: IdeaPostDto, filter: IdeaPostAdminFilter): boolean {
    if (filter === 'trashed') {
      return post.trashed;
    }
    if (post.trashed) {
      return false;
    }
    if (filter === 'featured') {
      return post.featured;
    }
    if (filter === 'published') {
      return post.published;
    }
    if (filter === 'drafts') {
      return !post.published;
    }
    return true;
  }

  private shouldResetAdminPage(query: IdeaPostAdminPageQueryDto): boolean {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    return page === 0 && !`${query.cursor ?? ''}`.trim();
  }

  private mergePostLists(existing: readonly IdeaPostDto[], incoming: readonly IdeaPostDto[]): IdeaPostDto[] {
    const byId = new Map<string, IdeaPostDto>();
    for (const post of existing) {
      byId.set(post.id, post);
    }
    for (const post of incoming) {
      byId.set(post.id, post);
    }
    return this.clonePosts(Array.from(byId.values()))
      .sort((left, right) => this.compareAdminPosts(left, right));
  }

  private compareAdminPosts(left: IdeaPostDto, right: IdeaPostDto): number {
    return this.sortValue(right) - this.sortValue(left)
      || right.id.localeCompare(left.id);
  }

  private ideaService(): AdapterInstance<typeof LOCAL_ADAPTER.IDEA_POSTS> | AdapterInstance<typeof HTTP_ADAPTER.IDEA_POSTS> {
    return this.resolveRouteService('/ideas', this.localIdeaPostsService, this.httpIdeaPostsService);
  }

  private publicIdeaService(): AdapterInstance<typeof LOCAL_ADAPTER.IDEA_POSTS> | AdapterInstance<typeof HTTP_ADAPTER.IDEA_POSTS> {
    return this.resolveRouteService(
      IdeaPostsService.PUBLIC_IDEAS_ROUTE,
      this.localIdeaPostsService,
      this.httpIdeaPostsService
    );
  }

  private clonePosts(posts: readonly IdeaPostDto[]): IdeaPostDto[] {
    return posts.map(post => ({ ...post, imageUrls: [...post.imageUrls] }));
  }

  private ideaArticleDetail(post: IdeaPostDto, fallbackDateLabel: string): IdeaArticleDetailDto {
    return {
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      contentHtml: this.articleContentHtml(post),
      imageUrl: this.ideaImageUrl(post),
      dateLabel: this.ideaDateLabel(post, fallbackDateLabel),
      sortAtIso: post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '',
      featured: post.featured === true
    };
  }

  private sortValue(post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
  }

  private ideaImageUrl(post: Pick<IdeaPostDto, 'imageUrl' | 'imageUrls'> | null): string {
    const imageUrl = `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
    if (!imageUrl || this.isGenericArticleImage(imageUrl)) {
      return IdeaPostsService.ARTICLE_FALLBACK_IMAGE_URL;
    }
    return imageUrl;
  }

  private articleContentHtml(post: Pick<IdeaPostDto, 'contentHtml'>): string {
    return `${post.contentHtml ?? ''}`
      .replaceAll('src="assets/logo/heart.webp"', `src="${IdeaPostsService.ARTICLE_FALLBACK_IMAGE_URL}"`)
      .replaceAll('src="/assets/logo/heart.webp"', `src="${IdeaPostsService.ARTICLE_FALLBACK_IMAGE_URL}"`)
      .replaceAll("src='assets/logo/heart.webp'", `src='${IdeaPostsService.ARTICLE_FALLBACK_IMAGE_URL}'`)
      .replaceAll("src='/assets/logo/heart.webp'", `src='${IdeaPostsService.ARTICLE_FALLBACK_IMAGE_URL}'`);
  }

  private isGenericArticleImage(imageUrl: string): boolean {
    const normalized = imageUrl
      .split(/[?#]/, 1)[0]
      .replace(/^\/+/, '')
      .toLowerCase();
    return normalized === 'assets/logo/heart.webp' || normalized === 'assets/logo/heart.png';
  }

  private ideaDateLabel(
    post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'> | null,
    fallback: string
  ): string {
    const parsed = Date.parse(post?.submittedAtIso || post?.updatedAtIso || post?.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return this.i18n.translate(fallback);
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  private adminPostStatusLabel(post: Pick<IdeaPostDto, 'published' | 'trashed'>): string {
    if (post.trashed) {
      return 'trashed';
    }
    if (!post.published) {
      return 'draft';
    }
    return 'published';
  }

}

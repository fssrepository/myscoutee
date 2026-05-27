import { Injectable, inject, signal } from '@angular/core';

import { DemoIdeaPostsService } from '../../demo/services/idea-posts.service';
import { HttpIdeaPostsService } from '../../http/services/idea-posts.service';
import type { IdeaArticleDetail, IdeaPost, IdeaPostSaveRequest } from '../models';
import type { InfoCardData, InfoCardMenuAction } from '../../../ui';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class IdeaPostsService extends BaseRouteModeService {
  private static readonly ARTICLE_FALLBACK_IMAGE_URL = 'assets/idea/article-fallback.svg';

  private readonly demoIdeaPostsService = inject(DemoIdeaPostsService);
  private readonly httpIdeaPostsService = inject(HttpIdeaPostsService);
  private readonly postsRef = signal<IdeaPost[]>([]);
  private readonly adminPostsRef = signal<IdeaPost[]>([]);
  private adminPostsLang = 'en';

  readonly posts = this.postsRef.asReadonly();
  readonly adminPosts = this.adminPostsRef.asReadonly();

  applyPublishedPosts(posts: readonly IdeaPost[]): void {
    this.postsRef.set(this.clonePosts(posts)
      .filter(post => post.published && !post.trashed)
      .sort((left, right) => this.sortValue(right) - this.sortValue(left)));
  }

  async loadPublishedPosts(lang?: string | null): Promise<IdeaPost[]> {
    const posts = await this.ideaService().loadPublishedPosts(lang);
    this.applyPublishedPosts(posts);
    return this.clonePosts(this.postsRef());
  }

  async loadAdminPosts(adminUserId: string, lang = 'en'): Promise<IdeaPost[]> {
    const posts = await this.ideaService().loadAdminPosts(adminUserId, lang);
    const cloned = this.clonePosts(posts).sort((left, right) => this.sortValue(right) - this.sortValue(left));
    this.adminPostsLang = this.normalizeLang(lang);
    this.adminPostsRef.set(cloned);
    this.applyPublishedPosts(cloned.filter(post => post.published));
    return this.clonePosts(cloned);
  }

  async loadAdminPostsSnapshot(adminUserId: string, lang = 'en'): Promise<IdeaPost[]> {
    const posts = await this.ideaService().loadAdminPosts(adminUserId, lang);
    return this.clonePosts(posts).sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  async savePost(request: IdeaPostSaveRequest): Promise<IdeaPost> {
    const post = await this.ideaService().savePost(request);
    this.mergeAdminPost(post);
    return { ...post, imageUrls: [...post.imageUrls] };
  }

  async deletePost(postId: string, actorUserId: string): Promise<IdeaPost[]> {
    const posts = await this.ideaService().deletePost(postId, actorUserId);
    const cloned = this.clonePosts(posts)
      .filter(post => this.normalizeLang(post.lang) === this.adminPostsLang)
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
    this.adminPostsRef.set(cloned);
    this.applyPublishedPosts(cloned.filter(post => post.published));
    return this.clonePosts(cloned);
  }

  async restorePost(postId: string, actorUserId: string): Promise<IdeaPost> {
    const post = await this.ideaService().restorePost(postId, actorUserId);
    this.mergeAdminPost(post);
    return { ...post, imageUrls: [...post.imageUrls] };
  }

  publishedIdeaInfoCards(): InfoCardData<IdeaArticleDetail>[] {
    return this.postsRef().map(post => this.entryIdeaInfoCard(post));
  }

  adminIdeaInfoCards(): InfoCardData<IdeaArticleDetail>[] {
    return this.adminPostsRef().map(post => this.adminIdeaInfoCard(post));
  }

  private entryIdeaInfoCard(post: IdeaPost): InfoCardData<IdeaArticleDetail> {
    return {
      id: `entry-idea:${post.id}`,
      status: post.published ? 'published' : 'draft',
      dateIso: post.submittedAtIso,
      title: post.title,
      imageUrl: this.ideaImageUrl(post) || null,
      placeholderLabel: 'No image',
      metaRows: [this.ideaDateLabel(post, 'Fresh article')],
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
            label: 'Featured',
            selected: true,
            selectedIcon: 'star',
            selectedLabel: 'Featured',
            ariaLabel: 'Featured article',
            interactive: false
          }
        : null,
      footerChips: [
        { label: 'Read more', toneClass: 'entry-idea-read-chip' }
      ],
      clickable: true,
      detailRecord: this.ideaArticleDetail(post, 'Fresh article')
    };
  }

  private adminIdeaInfoCard(post: IdeaPost): InfoCardData<IdeaArticleDetail> {
    const statusLabel = this.adminPostStatusLabel(post);
    const publicationAction: InfoCardMenuAction = post.published ? 'unpublish' : 'publish';
    const featuredAction: InfoCardMenuAction = post.featured ? 'unfeature' : 'feature';
    const menuActions: readonly InfoCardMenuAction[] = post.trashed
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
      status: post.trashed ? 'trashed' : post.published ? 'published' : 'draft',
      dateIso: post.submittedAtIso,
      title: post.title,
      imageUrl: this.ideaImageUrl(post) || null,
      placeholderLabel: 'No image',
      metaRows: [this.ideaDateLabel(post, 'No date')],
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
        label: 'Featured',
        selected: true,
        selectedLabel: 'Featured',
        selectedIcon: 'star',
        ariaLabel: 'Featured article',
        interactive: false
      },
      menuActions,
      menuTitle: null,
      footerChips: [],
      clickable: false,
      detailRecord: this.ideaArticleDetail(post, 'No date')
    };
  }

  private mergeAdminPost(post: IdeaPost): void {
    if (this.normalizeLang(post.lang) !== this.adminPostsLang) {
      return;
    }
    const merged = this.clonePosts([
      ...this.adminPostsRef().filter(current => current.id !== post.id),
      post
    ]).sort((left, right) => this.sortValue(right) - this.sortValue(left));
    this.adminPostsRef.set(merged);
    this.applyPublishedPosts(merged.filter(current => current.published));
  }

  private ideaService(): DemoIdeaPostsService | HttpIdeaPostsService {
    return this.resolveRouteService('/ideas', this.demoIdeaPostsService, this.httpIdeaPostsService);
  }

  private clonePosts(posts: readonly IdeaPost[]): IdeaPost[] {
    return posts.map(post => ({ ...post, imageUrls: [...post.imageUrls] }));
  }

  private ideaArticleDetail(post: IdeaPost, fallbackDateLabel: string): IdeaArticleDetail {
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

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private ideaImageUrl(post: Pick<IdeaPost, 'imageUrl' | 'imageUrls'> | null): string {
    const imageUrl = `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
    if (!imageUrl || this.isGenericArticleImage(imageUrl)) {
      return IdeaPostsService.ARTICLE_FALLBACK_IMAGE_URL;
    }
    return imageUrl;
  }

  private articleContentHtml(post: Pick<IdeaPost, 'contentHtml'>): string {
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
    post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'> | null,
    fallback: string
  ): string {
    const parsed = Date.parse(post?.submittedAtIso || post?.updatedAtIso || post?.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  private adminPostStatusLabel(post: Pick<IdeaPost, 'published' | 'trashed'>): string {
    if (post.trashed) {
      return 'Trashed';
    }
    if (!post.published) {
      return 'Draft';
    }
    return 'Published';
  }

}

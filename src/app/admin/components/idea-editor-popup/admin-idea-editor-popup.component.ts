import {
  CommonModule
} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  Observable,
  from
} from 'rxjs';

import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  IdeaPostsService,
  type IdeaPostAdminCountsDto,
  type IdeaPostAdminFilter,
  type IdeaArticleDetailDto,
  type IdeaPostDto,
  type IdeaPostSaveRequestDto
} from '../../../shared/core';
import {
  CARD_MENU_ACTIONS,
  InfoCardComponent,
  type InfoCardData,
  type CardMenuActionEvent,
  type CardMenuRequestEvent,
  type CardMenuAction
} from '../../../shared/ui/components/core/smart-list/card';
import {
  ImageCarouselComponent
} from '../../../shared/ui/components/core/image-carousel';
import {
  AppMenuDispatcher,
  AppMenuComponent,
  AppMenuOutletComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette
} from '../../../shared/ui/components/core/menu';
import {
  IndicatorComponent
} from '../../../shared/ui/components/core/indicator';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui/components/core/smart-list';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';

type IdeaEditorMode = 'html' | 'preview';
type IdeaPostFilter = IdeaPostAdminFilter;
type IdeaPanelLoadingMode = 'viewer' | 'editor';
type IdeaInfoCard = InfoCardData<IdeaArticleDetailDto>;
type IdeaFilterMenuItemId = 'idea-filter-menu' | `idea-filter:${IdeaPostFilter}`;
type IdeaLanguageMenuScope = 'list' | 'form';
type IdeaLanguageMenuItemId = `${IdeaLanguageMenuScope}-language-menu` | `${IdeaLanguageMenuScope}-language:${string}`;

interface IdeaFilterMenuContext {
  filter: IdeaPostFilter;
}

interface IdeaLanguageMenuContext {
  scope: IdeaLanguageMenuScope;
  language: string;
}

interface IdeaCardMenuContext {
  card: IdeaInfoCard;
  action: CardMenuAction;
}

interface IdeaPostDraft {
  id: string | null;
  contentKey: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  submittedAtLocal: string;
  mode: IdeaEditorMode;
}

interface IdeaSmartListFilters {
  status: IdeaPostFilter;
  revision: number;
}

interface IdeaPostLangCache {
  posts: IdeaPostDto[];
  byId: Map<string, IdeaPostDto>;
  byContentKey: Map<string, IdeaPostDto>;
  indexById: Map<string, number>;
}

@Component({
  selector: 'app-admin-idea-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuOutletComponent,
    SmartListComponent,
    InfoCardComponent,
    ImageCarouselComponent,
    IndicatorComponent
  ],
  templateUrl: './admin-idea-editor-popup.component.html',
  styleUrl: './admin-idea-editor-popup.component.scss',
  providers: [AppMenuDispatcher]
})
export class AdminIdeaEditorPopupComponent {
  private static readonly IMAGE_LIMIT = 8;

  @ViewChild('ideaSmartList')
  private ideaSmartList?: SmartListComponent<IdeaInfoCard, IdeaSmartListFilters>;

  protected readonly admin = inject(AdminMenuStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly ideaPosts = inject(IdeaPostsService);
  private readonly dialogStore = inject(DialogStore);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);

  protected loading = false;
  protected saving = false;
  protected error = '';
  protected editing = false;
  protected draft: IdeaPostDraft | null = null;
  protected viewerPostId = '';
  protected viewerPost: IdeaPostDto | null = null;
  protected articlePanelLoading = false;
  protected articlePanelLoadingMode: IdeaPanelLoadingMode | null = null;
  protected ideaFilter: IdeaPostFilter = 'all';
  protected selectedContentLang = 'en';
  protected draftContentLang = 'en';
  protected ideaListFilters: IdeaSmartListFilters = { status: 'all', revision: 0 };
  protected ideaFilterCounts: Partial<Record<IdeaPostFilter, number>> = {};
  private articlePanelLoadGeneration = 0;
  private listRevision = 0;
  private readonly postsByLang = new Map<string, IdeaPostLangCache>();
  private adminPostList: IdeaPostDto[] = [];
  private adminPostIndex = new Map<string, IdeaPostDto>();
  private adminIdeaCardIndex = new Map<string, IdeaInfoCard>();
  private readonly featuredPendingIds = new Set<string>();

  protected readonly filterOptions: Array<{ id: IdeaPostFilter; label: string; icon: string }> = [
    { id: 'all', label: 'All', icon: 'view_day' },
    { id: 'featured', label: 'Featured', icon: 'star' },
    { id: 'published', label: 'Published', icon: 'visibility' },
    { id: 'drafts', label: 'Drafts', icon: 'drafts' },
    { id: 'trashed', label: 'Trashed', icon: 'delete_outline' }
  ];

  protected readonly ideaSmartListConfig: SmartListConfig<IdeaInfoCard, IdeaSmartListFilters> = {
    pageSize: 10,
    initialPageSize: 10,
    initialPageCount: 1,
    defaultView: 'day',
    defaultDirection: 'desc',
    defaultGroupBy: 'submittedDay',
    emptyLabel: query => this.ideaEmptyLabel(query.filters?.status ?? 'all'),
    emptyDescription: query => this.ideaEmptyDescription(query.filters?.status ?? 'all'),
    emptyStickyLabel: 'Articles',
    showStickyHeader: true,
    showFirstGroupMarker: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: card => this.ideaCardDayGroupLabel(card),
    trackBy: (_index, card) => card.id,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
    },
    pagination: {
      mode: 'scroll'
    },
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true
    }
  };

  protected readonly ideaSmartListLoadPage: SmartListLoadPage<IdeaInfoCard, IdeaSmartListFilters> = (
    query: ListQuery<IdeaSmartListFilters>
  ): Observable<PageResult<IdeaInfoCard>> => from(this.loadIdeaPostsPage(query));

  private async loadIdeaPostsPage(query: ListQuery<IdeaSmartListFilters>): Promise<PageResult<IdeaInfoCard>> {
    const filter = query.filters?.status ?? this.ideaFilter;
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.ideaSmartListConfig.pageSize) || 24));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    this.loading = true;
    this.error = '';
    this.refreshView();
    try {
      const result = await this.ideaPosts.loadAdminPostsPage(this.actorUserId(), this.selectedContentLang, {
        status: filter,
        page,
        pageSize,
        cursor: query.cursor ?? null
      });
      this.applyIdeaFilterCounts(result.counts);
      this.reindexAdminPosts();
      const items = result.records
        .map(post => this.adminIdeaCardForPostId(post.id))
        .filter((card): card is IdeaInfoCard => Boolean(card));
      return {
        items,
        total: result.total,
        nextCursor: result.nextCursor,
        context: { counts: result.counts }
      };
    } catch (error) {
      this.error = 'Unable to load articles.';
      throw error;
    } finally {
      this.loading = false;
      this.refreshView();
    }
  }

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'idea-editor') {
        this.editing = false;
        this.draft = null;
        this.viewerPostId = '';
        this.viewerPost = null;
        this.articlePanelLoading = false;
        this.articlePanelLoadingMode = null;
        this.articlePanelLoadGeneration += 1;
        this.error = '';
        this.ideaFilterCounts = {};
        this.clearAdminIndexes();
        return;
      }
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.admin.activePopup() !== 'idea-editor') {
      return;
    }
    event.preventDefault();
    if (this.hasOpenSharedMenu()) {
      return;
    }
    if (this.viewerPostId) {
      this.closeViewer();
      return;
    }
    if (this.editing) {
      this.closeEditor();
      return;
    }
    this.close();
  }

  protected posts(): IdeaPostDto[] {
    return this.adminPostList;
  }

  protected selectedViewerPost(): IdeaPostDto | null {
    return this.viewerPost
      ?? this.adminPostById(this.viewerPostId)
      ?? null;
  }

  protected async load(): Promise<void> {
    this.refreshIdeaList();
  }

  protected close(): void {
    this.editing = false;
    this.draft = null;
    this.viewerPostId = '';
    this.viewerPost = null;
    this.cancelArticlePanelLoad();
    this.admin.closePopup();
  }

  protected async startNew(event?: Event): Promise<void> {
    event?.stopPropagation();
    const targetLang = this.selectedContentLang;
    this.draftContentLang = targetLang;
    this.editing = false;
    this.draft = null;
    this.viewerPostId = '';
    this.viewerPost = null;
    this.beginEditing({
      id: null,
      contentKey: '',
      title: '',
      excerpt: '',
      contentHtml: this.defaultDraftHtml(targetLang),
      imageUrls: [],
      featured: false,
      published: false,
      submittedAtLocal: this.toDateTimeLocal(new Date().toISOString()),
      mode: 'html'
    });
  }

  protected async openViewer(post: IdeaPostDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    const targetPost = this.clonePost(post);
    this.viewerPostId = '';
    this.viewerPost = null;
    this.viewerPostId = targetPost.id;
    this.viewerPost = targetPost;
  }

  protected closeViewer(event?: Event): void {
    event?.stopPropagation();
    if (this.articlePanelLoadingMode === 'viewer') {
      this.cancelArticlePanelLoad();
    }
    this.viewerPostId = '';
    this.viewerPost = null;
    this.refreshView();
  }

  protected async startEditing(post: IdeaPostDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    const targetPost = this.clonePost(post);
    this.viewerPostId = '';
    this.viewerPost = null;
    this.editing = false;
    this.draft = null;
    this.draftContentLang = this.normalizeContentLang(targetPost.lang);
    this.beginEditing(this.draftFromPost(targetPost));
  }

  protected closeEditor(event?: Event): void {
    event?.stopPropagation();
    if (this.articlePanelLoadingMode === 'editor') {
      this.cancelArticlePanelLoad();
    }
    this.editing = false;
    this.draft = null;
  }

  protected async openDraftPreview(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const activeDraft = this.draft;
    const activeDraftLang = this.draftContentLang;
    const submittedAtIso = this.fromDateTimeLocal(activeDraft.submittedAtLocal);
    const contentHtml = activeDraft.contentHtml.trim() || '<p></p>';
    const imageUrls = this.draftImageUrls(activeDraft);
    this.viewerPostId = activeDraft.id || 'draft-preview';
    this.viewerPost = {
      id: activeDraft.id || 'draft-preview',
      contentKey: activeDraft.contentKey || 'draft-preview',
      lang: activeDraftLang,
      languageLabel: this.contentLanguageLabel(activeDraftLang),
      title: activeDraft.title.trim() || 'Untitled article',
      excerpt: activeDraft.excerpt.trim() || this.excerptFromHtml(contentHtml),
      contentHtml,
      imageUrl: imageUrls[0] || '',
      imageUrls,
      featured: false,
      published: false,
      trashed: false,
      trashedAtIso: '',
      trashedByUserId: '',
      submittedAtIso,
      createdAtIso: submittedAtIso,
      createdByUserId: this.actorUserId(),
      updatedAtIso: submittedAtIso,
      updatedByUserId: this.actorUserId()
    };
  }

  protected async saveDraft(event?: Event): Promise<IdeaPostDto | null> {
    event?.preventDefault();
    event?.stopPropagation();
    const activeDraft = this.draft;
    if (!activeDraft || this.saving) {
      return null;
    }
    const request = this.requestFromDraft(activeDraft);
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost(request);
      this.reindexAdminPosts();
      this.cachePost(saved);
      this.refreshIdeaList();
      this.editing = false;
      this.draft = null;
      return saved;
    } catch {
      this.error = 'Unable to save article.';
      return null;
    } finally {
      this.saving = false;
      this.refreshView();
    }
  }

  protected deletePost(post: IdeaPostDto, event?: Event): void {
    event?.stopPropagation();
    this.dialogStore.open({
      title: 'Move article to trash?',
      message: post.title,
      confirmLabel: 'Move to trash',
      busyConfirmLabel: 'Moving...',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.saving = true;
        this.error = '';
        this.refreshView();
        try {
          await this.ideaPosts.deletePost(post.id, this.actorUserId());
          this.reindexAdminPosts();
          if (this.viewerPostId === post.id) {
            this.viewerPostId = '';
            this.viewerPost = null;
          }
          if (this.draft?.id === post.id) {
            this.editing = false;
            this.draft = null;
          }
          this.refreshIdeaList();
        } catch {
          this.error = 'Unable to move article to trash.';
        } finally {
          this.saving = false;
          this.refreshView();
        }
      }
    });
  }

  protected togglePublishedFromCard(post: IdeaPostDto, event?: Event): void {
    event?.stopPropagation();
    if (post.trashed) {
      return;
    }
    const nextPublished = !post.published;
    this.dialogStore.open({
      title: nextPublished ? 'Publish article?' : 'Unpublish article?',
      message: post.title,
      cancelLabel: 'Cancel',
      confirmLabel: nextPublished ? 'Publish' : 'Unpublish',
      busyConfirmLabel: nextPublished ? 'Publishing...' : 'Unpublishing...',
      confirmTone: nextPublished ? 'accent' : 'danger',
      failureMessage: nextPublished ? 'Unable to publish article.' : 'Unable to unpublish article.',
      onConfirm: () => this.confirmPublishedToggle(post, nextPublished)
    });
  }

  protected async restorePost(post: IdeaPostDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!post.trashed || this.saving) {
      return;
    }
    this.dialogStore.open({
      title: 'Restore article?',
      message: post.title,
      cancelLabel: 'Cancel',
      confirmLabel: 'Restore',
      busyConfirmLabel: 'Restoring...',
      confirmTone: 'accent',
      failureMessage: 'Unable to restore article.',
      onConfirm: () => this.confirmRestorePost(post)
    });
  }

  private async confirmRestorePost(post: IdeaPostDto): Promise<void> {
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const restored = await this.ideaPosts.restorePost(post.id, this.actorUserId());
      this.reindexAdminPosts();
      if (this.viewerPostId === post.id) {
        this.viewerPost = this.clonePost(restored);
      }
      this.refreshIdeaList();
    } catch {
      this.error = 'Unable to restore article.';
      throw new Error(this.error);
    } finally {
      this.saving = false;
      this.refreshView();
    }
  }

  private async confirmPublishedToggle(post: IdeaPostDto, nextPublished: boolean): Promise<void> {
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost({
        actorUserId: this.actorUserId(),
        id: post.id,
        lang: post.lang,
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: post.contentHtml,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        featured: nextPublished ? post.featured : false,
        published: nextPublished,
        submittedAtIso: post.submittedAtIso
      });
      this.reindexAdminPosts();
      if (this.viewerPostId === post.id) {
        this.viewerPost = this.clonePost(saved);
      }
      if (this.draft?.id === post.id) {
        this.draft.published = saved.published;
        this.draft.featured = saved.featured;
      }
      this.refreshIdeaList();
    } catch {
      this.error = nextPublished ? 'Unable to publish article.' : 'Unable to unpublish article.';
      throw new Error(this.error);
    } finally {
      this.saving = false;
      this.refreshView();
    }
  }

  protected toggleFeaturedFromCard(post: IdeaPostDto, event?: Event): void {
    event?.stopPropagation();
    if (post.trashed || !post.published || this.featuredPendingIds.has(post.id)) {
      return;
    }
    const nextFeatured = !post.featured;
    this.dialogStore.open({
      title: nextFeatured ? 'Feature article?' : 'Remove featured article?',
      message: post.title,
      cancelLabel: 'Cancel',
      confirmLabel: nextFeatured ? 'Feature' : 'Unfeature',
      busyConfirmLabel: nextFeatured ? 'Featuring...' : 'Unfeaturing...',
      confirmTone: nextFeatured ? 'accent' : 'danger',
      failureMessage: nextFeatured ? 'Unable to feature article.' : 'Unable to unfeature article.',
      onConfirm: () => this.confirmFeaturedToggle(post, nextFeatured)
    });
  }

  private async confirmFeaturedToggle(post: IdeaPostDto, nextFeatured: boolean): Promise<void> {
    this.featuredPendingIds.add(post.id);
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost({
        actorUserId: this.actorUserId(),
        id: post.id,
        lang: post.lang,
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: post.contentHtml,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        featured: nextFeatured,
        published: post.published,
        submittedAtIso: post.submittedAtIso
      });
      this.reindexAdminPosts();
      this.refreshIdeaList();
      if (this.viewerPostId === post.id) {
        this.viewerPost = this.clonePost(saved);
      }
      if (this.draft?.id === post.id) {
        this.draft.featured = saved.featured;
      }
    } catch {
      this.error = nextFeatured ? 'Unable to feature article.' : 'Unable to unfeature article.';
      throw new Error(this.error);
    } finally {
      this.featuredPendingIds.delete(post.id);
      this.saving = false;
      this.refreshView();
    }
  }

  private clonePost(post: IdeaPostDto): IdeaPostDto {
    return { ...post, imageUrls: [...post.imageUrls] };
  }

  private reindexAdminPosts(): void {
    const posts = this.ideaPosts.adminPosts();
    const postIndex = new Map<string, IdeaPostDto>();
    for (const post of posts) {
      postIndex.set(post.id, post);
    }

    const cards = this.ideaPosts.adminIdeaInfoCards();
    const cardIndex = new Map<string, IdeaInfoCard>();
    for (const card of cards) {
      const postId = this.ideaCardPostId(card);
      if (postId) {
        cardIndex.set(postId, card);
      }
    }

    this.adminPostList = posts;
    this.adminPostIndex = postIndex;
    this.adminIdeaCardIndex = cardIndex;
  }

  private clearAdminIndexes(): void {
    this.adminPostList = [];
    this.adminPostIndex.clear();
    this.adminIdeaCardIndex.clear();
  }

  private cachePosts(lang: string, posts: readonly IdeaPostDto[]): void {
    this.setPostsCache(this.normalizeContentLang(lang), posts);
  }

  private cachePost(post: IdeaPostDto): void {
    const lang = this.normalizeContentLang(post.lang);
    const cache = this.postsByLang.get(lang);
    if (!cache) {
      this.setPostsCache(lang, [post]);
      return;
    }
    const clonedPost = this.clonePost(post);
    const oldContentKeyPost = cache.byContentKey.get(clonedPost.contentKey);
    if (oldContentKeyPost && oldContentKeyPost.id !== clonedPost.id) {
      this.removeCachedPost(cache, oldContentKeyPost.id);
    }
    const oldPost = cache.byId.get(clonedPost.id);
    if (oldPost) {
      cache.byContentKey.delete(oldPost.contentKey);
    }
    const existingIndex = cache.indexById.get(clonedPost.id);
    if (existingIndex === undefined) {
      cache.indexById.set(clonedPost.id, cache.posts.length);
      cache.posts.push(clonedPost);
    } else {
      cache.posts[existingIndex] = clonedPost;
    }
    cache.byId.set(clonedPost.id, clonedPost);
    cache.byContentKey.set(clonedPost.contentKey, clonedPost);
  }

  private async findArticleTranslation(contentKey: string, lang: string): Promise<IdeaPostDto | null> {
    const normalizedLang = this.normalizeContentLang(lang);
    const normalizedContentKey = `${contentKey ?? ''}`.trim();
    if (!normalizedContentKey) {
      return null;
    }
    const cached = this.postsByLang.get(normalizedLang)?.byContentKey.get(normalizedContentKey);
    if (cached) {
      return this.clonePost(cached);
    }
    try {
      const posts = await this.ideaPosts.loadAdminPostsSnapshot(this.actorUserId(), normalizedLang);
      this.cachePosts(normalizedLang, posts);
      const loaded = this.postsByLang.get(normalizedLang)?.byContentKey.get(normalizedContentKey);
      return loaded ? this.clonePost(loaded) : null;
    } catch {
      this.error = 'Unable to load article language version.';
      return null;
    }
  }

  private setPostsCache(lang: string, posts: readonly IdeaPostDto[]): void {
    const clonedPosts = posts.map(post => this.clonePost(post));
    const byId = new Map<string, IdeaPostDto>();
    const byContentKey = new Map<string, IdeaPostDto>();
    for (const post of clonedPosts) {
      byId.set(post.id, post);
      byContentKey.set(post.contentKey, post);
    }
    this.postsByLang.set(lang, {
      posts: clonedPosts,
      byId,
      byContentKey,
      indexById: this.indexPostsById(clonedPosts)
    });
  }

  private indexPostsById(posts: readonly IdeaPostDto[]): Map<string, number> {
    const indexById = new Map<string, number>();
    posts.forEach((post, index) => indexById.set(post.id, index));
    return indexById;
  }

  private removeCachedPost(cache: IdeaPostLangCache, postId: string): void {
    const index = cache.indexById.get(postId);
    const post = cache.byId.get(postId);
    if (index === undefined || !post) {
      return;
    }
    const lastIndex = cache.posts.length - 1;
    const lastPost = cache.posts[lastIndex];
    if (index !== lastIndex && lastPost) {
      cache.posts[index] = lastPost;
      cache.indexById.set(lastPost.id, index);
    }
    cache.posts.pop();
    cache.byId.delete(post.id);
    cache.byContentKey.delete(post.contentKey);
    cache.indexById.delete(post.id);
  }

  protected isFeatureTogglePending(postId: string): boolean {
    return this.featuredPendingIds.has(postId);
  }

  protected onIdeaCardMenuAction(card: IdeaInfoCard, event: CardMenuActionEvent<InfoCardData>): void {
    const post = this.ideaPostFromCard(card);
    if (!post) {
      return;
    }
    switch (event.actionId) {
      case 'viewArticle':
        void this.openViewer(post);
        break;
      case 'edit':
        void this.startEditing(post);
        break;
      case 'publish':
      case 'unpublish':
        this.togglePublishedFromCard(post);
        break;
      case 'feature':
      case 'unfeature':
        this.toggleFeaturedFromCard(post);
        break;
      case 'restore':
        void this.restorePost(post);
        break;
      case 'delete':
        this.deletePost(post);
        break;
    }
  }

  protected openIdeaInfoCardMenu(card: IdeaInfoCard, request: CardMenuRequestEvent<InfoCardData>): void {
    const menuId = `admin-idea-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      kind: 'select',
      title: this.infoCardMenuTitle(request.card),
      items: this.infoCardMenuItems(card, request),
      triggerRect: request.triggerRect,
      openUp: request.openUp,
      panelAlign: 'auto',
      closeOnSelect: true,
      onClose: request.closeTrigger
    }, null);
  }

  protected onIdeaDispatchedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as IdeaCardMenuContext | undefined;
    if (!context) {
      return;
    }
    this.onIdeaCardMenuAction(context.card, {
      id: context.card.id,
      actionId: context.action.id,
      action: context.action,
      card: context.card
    });
  }

  private infoCardMenuTitle(card: InfoCardData): string | null {
    if (card.menuTitle === null) {
      return null;
    }
    return `${card.menuTitle ?? card.title ?? ''}`.trim();
  }

  private infoCardMenuItems(
    card: IdeaInfoCard,
    request: CardMenuRequestEvent<InfoCardData>
  ): readonly AppMenuItem<string, IdeaCardMenuContext>[] {
    return (request.actions ?? []).flatMap(actionId => {
      const config = CARD_MENU_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: CardMenuAction = {
        id: actionId,
        ...config
      };
      return [{
        id: actionId,
        label: config.label,
        icon: config.icon,
        palette: this.infoCardActionPalette(config.tone),
        surface: 'tinted',
        context: {
          card,
          action
        }
      }];
    });
  }

  private infoCardActionPalette(tone: CardMenuAction['tone']): AppMenuPalette {
    switch (tone) {
      case 'accent':
        return 'green';
      case 'review':
        return 'violet';
      case 'warning':
        return 'warning';
      case 'destructive':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected contentLanguages(): Array<{ lang: string; label: string }> {
    return APP_STATIC_DATA.contentLanguages;
  }

  protected selectedContentLanguageLabel(): string {
    return this.contentLanguageLabel(this.selectedContentLang);
  }

  protected draftContentLanguageLabel(): string {
    return this.contentLanguageLabel(this.draftContentLang);
  }

  protected contentLanguageFlag(lang: string): string {
    const flags: Record<string, string> = { en: '🇬🇧', hu: '🇭🇺' };
    return flags[this.normalizeContentLang(lang)] ?? '🌐';
  }

  protected selectListContentLanguage(lang: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const normalized = this.normalizeContentLang(lang);
    if (normalized === this.selectedContentLang || this.loading || this.saving) {
      return;
    }
    this.selectedContentLang = normalized;
    this.editing = false;
    this.draft = null;
    this.viewerPostId = '';
    this.viewerPost = null;
    this.cancelArticlePanelLoad();
    this.ideaFilterCounts = {};
    this.clearAdminIndexes();
    this.refreshIdeaList();
  }

  protected async selectDraftContentLanguage(lang: string, event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    const normalized = this.normalizeContentLang(lang);
    if (!this.draft || normalized === this.draftContentLang || this.saving) {
      return;
    }
    const currentDraft = this.draft;
    const generation = this.beginArticlePanelLoad('editor');
    const translation = await this.findArticleTranslation(currentDraft.contentKey, normalized);
    if (!this.isCurrentArticlePanelLoad(generation, 'editor')) {
      return;
    }
    this.draftContentLang = normalized;
    this.beginEditing(translation ? this.draftFromPost(translation) : this.emptyTranslationDraftFrom(currentDraft));
    this.finishArticlePanelLoad(generation, 'editor');
  }

  protected setIdeaFilter(filter: IdeaPostFilter, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.ideaFilter === filter) {
      return;
    }
    this.ideaFilter = filter;
    this.refreshIdeaList();
  }

  protected articlePanelLoadingLabel(): string {
    return this.articlePanelLoadingMode === 'viewer'
      ? 'Loading article'
      : 'Loading article editor';
  }

  protected filterLabel(): string {
    return this.filterOptions.find(option => option.id === this.ideaFilter)?.label ?? 'All';
  }

  protected filterIcon(): string {
    return this.filterOptions.find(option => option.id === this.ideaFilter)?.icon ?? 'view_day';
  }

  protected filterCount(filter: IdeaPostFilter = this.ideaFilter): number {
    return this.countValue(this.ideaFilterCounts[filter]);
  }

  protected ideaFilterMenuModel(): AppMenuModel<IdeaFilterMenuItemId, IdeaFilterMenuContext> {
    return {
      nodes: [
        {
          id: 'idea-filter-root',
          items: [
            {
              id: 'idea-filter-menu',
              kind: 'select-trigger',
              label: this.filterLabel(),
              icon: this.filterIcon(),
              counter: this.filterCount(),
              ariaLabel: 'Filter articles',
              items: this.filterOptions.map(option => ({
                id: `idea-filter:${option.id}`,
                kind: 'radio',
                label: option.label,
                icon: option.icon,
                checked: this.ideaFilter === option.id,
                counter: this.filterCount(option.id),
                context: { filter: option.id }
              }))
            }
          ]
        }
      ]
    };
  }

  protected onIdeaFilterMenuSelect(event: AppMenuItemSelectEvent<IdeaFilterMenuItemId, IdeaFilterMenuContext>): void {
    const filter = event.context?.filter;
    if (!filter) {
      return;
    }
    this.setIdeaFilter(filter, event.sourceEvent);
  }

  protected listLanguageMenuModel(): AppMenuModel<IdeaLanguageMenuItemId, IdeaLanguageMenuContext> {
    return this.contentLanguageMenuModel('list', this.selectedContentLang, this.loading || this.saving);
  }

  protected formLanguageMenuModel(): AppMenuModel<IdeaLanguageMenuItemId, IdeaLanguageMenuContext> {
    return this.contentLanguageMenuModel('form', this.draftContentLang, this.saving);
  }

  protected onContentLanguageMenuSelect(event: AppMenuItemSelectEvent<IdeaLanguageMenuItemId, IdeaLanguageMenuContext>): void {
    const context = event.context;
    if (!context) {
      return;
    }
    if (context.scope === 'form') {
      void this.selectDraftContentLanguage(context.language, event.sourceEvent);
      return;
    }
    this.selectListContentLanguage(context.language, event.sourceEvent);
  }

  protected filterDescription(): string {
    const total = this.posts().length;
    const visible = this.filterCount();
    return this.ideaFilter === 'all' ? `${total} article${total === 1 ? '' : 's'}` : `${visible} of ${total}`;
  }

  protected formatPastedHtml(event: ClipboardEvent): void {
    if (!this.draft) {
      return;
    }
    const pasted = this.htmlFromClipboardPayload(
      event.clipboardData?.getData('text/html') ?? '',
      event.clipboardData?.getData('text/plain') ?? ''
    );
    if (!pasted.trim()) {
      return;
    }
    event.preventDefault();
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
    const current = this.draft.contentHtml ?? '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? start;
    this.draft.contentHtml = this.formatHtmlFragment(`${current.slice(0, start)}${pasted}${current.slice(end)}`);
  }

  protected articlePreviewHtml(post: Pick<IdeaPostDto, 'contentHtml'> | null): string {
    return this.expandPlainImageLinksInHtml(post?.contentHtml ?? '');
  }

  protected postStatusLabel(post: Pick<IdeaPostDto, 'published' | 'featured' | 'trashed'>): string {
    if (post.trashed) {
      return 'Trashed';
    }
    if (!post.published) {
      return 'Draft';
    }
    return 'Published';
  }

  protected postDateLabel(post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'> | null): string {
    const parsed = Date.parse(post?.submittedAtIso || post?.updatedAtIso || post?.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return 'No date';
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  protected ideaImageUrl(post: Pick<IdeaPostDto, 'imageUrl' | 'imageUrls'> | null): string {
    return `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected actorUserId(): string {
    return this.userProfileStore.activeUserId().trim();
  }

  private beginArticlePanelLoad(mode: IdeaPanelLoadingMode): number {
    const generation = ++this.articlePanelLoadGeneration;
    this.articlePanelLoadingMode = mode;
    this.articlePanelLoading = true;
    this.error = '';
    this.refreshView();
    return generation;
  }

  private finishArticlePanelLoad(generation: number, mode: IdeaPanelLoadingMode): void {
    if (!this.isCurrentArticlePanelLoad(generation, mode)) {
      return;
    }
    this.articlePanelLoading = false;
    this.articlePanelLoadingMode = null;
    this.refreshView();
  }

  private cancelArticlePanelLoad(): void {
    this.articlePanelLoadGeneration += 1;
    this.articlePanelLoading = false;
    this.articlePanelLoadingMode = null;
  }

  private isCurrentArticlePanelLoad(generation: number, mode: IdeaPanelLoadingMode): boolean {
    return this.admin.activePopup() === 'idea-editor'
      && this.articlePanelLoadGeneration === generation
      && this.articlePanelLoading
      && this.articlePanelLoadingMode === mode;
  }

  private contentLanguageMenuModel(
    scope: IdeaLanguageMenuScope,
    currentLanguage: string,
    disabled: boolean
  ): AppMenuModel<IdeaLanguageMenuItemId, IdeaLanguageMenuContext> {
    const normalizedCurrentLanguage = this.normalizeContentLang(currentLanguage);
    const rootId: IdeaLanguageMenuItemId = `${scope}-language-menu`;
    return {
      nodes: [
        {
          id: `${scope}-language-root`,
          items: [
            {
              id: rootId,
              kind: 'select-trigger',
              label: this.contentLanguageMenuLabel(normalizedCurrentLanguage),
              disabled,
              ariaLabel: 'Content language',
              items: this.contentLanguages().map(language => {
                const normalizedLanguage = this.normalizeContentLang(language.lang);
                return {
                  id: `${scope}-language:${normalizedLanguage}` as IdeaLanguageMenuItemId,
                  kind: 'radio',
                  label: this.contentLanguageMenuLabel(normalizedLanguage),
                  checked: normalizedCurrentLanguage === normalizedLanguage,
                  context: { scope, language: normalizedLanguage }
                };
              })
            }
          ]
        }
      ]
    };
  }

  private contentLanguageMenuLabel(lang: string): string {
    return `${this.contentLanguageFlag(lang)} ${this.contentLanguageLabel(lang)}`;
  }

  private hasOpenSharedMenu(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    return !!document.querySelector('.popup-panel-idea-editor .app-menu-host--open');
  }

  private beginEditing(draft: IdeaPostDraft): void {
    this.draft = draft;
    this.editing = true;
  }

  private draftFromPost(post: IdeaPostDto): IdeaPostDraft {
    return {
      id: post.id,
      contentKey: post.contentKey || this.contentKeyFromId(post.id),
      title: post.title,
      excerpt: post.excerpt,
      contentHtml: this.formatHtmlFragment(post.contentHtml),
      imageUrls: this.uniqueImageUrls([post.imageUrl, ...post.imageUrls]).slice(
        0,
        AdminIdeaEditorPopupComponent.IMAGE_LIMIT
      ),
      featured: false,
      published: false,
      submittedAtLocal: this.toDateTimeLocal(post.submittedAtIso || post.updatedAtIso || post.createdAtIso),
      mode: 'html'
    };
  }

  private emptyTranslationDraftFrom(source: IdeaPostDraft): IdeaPostDraft {
    return {
      id: null,
      contentKey: source.contentKey || this.contentKeyFromId(source.id ?? ''),
      title: '',
      excerpt: '',
      contentHtml: this.defaultDraftHtml(this.draftContentLang),
      imageUrls: [...source.imageUrls],
      featured: false,
      published: false,
      submittedAtLocal: source.submittedAtLocal,
      mode: 'html'
    };
  }

  private defaultDraftHtml(lang: string): string {
    return this.normalizeContentLang(lang) === 'hu'
      ? '<p>Írd le, miért fontos ez a MyScoutee cikk.</p>'
      : '<p>Describe why this MyScoutee article matters.</p>';
  }

  private requestFromDraft(draft: IdeaPostDraft): IdeaPostSaveRequestDto {
    const imageUrls = this.draftImageUrls(draft);
    return {
      actorUserId: this.actorUserId(),
      id: draft.id,
      contentKey: draft.contentKey,
      lang: this.draftContentLang,
      title: draft.title,
      excerpt: draft.excerpt,
      contentHtml: draft.contentHtml,
      imageUrl: imageUrls[0] ?? '',
      imageUrls,
      featured: false,
      published: false,
      submittedAtIso: this.fromDateTimeLocal(draft.submittedAtLocal)
    };
  }

  private draftImageUrls(draft: Pick<IdeaPostDraft, 'imageUrls'>): string[] {
    return this.uniqueImageUrls(draft.imageUrls).slice(0, AdminIdeaEditorPopupComponent.IMAGE_LIMIT);
  }

  private normalizeContentLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private contentLanguageLabel(lang: string): string {
    const normalized = this.normalizeContentLang(lang);
    return APP_STATIC_DATA.contentLanguages.find(language => language.lang === normalized)?.label ?? 'English';
  }

  private contentKeyFromId(id: string): string {
    const normalized = `${id ?? ''}`.trim();
    return normalized.endsWith('-hu') ? normalized.slice(0, -3) : normalized;
  }

  private refreshIdeaList(): void {
    this.listRevision += 1;
    this.ideaListFilters = {
      status: this.ideaFilter,
      revision: this.listRevision
    };
    this.ideaSmartList?.reload();
    this.refreshView();
  }

  private applyIdeaFilterCounts(counts: IdeaPostAdminCountsDto): void {
    this.ideaFilterCounts = {
      all: this.countValue(counts.all),
      featured: this.countValue(counts.featured),
      published: this.countValue(counts.published),
      drafts: this.countValue(counts.drafts),
      trashed: this.countValue(counts.trashed)
    };
  }

  private countValue(value: number | null | undefined): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private adminIdeaCardForPostId(postId: string): IdeaInfoCard | null {
    return this.adminIdeaCardIndex.get(postId) ?? null;
  }

  private ideaPostFromCard(card: IdeaInfoCard): IdeaPostDto | null {
    return this.adminPostById(this.ideaCardPostId(card));
  }

  private adminPostById(postId: string): IdeaPostDto | null {
    const normalizedPostId = `${postId ?? ''}`.trim();
    if (!normalizedPostId) {
      return null;
    }
    return this.adminPostIndex.get(normalizedPostId) ?? null;
  }

  protected ideaCardPostId(card: IdeaInfoCard | null | undefined): string {
    return `${card?.eagerDetail?.id ?? ''}`.trim();
  }

  private ideaCardDayGroupLabel(card: IdeaInfoCard): string {
    const parsed = Date.parse(card.eagerDetail?.sortAtIso ?? '');
    if (!Number.isFinite(parsed)) {
      return 'No date';
    }
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  private ideaEmptyLabel(filter: IdeaPostFilter): string {
    if (filter === 'featured') {
      return 'No featured articles';
    }
    if (filter === 'published') {
      return 'No published articles';
    }
    if (filter === 'drafts') {
      return 'No draft articles';
    }
    if (filter === 'trashed') {
      return 'No trashed articles';
    }
    return 'No articles';
  }

  private ideaEmptyDescription(filter: IdeaPostFilter): string {
    if (filter === 'featured') {
      return 'Feature an article card with the star action.';
    }
    if (filter === 'published') {
      return 'Publish an article from the card menu.';
    }
    if (filter === 'drafts') {
      return 'Save an edited article to keep it as a draft until it is republished.';
    }
    if (filter === 'trashed') {
      return 'Deleted articles appear here until they are restored.';
    }
    return 'Create the first landing article card.';
  }

  private htmlFromClipboardPayload(html: string, text: string): string {
    const normalizedHtml = `${html ?? ''}`.trim();
    if (normalizedHtml) {
      return normalizedHtml;
    }
    const normalizedText = `${text ?? ''}`.trim();
    if (this.isEmbeddableImageUrl(normalizedText)) {
      return `<img src="${this.escapeHtmlAttribute(normalizedText)}" alt="">`;
    }
    return text;
  }

  private expandPlainImageLinksInHtml(value: string): string {
    const html = `${value ?? ''}`.trim();
    if (!html || typeof document === 'undefined') {
      return html;
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      if (current instanceof Text && !this.isImageLinkExcludedTextNode(current)) {
        textNodes.push(current);
      }
      current = walker.nextNode();
    }
    textNodes.forEach(node => this.replaceImageLinksInTextNode(node));
    return template.innerHTML;
  }

  private isImageLinkExcludedTextNode(node: Text): boolean {
    return Boolean(node.parentElement?.closest('a, code, pre, script, style, textarea'));
  }

  private replaceImageLinksInTextNode(node: Text): void {
    const text = node.textContent ?? '';
    const imageLinkPattern = /(data:image\/[^\s<>"']+|blob:https?:\/\/[^\s<>"']+|\/media\/public\?[^\s<>"']+|https?:\/\/[^\s<>"']+\/media\/public\?[^\s<>"']+|https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<>"']*)?)/gi;
    if (!imageLinkPattern.test(text)) {
      return;
    }
    imageLinkPattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(imageLinkPattern)) {
      const matchIndex = match.index ?? 0;
      const rawImageUrl = match[0] ?? '';
      if (matchIndex > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, matchIndex)));
      }
      const { imageUrl, trailing } = this.stripTrailingImageUrlPunctuation(rawImageUrl);
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = '';
      fragment.append(img);
      if (trailing) {
        fragment.append(document.createTextNode(trailing));
      }
      cursor = matchIndex + rawImageUrl.length;
    }
    if (cursor < text.length) {
      fragment.append(document.createTextNode(text.slice(cursor)));
    }
    node.parentNode?.replaceChild(fragment, node);
  }

  private stripTrailingImageUrlPunctuation(value: string): { imageUrl: string; trailing: string } {
    if (/^data:image\//i.test(value)) {
      return { imageUrl: value, trailing: '' };
    }
    let imageUrl = value;
    let trailing = '';
    while (/[),.;:!?]$/.test(imageUrl)) {
      trailing = `${imageUrl.slice(-1)}${trailing}`;
      imageUrl = imageUrl.slice(0, -1);
    }
    return { imageUrl, trailing };
  }

  private isEmbeddableImageUrl(value: string): boolean {
    const normalized = `${value ?? ''}`.trim();
    return /^data:image\//i.test(normalized)
      || /^blob:https?:\/\//i.test(normalized)
      || /^\/(?:api\/)?media\/public\?[^\s<>"']+$/i.test(normalized)
      || /^https?:\/\/[^\s<>"']+\/(?:api\/)?media\/public\?[^\s<>"']+$/i.test(normalized)
      || /^https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<>"']*)?$/i.test(normalized);
  }

  private htmlToText(value: string): string {
    if (typeof document === 'undefined') {
      return `${value ?? ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const template = document.createElement('template');
    template.innerHTML = value;
    return `${template.content.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  private excerptFromHtml(value: string): string {
    const text = this.htmlToText(value);
    return text.length <= 180 ? text : `${text.slice(0, 179).trim()}...`;
  }

  private uniqueImageUrls(urls: readonly string[]): string[] {
    return Array.from(new Set(urls.map(url => `${url ?? ''}`.trim()).filter(Boolean)));
  }

  private toDateTimeLocal(value: string): string {
    const parsed = Date.parse(value);
    const date = Number.isFinite(parsed) ? new Date(parsed) : new Date();
    const pad = (next: number) => `${next}`.padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private fromDateTimeLocal(value: string): string {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }

  private refreshView(): void {
    queueMicrotask(() => {
      try {
        this.changeDetectorRef.detectChanges();
      } catch {
        // The popup may have been closed before the async demo request completed.
      }
    });
  }

  private formatHtmlFragment(value: string): string {
    const html = `${value ?? ''}`.trim();
    if (!html || typeof document === 'undefined') {
      return html;
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(template.content.childNodes)
      .map(node => this.formatHtmlNode(node, 0))
      .flat()
      .filter(line => line.trim())
      .join('\n')
      .trim();
  }

  private formatHtmlNode(node: ChildNode, depth: number): string[] {
    const indent = '  '.repeat(depth);
    if (node.nodeType === 3) {
      const text = `${node.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
      return text ? [`${indent}${this.escapeHtml(text)}`] : [];
    }
    if (!(node instanceof HTMLElement)) {
      return [];
    }
    const tag = node.tagName.toLowerCase();
    const attributes = Array.from(node.attributes)
      .map(attribute => ` ${attribute.name}="${this.escapeHtmlAttribute(attribute.value)}"`)
      .join('');
    const children = Array.from(node.childNodes).filter(child => child.nodeType !== 3 || `${child.textContent ?? ''}`.trim());
    if (['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tag)) {
      return [`${indent}<${tag}${attributes}>`];
    }
    if (children.length === 0) {
      return [`${indent}<${tag}${attributes}></${tag}>`];
    }
    if (children.length === 1 && children[0].nodeType === 3) {
      const text = `${children[0].textContent ?? ''}`.replace(/\s+/g, ' ').trim();
      return [`${indent}<${tag}${attributes}>${this.escapeHtml(text)}</${tag}>`];
    }
    return [
      `${indent}<${tag}${attributes}>`,
      ...children.flatMap(child => this.formatHtmlNode(child, depth + 1)),
      `${indent}</${tag}>`
    ];
  }

  private escapeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }
}

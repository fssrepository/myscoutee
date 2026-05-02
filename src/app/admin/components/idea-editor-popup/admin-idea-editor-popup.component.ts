import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, ViewChild, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Observable, from } from 'rxjs';

import { IdeaPostsService, type IdeaPost, type IdeaPostSaveRequest } from '../../../shared/core';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import {
  InfoCardComponent,
  type InfoCardData,
  type InfoCardMenuActionEvent
} from '../../../shared/ui/components/card';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemRenderState,
  type SmartListLoadPage
} from '../../../shared/ui/components/smart-list';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { AdminService } from '../../admin.service';

type IdeaEditorMode = 'html' | 'preview';
type IdeaPostFilter = 'all' | 'featured' | 'drafts';

interface IdeaPostDraft {
  id: string | null;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
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

@Component({
  selector: 'app-admin-idea-editor-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SmartListComponent, InfoCardComponent],
  templateUrl: './admin-idea-editor-popup.component.html',
  styleUrl: './admin-idea-editor-popup.component.scss'
})
export class AdminIdeaEditorPopupComponent {
  @ViewChild('ideaSmartList')
  private ideaSmartList?: SmartListComponent<IdeaPost, IdeaSmartListFilters>;

  protected readonly admin = inject(AdminService);
  private readonly ideaPosts = inject(IdeaPostsService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  protected loading = false;
  protected saving = false;
  protected publishing = false;
  protected uploading = false;
  protected error = '';
  protected copiedImageUrl = '';
  protected editing = false;
  protected draft: IdeaPostDraft | null = null;
  protected viewerPostId = '';
  protected filterMenuOpen = false;
  protected ideaFilter: IdeaPostFilter = 'all';
  protected ideaListFilters: IdeaSmartListFilters = { status: 'all', revision: 0 };
  protected readonly actionRingPerimeter = 100;
  private readonly featuredRingDurationMs = 1500;
  private readonly featuredUpdateWindowMs = 3000;
  private stateLoadedForPopup = false;
  private adminPostsLoadPromise: Promise<void> | null = null;
  private adminPostsLoadGeneration = 0;
  private listRevision = 0;
  private readonly featuredPendingIds = new Set<string>();
  private readonly featuredRingIds = new Set<string>();

  protected readonly filterOptions: Array<{ id: IdeaPostFilter; label: string; icon: string }> = [
    { id: 'all', label: 'All', icon: 'view_day' },
    { id: 'featured', label: 'Featured', icon: 'star' },
    { id: 'drafts', label: 'Drafts', icon: 'drafts' }
  ];

  protected readonly ideaSmartListConfig: SmartListConfig<IdeaPost, IdeaSmartListFilters> = {
    pageSize: 10,
    initialPageSize: 10,
    initialPageCount: 1,
    loadingDelayMs: resolveCurrentRouteDelayMs('/admin/ideas', 1500),
    loadingWindowMs: 3000,
    defaultView: 'day',
    defaultDirection: 'desc',
    defaultGroupBy: 'submittedDay',
    emptyLabel: query => this.ideaEmptyLabel(query.filters?.status ?? 'all'),
    emptyDescription: query => this.ideaEmptyDescription(query.filters?.status ?? 'all'),
    emptyStickyLabel: 'Articles',
    showStickyHeader: true,
    showFirstGroupMarker: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: post => this.ideaDayGroupLabel(post),
    trackBy: (_index, post) => post.id,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    headerProgress: {
      enabled: true
    },
    pagination: {
      mode: 'scroll'
    },
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true
    }
  };

  protected readonly ideaSmartListLoadPage: SmartListLoadPage<IdeaPost, IdeaSmartListFilters> = (
    query: ListQuery<IdeaSmartListFilters>
  ): Observable<PageResult<IdeaPost>> => from(this.loadIdeaPostsPage(query));

  private async loadIdeaPostsPage(query: ListQuery<IdeaSmartListFilters>): Promise<PageResult<IdeaPost>> {
    await this.ensureAdminPostsLoaded();
    const filter = query.filters?.status ?? this.ideaFilter;
    const allPosts = this.sortedPosts(this.posts());
    const filtered = this.filterPosts(allPosts, filter);
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.ideaSmartListConfig.pageSize) || 24));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return {
      items,
      total: filtered.length,
      nextCursor: start + items.length < filtered.length ? `${start + items.length}` : null
    };
  }

  private async ensureAdminPostsLoaded(): Promise<void> {
    if (this.stateLoadedForPopup) {
      return;
    }
    if (!this.adminPostsLoadPromise) {
      const loadGeneration = this.adminPostsLoadGeneration;
      this.adminPostsLoadPromise = (async () => {
        this.loading = true;
        this.error = '';
        this.refreshView();
        try {
          await this.ideaPosts.loadAdminPosts(this.actorUserId());
          if (this.admin.activePopup() === 'idea-editor' && this.adminPostsLoadGeneration === loadGeneration) {
            this.stateLoadedForPopup = true;
          }
        } catch (error) {
          this.error = 'Unable to load articles.';
          throw error;
        } finally {
          this.loading = false;
          this.refreshView();
        }
      })().finally(() => {
        this.adminPostsLoadPromise = null;
      });
    }
    await this.adminPostsLoadPromise;
  }

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'idea-editor') {
        this.stateLoadedForPopup = false;
        this.adminPostsLoadPromise = null;
        this.adminPostsLoadGeneration += 1;
        this.editing = false;
        this.draft = null;
        this.viewerPostId = '';
        this.filterMenuOpen = false;
        this.error = '';
        this.copiedImageUrl = '';
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
    if (this.filterMenuOpen) {
      this.filterMenuOpen = false;
      return;
    }
    if (this.viewerPostId) {
      this.closeViewer();
      return;
    }
    if (this.editing) {
      void this.closeEditorAndSaveDraft();
      return;
    }
    this.close();
  }

  protected posts(): IdeaPost[] {
    return this.ideaPosts.adminPosts();
  }

  protected selectedViewerPost(): IdeaPost | null {
    return this.posts().find(post => post.id === this.viewerPostId) ?? null;
  }

  protected async load(): Promise<void> {
    try {
      await this.ensureAdminPostsLoaded();
      this.refreshIdeaList();
    } catch {
      this.error = 'Unable to load articles.';
    }
  }

  protected close(): void {
    this.editing = false;
    this.draft = null;
    this.viewerPostId = '';
    this.admin.closePopup();
  }

  protected startNew(event?: Event): void {
    event?.stopPropagation();
    this.beginEditing({
      id: null,
      title: '',
      excerpt: '',
      contentHtml: '<p>Describe why this MyScoutee article matters.</p>',
      imageUrl: '',
      imageUrls: [],
      featured: false,
      published: false,
      submittedAtLocal: this.toDateTimeLocal(new Date().toISOString()),
      mode: 'html'
    });
  }

  protected openViewer(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.viewerPostId = post.id;
  }

  protected closeViewer(event?: Event): void {
    event?.stopPropagation();
    this.viewerPostId = '';
  }

  protected startEditing(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.viewerPostId = '';
    this.beginEditing({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      contentHtml: this.formatHtmlFragment(post.contentHtml),
      imageUrl: post.imageUrl,
      imageUrls: [...post.imageUrls],
      featured: post.featured,
      published: post.published,
      submittedAtLocal: this.toDateTimeLocal(post.submittedAtIso || post.updatedAtIso || post.createdAtIso),
      mode: 'html'
    });
  }

  protected async closeEditorAndSaveDraft(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.draft) {
      this.editing = false;
      return;
    }
    if (!this.hasMeaningfulDraft(this.draft)) {
      this.editing = false;
      this.draft = null;
      return;
    }
    await this.saveDraft(event, { closeAfterSave: true });
  }

  protected toggleDraftMode(event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    this.draft.mode = this.draft.mode === 'html' ? 'preview' : 'html';
  }

  protected async saveDraft(
    event?: Event,
    options: { closeAfterSave?: boolean; publishState?: boolean | null } = {}
  ): Promise<IdeaPost | null> {
    event?.preventDefault();
    event?.stopPropagation();
    const activeDraft = this.draft;
    if (!activeDraft || this.saving || this.uploading) {
      return null;
    }
    const previousPublished = activeDraft.published;
    if (options.publishState !== undefined && options.publishState !== null) {
      activeDraft.published = options.publishState;
    }
    const request = this.requestFromDraft(activeDraft);
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost(request);
      this.refreshIdeaList();
      if (options.closeAfterSave !== false) {
        this.editing = false;
        this.draft = null;
      } else {
        activeDraft.id = saved.id;
        activeDraft.published = saved.published;
        activeDraft.featured = saved.featured;
        activeDraft.imageUrl = saved.imageUrl;
        activeDraft.imageUrls = [...saved.imageUrls];
      }
      return saved;
    } catch {
      activeDraft.published = previousPublished;
      this.error = 'Unable to save article.';
      return null;
    } finally {
      this.saving = false;
      if (options.publishState === undefined || options.publishState === null) {
        this.publishing = false;
      }
      this.refreshView();
    }
  }

  protected async toggleDraftPublished(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.draft || this.saving || this.uploading) {
      return;
    }
    this.publishing = true;
    try {
      await Promise.all([
        this.saveDraft(event, { closeAfterSave: false, publishState: !this.draft.published }),
        this.delay(650)
      ]);
    } finally {
      this.publishing = false;
      this.refreshView();
    }
  }

  protected deletePost(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.confirmationDialog.open({
      title: 'Delete article?',
      message: post.title,
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.saving = true;
        this.error = '';
        this.refreshView();
        try {
          await this.ideaPosts.deletePost(post.id, this.actorUserId());
          if (this.viewerPostId === post.id) {
            this.viewerPostId = '';
          }
          if (this.draft?.id === post.id) {
            this.editing = false;
            this.draft = null;
          }
          this.refreshIdeaList();
        } catch {
          this.error = 'Unable to delete article.';
        } finally {
          this.saving = false;
          this.refreshView();
        }
      }
    });
  }

  protected async toggleFeaturedFromCard(post: IdeaPost, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.featuredPendingIds.has(post.id)) {
      return;
    }
    const nextFeatured = !post.featured;
    const previousPost = { ...post, imageUrls: [...post.imageUrls] };
    const removeFromFeaturedFilter = this.ideaFilter === 'featured' && post.featured && !nextFeatured;
    this.featuredPendingIds.add(post.id);
    this.featuredRingIds.add(post.id);
    this.refreshView();
    const ringTimer = this.delay(this.featuredRingDurationMs).finally(() => {
      this.featuredRingIds.delete(post.id);
      this.refreshView();
    });
    try {
      const [saved] = await Promise.all([
        this.withTimeout(
          this.ideaPosts.savePost({
            actorUserId: this.actorUserId(),
            id: post.id,
            title: post.title,
            excerpt: post.excerpt,
            contentHtml: post.contentHtml,
            imageUrl: post.imageUrl,
            imageUrls: post.imageUrls,
            featured: nextFeatured,
            published: post.published,
            submittedAtIso: post.submittedAtIso
          }),
          this.featuredUpdateWindowMs
        ),
        ringTimer
      ]);
      if (removeFromFeaturedFilter) {
        this.removeVisibleIdeaPost(saved.id);
      } else {
        this.replaceVisibleIdeaPost(saved);
      }
    } catch {
      this.replaceVisibleIdeaPost(previousPost);
      this.error = 'Unable to update featured state.';
    } finally {
      this.featuredPendingIds.delete(post.id);
      await ringTimer;
      this.refreshView();
    }
  }

  private replaceVisibleIdeaPost(post: IdeaPost): void {
    const smartList = this.ideaSmartList;
    if (!smartList) {
      return;
    }
    const currentItems = smartList.itemsSnapshot();
    if (!currentItems.some(item => item.id === post.id)) {
      return;
    }
    smartList.replaceVisibleItems(
      currentItems.map(item => item.id === post.id ? { ...post, imageUrls: [...post.imageUrls] } : item),
      { total: this.filterCount(this.ideaFilter) }
    );
  }

  private removeVisibleIdeaPost(postId: string): void {
    const smartList = this.ideaSmartList;
    if (!smartList) {
      return;
    }
    const nextItems = smartList.itemsSnapshot().filter(item => item.id !== postId);
    smartList.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, this.filterCount(this.ideaFilter))
    });
  }

  protected isFeatureTogglePending(postId: string): boolean {
    return this.featuredPendingIds.has(postId);
  }

  protected isFeatureRingActive(postId: string): boolean {
    return this.featuredRingIds.has(postId);
  }

  protected onIdeaCardMenuAction(post: IdeaPost, event: InfoCardMenuActionEvent): void {
    switch (event.actionId) {
      case 'view':
        this.openViewer(post);
        break;
      case 'edit':
        this.startEditing(post);
        break;
      case 'delete':
        this.deletePost(post);
        break;
    }
  }

  protected ideaInfoCard(
    post: IdeaPost,
    options: { groupLabel?: string | null; renderState?: SmartListItemRenderState | null } = {}
  ): InfoCardData {
    const statusLabel = this.postStatusLabel(post);
    return {
      rowId: `idea:${post.id}`,
      groupLabel: options.groupLabel ?? null,
      title: post.title,
      imageUrl: this.ideaImageUrl(post) || null,
      placeholderLabel: 'No image',
      metaRows: [this.postDateLabel(post), statusLabel],
      metaRowsLimit: 2,
      description: post.excerpt,
      descriptionLines: 3,
      surfaceTone: !post.published ? 'draft' : post.featured ? 'series' : 'default',
      leadingIcon: {
        icon: post.published ? 'article' : 'drafts',
        tone: post.published ? 'public' : 'pending'
      },
      mediaEnd: {
        variant: 'badge',
        tone: post.featured ? 'selected' : 'inactive',
        icon: post.featured ? 'star' : 'star_border',
        label: post.featured ? 'Featured' : 'Feature',
        selected: post.featured,
        selectedLabel: post.featured ? 'Featured' : 'Feature',
        selectedIcon: 'star',
        ariaLabel: post.featured ? 'Remove from featured articles' : 'Feature this article',
        interactive: true,
        disabled: this.isFeatureTogglePending(post.id),
        progressRing: this.isFeatureRingActive(post.id)
      },
      menuActions: [
        { id: 'view', label: 'View', icon: 'visibility' },
        { id: 'edit', label: 'Edit', icon: 'edit', tone: 'accent' },
        { id: 'delete', label: 'Delete', icon: 'delete', tone: 'destructive' }
      ],
      menuTitle: null,
      footerChips: [
        ...(!post.published ? [{ label: 'Draft', toneClass: 'idea-chip-draft' }] : [])
      ],
      clickable: false,
      state: options.renderState === 'active' ? 'active' : options.renderState === 'leaving' ? 'leaving' : 'default'
    };
  }

  protected setIdeaFilter(filter: IdeaPostFilter, event?: Event): void {
    event?.stopPropagation();
    if (this.ideaFilter === filter) {
      this.filterMenuOpen = false;
      return;
    }
    this.ideaFilter = filter;
    this.filterMenuOpen = false;
    this.refreshIdeaList();
  }

  protected toggleFilterMenu(event?: Event): void {
    event?.stopPropagation();
    this.filterMenuOpen = !this.filterMenuOpen;
  }

  protected filterLabel(): string {
    return this.filterOptions.find(option => option.id === this.ideaFilter)?.label ?? 'All';
  }

  protected filterIcon(): string {
    return this.filterOptions.find(option => option.id === this.ideaFilter)?.icon ?? 'view_day';
  }

  protected filterCount(filter: IdeaPostFilter = this.ideaFilter): number {
    return this.filterPosts(this.posts(), filter).length;
  }

  protected filterDescription(): string {
    const total = this.posts().length;
    const visible = this.filterCount();
    return this.ideaFilter === 'all' ? `${total} article${total === 1 ? '' : 's'}` : `${visible} of ${total}`;
  }

  protected async uploadDraftImage(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    if (!file || !this.draft || this.uploading) {
      return;
    }
    this.uploading = true;
    this.error = '';
    this.refreshView();
    try {
      const result = await this.ideaPosts.uploadImage(this.actorUserId(), this.draft.id || 'draft-idea', file);
      if (!result.uploaded || !result.imageUrl) {
        this.error = 'Image upload did not return a link.';
        return;
      }
      this.draft.imageUrls = this.uniqueImageUrls([result.imageUrl, ...this.draft.imageUrls]);
      if (!this.draft.imageUrl.trim()) {
        this.draft.imageUrl = result.imageUrl;
      }
      await this.copyImageLink(result.imageUrl);
    } catch {
      this.error = 'Unable to upload image.';
    } finally {
      this.uploading = false;
      if (input) {
        input.value = '';
      }
      this.refreshView();
    }
  }

  protected removeDraftImage(imageUrl: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const normalized = imageUrl.trim();
    this.draft.imageUrls = this.draft.imageUrls.filter(url => url !== normalized);
    if (this.draft.imageUrl.trim() === normalized) {
      this.draft.imageUrl = this.draft.imageUrls[0] ?? '';
    }
  }

  protected setPrimaryImage(imageUrl: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    this.draft.imageUrl = imageUrl.trim();
    this.draft.imageUrls = this.uniqueImageUrls([this.draft.imageUrl, ...this.draft.imageUrls]);
  }

  protected async copyImageLink(imageUrl: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    const link = this.copyableImageLink(imageUrl);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        this.copyWithFallback(link);
      }
      this.copiedImageUrl = imageUrl;
    } catch {
      this.copyWithFallback(link);
      this.copiedImageUrl = imageUrl;
    }
  }

  protected formatPastedHtml(event: ClipboardEvent): void {
    if (!this.draft) {
      return;
    }
    const pasted = event.clipboardData?.getData('text/html')
      || event.clipboardData?.getData('text/plain')
      || '';
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

  protected copyableImageLink(imageUrl: string): string {
    const normalized = imageUrl.trim();
    if (!normalized || normalized.startsWith('data:')) {
      return normalized;
    }
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    if (typeof window === 'undefined') {
      return normalized;
    }
    return new URL(normalized, window.location.origin).toString();
  }

  protected postStatusLabel(post: Pick<IdeaPost, 'published' | 'featured'>): string {
    if (!post.published) {
      return 'Draft';
    }
    return post.featured ? 'Featured' : 'Published';
  }

  protected postDateLabel(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'> | null): string {
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

  protected draftImageUrl(): string {
    return `${this.draft?.imageUrl ?? this.draft?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected ideaImageUrl(post: Pick<IdeaPost, 'imageUrl' | 'imageUrls'> | null): string {
    return `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected actorUserId(): string {
    return this.admin.activeAdmin()?.id?.trim() || 'admin';
  }

  private beginEditing(draft: IdeaPostDraft): void {
    this.draft = draft;
    this.editing = true;
    this.copiedImageUrl = '';
  }

  private requestFromDraft(draft: IdeaPostDraft): IdeaPostSaveRequest {
    return {
      actorUserId: this.actorUserId(),
      id: draft.id,
      title: draft.title,
      excerpt: draft.excerpt,
      contentHtml: draft.contentHtml,
      imageUrl: draft.imageUrl,
      imageUrls: draft.imageUrls,
      featured: draft.featured,
      published: draft.published,
      submittedAtIso: this.fromDateTimeLocal(draft.submittedAtLocal)
    };
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

  private filterPosts(posts: readonly IdeaPost[], filter: IdeaPostFilter): IdeaPost[] {
    return posts.filter(post => {
      if (filter === 'featured') {
        return post.featured === true;
      }
      if (filter === 'drafts') {
        return post.published === false;
      }
      return true;
    });
  }

  private sortedPosts(posts: readonly IdeaPost[]): IdeaPost[] {
    return [...posts].sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private ideaDayGroupLabel(post: IdeaPost): string {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
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
    if (filter === 'drafts') {
      return 'No draft articles';
    }
    return 'No articles';
  }

  private ideaEmptyDescription(filter: IdeaPostFilter): string {
    if (filter === 'featured') {
      return 'Feature an article card with the star action.';
    }
    if (filter === 'drafts') {
      return 'Close the editor with unpublished content to keep a draft.';
    }
    return 'Create the first landing article card.';
  }

  private hasMeaningfulDraft(draft: IdeaPostDraft): boolean {
    return Boolean(
      draft.id
      || draft.title.trim()
      || draft.excerpt.trim()
      || this.htmlToText(draft.contentHtml).trim()
      || draft.imageUrl.trim()
      || draft.imageUrls.length > 0
    );
  }

  private htmlToText(value: string): string {
    if (typeof document === 'undefined') {
      return `${value ?? ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const template = document.createElement('template');
    template.innerHTML = value;
    return `${template.content.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
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

  private copyWithFallback(value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
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

  private delay(durationMs: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, durationMs)));
  }

  private withTimeout<T>(promise: Promise<T>, durationMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Timed out')), Math.max(0, durationMs));
      promise.then(
        value => {
          window.clearTimeout(timer);
          resolve(value);
        },
        error => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
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

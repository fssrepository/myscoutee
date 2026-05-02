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
type IdeaPostFilter = 'all' | 'featured' | 'published' | 'drafts' | 'trashed';

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
  protected uploading = false;
  protected error = '';
  protected copiedImageUrl = '';
  protected editing = false;
  protected draft: IdeaPostDraft | null = null;
  protected viewerPostId = '';
  protected viewerPost: IdeaPost | null = null;
  protected imageSlotCarouselIndex = 0;
  protected uploadingImageSlotIndex: number | null = null;
  protected filterMenuOpen = false;
  protected ideaFilter: IdeaPostFilter = 'all';
  protected ideaListFilters: IdeaSmartListFilters = { status: 'all', revision: 0 };
  protected readonly actionRingPerimeter = 100;
  protected readonly ideaImageSlotCount = 8;
  protected readonly ideaImageSlotIndexes = Array.from({ length: this.ideaImageSlotCount }, (_value, index) => index);
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
    { id: 'published', label: 'Published', icon: 'visibility' },
    { id: 'drafts', label: 'Drafts', icon: 'drafts' },
    { id: 'trashed', label: 'Trashed', icon: 'delete_outline' }
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
        this.viewerPost = null;
        this.filterMenuOpen = false;
        this.error = '';
        this.copiedImageUrl = '';
        this.imageSlotCarouselIndex = 0;
        this.uploadingImageSlotIndex = null;
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
      this.closeEditor();
      return;
    }
    this.close();
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.imageSlotCarouselIndex = this.clampImageSlotPageIndex(this.imageSlotCarouselIndex);
  }

  protected posts(): IdeaPost[] {
    return this.ideaPosts.adminPosts();
  }

  protected selectedViewerPost(): IdeaPost | null {
    return this.viewerPost
      ?? this.posts().find(post => post.id === this.viewerPostId)
      ?? null;
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
    this.viewerPost = null;
    this.uploadingImageSlotIndex = null;
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
    this.viewerPost = this.clonePost(post);
    this.refreshView();
  }

  protected closeViewer(event?: Event): void {
    event?.stopPropagation();
    this.viewerPostId = '';
    this.viewerPost = null;
    this.refreshView();
  }

  protected startEditing(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.viewerPostId = '';
    this.viewerPost = null;
    this.beginEditing({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      contentHtml: this.formatHtmlFragment(post.contentHtml),
      imageUrl: post.imageUrl,
      imageUrls: [...post.imageUrls],
      featured: false,
      published: false,
      submittedAtLocal: this.toDateTimeLocal(post.submittedAtIso || post.updatedAtIso || post.createdAtIso),
      mode: 'html'
    });
  }

  protected closeEditor(event?: Event): void {
    event?.stopPropagation();
    this.editing = false;
    this.draft = null;
    this.copiedImageUrl = '';
  }

  protected openDraftPreview(event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const submittedAtIso = this.fromDateTimeLocal(this.draft.submittedAtLocal);
    const contentHtml = this.draft.contentHtml.trim() || '<p></p>';
    const imageUrls = this.uniqueImageUrls([this.draft.imageUrl, ...this.draft.imageUrls]);
    this.viewerPostId = this.draft.id || 'draft-preview';
    this.viewerPost = {
      id: this.draft.id || 'draft-preview',
      title: this.draft.title.trim() || 'Untitled article',
      excerpt: this.draft.excerpt.trim() || this.excerptFromHtml(contentHtml),
      contentHtml,
      imageUrl: this.draft.imageUrl.trim() || imageUrls[0] || '',
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
    this.refreshView();
  }

  protected async saveDraft(event?: Event): Promise<IdeaPost | null> {
    event?.preventDefault();
    event?.stopPropagation();
    const activeDraft = this.draft;
    if (!activeDraft || this.saving || this.uploading) {
      return null;
    }
    const previousId = activeDraft.id;
    const request = this.requestFromDraft(activeDraft);
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost(request);
      this.syncSavedPostInVisibleList(saved, previousId);
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

  protected deletePost(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.confirmationDialog.open({
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
          if (this.viewerPostId === post.id) {
            this.viewerPostId = '';
            this.viewerPost = null;
          }
          if (this.draft?.id === post.id) {
            this.editing = false;
            this.draft = null;
          }
          this.removeVisibleIdeaPost(post.id);
        } catch {
          this.error = 'Unable to move article to trash.';
        } finally {
          this.saving = false;
          this.refreshView();
        }
      }
    });
  }

  protected togglePublishedFromCard(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    if (post.trashed) {
      return;
    }
    const nextPublished = !post.published;
    this.confirmationDialog.open({
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

  protected async restorePost(post: IdeaPost, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!post.trashed || this.saving) {
      return;
    }
    this.confirmationDialog.open({
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

  private async confirmRestorePost(post: IdeaPost): Promise<void> {
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const restored = await this.ideaPosts.restorePost(post.id, this.actorUserId());
      if (this.viewerPostId === post.id) {
        this.viewerPost = this.clonePost(restored);
      }
      if (this.ideaFilter === 'trashed') {
        this.removeVisibleIdeaPost(post.id);
      } else {
        this.syncSavedPostInVisibleList(restored, post.id);
      }
    } catch {
      this.error = 'Unable to restore article.';
      throw new Error(this.error);
    } finally {
      this.saving = false;
      this.refreshView();
    }
  }

  private async confirmPublishedToggle(post: IdeaPost, nextPublished: boolean): Promise<void> {
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost({
        actorUserId: this.actorUserId(),
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: post.contentHtml,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        featured: nextPublished ? post.featured : false,
        published: nextPublished,
        submittedAtIso: post.submittedAtIso
      });
      if (this.viewerPostId === post.id) {
        this.viewerPost = this.clonePost(saved);
      }
      if (this.draft?.id === post.id) {
        this.draft.published = saved.published;
        this.draft.featured = saved.featured;
      }
      this.syncSavedPostInVisibleList(saved, post.id);
    } catch {
      this.error = nextPublished ? 'Unable to publish article.' : 'Unable to unpublish article.';
      throw new Error(this.error);
    } finally {
      this.saving = false;
      this.refreshView();
    }
  }

  protected async toggleFeaturedFromCard(post: IdeaPost, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (post.trashed || this.featuredPendingIds.has(post.id)) {
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

  private syncSavedPostInVisibleList(post: IdeaPost, previousId: string | null = post.id): void {
    const smartList = this.ideaSmartList;
    if (!smartList) {
      return;
    }
    const saved = this.clonePost(post);
    const savedMatchesFilter = this.filterPosts([saved], this.ideaFilter).length > 0;
    const currentItems = smartList.itemsSnapshot()
      .filter(item => item.id !== saved.id && item.id !== previousId)
      .map(item => this.clonePost(item));
    const nextItems = savedMatchesFilter
      ? this.sortedPosts([...currentItems, saved])
      : currentItems;
    smartList.replaceVisibleItems(nextItems, {
      total: this.filterCount(this.ideaFilter)
    });
  }

  private removeVisibleIdeaPost(postId: string): void {
    const smartList = this.ideaSmartList;
    if (!smartList) {
      return;
    }
    const nextItems = smartList.itemsSnapshot().filter(item => item.id !== postId);
    smartList.replaceVisibleItems(nextItems, {
      total: this.filterCount(this.ideaFilter)
    });
  }

  private clonePost(post: IdeaPost): IdeaPost {
    return { ...post, imageUrls: [...post.imageUrls] };
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
      case 'publish':
      case 'unpublish':
        this.togglePublishedFromCard(post);
        break;
      case 'restore':
        void this.restorePost(post);
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
    const publicationAction = post.published
      ? { id: 'unpublish', label: 'Unpublish', icon: 'visibility_off', tone: 'warning' as const }
      : { id: 'publish', label: 'Publish', icon: 'published_with_changes', tone: 'accent' as const };
    const menuActions = post.trashed
      ? [{ id: 'restore', label: 'Restore', icon: 'restore_from_trash' }]
      : [
          { id: 'view', label: 'View', icon: 'visibility' },
          { id: 'edit', label: 'Edit', icon: 'edit', tone: 'accent' as const },
          publicationAction,
          { id: 'delete', label: 'Delete', icon: 'delete', tone: 'destructive' as const }
        ];
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
      surfaceTone: post.trashed ? 'draft' : !post.published ? 'draft' : post.featured ? 'series' : 'default',
      leadingIcon: {
        icon: post.trashed ? 'delete_outline' : post.published ? 'article' : 'drafts',
        tone: post.published && !post.trashed ? 'public' : 'pending'
      },
      mediaEnd: post.trashed ? null : {
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
      menuActions,
      menuTitle: null,
      footerChips: [
        ...(post.trashed ? [{ label: 'Trashed', toneClass: 'idea-chip-trash' }] : []),
        ...(!post.published && !post.trashed ? [{ label: 'Draft', toneClass: 'idea-chip-draft' }] : [])
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

  protected async uploadDraftImage(event: Event, slotIndex = 0): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    const normalizedSlotIndex = this.clampImageSlotIndex(slotIndex);
    if (!file || !this.draft || this.uploading) {
      return;
    }
    this.uploading = true;
    this.uploadingImageSlotIndex = normalizedSlotIndex;
    this.imageSlotCarouselIndex = this.imageSlotPageForSlot(normalizedSlotIndex);
    this.error = '';
    this.refreshView();
    try {
      const result = await this.ideaPosts.uploadImage(this.actorUserId(), this.draft.id || 'draft-idea', file);
      if (!result.uploaded || !result.imageUrl) {
        this.error = 'Image upload did not return a link.';
        return;
      }
      const slots = this.draftImageSlots();
      slots[normalizedSlotIndex] = result.imageUrl;
      this.applyDraftImageSlots(slots);
      await this.copyImageLink(result.imageUrl);
    } catch {
      this.error = 'Unable to upload image.';
    } finally {
      this.uploading = false;
      this.uploadingImageSlotIndex = null;
      if (input) {
        input.value = '';
      }
      this.refreshView();
    }
  }

  protected openDraftImageSlot(input: HTMLInputElement, event?: Event): void {
    event?.stopPropagation();
    if (this.uploading || this.saving) {
      return;
    }
    input.click();
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

  protected removeDraftImageSlot(slotIndex: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const slots = this.draftImageSlots();
    slots[this.clampImageSlotIndex(slotIndex)] = null;
    this.applyDraftImageSlots(slots);
  }

  protected setPrimaryImage(imageUrl: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    this.draft.imageUrl = imageUrl.trim();
    this.draft.imageUrls = this.uniqueImageUrls([this.draft.imageUrl, ...this.draft.imageUrls]);
  }

  protected imageSlotCarouselTransform(): string {
    return `translateX(-${this.imageSlotCarouselIndex * 100}%)`;
  }

  protected showPreviousImageSlotPage(event?: Event): void {
    event?.stopPropagation();
    this.showImageSlotPage(this.imageSlotCarouselIndex - 1, event);
  }

  protected showNextImageSlotPage(event?: Event): void {
    event?.stopPropagation();
    this.showImageSlotPage(this.imageSlotCarouselIndex + 1, event);
  }

  protected showImageSlotPage(index: number, event?: Event): void {
    event?.stopPropagation();
    this.imageSlotCarouselIndex = this.clampImageSlotPageIndex(index);
  }

  protected isImageSlotUploading(slotIndex: number): boolean {
    return this.uploadingImageSlotIndex === slotIndex;
  }

  protected imageSlotPages(): number[][] {
    const slotsPerPage = this.imageSlotsPerCarouselPage();
    const pages: number[][] = [];
    for (let index = 0; index < this.ideaImageSlotIndexes.length; index += slotsPerPage) {
      pages.push(this.ideaImageSlotIndexes.slice(index, index + slotsPerPage));
    }
    return pages;
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

  protected articlePreviewHtml(post: Pick<IdeaPost, 'contentHtml'> | null): string {
    return this.expandPlainImageLinksInHtml(post?.contentHtml ?? '');
  }

  protected postStatusLabel(post: Pick<IdeaPost, 'published' | 'featured' | 'trashed'>): string {
    if (post.trashed) {
      return 'Trashed';
    }
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

  protected draftImageSlots(): Array<string | null> {
    if (!this.draft) {
      return Array.from({ length: this.ideaImageSlotCount }, () => null);
    }
    const urls = this.uniqueImageUrls([this.draft.imageUrl, ...this.draft.imageUrls])
      .slice(0, this.ideaImageSlotCount);
    return Array.from({ length: this.ideaImageSlotCount }, (_value, index) => urls[index] ?? null);
  }

  protected ideaImageUrl(post: Pick<IdeaPost, 'imageUrl' | 'imageUrls'> | null): string {
    return `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected actorUserId(): string {
    return this.admin.activeAdmin()?.id?.trim() || 'admin';
  }

  private beginEditing(draft: IdeaPostDraft): void {
    this.draft = draft;
    this.applyDraftImageSlots(this.draftImageSlots());
    this.editing = true;
    this.copiedImageUrl = '';
    this.imageSlotCarouselIndex = 0;
    this.uploadingImageSlotIndex = null;
  }

  private applyDraftImageSlots(slots: readonly (string | null)[]): void {
    if (!this.draft) {
      return;
    }
    const urls = this.uniqueImageUrls(slots.map(slot => slot ?? '').slice(0, this.ideaImageSlotCount));
    this.draft.imageUrls = urls;
    this.draft.imageUrl = urls[0] ?? '';
  }

  private clampImageSlotIndex(slotIndex: number): number {
    const parsed = Math.trunc(Number(slotIndex));
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(this.ideaImageSlotCount - 1, parsed));
  }

  private imageSlotsPerCarouselPage(): number {
    if (typeof window === 'undefined') {
      return 4;
    }
    if (window.innerWidth <= 720) {
      return 1;
    }
    if (window.innerWidth <= 980) {
      return 3;
    }
    return 4;
  }

  private imageSlotPageForSlot(slotIndex: number): number {
    return this.clampImageSlotPageIndex(Math.floor(this.clampImageSlotIndex(slotIndex) / this.imageSlotsPerCarouselPage()));
  }

  private clampImageSlotPageIndex(pageIndex: number): number {
    const parsed = Math.trunc(Number(pageIndex));
    const maxPageIndex = Math.max(0, Math.ceil(this.ideaImageSlotCount / this.imageSlotsPerCarouselPage()) - 1);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(maxPageIndex, parsed));
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
      featured: false,
      published: false,
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
      if (filter === 'trashed') {
        return post.trashed === true;
      }
      if (post.trashed) {
        return false;
      }
      if (filter === 'featured') {
        return post.featured === true;
      }
      if (filter === 'published') {
        return post.published === true;
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
      || /^\/media\/public\?[^\s<>"']+$/i.test(normalized)
      || /^https?:\/\/[^\s<>"']+\/media\/public\?[^\s<>"']+$/i.test(normalized)
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

import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { Observable, of } from 'rxjs';

import type * as AppTypes from '../../../shared/core/base/models';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import {
  InfoCardComponent,
  type InfoCardData
} from '../../../shared/ui/components/card';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemRenderState,
  type SmartListLoadPage
} from '../../../shared/ui/components/smart-list';

interface HowStepSlide {
  readonly index: string;
  readonly title: string;
  readonly message: string;
  readonly visualClass: string;
}

@Component({
  selector: 'app-entry-landing',
  standalone: true,
  imports: [
    InfoCardComponent,
    SmartListComponent,
    MatRippleModule,
    MatIconModule
  ],
  templateUrl: './entry-landing.component.html',
  styleUrl: './entry-landing.component.scss'
})
export class EntryLandingComponent implements OnInit, OnDestroy {
  private readonly documentRef = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) authMode: AppTypes.AuthMode = 'selector';
  @Input() firebaseAuthProfile: AppTypes.FirebaseAuthProfile | null = null;
  @Input() ideaPosts: AppTypes.IdeaPost[] = [];

  @Output() readonly demoRequested = new EventEmitter<void>();
  @Output() readonly firebaseAuthRequested = new EventEmitter<void>();
  @Output() readonly consentRequested = new EventEmitter<void>();

  protected readonly howSlides: readonly HowStepSlide[] = [
    {
      index: '01',
      title: 'Set priorities and feedback',
      message: '1-10 score, not just yes/no. Show real interest level from low to high with clearer signals.',
      visualClass: 'entry-step-card-visual-1'
    },
    {
      index: '02',
      title: 'Start in a matched group chat',
      message: 'Group-first chat. Join top matches where interest matches both ways.',
      visualClass: 'entry-step-card-visual-2'
    },
    {
      index: '03',
      title: 'Meet through events',
      message: 'Live updates. Change priorities anytime, then meet through events and go offline.',
      visualClass: 'entry-step-card-visual-3'
    },
    {
      index: '04',
      title: 'Host your own events',
      message: 'Create events for everyone, friends, or invite-only.',
      visualClass: 'entry-step-card-visual-4'
    }
  ];

  protected activeHowSlideIndex = 0;
  protected activeIdeaCarouselPage = 0;
  protected ideaCarouselCardsPerPage = 4;
  protected ideasPopupOpen = false;
  protected ideaArticlePopupOpen = false;
  protected selectedIdeaId = '';

  protected readonly entryIdeaSmartListConfig: SmartListConfig<AppTypes.IdeaPost> = {
    pageSize: 10,
    initialPageSize: 10,
    initialPageCount: 1,
    loadingDelayMs: resolveCurrentRouteDelayMs('/landing/content', 1500),
    loadingWindowMs: 3000,
    defaultView: 'day',
    defaultDirection: 'desc',
    defaultGroupBy: 'submittedDay',
    emptyLabel: 'No articles yet',
    emptyDescription: 'Fresh MyScoutee articles will show here.',
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

  protected readonly entryIdeaSmartListLoadPage: SmartListLoadPage<AppTypes.IdeaPost> = (
    query: ListQuery
  ): Observable<PageResult<AppTypes.IdeaPost>> => {
    const posts = this.publishedIdeaPosts();
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.entryIdeaSmartListConfig.pageSize) || 10));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    const items = posts.slice(start, start + pageSize);
    return of({
      items,
      total: posts.length,
      nextCursor: start + items.length < posts.length ? `${start + items.length}` : null
    });
  };

  private readonly howCarouselIntervalMs = 5000;
  private howCarouselTimer: ReturnType<typeof setInterval> | null = null;
  private howCarouselSwipeStartX: number | null = null;
  private howCarouselSwipePointerId: number | null = null;
  private ideaCarouselSwipeStartX: number | null = null;
  private ideaCarouselSwipePointerId: number | null = null;
  private ideaCarouselSwipeStartTarget: EventTarget | null = null;
  private landingPopupScrollLocked = false;
  private previousBodyOverflow = '';

  ngOnInit(): void {
    this.syncIdeaCarouselPageSize();
    this.startHowCarouselAutoplay();
  }

  ngOnDestroy(): void {
    this.stopHowCarouselAutoplay();
    this.restoreLandingPopupScrollLock();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.ideasPopupOpen && !this.ideaArticlePopupOpen) {
      return;
    }
    event.preventDefault();
    if (this.ideaArticlePopupOpen) {
      this.closeIdeaArticlePopup();
      return;
    }
    this.closeIdeasPopup();
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.syncIdeaCarouselPageSize();
  }

  protected get isFirebaseAuthMode(): boolean {
    return this.authMode === 'firebase';
  }

  protected get entryAuthButtonShowsAvatar(): boolean {
    return this.isFirebaseAuthMode && !!this.firebaseAuthProfile;
  }

  protected get entryAuthButtonIcon(): string {
    if (this.authMode === 'selector') {
      return 'group';
    }
    return 'login';
  }

  protected get entryAuthButtonLabel(): string {
    if (this.entryAuthButtonShowsAvatar) {
      return this.firebaseAuthProfile?.name ?? 'Continue';
    }
    return 'Login';
  }

  protected get isFirstHowSlide(): boolean {
    return this.activeHowSlideIndex === 0;
  }

  protected get isLastHowSlide(): boolean {
    return this.activeHowSlideIndex === this.howSlides.length - 1;
  }

  protected showPreviousHowSlide(): void {
    if (this.isFirstHowSlide) {
      return;
    }
    this.setHowSlideIndex(this.activeHowSlideIndex - 1, false);
    this.stopHowCarouselAutoplay();
  }

  protected showNextHowSlide(): void {
    if (this.isLastHowSlide) {
      return;
    }
    this.setHowSlideIndex(this.activeHowSlideIndex + 1, false);
    this.stopHowCarouselAutoplay();
  }

  protected showHowSlide(index: number): void {
    this.setHowSlideIndex(index, true);
  }

  protected beginHowCarouselSwipe(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.howCarouselSwipeStartX = event.clientX;
    this.howCarouselSwipePointerId = event.pointerId;
    this.stopHowCarouselAutoplay();

    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
  }

  protected endHowCarouselSwipe(event: PointerEvent): void {
    if (this.howCarouselSwipePointerId !== event.pointerId) {
      return;
    }

    const swipeStartX = this.howCarouselSwipeStartX ?? event.clientX;
    const deltaX = event.clientX - swipeStartX;
    this.resetHowCarouselSwipe();

    if (Math.abs(deltaX) >= 48) {
      if (deltaX < 0) {
        this.showNextHowSlide();
      } else {
        this.showPreviousHowSlide();
      }
      return;
    }

    this.restartHowCarouselAutoplay();
  }

  protected cancelHowCarouselSwipe(event: PointerEvent): void {
    if (this.howCarouselSwipePointerId !== event.pointerId) {
      return;
    }

    this.resetHowCarouselSwipe();
    this.restartHowCarouselAutoplay();
  }

  protected requestDemo(): void {
    this.demoRequested.emit();
  }

  protected requestHeaderAuth(): void {
    if (this.isFirebaseAuthMode) {
      this.firebaseAuthRequested.emit();
      return;
    }
    this.demoRequested.emit();
  }

  protected requestConsent(event?: Event): void {
    event?.preventDefault();
    this.consentRequested.emit();
  }

  protected featuredIdeaPosts(): AppTypes.IdeaPost[] {
    const published = this.publishedIdeaPosts();
    const featured = published.filter(post => post.featured);
    return (featured.length > 0 ? featured : published).slice(0, 8);
  }

  protected featuredIdeaPages(): AppTypes.IdeaPost[][] {
    const pageSize = Math.max(1, this.ideaCarouselCardsPerPage);
    const posts = this.featuredIdeaPosts();
    const pages: AppTypes.IdeaPost[][] = [];
    for (let index = 0; index < posts.length; index += pageSize) {
      pages.push(posts.slice(index, index + pageSize));
    }
    return pages;
  }

  protected publishedIdeaPosts(): AppTypes.IdeaPost[] {
    return [...(this.ideaPosts ?? [])]
      .filter(post => post.published !== false && post.trashed !== true)
      .sort((left, right) => this.ideaSortValue(right) - this.ideaSortValue(left));
  }

  protected selectedIdeaPost(): AppTypes.IdeaPost | null {
    const published = this.publishedIdeaPosts();
    return published.find(post => post.id === this.selectedIdeaId)
      ?? published[0]
      ?? null;
  }

  protected ideaCarouselPageCount(): number {
    return Math.max(1, this.featuredIdeaPages().length);
  }

  protected get isFirstIdeaCarouselPage(): boolean {
    return this.activeIdeaCarouselPage <= 0;
  }

  protected get isLastIdeaCarouselPage(): boolean {
    return this.activeIdeaCarouselPage >= this.ideaCarouselPageCount() - 1;
  }

  protected openIdeasPopup(post?: AppTypes.IdeaPost, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const published = this.publishedIdeaPosts();
    if (published.length === 0) {
      return;
    }
    if (post) {
      this.openIdeaArticlePopup(post);
      return;
    }
    this.selectedIdeaId = published[0]?.id ?? '';
    this.ideasPopupOpen = true;
    this.syncLandingPopupScrollLock();
  }

  protected openIdeaCard(post: AppTypes.IdeaPost, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.ideasPopupOpen = false;
    this.openIdeaArticlePopup(post);
  }

  protected openIdeaArticlePopup(post: AppTypes.IdeaPost, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedIdeaId = post.id;
    this.ideaArticlePopupOpen = true;
    this.syncLandingPopupScrollLock();
  }

  protected closeIdeasPopup(): void {
    this.ideasPopupOpen = false;
    this.syncLandingPopupScrollLock();
  }

  protected closeIdeaArticlePopup(): void {
    this.ideaArticlePopupOpen = false;
    if (!this.ideasPopupOpen) {
      this.selectedIdeaId = '';
    }
    this.syncLandingPopupScrollLock();
  }

  protected showIdeaCarouselPage(pageIndex: number, event?: Event): void {
    event?.stopPropagation();
    this.activeIdeaCarouselPage = this.clampIdeaCarouselPage(pageIndex);
  }

  protected showPreviousIdeaCarouselPage(event?: Event): void {
    this.showIdeaCarouselPage(this.activeIdeaCarouselPage - 1, event);
  }

  protected showNextIdeaCarouselPage(event?: Event): void {
    this.showIdeaCarouselPage(this.activeIdeaCarouselPage + 1, event);
  }

  protected beginIdeaCarouselSwipe(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.ideaCarouselSwipeStartX = event.clientX;
    this.ideaCarouselSwipePointerId = event.pointerId;
    this.ideaCarouselSwipeStartTarget = event.target;

    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
  }

  protected endIdeaCarouselSwipe(event: PointerEvent): void {
    if (this.ideaCarouselSwipePointerId !== event.pointerId) {
      return;
    }

    const swipeStartX = this.ideaCarouselSwipeStartX ?? event.clientX;
    const swipeStartTarget = this.ideaCarouselSwipeStartTarget;
    const deltaX = event.clientX - swipeStartX;
    this.resetIdeaCarouselSwipe();

    if (Math.abs(deltaX) < 48) {
      if (event.pointerType === 'mouse' && Math.abs(deltaX) < 12) {
        this.openIdeaCardFromCarouselTarget(swipeStartTarget);
      }
      return;
    }
    if (deltaX < 0) {
      this.showNextIdeaCarouselPage();
    } else {
      this.showPreviousIdeaCarouselPage();
    }
  }

  protected cancelIdeaCarouselSwipe(event: PointerEvent): void {
    if (this.ideaCarouselSwipePointerId !== event.pointerId) {
      return;
    }
    this.resetIdeaCarouselSwipe();
  }

  protected entryIdeaInfoCard(post: AppTypes.IdeaPost): InfoCardData {
    return {
      rowId: `entry-idea:${post.id}`,
      title: post.title,
      imageUrl: this.ideaImageUrl(post) || null,
      placeholderLabel: 'No image',
      metaRows: [this.ideaDateLabel(post)],
      metaRowsLimit: 1,
      description: post.excerpt,
      descriptionLines: 3,
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
      clickable: true
    };
  }

  protected entryIdeaListInfoCard(
    post: AppTypes.IdeaPost,
    options: { groupLabel?: string | null; renderState?: SmartListItemRenderState | null } = {}
  ): InfoCardData {
    return {
      ...this.entryIdeaInfoCard(post),
      groupLabel: options.groupLabel ?? null,
      rowId: `entry-idea-list:${post.id}`,
      descriptionLines: 4,
      state: options.renderState === 'active' ? 'active' : options.renderState === 'leaving' ? 'leaving' : 'default'
    };
  }

  protected ideaImageUrl(post: AppTypes.IdeaPost | null): string {
    return `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected ideaDateLabel(post: AppTypes.IdeaPost | null): string {
    const parsed = Date.parse(post?.submittedAtIso || post?.updatedAtIso || post?.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return 'Fresh article';
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  protected scrollEntryTo(sectionId: string, event?: Event): void {
    event?.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private setHowSlideIndex(index: number, restartAutoplay: boolean): void {
    this.activeHowSlideIndex = this.clampHowSlideIndex(index);
    this.cdr.markForCheck();
    if (restartAutoplay) {
      this.restartHowCarouselAutoplay();
    }
  }

  private ideaSortValue(post: Pick<AppTypes.IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private clampHowSlideIndex(index: number): number {
    return Math.min(Math.max(index, 0), this.howSlides.length - 1);
  }

  private ideaDayGroupLabel(post: AppTypes.IdeaPost): string {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return 'Fresh articles';
    }
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  private clampIdeaCarouselPage(index: number): number {
    return Math.min(Math.max(index, 0), this.ideaCarouselPageCount() - 1);
  }

  private syncIdeaCarouselPageSize(): void {
    const width = typeof window === 'undefined' ? 1180 : window.innerWidth;
    const nextPageSize = width <= 720 ? 1 : width < 1080 ? 3 : 4;
    if (nextPageSize === this.ideaCarouselCardsPerPage) {
      this.activeIdeaCarouselPage = this.clampIdeaCarouselPage(this.activeIdeaCarouselPage);
      return;
    }
    this.ideaCarouselCardsPerPage = nextPageSize;
    this.activeIdeaCarouselPage = this.clampIdeaCarouselPage(this.activeIdeaCarouselPage);
  }

  private startHowCarouselAutoplay(): void {
    if (typeof window === 'undefined' || this.howCarouselTimer !== null) {
      return;
    }

    this.howCarouselTimer = setInterval(() => {
      const nextSlideIndex = this.isLastHowSlide ? 0 : this.activeHowSlideIndex + 1;
      this.setHowSlideIndex(nextSlideIndex, false);
    }, this.howCarouselIntervalMs);
  }

  private stopHowCarouselAutoplay(): void {
    if (this.howCarouselTimer === null) {
      return;
    }

    clearInterval(this.howCarouselTimer);
    this.howCarouselTimer = null;
  }

  private restartHowCarouselAutoplay(): void {
    this.stopHowCarouselAutoplay();
    this.startHowCarouselAutoplay();
  }

  private resetHowCarouselSwipe(): void {
    this.howCarouselSwipeStartX = null;
    this.howCarouselSwipePointerId = null;
  }

  private resetIdeaCarouselSwipe(): void {
    this.ideaCarouselSwipeStartX = null;
    this.ideaCarouselSwipePointerId = null;
    this.ideaCarouselSwipeStartTarget = null;
  }

  private openIdeaCardFromCarouselTarget(target: EventTarget | null): void {
    const element = target instanceof Element
      ? target.closest<HTMLElement>('[data-entry-idea-post-id]')
      : null;
    const postId = element?.dataset['entryIdeaPostId'];
    const post = postId
      ? this.publishedIdeaPosts().find(candidate => candidate.id === postId)
      : null;
    if (!post) {
      return;
    }
    this.openIdeaCard(post);
  }

  private syncLandingPopupScrollLock(): void {
    const shouldLock = this.ideasPopupOpen || this.ideaArticlePopupOpen;
    if (shouldLock && !this.landingPopupScrollLocked) {
      this.previousBodyOverflow = this.documentRef.body.style.overflow;
      this.documentRef.body.style.overflow = 'hidden';
      this.landingPopupScrollLocked = true;
      return;
    }
    if (!shouldLock) {
      this.restoreLandingPopupScrollLock();
    }
  }

  private restoreLandingPopupScrollLock(): void {
    if (!this.landingPopupScrollLocked) {
      return;
    }
    this.documentRef.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = '';
    this.landingPopupScrollLocked = false;
  }
}

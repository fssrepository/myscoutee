import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import type * as AppTypes from '../../../shared/core/base/models';

interface HowStepSlide {
  readonly index: string;
  readonly title: string;
  readonly message: string;
  readonly visualClass: string;
}

type IdeaPageButton = number | 'ellipsis-left' | 'ellipsis-right';

@Component({
  selector: 'app-entry-landing',
  standalone: true,
  imports: [
    MatRippleModule,
    MatIconModule
  ],
  templateUrl: './entry-landing.component.html',
  styleUrl: './entry-landing.component.scss'
})
export class EntryLandingComponent implements OnInit, OnDestroy {
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
  protected ideasPopupOpen = false;
  protected selectedIdeaId = '';
  protected ideaPageIndex = 0;
  protected readonly ideaPageSize = 10;

  private readonly howCarouselIntervalMs = 5000;
  private howCarouselTimer: ReturnType<typeof setInterval> | null = null;
  private howCarouselSwipeStartX: number | null = null;
  private howCarouselSwipePointerId: number | null = null;

  ngOnInit(): void {
    this.startHowCarouselAutoplay();
  }

  ngOnDestroy(): void {
    this.stopHowCarouselAutoplay();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.ideasPopupOpen) {
      return;
    }
    event.preventDefault();
    this.closeIdeasPopup();
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
      this.restartHowCarouselAutoplay();
      return;
    }

    this.setHowSlideIndex(this.activeHowSlideIndex - 1, true);
  }

  protected showNextHowSlide(): void {
    if (this.isLastHowSlide) {
      this.restartHowCarouselAutoplay();
      return;
    }

    this.setHowSlideIndex(this.activeHowSlideIndex + 1, true);
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

  protected publishedIdeaPosts(): AppTypes.IdeaPost[] {
    return [...(this.ideaPosts ?? [])]
      .filter(post => post.published !== false)
      .sort((left, right) => this.ideaSortValue(right) - this.ideaSortValue(left));
  }

  protected pagedIdeaPosts(): AppTypes.IdeaPost[] {
    const startIndex = this.ideaPageIndex * this.ideaPageSize;
    return this.publishedIdeaPosts().slice(startIndex, startIndex + this.ideaPageSize);
  }

  protected selectedIdeaPost(): AppTypes.IdeaPost | null {
    const published = this.publishedIdeaPosts();
    return published.find(post => post.id === this.selectedIdeaId)
      ?? this.pagedIdeaPosts()[0]
      ?? published[0]
      ?? null;
  }

  protected ideaPageCount(): number {
    return Math.max(1, Math.ceil(this.publishedIdeaPosts().length / this.ideaPageSize));
  }

  protected ideaPageButtons(): IdeaPageButton[] {
    const pageCount = this.ideaPageCount();
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index);
    }
    const current = this.ideaPageIndex;
    const buttons: IdeaPageButton[] = [0];
    if (current > 3) {
      buttons.push('ellipsis-left');
    }
    const start = Math.max(1, current - 1);
    const end = Math.min(pageCount - 2, current + 1);
    for (let index = start; index <= end; index += 1) {
      buttons.push(index);
    }
    if (current < pageCount - 4) {
      buttons.push('ellipsis-right');
    }
    buttons.push(pageCount - 1);
    return buttons;
  }

  protected openIdeasPopup(post?: AppTypes.IdeaPost, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const published = this.publishedIdeaPosts();
    if (published.length === 0) {
      return;
    }
    const selectedPost = post ?? published[0];
    const selectedIndex = Math.max(0, published.findIndex(item => item.id === selectedPost.id));
    this.ideaPageIndex = Math.floor(selectedIndex / this.ideaPageSize);
    this.selectedIdeaId = selectedPost.id;
    this.ideasPopupOpen = true;
  }

  protected closeIdeasPopup(): void {
    this.ideasPopupOpen = false;
  }

  protected selectIdeaPost(post: AppTypes.IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.selectedIdeaId = post.id;
  }

  protected showIdeaPage(pageIndex: number, event?: Event): void {
    event?.stopPropagation();
    const pageCount = this.ideaPageCount();
    this.ideaPageIndex = Math.min(Math.max(pageIndex, 0), pageCount - 1);
    const selected = this.pagedIdeaPosts()[0] ?? null;
    if (selected) {
      this.selectedIdeaId = selected.id;
    }
  }

  protected showPreviousIdeaPage(event?: Event): void {
    this.showIdeaPage(this.ideaPageIndex - 1, event);
  }

  protected showNextIdeaPage(event?: Event): void {
    this.showIdeaPage(this.ideaPageIndex + 1, event);
  }

  protected ideaImageUrl(post: AppTypes.IdeaPost | null): string {
    return `${post?.imageUrl ?? post?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected ideaDateLabel(post: AppTypes.IdeaPost | null): string {
    const parsed = Date.parse(post?.submittedAtIso || post?.updatedAtIso || post?.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return 'Fresh idea';
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  protected ideaPageButtonLabel(button: IdeaPageButton): string {
    return typeof button === 'number' ? `${button + 1}` : '...';
  }

  protected isIdeaPageNumber(button: IdeaPageButton): boolean {
    return typeof button === 'number';
  }

  protected ideaPageNumber(button: IdeaPageButton): number {
    return typeof button === 'number' ? button : this.ideaPageIndex;
  }

  protected ideaPageButtonTrack(index: number, button: IdeaPageButton): string {
    return `${index}-${button}`;
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
}

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import type * as AppTypes from '../../../shared/core/base/models';

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
    MatRippleModule,
    MatIconModule
  ],
  templateUrl: './entry-landing.component.html',
  styleUrl: './entry-landing.component.scss'
})
export class EntryLandingComponent implements OnInit, OnDestroy {
  @Input({ required: true }) authMode: AppTypes.AuthMode = 'selector';
  @Input() firebaseAuthProfile: AppTypes.FirebaseAuthProfile | null = null;

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

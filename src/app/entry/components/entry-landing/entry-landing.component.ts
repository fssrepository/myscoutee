import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject, Observable, filter, map, of, take } from 'rxjs';

import type { AuthMode } from '../../../shared/core/common/constants';
import type { IdeaArticleDetailDto } from '../../../shared/core/contracts/content.interface';
import type { FirebaseAuthProfileDto } from '../../../shared/core/contracts/user.interface';
import {
  InfoCardComponent, WarpImageCardComponent, type InfoCardData, type WarpImageCardData
} from '../../../shared/ui/components/core/smart-list/card';
import {
  SmartListComponent, type ListQuery, type PageResult, type SmartListConfig, type SmartListItemRenderState, type SmartListLoadPage
} from '../../../shared/ui/components/core/smart-list';
import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import { LazyBgImageDirective } from '../../../shared/ui/directives';
import { I18nPipe } from '../../../shared/ui';

type IdeaInfoCard = InfoCardData<IdeaArticleDetailDto>;

interface AppVersionPayload {
  readonly version?: unknown;
  readonly buildId?: unknown;
  readonly gitSha?: unknown;
}

type HowStepSlide = WarpImageCardData;

@Component({
  selector: 'app-entry-landing',
  standalone: true,
  imports: [
    InfoCardComponent,
    WarpImageCardComponent,
    SmartListComponent,
    PopupComponent,
    LazyBgImageDirective,
    MatRippleModule,
    MatIconModule,
    I18nPipe
  ],
  templateUrl: './entry-landing.component.html',
  styleUrl: './entry-landing.component.scss'
})
export class EntryLandingComponent implements OnInit, OnChanges, OnDestroy {
  private readonly documentRef = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) authMode: AuthMode = 'selector';
  @Input() firebaseAuthProfile: FirebaseAuthProfileDto | null = null;
  @Input() articlesLoading = false;
  @Input() ideaCards: InfoCardData[] = [];
  @Input() authUnavailable = false;
  @Input() authUnavailableLabel = 'Unavailable in your country';
  @Input() authLocationRequired = false;
  @Input() authLocationRequiredLabel = 'Allow location';
  @Input() networkUnavailable = false;
  @Input() networkUnavailableLabel = 'No network';

  @Output() readonly demoRequested = new EventEmitter<void>();
  @Output() readonly firebaseAuthRequested = new EventEmitter<void>();
  @Output() readonly consentRequested = new EventEmitter<void>();
  @Output() readonly termsRequested = new EventEmitter<void>();

  protected readonly howSlides: readonly HowStepSlide[] = [
    {
      id: 'priority-feedback',
      index: '01',
      titleKey: 'set.priorities.and.feedback',
      title: 'Set priorities and feedback',
      messageKey: '1.10.score.not.just.yes.no.show.real.interest.level.from.low.to.high.with.clearer.signals',
      message: '1-10 score, not just yes/no. Show real interest level from low to high with clearer signals.',
      tone: 'blue',
      sliceX: '0%',
      sliceY: '0%'
    },
    {
      id: 'matched-group-chat',
      index: '02',
      titleKey: 'start.in.a.matched.group.chat',
      title: 'Start in a matched group chat',
      messageKey: 'group.first.chat.join.top.matches.where.interest.matches.both.ways',
      message: 'Group-first chat. Join top matches where interest matches both ways.',
      tone: 'purple',
      sliceX: '100%',
      sliceY: '0%'
    },
    {
      id: 'meet-through-events',
      index: '03',
      titleKey: 'meet.through.events',
      title: 'Meet through events',
      messageKey: 'live.updates.change.priorities.anytime.then.meet.through.events.and.go.offline',
      message: 'Live updates. Change priorities anytime, then meet through events and go offline.',
      tone: 'pink',
      sliceX: '0%',
      sliceY: '100%'
    },
    {
      id: 'host-events',
      index: '04',
      titleKey: 'host.your.own.events',
      title: 'Host your own events',
      messageKey: 'create.events.for.everyone.friends.or.invite.only',
      message: 'Create events for everyone, friends, or invite-only.',
      tone: 'orange',
      sliceX: '100%',
      sliceY: '100%'
    }
  ];

  protected readonly entryHowSmartListConfig: SmartListConfig<HowStepSlide> = {
    pageSize: 4,
    initialPageSize: 4,
    initialPageCount: 1,
    showStickyHeader: false,
    showFirstGroupMarker: false,
    showGroupMarker: () => false,
    groupBy: null,
    trackBy: (_index, slide) => slide.id,
    listLayout: 'card-grid',
    orientation: 'horizontal',
    compactHorizontal: true,
    desktopColumns: 1,
    snapMode: 'none',
    mobileStepper: true,
    headerProgress: {
      enabled: false
    },
    pagination: {
      mode: 'arrows',
      autoplayMs: 5000
    },
    containerClass: {
      'entry-how-card-list': true
    }
  };

  protected readonly entryHowSmartListLoadPage: SmartListLoadPage<HowStepSlide> = (
    query: ListQuery
  ): Observable<PageResult<HowStepSlide>> => {
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.entryHowSmartListConfig.pageSize) || this.howSlides.length));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    const items = this.howSlides.slice(start, start + pageSize);
    return of({
      items,
      total: this.howSlides.length,
      nextCursor: start + items.length < this.howSlides.length ? `${start + items.length}` : null
    });
  };

  protected previewGuideOpen = false;
  protected ideasPopupOpen = false;
  protected ideaArticlePopupOpen = false;
  protected selectedIdeaId = '';
  protected appVersionLabel = 'v1.0.0';
  protected featuredIdeaSmartListFilters: { signature: string } = { signature: '' };
  private readonly articlesReadySignal = new BehaviorSubject<number>(0);

  protected readonly entryFeaturedIdeaSmartListConfig: SmartListConfig<IdeaInfoCard> = {
    pageSize: 8,
    initialPageSize: 8,
    initialPageCount: 1,
    emptyLabel: 'No articles yet',
    emptyDescription: 'Fresh MyScoutee articles will show here.',
    showStickyHeader: false,
    showFirstGroupMarker: false,
    showGroupMarker: () => false,
    groupBy: null,
    trackBy: (_index, card) => card.id,
    listLayout: 'card-grid',
    orientation: 'horizontal',
    desktopColumns: 4,
    snapMode: 'none',
    mobileStepper: true,
    headerProgress: {
      enabled: true
    },
    pagination: {
      mode: 'arrows'
    }
  };

  protected readonly entryFeaturedIdeaSmartListLoadPage: SmartListLoadPage<IdeaInfoCard> = (
    query: ListQuery
  ): Observable<PageResult<IdeaInfoCard>> => {
    if (this.articlesLoading) {
      return this.articlesReadySignal.pipe(
        filter(() => !this.articlesLoading),
        take(1),
        map(() => this.featuredIdeaPageResult(query))
      );
    }
    return of(this.featuredIdeaPageResult(query));
  };

  protected readonly entryIdeaSmartListConfig: SmartListConfig<IdeaInfoCard> = {
    pageSize: 10,
    initialPageSize: 10,
    initialPageCount: 1,
    defaultView: 'day',
    defaultDirection: 'desc',
    defaultGroupBy: 'submittedDay',
    emptyLabel: 'No articles yet',
    emptyDescription: 'Fresh MyScoutee articles will show here.',
    emptyStickyLabel: 'Articles',
    showStickyHeader: true,
    showFirstGroupMarker: true,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: card => this.ideaDayGroupLabel(this.ideaCardDetail(card)),
    trackBy: (_index, card) => card.id,
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

  protected readonly entryIdeaSmartListLoadPage: SmartListLoadPage<IdeaInfoCard> = (
    query: ListQuery
  ): Observable<PageResult<IdeaInfoCard>> => {
    const cards = this.publishedIdeaCards();
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.entryIdeaSmartListConfig.pageSize) || 10));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    const items = cards.slice(start, start + pageSize);
    return of({
      items,
      total: cards.length,
      nextCursor: start + items.length < cards.length ? `${start + items.length}` : null
    });
  };

  private landingPopupScrollLocked = false;
  private previousBodyOverflow = '';

  ngOnInit(): void {
    this.updateFeaturedIdeaSmartListFilters();
    void this.loadAppVersionLabel();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ideaCards'] || changes['articlesLoading']) {
      this.updateFeaturedIdeaSmartListFilters();
      this.articlesReadySignal.next(Date.now());
    }
  }

  ngOnDestroy(): void {
    this.restoreLandingPopupScrollLock();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.previewGuideOpen && !this.ideasPopupOpen && !this.ideaArticlePopupOpen) {
      return;
    }
    event.preventDefault();
    if (this.ideaArticlePopupOpen) {
      this.closeIdeaArticlePopup();
      return;
    }
    if (this.previewGuideOpen) {
      this.closePreviewGuide();
      return;
    }
    this.closeIdeasPopup();
  }

  protected get isFirebaseAuthMode(): boolean {
    return this.authMode === 'firebase';
  }

  protected get entryAuthButtonShowsAvatar(): boolean {
    return !this.networkUnavailable
      && !this.authUnavailable
      && !this.authLocationRequired
      && this.isFirebaseAuthMode
      && !!this.firebaseAuthProfile;
  }

  protected get entryAuthButtonIcon(): string {
    if (this.networkUnavailable) {
      return 'wifi_off';
    }
    if (this.authUnavailable) {
      return 'block';
    }
    if (this.authLocationRequired) {
      return 'location_on';
    }
    if (this.authMode === 'selector') {
      return 'group';
    }
    return 'login';
  }

  protected get entryAuthButtonLabel(): string {
    if (this.networkUnavailable) {
      return this.networkUnavailableLabel;
    }
    if (this.authUnavailable) {
      return this.authUnavailableLabel;
    }
    if (this.authLocationRequired) {
      return this.authLocationRequiredLabel;
    }
    if (this.entryAuthButtonShowsAvatar) {
      return this.firebaseAuthProfile?.name ?? 'Continue';
    }
    return 'Login';
  }

  protected get entryPrimaryCtaIcon(): string {
    return this.networkUnavailable ? 'wifi_off' : 'rocket_launch';
  }

  protected get entryPrimaryCtaLabel(): string {
    return this.networkUnavailable ? this.networkUnavailableLabel : 'Start exploring';
  }

  protected showHowItWorksCta(): boolean {
    return !this.networkUnavailable && (this.articlesLoading || this.featuredIdeaCards().length > 0);
  }

  private async loadAppVersionLabel(): Promise<void> {
    if (typeof fetch !== 'function' || typeof document === 'undefined') {
      return;
    }
    try {
      const response = await fetch(new URL('app-version.json', document.baseURI).toString(), {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json() as AppVersionPayload;
      const version = this.normalizeAppVersion(payload.version)
        || this.normalizeAppVersion(payload.buildId)
        || this.normalizeAppVersion(payload.gitSha);
      if (version) {
        this.appVersionLabel = version.startsWith('v') ? version : `v${version}`;
        this.cdr.markForCheck();
      }
    } catch {
      // The local dev server may not have a stamped version file yet.
    }
  }

  private normalizeAppVersion(value: unknown): string {
    return typeof value === 'string'
      ? value.trim().replace(/[^a-zA-Z0-9._+-]/g, '').slice(0, 48)
      : '';
  }

  protected requestDemo(): void {
    if (this.networkUnavailable || this.authUnavailable) {
      return;
    }
    this.demoRequested.emit();
  }

  protected requestHeaderAuth(): void {
    if (this.networkUnavailable || this.authUnavailable) {
      return;
    }
    if (this.isFirebaseAuthMode) {
      this.firebaseAuthRequested.emit();
      return;
    }
    this.demoRequested.emit();
  }

  protected requestConsent(event?: Event): void {
    event?.preventDefault();
    if (this.networkUnavailable) {
      return;
    }
    this.consentRequested.emit();
  }

  protected requestTerms(event?: Event): void {
    event?.preventDefault();
    if (this.networkUnavailable) {
      return;
    }
    this.termsRequested.emit();
  }

  protected openPreviewGuide(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.previewGuideOpen = true;
    this.syncLandingPopupScrollLock();
  }

  protected closePreviewGuide(): void {
    this.previewGuideOpen = false;
    this.syncLandingPopupScrollLock();
  }

  protected featuredIdeaCards(): IdeaInfoCard[] {
    const published = this.publishedIdeaCards();
    const featured = published.filter(card => this.ideaCardDetail(card)?.featured === true);
    return (featured.length > 0 ? featured : published).slice(0, 8);
  }

  protected publishedIdeaCards(): IdeaInfoCard[] {
    return [...(this.ideaCards ?? [])]
      .map(card => this.asIdeaInfoCard(card))
      .filter(card => {
        const detail = this.ideaCardDetail(card);
        return Boolean(detail);
      })
      .sort((left, right) => this.ideaSortValue(this.ideaCardDetail(right)) - this.ideaSortValue(this.ideaCardDetail(left)));
  }

  protected selectedIdeaDetail(): IdeaArticleDetailDto | null {
    const published = this.publishedIdeaCards()
      .map(card => this.ideaCardDetail(card))
      .filter((detail): detail is IdeaArticleDetailDto => Boolean(detail));
    return published.find(detail => detail.id === this.selectedIdeaId)
      ?? published[0]
      ?? null;
  }

  protected ideaCardDetail(card: InfoCardData | null | undefined): IdeaArticleDetailDto | null {
    const detail = card?.eagerDetail;
    return this.isIdeaArticleDetail(detail) ? detail : null;
  }

  protected openIdeasPopup(card?: InfoCardData, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const published = this.publishedIdeaCards();
    if (published.length === 0) {
      return;
    }
    if (card) {
      this.openIdeaArticlePopup(card, event);
      return;
    }
    this.selectedIdeaId = this.ideaCardDetail(published[0])?.id ?? '';
    this.ideasPopupOpen = true;
    this.syncLandingPopupScrollLock();
  }

  protected openIdeaArticlePopup(card: InfoCardData, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const detail = this.ideaCardDetail(card);
    if (!detail) {
      return;
    }
    this.selectedIdeaId = detail.id;
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

  protected entryFeaturedIdeaInfoCard(card: InfoCardData): InfoCardData {
    return {
      ...card,
      menuActions: [],
      menuTitle: null,
      clickable: false
    };
  }

  protected onFeaturedIdeaCardAction(card: InfoCardData, actionId: string): void {
    if (actionId !== 'viewArticle') {
      return;
    }
    this.openIdeaArticlePopup(card);
  }

  protected entryIdeaListInfoCard(
    card: InfoCardData,
    options: { groupLabel?: string | null; renderState?: SmartListItemRenderState | null } = {}
  ): InfoCardData {
    return {
      ...card,
      groupLabel: options.groupLabel ?? card.groupLabel ?? null,
      state: options.renderState === 'active' ? 'active' : options.renderState === 'leaving' ? 'leaving' : card.state ?? 'default',
      clickable: false
    };
  }

  protected ideaImageUrl(detail: IdeaArticleDetailDto | null): string {
    return `${detail?.imageUrl ?? ''}`.trim();
  }

  protected ideaDateLabel(detail: IdeaArticleDetailDto | null): string {
    return detail?.dateLabel?.trim() || 'Fresh article';
  }

  protected ideaArticlePopupModel(detail: IdeaArticleDetailDto): PopupModel {
    return {
      headerLabel: this.ideaDateLabel(detail),
      headerLabelIcon: 'calendar_today',
      title: detail.title,
      subtitle: detail.excerpt,
      ariaLabel: 'Article',
      closeAriaLabel: 'Close article',
      translateHeaderLabel: false,
      translateTitle: false,
      translateSubtitle: false,
      size: 'wide',
      height: 'full',
      headerLayout: 'article',
      bodyLayout: 'flush',
      onClose: () => this.closeIdeaArticlePopup()
    };
  }

  protected ideasPopupModel(): PopupModel {
    const articleCount = this.publishedIdeaCards().length;
    return {
      title: 'MyScoutee articles',
      subtitle: `${articleCount} ${articleCount === 1 ? 'article' : 'articles'}`,
      ariaLabel: 'MyScoutee articles',
      closeAriaLabel: 'Close articles',
      translateSubtitle: false,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      onClose: () => this.closeIdeasPopup()
    };
  }

  protected scrollEntryTo(sectionId: string, event?: Event): void {
    event?.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private updateFeaturedIdeaSmartListFilters(): void {
    this.featuredIdeaSmartListFilters = {
      signature: this.featuredIdeaCards()
        .map(card => this.ideaCardDetail(card)?.id ?? card.id ?? '')
        .join('|')
    };
  }

  private featuredIdeaPageResult(query: ListQuery): PageResult<IdeaInfoCard> {
    const cards = this.featuredIdeaCards();
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || Number(this.entryFeaturedIdeaSmartListConfig.pageSize) || 8));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    const items = cards.slice(start, start + pageSize);
    return {
      items,
      total: cards.length,
      nextCursor: start + items.length < cards.length ? `${start + items.length}` : null
    };
  }

  private asIdeaInfoCard(card: InfoCardData): IdeaInfoCard {
    return card as IdeaInfoCard;
  }

  private isIdeaArticleDetail(value: unknown): value is IdeaArticleDetailDto {
    return Boolean(value)
      && typeof value === 'object'
      && typeof (value as { id?: unknown }).id === 'string'
      && typeof (value as { title?: unknown }).title === 'string'
      && typeof (value as { contentHtml?: unknown }).contentHtml === 'string';
  }

  private ideaSortValue(detail: IdeaArticleDetailDto | null): number {
    const parsed = Date.parse(detail?.sortAtIso ?? '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private ideaDayGroupLabel(detail: IdeaArticleDetailDto | null): string {
    const parsed = Date.parse(detail?.sortAtIso ?? '');
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

  private syncLandingPopupScrollLock(): void {
    const shouldLock = this.previewGuideOpen || this.ideasPopupOpen || this.ideaArticlePopupOpen;
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

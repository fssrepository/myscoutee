import * as FeedbackContracts from '../../../core/contracts/feedback/feedback.interface';
import { FeedbackService } from '../../../core/base/services/feedback/feedback.service';
import {
  UiDateUtils,
  FormFlowComponent,
  IndicatorComponent,
  LazyBgImageDirective,
  type FormFlowSaveEvent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  InfoCardComponent,
  PopupComponent,
  SmartListComponent,
  type InfoCardData,
  type CardMenuActionEvent,
  type CardMenuAction,
  type ListQuery,
  type PageResult,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  type SmartListConfig,
  type SmartListLoadPage,
  ExplanationGuideService,
  DialogStore,
  type DialogConfig
} from '@fssrepository/myscoutee-components';
import { FeedbackStore, type FeedbackCounterSnapshot } from '../../context/stores/feedback/feedback.store';
import { CampaignsStore } from '../../context/stores/activity/campaigns.store';
import { GroupWorkspaceContextService } from '../../../core/base/services/groups/group-workspace-context.service';
import {
  Component,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import {
  CommonModule
} from '@angular/common';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from
} from 'rxjs';

import { FeedbackFormFlowConverter, FeedbackFilterMenuConverter, FeedbackInfoCardConverter, FeedbackListPresentationConverter, FeedbackOrganizerCarouselSectionConverter, FeedbackOrganizerInfoCardConverter, FeedbackOrganizerItemConverter, FeedbackOrganizerMessageGroupConverter, type FeedbackFilterMenuContext, type FeedbackOrganizerCarouselSectionData, type FeedbackOrganizerItemData } from '../..';
import * as ActivityContracts from '../../../core/contracts/common/activity.interface';
import type { FeedbackListFilter } from '../../../core/common/constants';
import {
  EventsService
} from '../../../core/base';

import { UserProfileStore } from '../../context/stores/profile/user-profile.store';
import { AppRuntimeStore } from '../../context/stores/app/app-runtime.store';
import { MemberMenuStore } from '../../context/stores/app/member-menu.store';
import { ActivitiesPopupStore } from '../../context/stores/activity/activities-popup.store';

type FeedbackStackedPopupMode = 'feedbackCounts' | 'feedbackNote' | 'organizerFeedback' | null;

interface FeedbackListFilters {
  campaignId?: string | null;
  filter: FeedbackListFilter;
  userId: string;
}

type FeedbackMenuContext = FeedbackFilterMenuContext | {
  menu: 'info-card';
  card: InfoCardData;
  action: CardMenuAction;
};

type FeedbackDialogAction = 'remove' | 'restore';

interface FeedbackDialogContent extends Omit<DialogConfig, 'onConfirm' | 'onCancel'> {}

@Component({
  selector: 'app-feedback-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LazyBgImageDirective,
    MatIconModule,
    FormFlowComponent,
    IndicatorComponent,
    PopupComponent,
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './feedback-popup.component.html',
  styleUrl: './feedback-popup.component.scss'
})
export class FeedbackPopupComponent implements OnDestroy {
  private readonly feedbackService = inject(FeedbackService);
  private readonly feedbackStore = inject(FeedbackStore);
  private readonly campaigns = inject(CampaignsStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly activitiesPopupStore = inject(ActivitiesPopupStore);
  private readonly eventsService = inject(EventsService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly dialogStore = inject(DialogStore);
  private unregisterExplanationContext: (() => void) | null = null;
  private explanationContextActive = false;
  private lastHandledNavigatorFeedbackRequestMs = 0;
  private lastAppliedFeedbackSubmitUpdatedMs = 0;
  private feedbackRealtimeContextKey = '';
  private feedbackPendingCounter: number | null | undefined;
  private feedbackRealtimeCounters: FeedbackCounterSnapshot | undefined;
  private feedbackRealtimeRefreshInFlight = false;
  private feedbackRealtimeRefreshQueued = false;
  protected readonly isPopupOpen = this.feedbackStore.listOpen;
  protected readonly isStackedPopupOpen = signal(false);
  protected readonly stackedPopupMode = signal<FeedbackStackedPopupMode>(null);
  protected readonly feedbackListFilter = signal<FeedbackListFilter>('pending');
  protected readonly feedbackListSubmitMessage = signal('');
  protected readonly selectedFeedbackEventId = signal<string | null>(null);
  protected readonly selectedOrganizerFeedbackEventId = signal<string | null>(null);
  protected readonly organizerFeedbackStatDto = signal<FeedbackContracts.FeedbackStatDto | null>(null);
  protected readonly organizerFeedbackStatLoading = signal(false);
  protected readonly feedbackNoteForm = signal({ eventId: '', text: '' });
  protected readonly feedbackNoteSubmitted = signal(false);
  protected readonly feedbackNoteSubmitMessage = signal('');
  protected readonly feedbackNoteSaving = signal(false);
  private readonly feedbackPageResult = signal<FeedbackContracts.FeedbackPageResultDto | null>(null);
  protected readonly feedbackDetailDto = signal<FeedbackContracts.FeedbackDetailDto | null>(null);
  protected readonly feedbackDetailValue = signal<FeedbackContracts.FeedbackDetailDto>(
    new FeedbackContracts.FeedbackDetailDto()
  );
  protected readonly feedbackDetailLoading = signal(false);
  protected readonly feedbackSubmitting = signal(false);
  protected readonly feedbackSubmitMessage = signal('');
  protected readonly feedbackSubmitted = signal(false);
  protected readonly hasFeedbackCards = computed(() => (this.feedbackDetailDto()?.cards.length ?? 0) > 0);
  private readonly feedbackFilterCountDelta = signal<Partial<Record<FeedbackListFilter, number>>>({});
  private organizerFeedbackStatRequestKey = '';

  protected readonly feedbackFilterMenu = computed(() => FeedbackFilterMenuConverter.convert({
    result: this.feedbackPageResult(),
    activeFilter: this.feedbackListFilter(),
    counts: this.campaigns.feedbackCampaign() ? undefined : this.feedbackStore.counters(),
    delta: this.feedbackFilterCountDelta()
  }));
  protected readonly organizerFeedbackItems = computed<FeedbackOrganizerItemData[]>(() => {
    const result = this.feedbackPageResult();
    return result ? FeedbackOrganizerItemConverter.convertList(result.organizerItems, { result }) : [];
  });
  protected readonly selectedOrganizerFeedbackItem = computed<FeedbackOrganizerItemData | null>(() => {
    const eventId = this.selectedOrganizerFeedbackEventId()?.trim() ?? '';
    if (!eventId) {
      return null;
    }
    return this.organizerFeedbackItems().find(item => item.eventId === eventId) ?? null;
  });
  protected readonly selectedOrganizerFeedbackInfoCard = computed<InfoCardData | null>(() => {
    const item = this.selectedOrganizerFeedbackItem();
    return item ? FeedbackOrganizerInfoCardConverter.convert(item, { showAction: false }) : null;
  });
  protected readonly organizerFeedbackMessageGroups = computed(() =>
    FeedbackOrganizerMessageGroupConverter.convert({
      result: this.feedbackPageResult(),
      eventId: this.selectedOrganizerFeedbackEventId() ?? ''
    })
  );
  protected readonly organizerFeedbackCarouselIndex = signal(0);
  protected readonly organizerFeedbackCarouselSections = computed<FeedbackOrganizerCarouselSectionData[]>(() =>
    FeedbackOrganizerCarouselSectionConverter.convert({
      stat: this.organizerFeedbackStatDto()
    })
  );
  protected readonly organizerFeedbackActiveCarouselSection = computed<FeedbackOrganizerCarouselSectionData | null>(() => {
    const sections = this.organizerFeedbackCarouselSections();
    if (sections.length === 0) {
      return null;
    }
    return sections[this.organizerFeedbackCarouselIndex()] ?? sections[0] ?? null;
  });

  protected feedbackSmartListQuery: Partial<ListQuery<FeedbackListFilters>> = {
    filters: {
      filter: 'pending',
      userId: ''
    }
  };

  @ViewChild('feedbackSmartList')
  private feedbackSmartList?: SmartListComponent<InfoCardData, FeedbackListFilters>;

  protected readonly feedbackSmartListLoadPage: SmartListLoadPage<
    InfoCardData,
    FeedbackListFilters
  > = (query) => from(this.loadFeedbackPage(query));

  protected readonly feedbackSmartListConfig: SmartListConfig<
    InfoCardData,
    FeedbackListFilters
  > = {
    pageSize: 12,
    defaultView: 'list',
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isDataSourceAvailable() ? 'active' : 'inactive'
    },
    emptyLabel: 'feedback.list.title',
    emptyDescription: (query) => FeedbackListPresentationConverter.convert({
      result: this.feedbackPageResult(),
      filter: query.filters?.filter ?? 'pending'
    }).emptyDescription,
    showStickyHeader: true,
    groupBy: (item, query) => FeedbackInfoCardConverter.serviceItem(item)
      ? UiDateUtils.weekdayMonthDayYearLabel(new Date(item.dateIso!))
      : FeedbackListPresentationConverter.convert({
      result: this.feedbackPageResult(),
      itemId: item.id,
      filter: query.filters?.filter ?? this.feedbackListFilter()
    }).groupLabel,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    stickyHeaderClass: 'feedback-sticky-header',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'feedback-event-list': true
    },
    trackBy: (_index, item) => item.id
  };

  protected feedbackPopupModel(): PopupModel<FeedbackMenuContext> {
    return {
      title: 'feedback.list.title',
      subtitle: this.campaigns.feedbackCampaign()?.title ?? '',
      onAction: event => { if (event.action.id === 'campaign-filter') void this.campaigns.open(c => this.campaigns.feedbackCampaign.set(c), this.campaigns.feedbackCampaign()?.id); },
      ariaLabel: 'feedback.list.title',
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.feedbackPopupHeaderControls(),
      onClose: event => this.closePopup(event),
      onMenuSelect: event => this.onFeedbackPopupMenuSelect(event)
    };
  }

  protected feedbackPopupZIndex(): number {
    return 12500;
  }

  protected feedbackStackedPopupModel(): PopupModel<FeedbackMenuContext> {
    const isFullHeight = this.stackedPopupMode() === 'feedbackCounts'
      || this.stackedPopupMode() === 'organizerFeedback';
    return {
      title: this.feedbackStackedPopupTitle(),
      subtitle: this.feedbackStackedPopupSubtitle(),
      ariaLabel: this.feedbackStackedPopupTitle(),
      closeAriaLabel: 'Close',
      size: isFullHeight ? 'wide' : 'default',
      height: isFullHeight ? 'full' : 'auto',
      headerTone: 'accent',
      bodyLayout: isFullHeight ? 'fill' : 'default',
      backdropTone: 'dim',
      onClose: event => this.closeStackedPopup(event)
    };
  }

  protected feedbackStackedPopupZIndex(): number {
    return 12600;
  }

  private feedbackPopupHeaderControls(): PopupControl<FeedbackMenuContext>[] {
    const filterMenu = this.feedbackFilterMenu();
    return [...(this.workspace.isWork() ? [{ id: 'campaign-filter', icon: 'campaign', ariaLabel: 'campaign.select', palette: 'blue' as const,
      counter: this.campaigns.feedbackCampaign() ? 1 : 0, active: !!this.campaigns.feedbackCampaign() }] : []), {
      kind: 'menu',
      id: 'feedback-filter',
      trigger: filterMenu.trigger,
      items: filterMenu.items as readonly AppMenuItem<string, FeedbackMenuContext>[],
      mobileBreakpointPx: 900
    }];
  }

  private feedbackStackedPopupTitle(): string {
    switch (this.stackedPopupMode()) {
      case 'feedbackCounts':
        return 'feedback.list.title';
      case 'organizerFeedback':
        return 'Own Feedback';
      default:
        return 'Organizer Feedback';
    }
  }

  private feedbackStackedPopupSubtitle(): string | null {
    if (this.stackedPopupMode() !== 'feedbackCounts' && this.stackedPopupMode() !== 'organizerFeedback') {
      return null;
    }
    return this.feedbackCurrentEventTitle();
  }

  private onFeedbackPopupMenuSelect(event: PopupMenuSelectEvent<FeedbackMenuContext>): void {
    this.onFeedbackMenuSelect(event.itemSelect);
  }

  protected onFeedbackMenuSelect(event: AppMenuItemSelectEvent<string, FeedbackMenuContext>): void {
    if (event.context?.menu !== 'filter') {
      return;
    }
    this.selectFeedbackListFilter(event.context.filter, event.sourceEvent);
  }

  protected onFeedbackDispatchedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as FeedbackMenuContext | undefined;
    if (context?.menu !== 'info-card') {
      return;
    }
    this.onFeedbackCardMenuAction(context.card, {
      id: context.card.id,
      actionId: context.action.id,
      action: context.action,
      card: context.card
    });
  }

  constructor() {
    effect(() => {
      const changed = this.feedbackStore.changed();
      if (changed?.userId === this.activeUserId() && this.isPopupOpen()) untracked(() => this.queueFeedbackRealtimeRefresh());
    });
    effect(() => {
      this.setExplanationContext(this.isPopupOpen());
    });

    effect(() => {
      const request = this.memberMenuStore.navigatorFeedbackRequest();
      if (!request || request.updatedMs <= this.lastHandledNavigatorFeedbackRequestMs) {
        return;
      }
      this.lastHandledNavigatorFeedbackRequestMs = request.updatedMs;
      this.memberMenuStore.clearNavigatorFeedbackRequest();
      this.openPopup();
    });

    effect(() => {
      const filter = this.feedbackListFilter();
      const userId = this.userProfileStore.activeUserId().trim();
      const campaignId = this.campaigns.feedbackCampaign()?.id ?? null;
      const currentFilters = this.feedbackSmartListQuery.filters;
      if (currentFilters?.campaignId === campaignId && currentFilters?.filter === filter && currentFilters?.userId === userId) {
        return;
      }

      this.feedbackSmartListQuery = {
        filters: {
          filter,
          campaignId,
          userId
        }
      };
    });

    effect(() => {
      const selectedEventId = this.selectedOrganizerFeedbackEventId();
      const stackedMode = this.stackedPopupMode();
      if (stackedMode !== 'organizerFeedback' || !selectedEventId) {
        return;
      }
      this.organizerFeedbackCarouselIndex.set(0);
    });

    effect(() => {
      const sections = this.organizerFeedbackCarouselSections();
      const currentIndex = this.organizerFeedbackCarouselIndex();
      if (sections.length === 0) {
        if (currentIndex !== 0) {
          this.organizerFeedbackCarouselIndex.set(0);
        }
        return;
      }
      if (currentIndex >= sections.length) {
        this.organizerFeedbackCarouselIndex.set(sections.length - 1);
      }
    });

    effect(() => {
      const isOpen = this.isPopupOpen();
      const userId = this.activeUserId();
      const counters = this.feedbackStore.counters();
      const pending = counters.attention;
      const contextKey = `${isOpen ? 'open' : 'closed'}:${userId}`;
      const pendingChanged = this.feedbackPendingCounter !== pending;
      this.feedbackPendingCounter = pending;
      if (contextKey !== this.feedbackRealtimeContextKey) {
        this.feedbackRealtimeContextKey = contextKey;
        this.feedbackRealtimeCounters = counters;
        return;
      }
      if (!isOpen || !userId || (counters === this.feedbackRealtimeCounters && !pendingChanged)) {
        this.feedbackRealtimeCounters = counters;
        return;
      }
      this.feedbackRealtimeCounters = counters;
      this.queueFeedbackRealtimeRefresh();
    });

    effect(() => {
      const sync = this.feedbackStore.submitted();
      if (!sync || sync.updatedMs <= this.lastAppliedFeedbackSubmitUpdatedMs) {
        return;
      }
      this.lastAppliedFeedbackSubmitUpdatedMs = sync.updatedMs;
      this.applyActivityFeedbackSubmitSync(sync.dto);
    });
  }

  ngOnDestroy(): void {
    this.clearExplanationContext();
  }

  private queueFeedbackRealtimeRefresh(): void {
    if (!this.isPopupOpen()) {
      return;
    }
    if (this.feedbackRealtimeRefreshInFlight) {
      this.feedbackRealtimeRefreshQueued = true;
      return;
    }
    const smartList = this.feedbackSmartList;
    if (!smartList) {
      return;
    }
    this.feedbackRealtimeRefreshInFlight = true;
    void smartList.refreshVisibleItems()
      .catch(() => undefined)
      .finally(() => {
        this.feedbackRealtimeRefreshInFlight = false;
        if (!this.feedbackRealtimeRefreshQueued) {
          return;
        }
        this.feedbackRealtimeRefreshQueued = false;
        this.queueFeedbackRealtimeRefresh();
      });
  }

  protected openPopup(): void {
    this.feedbackListFilter.set('pending');
    this.feedbackListSubmitMessage.set('');
    this.selectedFeedbackEventId.set(null);
    this.selectedOrganizerFeedbackEventId.set(null);
    this.clearOrganizerFeedbackStat();
    this.feedbackPageResult.set(null);
    this.feedbackFilterCountDelta.set({});
    this.isPopupOpen.set(true);
  }

  private setExplanationContext(isOpen: boolean): void {
    if (this.explanationContextActive === isOpen) {
      return;
    }
    this.clearExplanationContext();
    if (isOpen) {
      this.explanationContextActive = true;
      this.unregisterExplanationContext = this.explanationGuide.registerContext('feedback');
    }
  }

  private clearExplanationContext(): void {
    this.unregisterExplanationContext?.();
    this.unregisterExplanationContext = null;
    this.explanationContextActive = false;
  }

  protected closePopup(event?: Event): void {
    event?.stopPropagation();
    this.isPopupOpen.set(false);
  }

  protected closeStackedPopup(event?: Event): void {
    event?.stopPropagation();
    this.isStackedPopupOpen.set(false);
    this.stackedPopupMode.set(null);
    this.selectedOrganizerFeedbackEventId.set(null);
    this.clearOrganizerFeedbackStat();
  }

  private selectFeedbackListFilter(filter: FeedbackListFilter, event?: Event): void {
    event?.stopPropagation();
    this.feedbackListFilter.set(filter);
    this.selectedOrganizerFeedbackEventId.set(null);
    this.clearOrganizerFeedbackStat();
  }

  protected feedbackCurrentEventTitle(): string {
    const eventId =
      this.selectedOrganizerFeedbackEventId()
      ?? this.selectedFeedbackEventId()
      ?? this.feedbackNoteForm().eventId;
    return this.feedbackPageResult()?.eventTitleById(eventId) ?? 'this event';
  }

  private openFeedbackDetail(item: FeedbackContracts.FeedbackDto, event?: Event): void {
    event?.stopPropagation();
    this.selectedFeedbackEventId.set(item.eventId);
    this.stackedPopupMode.set('feedbackCounts');
    this.isStackedPopupOpen.set(true);
  }

  private isFeedbackDetailLoadCurrent(eventId: string): boolean {
    return this.selectedFeedbackEventId() === eventId.trim()
      && this.stackedPopupMode() === 'feedbackCounts';
  }

  private completeEmptyFeedbackDetail(title: string): void {
    this.feedbackListSubmitMessage.set(`${title} is already in Feedbacked.`);
    this.feedbackListFilter.set('feedbacked');
    this.closeStackedPopup();
  }

  private openFeedbackNotePopup(item: FeedbackContracts.FeedbackDto, event?: Event): void {
    event?.stopPropagation();
    this.selectedFeedbackEventId.set(item.eventId);
    this.feedbackNoteForm.set({
      eventId: item.eventId,
      text: this.feedbackPageResult()?.state.organizerNotesByEventId[item.eventId]?.trim() ?? ''
    });
    this.feedbackNoteSubmitted.set(false);
    this.feedbackNoteSubmitMessage.set('');
    this.stackedPopupMode.set('feedbackNote');
    this.isStackedPopupOpen.set(true);
  }

  protected canSubmitFeedbackNote(): boolean {
    return !this.feedbackNoteSaving() && this.feedbackNoteForm().text.trim().length >= 8;
  }

  private applyFeedbackNoteSubmitted(): void {
    if (this.feedbackNoteForm().text.trim().length < 8) {
      return;
    }
    const noteForm = this.feedbackNoteForm();
    const eventId = noteForm.eventId.trim();
    const trimmedText = noteForm.text.trim();
    this.feedbackPageResult.update(result => result?.patchOrganizerNote(eventId, trimmedText) ?? null);
    this.feedbackNoteSubmitted.set(true);
    const message = `Organizer feedback saved for ${this.feedbackCurrentEventTitle()}.`;
    this.feedbackNoteSubmitMessage.set(message);
    this.feedbackListSubmitMessage.set(message);
  }

  private patchFeedbackItem(
    before: FeedbackContracts.FeedbackDto,
    after: FeedbackContracts.FeedbackDto
  ): void {
    const pageResult = this.feedbackPageResult();
    const delta = pageResult?.filterCountDelta(before, after) ?? {};
    this.feedbackFilterCountDelta.update(current => ({
      ...current,
      'own-events': (current['own-events'] ?? 0) + (delta['own-events'] ?? 0),
      pending: (current.pending ?? 0) + (delta.pending ?? 0),
      feedbacked: (current.feedbacked ?? 0) + (delta.feedbacked ?? 0),
      removed: (current.removed ?? 0) + (delta.removed ?? 0)
    }));
    this.feedbackPageResult.set(pageResult?.patchItem(after) ?? null);
    this.feedbackStore.applyCounterDelta(delta);
    this.feedbackPendingCounter = this.feedbackStore.counters().attention;
    this.feedbackRealtimeCounters = this.feedbackStore.counters();
  }

  private applyFeedbackItemRemoved(item: FeedbackContracts.FeedbackDto): void {
    const pageResult = this.feedbackPageResult();
    this.patchFeedbackItem(item, pageResult?.removeItem(item) ?? item);
    this.feedbackListSubmitMessage.set(`${item.title} moved to Removed without feedback.`);
  }

  private applyFeedbackItemRestored(item: FeedbackContracts.FeedbackDto): void {
    const pageResult = this.feedbackPageResult();
    this.patchFeedbackItem(item, pageResult?.restoreItem(item) ?? item);
    this.feedbackListSubmitMessage.set(`${item.title} moved back to Pending.`);
  }

  protected onFeedbackCardPrimaryAction(card: InfoCardData): void {
    const service = FeedbackInfoCardConverter.serviceItem(card);
    if (service) { void this.feedbackStore.openDetail(service.item, service.received); return; }
    const item = this.feedbackPageResult()?.itemById(card.id) ?? null;
    if (!item) {
      return;
    }
    if (item.isOwnEvent) {
      this.openOrganizerFeedback(item.eventId);
      return;
    }
    if (!(this.feedbackPageResult()?.itemMatchesFilter(item, 'pending') ?? false)) {
      return;
    }
    void this.startFeedback(item);
  }

  protected onFeedbackCardMenuAction(card: InfoCardData, event: CardMenuActionEvent<InfoCardData>): void {
    const service = FeedbackInfoCardConverter.serviceItem(card);
    if (service) {
      if (!service.received && (event.actionId === 'removeFeedback' || event.actionId === 'restoreFeedback')) {
        const action = event.actionId === 'removeFeedback' ? 'remove' : 'restore';
        this.openFeedbackDialog(this.feedbackDialogContent(action), () => this.feedbackStore.action(service.item, { action }));
      } else { void this.feedbackStore.openDetail(service.item, service.received); }
      return;
    }
    const item = this.feedbackPageResult()?.itemById(card.id) ?? null;
    if (!item) {
      return;
    }
    if (item.isOwnEvent) {
      return;
    }
    if (event.actionId === 'startFeedback') {
      void this.startFeedback(item);
      return;
    }
    if (event.actionId === 'removeFeedback') {
      this.openRemoveFeedbackDialog(item);
      return;
    }
    if (event.actionId === 'restoreFeedback') {
      this.openRestoreFeedbackDialog(item);
      return;
    }
    if (event.actionId === 'viewSubmittedFeedback') {
      void this.openSubmittedFeedback(item);
      return;
    }
    this.openFeedbackNotePopup(item);
  }

  private async openSubmittedFeedback(item: FeedbackContracts.FeedbackDto): Promise<void> {
    if (!item.isFeedbacked) {
      return;
    }
    await this.activitiesPopupStore.ensureFeedbackRatedDetailPopupLoaded();
    this.activitiesPopupStore.openFeedbackRatedDetail({
      userId: this.activeUserId(),
      eventId: item.eventId,
      eventTitle: item.title
    });
  }

  private openRemoveFeedbackDialog(item: FeedbackContracts.FeedbackDto): void {
    this.openFeedbackDialog(
      this.feedbackDialogContent('remove'),
      async () => {
        await this.feedbackService.remove(this.activeUserId(), item.eventId);
        this.applyFeedbackItemRemoved(item);
        this.removeVisibleFeedbackItem(item.eventId);
      }
    );
  }

  private openRestoreFeedbackDialog(item: FeedbackContracts.FeedbackDto): void {
    this.openFeedbackDialog(
      this.feedbackDialogContent('restore'),
      async () => {
        await this.feedbackService.restore(this.activeUserId(), item.eventId);
        this.applyFeedbackItemRestored(item);
        this.removeVisibleFeedbackItem(item.eventId);
      }
    );
  }

  private openFeedbackDialog(
    content: FeedbackDialogContent,
    onConfirm: () => Promise<void>
  ): void {
    this.dialogStore.open({
      ...content,
      onConfirm
    });
  }

  private feedbackDialogContent(
    action: FeedbackDialogAction
  ): FeedbackDialogContent {
    if (action === 'remove') {
      return {
        title: 'feedback.confirm.remove.title',
        message: 'feedback.confirm.remove.message',
        warningMessage: 'feedback.confirm.remove.warning',
        confirmLabel: 'remove',
        busyConfirmLabel: 'removing',
        confirmTone: 'danger',
        failureMessage: 'feedback.confirm.remove.failure'
      };
    }
    return {
      title: 'feedback.confirm.restore.title',
      message: 'feedback.confirm.restore.message',
      confirmLabel: 'restore.feedback',
      busyConfirmLabel: 'restoring',
      confirmTone: 'accent',
      failureMessage: 'feedback.confirm.restore.failure'
    };
  }

  private removeVisibleFeedbackItem(eventId: string): void {
    const smartList = this.feedbackSmartList;
    const normalizedEventId = eventId.trim();
    if (!smartList || !normalizedEventId) {
      return;
    }
    const currentItems = [...smartList.itemsSnapshot()];
    const nextItems = currentItems.filter(item => item.id !== normalizedEventId);
    if (nextItems.length === currentItems.length) {
      return;
    }
    smartList.replaceVisibleItems(nextItems, {
      total: Math.max(nextItems.length, smartList.totalItemCount() - 1)
    });
  }

  private async loadFeedbackPage(
    query: ListQuery<FeedbackListFilters>
  ): Promise<PageResult<InfoCardData>> {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const filter = query.filters?.filter ?? this.feedbackListFilter();
    const normalizedUserId = (query.filters?.userId?.trim() || this.activeUserId()).trim();
    if (!normalizedUserId) {
      this.feedbackPageResult.set(null);
      return { items: [], total: 0 };
    }
    const request = { userId: normalizedUserId, campaignId: query.filters?.campaignId, filter, page, pageSize };
    const result = await this.feedbackService.loadPage(request);
    if (this.activeUserId() !== normalizedUserId || this.feedbackListFilter() !== filter) {
      return { items: [], total: 0 };
    }
    const pageResult = new FeedbackContracts.FeedbackPageResultDto(result);
    this.feedbackPageResult.set(pageResult);
    if (!request.campaignId) {
      this.feedbackStore.applyPageCounters(normalizedUserId, pageResult.counts, pageResult.evaluationCounts);
      this.feedbackPendingCounter = this.feedbackStore.counters().attention;
      this.feedbackRealtimeCounters = this.feedbackStore.counters();
    }
    this.feedbackFilterCountDelta.set({});
    return {
      items: [
        ...FeedbackInfoCardConverter.convertList(pageResult.items, { state: pageResult.state }),
        ...pageResult.evaluations.map(item => FeedbackInfoCardConverter.convertService(item, filter === 'own-events'))
      ],
      total: result.total
    };
  }

  private activeUserId(): string {
    return this.userProfileStore.activeUserProfile()?.id?.trim() || this.userProfileStore.activeUserId().trim();
  }

  private async startFeedback(item: FeedbackContracts.FeedbackDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!(this.feedbackPageResult()?.itemMatchesFilter(item, 'pending') ?? false)) {
      return;
    }
    const userId = this.activeUserId();
    const eventId = item.eventId.trim();
    this.openFeedbackDetail(item);
    this.clearLoadedFeedbackDetail(eventId);
    this.feedbackDetailLoading.set(true);
    this.feedbackSubmitting.set(false);
    this.feedbackSubmitted.set(false);
    this.feedbackSubmitMessage.set('');
    if (!userId || !eventId) {
      this.applyLoadedFeedbackDetail(new FeedbackContracts.FeedbackDetailDto({
        eventId,
        title: item.title,
        cards: []
      }), item.title);
      this.feedbackDetailLoading.set(false);
      return;
    }
    try {
      const detail = await this.feedbackService.loadDetail({ userId, eventId });
      this.applyLoadedFeedbackDetail(detail, item.title);
    } finally {
      if (this.isFeedbackDetailLoadCurrent(eventId)) {
        this.feedbackDetailLoading.set(false);
      }
    }
  }

  protected readonly feedbackFlowModel = computed(() => FeedbackFormFlowConverter.convert(
    this.feedbackDetailDto(),
    { eventTitle: this.feedbackCurrentEventTitle() }
  ));

  protected async onFeedbackFlowSave(event: FormFlowSaveEvent): Promise<void> {
    if (this.feedbackSubmitted() || this.feedbackSubmitting()) {
      return;
    }
    const submittedAtIso = new Date().toISOString();
    const feedback = new FeedbackContracts.FeedbackDetailDto(
      this.feedbackDetailDto()
    ).withFormValue(event.value).submitted({ submittedAtIso });
    if (!feedback.eventId || feedback.cards.length === 0) {
      return;
    }
    this.feedbackDetailValue.set(feedback);
    this.feedbackSubmitting.set(true);
    try {
      const persisted = await this.feedbackService.submit(this.activeUserId(), feedback);
      this.feedbackStore.emitSubmitted(persisted);
      this.feedbackSubmitted.set(true);
      this.feedbackSubmitMessage.set(`Feedback submitted successfully for ${this.feedbackCurrentEventTitle()}.`);
      this.clearLoadedFeedbackDetail(persisted.eventId);
    } catch {
      this.feedbackSubmitMessage.set('Feedback could not be saved. Please try again.');
    } finally {
      this.feedbackSubmitting.set(false);
    }
  }

  private applyLoadedFeedbackDetail(
    detail: FeedbackContracts.FeedbackDetailDto,
    fallbackTitle: string
  ): void {
    if (!this.isFeedbackDetailLoadCurrent(detail.eventId)) {
      return;
    }
    const pendingDetail = detail.pending({
      activeUserId: this.activeUserId(),
      fallbackTitle
    });
    if (pendingDetail.cards.length === 0) {
      this.clearLoadedFeedbackDetail(pendingDetail.eventId);
      this.completeEmptyFeedbackDetail(fallbackTitle);
      return;
    }
    this.feedbackDetailDto.set(pendingDetail);
    this.feedbackDetailValue.set(pendingDetail.withEmptyAnswers());
  }

  private clearLoadedFeedbackDetail(eventId = ''): void {
    this.feedbackDetailDto.set(null);
    this.feedbackDetailValue.set(new FeedbackContracts.FeedbackDetailDto({ eventId }));
    this.feedbackSubmitting.set(false);
  }

  private applyActivityFeedbackSubmitSync(dto: FeedbackContracts.FeedbackDetailDto): void {
    const eventId = dto.eventId.trim();
    if (!eventId) {
      return;
    }
    const pageResult = this.feedbackPageResult();
    const sourceItem = pageResult?.itemById(eventId) ?? null;
    if (!pageResult || !sourceItem || sourceItem.isOwnEvent) {
      return;
    }
    const nextItem = pageResult.applySubmitToItem(sourceItem, dto);
    this.patchFeedbackItem(sourceItem, nextItem);
    if (!this.feedbackSmartList) {
      return;
    }
    const currentItems = [...this.feedbackSmartList.itemsSnapshot()];
    const currentIndex = currentItems.findIndex(item => item.id === eventId);
    if (currentIndex < 0) {
      return;
    }
    const nextItems = [...currentItems];
    if (!pageResult.itemMatchesFilter(nextItem, this.feedbackListFilter())) {
      nextItems.splice(currentIndex, 1);
      this.feedbackSmartList.replaceVisibleItems(nextItems, {
        total: Math.max(nextItems.length, this.feedbackSmartList.totalItemCount() - 1)
      });
      return;
    }
    nextItems[currentIndex] = FeedbackInfoCardConverter.convert(nextItem, {
      state: this.feedbackPageResult()?.state ?? null
    });
    this.feedbackSmartList.replaceVisibleItems(nextItems, {
      total: this.feedbackSmartList.totalItemCount()
    });
  }

  protected async submitFeedbackNote(): Promise<void> {
    if (!this.canSubmitFeedbackNote()) {
      return;
    }
    const userId = this.activeUserId();
    const noteForm = this.feedbackNoteForm();
    const eventId = noteForm.eventId.trim();
    const text = noteForm.text.trim();
    if (!userId || !eventId) {
      return;
    }
    this.feedbackNoteSaving.set(true);
    this.feedbackNoteSubmitMessage.set('');
    try {
      await this.feedbackService.saveNote({ userId, eventId, text });
      this.applyFeedbackNoteSubmitted();
    } catch {
      this.feedbackNoteSubmitMessage.set('The note could not be saved. Please try again.');
    } finally {
      this.feedbackNoteSaving.set(false);
    }
  }

  protected openOrganizerFeedback(eventId: string): void {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return;
    }
    this.feedbackListFilter.set('own-events');
    this.selectedOrganizerFeedbackEventId.set(normalizedEventId);
    this.clearOrganizerFeedbackStat();
    this.stackedPopupMode.set('organizerFeedback');
    this.isStackedPopupOpen.set(true);
    void this.loadOrganizerFeedbackStat(normalizedEventId);
  }

  private async loadOrganizerFeedbackStat(eventId: string): Promise<void> {
    const normalizedEventId = eventId.trim();
    const userId = this.activeUserId();
    const requestKey = `${userId}::${normalizedEventId}`;
    this.organizerFeedbackStatRequestKey = requestKey;
    this.organizerFeedbackStatDto.set(null);
    if (!userId || !normalizedEventId) {
      this.organizerFeedbackStatLoading.set(false);
      return;
    }
    this.organizerFeedbackStatLoading.set(true);
    try {
      const stat = await this.feedbackService.loadStatistics({
        userId,
        eventId: normalizedEventId
      });
      if (this.isOrganizerFeedbackStatLoadCurrent(requestKey, normalizedEventId)) {
        this.organizerFeedbackStatDto.set(stat);
      }
    } finally {
      if (this.isOrganizerFeedbackStatLoadCurrent(requestKey, normalizedEventId)) {
        this.organizerFeedbackStatLoading.set(false);
      }
    }
  }

  private isOrganizerFeedbackStatLoadCurrent(requestKey: string, eventId: string): boolean {
    return this.organizerFeedbackStatRequestKey === requestKey
      && this.selectedOrganizerFeedbackEventId() === eventId.trim()
      && this.stackedPopupMode() === 'organizerFeedback';
  }

  private clearOrganizerFeedbackStat(): void {
    this.organizerFeedbackStatRequestKey = '';
    this.organizerFeedbackStatDto.set(null);
    this.organizerFeedbackStatLoading.set(false);
  }

  protected selectOrganizerFeedbackCarousel(index: number): void {
    const sections = this.organizerFeedbackCarouselSections();
    if (index < 0 || index >= sections.length) {
      return;
    }
    this.organizerFeedbackCarouselIndex.set(index);
  }

}

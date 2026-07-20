import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  OnDestroy,
  HostListener,
  effect,
  signal
} from '@angular/core';
import {
  CommonModule
} from '@angular/common';
import {
  FormsModule
} from '@angular/forms';
import {
  MatButtonModule
} from '@angular/material/button';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  MatFormFieldModule
} from '@angular/material/form-field';
import {
  MatInputModule
} from '@angular/material/input';
import {
  Subscription
} from 'rxjs';
import {
  ActivitiesPopupStore
} from '../../../shared/ui/context/stores/activities-popup.store';
import {
  EventEditorPopupStore,
  type EventEditorCheckoutSurfaceTone
} from '../../../shared/ui/context/stores/event-editor-popup.store';
import {
  EventCheckoutDraftStore,
  type EventCheckoutDraft
} from '../../../shared/ui/context/stores/event-checkout-draft.store';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import { environment } from '../../../../environments/environment';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  PricingBuilder
} from '../../../shared/core/base/builders';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  ActivityMembersService,
  EventsService,
  ExplanationGuideService,
  RouteDelayService
} from '../../../shared/core';
import {
  ActivityEventDetailDTO
} from '../../../shared/core/contracts/activity.interface';
import {
  AppMenuComponent,
  buildTabbedMenuModel,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  DateInputComponent,
  type DateInputModel,
  ImageCarouselComponent,
  SlotsInputComponent,
  type SlotsInputConfig,
  type SlotOverrideRequest,
  LocationInputComponent,
  type LocationInputConfig,
  PricingEditorInputComponent,
  PoliciesInputComponent,
  type PricingEditorConfig,
  type PricingEditorRuntimePreview,
  IndicatorComponent,
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../shared/ui';
import {
  EventBasketInputComponent,
  type EventBasketInputItem,
  type EventBasketInputItemMenuEvent,
  type EventBasketInputPricingSummaryRow
} from './event-basket-input';
import {
  EventPaymentInputComponent,
  type EventPaymentInputItem
} from './event-payment-input';
import {
  EventSubeventDefinitionsPanelComponent
} from '../event-subevent-definitions-panel';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

import type * as AppConstants from '../../../shared/core/common/constants';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
type EventEditorMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'event-intel'; action: 'toggle-blind-mode' | 'toggle-auto-inviter' | 'toggle-ticketing' | 'toggle-approval-required' }
  | { menu: 'topics'; topic: string }
  | { menu: 'checkout-draft'; sourceId: string }
  | { menu: 'checkout-review-action'; actionId: string }
  | { menu: 'save' };

interface SlotOverrideEditorState {
  slot: ContractTypes.EventSlotTemplateDTO;
  slotIndex: number;
  selectedStartAt: string;
  definitions: ActivityContracts.SubEventDefinitionDTO[];
  page: number;
}

@Component({
  selector: 'app-event-editor-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    AppMenuComponent,
    DateInputComponent,
    EventBasketInputComponent,
    EventPaymentInputComponent,
    ImageCarouselComponent,
    PoliciesInputComponent,
    SlotsInputComponent,
    LocationInputComponent,
    EventSubeventDefinitionsPanelComponent,
    PricingEditorInputComponent,
    IndicatorComponent,
    PopupComponent
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  private static readonly EVENTS_ROUTE = '/activities/events';
  protected readonly eventEditorStore = inject(EventEditorPopupStore);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly eventsService = inject(EventsService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventCheckoutDraftStore = inject(EventCheckoutDraftStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly routeDelay = inject(RouteDelayService);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private editorTarget: ContractTypes.EventEditorTarget = 'events';
  protected editingEventId: string | null = null;
  private draftEventId: string | null = null;
  private currentSourcePublished = false;
  private publishedCapacityMaxFloor = 0;
  private currentMemberSummary: ActivityContracts.ActivityMembersSummaryDto | null = null;
  private lastHandledActivityMembersSyncMs = 0;
  private pricingSlotCatalogCacheKey = '';
  private pricingSlotCatalogCache: ContractTypes.PricingSlotReference[] = [];
  private checkoutReviewFooterSourceItems: readonly AppMenuItem<string>[] | null = null;
  private checkoutReviewFooterMappedItems: readonly AppMenuItem<string, EventEditorMenuContext>[] = [];
  private eventEditorExplanationContextKey: string | null = null;
  private unregisterEventEditorExplanationContext: (() => void) | null = null;
  private eventDetailLoadSequence = 0;
  private eventImageUrlsCacheKey = '';
  private eventImageUrlsCache: string[] = [];
  protected readonly isLoadingEventData = signal(false);
  protected readonly eventVisibilityReady = signal(false);

  constructor() {
    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventEditorCreate' && request.type !== 'eventEditor')) {
        return;
      }
      this.memberMenuStore.clearActivitiesNavigationRequest();
      if (request.type === 'eventEditorCreate') {
        this.openCreateRequest(request.target);
        return;
      }
      void this.openEditRequest(request.eventId, request.target, request.readOnly);
    });

    effect(() => {
      const sourceEvent: any = this.eventEditorStore.sourceEvent();
      const isOpen = this.eventEditorStore.isOpen();
      const mode = this.eventEditorStore.mode();
      this.setEventEditorExplanationContext(isOpen ? 'event.editor' : null);

      if (!isOpen) {
        this.slotOverrideEditor = null;
        return;
      }

      if (sourceEvent) {
        this.populateFormFromSourceEvent(sourceEvent);
        return;
      }

      if (mode === 'create' && this.draftEventId && this.eventDetailDTO.id === this.draftEventId && this.eventDetailDTO.dateRange.startAt) {
        return;
      }

      if (mode === 'edit') {
        return;
      }

      this.resetForm(this.editorTarget);
    });

    effect(() => {
      const sync = this.activityStore.activityMembersSync();
      const isOpen = this.eventEditorStore.isOpen();
      if (!isOpen || !sync || sync.updatedMs <= this.lastHandledActivityMembersSyncMs) {
        return;
      }
      this.lastHandledActivityMembersSyncMs = sync.updatedMs;
      const eventId = this.currentEventIdentity();
      if (!eventId || sync.id !== eventId) {
        return;
      }
      const summary = this.activityMembersService.peekSummaryByOwnerId(sync.id);
      this.currentMemberSummary = summary ?? {
        ownerType: 'event',
        ownerId: sync.id,
        acceptedMembers: Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0)),
        capacityTotal: Math.max(
          Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
          Math.max(0, Math.trunc(Number(sync.capacityTotal) || 0))
        ),
        acceptedMemberUserIds: [],
        pendingMemberUserIds: []
      };
    });

  }

  ngOnInit(): void {
    this.openSubscription = this.eventEditorStore.onOpen$.subscribe(() => {
      this.slotOverrideEditor = null;
    });

    this.closeSubscription = this.eventEditorStore.onClose$.subscribe(() => {
      this.slotOverrideEditor = null;
      this.eventDetailLoadSequence += 1;
      this.isLoadingEventData.set(false);
      this.resetEditorContext();
    });
  }

  ngOnDestroy(): void {
    this.openSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
    this.clearEventEditorExplanationContext();
  }

  eventDetailDTO: ActivityEventDetailDTO = this.createEmptyEventDetailDTO();

  protected slotOverrideEditor: SlotOverrideEditorState | null = null;
  isSavePending = false;

  readonly visibilityOptions: AppConstants.EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];
  readonly slotFrequencyOptions = ['Custom', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

  protected readonly eventPricingEditorConfig: PricingEditorConfig = {
    context: 'event',
    presentation: 'popup-summary',
    slotCatalog: () => this.pricingSlotCatalog(),
    visible: () => this.checkoutPricingPanelVisibility(),
    runtimePreview: () => this.checkoutPricingRuntimePreview()
  };

  protected readonly slotsInputConfig: SlotsInputConfig = {
    startAtIso: () => this.eventDetailDTO.dateRange.startAt,
    endAtIso: () => this.eventDetailDTO.dateRange.endAt,
    frequency: () => this.eventDetailDTO.frequency,
    frequencyOptions: () => this.slotFrequencyOptions,
    frequencyChange: frequency => this.onEventFrequencyChange(frequency),
    enabled: () => this.eventDetailDTO.slotsEnabled,
    enabledChange: enabled => this.onEventSlotsEnabledChange(enabled),
    generated: () => this.isGeneratedSlotInstance()
  };

  protected get eventDateInputModel(): DateInputModel {
    return {
      mode: 'range',
      precision: 'minute',
      range: {
        start: { label: 'Start' },
        end: { label: 'End' },
        allowEndBeforeStart: true
      },
      readOnly: this.eventStructureReadOnly()
    };
  }

  protected readonly eventLocationInputConfig: LocationInputConfig = {
    label: 'Location',
    placeholder: 'Event route location',
    routeStops: () => this.eventLocationRouteStops(),
    mapMode: 'auto',
    mapAriaLabel: 'Open event route on map'
  };

  close(): void {
    this.isSavePending = false;
    this.eventDetailLoadSequence += 1;
    this.isLoadingEventData.set(false);
    this.eventVisibilityReady.set(false);
    this.clearEventEditorExplanationContext();
    const checkoutReviewClose = this.checkoutReviewMode()
      ? this.eventEditorStore.presentation().onClose
      : null;
    this.eventEditorStore.close();
    checkoutReviewClose?.();
  }

  getPopupTitle(): string {
    const presentationTitle = `${this.eventEditorStore.presentation().title ?? ''}`.trim();
    if (presentationTitle) {
      return presentationTitle;
    }
    const mode = this.eventEditorStore.mode();
    const readOnly = this.eventEditorStore.readOnly();

    if (mode === 'create') {
      return 'Create Event';
    }
    if (readOnly) {
      return 'View Event';
    }
    if (this.isPublishedManageMode()) {
      return 'Manage Event';
    }
    return 'Edit Event';
  }

  protected eventEditorPopupModel(): PopupModel<EventEditorMenuContext> {
    const title = this.getPopupTitle();
    return {
      title,
      subtitle: this.eventEditorPopupSubtitle(),
      ariaLabel: title,
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.eventEditorPopupHeaderControls(),
      onClose: () => this.close(),
      onMenuSelect: event => this.onEventEditorMenuSelect(event.itemSelect)
    };
  }

  protected eventEditorPopupZIndex(): number {
    return this.checkoutReviewMode() ? 4700 : 2500;
  }

  private eventEditorPopupSubtitle(): string | null {
    const presentationSubtitle = `${this.eventEditorStore.presentation().subtitle ?? ''}`.trim();
    if (presentationSubtitle) {
      return presentationSubtitle;
    }
    return this.eventEditorStore.readOnly() && this.eventDetailDTO.title
      ? this.eventDetailDTO.title
      : null;
  }

  private eventEditorPopupHeaderControls(): readonly PopupControl<EventEditorMenuContext>[] {
    const controls: PopupControl<EventEditorMenuContext>[] = [];
    if (this.eventVisibilityReady() && !this.eventEditorBodyLoading()) {
      controls.push({
        kind: 'menu',
        id: 'event-editor-visibility',
        menuKind: 'select',
        trigger: this.eventVisibilityMenuTrigger(),
        items: this.eventVisibilityMenuItems(),
        mobileBreakpointPx: 900
      });
    }
    const checkoutDraft = this.eventEditorCheckoutDraft();
    if (this.checkoutReviewMode()) {
      return controls;
    }
    if (this.showEventEditorSaveAction()) {
      controls.push({
        kind: 'menu',
        id: 'event-editor-save',
        menuKind: 'inline',
        items: this.eventEditorSaveMenuItems(),
        closeOnSelect: false
      });
    }
    if (checkoutDraft) {
      controls.push({
        kind: 'menu',
        id: 'event-editor-checkout-status',
        menuKind: 'inline',
        items: this.eventEditorCheckoutStatusMenuItems(checkoutDraft)
      });
    }
    return controls;
  }

  protected isPublishedManageMode(): boolean {
    return this.eventEditorStore.mode() === 'edit'
      && !this.eventEditorStore.readOnly()
      && this.currentSourcePublished;
  }

  protected eventStructureReadOnly(): boolean {
    return this.eventEditorStore.readOnly() || this.isPublishedManageMode();
  }

  protected checkoutReviewMode(): boolean {
    return this.eventEditorStore.presentation().mode === 'checkout-review';
  }

  protected checkoutPaymentPhase(): boolean {
    return this.checkoutReviewMode() && this.eventEditorStore.presentation().checkoutPhase === 'payment';
  }

  protected showCheckoutPaymentPanel(): boolean {
    return this.checkoutPaymentPhase() && this.eventEditorStore.presentation().hidePaymentPanel !== true;
  }

  protected eventEditorBodyLoading(): boolean {
    return this.isLoadingEventData()
      || this.resolvePresentationValue(this.eventEditorStore.presentation().loading, false) === true;
  }

  protected showSubEventDefinitionsPanel(): boolean {
    return this.eventEditorStore.presentation().hideSubEventsPanel !== true;
  }

  protected showSlotsInput(): boolean {
    return this.eventEditorStore.presentation().hideSlotsPanel !== true;
  }

  protected showCheckoutBasketInput(): boolean {
    if (!this.checkoutReviewMode()) {
      return false;
    }
    const configured = this.resolvePresentationValue(this.eventEditorStore.presentation().showBasketPanel, null);
    if (configured !== null && configured !== undefined) {
      return configured === true;
    }
    return this.eventDetailDTO.slotsEnabled === true;
  }

  protected checkoutPricingPanelVisibility(): boolean | null {
    if (!this.checkoutReviewMode()) {
      return null;
    }
    const configured = this.resolvePresentationValue(this.eventEditorStore.presentation().showPricingPanel, null);
    return configured === null || configured === undefined ? null : configured === true;
  }

  protected checkoutBasketInputItems(): readonly EventBasketInputItem[] {
    const items = this.resolvePresentationValue(this.eventEditorStore.presentation().basketItems, []);
    return (items ?? []).map(item => ({
      id: item.id,
      title: item.title,
      meta: item.meta,
      detail: item.detail ?? null,
      amount: Number(item.amount) || 0,
      currency: item.currency || this.checkoutBasketCurrency(),
      quantity: item.quantity ?? 1,
      status: item.status ?? null,
      pricingSummaryRows: (item.pricingSummaryRows ?? []).map(row => ({ ...row }))
    }));
  }

  protected checkoutPaymentInputItems(): readonly EventPaymentInputItem[] {
    return this.checkoutBasketInputItems().map(item => ({
      id: item.id,
      title: item.title,
      meta: item.meta,
      detail: item.detail ?? null,
      amount: item.amount,
      currency: item.currency,
      quantity: item.quantity ?? 1
    }));
  }

  protected checkoutBasketTone(): EventEditorCheckoutSurfaceTone {
    const configured = this.resolvePresentationValue(this.eventEditorStore.presentation().basketTone, null);
    return configured ?? 'neutral';
  }

  protected checkoutPaymentTone(): EventEditorCheckoutSurfaceTone {
    const configured = this.resolvePresentationValue(this.eventEditorStore.presentation().paymentTone, null);
    return configured ?? 'payment';
  }

  protected checkoutPaymentEventTimeframe(): string {
    return `${this.eventDetailDTO.timeframe ?? ''}`.trim()
      || this.formatCheckoutDateRange(this.eventDetailDTO.dateRange.startAt, this.eventDetailDTO.dateRange.endAt);
  }

  protected checkoutPaymentIntegrationEnabled(): boolean {
    return environment.paymentIntegrationEnabled;
  }

  private formatCheckoutDateRange(startAtIso: string | null | undefined, endAtIso: string | null | undefined): string {
    const start = AppUtils.isoLocalDateTimeToDate(`${startAtIso ?? ''}`.trim());
    const end = AppUtils.isoLocalDateTimeToDate(`${endAtIso ?? ''}`.trim());
    if (!start && !end) {
      return '';
    }
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    if (start && end) {
      const sameDate = start.getFullYear() === end.getFullYear()
        && start.getMonth() === end.getMonth()
        && start.getDate() === end.getDate();
      return sameDate
        ? `${dateFormatter.format(start)} · ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`
        : `${dateFormatter.format(start)}, ${timeFormatter.format(start)} - ${dateFormatter.format(end)}, ${timeFormatter.format(end)}`;
    }
    const value = start ?? end;
    return value ? `${dateFormatter.format(value)} · ${timeFormatter.format(value)}` : '';
  }

  protected checkoutBasketPricingSummaryRows(): readonly EventBasketInputPricingSummaryRow[] {
    const rows = this.resolvePresentationValue(this.eventEditorStore.presentation().basketPricingSummaryRows, []);
    return (rows ?? []).map(row => ({ ...row }));
  }

  protected checkoutBasketTotalAmount(): number {
    const configured = this.resolvePresentationValue(this.eventEditorStore.presentation().basketTotalAmount, null);
    if (Number.isFinite(configured)) {
      return Number(configured);
    }
    return this.checkoutBasketInputItems()
      .reduce((sum, item) => sum + ((Number(item.amount) || 0) * Math.max(1, Math.trunc(Number(item.quantity) || 1))), 0);
  }

  protected checkoutBasketCurrency(): string {
    const configured = this.resolvePresentationValue(this.eventEditorStore.presentation().basketCurrency, null);
    return `${configured ?? this.eventDetailDTO.pricing?.currency ?? 'USD'}`.trim() || 'USD';
  }

  protected checkoutPricingRuntimePreview(): PricingEditorRuntimePreview | null {
    if (!this.checkoutReviewMode()) {
      return null;
    }
    const items = this.checkoutBasketInputItems();
    return {
      rows: this.checkoutBasketPricingSummaryRows(),
      totalAmount: items.length > 0 ? this.checkoutBasketTotalAmount() : 0,
      currency: this.checkoutBasketCurrency(),
      emptyLabel: items.length === 0 ? 'No selected checkout items yet.' : null
    };
  }

  protected checkoutBasketAddDisabled(): boolean {
    return this.resolvePresentationValue(this.eventEditorStore.presentation().basketAddDisabled, false) === true;
  }

  protected onCheckoutBasketAdd(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    void this.eventEditorStore.presentation().onBasketAdd?.(event);
  }

  protected onCheckoutBasketItemMenuSelect(event: EventBasketInputItemMenuEvent): void {
    const presentationItem = this.checkoutBasketInputItems().find(item => item.id === event.item.id) ?? event.item;
    void this.eventEditorStore.presentation().onBasketItemMenuSelect?.(
      presentationItem,
      event.menuEvent as AppMenuItemSelectEvent<string>
    );
  }

  protected checkoutReviewFooterMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const footerItems = this.eventEditorStore.presentation().footerItems ?? [];
    if (footerItems === this.checkoutReviewFooterSourceItems) {
      return this.checkoutReviewFooterMappedItems;
    }
    this.checkoutReviewFooterSourceItems = footerItems;
    this.checkoutReviewFooterMappedItems = footerItems.map(item => ({
      ...item,
      context: { menu: 'checkout-review-action', actionId: item.id }
    })) as readonly AppMenuItem<string, EventEditorMenuContext>[];
    return this.checkoutReviewFooterMappedItems;
  }

  protected checkoutReviewFooterMessage(): string {
    const message = this.eventEditorStore.presentation().footerMessage;
    const resolved = typeof message === 'function' ? message() : message;
    return `${resolved ?? ''}`.trim();
  }

  private resolvePresentationValue<TValue>(
    value: TValue | (() => TValue) | null | undefined,
    fallback: TValue
  ): TValue {
    if (typeof value === 'function') {
      return (value as () => TValue)();
    }
    return value ?? fallback;
  }

  protected eventPoliciesReadOnly(): boolean {
    return this.eventStructureReadOnly();
  }

  protected eventCapacityMinReadOnly(): boolean {
    return this.eventEditorStore.readOnly() || this.isPublishedManageMode();
  }

  protected eventCapacityMaxReadOnly(): boolean {
    return this.eventStructureReadOnly();
  }

  protected showEventEditorSaveAction(): boolean {
    return !this.isLoadingEventData() && !this.eventStructureReadOnly();
  }

  protected eventCapacityMaxMinimum(): number {
    const capacityMin = this.eventDetailDTO.capacityMin ?? 0;
    const publishedFloor = this.isPublishedManageMode() ? this.publishedCapacityMaxFloor : 0;
    return Math.max(0, capacityMin, publishedFloor);
  }

  protected pricingSlotCatalog(): readonly ContractTypes.PricingSlotReference[] {
    const normalizedSlots = ActivityEventDetailDTO.normalizeSlotTemplates(this.eventDetailDTO.slotTemplates);
    const nextKey = normalizedSlots
      .map(item => [item.id, item.startAt, item.overrideDate ?? '', item.closed === true ? '1' : '0'].join(':'))
      .join('|');
    if (nextKey !== this.pricingSlotCatalogCacheKey) {
      this.pricingSlotCatalogCacheKey = nextKey;
      this.pricingSlotCatalogCache = PricingBuilder.slotCatalogFromEventSlotTemplates(normalizedSlots);
    }
    return this.pricingSlotCatalogCache;
  }

  private createEmptyEventDetailDTO(): ActivityEventDetailDTO {
    return new ActivityEventDetailDTO().apply({
      id: '',
      userId: '',
      type: 'events',
      status: 'DR',
      statusBeforeSuppression: null,
      adminIds: [],
      avatar: '',
      title: '',
      subtitle: '',
      timeframe: '',
      inviter: null,
      unread: 0,
      activity: 0,
      trashedAtIso: null,
      creatorUserId: '',
      creatorName: '',
      creatorInitials: '',
      creatorCity: '',
      visibility: 'Public',
      blindMode: 'Open Event',
      dateRange: { startAt: '', endAt: '', precision: 'minute' },
      distanceKm: 0,
      imageUrl: '',
      sourceLink: '',
      location: '',
      locationCoordinates: null,
      capacityMin: 0,
      capacityMax: 0,
      capacityTotal: 0,
      autoInviter: false,
      frequency: 'One-time',
      ticketing: false,
      approvalRequired: false,
      pricing: PricingBuilder.createDefaultPricingConfig('event'),
      policiesEnabled: false,
      policies: [],
      slotsEnabled: false,
      slotTemplates: [],
      parentEventId: null,
      slotTemplateId: null,
      generated: false,
      eventType: 'main',
      nextSlot: null,
      upcomingSlots: [],
      acceptedMembers: 0,
      pendingMembers: 0,
      acceptedMemberUserIds: [],
      pendingMemberUserIds: [],
      invitedMemberUserIds: [],
      pendingRequestMemberUserIds: [],
      topics: [],
      subEventsEnabled: true,
      subEventDefinitions: [],
      subEvents: [],
      mode: 'Casual',
      rating: 0,
      boost: 0,
      affinity: 0,
      paymentSessionId: null
    });
  }

  private parseEventEditorDateValue(value: unknown): Date | null {
    return AppUtils.parseDate(value);
  }

  protected onEventDateRangeChange(value: {
    startAt?: string | null;
    endAt?: string | null;
    precision?: 'date' | 'minute' | null;
  } | null | undefined): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    const previous = this.eventDetailDTO.dateRange;
    const normalized = ActivityEventDetailDTO.normalizeDateRange({
      startAt: `${value?.startAt ?? previous.startAt ?? ''}`.trim(),
      endAt: `${value?.endAt ?? previous.endAt ?? ''}`.trim(),
      precision: value?.precision ?? previous.precision ?? 'minute'
    });
    const anchor = normalized.endAt !== previous.endAt && normalized.startAt === previous.startAt
      ? 'end'
      : 'start';
    this.applyEventDateRange(this.eventDateRangeWithMinimum(normalized, anchor));
  }

  protected onSubEventDefinitionsChange(value: readonly ActivityContracts.SubEventDefinitionDTO[] | null | undefined): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.subEventDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(value ?? []);
    this.normalizeEventDateRange('start');
  }

  private toNonNegativeIntegerOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  eventEditorFieldInvalid(field: 'title' | 'subtitle' | 'capacityMin' | 'capacityMax'): boolean {
    if (field === 'capacityMin' || field === 'capacityMax') {
      return this.eventDetailDTO[field] === null;
    }
    return !`${this.eventDetailDTO[field] ?? ''}`.trim();
  }

  canSaveEventDetailDTO(): boolean {
    if (this.eventStructureReadOnly()) {
      return false;
    }
    return Boolean(
      this.eventDetailDTO.title.trim()
      && this.eventDetailDTO.subtitle.trim()
      && this.eventDetailDTO.capacityMin !== null
      && this.eventDetailDTO.capacityMax !== null
      && this.eventDetailDTO.dateRange.startAt
      && this.eventDetailDTO.dateRange.endAt
    );
  }

  protected canConfigureSlotsSeries(): boolean {
    return !this.eventStructureReadOnly() && !this.isGeneratedSlotInstance();
  }

  protected isGeneratedSlotInstance(): boolean {
    return Boolean(this.eventDetailDTO.generated) || this.eventDetailDTO.eventType === 'slot';
  }

  saveEventDetailDTO(): void {
    if (!this.canSaveEventDetailDTO() || this.isSavePending) {
      return;
    }
    void this.runImmediateSave();
  }

  protected eventEditorSaveMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const canSave = this.canSaveEventDetailDTO();
    return [{
      id: 'event-editor-save',
      icon: 'done',
      kind: 'action',
      palette: canSave || this.isSavePending ? 'success' : 'danger',
      disabled: !canSave || this.isSavePending,
      ariaLabel: 'Save event',
      progress: this.isSavePending
        ? {
            state: 'loading',
            shape: 'circle'
          }
        : null,
      context: { menu: 'save' }
    }];
  }

  selectVisibility(option: AppConstants.EventVisibility, event?: Event): void {
    event?.stopPropagation();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.visibility = ActivityEventDetailDTO.normalizeVisibility(option);
  }

  protected eventVisibilityMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventDetailDTO.visibility,
      icon: this.getVisibilityIcon(this.eventDetailDTO.visibility),
      ariaLabel: 'Open visibility selector',
      palette: this.eventVisibilityPalette(this.eventDetailDTO.visibility),
      disabled: this.eventStructureReadOnly(),
      layout: 'pill'
    };
  }

  protected eventVisibilityMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    return this.visibilityOptions.map(option => ({
      id: `visibility-${option}`,
      label: option,
      icon: this.getVisibilityIcon(option),
      kind: 'radio',
      active: ActivityEventDetailDTO.normalizeVisibility(this.eventDetailDTO.visibility) === option,
      checked: ActivityEventDetailDTO.normalizeVisibility(this.eventDetailDTO.visibility) === option,
      palette: this.eventVisibilityPalette(option),
      surface: 'tinted',
      context: { menu: 'visibility', visibility: option }
    }));
  }

  protected eventIntelMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    return [
      {
        id: 'event-blind-mode',
        label: this.eventDetailDTO.blindMode,
        detail: this.eventBlindModeDescription(this.eventDetailDTO.blindMode),
        icon: this.eventBlindModeIcon(this.eventDetailDTO.blindMode),
        kind: 'toggle',
        layout: 'big',
        active: ActivityEventDetailDTO.normalizeBlindMode(this.eventDetailDTO.blindMode) === 'Blind Event',
        checked: ActivityEventDetailDTO.normalizeBlindMode(this.eventDetailDTO.blindMode) === 'Blind Event',
        palette: ActivityEventDetailDTO.normalizeBlindMode(this.eventDetailDTO.blindMode) === 'Blind Event' ? 'red' : 'green',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-blind-mode' }
      },
      {
        id: 'event-topics',
        label: 'Topics',
        icon: 'sell',
        kind: 'select-trigger',
        layout: 'big',
        active: this.eventDetailDTO.topics.length > 0,
        checked: this.eventDetailDTO.topics.length > 0,
        palette: 'violet',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        filterable: true,
        ariaLabel: 'Open topics',
        model: this.eventTopicsMenuModel()
      },
      {
        id: 'event-auto-inviter',
        label: this.eventAutoInviterLabel(this.eventDetailDTO.autoInviter),
        detail: this.eventAutoInviterDescription(this.eventDetailDTO.autoInviter),
        icon: this.eventAutoInviterIcon(this.eventDetailDTO.autoInviter),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDetailDTO.autoInviter,
        checked: this.eventDetailDTO.autoInviter,
        palette: this.eventDetailDTO.autoInviter ? 'cyan' : 'slate',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-auto-inviter' }
      },
      {
        id: 'event-ticketing',
        label: this.eventTicketingLabel(this.eventDetailDTO.ticketing),
        detail: this.eventTicketingDescription(this.eventDetailDTO.ticketing),
        icon: this.eventTicketingIcon(this.eventDetailDTO.ticketing),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDetailDTO.ticketing,
        checked: this.eventDetailDTO.ticketing,
        palette: this.eventDetailDTO.ticketing ? 'gold' : 'blue',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-ticketing' }
      },
      {
        id: 'event-approval-required',
        label: this.eventApprovalRequiredLabel(this.eventDetailDTO.approvalRequired),
        detail: this.eventApprovalRequiredDescription(this.eventDetailDTO.approvalRequired),
        icon: this.eventApprovalRequiredIcon(this.eventDetailDTO.approvalRequired),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDetailDTO.approvalRequired,
        checked: this.eventDetailDTO.approvalRequired,
        palette: this.eventDetailDTO.approvalRequired ? 'orange' : 'green',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-approval-required' }
      }
    ];
  }

  private eventTopicsMenuModel(): AppMenuModel<string, EventEditorMenuContext> {
    return buildTabbedMenuModel<string, EventEditorMenuContext>({
      idPrefix: 'event-topic',
      groups: this.interestOptionGroups,
      selected: this.eventDetailDTO.topics,
      maxSelected: 5,
      context: topic => ({ menu: 'topics', topic }),
      normalize: topic => ActivityEventDetailDTO.normalizeTopicToken(topic),
      itemLabel: topic => this.eventTopicLabel(topic),
      removeAriaLabel: topic => `Remove ${this.eventTopicLabel(topic)}`,
      summary: {
        emptyLabel: 'Select topics',
        maxLabels: 2,
        counter: 'overflow'
      }
    });
  }

  getVisibilityIcon(visibility: string): string {
    switch (ActivityEventDetailDTO.normalizeVisibility(visibility)) {
      case 'Friends only':
        return 'groups';
      case 'Invitation only':
        return 'mail_lock';
      default:
        return 'public';
    }
  }

  eventVisibilityClass(visibility: string): string {
    switch (ActivityEventDetailDTO.normalizeVisibility(visibility)) {
      case 'Friends only':
        return 'event-visibility-friends';
      case 'Invitation only':
        return 'event-visibility-invitation';
      default:
        return 'event-visibility-public';
    }
  }

  private eventVisibilityPalette(visibility: string): AppMenuPalette {
    switch (ActivityEventDetailDTO.normalizeVisibility(visibility)) {
      case 'Friends only':
        return 'blue';
      case 'Invitation only':
        return 'amber';
      default:
        return 'green';
    }
  }

  eventBlindModeIcon(mode: string): string {
    return ActivityEventDetailDTO.normalizeBlindMode(mode) === 'Blind Event' ? 'visibility_off' : 'visibility';
  }

  eventBlindModeDescription(mode: string): string {
    return ActivityEventDetailDTO.normalizeBlindMode(mode) === 'Blind Event'
      ? 'Attendees won\'t see each other before the event.'
      : 'Attendees can preview each other before the event.';
  }

  eventAutoInviterIcon(enabled: boolean): string {
    return enabled ? 'group_add' : 'person_off';
  }

  eventAutoInviterLabel(enabled: boolean): string {
    return enabled ? 'Auto Inviter On' : 'Auto Inviter Off';
  }

  eventAutoInviterDescription(enabled: boolean): string {
    return enabled
      ? 'Invites people by matching mutual preferences.'
      : 'Manual invites only.';
  }

  eventTicketingIcon(enabled: boolean): string {
    return enabled ? 'qr_code_scanner' : 'qr_code_2';
  }

  eventTicketingLabel(enabled: boolean): string {
    return enabled ? 'Ticketing On' : 'Ticketing Off';
  }

  eventTicketingDescription(enabled: boolean): string {
    return enabled
      ? 'QR attendee check-in is enabled.'
      : 'No QR check-in scanning.';
  }

  eventApprovalRequiredIcon(enabled: boolean): string {
    return enabled ? 'pending_actions' : 'event_available';
  }

  eventApprovalRequiredLabel(enabled: boolean): string {
    return enabled ? 'Auto approve Off' : 'Auto approve On';
  }

  eventApprovalRequiredDescription(enabled: boolean): string {
    return enabled
      ? 'Join requests wait for event admin approval.'
      : 'Confirmed bookings can continue without admin approval.';
  }

  protected eventEditorCheckoutDraft(): EventCheckoutDraft | null {
    this.eventCheckoutDraftStore.drafts();
    if (!this.eventEditorStore.readOnly()) {
      return null;
    }
    const eventId = this.currentEventIdentity();
    const activeUserId = this.activeUserId();
    if (!eventId || !activeUserId) {
      return null;
    }
    return this.eventCheckoutDraftStore.read(activeUserId, eventId);
  }

  protected eventEditorCheckoutStatusMenuItems(draft: EventCheckoutDraft): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const canContinue = this.eventEditorCanContinueCheckoutDraft(draft);
    return [{
      id: `checkout-draft-${draft.sourceId}`,
      label: this.eventEditorCheckoutStatusLabel(draft),
      icon: this.eventEditorCheckoutStatusIcon(draft),
      kind: 'action',
      layout: 'pill',
      active: true,
      disabled: !canContinue,
      palette: this.eventEditorCheckoutStatusPalette(draft),
      ariaLabel: canContinue
        ? `Continue checkout for ${draft.eventTitle}`
        : this.eventEditorCheckoutStatusLabel(draft),
      context: { menu: 'checkout-draft', sourceId: draft.sourceId }
    }];
  }

  protected onEventEditorMenuSelect(event: AppMenuItemSelectEvent<string, EventEditorMenuContext>): void {
    if (!event.context) {
      return;
    }
    if (event.context.menu === 'visibility') {
      this.selectVisibility(event.context.visibility, event.sourceEvent);
      return;
    }
    if (event.context.menu === 'checkout-draft') {
      this.continueEventEditorCheckoutDraft(event.context.sourceId, event.sourceEvent);
      return;
    }
    if (event.context.menu === 'checkout-review-action') {
      void this.eventEditorStore.presentation().onFooterItemSelect?.(
        event as unknown as AppMenuItemSelectEvent<string>
      );
      return;
    }
    if (event.context.menu === 'save') {
      this.saveEventDetailDTO();
      return;
    }
    if (event.context.menu === 'event-intel') {
      if (event.context.action === 'toggle-blind-mode') {
        this.toggleEventBlindMode(event.sourceEvent);
        return;
      }
      if (event.context.action === 'toggle-auto-inviter') {
        this.toggleEventAutoInviter(event.sourceEvent);
        return;
      }
      if (event.context.action === 'toggle-approval-required') {
        this.toggleEventApprovalRequired(event.sourceEvent);
        return;
      }
      this.toggleEventTicketing(event.sourceEvent);
      return;
    }
    if (event.context.menu === 'topics') {
      this.toggleEventTopic(event.context.topic, event.action);
    }
  }

  private toggleEventTopic(topic: string, action: AppMenuItemSelectEvent<string, EventEditorMenuContext>['action']): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    const normalizedTopics = ActivityEventDetailDTO.normalizeTopics(this.eventDetailDTO.topics);
    const normalizedTopic = ActivityEventDetailDTO.normalizeTopicToken(topic);
    if (!normalizedTopic) {
      return;
    }
    const existingIndex = normalizedTopics.findIndex(item =>
      ActivityEventDetailDTO.normalizeTopicToken(item) === normalizedTopic
    );
    if (action === 'remove') {
      if (existingIndex < 0) {
        return;
      }
      this.eventDetailDTO.topics = normalizedTopics.filter((_, index) => index !== existingIndex);
      return;
    }
    if (existingIndex >= 0) {
      this.eventDetailDTO.topics = normalizedTopics.filter((_, index) => index !== existingIndex);
      return;
    }
    if (normalizedTopics.length >= 5) {
      return;
    }
    this.eventDetailDTO.topics = ActivityEventDetailDTO.normalizeTopics([...normalizedTopics, topic]);
  }

  private eventEditorCanContinueCheckoutDraft(draft: EventCheckoutDraft): boolean {
    if (draft.checkoutSessionId?.trim()) {
      return true;
    }
    if (draft.pendingReason !== 'approval' && draft.pendingReason !== 'waitlist') {
      return true;
    }
    return this.resolveEventEditorCheckoutMemberStatus(draft.sourceId) === 'accepted';
  }

  private eventEditorCheckoutStatusLabel(draft: EventCheckoutDraft): string {
    if (this.eventEditorCanContinueCheckoutDraft(draft)) {
      return 'Folytatás';
    }
    return draft.pendingReason === 'waitlist'
      ? 'Helyre vár'
      : 'Jóváhagyásra vár';
  }

  private eventEditorCheckoutStatusIcon(draft: EventCheckoutDraft): string {
    if (this.eventEditorCanContinueCheckoutDraft(draft)) {
      return 'event_available';
    }
    return draft.pendingReason === 'waitlist'
      ? 'hourglass_empty'
      : 'pending_actions';
  }

  private eventEditorCheckoutStatusPalette(draft: EventCheckoutDraft): AppMenuPalette {
    if (this.eventEditorCanContinueCheckoutDraft(draft)) {
      return 'red';
    }
    return draft.pendingReason === 'waitlist' ? 'amber' : 'orange';
  }

  private resolveEventEditorCheckoutMemberStatus(sourceId: string): 'accepted' | 'pending' | 'none' {
    const activeUserId = this.activeUserId();
    const ownerId = sourceId.trim();
    if (!activeUserId || !ownerId) {
      return 'none';
    }
    const member = this.activityMembersService.peekMembersByOwner({
      ownerType: 'event',
      ownerId
    }).find(item => item.userId === activeUserId);
    return member?.status === 'accepted'
      ? 'accepted'
      : member?.status === 'pending'
        ? 'pending'
        : 'none';
  }

  private continueEventEditorCheckoutDraft(sourceId: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const draft = this.eventCheckoutDraftStore.read(this.activeUserId(), sourceId);
    if (!draft || !this.eventEditorCanContinueCheckoutDraft(draft)) {
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'eventCheckoutDraft',
      sourceId: draft.sourceId
    });
  }

  protected onEventFrequencyChange(value: string): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.frequency = ActivityEventDetailDTO.normalizeFrequency(value);
    this.eventDetailDTO.slotsEnabled = true;
    this.normalizeEventSlotTemplates();
  }

  protected onEventSlotsEnabledChange(enabled: boolean): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.slotsEnabled = enabled;
    if (!enabled) {
      this.eventDetailDTO.frequency = 'One-time';
      this.eventDetailDTO.slotTemplates = [];
      return;
    }
    if (ActivityEventDetailDTO.normalizeFrequency(this.eventDetailDTO.frequency) === 'One-time') {
      this.eventDetailDTO.frequency = 'Custom';
    }
    this.normalizeEventSlotTemplates();
  }

  protected openSlotOverrideEditor(request: SlotOverrideRequest): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    const candidates = this.slotOverrideOccurrenceCandidates(request.slot);
    const selected = candidates[0] ?? this.parseEventEditorDateValue(request.slot.startAt);
    if (!selected) {
      return;
    }
    const selectedStartAt = AppUtils.toIsoDateTimeLocal(selected);
    this.slotOverrideEditor = {
      slot: { ...request.slot },
      slotIndex: request.slotIndex,
      selectedStartAt,
      definitions: this.slotOverrideDefinitionsForStart(request.slot, selectedStartAt),
      page: 0
    };
  }

  protected closeSlotOverrideEditor(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.slotOverrideEditor = null;
  }

  protected slotOverridePopupModel(): PopupModel<unknown> {
    const title = this.slotOverridePopupTitle();
    return {
      title,
      subtitle: this.slotOverridePopupSubtitle(),
      ariaLabel: title,
      closeAriaLabel: 'Close override editor',
      closeOnBackdrop: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      toolbarMobileAlign: 'center',
      toolbarControls: this.slotOverrideToolbarControls(),
      onClose: event => this.closeSlotOverrideEditor(event),
      onMenuSelect: event => this.onSlotOverridePopupMenuSelect(event)
    };
  }

  private slotOverrideToolbarControls(): readonly PopupControl<unknown>[] {
    return [
      {
        kind: 'menu',
        id: 'slot-override-prev',
        align: 'end',
        menuKind: 'inline',
        items: this.slotOverridePrevPagerItems(),
        closeOnSelect: false
      },
      {
        kind: 'menu',
        id: 'slot-override-occurrence',
        align: 'end',
        menuKind: 'select',
        trigger: this.slotOverrideOccurrenceMenuTrigger(),
        items: this.slotOverrideOccurrenceMenuItems(),
        panelAlign: 'end'
      },
      {
        kind: 'menu',
        id: 'slot-override-next',
        align: 'end',
        menuKind: 'inline',
        items: this.slotOverrideNextPagerItems(),
        closeOnSelect: false
      }
    ];
  }

  private onSlotOverridePopupMenuSelect(event: PopupMenuSelectEvent<unknown>): void {
    if (event.control.id === 'slot-override-occurrence') {
      this.onSlotOverrideOccurrenceSelect(event.itemSelect);
      return;
    }
    if (event.control.id === 'slot-override-prev' || event.control.id === 'slot-override-next') {
      this.onSlotOverridePagerSelect(event.itemSelect);
    }
  }

  protected slotOverridePopupTitle(): string {
    const editor = this.slotOverrideEditor;
    return editor ? `Override ${this.slotOverrideSlotLabel(editor)}` : 'Override Slot';
  }

  protected slotOverridePopupSubtitle(): string {
    const editor = this.slotOverrideEditor;
    if (!editor) {
      return '';
    }
    return this.slotOverrideRuleBadgeLabel(editor);
  }

  protected slotOverrideOccurrenceMenuItems(): readonly AppMenuItem<string, unknown>[] {
    const editor = this.slotOverrideEditor;
    if (!editor) {
      return [];
    }
    return this.slotOverrideVisibleCandidates(editor).map(startAt => {
      const startAtIso = AppUtils.toIsoDateTimeLocal(startAt);
      return {
        id: startAtIso,
        label: this.slotOverrideSummaryLabel(startAtIso),
        icon: 'event_available',
        kind: 'radio',
        palette: startAtIso === editor.selectedStartAt ? 'violet' : 'blue',
        surface: 'tinted',
        active: startAtIso === editor.selectedStartAt,
        checked: startAtIso === editor.selectedStartAt
      };
    });
  }

  protected slotOverrideOccurrenceMenuTrigger(): AppMenuTrigger {
    const editor = this.slotOverrideEditor;
    return {
      label: editor ? this.slotOverrideSummaryLabel(editor.selectedStartAt) : 'Select slot date',
      icon: 'event_available',
      palette: 'violet',
      layout: 'field',
      disabled: !editor
    };
  }

  protected onSlotOverrideOccurrenceSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (!this.slotOverrideEditor) {
      return;
    }
    const selected = this.parseEventEditorDateValue(event.id);
    if (!selected) {
      return;
    }
    const selectedStartAt = AppUtils.toIsoDateTimeLocal(selected);
    this.slotOverrideEditor = {
      ...this.slotOverrideEditor,
      selectedStartAt,
      definitions: this.slotOverrideDefinitionsForStart(this.slotOverrideEditor.slot, selectedStartAt)
    };
  }

  protected slotOverridePrevPagerItems(): readonly AppMenuItem<string, unknown>[] {
    const editor = this.slotOverrideEditor;
    if (!editor) {
      return [];
    }
    return [
      {
        id: 'prev',
        icon: 'chevron_left',
        ariaLabel: 'Previous slot dates',
        palette: 'blue',
        disabled: editor.page <= 0
      }
    ];
  }

  protected slotOverrideNextPagerItems(): readonly AppMenuItem<string, unknown>[] {
    const editor = this.slotOverrideEditor;
    if (!editor) {
      return [];
    }
    const pageCount = this.slotOverridePageCount(editor);
    return [
      {
        id: 'next',
        icon: 'chevron_right',
        ariaLabel: 'Next slot dates',
        palette: 'blue',
        disabled: editor.page >= pageCount - 1
      }
    ];
  }

  protected onSlotOverridePagerSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (!this.slotOverrideEditor) {
      return;
    }
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    const pageCount = this.slotOverridePageCount(this.slotOverrideEditor);
    const delta = event.id === 'prev' ? -1 : event.id === 'next' ? 1 : 0;
    if (delta === 0) {
      return;
    }
    const page = Math.min(Math.max(this.slotOverrideEditor.page + delta, 0), Math.max(pageCount - 1, 0));
    const pageEditor = { ...this.slotOverrideEditor, page };
    const selected = this.slotOverrideVisibleCandidates(pageEditor)[0];
    const selectedStartAt = selected
      ? AppUtils.toIsoDateTimeLocal(selected)
      : this.slotOverrideEditor.selectedStartAt;
    this.slotOverrideEditor = {
      ...this.slotOverrideEditor,
      page,
      selectedStartAt,
      definitions: this.slotOverrideDefinitionsForStart(this.slotOverrideEditor.slot, selectedStartAt)
    };
  }

  protected onSlotOverrideDefinitionsChange(value: readonly ActivityContracts.SubEventDefinitionDTO[]): void {
    const editor = this.slotOverrideEditor;
    if (!editor || this.eventStructureReadOnly()) {
      return;
    }
    const definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(value);
    this.slotOverrideEditor = { ...editor, definitions };
    this.upsertSlotOverrideTemplate(editor, definitions);
  }

  protected onSubEventsEnabledChange(enabled: boolean): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.subEventsEnabled = enabled;
  }

  protected eventFrequencyUsesSlots(): boolean {
    return this.eventDetailDTO.slotsEnabled === true;
  }

  private slotOverrideSlotLabel(editor: SlotOverrideEditorState): string {
    return `Slot ${editor.slotIndex + 1}`;
  }

  private slotOverrideSummaryLabel(startAtIso: string): string {
    const startAt = this.parseEventEditorDateValue(startAtIso);
    if (!startAt) {
      return 'Slot date pending';
    }
    return startAt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private slotOverrideRuleBadgeLabel(editor: SlotOverrideEditorState): string {
    const startAt = this.parseEventEditorDateValue(editor.slot.startAt);
    if (!startAt) {
      return 'Slot rule pending';
    }
    const time = startAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    const fromDate = startAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    switch (ActivityEventDetailDTO.normalizeFrequency(this.eventDetailDTO.frequency)) {
      case 'Daily':
        return `Every day at ${time} from ${fromDate}`;
      case 'Weekly':
        return `Every ${this.slotOverrideWeekdayLabel(startAt)} at ${time} from ${fromDate}`;
      case 'Bi-weekly':
        return `Every second ${this.slotOverrideWeekdayLabel(startAt)} at ${time} from ${fromDate}`;
      case 'Monthly':
        return `Every month on day ${startAt.getDate()} at ${time} from ${fromDate}`;
      case 'Yearly':
        return `Every year on ${startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time} from ${fromDate}`;
      default:
        return `Custom at ${this.slotOverrideSummaryLabel(editor.slot.startAt)}`;
    }
  }

  private slotOverrideWeekdayLabel(value: Date): string {
    return value.toLocaleDateString('en-US', { weekday: 'long' });
  }

  private slotOverrideVisibleCandidates(editor: SlotOverrideEditorState): Date[] {
    const pageSize = 5;
    const start = Math.max(0, editor.page) * pageSize;
    return this.slotOverrideOccurrenceCandidates(editor.slot).slice(start, start + pageSize);
  }

  private slotOverridePageCount(editor: SlotOverrideEditorState): number {
    return Math.max(1, Math.ceil(this.slotOverrideOccurrenceCandidates(editor.slot).length / 5));
  }

  private slotOverrideOccurrenceCandidates(slot: ContractTypes.EventSlotTemplateDTO): Date[] {
    const parentStart = this.parseEventEditorDateValue(this.eventDetailDTO.dateRange.startAt);
    const parentEnd = this.parseEventEditorDateValue(this.eventDetailDTO.dateRange.endAt);
    const templateStart = this.parseEventEditorDateValue(slot.startAt);
    if (!parentStart || !parentEnd || !templateStart) {
      return [];
    }
    const frequency = ActivityEventDetailDTO.normalizeFrequency(this.eventDetailDTO.frequency);
    if (frequency === 'One-time' || frequency === 'Custom') {
      return templateStart.getTime() >= parentStart.getTime() && templateStart.getTime() <= parentEnd.getTime()
        ? [templateStart]
        : [];
    }

    const candidates: Date[] = [];
    let cursor = new Date(templateStart);
    let guard = 0;
    while (cursor.getTime() < parentStart.getTime() && guard < 500) {
      cursor = this.nextSlotOverrideOccurrenceDate(cursor, frequency);
      guard += 1;
    }
    while (cursor.getTime() <= parentEnd.getTime() && guard < 1000) {
      candidates.push(new Date(cursor));
      cursor = this.nextSlotOverrideOccurrenceDate(cursor, frequency);
      guard += 1;
    }
    return candidates;
  }

  private nextSlotOverrideOccurrenceDate(value: Date, frequency: string): Date {
    const next = new Date(value);
    switch (frequency) {
      case 'Daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'Weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'Bi-weekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'Monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'Yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1);
        break;
    }
    return next;
  }

  private slotOverrideDefinitionsForStart(
    slot: ContractTypes.EventSlotTemplateDTO,
    selectedStartAt: string
  ): ActivityContracts.SubEventDefinitionDTO[] {
    const existing = this.findSlotOverrideTemplate(slot, selectedStartAt);
    const source = existing?.subEventDefinitions?.length
      ? existing.subEventDefinitions
      : this.eventDetailDTO.subEventDefinitions;
    return ActivityEventDetailDTO.normalizeSubEventDefinitions(source ?? []);
  }

  private findSlotOverrideTemplate(
    slot: ContractTypes.EventSlotTemplateDTO,
    selectedStartAt: string
  ): ContractTypes.EventSlotTemplateDTO | null {
    const selectedDateKey = this.slotOverrideDateKey(selectedStartAt);
    if (!selectedDateKey) {
      return null;
    }
    const expectedId = this.slotOverrideTemplateId(slot, selectedDateKey);
    return this.eventDetailDTO.slotTemplates.find(item =>
      ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate) === selectedDateKey
      && (`${item.id ?? ''}`.trim() === expectedId || `${item.id ?? ''}`.trim() === `${slot.id ?? ''}`.trim())
    ) ?? null;
  }

  private upsertSlotOverrideTemplate(
    editor: SlotOverrideEditorState,
    definitions: readonly ActivityContracts.SubEventDefinitionDTO[]
  ): void {
    const selectedDateKey = this.slotOverrideDateKey(editor.selectedStartAt);
    if (!selectedDateKey) {
      return;
    }
    const selectedStart = this.parseEventEditorDateValue(editor.selectedStartAt);
    if (!selectedStart) {
      return;
    }
    const normalizedDefinitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(definitions);
    const overrideId = this.slotOverrideTemplateId(editor.slot, selectedDateKey);
    const overrideTemplate: ContractTypes.EventSlotTemplateDTO = {
      id: overrideId,
      startAt: AppUtils.toIsoDateTimeLocal(selectedStart),
      overrideDate: selectedDateKey,
      closed: false,
      subEventDefinitions: normalizedDefinitions
    };
    const slotId = `${editor.slot.id ?? ''}`.trim();
    this.eventDetailDTO.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates([
      ...this.eventDetailDTO.slotTemplates.filter(item => {
        const itemDateKey = ActivityEventDetailDTO.normalizeSlotOverrideDate(item.overrideDate);
        const itemId = `${item.id ?? ''}`.trim();
        return !(itemDateKey === selectedDateKey && (itemId === overrideId || itemId === slotId));
      }),
      overrideTemplate
    ]);
  }

  private slotOverrideTemplateId(slot: ContractTypes.EventSlotTemplateDTO, selectedDateKey: string): string {
    const slotId = `${slot.id ?? ''}`.trim() || 'slot';
    return `${slotId}-override-${selectedDateKey}`;
  }

  private slotOverrideDateKey(value: string): string {
    const parsed = this.parseEventEditorDateValue(value);
    if (!parsed) {
      return '';
    }
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  eventTopicLabel(topic: string): string {
    return `#${topic.replace(/^#+/, '')}`;
  }

  protected eventImageUrls(): string[] {
    const imageUrl = `${this.eventDetailDTO.imageUrl ?? ''}`.trim();
    if (this.eventImageUrlsCacheKey !== imageUrl) {
      this.eventImageUrlsCacheKey = imageUrl;
      this.eventImageUrlsCache = imageUrl ? [imageUrl] : [];
    }
    return this.eventImageUrlsCache;
  }

  protected onEventImageUrlsChange(imageUrls: readonly string[] | null | undefined): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    const imageUrl = `${imageUrls?.[0] ?? ''}`.trim();
    this.eventDetailDTO.imageUrl = imageUrl;
    this.eventImageUrlsCacheKey = imageUrl;
    this.eventImageUrlsCache = imageUrl ? [imageUrl] : [];
  }

  protected eventImageUploadOwnerId(): string {
    return this.activeUserId();
  }

  protected eventImageUploadEntityId(): string {
    return this.eventDetailDTO.id.trim()
      || this.editingEventId
      || this.draftEventId
      || 'event-draft';
  }

  onEventCapacityMinChange(value: number | string): void {
    if (this.eventCapacityMinReadOnly()) {
      return;
    }
    const parsed = this.toNonNegativeIntegerOrNull(value);
    this.eventDetailDTO.capacityMin = parsed;
    if (
      this.eventDetailDTO.capacityMin !== null
      && this.eventDetailDTO.capacityMax !== null
      && this.eventDetailDTO.capacityMax < this.eventDetailDTO.capacityMin
    ) {
      this.eventDetailDTO.capacityMax = this.eventDetailDTO.capacityMin;
    }
  }

  onEventCapacityMaxChange(value: number | string): void {
    if (this.eventCapacityMaxReadOnly()) {
      return;
    }
    const parsed = this.toNonNegativeIntegerOrNull(value);
    this.eventDetailDTO.capacityMax = parsed === null ? null : Math.max(parsed, this.eventCapacityMaxMinimum());
  }

  onEventCapacityMaxBlur(): void {
    if (this.eventCapacityMaxReadOnly()) {
      return;
    }
    if (this.eventDetailDTO.capacityMax !== null) {
      this.eventDetailDTO.capacityMax = Math.max(this.eventDetailDTO.capacityMax, this.eventCapacityMaxMinimum());
    }
    if (
      this.eventDetailDTO.capacityMin !== null
      && this.eventDetailDTO.capacityMax !== null
      && this.eventDetailDTO.capacityMax < this.eventDetailDTO.capacityMin
    ) {
      this.eventDetailDTO.capacityMax = this.eventDetailDTO.capacityMin;
    }
  }

  toggleEventBlindMode(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.blindMode = this.eventDetailDTO.blindMode === 'Blind Event' ? 'Open Event' : 'Blind Event';
  }

  toggleEventAutoInviter(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.autoInviter = !this.eventDetailDTO.autoInviter;
  }

  toggleEventTicketing(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.ticketing = !this.eventDetailDTO.ticketing;
  }

  toggleEventApprovalRequired(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.approvalRequired = !this.eventDetailDTO.approvalRequired;
  }

  onEventLocationChange(value: string): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.location = ActivityEventDetailDTO.normalizeLocation(value);
    this.syncFirstSubEventLocationFromMainEvent();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.eventEditorStore.isOpen() || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.close();
  }

  private openCreateRequest(target: ContractTypes.EventEditorTarget): void {
    this.resetEditorContext();
    this.editorTarget = target;
    this.draftEventId = this.buildCreatedEventEditorId(target);
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(this.draftEventId);
    this.resetForm(target);
    this.eventVisibilityReady.set(true);
    this.eventEditorStore.openCreate();
    void this.refreshCurrentMemberSummary(this.draftEventId);
  }

  private async openEditRequest(eventId: string, target: ContractTypes.EventEditorTarget, readOnly: boolean): Promise<void> {
    this.resetEditorContext();
    this.eventVisibilityReady.set(false);
    const loadSequence = ++this.eventDetailLoadSequence;
    const activeUserId = this.activeUserId();
    if (activeUserId) {
      this.isLoadingEventData.set(true);
    }

    this.editorTarget = target;
    this.editingEventId = eventId;
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(eventId);
    this.eventEditorStore.open('edit', undefined, readOnly);
    void this.refreshCurrentMemberSummary(eventId);

    if (!activeUserId) {
      return;
    }

    try {
      const eventDetailDTO = await this.routeDelay.withRequestTimeout(
        EventEditorPopupComponent.EVENTS_ROUTE,
        this.eventsService.loadEventDetailById(activeUserId, eventId),
        'Event editor load timed out.'
      );

      if (!this.isCurrentEventDetailLoad(loadSequence, eventId)) {
        return;
      }
      this.isLoadingEventData.set(false);
      if (!eventDetailDTO) {
        return;
      }

      this.editorTarget = this.eventDetailDTOBelongsToActiveAdmin(eventDetailDTO) ? 'hosting' : target;
      this.editingEventId = eventDetailDTO.id;
      this.openEventDetailDTO(eventDetailDTO, readOnly, this.editorTarget);
    } catch {
      if (this.isCurrentEventDetailLoad(loadSequence, eventId)) {
        this.isLoadingEventData.set(false);
      }
    }
  }

  private isCurrentEventDetailLoad(sequence: number, eventId: string): boolean {
    return this.eventDetailLoadSequence === sequence
      && this.eventEditorStore.isOpen()
      && this.editingEventId === eventId;
  }

  private openEventDetailDTO(eventDetailDTO: ActivityEventDetailDTO, readOnly: boolean, _target: ContractTypes.EventEditorTarget): void {
    if (readOnly) {
      this.eventEditorStore.openView(eventDetailDTO);
      return;
    }
    this.eventEditorStore.openEdit(eventDetailDTO);
  }

  private async persistEventDetailDTO(): Promise<boolean> {
    if (this.eventEditorStore.readOnly()) {
      return false;
    }

    this.normalizeEventDateRange('start');
    this.normalizeEventSlotTemplates();
    this.syncFirstSubEventLocationFromMainEvent();
    const normalizedCapacity = this.eventDetailDTO.normalizeCapacityRange();
    if (!this.canSaveEventDetailDTO()) {
      return false;
    }

    const eventId = this.eventDetailDTO.id.trim()
      || this.editingEventId
      || this.draftEventId
      || this.buildCreatedEventEditorId(this.editorTarget);
    this.eventDetailDTO.id = eventId;
    this.eventDetailDTO.imageUrl = this.normalizedEventImageUrl();
    const memberSummary = await this.resolveCurrentEventMembersSummary(eventId, normalizedCapacity);
    this.currentMemberSummary = memberSummary;
    this.eventDetailDTO.apply({
      id: eventId,
      acceptedMembers: memberSummary.acceptedMembers,
      pendingMembers: memberSummary.pendingMembers,
      capacityTotal: Math.max(memberSummary.acceptedMembers, memberSummary.capacityTotal)
    });

    const displaySync = await this.eventsService.saveActivityEvent(this.eventDetailDTO);
    if (!displaySync) {
      throw new Error('Event sync did not return an event DTO.');
    }
    const syncedEventId = `${displaySync.id ?? ''}`.trim();
    if (syncedEventId) {
      this.eventDetailDTO.id = syncedEventId;
      if (this.draftEventId === eventId) {
        this.draftEventId = syncedEventId;
      }
    }
    this.activitiesStore.emitActivityEventSaveResult(displaySync);
    return true;
  }

  private buildCreatedEventEditorId(target: ContractTypes.EventEditorTarget, timestampMs = Date.now()): string {
    return target === 'hosting' ? `h${timestampMs}` : `e${timestampMs}`;
  }

  private async runImmediateSave(): Promise<void> {
    this.isSavePending = true;
    try {
      const saved = await this.persistEventDetailDTO();
      if (!saved) {
        this.isSavePending = false;
        return;
      }
      this.isSavePending = false;
      this.eventEditorStore.close();
    } catch {
      this.isSavePending = false;
    }
  }

  private resetEditorContext(): void {
    this.editorTarget = 'events';
    this.editingEventId = null;
    this.draftEventId = null;
    this.currentSourcePublished = false;
    this.publishedCapacityMaxFloor = 0;
    this.currentMemberSummary = null;
    this.lastHandledActivityMembersSyncMs = 0;
    this.eventVisibilityReady.set(false);
  }

  private setEventEditorExplanationContext(contextKey: string | null): void {
    if (this.eventEditorExplanationContextKey === contextKey) {
      return;
    }
    this.clearEventEditorExplanationContext();
    if (!contextKey) {
      return;
    }
    this.eventEditorExplanationContextKey = contextKey;
    this.unregisterEventEditorExplanationContext = this.explanationGuide.registerContext(contextKey);
  }

  private clearEventEditorExplanationContext(): void {
    this.unregisterEventEditorExplanationContext?.();
    this.unregisterEventEditorExplanationContext = null;
    this.eventEditorExplanationContextKey = null;
  }

  private activeUserId(): string {
    return this.userProfileStore.activeUserId().trim() || this.userProfileStore.getActiveUserId().trim();
  }

  private eventDetailDTOBelongsToActiveAdmin(eventDetailDTO: ActivityEventDetailDTO): boolean {
    const activeUserId = this.activeUserId();
    return !!activeUserId && (eventDetailDTO.adminIds ?? []).includes(activeUserId);
  }

  private currentEventIdentity(): string {
    return this.eventDetailDTO.id.trim() || this.editingEventId || this.draftEventId || '';
  }

  private async refreshCurrentMemberSummary(ownerId: string | null | undefined): Promise<void> {
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    if (!normalizedOwnerId) {
      return;
    }
    const summary = await this.activityMembersService.querySummaryByOwnerId(normalizedOwnerId);
    if (this.currentEventIdentity() !== normalizedOwnerId || !this.eventEditorStore.isOpen()) {
      return;
    }
    this.currentMemberSummary = summary;
  }

  private async resolveCurrentEventMembersSummary(
    eventId: string,
    normalizedCapacity: ContractTypes.EventCapacityRange
  ): Promise<ActivityContracts.ActivityMembersSummaryDto> {
    const queriedSummary = eventId ? await this.activityMembersService.querySummaryByOwnerId(eventId) : null;
    const summary = queriedSummary ?? this.currentMemberSummary;
    const acceptedMembers = summary?.acceptedMembers ?? 0;
    const pendingMembers = summary?.pendingMembers ?? 0;
    const capacityFloor = Math.max(0, normalizedCapacity.max ?? normalizedCapacity.min ?? 0);
    const capacityTotal = Math.max(
      acceptedMembers,
      capacityFloor,
      summary?.capacityTotal ?? 0
    );
    return {
      ownerType: 'event',
      ownerId: eventId,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      acceptedMemberUserIds: [...(summary?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(summary?.pendingMemberUserIds ?? [])]
    };
  }

  private populateFormFromSourceEvent(sourceEvent: ActivityEventDetailDTO | Record<string, unknown>): void {
    if (!this.isActivityEventDetailDTO(sourceEvent)) {
      return;
    }
    const dto = sourceEvent instanceof ActivityEventDetailDTO
      ? sourceEvent.clone()
      : new ActivityEventDetailDTO().apply(sourceEvent as Partial<ActivityEventDetailDTO>);
    this.currentMemberSummary = {
      ownerType: 'event',
      ownerId: dto.id,
      acceptedMembers: dto.acceptedMembers,
      pendingMembers: dto.pendingMembers,
      capacityTotal: dto.capacityTotal,
      acceptedMemberUserIds: [...(dto.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(dto.pendingMemberUserIds ?? [])]
    };
    this.editingEventId = dto.id.trim() || this.editingEventId;
    this.currentSourcePublished = this.eventEditorStore.mode() === 'edit' && dto.status === 'A';
    this.publishedCapacityMaxFloor = Math.max(0, Number(dto.capacityMax ?? 0) || 0);
    this.eventDetailDTO = dto;
    this.eventDetailDTO.mode = dto.mode ?? 'Casual';
    this.normalizeEventDateRange('start');
    this.eventVisibilityReady.set(true);
  }

  private isActivityEventDetailDTO(sourceEvent: ActivityEventDetailDTO | Record<string, unknown>): sourceEvent is ActivityEventDetailDTO {
    return typeof sourceEvent['startAtIso'] === 'string'
      && typeof sourceEvent['endAtIso'] === 'string'
      && typeof sourceEvent['timeframe'] === 'string';
  }

  private resetForm(target: ContractTypes.EventEditorTarget = this.editorTarget): void {
    const start = new Date();
    const end = new Date(start.getTime() + (60 * 60 * 1000));
    const activeUserId = this.activeUserId();
    const activeUserProfile = activeUserId ? this.userProfileStore.getUserProfile(activeUserId) : null;

    this.currentSourcePublished = false;
    this.publishedCapacityMaxFloor = 0;
    this.eventDetailDTO = this.createEmptyEventDetailDTO().apply({
      id: this.draftEventId ?? '',
      userId: activeUserId,
      type: target,
      adminIds: activeUserId ? [activeUserId] : [],
      creatorUserId: activeUserId,
      creatorName: activeUserProfile?.name ?? '',
      creatorInitials: activeUserProfile?.initials ?? '',
      creatorGender: activeUserProfile?.gender,
      creatorCity: activeUserProfile?.city ?? '',
      visibility: target === 'hosting' ? 'Invitation only' : 'Public',
      dateRange: {
        startAt: AppUtils.toIsoDateTimeLocal(start),
        endAt: AppUtils.toIsoDateTimeLocal(end),
        precision: 'minute'
      }
    });

    this.eventDetailDTO.mode = 'Casual';
    this.eventVisibilityReady.set(true);
  }

  private normalizeEventDateRange(anchor: 'start' | 'end' = 'start'): void {
    const start = AppUtils.isoLocalDateTimeToDate(this.eventDetailDTO.dateRange.startAt);
    let end = AppUtils.isoLocalDateTimeToDate(this.eventDetailDTO.dateRange.endAt);
    if (!start || !end) {
      return;
    }

    if (!this.eventDetailDTO.slotsEnabled && this.eventDetailDTO.frequency !== 'One-time') {
      this.eventDetailDTO.frequency = 'One-time';
    }
    if (this.eventDetailDTO.slotsEnabled && !this.slotFrequencyOptions.includes(this.eventDetailDTO.frequency)) {
      this.eventDetailDTO.frequency = this.slotFrequencyOptions[0] ?? 'Custom';
    }

    this.applyEventDateRange(this.eventDateRangeWithMinimum({
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      precision: 'minute'
    }, anchor));
    this.normalizeEventSlotTemplates();
  }

  private eventDateRangeWithMinimum(
    range: { startAt: string; endAt: string; precision?: 'date' | 'minute' },
    anchor: 'start' | 'end'
  ): { startAt: string; endAt: string; precision: 'minute' } {
    let start = AppUtils.isoLocalDateTimeToDate(range.startAt) ?? new Date();
    let end = AppUtils.isoLocalDateTimeToDate(range.endAt) ?? new Date(start.getTime() + (60 * 60 * 1000));
    const minimumDurationMs = this.subEventDefinitionsMinimumDurationMs();
    if (end.getTime() - start.getTime() < minimumDurationMs) {
      if (anchor === 'end') {
        start = new Date(end.getTime() - minimumDurationMs);
      } else {
        end = new Date(start.getTime() + minimumDurationMs);
      }
    }
    return {
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      precision: 'minute'
    };
  }

  private applyEventDateRange(range: { startAt: string; endAt: string; precision?: 'date' | 'minute' }): void {
    this.eventDetailDTO.dateRange = {
      startAt: range.startAt,
      endAt: range.endAt,
      precision: 'minute'
    };
    this.eventDetailDTO.startAtIso = this.eventDetailDTO.dateRange.startAt;
    this.eventDetailDTO.endAtIso = this.eventDetailDTO.dateRange.endAt;
  }

  private subEventDefinitionsMinimumDurationMs(): number {
    let previousStartOffsetMinutes = 0;
    let previousEndOffsetMinutes = 0;
    let hasPrevious = false;
    let maxEndOffsetMinutes = 0;
    for (const item of ActivityEventDetailDTO.normalizeSubEventDefinitions(this.eventDetailDTO.subEventDefinitions)) {
      const durationMinutes = Math.max(0, Math.trunc(Number(item.durationMinutes) || 0));
      const offsetMinutes = Math.max(0, Math.trunc(Number(item.offsetMinutes) || 0));
      const timing = ActivityEventDetailDTO.normalizeSubEventDefinitionTiming(item.timing);
      const startOffsetMinutes = !hasPrevious
        ? offsetMinutes
        : timing === 'During'
          ? previousStartOffsetMinutes + offsetMinutes
          : previousEndOffsetMinutes + offsetMinutes;
      previousStartOffsetMinutes = startOffsetMinutes;
      previousEndOffsetMinutes = startOffsetMinutes + durationMinutes;
      maxEndOffsetMinutes = Math.max(maxEndOffsetMinutes, previousEndOffsetMinutes);
      hasPrevious = true;
    }
    return maxEndOffsetMinutes * 60 * 1000;
  }

  private normalizeEventSlotTemplates(): void {
    if (!this.eventDetailDTO.slotsEnabled) {
      this.eventDetailDTO.slotsEnabled = false;
      this.eventDetailDTO.slotTemplates = [];
      return;
    }
    this.eventDetailDTO.slotsEnabled = true;
    this.eventDetailDTO.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(this.eventDetailDTO.slotTemplates);
  }

  private syncFirstSubEventLocationFromMainEvent(): void {
    if (this.isPublishedManageMode() || this.eventDetailDTO.subEvents.length === 0) {
      return;
    }
    this.eventDetailDTO.syncFirstSubEventLocation(this.eventDetailDTO.location);
  }

  private eventLocationRouteStops(): string[] {
    const mainLocation = ActivityEventDetailDTO.normalizeLocation(this.eventDetailDTO.location).trim();
    const subEventStops = ActivityEventDetailDTO.sortSubEventsByStartAsc(this.eventDetailDTO.subEvents)
      .map(item => ActivityEventDetailDTO.normalizeLocation(item.location).trim())
      .filter(stop => stop.length > 0);
    const ordered = [mainLocation, ...subEventStops].filter(stop => stop.length > 0);
    return Array.from(new Set(ordered));
  }

  private normalizedEventImageUrl(): string {
    return `${this.eventDetailDTO.imageUrl ?? ''}`.trim();
  }

}

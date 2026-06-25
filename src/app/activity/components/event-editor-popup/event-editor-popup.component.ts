import { Component, inject, OnInit, OnDestroy, HostListener, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppContext, AppPopupContext } from '../../../shared/ui';
import { Subscription } from 'rxjs';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { EventCheckoutDraftService, type EventCheckoutDraft } from '../../../shared/ui/services/event-checkout-draft.service';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { EventEditorBuilder, PricingBuilder } from '../../../shared/core/base/builders';
import type * as AppTypes from '../../../shared/core/base/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  ActivityMembersService, EventsService, ExplanationGuideService, RouteIntervalSchedulerService } from '../../../shared/core';
import { ActivityEventDetailDTO } from '../../../shared/core/contracts/activity.interface';
import {
  AppMenuComponent,
  buildTabbedMenuModel,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  CounterBadgePipe,
  DateInputComponent,
  type DateInputModel,
  EditableImageCarouselComponent,
  EventPoliciesInputComponent,
  EventSlotsInputComponent,
  type EventSlotsInputConfig,
  LocationInputComponent,
  type LocationInputConfig,
  PricingEditorInputComponent,
  type PricingEditorConfig,
  ProgressIndicatorComponent
} from '../../../shared/ui';
import { EventSubeventDefinitionsPanelComponent } from '../event-subevent-definitions-panel';
import { EventSubeventsInputComponent } from '../event-subevents-input';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

import type * as AppConstants from '../../../shared/core/common/constants';
type EventEditorMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'frequency'; frequency: string }
  | { menu: 'event-intel'; action: 'toggle-blind-mode' | 'toggle-event-mode' | 'toggle-auto-inviter' | 'toggle-ticketing' }
  | { menu: 'topics'; topic: string }
  | { menu: 'checkout-draft'; sourceId: string }
  | { menu: 'save' };

@Component({
  selector: 'app-event-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    AppMenuComponent,
    DateInputComponent,
    EditableImageCarouselComponent,
    EventPoliciesInputComponent,
    EventSlotsInputComponent,
    LocationInputComponent,
    EventSubeventDefinitionsPanelComponent,
    EventSubeventsInputComponent,
    PricingEditorInputComponent,
    ProgressIndicatorComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  protected readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly eventsService = inject(EventsService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventCheckoutDraftService = inject(EventCheckoutDraftService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly routeIntervalScheduler = inject(RouteIntervalSchedulerService);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private editorTarget: ContractTypes.EventEditorTarget = 'events';
  private lastHandledOpenSubEventsRequest = 0;
  protected editingEventId: string | null = null;
  private draftEventId: string | null = null;
  private currentSourcePublished = false;
  private publishedCapacityMaxFloor = 0;
  private currentMemberSummary: ActivityContracts.ActivityMembersSummary | null = null;
  private lastHandledActivityMembersSyncMs = 0;
  private pricingSlotCatalogCacheKey = '';
  private pricingSlotCatalogCache: ContractTypes.PricingSlotReference[] = [];
  private stopDraftAutosave: (() => void) | null = null;
  private lastDraftAutosaveSignature = '';
  private isDraftAutosavePending = false;
  private eventEditorExplanationContextKey: string | null = null;
  private unregisterEventEditorExplanationContext: (() => void) | null = null;
  protected readonly isLoadingEventData = signal(false);

  constructor() {
    effect(() => {
      const request = this.popupCtx.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventEditorCreate' && request.type !== 'eventEditor')) {
        return;
      }
      this.popupCtx.clearActivitiesNavigationRequest();
      if (request.type === 'eventEditorCreate') {
        this.openCreateRequest(request.target);
        return;
      }
      void this.openEditRequest(request.eventId, request.target, request.readOnly);
    });

    effect(() => {
      const sourceEvent: any = this.eventEditorService.sourceEvent();
      const isOpen = this.eventEditorService.isOpen();
      const mode = this.eventEditorService.mode();
      this.setEventEditorExplanationContext(isOpen ? 'event.editor' : null);

      if (!isOpen) {
        this.showSubEventsPopup = false;
        this.resetDraftAutosaveTracking();
        return;
      }

      if (sourceEvent) {
        this.populateFormFromSourceEvent(sourceEvent);
        return;
      }

      if (mode === 'create' && this.draftEventId && this.eventDetailDTO.id === this.draftEventId && this.eventDetailDTO.dateRange.startAt) {
        return;
      }

      this.resetForm(this.editorTarget);
    });

    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      const openSubEventsRequestNonce = this.eventEditorService.openSubEventsRequestNonce();
      if (!isOpen || openSubEventsRequestNonce <= this.lastHandledOpenSubEventsRequest) {
        return;
      }
      this.lastHandledOpenSubEventsRequest = openSubEventsRequestNonce;
      this.showSubEventsPopup = true;
    });

    effect(() => {
      const sync = this.appCtx.activityMembersSync();
      const isOpen = this.eventEditorService.isOpen();
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
    this.openSubscription = this.eventEditorService.onOpen$.subscribe(() => {
      this.showSubEventsPopup = false;
    });

    this.closeSubscription = this.eventEditorService.onClose$.subscribe(() => {
      this.showSubEventsPopup = false;
      this.isLoadingEventData.set(false);
      this.resetEditorContext();
      this.resetDraftAutosaveTracking();
    });

    this.startDraftAutosaveLoop();
  }

  ngOnDestroy(): void {
    this.openSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
    this.stopDraftAutosaveLoop();
    this.clearEventEditorExplanationContext();
  }

  eventDetailDTO: ActivityEventDetailDTO = this.createEmptyEventDetailDTO();

  showSubEventsPopup = false;
  isSavePending = false;

  readonly visibilityOptions: AppConstants.EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

  protected readonly eventPricingEditorConfig: PricingEditorConfig = {
    context: 'event',
    presentation: 'popup-summary',
    slotCatalog: () => this.pricingSlotCatalog()
  };

  protected readonly eventSlotsInputConfig: EventSlotsInputConfig = {
    startAtIso: () => this.eventDetailDTO.dateRange.startAt,
    endAtIso: () => this.eventDetailDTO.dateRange.endAt,
    frequency: () => this.eventDetailDTO.frequency,
    generated: () => this.isGeneratedSlotInstance()
  };

  protected get eventDateInputModel(): DateInputModel {
    return {
      mode: 'range',
      precision: 'minute',
      range: {
        start: { label: 'Start' },
        end: { label: 'End' }
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
    this.showSubEventsPopup = false;
    this.isSavePending = false;
    this.isLoadingEventData.set(false);
    this.clearEventEditorExplanationContext();
    this.eventEditorService.close();
  }

  getPopupTitle(): string {
    const mode = this.eventEditorService.mode();
    const readOnly = this.eventEditorService.readOnly();

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

  protected isPublishedManageMode(): boolean {
    return this.eventEditorService.mode() === 'edit'
      && !this.eventEditorService.readOnly()
      && this.currentSourcePublished;
  }

  protected eventStructureReadOnly(): boolean {
    return this.eventEditorService.readOnly() || this.isPublishedManageMode();
  }

  protected eventPoliciesReadOnly(): boolean {
    return this.eventStructureReadOnly();
  }

  protected eventCapacityMinReadOnly(): boolean {
    return this.eventEditorService.readOnly() || this.isPublishedManageMode();
  }

  protected eventCapacityMaxMinimum(): number {
    const capacityMin = this.eventDetailDTO.capacityMin ?? 0;
    const publishedFloor = this.isPublishedManageMode() ? this.publishedCapacityMaxFloor : 0;
    return Math.max(0, capacityMin, publishedFloor);
  }

  requestOpenMembers(): void {
    const eventId = this.currentEventIdentity() || 'draft-event';
    const canManageMembers = !this.eventEditorService.readOnly();
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditorMembers',
      ownerId: eventId,
      title: this.eventDetailDTO.title.trim() || 'New Event',
      canManage: canManageMembers
    });
  }

  handleSubEventsChange(subEvents: readonly ContractTypes.SubEventDTO[]): void {
    this.eventDetailDTO.applySubEvents(subEvents);
    this.syncMainEventBoundsFromSubEvents();
  }

  protected pricingSlotCatalog(): readonly ContractTypes.PricingSlotReference[] {
    const normalizedSlots = ActivityEventDetailDTO.normalizeSlotTemplates(this.eventDetailDTO.slotTemplates);
    const nextKey = normalizedSlots
      .map(item => [item.id, item.startAt, item.endAt, item.overrideDate ?? '', item.closed === true ? '1' : '0'].join(':'))
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
      pricing: PricingBuilder.createDefaultPricingConfig('event'),
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

  private parseEventEditorOverrideDate(value: unknown): Date | null {
    return AppUtils.parseDateOnly(value);
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

  eventEditorHeaderPendingMemberCount(): number {
    const source: any = this.eventEditorService.sourceEvent();
    const eventId = this.currentEventIdentity();
    const sync = this.appCtx.activityMembersSync();
    const pendingRaw = sync && eventId && sync.id === eventId
      ? sync.pendingMembers
      : source?.pendingMembersCount
      ?? source?.pendingCount
      ?? source?.pendingMembers
      ?? source?.pending
      ?? source?.pendingInvites
      ?? this.currentMemberSummary?.pendingMembers
      ?? 0;
    const pendingCount = Number(pendingRaw);
    if (!Number.isFinite(pendingCount) || pendingCount <= 0) {
      return 0;
    }
    return Math.floor(pendingCount);
  }

  eventEditorFieldInvalid(field: 'title' | 'subtitle' | 'capacityMin' | 'capacityMax'): boolean {
    if (field === 'capacityMin' || field === 'capacityMax') {
      return this.eventDetailDTO[field] === null;
    }
    return !`${this.eventDetailDTO[field] ?? ''}`.trim();
  }

  canSaveEventDetailDTO(): boolean {
    if (this.eventEditorService.readOnly()) {
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
      layout: 'action',
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
        disabled: this.eventEditorService.readOnly(),
        closeOnSelect: false,
        filterable: true,
        ariaLabel: 'Open topics',
        model: this.eventTopicsMenuModel()
      },
      {
        id: 'event-mode',
        label: this.eventModeLabel(this.eventDetailDTO.mode),
        detail: this.eventModeDescription(this.eventDetailDTO.mode),
        icon: this.eventModeIcon(this.eventDetailDTO.mode),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDetailDTO.mode === 'Tournament',
        checked: this.eventDetailDTO.mode === 'Tournament',
        palette: this.eventDetailDTO.mode === 'Tournament' ? 'cyan' : 'slate',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-event-mode' }
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
        palette: this.eventDetailDTO.autoInviter ? 'green' : 'slate',
        disabled: this.eventEditorService.readOnly(),
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
        palette: this.eventDetailDTO.ticketing ? 'green' : 'blue',
        disabled: this.eventStructureReadOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-ticketing' }
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

  eventModeIcon(mode: ContractTypes.EventMode): string {
    return mode === 'Tournament' ? 'emoji_events' : 'groups';
  }

  eventModeLabel(mode: ContractTypes.EventMode): string {
    return mode === 'Tournament' ? 'Tournament On' : 'Casual Event';
  }

  eventModeDescription(mode: ContractTypes.EventMode): string {
    return mode === 'Tournament'
      ? 'Stages, groups and leaderboard are enabled.'
      : 'Simple sub-events without tournament brackets.';
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

  eventFrequencyIcon(frequency: string): string {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Daily':
        return 'today';
      case 'Weekly':
        return 'view_week';
      case 'Bi-weekly':
        return 'date_range';
      case 'Monthly':
        return 'calendar_month';
      case 'Yearly':
        return 'calendar_today';
      default:
        return 'event';
    }
  }

  protected eventFrequencyMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventDetailDTO.frequency,
      icon: this.eventFrequencyIcon(this.eventDetailDTO.frequency),
      ariaLabel: 'Open event frequency',
      palette: this.eventFrequencyPalette(this.eventDetailDTO.frequency),
      disabled: this.eventStructureReadOnly(),
      layout: 'field'
    };
  }

  protected eventFrequencyMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const current = ActivityEventDetailDTO.normalizeFrequency(this.eventDetailDTO.frequency);
    return this.eventFrequencyOptions.map(option => {
      const normalized = ActivityEventDetailDTO.normalizeFrequency(option);
      return {
        id: `frequency-${normalized}`,
        label: normalized,
        icon: this.eventFrequencyIcon(normalized),
        kind: 'radio',
        active: current === normalized,
        checked: current === normalized,
        palette: this.eventFrequencyPalette(normalized),
        surface: 'tinted',
        context: { menu: 'frequency', frequency: normalized }
      };
    });
  }

  protected eventEditorCheckoutDraft(): EventCheckoutDraft | null {
    this.eventCheckoutDraftService.drafts();
    if (!this.eventEditorService.readOnly()) {
      return null;
    }
    const eventId = this.currentEventIdentity();
    const activeUserId = this.activeUserId();
    if (!eventId || !activeUserId) {
      return null;
    }
    return this.eventCheckoutDraftService.read(activeUserId, eventId);
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
    if (event.context.menu === 'save') {
      this.saveEventDetailDTO();
      return;
    }
    if (event.context.menu === 'frequency') {
      event.sourceEvent.stopPropagation();
      this.onEventFrequencyChange(event.context.frequency);
      return;
    }
    if (event.context.menu === 'event-intel') {
      if (event.context.action === 'toggle-blind-mode') {
        this.toggleEventBlindMode(event.sourceEvent);
        return;
      }
      if (event.context.action === 'toggle-event-mode') {
        this.toggleEventMode(event.sourceEvent);
        return;
      }
      if (event.context.action === 'toggle-auto-inviter') {
        this.toggleEventAutoInviter(event.sourceEvent);
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
    if (this.eventEditorService.readOnly()) {
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
    const draft = this.eventCheckoutDraftService.read(this.activeUserId(), sourceId);
    if (!draft || !this.eventEditorCanContinueCheckoutDraft(draft)) {
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventCheckoutDraft',
      sourceId: draft.sourceId
    });
  }

  private eventFrequencyPalette(frequency: string): AppMenuPalette {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Daily':
        return 'sky';
      case 'Weekly':
        return 'blue';
      case 'Bi-weekly':
        return 'teal';
      case 'Monthly':
        return 'violet';
      case 'Yearly':
        return 'gold';
      default:
        return 'slate';
    }
  }

  protected onEventFrequencyChange(value: string): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.frequency = ActivityEventDetailDTO.normalizeFrequency(value);
    this.eventDetailDTO.slotsEnabled = this.eventFrequencyUsesSlots();
    if (!this.eventDetailDTO.slotsEnabled) {
      this.eventDetailDTO.slotTemplates = [];
    }
    this.normalizeEventSlotTemplates();
  }

  protected eventFrequencyUsesSlots(): boolean {
    return ActivityEventDetailDTO.normalizeFrequency(this.eventDetailDTO.frequency) !== 'One-time';
  }

  eventTopicLabel(topic: string): string {
    return `#${topic.replace(/^#+/, '')}`;
  }

  protected eventImageUrls(): string[] {
    const imageUrl = `${this.eventDetailDTO.imageUrl ?? ''}`.trim();
    return imageUrl ? [imageUrl] : [];
  }

  protected onEventImageUrlsChange(imageUrls: readonly string[] | null | undefined): void {
    this.eventDetailDTO.imageUrl = `${imageUrls?.[0] ?? ''}`.trim();
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
    const parsed = this.toNonNegativeIntegerOrNull(value);
    this.eventDetailDTO.capacityMax = parsed === null ? null : Math.max(parsed, this.eventCapacityMaxMinimum());
  }

  onEventCapacityMaxBlur(): void {
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

  toggleEventMode(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDetailDTO.mode = this.eventDetailDTO.mode === 'Tournament' ? 'Casual' : 'Tournament';
    this.syncMainEventBoundsFromSubEvents();
  }

  toggleEventAutoInviter(event: Event): void {
    event.preventDefault();
    if (this.eventEditorService.readOnly()) {
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

  onEventLocationChange(value: string): void {
    this.eventDetailDTO.location = ActivityEventDetailDTO.normalizeLocation(value);
    this.syncFirstSubEventLocationFromMainEvent();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.eventEditorService.isOpen() || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.showSubEventsPopup) {
      this.showSubEventsPopup = false;
      return;
    }
    this.close();
  }

  private openCreateRequest(target: ContractTypes.EventEditorTarget): void {
    this.resetEditorContext();
    this.editorTarget = target;
    this.draftEventId = EventEditorBuilder.buildCreatedEventEditorId(target);
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(this.draftEventId);
    this.resetForm(target);
    this.eventEditorService.openCreate();
    void this.refreshCurrentMemberSummary(this.draftEventId);
  }

  private async openEditRequest(eventId: string, target: ContractTypes.EventEditorTarget, readOnly: boolean): Promise<void> {
    this.resetEditorContext();
    const activeUserId = this.activeUserId();

    this.editorTarget = target;
    this.editingEventId = eventId;
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(eventId);
    this.eventEditorService.open('edit', undefined, readOnly);
    void this.refreshCurrentMemberSummary(eventId);

    if (!activeUserId) {
      return;
    }

    this.isLoadingEventData.set(true);

    try {
      const eventDetailDTO = await this.eventsService.loadEventDetailById(activeUserId, eventId);

      this.isLoadingEventData.set(false);
      if (!eventDetailDTO) {
        return;
      }

      this.editorTarget = this.eventDetailDTOBelongsToActiveAdmin(eventDetailDTO) ? 'hosting' : target;
      this.editingEventId = eventDetailDTO.id;
      this.openEventDetailDTO(eventDetailDTO, readOnly, this.editorTarget);
    } catch {
      this.isLoadingEventData.set(false);
    }
  }

  private openEventDetailDTO(eventDetailDTO: ActivityEventDetailDTO, readOnly: boolean, _target: ContractTypes.EventEditorTarget): void {
    if (readOnly) {
      this.eventEditorService.openView(eventDetailDTO);
      return;
    }
    this.eventEditorService.openEdit(eventDetailDTO);
  }

  private async persistEventDetailDTO(options: { allowIncomplete?: boolean } = {}): Promise<boolean> {
    if (this.eventEditorService.readOnly()) {
      return false;
    }

    this.normalizeEventDateRange();
    this.normalizeEventSlotTemplates();
    this.syncFirstSubEventLocationFromMainEvent();
    const normalizedCapacity = this.eventDetailDTO.normalizeCapacityRange();
    if (!options.allowIncomplete && !this.canSaveEventDetailDTO()) {
      return false;
    }

    const activeUserId = this.activeUserId();
    const eventId = this.eventDetailDTO.id.trim()
      || this.editingEventId
      || this.draftEventId
      || EventEditorBuilder.buildCreatedEventEditorId(this.editorTarget);
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
    this.activitiesContext.emitActivityEventSaveResult(displaySync);
    return true;
  }

  private async runImmediateSave(): Promise<void> {
    this.isSavePending = true;
    try {
      const saved = await this.persistEventDetailDTO();
      if (!saved) {
        this.isSavePending = false;
        return;
      }
      this.lastDraftAutosaveSignature = this.buildDraftAutosaveSignature();
      this.isSavePending = false;
      this.eventEditorService.close();
    } catch {
      this.isSavePending = false;
    }
  }

  private startDraftAutosaveLoop(): void {
    this.stopDraftAutosaveLoop();
    this.stopDraftAutosave = this.routeIntervalScheduler.startInterval('/activities/events/draft-autosave', () => {
      void this.runDraftAutosaveIfNeeded();
    });
  }

  private stopDraftAutosaveLoop(): void {
    if (!this.stopDraftAutosave) {
      return;
    }
    this.stopDraftAutosave();
    this.stopDraftAutosave = null;
  }

  private resetDraftAutosaveTracking(): void {
    this.lastDraftAutosaveSignature = '';
    this.isDraftAutosavePending = false;
  }

  private seedDraftAutosaveSignature(): void {
    this.lastDraftAutosaveSignature = this.buildDraftAutosaveSignature();
  }

  private shouldAutosaveDraft(): boolean {
    if (!this.eventEditorService.isOpen() || this.eventEditorService.readOnly() || this.isSavePending || this.isDraftAutosavePending) {
      return false;
    }
    if (this.eventEditorService.mode() === 'create') {
      return true;
    }
    return this.editorTarget === 'hosting' && this.eventDetailDTO.status === 'DR';
  }

  private async runDraftAutosaveIfNeeded(): Promise<void> {
    if (!this.shouldAutosaveDraft()) {
      return;
    }
    const nextSignature = this.buildDraftAutosaveSignature();
    if (!nextSignature || nextSignature === this.lastDraftAutosaveSignature) {
      return;
    }
    this.isDraftAutosavePending = true;
    try {
      const saved = await this.persistEventDetailDTO({ allowIncomplete: true });
      if (saved) {
        this.lastDraftAutosaveSignature = this.buildDraftAutosaveSignature();
      }
    } finally {
      this.isDraftAutosavePending = false;
    }
  }

  private buildDraftAutosaveSignature(): string {
    return JSON.stringify({
      target: this.editorTarget,
      editorMode: this.eventEditorService.mode(),
      readOnly: this.eventEditorService.readOnly(),
      editingEventId: this.editingEventId,
      draftEventId: this.draftEventId,
      mode: this.eventDetailDTO.mode,
      form: {
        ...this.eventDetailDTO,
        topics: [...this.eventDetailDTO.topics],
        pricing: PricingBuilder.clonePricingConfig(this.eventDetailDTO.pricing),
        policies: ActivityEventDetailDTO.normalizePolicies(this.eventDetailDTO.policies),
        slotTemplates: ActivityEventDetailDTO.normalizeSlotTemplates(this.eventDetailDTO.slotTemplates),
        subEventDefinitions: ActivityEventDetailDTO.normalizeSubEventDefinitions(this.eventDetailDTO.subEventDefinitions),
        subEvents: ActivityEventDetailDTO.normalizeSubEvents(this.eventDetailDTO.subEvents)
      }
    });
  }

  private resetEditorContext(): void {
    this.editorTarget = 'events';
    this.editingEventId = null;
    this.draftEventId = null;
    this.currentSourcePublished = false;
    this.publishedCapacityMaxFloor = 0;
    this.currentMemberSummary = null;
    this.lastHandledActivityMembersSyncMs = 0;
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
    return this.appCtx.activeUserId().trim() || this.appCtx.getActiveUserId().trim();
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
    if (this.currentEventIdentity() !== normalizedOwnerId || !this.eventEditorService.isOpen()) {
      return;
    }
    this.currentMemberSummary = summary;
  }

  private async resolveCurrentEventMembersSummary(
    eventId: string,
    normalizedCapacity: ContractTypes.EventCapacityRange
  ): Promise<ActivityContracts.ActivityMembersSummary> {
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
    this.currentSourcePublished = this.eventEditorService.mode() === 'edit' && dto.status === 'A';
    this.publishedCapacityMaxFloor = Math.max(0, Number(dto.capacityMax ?? 0) || 0);
    this.eventDetailDTO = dto.apply({
      slotsEnabled: ActivityEventDetailDTO.normalizeFrequency(dto.frequency) !== 'One-time'
    });
    this.eventDetailDTO.mode = dto.mode ?? 'Casual';
    this.normalizeEventDateRange();
    this.seedDraftAutosaveSignature();
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
    const activeUserProfile = activeUserId ? this.appCtx.getUserProfile(activeUserId) : null;

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
    this.seedDraftAutosaveSignature();
  }

  private normalizeEventDateRange(): void {
    const start = AppUtils.isoLocalDateTimeToDate(this.eventDetailDTO.dateRange.startAt);
    let end = AppUtils.isoLocalDateTimeToDate(this.eventDetailDTO.dateRange.endAt);
    if (!start || !end) {
      return;
    }

    if (!this.eventFrequencyOptions.includes(this.eventDetailDTO.frequency)) {
      this.eventDetailDTO.frequency = this.eventFrequencyOptions[0] ?? 'One-time';
    }

    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + (60 * 60 * 1000));
    }

    this.eventDetailDTO.dateRange = {
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      precision: 'minute'
    };
    this.eventDetailDTO.startAtIso = this.eventDetailDTO.dateRange.startAt;
    this.eventDetailDTO.endAtIso = this.eventDetailDTO.dateRange.endAt;
    this.eventDetailDTO.slotsEnabled = this.eventFrequencyUsesSlots();
    if (!this.eventDetailDTO.slotsEnabled) {
      this.eventDetailDTO.slotTemplates = [];
    }
    this.normalizeEventSlotTemplates();
  }

  private normalizeEventSlotTemplates(): void {
    if (!this.eventFrequencyUsesSlots()) {
      this.eventDetailDTO.slotsEnabled = false;
      this.eventDetailDTO.slotTemplates = [];
      return;
    }
    this.eventDetailDTO.slotsEnabled = true;
    this.eventDetailDTO.slotTemplates = ActivityEventDetailDTO.normalizeSlotTemplates(this.eventDetailDTO.slotTemplates);
  }

  private syncMainEventBoundsFromSubEvents(): void {
    if (this.eventDetailDTO.subEvents.length === 0) {
      return;
    }

    const tournamentMode = this.eventDetailDTO.mode === 'Tournament';
    let minStartMs: number | null = null;
    let maxEndMs: number | null = null;
    let minCapacity: number | null = null;
    let maxCapacity: number | null = null;

    for (const item of this.eventDetailDTO.subEvents) {
      let startMs = this.parseEventEditorDateValue(item.startAt)?.getTime() ?? Number.NaN;
      let endMs = this.parseEventEditorDateValue(item.endAt)?.getTime() ?? Number.NaN;
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        if (endMs <= startMs) {
          endMs = startMs + (60 * 60 * 1000);
        }
        minStartMs = minStartMs === null ? startMs : Math.min(minStartMs, startMs);
        maxEndMs = maxEndMs === null ? endMs : Math.max(maxEndMs, endMs);
      }

      const normalizedRange = new ActivityEventDetailDTO().apply({
        capacityMin: item.capacityMin,
        capacityMax: item.capacityMax
      }).normalizeCapacityRange();
      const normalizedMin = normalizedRange.min;
      const normalizedMax = normalizedRange.max;
      if (normalizedMin !== null) {
        minCapacity = minCapacity === null
          ? normalizedMin
          : (tournamentMode ? (minCapacity + normalizedMin) : Math.min(minCapacity, normalizedMin));
      }
      if (normalizedMax !== null) {
        maxCapacity = maxCapacity === null
          ? normalizedMax
          : (tournamentMode ? (maxCapacity + normalizedMax) : Math.max(maxCapacity, normalizedMax));
      }
    }

    if (minStartMs !== null && maxEndMs !== null) {
      this.eventDetailDTO.dateRange = {
        startAt: AppUtils.toIsoDateTimeLocal(new Date(minStartMs)),
        endAt: AppUtils.toIsoDateTimeLocal(new Date(maxEndMs)),
        precision: 'minute'
      };
      this.eventDetailDTO.startAtIso = this.eventDetailDTO.dateRange.startAt;
      this.eventDetailDTO.endAtIso = this.eventDetailDTO.dateRange.endAt;
    }
    if (minCapacity !== null) {
      this.eventDetailDTO.capacityMin = minCapacity;
    }
    if (maxCapacity !== null) {
      this.eventDetailDTO.capacityMax = Math.max(maxCapacity, this.eventDetailDTO.capacityMin ?? maxCapacity);
    }

    const first = ActivityEventDetailDTO.firstSubEventByOrder(this.eventDetailDTO.subEvents);
    if (first) {
      this.eventDetailDTO.location = ActivityEventDetailDTO.normalizeLocation(first.location);
    }
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

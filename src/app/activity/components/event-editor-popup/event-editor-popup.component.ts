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
  ActivityMembersService, EventsService, ExplanationGuideService, RouteDelayService, RouteIntervalSchedulerService } from '../../../shared/core';
import { ActivityEventDetailDTO } from '../../../shared/core/contracts/activity.interface';
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
  EditableImageCarouselComponent,
  EventPoliciesInputComponent,
  EventSlotsInputComponent,
  type EventSlotsInputConfig,
  type EventSlotOverrideRequest,
  LocationInputComponent,
  type LocationInputConfig,
  PricingEditorInputComponent,
  type PricingEditorConfig,
  ProgressIndicatorComponent
} from '../../../shared/ui';
import { EventSubeventDefinitionsPanelComponent } from '../event-subevent-definitions-panel';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

import type * as AppConstants from '../../../shared/core/common/constants';
type EventEditorMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'event-intel'; action: 'toggle-blind-mode' | 'toggle-auto-inviter' | 'toggle-ticketing' }
  | { menu: 'topics'; topic: string }
  | { menu: 'checkout-draft'; sourceId: string }
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
    PricingEditorInputComponent,
    ProgressIndicatorComponent
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  private static readonly EVENTS_ROUTE = '/activities/events';
  protected readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly eventsService = inject(EventsService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventCheckoutDraftService = inject(EventCheckoutDraftService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly routeIntervalScheduler = inject(RouteIntervalSchedulerService);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private editorTarget: ContractTypes.EventEditorTarget = 'events';
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
  private eventDetailLoadSequence = 0;
  protected readonly isLoadingEventData = signal(false);
  protected readonly eventVisibilityReady = signal(false);

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
      const eventDataLoading = this.isLoadingEventData();
      this.setEventEditorExplanationContext(isOpen && !eventDataLoading ? 'event.editor' : null);

      if (!isOpen) {
        this.slotOverrideEditor = null;
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

      if (mode === 'edit') {
        return;
      }

      this.resetForm(this.editorTarget);
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
      this.slotOverrideEditor = null;
    });

    this.closeSubscription = this.eventEditorService.onClose$.subscribe(() => {
      this.slotOverrideEditor = null;
      this.eventDetailLoadSequence += 1;
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

  protected slotOverrideEditor: SlotOverrideEditorState | null = null;
  protected slotOverrideOccurrenceMenuOpen = false;
  isSavePending = false;

  readonly visibilityOptions: AppConstants.EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];
  readonly slotFrequencyOptions = ['Custom', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

  protected readonly eventPricingEditorConfig: PricingEditorConfig = {
    context: 'event',
    presentation: 'popup-summary',
    slotCatalog: () => this.pricingSlotCatalog()
  };

  protected readonly eventSlotsInputConfig: EventSlotsInputConfig = {
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
    this.isSavePending = false;
    this.eventDetailLoadSequence += 1;
    this.isLoadingEventData.set(false);
    this.eventVisibilityReady.set(false);
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
        id: 'event-auto-inviter',
        label: this.eventAutoInviterLabel(this.eventDetailDTO.autoInviter),
        detail: this.eventAutoInviterDescription(this.eventDetailDTO.autoInviter),
        icon: this.eventAutoInviterIcon(this.eventDetailDTO.autoInviter),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDetailDTO.autoInviter,
        checked: this.eventDetailDTO.autoInviter,
        palette: this.eventDetailDTO.autoInviter ? 'cyan' : 'slate',
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
        palette: this.eventDetailDTO.ticketing ? 'gold' : 'blue',
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
    if (event.context.menu === 'event-intel') {
      if (event.context.action === 'toggle-blind-mode') {
        this.toggleEventBlindMode(event.sourceEvent);
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

  protected openSlotOverrideEditor(request: EventSlotOverrideRequest): void {
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
    this.slotOverrideOccurrenceMenuOpen = false;
  }

  protected closeSlotOverrideEditor(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.slotOverrideEditor = null;
    this.slotOverrideOccurrenceMenuOpen = false;
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
    return this.slotOverrideSummaryLabel(editor.selectedStartAt);
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

  protected slotOverrideRuleBadgeTrigger(): AppMenuTrigger {
    const editor = this.slotOverrideEditor;
    const frequency = ActivityEventDetailDTO.normalizeFrequency(this.eventDetailDTO.frequency);
    return {
      label: editor ? this.slotOverrideRuleBadgeLabel(editor) : 'Slot rule',
      icon: this.slotOverrideFrequencyIcon(frequency),
      palette: this.slotOverrideFrequencyPalette(frequency),
      layout: 'pill',
      trailingIcon: '',
      action: 'custom'
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
    this.slotOverrideOccurrenceMenuOpen = false;
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
    const keepMenuOpen = this.slotOverrideOccurrenceMenuOpen;
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
    this.slotOverrideOccurrenceMenuOpen = keepMenuOpen;
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

  private slotOverrideFrequencyIcon(frequency: string): string {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Custom':
        return 'event';
      case 'Daily':
        return 'today';
      case 'Weekly':
        return 'calendar_view_week';
      case 'Bi-weekly':
        return 'date_range';
      case 'Monthly':
        return 'calendar_month';
      case 'Yearly':
        return 'event_available';
      default:
        return 'event';
    }
  }

  private slotOverrideFrequencyPalette(frequency: string): AppMenuPalette {
    switch (ActivityEventDetailDTO.normalizeFrequency(frequency)) {
      case 'Custom':
        return 'blue';
      case 'Daily':
        return 'green';
      case 'Weekly':
        return 'cyan';
      case 'Bi-weekly':
        return 'violet';
      case 'Monthly':
        return 'amber';
      case 'Yearly':
        return 'gold';
      default:
        return 'blue';
    }
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
    this.close();
  }

  private openCreateRequest(target: ContractTypes.EventEditorTarget): void {
    this.resetEditorContext();
    this.editorTarget = target;
    this.draftEventId = EventEditorBuilder.buildCreatedEventEditorId(target);
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(this.draftEventId);
    this.resetForm(target);
    this.eventVisibilityReady.set(true);
    this.eventEditorService.openCreate();
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
    this.eventEditorService.open('edit', undefined, readOnly);
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
      && this.eventEditorService.isOpen()
      && this.editingEventId === eventId;
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
        policiesEnabled: this.eventDetailDTO.policiesEnabled,
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
    this.eventDetailDTO = dto;
    this.eventDetailDTO.mode = dto.mode ?? 'Casual';
    this.normalizeEventDateRange();
    this.eventVisibilityReady.set(true);
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
    this.eventVisibilityReady.set(true);
    this.seedDraftAutosaveSignature();
  }

  private normalizeEventDateRange(): void {
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
    this.normalizeEventSlotTemplates();
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

import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, HostListener, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatNativeDateModule } from '@angular/material/core';
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
  ActivitiesService, ActivityMembersService, EventEditorDataService, ExplanationGuideService, MediaService, RouteIntervalSchedulerService } from '../../../shared/core';
import type { ActivityEventDetailDTO } from '../../../shared/core/contracts/activity.interface';
import {
  AppMenuComponent,
  buildTabbedMenuModel,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger,
  CounterBadgePipe,
  PricingEditorComponent,
  ProgressIndicatorComponent
} from '../../../shared/ui';
import { environment } from '../../../../environments/environment';
import { EventSubeventsPopupComponent, EventSubeventsItem } from '../event-subevents-popup/event-subevents-popup.component';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

import type * as AppConstants from '../../../shared/core/common/constants';
type EventEditorMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'frequency'; frequency: string }
  | { menu: 'event-intel'; action: 'toggle-blind-mode' | 'toggle-auto-inviter' | 'toggle-ticketing' }
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
    MatDatepickerModule,
    MatTimepickerModule,
    MatNativeDateModule,
    AppMenuComponent,
    EventSubeventsPopupComponent,
    PricingEditorComponent,
    ProgressIndicatorComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  protected readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly activitiesService = inject(ActivitiesService);
  protected readonly eventEditorDataService = inject(EventEditorDataService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventCheckoutDraftService = inject(EventCheckoutDraftService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly mediaService = inject(MediaService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly routeIntervalScheduler = inject(RouteIntervalSchedulerService);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  @ViewChild('eventImageInput') eventImageInput!: ElementRef<HTMLInputElement>;

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
  private pendingEventImageFile: File | null = null;
  private readonly slotDateControlValueCache = new Map<string, Date | null>();
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
        this.showSlotsPopup = false;
        this.showPoliciesPopup = false;
        this.showPolicyEditorPopup = false;
        this.showSubEventsPopup = false;
        this.resetDraftAutosaveTracking();
        return;
      }

      if (sourceEvent) {
        this.populateFormFromSourceEvent(sourceEvent);
        return;
      }

      if (mode === 'create' && this.draftEventId && this.eventDTO.id === this.draftEventId && this.eventDTO.startAtIso) {
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
      this.showSlotsPopup = false;
      this.showPoliciesPopup = false;
      this.showPolicyEditorPopup = false;
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
      this.showPoliciesPopup = false;
      this.showPolicyEditorPopup = false;
    });

    this.closeSubscription = this.eventEditorService.onClose$.subscribe(() => {
      this.showSubEventsPopup = false;
      this.showPoliciesPopup = false;
      this.showPolicyEditorPopup = false;
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

  eventDTO: ActivityEventDetailDTO = this.createEmptyEventDTO();

  eventStartDateValue: Date | null = null;
  eventStartTimeValue: Date | null = null;
  eventEndDateValue: Date | null = null;
  eventEndTimeValue: Date | null = null;
  slotOverrideDateValue: Date | null = null;

  subEventsDisplayMode: ContractTypes.SubEventsDisplayMode = 'Casual';
  slotEditorMode: 'base' | 'date' = 'base';
  slotsPanelExpanded = false;
  showSlotsPopup = false;
  showPoliciesPopup = false;
  showPolicyEditorPopup = false;
  showSubEventsPopup = false;
  isSavePending = false;
  workingPolicies: ContractTypes.EventPolicyDTO[] = [];
  workingPolicyDraft: ContractTypes.EventPolicyDTO = this.createEmptyPolicyDraft();
  editingPolicyDraftIndex: number | null = null;

  readonly visibilityOptions: AppConstants.EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

  close(): void {
    this.showSlotsPopup = false;
    this.showPoliciesPopup = false;
    this.showPolicyEditorPopup = false;
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
    const capacityMin = this.eventDTO.capacityMin ?? 0;
    const publishedFloor = this.isPublishedManageMode() ? this.publishedCapacityMaxFloor : 0;
    return Math.max(0, capacityMin, publishedFloor);
  }

  requestOpenMembers(): void {
    const eventId = this.currentEventIdentity() || 'draft-event';
    const canManageMembers = !this.eventEditorService.readOnly();
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditorMembers',
      ownerId: eventId,
      title: this.eventDTO.title.trim() || 'New Event',
      canManage: canManageMembers
    });
  }

  requestOpenSubEvents(): void {
    this.showSlotsPopup = false;
    this.showSubEventsPopup = true;
  }

  closeSubEventsPopup(): void {
    this.showSubEventsPopup = false;
  }

  handleSubEventsChange(subEvents: readonly EventSubeventsItem[]): void {
    const mapped = subEvents.map((item, index) => this.toSubEventDTO(item, index));
    this.eventDTO.subEvents = EventEditorBuilder.buildPersistedEventEditorSubEvents(mapped);
    this.syncMainEventBoundsFromSubEvents();
    this.syncDateTimeControlsFromDTO();
  }

  updateSubEventsDisplayMode(mode: ContractTypes.SubEventsDisplayMode): void {
    this.subEventsDisplayMode = mode;
    this.syncMainEventBoundsFromSubEvents();
    this.syncDateTimeControlsFromDTO();
  }

  protected pricingSlotCatalog(): readonly ContractTypes.PricingSlotReference[] {
    const normalizedSlots = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(this.eventDTO.slotTemplates);
    const nextKey = normalizedSlots
      .map(item => [item.id, item.startAt, item.endAt, item.overrideDate ?? '', item.closed === true ? '1' : '0'].join(':'))
      .join('|');
    if (nextKey !== this.pricingSlotCatalogCacheKey) {
      this.pricingSlotCatalogCacheKey = nextKey;
      this.pricingSlotCatalogCache = PricingBuilder.slotCatalogFromEventSlotTemplates(normalizedSlots);
    }
    return this.pricingSlotCatalogCache;
  }

  protected slotSummaryBaseItems(): ContractTypes.EventSlotTemplateDTO[] {
    return this.baseSlotTemplates();
  }

  protected slotSummaryOverrideItems(): Array<{ dateKey: string; label: string; detail: string }> {
    const grouped = new Map<string, ContractTypes.EventSlotTemplateDTO[]>();
    for (const slot of this.eventDTO.slotTemplates) {
      const dateKey = this.normalizeEventEditorSlotOverrideDate(slot.overrideDate);
      if (!dateKey) {
        continue;
      }
      const current = grouped.get(dateKey) ?? [];
      current.push({ ...slot });
      grouped.set(dateKey, current);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateKey, items]) => {
        const visibleSlots = items.filter(item => item.closed !== true);
        if (items.some(item => item.closed === true) && visibleSlots.length === 0) {
          return {
            dateKey,
            label: this.slotOverrideDateLabel(dateKey),
            detail: 'Closed for this date'
          };
        }
        const count = visibleSlots.length;
        return {
          dateKey,
          label: this.slotOverrideDateLabel(dateKey),
          detail: count === 1 ? '1 custom slot' : `${count} custom slots`
        };
      });
  }

  protected slotSummaryWindowLabel(slot: ContractTypes.EventSlotTemplateDTO): string {
    const start = this.parseEventEditorDateValue(slot.startAt);
    const end = this.parseEventEditorDateValue(slot.endAt);
    if (!start && !end) {
      return 'Time pending';
    }
    if (!start) {
      return `Ends ${this.formatSlotDateTimeLabel(end)}`;
    }
    if (!end) {
      return `Starts ${this.formatSlotDateTimeLabel(start)}`;
    }
    return `${this.formatSlotDateTimeLabel(start)} - ${this.formatSlotDateTimeLabel(end)}`;
  }

  protected openSlotsPopup(event?: Event): void {
    event?.preventDefault();
    if (this.eventStructureReadOnly() || !this.eventFrequencyUsesSlots()) {
      return;
    }
    this.showSlotsPopup = true;
  }

  protected closeSlotsPopup(): void {
    this.showSlotsPopup = false;
  }

  protected openPoliciesPopup(event?: Event): void {
    event?.preventDefault();
    this.workingPolicies = EventEditorBuilder.cloneEventEditorPolicies(this.eventDTO.policies);
    this.showPoliciesPopup = true;
    this.showPolicyEditorPopup = false;
  }

  protected closePoliciesPopup(): void {
    if (this.showPoliciesPopup || this.showPolicyEditorPopup) {
      this.syncEventPoliciesFromWorkingPolicies();
    }
    this.showPoliciesPopup = false;
    this.showPolicyEditorPopup = false;
    this.workingPolicies = [];
    this.workingPolicyDraft = this.createEmptyPolicyDraft();
    this.editingPolicyDraftIndex = null;
  }

  protected openPolicyEditor(index?: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.showPoliciesPopup) {
      return;
    }
    const existing = Number.isInteger(index) && index !== undefined
      ? this.workingPolicies[index] ?? null
      : null;
    this.editingPolicyDraftIndex = existing ? (index ?? null) : null;
    this.workingPolicyDraft = existing
      ? { ...existing }
      : this.createEmptyPolicyDraft();
    this.showPolicyEditorPopup = true;
  }

  protected closePolicyEditor(): void {
    this.showPolicyEditorPopup = false;
    this.workingPolicyDraft = this.createEmptyPolicyDraft();
    this.editingPolicyDraftIndex = null;
  }

  protected removePolicyDraft(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.eventPoliciesReadOnly()) {
      return;
    }
    if (index < 0 || index >= this.workingPolicies.length) {
      return;
    }
    this.workingPolicies = this.workingPolicies.filter((_, itemIndex) => itemIndex !== index);
    if (this.editingPolicyDraftIndex === index) {
      this.editingPolicyDraftIndex = null;
      this.workingPolicyDraft = this.createEmptyPolicyDraft();
    }
    this.syncEventPoliciesFromWorkingPolicies();
  }

  protected policyPopupTitle(): string {
    return this.editingPolicyDraftIndex === null ? 'Create Policy' : 'Edit Policy';
  }

  protected policyCardMetaLabel(policy: ContractTypes.EventPolicyDTO): string {
    return policy.required !== false ? 'Required approval' : 'Optional policy';
  }

  protected policyCardPreview(policy: ContractTypes.EventPolicyDTO): string {
    const description = policy.description.trim();
    if (description.length > 0) {
      return description;
    }
    return policy.required !== false
      ? 'Attendees must approve this policy before joining.'
      : 'Optional policy shown during join or checkout.';
  }

  protected canSavePolicyDraft(): boolean {
    if (this.eventPoliciesReadOnly()) {
      return false;
    }
    return this.workingPolicyDraft.title.trim().length > 0 || this.workingPolicyDraft.description.trim().length > 0;
  }

  private createEmptyPolicyDraft(): ContractTypes.EventPolicyDTO {
    return {
      id: `policy-${Date.now()}`,
      title: '',
      description: '',
      required: true
    };
  }

  private createEmptyEventDTO(): ActivityEventDetailDTO {
    return {
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
      startAtIso: '',
      endAtIso: '',
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
      subEvents: [],
      subEventsDisplayMode: 'Casual',
      rating: 0,
      boost: 0,
      affinity: 0,
      paymentSessionId: null
    };
  }

  private toSubEventDTO(item: EventSubeventsItem, index: number): ContractTypes.SubEventDTO {
    const fallbackName = `Sub Event ${index + 1}`;
    return {
      id: `${item.id ?? ''}`.trim() || `subevent-${index + 1}`,
      name: `${item.name ?? item.title ?? fallbackName}`.trim() || fallbackName,
      description: `${item.description ?? ''}`.trim(),
      startAt: `${item.startAt ?? ''}`.trim(),
      endAt: `${item.endAt ?? ''}`.trim(),
      location: this.normalizeEventEditorLocation(item.location),
      optional: item.optional === true,
      pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing ?? undefined,
      capacityMin: this.nonNegativeInteger(item.capacityMin),
      capacityMax: this.nonNegativeInteger(item.capacityMax),
      membersAccepted: this.nonNegativeInteger(item.membersAccepted),
      membersPending: this.nonNegativeInteger(item.membersPending),
      carsPending: this.nonNegativeInteger(item.carsPending),
      accommodationPending: this.nonNegativeInteger(item.accommodationPending),
      suppliesPending: this.nonNegativeInteger(item.suppliesPending),
      carsAccepted: this.optionalNonNegativeInteger(item.carsAccepted),
      accommodationAccepted: this.optionalNonNegativeInteger(item.accommodationAccepted),
      suppliesAccepted: this.optionalNonNegativeInteger(item.suppliesAccepted),
      carsCapacityMin: this.optionalNonNegativeInteger(item.carsCapacityMin),
      carsCapacityMax: this.optionalNonNegativeInteger(item.carsCapacityMax),
      accommodationCapacityMin: this.optionalNonNegativeInteger(item.accommodationCapacityMin),
      accommodationCapacityMax: this.optionalNonNegativeInteger(item.accommodationCapacityMax),
      suppliesCapacityMin: this.optionalNonNegativeInteger(item.suppliesCapacityMin),
      suppliesCapacityMax: this.optionalNonNegativeInteger(item.suppliesCapacityMax),
      tournamentGroupCount: this.optionalNonNegativeInteger(item.tournamentGroupCount),
      tournamentGroupCapacityMin: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMin),
      tournamentGroupCapacityMax: this.optionalNonNegativeInteger(item.tournamentGroupCapacityMax),
      tournamentLeaderboardType: item.tournamentLeaderboardType === 'Fifa' ? 'Fifa' : 'Score',
      tournamentAdvancePerGroup: this.optionalNonNegativeInteger(item.tournamentAdvancePerGroup),
      groups: (item.groups ?? []).map((group, groupIndex) => ({
        id: `${group.id ?? ''}`.trim() || `group-${index + 1}-${groupIndex + 1}`,
        name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
        source: group.source === 'manual' ? 'manual' : 'generated',
        capacityMin: this.optionalNonNegativeInteger(group.capacityMin),
        capacityMax: this.optionalNonNegativeInteger(group.capacityMax)
      })),
      slotStartOffsetMinutes: this.optionalNonNegativeInteger(item.slotStartOffsetMinutes),
      slotDurationMinutes: this.optionalNonNegativeInteger(item.slotDurationMinutes),
      stageStatus: item.stageStatus,
      stageStatusReason: item.stageStatusReason,
      stageStatusUpdatedAt: item.stageStatusUpdatedAt,
      stageFinalizedAt: item.stageFinalizedAt,
      stageFinalizedByUserId: item.stageFinalizedByUserId
    };
  }

  private normalizeEventEditorLocation(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private normalizeEventEditorVisibility(value: unknown): AppConstants.EventVisibility {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'private' || normalized.includes('friend')) {
      return 'Friends only';
    }
    if (normalized.includes('invitation')) {
      return 'Invitation only';
    }
    return 'Public';
  }

  private normalizeEventEditorFrequency(value: unknown): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'daily') {
      return 'Daily';
    }
    if (normalized === 'weekly') {
      return 'Weekly';
    }
    if (normalized.includes('bi-week') || normalized.includes('bi week')) {
      return 'Bi-weekly';
    }
    if (normalized === 'monthly') {
      return 'Monthly';
    }
    if (normalized === 'yearly' || normalized === 'annual' || normalized === 'annually') {
      return 'Yearly';
    }
    return 'One-time';
  }

  private normalizeEventEditorBlindMode(value: unknown): ContractTypes.EventBlindMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('blind') ? 'Blind Event' : 'Open Event';
  }

  private normalizeEventEditorTopics(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
      .filter(item => item.length > 0)
      .slice(0, 5);
  }

  private normalizeEventEditorTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  private parseEventEditorDateValue(value: unknown): Date | null {
    return AppUtils.parseDate(value);
  }

  private parseEventEditorOverrideDate(value: unknown): Date | null {
    return AppUtils.parseDateOnly(value);
  }

  private normalizeEventEditorSlotOverrideDate(value: unknown): string | null {
    const parsed = this.parseEventEditorOverrideDate(value);
    return parsed ? AppUtils.toIsoDate(parsed) : null;
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

  private nonNegativeInteger(value: unknown): number {
    return this.toNonNegativeIntegerOrNull(value) ?? 0;
  }

  private optionalNonNegativeInteger(value: unknown): number | undefined {
    return this.toNonNegativeIntegerOrNull(value) ?? undefined;
  }

  protected policiesCountLabel(): string {
    const count = this.eventDTO.policies.length;
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  protected requiredPoliciesCount(): number {
    return this.eventDTO.policies.filter(item => item.required !== false).length;
  }

  requestOpenLocationMap(): void {
    const routeStops = this.eventLocationRouteStops();
    if (routeStops.length <= 1) {
      this.openGoogleMapsSearch(routeStops[0] ?? this.eventDTO.location);
      return;
    }
    this.openGoogleMapsDirections(routeStops);
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
      return this.eventDTO[field] === null;
    }
    return !`${this.eventDTO[field] ?? ''}`.trim();
  }

  canSubmitEventEditorForm(): boolean {
    if (this.eventEditorService.readOnly()) {
      return false;
    }
    return Boolean(
      this.eventDTO.title.trim()
      && this.eventDTO.subtitle.trim()
      && this.eventDTO.capacityMin !== null
      && this.eventDTO.capacityMax !== null
      && this.eventDTO.startAtIso
      && this.eventDTO.endAtIso
    );
  }

  protected canConfigureSlotsSeries(): boolean {
    return !this.eventStructureReadOnly() && !this.isGeneratedSlotInstance();
  }

  protected isGeneratedSlotInstance(): boolean {
    return Boolean(this.eventDTO.generated) || this.eventDTO.eventType === 'slot';
  }

  saveEventEditorForm(): void {
    this.syncEventDTOFromDateTimeControls();
    if (!this.canSubmitEventEditorForm() || this.isSavePending) {
      return;
    }
    void this.runImmediateSave();
  }

  protected eventEditorSaveMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const canSubmit = this.canSubmitEventEditorForm();
    return [{
      id: 'event-editor-save',
      icon: 'done',
      layout: 'action',
      palette: canSubmit || this.isSavePending ? 'success' : 'danger',
      disabled: !canSubmit || this.isSavePending,
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
    this.eventDTO.visibility = this.normalizeEventEditorVisibility(option);
  }

  protected eventVisibilityMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventDTO.visibility,
      icon: this.getVisibilityIcon(this.eventDTO.visibility),
      ariaLabel: 'Open visibility selector',
      palette: this.eventVisibilityPalette(this.eventDTO.visibility),
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
      active: this.normalizeEventEditorVisibility(this.eventDTO.visibility) === option,
      checked: this.normalizeEventEditorVisibility(this.eventDTO.visibility) === option,
      palette: this.eventVisibilityPalette(option),
      surface: 'tinted',
      context: { menu: 'visibility', visibility: option }
    }));
  }

  protected eventIntelMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    return [
      {
        id: 'event-blind-mode',
        label: this.eventDTO.blindMode,
        detail: this.eventBlindModeDescription(this.eventDTO.blindMode),
        icon: this.eventBlindModeIcon(this.eventDTO.blindMode),
        kind: 'toggle',
        layout: 'big',
        active: this.normalizeEventEditorBlindMode(this.eventDTO.blindMode) === 'Blind Event',
        checked: this.normalizeEventEditorBlindMode(this.eventDTO.blindMode) === 'Blind Event',
        palette: this.normalizeEventEditorBlindMode(this.eventDTO.blindMode) === 'Blind Event' ? 'red' : 'green',
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
        active: this.eventDTO.topics.length > 0,
        checked: this.eventDTO.topics.length > 0,
        palette: 'violet',
        disabled: this.eventEditorService.readOnly(),
        closeOnSelect: false,
        filterable: true,
        ariaLabel: 'Open topics',
        model: this.eventTopicsMenuModel()
      },
      {
        id: 'event-auto-inviter',
        label: this.eventAutoInviterLabel(this.eventDTO.autoInviter),
        detail: this.eventAutoInviterDescription(this.eventDTO.autoInviter),
        icon: this.eventAutoInviterIcon(this.eventDTO.autoInviter),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDTO.autoInviter,
        checked: this.eventDTO.autoInviter,
        palette: this.eventDTO.autoInviter ? 'green' : 'slate',
        disabled: this.eventEditorService.readOnly(),
        closeOnSelect: false,
        context: { menu: 'event-intel', action: 'toggle-auto-inviter' }
      },
      {
        id: 'event-ticketing',
        label: this.eventTicketingLabel(this.eventDTO.ticketing),
        detail: this.eventTicketingDescription(this.eventDTO.ticketing),
        icon: this.eventTicketingIcon(this.eventDTO.ticketing),
        kind: 'toggle',
        layout: 'big',
        active: this.eventDTO.ticketing,
        checked: this.eventDTO.ticketing,
        palette: this.eventDTO.ticketing ? 'green' : 'blue',
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
      selected: this.eventDTO.topics,
      maxSelected: 5,
      context: topic => ({ menu: 'topics', topic }),
      normalize: topic => this.normalizeEventEditorTopicToken(topic),
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
    switch (this.normalizeEventEditorVisibility(visibility)) {
      case 'Friends only':
        return 'groups';
      case 'Invitation only':
        return 'mail_lock';
      default:
        return 'public';
    }
  }

  eventVisibilityClass(visibility: string): string {
    switch (this.normalizeEventEditorVisibility(visibility)) {
      case 'Friends only':
        return 'event-visibility-friends';
      case 'Invitation only':
        return 'event-visibility-invitation';
      default:
        return 'event-visibility-public';
    }
  }

  private eventVisibilityPalette(visibility: string): AppMenuPalette {
    switch (this.normalizeEventEditorVisibility(visibility)) {
      case 'Friends only':
        return 'blue';
      case 'Invitation only':
        return 'amber';
      default:
        return 'green';
    }
  }

  eventBlindModeIcon(mode: string): string {
    return this.normalizeEventEditorBlindMode(mode) === 'Blind Event' ? 'visibility_off' : 'visibility';
  }

  eventBlindModeDescription(mode: string): string {
    return this.normalizeEventEditorBlindMode(mode) === 'Blind Event'
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

  eventFrequencyIcon(frequency: string): string {
    switch (this.normalizeEventEditorFrequency(frequency)) {
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
      label: this.eventDTO.frequency,
      icon: this.eventFrequencyIcon(this.eventDTO.frequency),
      ariaLabel: 'Open event frequency',
      palette: this.eventFrequencyPalette(this.eventDTO.frequency),
      disabled: this.eventStructureReadOnly(),
      layout: 'field'
    };
  }

  protected eventFrequencyMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const current = this.normalizeEventEditorFrequency(this.eventDTO.frequency);
    return this.eventFrequencyOptions.map(option => {
      const normalized = this.normalizeEventEditorFrequency(option);
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
      this.saveEventEditorForm();
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
    const normalizedTopics = this.normalizeEventEditorTopics(this.eventDTO.topics);
    const normalizedTopic = this.normalizeEventEditorTopicToken(topic);
    if (!normalizedTopic) {
      return;
    }
    const existingIndex = normalizedTopics.findIndex(item =>
      this.normalizeEventEditorTopicToken(item) === normalizedTopic
    );
    if (action === 'remove') {
      if (existingIndex < 0) {
        return;
      }
      this.eventDTO.topics = normalizedTopics.filter((_, index) => index !== existingIndex);
      return;
    }
    if (existingIndex >= 0) {
      this.eventDTO.topics = normalizedTopics.filter((_, index) => index !== existingIndex);
      return;
    }
    if (normalizedTopics.length >= 5) {
      return;
    }
    this.eventDTO.topics = this.normalizeEventEditorTopics([...normalizedTopics, topic]);
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
    switch (this.normalizeEventEditorFrequency(frequency)) {
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
    this.eventDTO.frequency = this.normalizeEventEditorFrequency(value);
    this.eventDTO.slotsEnabled = this.eventFrequencyUsesSlots();
    if (!this.eventDTO.slotsEnabled) {
      this.eventDTO.slotTemplates = [];
      this.showSlotsPopup = false;
      this.slotEditorMode = 'base';
    } else if (this.baseSlotTemplates().length === 0) {
      this.slotEditorMode = 'base';
      this.addSlotTemplate();
    }
    this.normalizeSlotOverrideDateSelection();
    this.normalizeEventSlotTemplates();
  }

  protected eventEndDateMin(): Date | null {
    const start = this.eventStartDateValue ?? AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    if (!start) {
      return null;
    }
    return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  protected eventFrequencyUsesSlots(): boolean {
    return this.normalizeEventEditorFrequency(this.eventDTO.frequency) !== 'One-time';
  }

  subEventsCountLabel(): string {
    const count = this.eventDTO.subEvents.length;
    return count === 1 ? '1 item' : `${count} items`;
  }

  subEventsCurrentHeaderLabel(): string {
    const current = this.currentSubEventPanelState();
    if (!current) {
      return '';
    }
    return this.subEventPanelChipTitle(current.item, current.index);
  }

  subEventLocationLabel(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    const location = this.normalizeEventEditorLocation(subEvent?.location).trim();
    return location || 'Location pending';
  }

  subEventPanelChipTitle(subEvent: ContractTypes.SubEventDTO, index: number): string {
    const baseName = (this.subEventName(subEvent) || 'Untitled').trim() || 'Untitled';
    if (this.subEventsDisplayMode !== 'Tournament') {
      return baseName;
    }
    return `Stage ${index + 1} - ${baseName}`;
  }

  subEventPanelChipTrackId(index: number, subEvent: ContractTypes.SubEventDTO): string {
    const id = `${subEvent.id ?? ''}`.trim();
    if (id) {
      return id;
    }
    return [
      index,
      `${subEvent.startAt ?? ''}`.trim(),
      `${subEvent.endAt ?? ''}`.trim(),
      this.subEventName(subEvent).trim()
    ].join(':');
  }

  subEventCardRange(subEvent: ContractTypes.SubEventDTO): string {
    const start = this.parseEventEditorDateValue(subEvent.startAt);
    const end = this.parseEventEditorDateValue(subEvent.endAt);
    if (!start || !end) {
      return 'Date pending';
    }
    const startLabel = `${AppUtils.pad2(start.getMonth() + 1)}/${AppUtils.pad2(start.getDate())} ${AppUtils.pad2(start.getHours())}:${AppUtils.pad2(start.getMinutes())}`;
    const endLabel = `${AppUtils.pad2(end.getMonth() + 1)}/${AppUtils.pad2(end.getDate())} ${AppUtils.pad2(end.getHours())}:${AppUtils.pad2(end.getMinutes())}`;
    return `${startLabel} - ${endLabel}`;
  }

  subEventPanelChipIsCurrent(subEvent: ContractTypes.SubEventDTO): boolean {
    const source = EventEditorBuilder.sortEventEditorSubEventRefsByStartAsc(this.eventDTO.subEvents);
    if (source.length === 0) {
      return false;
    }
    const currentIndex = this.resolveCurrentSubEventIndex(source);
    const current = source[currentIndex] ?? source[0] ?? null;
    if (!current) {
      return false;
    }
    if (current === subEvent) {
      return true;
    }
    if (current.id && subEvent.id) {
      return current.id === subEvent.id;
    }
    return current.startAt === subEvent.startAt
      && current.endAt === subEvent.endAt
      && this.subEventName(current) === this.subEventName(subEvent);
  }

  subEventPanelChipStyle(index: number): Record<string, string> {
    if (this.subEventsDisplayMode === 'Tournament') {
      const totalStages = Math.max(1, this.eventDTO.subEvents.length);
      const stageNumber = AppUtils.clampNumber(index + 1, 1, totalStages);
      const hue = this.subEventStageAccentHue(stageNumber, totalStages);
      return {
        borderColor: `hsl(${hue} 54% 58% / 0.52)`,
        background: `linear-gradient(180deg, hsl(${hue} 92% 96%) 0%, hsl(${hue} 84% 90%) 100%)`,
        color: `hsl(${hue} 48% 34%)`
      };
    }

    const subEvent = this.eventDTO.subEvents[index] ?? null;
    if (!subEvent) {
      return {};
    }

    if (subEvent.optional) {
      return {
        borderColor: 'rgba(63, 118, 188, 0.34)',
        background: 'linear-gradient(180deg, #f1f9ff 0%, #e8f3ff 100%)',
        color: '#2b5c95'
      };
    }

    return {
      borderColor: 'rgba(175, 78, 78, 0.34)',
      background: 'linear-gradient(180deg, #fff3f3 0%, #ffe9e9 100%)',
      color: '#8f3a3a'
    };
  }

  subEventsDisplayModeClass(mode: string = this.subEventsDisplayMode): string {
    return mode === 'Tournament' ? 'subevents-mode-tournament' : 'subevents-mode-casual';
  }

  subEventsDisplayModeIcon(mode: string = this.subEventsDisplayMode): string {
    return mode === 'Tournament' ? 'emoji_events' : 'groups';
  }

  eventTopicLabel(topic: string): string {
    return `#${topic.replace(/^#+/, '')}`;
  }

  triggerEventImageUpload(event: Event): void {
    event.preventDefault();
    this.eventImageInput?.nativeElement?.click();
  }

  onEventImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    if (this.pendingEventImageFile && this.eventDTO.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.eventDTO.imageUrl);
    }
    this.pendingEventImageFile = file;
    this.eventDTO.imageUrl = URL.createObjectURL(file);
    target.value = '';
  }

  onEventCapacityMinChange(value: number | string): void {
    if (this.eventCapacityMinReadOnly()) {
      return;
    }
    const parsed = this.toNonNegativeIntegerOrNull(value);
    this.eventDTO.capacityMin = parsed;
    if (
      this.eventDTO.capacityMin !== null
      && this.eventDTO.capacityMax !== null
      && this.eventDTO.capacityMax < this.eventDTO.capacityMin
    ) {
      this.eventDTO.capacityMax = this.eventDTO.capacityMin;
    }
  }

  onEventCapacityMaxChange(value: number | string): void {
    const parsed = this.toNonNegativeIntegerOrNull(value);
    this.eventDTO.capacityMax = parsed === null ? null : Math.max(parsed, this.eventCapacityMaxMinimum());
  }

  onEventCapacityMaxBlur(): void {
    if (this.eventDTO.capacityMax !== null) {
      this.eventDTO.capacityMax = Math.max(this.eventDTO.capacityMax, this.eventCapacityMaxMinimum());
    }
    if (
      this.eventDTO.capacityMin !== null
      && this.eventDTO.capacityMax !== null
      && this.eventDTO.capacityMax < this.eventDTO.capacityMin
    ) {
      this.eventDTO.capacityMax = this.eventDTO.capacityMin;
    }
  }

  toggleEventBlindMode(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDTO.blindMode = this.eventDTO.blindMode === 'Blind Event' ? 'Open Event' : 'Blind Event';
  }

  toggleEventAutoInviter(event: Event): void {
    event.preventDefault();
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.eventDTO.autoInviter = !this.eventDTO.autoInviter;
  }

  toggleEventTicketing(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDTO.ticketing = !this.eventDTO.ticketing;
  }

  toggleEventSlots(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventDTO.slotsEnabled = this.eventFrequencyUsesSlots();
  }

  protected toggleSlotsPanelExpanded(event?: Event): void {
    event?.preventDefault();
    this.slotsPanelExpanded = !this.slotsPanelExpanded;
  }

  protected selectSlotEditorMode(mode: 'base' | 'date', event?: Event): void {
    event?.preventDefault();
    if (!this.eventFrequencyUsesSlots() || !this.canConfigureSlotsSeries()) {
      return;
    }
    if (this.slotEditorMode === mode) {
      return;
    }
    this.slotEditorMode = mode;
    if (mode === 'date' && !this.slotOverrideDateValue) {
      this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    }
    this.normalizeSlotOverrideDateSelection();
  }

  protected isDateSlotEditorMode(): boolean {
    return this.slotEditorMode === 'date';
  }

  protected showSlotOverrideDatePicker(): boolean {
    return this.isDateSlotEditorMode();
  }

  protected isSlotOverrideDateFieldLocked(): boolean {
    return false;
  }

  protected slotEditorModeButtonClass(mode: 'base' | 'date'): string {
    if (this.slotEditorMode !== mode) {
      return '';
    }
    return mode === 'date' ? 'event-slot-mode-btn-active-date' : 'event-slot-mode-btn-active-base';
  }

  protected activeSlotTemplates(): ContractTypes.EventSlotTemplateDTO[] {
    if (this.slotEditorMode === 'base') {
      return EventEditorBuilder.cloneEventEditorSlotTemplates(this.baseSlotTemplates());
    }
    const dateKey = this.selectedSlotOverrideDateKey();
    if (!dateKey) {
      return [];
    }
    const explicit = this.overrideSlotTemplatesForDate(dateKey);
    if (explicit.length > 0) {
      if (explicit.some(item => item.closed === true)) {
        return [];
      }
      return EventEditorBuilder.cloneEventEditorSlotTemplates(explicit);
    }
    return this.projectBaseSlotTemplatesToDate(dateKey);
  }

  protected slotEditorModeDescription(): string {
    if (this.slotEditorMode === 'date') {
      if (this.isSpecificDateClosed()) {
        return 'This date has its own override and currently has no slots.';
      }
      return this.hasExplicitSlotOverride()
        ? 'Editing one recurring slot window. The preview date chooses the occurrence, and the slot rows stay editable inside that cycle and the overall event range.'
        : 'This occurrence starts as a shifted copy of the base schedule. Pick the preview date above, then adjust the slot rows directly inside that cycle.';
    }
    return 'Base slots can start anywhere inside the main event range. Each slot still respects the selected frequency boundary and cannot overlap the others.';
  }

  protected slotOverrideDateMin(): Date | null {
    const start = AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    return start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null;
  }

  protected slotOverrideDateMax(): Date | null {
    const end = AppUtils.isoLocalDateTimeToDate(this.eventDTO.endAtIso);
    return end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
  }

  protected onSlotOverrideDateChange(value: Date | null): void {
    this.slotOverrideDateValue = value;
    this.normalizeSlotOverrideDateSelection();
  }

  protected slotTrackId(index: number, slot: ContractTypes.EventSlotTemplateDTO): string {
    return `${slot.overrideDate ?? 'base'}:${slot.id || `slot-${index + 1}`}:${slot.startAt}:${slot.endAt}`;
  }

  addSlotTemplate(): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.ensureSpecificDateOverrideSeeded();
    const currentTemplates = this.resolveActiveSlotTemplatesForEditing();
    const nextIndex = currentTemplates.length + 1;
    const startAt = currentTemplates[currentTemplates.length - 1]?.endAt
      || this.defaultSlotStartForActiveScope()
      || this.eventDTO.startAtIso
      || AppUtils.toIsoDateTimeLocal(new Date());
    const startDate = this.parseEventEditorDateValue(startAt) ?? new Date();
    const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
    this.setActiveSlotTemplates([
      ...currentTemplates,
      {
        id: this.buildSlotTemplateId(nextIndex),
        startAt: AppUtils.toIsoDateTimeLocal(startDate),
        endAt: AppUtils.toIsoDateTimeLocal(endDate),
        overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
        closed: false
      }
    ]);
  }

  removeSlotTemplate(index: number): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.ensureSpecificDateOverrideSeeded();
    const currentTemplates = this.resolveActiveSlotTemplatesForEditing();
    this.setActiveSlotTemplates(currentTemplates
      .filter((_, currentIndex) => currentIndex !== index)
      .map((item, currentIndex) => ({
        ...item,
        id: item.id?.trim() || this.buildSlotTemplateId(currentIndex + 1),
        overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
        closed: false
      })));
  }

  slotTemplateLabel(index: number): string {
    return `Slot ${index + 1}`;
  }

  protected slotTemplateStartDateValue(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    return this.slotControlDateValue(slot.startAt);
  }

  protected slotTemplateStartTimeValue(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    return this.slotControlDateValue(slot.startAt);
  }

  protected slotTemplateEndDateValue(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    return this.slotControlDateValue(slot.endAt);
  }

  protected slotTemplateEndTimeValue(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    return this.slotControlDateValue(slot.endAt);
  }

  protected slotTemplateDateMin(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!window) {
      return null;
    }
    return new Date(window.start.getFullYear(), window.start.getMonth(), window.start.getDate());
  }

  protected slotTemplateDateMax(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!window) {
      return null;
    }
    return new Date(window.end.getFullYear(), window.end.getMonth(), window.end.getDate());
  }

  protected slotTemplateEndDateMin(slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    const start = this.parseEventEditorDateValue(slot.startAt);
    if (!start) {
      return this.slotTemplateDateMin(slot);
    }
    return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  protected slotTemplateEndDateMax(index: number, slot: ContractTypes.EventSlotTemplateDTO): Date | null {
    const start = this.parseEventEditorDateValue(slot.startAt);
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!start || !window) {
      return this.slotTemplateDateMax(slot);
    }
    const boundaryEnd = this.eventFrequencyBoundaryEnd(start, this.eventDTO.frequency) ?? window.end;
    const nextSlot = this.activeSlotTemplates()[index + 1] ?? null;
    const nextStart = nextSlot ? this.parseEventEditorDateValue(nextSlot.startAt) : null;
    const maxDate = new Date(Math.min(
      window.end.getTime(),
      boundaryEnd.getTime(),
      nextStart?.getTime() ?? boundaryEnd.getTime()
    ));
    return new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
  }

  onSlotTemplateStartDateChange(index: number, value: Date | null): void {
    if (!this.canConfigureSlotsSeries() || this.isSlotOverrideDateFieldLocked()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      ...this.shiftSlotByStartChange(item, AppUtils.applyDatePartToIsoLocal(item.startAt, value)),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  onSlotTemplateStartTimeChange(index: number, value: Date | null): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      ...this.shiftSlotByStartChange(item, AppUtils.applyTimePartFromDateToIsoLocal(item.startAt, value)),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  onSlotTemplateEndDateChange(index: number, value: Date | null): void {
    if (!this.canConfigureSlotsSeries() || this.isSlotOverrideDateFieldLocked()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      endAt: AppUtils.applyDatePartToIsoLocal(item.endAt, value),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  onSlotTemplateEndTimeChange(index: number, value: Date | null): void {
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      endAt: AppUtils.applyTimePartFromDateToIsoLocal(item.endAt, value),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  protected hasExplicitSlotOverride(): boolean {
    const dateKey = this.selectedSlotOverrideDateKey();
    return !!dateKey && this.overrideSlotTemplatesForDate(dateKey).length > 0;
  }

  onEventLocationChange(value: string): void {
    this.eventDTO.location = this.normalizeEventEditorLocation(value);
    this.syncFirstSubEventLocationFromMainEvent();
  }

  onEventStartDateChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventStartDateValue = value;
    this.syncEventDTOFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromDTO();
  }

  onEventStartTimeChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventStartTimeValue = value;
    this.syncEventDTOFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromDTO();
  }

  onEventEndDateChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventEndDateValue = value;
    this.syncEventDTOFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromDTO();
  }

  onEventEndTimeChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventEndTimeValue = value;
    this.syncEventDTOFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromDTO();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.eventEditorService.isOpen() || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.showSlotsPopup) {
      this.showSlotsPopup = false;
      return;
    }
    if (this.showPolicyEditorPopup) {
      this.closePolicyEditor();
      return;
    }
    if (this.showPoliciesPopup) {
      this.closePoliciesPopup();
      return;
    }
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
      const eventDTO = await this.eventEditorDataService.loadFullItemById(activeUserId, eventId);

      this.isLoadingEventData.set(false);
      if (!eventDTO) {
        return;
      }

      this.editorTarget = this.eventDTOBelongsToActiveAdmin(eventDTO) ? 'hosting' : target;
      this.editingEventId = eventDTO.id;
      this.openEventDTO(eventDTO, readOnly, this.editorTarget);
    } catch {
      this.isLoadingEventData.set(false);
    }
  }

  private openEventDTO(eventDTO: ActivityEventDetailDTO, readOnly: boolean, _target: ContractTypes.EventEditorTarget): void {
    if (readOnly) {
      this.eventEditorService.openView(eventDTO);
      return;
    }
    this.eventEditorService.openEdit(eventDTO);
  }

  private async persistEventEditorForm(options: { allowIncomplete?: boolean } = {}): Promise<boolean> {
    if (this.eventEditorService.readOnly()) {
      return false;
    }

    this.syncEventDTOFromDateTimeControls();
    this.normalizeEventDateRange();
    this.normalizeEventSlotTemplates();
    this.syncFirstSubEventLocationFromMainEvent();
    if (this.showPoliciesPopup || this.showPolicyEditorPopup) {
      this.syncEventPoliciesFromWorkingPolicies();
    }
    const normalizedCapacity = EventEditorBuilder.normalizedEventEditorCapacityRange(this.eventDTO.capacityMin, this.eventDTO.capacityMax);
    this.eventDTO.capacityMin = normalizedCapacity.min;
    this.eventDTO.capacityMax = normalizedCapacity.max;
    if (!options.allowIncomplete && !this.canSubmitEventEditorForm()) {
      return false;
    }

    const activeUserId = this.activeUserId();
    const eventId = this.eventDTO.id.trim()
      || this.editingEventId
      || this.draftEventId
      || EventEditorBuilder.buildCreatedEventEditorId(this.editorTarget);
    this.eventDTO.id = eventId;
    const uploadedImageUrl = await this.resolvePersistedEventImageUrl(activeUserId, eventId);
    if (!this.localModeEnabled && this.pendingEventImageFile && !uploadedImageUrl) {
      return false;
    }
    if (uploadedImageUrl) {
      this.eventDTO.imageUrl = uploadedImageUrl;
    }
    const memberSummary = await this.resolveCurrentEventMembersSummary(eventId, normalizedCapacity);
    this.currentMemberSummary = memberSummary;
    const saveDTO = this.buildActivityEventSaveDTO({
      allowIncomplete: options.allowIncomplete === true,
      memberSummary,
      activeUserId: activeUserId || null,
      activeUserProfile: activeUserId ? this.appCtx.getUserProfile(activeUserId) : null
    });

    const displaySync = await this.activitiesService.saveActivityEvent(saveDTO, {
      activeUserId
    });
    this.activitiesContext.emitActivityEventSaveResult(displaySync);
    return true;
  }

  private buildActivityEventSaveDTO(input: {
    allowIncomplete: boolean;
    memberSummary: {
      acceptedMembers: number;
      pendingMembers: number;
      capacityTotal: number;
    };
    activeUserId: string | null;
    activeUserProfile: {
      name?: string;
      initials?: string;
      gender?: AppConstants.UserGender;
      city?: string;
    } | null;
  }): ContractTypes.ActivityEventSaveDTO {
    const dto = this.eventDTO;
    const title = input.allowIncomplete
      ? (dto.title.trim() || 'Untitled draft event')
      : dto.title;
    const subtitle = input.allowIncomplete
      ? (dto.subtitle.trim() || 'Draft event in progress')
      : dto.subtitle;
    const frequency = this.normalizeEventEditorFrequency(dto.frequency);
    const persistedSlotTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(dto.slotTemplates ?? []);
    const slotCatalog = PricingBuilder.slotCatalogFromEventSlotTemplates(persistedSlotTemplates);
    const hasSlots = frequency !== 'One-time';

    return {
      id: dto.id,
      title: title.trim(),
      shortDescription: subtitle.trim(),
      timeframe: EventEditorBuilder.buildEventEditorTimeframeLabel(dto.startAtIso, dto.endAtIso, frequency),
      activity: dto.activity ?? 0,
      startAt: dto.startAtIso,
      endAt: dto.endAtIso,
      distanceKm: dto.distanceKm ?? 0,
      imageUrl: dto.imageUrl,
      acceptedMembers: input.memberSummary.acceptedMembers,
      pendingMembers: input.memberSummary.pendingMembers,
      capacityTotal: Math.max(input.memberSummary.acceptedMembers, input.memberSummary.capacityTotal),
      capacityMin: dto.capacityMin,
      capacityMax: dto.capacityMax,
      autoInviter: dto.autoInviter === true,
      frequency,
      ticketing: dto.ticketing === true,
      pricing: PricingBuilder.compactPricingConfig(
        PricingBuilder.syncSlotOverrides(dto.pricing, slotCatalog),
        {
          context: 'event',
          slotCatalog,
          allowSlotFeatures: true
        }
      ),
      policies: EventEditorBuilder.buildPersistedEventEditorPolicies(dto.policies ?? []),
      slotsEnabled: hasSlots,
      slotTemplates: hasSlots ? persistedSlotTemplates : [],
      visibility: this.normalizeEventEditorVisibility(dto.visibility),
      blindMode: this.normalizeEventEditorBlindMode(dto.blindMode),
      status: dto.status ?? 'DR',
      creatorUserId: dto.creatorUserId || input.activeUserId || undefined,
      creatorName: dto.creatorName || input.activeUserProfile?.name,
      creatorInitials: dto.creatorInitials || input.activeUserProfile?.initials,
      creatorGender: dto.creatorGender ?? input.activeUserProfile?.gender,
      creatorCity: dto.creatorCity || input.activeUserProfile?.city,
      location: this.normalizeEventEditorLocation(dto.location).trim(),
      locationCoordinates: dto.locationCoordinates ?? undefined,
      sourceLink: dto.sourceLink ?? '',
      parentEventId: dto.parentEventId ?? null,
      slotTemplateId: dto.slotTemplateId ?? null,
      generated: dto.generated === true,
      eventType: dto.eventType ?? 'main',
      topics: this.normalizeEventEditorTopics(dto.topics ?? []),
      subEvents: EventEditorBuilder.buildPersistedEventEditorSubEvents(dto.subEvents ?? []),
      subEventsDisplayMode: this.subEventsDisplayMode ?? dto.subEventsDisplayMode ?? 'Casual',
      paymentSessionId: dto.paymentSessionId ?? null
    };
  }

  private async runImmediateSave(): Promise<void> {
    this.isSavePending = true;
    try {
      const saved = await this.persistEventEditorForm();
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

  private get localModeEnabled(): boolean {
    return environment.activitiesDataSource === 'local';
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
    return this.editorTarget === 'hosting' && this.eventDTO.status === 'DR';
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
      const saved = await this.persistEventEditorForm({ allowIncomplete: true });
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
      mode: this.eventEditorService.mode(),
      readOnly: this.eventEditorService.readOnly(),
      editingEventId: this.editingEventId,
      draftEventId: this.draftEventId,
      subEventsDisplayMode: this.subEventsDisplayMode,
      form: {
        ...this.eventDTO,
        topics: [...this.eventDTO.topics],
        pricing: PricingBuilder.clonePricingConfig(this.eventDTO.pricing),
        policies: EventEditorBuilder.cloneEventEditorPolicies(this.eventDTO.policies),
        slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(this.eventDTO.slotTemplates),
        subEvents: EventEditorBuilder.cloneEventEditorSubEvents(this.eventDTO.subEvents)
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
    this.pendingEventImageFile = null;
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

  private eventDTOBelongsToActiveAdmin(eventDTO: ActivityEventDetailDTO): boolean {
    const activeUserId = this.activeUserId();
    return !!activeUserId && (eventDTO.adminIds ?? []).includes(activeUserId);
  }

  private baseSlotTemplates(): ContractTypes.EventSlotTemplateDTO[] {
    return this.eventDTO.slotTemplates
      .filter(item => !this.normalizeEventEditorSlotOverrideDate(item.overrideDate))
      .filter(item => item.closed !== true)
      .map(item => ({
        ...item,
        overrideDate: null,
        closed: false
      }));
  }

  private overrideSlotTemplatesForDate(dateKey: string): ContractTypes.EventSlotTemplateDTO[] {
    if (!dateKey) {
      return [];
    }
    return this.eventDTO.slotTemplates
      .filter(item => this.normalizeEventEditorSlotOverrideDate(item.overrideDate) === dateKey)
      .map(item => ({
        ...item,
        overrideDate: dateKey,
        closed: item.closed === true
      }));
  }

  private selectedSlotOverrideDateKey(): string {
    return this.normalizeEventEditorSlotOverrideDate(this.slotOverrideDateValue) ?? '';
  }

  private defaultSlotOverrideDate(): Date | null {
    const firstOverrideDate = this.eventDTO.slotTemplates
      .map(item => this.parseEventEditorOverrideDate(item.overrideDate))
      .find((value): value is Date => Boolean(value));
    if (firstOverrideDate) {
      return new Date(firstOverrideDate.getFullYear(), firstOverrideDate.getMonth(), firstOverrideDate.getDate());
    }
    const eventStart = AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    return eventStart
      ? new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate())
      : null;
  }

  private normalizeSlotOverrideDateSelection(): void {
    let next = this.slotOverrideDateValue ?? this.defaultSlotOverrideDate();
    if (!next) {
      this.slotOverrideDateValue = null;
      return;
    }
    const min = this.slotOverrideDateMin();
    const max = this.slotOverrideDateMax();
    let nextMs = new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime();
    if (min && nextMs < min.getTime()) {
      nextMs = min.getTime();
    }
    if (max && nextMs > max.getTime()) {
      nextMs = max.getTime();
    }
    const normalized = new Date(nextMs);
    this.slotOverrideDateValue = new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
  }

  private buildSlotTemplateId(index: number): string {
    if (this.slotEditorMode === 'date') {
      const dateKey = this.selectedSlotOverrideDateKey() || 'date';
      return `override-${dateKey}-slot-${index}`;
    }
    return `slot-${index}`;
  }

  private projectBaseSlotTemplatesToDate(dateKey: string): ContractTypes.EventSlotTemplateDTO[] {
    const window = this.slotWindowForOverrideDate(dateKey);
    const baseStart = AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    if (!window || !baseStart) {
      return [];
    }
    const shiftMs = window.start.getTime() - baseStart.getTime();
    return this.baseSlotTemplates().map((item, index) => ({
      id: item.id?.trim()
        ? `override-${dateKey}-${item.id.trim()}`
        : this.buildSlotTemplateId(index + 1),
      startAt: this.shiftSlotDateTimeByMs(item.startAt, shiftMs),
      endAt: this.shiftSlotDateTimeByMs(item.endAt, shiftMs),
      overrideDate: dateKey,
      closed: false
    }));
  }

  private resolveActiveSlotTemplatesForEditing(): ContractTypes.EventSlotTemplateDTO[] {
    return EventEditorBuilder.cloneEventEditorSlotTemplates(this.activeSlotTemplates());
  }

  private updateSlotTemplate(
    index: number,
    updater: (item: ContractTypes.EventSlotTemplateDTO) => ContractTypes.EventSlotTemplateDTO
  ): void {
    this.ensureSpecificDateOverrideSeeded();
    const currentTemplates = this.resolveActiveSlotTemplatesForEditing();
    this.setActiveSlotTemplates(currentTemplates.map((item, currentIndex) => (
      currentIndex !== index ? { ...item } : updater({ ...item })
    )));
  }

  private ensureSpecificDateOverrideSeeded(): void {
    if (this.slotEditorMode !== 'date') {
      return;
    }
    const dateKey = this.selectedSlotOverrideDateKey();
    if (!dateKey || this.overrideSlotTemplatesForDate(dateKey).length > 0) {
      return;
    }
    const base = this.baseSlotTemplates().map(item => ({ ...item, overrideDate: null }));
    const otherOverrides = this.eventDTO.slotTemplates
      .filter(item => {
        const overrideDate = this.normalizeEventEditorSlotOverrideDate(item.overrideDate);
        return overrideDate && overrideDate !== dateKey;
      })
      .map(item => ({ ...item }));
    this.eventDTO.slotTemplates = [
      ...base,
      ...otherOverrides,
      ...this.projectBaseSlotTemplatesToDate(dateKey)
    ];
  }

  private setActiveSlotTemplates(nextTemplates: ContractTypes.EventSlotTemplateDTO[]): void {
    const normalizedTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(
      this.normalizeEditableSlotTemplates(nextTemplates)
    );
    if (this.slotEditorMode === 'base') {
      const overrides = this.eventDTO.slotTemplates
        .filter(item => this.normalizeEventEditorSlotOverrideDate(item.overrideDate))
        .map(item => ({ ...item }));
      this.eventDTO.slotTemplates = [
        ...normalizedTemplates.map(item => ({ ...item, overrideDate: null, closed: false })),
        ...overrides
      ];
      return;
    }

    const dateKey = this.selectedSlotOverrideDateKey();
    const base = this.baseSlotTemplates().map(item => ({ ...item, overrideDate: null, closed: false }));
    const otherOverrides = this.eventDTO.slotTemplates
      .filter(item => {
        const overrideDate = this.normalizeEventEditorSlotOverrideDate(item.overrideDate);
        return overrideDate && overrideDate !== dateKey;
      })
      .map(item => ({ ...item }));
    const currentOverride = normalizedTemplates.length > 0
      ? normalizedTemplates.map(item => ({ ...item, overrideDate: dateKey || null, closed: false }))
      : (dateKey ? [this.buildClosedDateOverridePlaceholder(dateKey)] : []);
    this.eventDTO.slotTemplates = [
      ...base,
      ...otherOverrides,
      ...currentOverride
    ];
  }

  private buildClosedDateOverridePlaceholder(dateKey: string): ContractTypes.EventSlotTemplateDTO {
    return {
      id: `override-${dateKey}-closed`,
      startAt: '',
      endAt: '',
      overrideDate: dateKey,
      closed: true
    };
  }

  private isSpecificDateClosed(): boolean {
    const dateKey = this.selectedSlotOverrideDateKey();
    return !!dateKey && this.overrideSlotTemplatesForDate(dateKey).some(item => item.closed === true);
  }

  private defaultSlotStartForActiveScope(): string {
    return this.slotWindowForEditing()?.startAt ?? this.eventDTO.startAtIso;
  }

  private normalizeSlotTemplateBounds(slot: ContractTypes.EventSlotTemplateDTO): ContractTypes.EventSlotTemplateDTO {
    const window = this.slotWindowForEditing(slot.overrideDate);
    const fallbackStart = window?.start ?? this.parseEventEditorDateValue(this.eventDTO.startAtIso) ?? new Date();
    const fallbackEnd = window?.end ?? this.parseEventEditorDateValue(this.eventDTO.endAtIso) ?? new Date(fallbackStart.getTime() + (60 * 60 * 1000));
    const windowStartMs = fallbackStart.getTime();
    const windowEndMs = Math.max(windowStartMs + (60 * 1000), fallbackEnd.getTime());

    let startDate = this.parseEventEditorDateValue(slot.startAt) ?? new Date(fallbackStart);
    let startMs = startDate.getTime();
    const maxStartMs = Math.max(windowStartMs, windowEndMs - (60 * 1000));
    startMs = Math.min(maxStartMs, Math.max(windowStartMs, startMs));
    startDate = new Date(startMs);

    const slotBoundaryEndMs = Math.min(
      windowEndMs,
      this.eventFrequencyBoundaryEnd(startDate, this.eventDTO.frequency)?.getTime() ?? windowEndMs
    );

    let endDate = this.parseEventEditorDateValue(slot.endAt);
    let endMs = endDate?.getTime() ?? (startMs + (60 * 60 * 1000));
    if (endMs <= startMs) {
      endMs = startMs + (60 * 60 * 1000);
    }
    endMs = Math.min(slotBoundaryEndMs, endMs);
    if (endMs <= startMs) {
      endMs = Math.min(slotBoundaryEndMs, startMs + (60 * 1000));
    }
    if (endMs <= startMs) {
      startMs = Math.max(windowStartMs, slotBoundaryEndMs - (60 * 1000));
      endMs = slotBoundaryEndMs;
      startDate = new Date(startMs);
    }
    const normalizedEnd = new Date(endMs);
    return {
      ...slot,
      startAt: AppUtils.toIsoDateTimeLocal(startDate),
      endAt: AppUtils.toIsoDateTimeLocal(normalizedEnd)
    };
  }

  private normalizeEditableSlotTemplates(
    nextTemplates: readonly ContractTypes.EventSlotTemplateDTO[]
  ): ContractTypes.EventSlotTemplateDTO[] {
    let normalized = EventEditorBuilder.cloneEventEditorSlotTemplates(nextTemplates)
      .map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }));
    for (let index = 0; index < normalized.length; index += 1) {
      normalized = this.normalizeSlotTemplateWithNeighbors(normalized, index);
    }
    return normalized;
  }

  private normalizeSlotTemplateWithNeighbors(
    items: readonly ContractTypes.EventSlotTemplateDTO[],
    index: number
  ): ContractTypes.EventSlotTemplateDTO[] {
    const current = items[index];
    if (!current || current.closed === true) {
      return [...items];
    }

    const nextItems = items.map(item => ({ ...item }));
    const scopeKey = this.normalizeEventEditorSlotOverrideDate(current.overrideDate) ?? '';
    const previous = [...nextItems]
      .slice(0, index)
      .reverse()
      .find(item => (this.normalizeEventEditorSlotOverrideDate(item.overrideDate) ?? '') === scopeKey && item.closed !== true);
    const upcoming = nextItems
      .slice(index + 1)
      .find(item => (this.normalizeEventEditorSlotOverrideDate(item.overrideDate) ?? '') === scopeKey && item.closed !== true);
    const window = this.slotWindowForEditing(current.overrideDate);
    const fallbackStart = window?.start ?? this.parseEventEditorDateValue(this.eventDTO.startAtIso) ?? new Date();
    const fallbackEnd = window?.end ?? this.parseEventEditorDateValue(this.eventDTO.endAtIso) ?? new Date(fallbackStart.getTime() + (60 * 60 * 1000));
    const previousEnd = previous ? this.parseEventEditorDateValue(previous.endAt) : null;
    const upcomingStart = upcoming ? this.parseEventEditorDateValue(upcoming.startAt) : null;
    const currentStart = this.parseEventEditorDateValue(current.startAt) ?? new Date(fallbackStart);
    const currentEnd = this.parseEventEditorDateValue(current.endAt) ?? new Date(currentStart.getTime() + (60 * 60 * 1000));
    const durationMs = Math.max(60 * 1000, currentEnd.getTime() - currentStart.getTime());

    const minStartMs = Math.max(fallbackStart.getTime(), previousEnd?.getTime() ?? fallbackStart.getTime());
    const slotBoundaryEndMs = Math.min(
      fallbackEnd.getTime(),
      this.eventFrequencyBoundaryEnd(currentStart, this.eventDTO.frequency)?.getTime() ?? fallbackEnd.getTime()
    );
    const maxEndMs = Math.min(slotBoundaryEndMs, upcomingStart?.getTime() ?? slotBoundaryEndMs);
    const maxStartMs = Math.max(minStartMs, maxEndMs - (60 * 1000));
    let startMs = Math.max(minStartMs, Math.min(currentStart.getTime(), maxStartMs));
    let endMs = Math.min(maxEndMs, startMs + durationMs);

    if (endMs <= startMs) {
      endMs = Math.min(maxEndMs, startMs + (60 * 1000));
    }
    if (endMs <= startMs) {
      startMs = Math.max(minStartMs, maxEndMs - (60 * 1000));
      endMs = maxEndMs;
    }

    nextItems[index] = {
      ...current,
      startAt: AppUtils.toIsoDateTimeLocal(new Date(startMs)),
      endAt: AppUtils.toIsoDateTimeLocal(new Date(endMs))
    };
    return nextItems;
  }

  private shiftSlotByStartChange(
    slot: ContractTypes.EventSlotTemplateDTO,
    nextStartAt: string
  ): Pick<ContractTypes.EventSlotTemplateDTO, 'startAt' | 'endAt'> {
    const currentStart = this.parseEventEditorDateValue(slot.startAt);
    const currentEnd = this.parseEventEditorDateValue(slot.endAt);
    const nextStart = this.parseEventEditorDateValue(nextStartAt);
    if (!currentStart || !currentEnd || !nextStart) {
      return {
        startAt: nextStartAt,
        endAt: slot.endAt
      };
    }
    const durationMs = Math.max(60 * 1000, currentEnd.getTime() - currentStart.getTime());
    return {
      startAt: nextStartAt,
      endAt: AppUtils.toIsoDateTimeLocal(new Date(nextStart.getTime() + durationMs))
    };
  }

  private slotWindowForEditing(overrideDate = this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null): {
    start: Date;
    end: Date;
    startAt: string;
    endAt: string;
  } | null {
    return this.slotWindowForOverrideDate(overrideDate);
  }

  private slotWindowForOverrideDate(overrideDate: string | null | undefined): {
    start: Date;
    end: Date;
    startAt: string;
    endAt: string;
  } | null {
    const baseStart = this.parseEventEditorDateValue(this.eventDTO.startAtIso);
    const baseEnd = this.parseEventEditorDateValue(this.eventDTO.endAtIso);
    if (!baseStart || !baseEnd) {
      return null;
    }

    if (!overrideDate) {
      return {
        start: new Date(baseStart),
        end: new Date(baseEnd),
        startAt: AppUtils.toIsoDateTimeLocal(baseStart),
        endAt: AppUtils.toIsoDateTimeLocal(baseEnd)
      };
    }

    const overrideDateValue = this.parseEventEditorOverrideDate(overrideDate);
    const shiftedStartAt = overrideDateValue
      ? AppUtils.applyDatePartToIsoLocal(this.eventDTO.startAtIso, overrideDateValue)
      : this.eventDTO.startAtIso;
    const shiftedStart = this.parseEventEditorDateValue(shiftedStartAt) ?? new Date(baseStart);
    const boundaryEnd = this.eventFrequencyBoundaryEnd(shiftedStart, this.eventDTO.frequency) ?? new Date(baseEnd);
    const shiftedEnd = boundaryEnd.getTime() > baseEnd.getTime() ? new Date(baseEnd) : boundaryEnd;
    if (shiftedEnd.getTime() <= shiftedStart.getTime()) {
      const fallbackEnd = new Date(Math.min(baseEnd.getTime(), shiftedStart.getTime() + (60 * 60 * 1000)));
      return {
        start: shiftedStart,
        end: fallbackEnd,
        startAt: AppUtils.toIsoDateTimeLocal(shiftedStart),
        endAt: AppUtils.toIsoDateTimeLocal(fallbackEnd)
      };
    }
    return {
      start: shiftedStart,
      end: shiftedEnd,
      startAt: AppUtils.toIsoDateTimeLocal(shiftedStart),
      endAt: AppUtils.toIsoDateTimeLocal(shiftedEnd)
    };
  }

  private shiftSlotDateTimeByMs(value: string, shiftMs: number): string {
    const parsed = this.parseEventEditorDateValue(value);
    if (!parsed) {
      return value;
    }
    return AppUtils.toIsoDateTimeLocal(new Date(parsed.getTime() + shiftMs));
  }

  private slotControlDateValue(value: string): Date | null {
    const normalizedValue = `${value ?? ''}`.trim();
    if (!normalizedValue) {
      return null;
    }
    if (this.slotDateControlValueCache.has(normalizedValue)) {
      return this.slotDateControlValueCache.get(normalizedValue) ?? null;
    }
    const parsed = this.parseEventEditorDateValue(normalizedValue);
    this.slotDateControlValueCache.set(normalizedValue, parsed);
    return parsed;
  }

  private slotOverrideDateLabel(dateKey: string): string {
    const parsed = this.parseEventEditorOverrideDate(dateKey);
    if (!parsed) {
      return dateKey;
    }
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private formatSlotDateTimeLabel(value: Date | null | undefined): string {
    if (!value) {
      return '';
    }
    return value.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private currentEventIdentity(): string {
    return this.eventDTO.id.trim() || this.editingEventId || this.draftEventId || '';
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
    if (!this.isActivityEventDTO(sourceEvent)) {
      return;
    }
    const dto = this.cloneActivityEventDetailDTO(sourceEvent);
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
    this.pendingEventImageFile = null;
    this.currentSourcePublished = this.eventEditorService.mode() === 'edit' && dto.status === 'A';
    this.publishedCapacityMaxFloor = Math.max(0, Number(dto.capacityMax ?? 0) || 0);
    this.eventDTO = {
      ...dto,
      slotsEnabled: this.normalizeEventEditorFrequency(dto.frequency) !== 'One-time'
    };
    this.subEventsDisplayMode = dto.subEventsDisplayMode ?? 'Casual';
    this.eventDTO.subEventsDisplayMode = this.subEventsDisplayMode;
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromDTO();
    this.slotEditorMode = 'base';
    this.slotsPanelExpanded = this.eventFrequencyUsesSlots();
    this.showSlotsPopup = false;
    this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    this.normalizeSlotOverrideDateSelection();
    this.seedDraftAutosaveSignature();
  }

  private isActivityEventDTO(sourceEvent: ActivityEventDetailDTO | Record<string, unknown>): sourceEvent is ActivityEventDetailDTO {
    return typeof sourceEvent['startAtIso'] === 'string'
      && typeof sourceEvent['endAtIso'] === 'string'
      && typeof sourceEvent['timeframe'] === 'string';
  }

  private cloneActivityEventDetailDTO(dto: ActivityEventDetailDTO): ActivityEventDetailDTO {
    return {
      ...this.createEmptyEventDTO(),
      ...dto,
      adminIds: [...(dto.adminIds ?? [])],
      blindMode: dto.blindMode ?? 'Open Event',
      autoInviter: dto.autoInviter === true,
      frequency: dto.frequency ?? 'One-time',
      pricing: PricingBuilder.clonePricingConfig(dto.pricing),
      policies: EventEditorBuilder.cloneEventEditorPolicies(dto.policies ?? []),
      slotsEnabled: dto.slotsEnabled === true,
      slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(dto.slotTemplates ?? []),
      topics: [...dto.topics],
      subEvents: EventEditorBuilder.cloneEventEditorSubEvents(dto.subEvents ?? []),
      subEventsDisplayMode: dto.subEventsDisplayMode ?? 'Casual',
      acceptedMemberUserIds: [...(dto.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(dto.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(dto.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(dto.pendingRequestMemberUserIds ?? [])],
      upcomingSlots: (dto.upcomingSlots ?? []).map(slot => ({ ...slot }))
    };
  }

  private resetForm(target: ContractTypes.EventEditorTarget = this.editorTarget): void {
    const start = new Date();
    const end = new Date(start.getTime() + (60 * 60 * 1000));

    this.pendingEventImageFile = null;
    this.currentSourcePublished = false;
    this.publishedCapacityMaxFloor = 0;
    this.eventDTO = {
      ...this.createEmptyEventDTO(),
      id: this.draftEventId ?? '',
      type: target,
      visibility: target === 'hosting' ? 'Invitation only' : 'Public',
      startAtIso: AppUtils.toIsoDateTimeLocal(start),
      endAtIso: AppUtils.toIsoDateTimeLocal(end)
    };

    this.subEventsDisplayMode = 'Casual';
    this.eventDTO.subEventsDisplayMode = this.subEventsDisplayMode;
    this.showSlotsPopup = false;
    this.syncDateTimeControlsFromDTO();
    this.slotEditorMode = 'base';
    this.slotsPanelExpanded = false;
    this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    this.normalizeSlotOverrideDateSelection();
    this.seedDraftAutosaveSignature();
  }

  private syncDateTimeControlsFromDTO(): void {
    this.eventStartDateValue = AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    this.eventEndDateValue = AppUtils.isoLocalDateTimeToDate(this.eventDTO.endAtIso);
    this.eventStartTimeValue = AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    this.eventEndTimeValue = AppUtils.isoLocalDateTimeToDate(this.eventDTO.endAtIso);
  }

  private syncEventDTOFromDateTimeControls(): void {
    this.eventDTO.startAtIso = AppUtils.applyDatePartToIsoLocal(this.eventDTO.startAtIso, this.eventStartDateValue);
    this.eventDTO.startAtIso = AppUtils.applyTimePartFromDateToIsoLocal(this.eventDTO.startAtIso, this.eventStartTimeValue);
    this.eventDTO.endAtIso = AppUtils.applyDatePartToIsoLocal(this.eventDTO.endAtIso, this.eventEndDateValue);
    this.eventDTO.endAtIso = AppUtils.applyTimePartFromDateToIsoLocal(this.eventDTO.endAtIso, this.eventEndTimeValue);
  }

  private normalizeEventDateRange(): void {
    const start = AppUtils.isoLocalDateTimeToDate(this.eventDTO.startAtIso);
    let end = AppUtils.isoLocalDateTimeToDate(this.eventDTO.endAtIso);
    if (!start || !end) {
      return;
    }

    if (!this.eventFrequencyOptions.includes(this.eventDTO.frequency)) {
      this.eventDTO.frequency = this.eventFrequencyOptions[0] ?? 'One-time';
    }

    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + (60 * 60 * 1000));
    }

    this.eventDTO.endAtIso = AppUtils.toIsoDateTimeLocal(end);
    this.eventDTO.slotsEnabled = this.eventFrequencyUsesSlots();
    if (!this.eventDTO.slotsEnabled) {
      this.eventDTO.slotTemplates = [];
      this.showSlotsPopup = false;
    }
    this.normalizeSlotOverrideDateSelection();
    this.normalizeEventSlotTemplates();
  }

  private eventFrequencyBoundaryEnd(start: Date | null, frequency: string): Date | null {
    if (!start) {
      return null;
    }
    const normalizedFrequency = this.normalizeEventEditorFrequency(frequency);
    let boundaryDate: Date | null = null;
    switch (normalizedFrequency) {
      case 'Daily':
        boundaryDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        break;
      case 'Weekly':
        boundaryDate = AppUtils.endOfWeekSunday(start);
        break;
      case 'Bi-weekly':
        boundaryDate = AppUtils.addDays(AppUtils.endOfWeekSunday(start), 7);
        break;
      case 'Monthly':
        boundaryDate = AppUtils.endOfMonth(start);
        break;
      case 'Yearly':
        boundaryDate = new Date(start.getFullYear(), 11, 31);
        break;
      default:
        boundaryDate = null;
        break;
    }
    if (!boundaryDate) {
      return null;
    }
    return new Date(boundaryDate.getFullYear(), boundaryDate.getMonth(), boundaryDate.getDate(), 23, 59, 0, 0);
  }

  private normalizeEventSlotTemplates(): void {
    if (!this.eventFrequencyUsesSlots()) {
      this.eventDTO.slotsEnabled = false;
      this.eventDTO.slotTemplates = [];
      return;
    }
    this.eventDTO.slotsEnabled = true;

    this.eventDTO.slotTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(
      this.eventDTO.slotTemplates.map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }))
    );
  }

  private syncMainEventBoundsFromSubEvents(): void {
    if (this.eventDTO.subEvents.length === 0) {
      return;
    }

    const tournamentMode = this.subEventsDisplayMode === 'Tournament';
    let minStartMs: number | null = null;
    let maxEndMs: number | null = null;
    let minCapacity: number | null = null;
    let maxCapacity: number | null = null;

    for (const item of this.eventDTO.subEvents) {
      let startMs = this.parseEventEditorDateValue(item.startAt)?.getTime() ?? Number.NaN;
      let endMs = this.parseEventEditorDateValue(item.endAt)?.getTime() ?? Number.NaN;
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        if (endMs <= startMs) {
          endMs = startMs + (60 * 60 * 1000);
        }
        minStartMs = minStartMs === null ? startMs : Math.min(minStartMs, startMs);
        maxEndMs = maxEndMs === null ? endMs : Math.max(maxEndMs, endMs);
      }

      const normalizedMin = EventEditorBuilder.normalizedEventEditorCapacityValueWithFloor(item.capacityMin, 0);
      const normalizedMax = EventEditorBuilder.normalizedEventEditorCapacityValueWithFloor(item.capacityMax, 0);
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
      this.eventDTO.startAtIso = AppUtils.toIsoDateTimeLocal(new Date(minStartMs));
      this.eventDTO.endAtIso = AppUtils.toIsoDateTimeLocal(new Date(maxEndMs));
      this.syncDateTimeControlsFromDTO();
    }
    if (minCapacity !== null) {
      this.eventDTO.capacityMin = minCapacity;
    }
    if (maxCapacity !== null) {
      this.eventDTO.capacityMax = Math.max(maxCapacity, this.eventDTO.capacityMin ?? maxCapacity);
    }

    const first = EventEditorBuilder.firstEventEditorSubEventByOrder(this.eventDTO.subEvents);
    if (first) {
      this.eventDTO.location = this.normalizeEventEditorLocation(first.location);
    }
  }

  private syncFirstSubEventLocationFromMainEvent(): void {
    if (this.isPublishedManageMode() || this.eventDTO.subEvents.length === 0) {
      return;
    }
    this.eventDTO.subEvents = EventEditorBuilder.withFirstEventEditorSubEventLocation(
      this.eventDTO.subEvents,
      this.eventDTO.location
    );
  }

  protected savePolicyDraft(): void {
    if (this.eventPoliciesReadOnly() || !this.canSavePolicyDraft()) {
      return;
    }
    const nextItem = this.normalizedWorkingPolicyDraft();
    if (this.editingPolicyDraftIndex !== null && this.editingPolicyDraftIndex >= 0 && this.editingPolicyDraftIndex < this.workingPolicies.length) {
      this.workingPolicies = this.workingPolicies.map((item, index) => (
        index === this.editingPolicyDraftIndex ? nextItem : item
      ));
    } else {
      this.workingPolicies = [...this.workingPolicies, nextItem];
    }
    this.syncEventPoliciesFromWorkingPolicies();
    this.closePolicyEditor();
  }

  private normalizedWorkingPolicyDraft(): ContractTypes.EventPolicyDTO {
    return {
      id: this.workingPolicyDraft.id?.trim() || `policy-${Date.now()}`,
      title: this.workingPolicyDraft.title.trim(),
      description: this.workingPolicyDraft.description.trim(),
      required: this.workingPolicyDraft.required !== false
    };
  }

  private syncEventPoliciesFromWorkingPolicies(): void {
    this.eventDTO.policies = this.workingPolicies
      .map(item => ({
        id: `${item.id ?? ''}`.trim(),
        title: `${item.title ?? ''}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        required: item.required !== false
      }))
      .filter(item => item.title.length > 0 || item.description.length > 0);
  }

  private eventLocationRouteStops(): string[] {
    const mainLocation = this.normalizeEventEditorLocation(this.eventDTO.location).trim();
    const subEventStops = EventEditorBuilder.sortEventEditorSubEventRefsByStartAsc(this.eventDTO.subEvents)
      .map(item => this.normalizeEventEditorLocation(item.location).trim())
      .filter(stop => stop.length > 0);
    const ordered = [mainLocation, ...subEventStops].filter(stop => stop.length > 0);
    return Array.from(new Set(ordered));
  }

  private async resolvePersistedEventImageUrl(activeUserId: string, eventId: string): Promise<string | null> {
    if (!this.pendingEventImageFile) {
      return this.eventDTO.imageUrl.trim() || null;
    }
    const uploadResult = await this.mediaService.uploadImage(activeUserId, eventId, this.pendingEventImageFile);
    if (!uploadResult.uploaded || !uploadResult.imageUrl) {
      return null;
    }
    if (this.eventDTO.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.eventDTO.imageUrl);
    }
    this.pendingEventImageFile = null;
    return uploadResult.imageUrl;
  }

  private currentSubEventPanelState(): { item: ContractTypes.SubEventDTO; index: number } | null {
    const source = EventEditorBuilder.sortEventEditorSubEventRefsByStartAsc(this.eventDTO.subEvents);
    if (source.length === 0) {
      return null;
    }

    const currentIndex = AppUtils.clampNumber(this.resolveCurrentSubEventIndex(source), 0, source.length - 1);
    const current = source[currentIndex] ?? source[0] ?? null;
    if (!current) {
      return null;
    }

    return {
      item: current,
      index: currentIndex
    };
  }

  private resolveCurrentSubEventIndex(items: ContractTypes.SubEventDTO[]): number {
    if (items.length === 0) {
      return 0;
    }

    const now = Date.now();

    for (let index = 0; index < items.length; index += 1) {
      const startMs = new Date(items[index].startAt ?? '').getTime();
      const endMs = new Date(items[index].endAt ?? '').getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        continue;
      }
      if (startMs <= now && now <= endMs) {
        return index;
      }
    }

    for (let index = 0; index < items.length; index += 1) {
      const startMs = new Date(items[index].startAt ?? '').getTime();
      if (!Number.isNaN(startMs) && startMs > now) {
        return index;
      }
    }

    return Math.max(0, items.length - 1);
  }

  private subEventStageAccentHue(stageNumber: number, totalStages: number): number {
    if (totalStages <= 1) {
      return 210;
    }
    const ratio = AppUtils.clampNumber((stageNumber - 1) / (totalStages - 1), 0, 1);
    return Math.round(210 - (210 * ratio));
  }

  private openGoogleMapsSearch(value: string): void {
    const trimmed = value.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  private openGoogleMapsDirections(stops: readonly string[]): void {
    const normalizedStops = stops.map(stop => stop.trim()).filter(stop => stop.length > 0);
    if (normalizedStops.length === 0 || typeof window === 'undefined') {
      return;
    }
    if (normalizedStops.length === 1) {
      this.openGoogleMapsSearch(normalizedStops[0]);
      return;
    }

    const [origin, ...rest] = normalizedStops;
    const destination = rest[rest.length - 1] ?? origin;
    const waypoints = rest.slice(0, -1);
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private subEventName(subEvent: ContractTypes.SubEventDTO): string {
    return `${subEvent.name || 'Untitled'}`;
  }
}

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
import { Subscription } from 'rxjs';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { EventEditorBuilder, PricingBuilder } from '../../../shared/core/base/builders';
import { EventEditorConverter } from '../../../shared/core/base/converters';
import type * as AppTypes from '../../../shared/core/base/models';
import {
  ActivitiesService,
  ActivityMembersService,
  AppContext,
  AppPopupContext,
  EventEditorDataService,
  ExplanationGuideService,
  MediaService,
  RouteIntervalSchedulerService
} from '../../../shared/core';
import type { ActivityEventRecord } from '../../../shared/core/base/models/events.model';
import {
  AppMenuComponent,
  type AppMenuGroup,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  CounterBadgePipe,
  PricingEditorComponent,
  ProgressIndicatorComponent
} from '../../../shared/ui';
import { environment } from '../../../../environments/environment';
import { EventSubeventsPopupComponent, EventSubeventsItem } from '../event-subevents-popup/event-subevents-popup.component';

type EventEditorMenuContext =
  | { menu: 'visibility'; visibility: AppTypes.EventVisibility }
  | { menu: 'frequency'; frequency: string }
  | { menu: 'topic'; topic: string };

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
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly mediaService = inject(MediaService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly routeIntervalScheduler = inject(RouteIntervalSchedulerService);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  @ViewChild('eventImageInput') eventImageInput!: ElementRef<HTMLInputElement>;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private editorTarget: AppTypes.EventEditorTarget = 'events';
  private lastHandledOpenSubEventsRequest = 0;
  protected editingEventId: string | null = null;
  private draftEventId: string | null = null;
  private currentRecord: ActivityEventRecord | null = null;
  private currentSourcePublished = false;
  private publishedCapacityMaxFloor = 0;
  private currentMemberSummary: AppTypes.ActivityMembersSummary | null = null;
  private lastHandledActivityMembersSyncMs = 0;
  private pendingEventImageFile: File | null = null;
  private readonly slotDateControlValueCache = new Map<string, Date | null>();
  private pricingSlotCatalogCacheKey = '';
  private pricingSlotCatalogCache: AppTypes.PricingSlotReference[] = [];
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
      void this.openEditRequest(request.row, request.readOnly);
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

      if (mode === 'create' && this.draftEventId && this.eventForm.id === this.draftEventId && this.eventForm.startAt) {
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
      if (this.currentRecord?.id === sync.id) {
        this.currentRecord = {
          ...this.currentRecord,
          acceptedMembers: this.currentMemberSummary.acceptedMembers,
          pendingMembers: this.currentMemberSummary.pendingMembers,
          capacityTotal: this.currentMemberSummary.capacityTotal
        };
      }
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

  eventForm: AppTypes.EventEditorDraftForm = {
    id: '',
    title: '',
    description: '',
    imageUrl: '',
    visibility: 'Public',
    frequency: 'One-time',
    location: '',
    capacityMin: 0 as number | null,
    capacityMax: 0 as number | null,
    blindMode: 'Open Event',
    autoInviter: false,
    ticketing: false,
    pricing: PricingBuilder.createDefaultPricingConfig('event'),
    policies: [],
    slotsEnabled: false,
    slotTemplates: [] as AppTypes.EventSlotTemplate[],
    topics: [] as string[],
    subEvents: [] as AppTypes.EventEditorSubEventItem[],
    startAt: '',
    endAt: ''
  };

  eventStartDateValue: Date | null = null;
  eventStartTimeValue: Date | null = null;
  eventEndDateValue: Date | null = null;
  eventEndTimeValue: Date | null = null;
  slotOverrideDateValue: Date | null = null;

  subEventsDisplayMode: AppTypes.SubEventsDisplayMode = 'Casual';
  slotEditorMode: 'base' | 'date' = 'base';
  slotsPanelExpanded = false;
  showSlotsPopup = false;
  showPoliciesPopup = false;
  showPolicyEditorPopup = false;
  showSubEventsPopup = false;
  isSavePending = false;
  workingPolicies: AppTypes.EventPolicyItem[] = [];
  workingPolicyDraft: AppTypes.EventPolicyItem = this.createEmptyPolicyDraft();
  editingPolicyDraftIndex: number | null = null;

  readonly visibilityOptions: AppTypes.EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
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
    const capacityMin = this.eventForm.capacityMin ?? 0;
    const publishedFloor = this.isPublishedManageMode() ? this.publishedCapacityMaxFloor : 0;
    return Math.max(0, capacityMin, publishedFloor);
  }

  requestOpenMembers(): void {
    const eventId = this.currentEventIdentity() || 'draft-event';
    const canManageMembers = !this.eventEditorService.readOnly();
    const row: AppTypes.ActivityListRow = {
      id: eventId,
      type: this.editorTarget === 'hosting' ? 'hosting' : 'events',
      title: this.eventForm.title.trim() || 'New Event',
      subtitle: this.eventForm.description.trim() || 'Draft event',
      detail: this.eventForm.startAt || 'Draft',
      dateIso: this.eventForm.startAt || new Date().toISOString(),
      distanceMetersExact: 0,
      unread: 0,
      metricScore: 0,
      isAdmin: canManageMembers,
      startAt: this.eventForm.startAt || new Date().toISOString(),
      endAt: this.eventForm.endAt || this.eventForm.startAt || new Date().toISOString(),
      acceptedMembers: 0,
      pendingMembers: 0,
      capacityTotal: Math.max(0, Number(this.eventForm.capacityMax ?? this.eventForm.capacityMin ?? 0) || 0),
      capacityMin: this.eventForm.capacityMin,
      capacityMax: this.eventForm.capacityMax
    };
    this.popupCtx.requestActivitiesNavigation({ type: 'eventEditorMembers', row });
  }

  requestOpenSubEvents(): void {
    this.showSlotsPopup = false;
    this.showSubEventsPopup = true;
  }

  closeSubEventsPopup(): void {
    this.showSubEventsPopup = false;
  }

  handleSubEventsChange(subEvents: readonly EventSubeventsItem[]): void {
    const mapped: AppTypes.EventEditorSubEventItem[] = subEvents.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group }))
    }));
    this.eventForm.subEvents = EventEditorBuilder.cloneEventEditorSubEvents(mapped);
    this.syncMainEventBoundsFromSubEvents();
    this.syncDateTimeControlsFromForm();
  }

  updateSubEventsDisplayMode(mode: AppTypes.SubEventsDisplayMode): void {
    this.subEventsDisplayMode = mode;
    this.syncMainEventBoundsFromSubEvents();
    this.syncDateTimeControlsFromForm();
  }

  protected pricingSlotCatalog(): readonly AppTypes.PricingSlotReference[] {
    const normalizedSlots = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(this.eventForm.slotTemplates);
    const nextKey = normalizedSlots
      .map(item => [item.id, item.startAt, item.endAt, item.overrideDate ?? '', item.closed === true ? '1' : '0'].join(':'))
      .join('|');
    if (nextKey !== this.pricingSlotCatalogCacheKey) {
      this.pricingSlotCatalogCacheKey = nextKey;
      this.pricingSlotCatalogCache = PricingBuilder.slotCatalogFromEventSlotTemplates(normalizedSlots);
    }
    return this.pricingSlotCatalogCache;
  }

  protected slotSummaryBaseItems(): AppTypes.EventSlotTemplate[] {
    return this.baseSlotTemplates();
  }

  protected slotSummaryOverrideItems(): Array<{ dateKey: string; label: string; detail: string }> {
    const grouped = new Map<string, AppTypes.EventSlotTemplate[]>();
    for (const slot of this.eventForm.slotTemplates) {
      const dateKey = EventEditorConverter.normalizeEventEditorSlotOverrideDate(slot.overrideDate);
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

  protected slotSummaryWindowLabel(slot: AppTypes.EventSlotTemplate): string {
    const start = EventEditorConverter.parseEventEditorDateValue(slot.startAt);
    const end = EventEditorConverter.parseEventEditorDateValue(slot.endAt);
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
    this.workingPolicies = EventEditorBuilder.cloneEventEditorPolicies(this.eventForm.policies);
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

  protected policyCardMetaLabel(policy: AppTypes.EventPolicyItem): string {
    return policy.required !== false ? 'Required approval' : 'Optional policy';
  }

  protected policyCardPreview(policy: AppTypes.EventPolicyItem): string {
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

  private createEmptyPolicyDraft(): AppTypes.EventPolicyItem {
    return {
      id: `policy-${Date.now()}`,
      title: '',
      description: '',
      required: true
    };
  }

  protected policiesCountLabel(): string {
    const count = this.eventForm.policies.length;
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  protected requiredPoliciesCount(): number {
    return this.eventForm.policies.filter(item => item.required !== false).length;
  }

  requestOpenLocationMap(): void {
    const routeStops = this.eventLocationRouteStops();
    if (routeStops.length <= 1) {
      this.openGoogleMapsSearch(routeStops[0] ?? this.eventForm.location);
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

  eventEditorFieldInvalid(field: 'title' | 'description' | 'capacityMin' | 'capacityMax'): boolean {
    if (field === 'capacityMin' || field === 'capacityMax') {
      return this.eventForm[field] === null;
    }
    return !this.eventForm[field].trim();
  }

  canSubmitEventEditorForm(): boolean {
    if (this.eventEditorService.readOnly()) {
      return false;
    }
    return Boolean(
      this.eventForm.title.trim()
      && this.eventForm.description.trim()
      && this.eventForm.capacityMin !== null
      && this.eventForm.capacityMax !== null
      && this.eventForm.startAt
      && this.eventForm.endAt
    );
  }

  protected canConfigureSlotsSeries(): boolean {
    return !this.eventStructureReadOnly() && !this.isGeneratedSlotInstance();
  }

  protected isGeneratedSlotInstance(): boolean {
    return Boolean(this.currentRecord?.generated) || this.currentRecord?.eventType === 'slot';
  }

  saveEventEditorForm(): void {
    this.syncEventFormFromDateTimeControls();
    if (!this.canSubmitEventEditorForm() || this.isSavePending) {
      return;
    }
    void this.runImmediateSave();
  }

  selectVisibility(option: AppTypes.EventVisibility, event?: Event): void {
    event?.stopPropagation();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventForm.visibility = EventEditorConverter.normalizeEventEditorVisibility(option);
  }

  protected eventVisibilityMenuTrigger(): AppMenuTrigger {
    return {
      label: this.eventForm.visibility,
      icon: this.getVisibilityIcon(this.eventForm.visibility),
      ariaLabel: 'Open visibility selector',
      palette: this.eventVisibilityPalette(this.eventForm.visibility),
      disabled: this.eventStructureReadOnly(),
      shape: 'pill'
    };
  }

  protected eventVisibilityMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    return this.visibilityOptions.map(option => ({
      id: `visibility-${option}`,
      label: option,
      icon: this.getVisibilityIcon(option),
      kind: 'radio',
      active: EventEditorConverter.normalizeEventEditorVisibility(this.eventForm.visibility) === option,
      checked: EventEditorConverter.normalizeEventEditorVisibility(this.eventForm.visibility) === option,
      palette: this.eventVisibilityPalette(option),
      surface: 'tinted',
      context: { menu: 'visibility', visibility: option }
    }));
  }

  getVisibilityIcon(visibility: string): string {
    switch (EventEditorConverter.normalizeEventEditorVisibility(visibility)) {
      case 'Friends only':
        return 'groups';
      case 'Invitation only':
        return 'mail_lock';
      default:
        return 'public';
    }
  }

  eventVisibilityClass(visibility: string): string {
    switch (EventEditorConverter.normalizeEventEditorVisibility(visibility)) {
      case 'Friends only':
        return 'event-visibility-friends';
      case 'Invitation only':
        return 'event-visibility-invitation';
      default:
        return 'event-visibility-public';
    }
  }

  private eventVisibilityPalette(visibility: string): AppMenuPalette {
    switch (EventEditorConverter.normalizeEventEditorVisibility(visibility)) {
      case 'Friends only':
        return 'blue';
      case 'Invitation only':
        return 'amber';
      default:
        return 'green';
    }
  }

  eventBlindModeClass(mode: string): string {
    return EventEditorConverter.normalizeEventEditorBlindMode(mode) === 'Blind Event' ? 'blind-mode-blind' : 'blind-mode-open';
  }

  eventBlindModeIcon(mode: string): string {
    return EventEditorConverter.normalizeEventEditorBlindMode(mode) === 'Blind Event' ? 'visibility_off' : 'visibility';
  }

  eventBlindModeDescription(mode: string): string {
    return EventEditorConverter.normalizeEventEditorBlindMode(mode) === 'Blind Event'
      ? 'Attendees won\'t see each other before the event.'
      : 'Attendees can preview each other before the event.';
  }

  eventTopicsPanelClass(): string {
    return 'section-identity';
  }

  eventTopicsPanelIcon(): string {
    return 'sell';
  }

  protected eventTopicsMenuTrigger(): AppMenuTrigger {
    const count = this.eventForm.topics.length;
    return {
      label: count === 0 ? 'Select topics' : `${count} ${count === 1 ? 'topic' : 'topics'}`,
      icon: this.eventTopicsPanelIcon(),
      ariaLabel: 'Open event topics',
      palette: count > 0 ? 'gold' : 'neutral',
      disabled: this.eventEditorService.readOnly(),
      shape: 'field'
    };
  }

  protected eventTopicsMenuGroups(): readonly AppMenuGroup<string, EventEditorMenuContext>[] {
    const selected = new Set(this.eventForm.topics.map(topic => EventEditorConverter.normalizeEventEditorTopicToken(topic)));
    const maxReached = selected.size >= 5;
    return this.interestOptionGroups.map((group, groupIndex) => {
      const palette = this.eventTopicGroupPalette(group.toneClass);
      return {
        id: `event-topic-${groupIndex}-${group.title}`,
        label: group.shortTitle || group.title,
        icon: group.icon || this.eventTopicGroupIcon(group.toneClass),
        palette,
        children: group.options.map(option => {
          const normalized = EventEditorConverter.normalizeEventEditorTopicToken(option);
          const active = selected.has(normalized);
          return {
            id: `event-topic-${groupIndex}-${option}`,
            label: this.eventTopicLabel(option),
            icon: 'tag',
            kind: 'checkbox' as const,
            active,
            checked: active,
            closeOnSelect: false,
            disabled: !active && maxReached,
            palette,
            surface: 'tinted' as const,
            context: { menu: 'topic' as const, topic: option }
          };
        })
      };
    });
  }

  eventAutoInviterClass(enabled: boolean): string {
    return enabled ? 'auto-inviter-on' : 'auto-inviter-off';
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

  eventTicketingClass(enabled: boolean): string {
    return enabled ? 'event-ticketing-on' : 'event-ticketing-off';
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
    switch (EventEditorConverter.normalizeEventEditorFrequency(frequency)) {
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
      label: this.eventForm.frequency,
      icon: this.eventFrequencyIcon(this.eventForm.frequency),
      ariaLabel: 'Open event frequency',
      palette: this.eventFrequencyPalette(this.eventForm.frequency),
      disabled: this.eventStructureReadOnly(),
      shape: 'field'
    };
  }

  protected eventFrequencyMenuItems(): readonly AppMenuItem<string, EventEditorMenuContext>[] {
    const current = EventEditorConverter.normalizeEventEditorFrequency(this.eventForm.frequency);
    return this.eventFrequencyOptions.map(option => {
      const normalized = EventEditorConverter.normalizeEventEditorFrequency(option);
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

  protected onEventEditorMenuSelect(event: AppMenuItemSelectEvent<string, EventEditorMenuContext>): void {
    if (!event.context) {
      return;
    }
    if (event.context.menu === 'visibility') {
      this.selectVisibility(event.context.visibility, event.sourceEvent);
      return;
    }
    if (event.context.menu === 'topic') {
      this.toggleEventTopic(event.context.topic);
      return;
    }
    event.sourceEvent.stopPropagation();
    this.onEventFrequencyChange(event.context.frequency);
  }

  private eventFrequencyPalette(frequency: string): AppMenuPalette {
    switch (EventEditorConverter.normalizeEventEditorFrequency(frequency)) {
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

  private toggleEventTopic(topic: string): void {
    if (this.eventEditorService.readOnly()) {
      return;
    }
    const normalized = EventEditorConverter.normalizeEventEditorTopicToken(topic);
    if (!normalized) {
      return;
    }
    const current = EventEditorConverter.normalizeEventEditorTopics(this.eventForm.topics);
    const currentNormalized = new Set(current.map(item => EventEditorConverter.normalizeEventEditorTopicToken(item)));
    const next = currentNormalized.has(normalized)
      ? current.filter(item => EventEditorConverter.normalizeEventEditorTopicToken(item) !== normalized)
      : [...current, topic].slice(0, 5);
    this.eventForm.topics = EventEditorConverter.normalizeEventEditorTopics(next);
  }

  private eventTopicGroupIcon(toneClass: string): string {
    switch (toneClass) {
      case 'section-social':
        return 'celebration';
      case 'section-arts':
        return 'palette';
      case 'section-food':
        return 'restaurant';
      case 'section-active':
        return 'hiking';
      case 'section-mind':
        return 'self_improvement';
      case 'section-identity':
        return 'auto_awesome';
      default:
        return 'label';
    }
  }

  private eventTopicGroupPalette(toneClass: string): AppMenuPalette {
    switch (toneClass) {
      case 'section-social':
        return 'orange';
      case 'section-arts':
        return 'purple';
      case 'section-food':
        return 'brown';
      case 'section-active':
        return 'blue';
      case 'section-mind':
        return 'mint';
      case 'section-identity':
        return 'gold';
      default:
        return 'neutral';
    }
  }

  protected onEventFrequencyChange(value: string): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventForm.frequency = EventEditorConverter.normalizeEventEditorFrequency(value);
    this.eventForm.slotsEnabled = this.eventFrequencyUsesSlots();
    if (!this.eventForm.slotsEnabled) {
      this.eventForm.slotTemplates = [];
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
    const start = this.eventStartDateValue ?? AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    if (!start) {
      return null;
    }
    return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  protected eventFrequencyUsesSlots(): boolean {
    return EventEditorConverter.normalizeEventEditorFrequency(this.eventForm.frequency) !== 'One-time';
  }

  subEventsCountLabel(): string {
    const count = this.eventForm.subEvents.length;
    return count === 1 ? '1 item' : `${count} items`;
  }

  subEventsCurrentHeaderLabel(): string {
    const current = this.currentSubEventPanelState();
    if (!current) {
      return '';
    }
    return this.subEventPanelChipTitle(current.item, current.index);
  }

  subEventLocationLabel(subEvent: AppTypes.EventEditorSubEventItem | null | undefined): string {
    const location = EventEditorConverter.normalizeEventEditorLocation(subEvent?.location).trim();
    return location || 'Location pending';
  }

  subEventPanelChipTitle(subEvent: AppTypes.EventEditorSubEventItem, index: number): string {
    const baseName = (this.subEventName(subEvent) || 'Untitled').trim() || 'Untitled';
    if (this.subEventsDisplayMode !== 'Tournament') {
      return baseName;
    }
    return `Stage ${index + 1} - ${baseName}`;
  }

  subEventPanelChipTrackId(index: number, subEvent: AppTypes.EventEditorSubEventItem): string {
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

  subEventCardRange(subEvent: AppTypes.EventEditorSubEventItem): string {
    const start = EventEditorConverter.parseEventEditorDateValue(subEvent.startAt);
    const end = EventEditorConverter.parseEventEditorDateValue(subEvent.endAt);
    if (!start || !end) {
      return 'Date pending';
    }
    const startLabel = `${AppUtils.pad2(start.getMonth() + 1)}/${AppUtils.pad2(start.getDate())} ${AppUtils.pad2(start.getHours())}:${AppUtils.pad2(start.getMinutes())}`;
    const endLabel = `${AppUtils.pad2(end.getMonth() + 1)}/${AppUtils.pad2(end.getDate())} ${AppUtils.pad2(end.getHours())}:${AppUtils.pad2(end.getMinutes())}`;
    return `${startLabel} - ${endLabel}`;
  }

  subEventPanelChipIsCurrent(subEvent: AppTypes.EventEditorSubEventItem): boolean {
    const source = EventEditorBuilder.sortEventEditorSubEventRefsByStartAsc(this.eventForm.subEvents);
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
      const totalStages = Math.max(1, this.eventForm.subEvents.length);
      const stageNumber = AppUtils.clampNumber(index + 1, 1, totalStages);
      const hue = this.subEventStageAccentHue(stageNumber, totalStages);
      return {
        borderColor: `hsl(${hue} 54% 58% / 0.52)`,
        background: `linear-gradient(180deg, hsl(${hue} 92% 96%) 0%, hsl(${hue} 84% 90%) 100%)`,
        color: `hsl(${hue} 48% 34%)`
      };
    }

    const subEvent = this.eventForm.subEvents[index] ?? null;
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

  interestOptionToneClass(topic: string): string {
    const normalizedTopic = EventEditorConverter.normalizeEventEditorTopicToken(topic);
    if (!normalizedTopic) {
      return '';
    }
    for (const group of this.interestOptionGroups) {
      if (group.options.some(option => EventEditorConverter.normalizeEventEditorTopicToken(option) === normalizedTopic)) {
        return group.toneClass;
      }
    }
    return '';
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
    if (this.pendingEventImageFile && this.eventForm.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.eventForm.imageUrl);
    }
    this.pendingEventImageFile = file;
    this.eventForm.imageUrl = URL.createObjectURL(file);
    target.value = '';
  }

  onEventCapacityMinChange(value: number | string): void {
    if (this.eventCapacityMinReadOnly()) {
      return;
    }
    const parsed = EventEditorConverter.toEventEditorCapacityInputValue(value);
    this.eventForm.capacityMin = parsed;
    if (
      this.eventForm.capacityMin !== null
      && this.eventForm.capacityMax !== null
      && this.eventForm.capacityMax < this.eventForm.capacityMin
    ) {
      this.eventForm.capacityMax = this.eventForm.capacityMin;
    }
  }

  onEventCapacityMaxChange(value: number | string): void {
    const parsed = EventEditorConverter.toEventEditorCapacityInputValue(value);
    this.eventForm.capacityMax = parsed === null ? null : Math.max(parsed, this.eventCapacityMaxMinimum());
  }

  onEventCapacityMaxBlur(): void {
    if (this.eventForm.capacityMax !== null) {
      this.eventForm.capacityMax = Math.max(this.eventForm.capacityMax, this.eventCapacityMaxMinimum());
    }
    if (
      this.eventForm.capacityMin !== null
      && this.eventForm.capacityMax !== null
      && this.eventForm.capacityMax < this.eventForm.capacityMin
    ) {
      this.eventForm.capacityMax = this.eventForm.capacityMin;
    }
  }

  toggleEventBlindMode(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventForm.blindMode = this.eventForm.blindMode === 'Blind Event' ? 'Open Event' : 'Blind Event';
  }

  toggleEventAutoInviter(event: Event): void {
    event.preventDefault();
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.eventForm.autoInviter = !this.eventForm.autoInviter;
  }

  toggleEventTicketing(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventForm.ticketing = !this.eventForm.ticketing;
  }

  toggleEventSlots(event: Event): void {
    event.preventDefault();
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventForm.slotsEnabled = this.eventFrequencyUsesSlots();
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

  protected activeSlotTemplates(): AppTypes.EventSlotTemplate[] {
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
    const start = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    return start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null;
  }

  protected slotOverrideDateMax(): Date | null {
    const end = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
    return end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
  }

  protected onSlotOverrideDateChange(value: Date | null): void {
    this.slotOverrideDateValue = value;
    this.normalizeSlotOverrideDateSelection();
  }

  protected slotTrackId(index: number, slot: AppTypes.EventSlotTemplate): string {
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
      || this.eventForm.startAt
      || AppUtils.toIsoDateTimeLocal(new Date());
    const startDate = EventEditorConverter.parseEventEditorDateValue(startAt) ?? new Date();
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

  protected slotTemplateStartDateValue(slot: AppTypes.EventSlotTemplate): Date | null {
    return this.slotControlDateValue(slot.startAt);
  }

  protected slotTemplateStartTimeValue(slot: AppTypes.EventSlotTemplate): Date | null {
    return this.slotControlDateValue(slot.startAt);
  }

  protected slotTemplateEndDateValue(slot: AppTypes.EventSlotTemplate): Date | null {
    return this.slotControlDateValue(slot.endAt);
  }

  protected slotTemplateEndTimeValue(slot: AppTypes.EventSlotTemplate): Date | null {
    return this.slotControlDateValue(slot.endAt);
  }

  protected slotTemplateDateMin(slot: AppTypes.EventSlotTemplate): Date | null {
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!window) {
      return null;
    }
    return new Date(window.start.getFullYear(), window.start.getMonth(), window.start.getDate());
  }

  protected slotTemplateDateMax(slot: AppTypes.EventSlotTemplate): Date | null {
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!window) {
      return null;
    }
    return new Date(window.end.getFullYear(), window.end.getMonth(), window.end.getDate());
  }

  protected slotTemplateEndDateMin(slot: AppTypes.EventSlotTemplate): Date | null {
    const start = EventEditorConverter.parseEventEditorDateValue(slot.startAt);
    if (!start) {
      return this.slotTemplateDateMin(slot);
    }
    return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  protected slotTemplateEndDateMax(index: number, slot: AppTypes.EventSlotTemplate): Date | null {
    const start = EventEditorConverter.parseEventEditorDateValue(slot.startAt);
    const window = this.slotWindowForEditing(slot.overrideDate);
    if (!start || !window) {
      return this.slotTemplateDateMax(slot);
    }
    const boundaryEnd = this.eventFrequencyBoundaryEnd(start, this.eventForm.frequency) ?? window.end;
    const nextSlot = this.activeSlotTemplates()[index + 1] ?? null;
    const nextStart = nextSlot ? EventEditorConverter.parseEventEditorDateValue(nextSlot.startAt) : null;
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
    this.eventForm.location = EventEditorConverter.normalizeEventEditorLocation(value);
    this.syncFirstSubEventLocationFromMainEvent();
  }

  onEventStartDateChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventStartDateValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  onEventStartTimeChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventStartTimeValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  onEventEndDateChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventEndDateValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  onEventEndTimeChange(value: Date | null): void {
    if (this.eventStructureReadOnly()) {
      return;
    }
    this.eventEndTimeValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
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

  private openCreateRequest(target: AppTypes.EventEditorTarget): void {
    this.resetEditorContext();
    this.editorTarget = target;
    this.draftEventId = EventEditorBuilder.buildCreatedEventEditorId(target);
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(this.draftEventId);
    this.resetForm(target);
    this.eventEditorService.openCreate();
    void this.refreshCurrentMemberSummary(this.draftEventId);
  }

  private async openEditRequest(row: AppTypes.ActivityListRow, readOnly: boolean): Promise<void> {
    this.resetEditorContext();
    const activeUserId = this.activeUserId();
    const target = row.type === 'hosting' ? 'hosting' : 'events';
    const fallbackSource = EventEditorConverter.toEventEditorFallbackSource(row, readOnly, target);

    this.editorTarget = target;
    this.editingEventId = row.id;
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(row.id);

    if (!activeUserId) {
      this.eventEditorService.open('edit', fallbackSource, readOnly);
      void this.refreshCurrentMemberSummary(row.id);
      return;
    }

    this.isLoadingEventData.set(true);
    this.eventEditorService.open('edit', fallbackSource, readOnly);
    void this.refreshCurrentMemberSummary(row.id);

    try {
      const record = await this.eventEditorDataService.loadFullItemById(activeUserId, row.id);

      this.isLoadingEventData.set(false);
      if (!record) {
        return;
      }

      this.currentRecord = record;
      this.editorTarget = this.currentRecord.type === 'hosting' ? 'hosting' : target;
      this.editingEventId = this.currentRecord.id;
      this.openRecord(this.currentRecord, readOnly, this.editorTarget);
    } catch {
      this.isLoadingEventData.set(false);
    }
  }

  private openRecord(record: ActivityEventRecord, readOnly: boolean, target: AppTypes.EventEditorTarget): void {
    const source = EventEditorConverter.toEventEditorSourceFromRecord(record, target);
    if (readOnly) {
      this.eventEditorService.openView(source);
      return;
    }
    this.eventEditorService.openEdit(source);
  }

  private async persistEventEditorForm(options: { allowIncomplete?: boolean } = {}): Promise<boolean> {
    if (this.eventEditorService.readOnly()) {
      return false;
    }

    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.normalizeEventSlotTemplates();
    this.syncFirstSubEventLocationFromMainEvent();
    if (this.showPoliciesPopup || this.showPolicyEditorPopup) {
      this.syncEventPoliciesFromWorkingPolicies();
    }
    const normalizedCapacity = EventEditorBuilder.normalizedEventEditorCapacityRange(this.eventForm);
    this.eventForm.capacityMin = normalizedCapacity.min;
    this.eventForm.capacityMax = normalizedCapacity.max;
    if (!options.allowIncomplete && !this.canSubmitEventEditorForm()) {
      return false;
    }

    const activeUserId = this.activeUserId();
    const eventId = this.eventForm.id.trim()
      || this.editingEventId
      || this.draftEventId
      || EventEditorBuilder.buildCreatedEventEditorId(this.editorTarget);
    this.eventForm.id = eventId;
    const uploadedImageUrl = await this.resolvePersistedEventImageUrl(activeUserId, eventId);
    if (!this.localModeEnabled && this.pendingEventImageFile && !uploadedImageUrl) {
      return false;
    }
    if (uploadedImageUrl) {
      this.eventForm.imageUrl = uploadedImageUrl;
    }
    const existingRecord = this.currentRecord
      ?? (activeUserId ? this.eventEditorDataService.peekKnownItemById(activeUserId, eventId) : null);
    const memberSummary = await this.resolveCurrentEventMembersSummary(eventId, normalizedCapacity);
    this.currentMemberSummary = memberSummary;
    const formForSync: AppTypes.EventEditorDraftForm = {
      ...this.eventForm,
      title: options.allowIncomplete
        ? (this.eventForm.title.trim() || existingRecord?.title || 'Untitled draft event')
        : this.eventForm.title,
      description: options.allowIncomplete
        ? (this.eventForm.description.trim() || existingRecord?.subtitle || 'Draft event in progress')
        : this.eventForm.description
    };

    const payload = EventEditorBuilder.buildEventEditorSyncPayload({
      eventId,
      target: this.editorTarget,
      form: formForSync,
      subEventsDisplayMode: this.subEventsDisplayMode,
      acceptedMembers: memberSummary.acceptedMembers,
      pendingMembers: memberSummary.pendingMembers,
      capacityTotal: memberSummary.capacityTotal,
      existingRecord,
      activeUserId: activeUserId || null,
      activeUserProfile: activeUserId ? this.appCtx.getUserProfile(activeUserId) : null,
      acceptedMemberUserIds: memberSummary.acceptedMemberUserIds,
      pendingMemberUserIds: memberSummary.pendingMemberUserIds
    });

    const displaySync = await this.activitiesService.saveActivitiesEventSync(payload, {
      activeUserId
    });
    this.activitiesContext.emitActivitiesEventDisplaySync(displaySync);
    return true;
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
    return this.editorTarget === 'hosting' && this.currentRecord?.published === false;
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
        ...this.eventForm,
        topics: [...this.eventForm.topics],
        pricing: PricingBuilder.clonePricingConfig(this.eventForm.pricing),
        policies: EventEditorBuilder.cloneEventEditorPolicies(this.eventForm.policies),
        slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(this.eventForm.slotTemplates),
        subEvents: EventEditorBuilder.cloneEventEditorSubEvents(this.eventForm.subEvents)
      }
    });
  }

  private resetEditorContext(): void {
    this.editorTarget = 'events';
    this.editingEventId = null;
    this.draftEventId = null;
    this.currentRecord = null;
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

  private baseSlotTemplates(): AppTypes.EventSlotTemplate[] {
    return this.eventForm.slotTemplates
      .filter(item => !EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate))
      .filter(item => item.closed !== true)
      .map(item => ({
        ...item,
        overrideDate: null,
        closed: false
      }));
  }

  private overrideSlotTemplatesForDate(dateKey: string): AppTypes.EventSlotTemplate[] {
    if (!dateKey) {
      return [];
    }
    return this.eventForm.slotTemplates
      .filter(item => EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate) === dateKey)
      .map(item => ({
        ...item,
        overrideDate: dateKey,
        closed: item.closed === true
      }));
  }

  private selectedSlotOverrideDateKey(): string {
    return EventEditorConverter.normalizeEventEditorSlotOverrideDate(this.slotOverrideDateValue) ?? '';
  }

  private defaultSlotOverrideDate(): Date | null {
    const firstOverrideDate = this.eventForm.slotTemplates
      .map(item => EventEditorConverter.parseEventEditorOverrideDate(item.overrideDate))
      .find((value): value is Date => Boolean(value));
    if (firstOverrideDate) {
      return new Date(firstOverrideDate.getFullYear(), firstOverrideDate.getMonth(), firstOverrideDate.getDate());
    }
    const eventStart = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
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

  private projectBaseSlotTemplatesToDate(dateKey: string): AppTypes.EventSlotTemplate[] {
    const window = this.slotWindowForOverrideDate(dateKey);
    const baseStart = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
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

  private resolveActiveSlotTemplatesForEditing(): AppTypes.EventSlotTemplate[] {
    return EventEditorBuilder.cloneEventEditorSlotTemplates(this.activeSlotTemplates());
  }

  private updateSlotTemplate(
    index: number,
    updater: (item: AppTypes.EventSlotTemplate) => AppTypes.EventSlotTemplate
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
    const otherOverrides = this.eventForm.slotTemplates
      .filter(item => {
        const overrideDate = EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate);
        return overrideDate && overrideDate !== dateKey;
      })
      .map(item => ({ ...item }));
    this.eventForm.slotTemplates = [
      ...base,
      ...otherOverrides,
      ...this.projectBaseSlotTemplatesToDate(dateKey)
    ];
  }

  private setActiveSlotTemplates(nextTemplates: AppTypes.EventSlotTemplate[]): void {
    const normalizedTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(
      this.normalizeEditableSlotTemplates(nextTemplates)
    );
    if (this.slotEditorMode === 'base') {
      const overrides = this.eventForm.slotTemplates
        .filter(item => EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate))
        .map(item => ({ ...item }));
      this.eventForm.slotTemplates = [
        ...normalizedTemplates.map(item => ({ ...item, overrideDate: null, closed: false })),
        ...overrides
      ];
      return;
    }

    const dateKey = this.selectedSlotOverrideDateKey();
    const base = this.baseSlotTemplates().map(item => ({ ...item, overrideDate: null, closed: false }));
    const otherOverrides = this.eventForm.slotTemplates
      .filter(item => {
        const overrideDate = EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate);
        return overrideDate && overrideDate !== dateKey;
      })
      .map(item => ({ ...item }));
    const currentOverride = normalizedTemplates.length > 0
      ? normalizedTemplates.map(item => ({ ...item, overrideDate: dateKey || null, closed: false }))
      : (dateKey ? [this.buildClosedDateOverridePlaceholder(dateKey)] : []);
    this.eventForm.slotTemplates = [
      ...base,
      ...otherOverrides,
      ...currentOverride
    ];
  }

  private buildClosedDateOverridePlaceholder(dateKey: string): AppTypes.EventSlotTemplate {
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
    return this.slotWindowForEditing()?.startAt ?? this.eventForm.startAt;
  }

  private normalizeSlotTemplateBounds(slot: AppTypes.EventSlotTemplate): AppTypes.EventSlotTemplate {
    const window = this.slotWindowForEditing(slot.overrideDate);
    const fallbackStart = window?.start ?? EventEditorConverter.parseEventEditorDateValue(this.eventForm.startAt) ?? new Date();
    const fallbackEnd = window?.end ?? EventEditorConverter.parseEventEditorDateValue(this.eventForm.endAt) ?? new Date(fallbackStart.getTime() + (60 * 60 * 1000));
    const windowStartMs = fallbackStart.getTime();
    const windowEndMs = Math.max(windowStartMs + (60 * 1000), fallbackEnd.getTime());

    let startDate = EventEditorConverter.parseEventEditorDateValue(slot.startAt) ?? new Date(fallbackStart);
    let startMs = startDate.getTime();
    const maxStartMs = Math.max(windowStartMs, windowEndMs - (60 * 1000));
    startMs = Math.min(maxStartMs, Math.max(windowStartMs, startMs));
    startDate = new Date(startMs);

    const slotBoundaryEndMs = Math.min(
      windowEndMs,
      this.eventFrequencyBoundaryEnd(startDate, this.eventForm.frequency)?.getTime() ?? windowEndMs
    );

    let endDate = EventEditorConverter.parseEventEditorDateValue(slot.endAt);
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
    nextTemplates: readonly AppTypes.EventSlotTemplate[]
  ): AppTypes.EventSlotTemplate[] {
    let normalized = EventEditorBuilder.cloneEventEditorSlotTemplates(nextTemplates)
      .map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }));
    for (let index = 0; index < normalized.length; index += 1) {
      normalized = this.normalizeSlotTemplateWithNeighbors(normalized, index);
    }
    return normalized;
  }

  private normalizeSlotTemplateWithNeighbors(
    items: readonly AppTypes.EventSlotTemplate[],
    index: number
  ): AppTypes.EventSlotTemplate[] {
    const current = items[index];
    if (!current || current.closed === true) {
      return [...items];
    }

    const nextItems = items.map(item => ({ ...item }));
    const scopeKey = EventEditorConverter.normalizeEventEditorSlotOverrideDate(current.overrideDate) ?? '';
    const previous = [...nextItems]
      .slice(0, index)
      .reverse()
      .find(item => (EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate) ?? '') === scopeKey && item.closed !== true);
    const upcoming = nextItems
      .slice(index + 1)
      .find(item => (EventEditorConverter.normalizeEventEditorSlotOverrideDate(item.overrideDate) ?? '') === scopeKey && item.closed !== true);
    const window = this.slotWindowForEditing(current.overrideDate);
    const fallbackStart = window?.start ?? EventEditorConverter.parseEventEditorDateValue(this.eventForm.startAt) ?? new Date();
    const fallbackEnd = window?.end ?? EventEditorConverter.parseEventEditorDateValue(this.eventForm.endAt) ?? new Date(fallbackStart.getTime() + (60 * 60 * 1000));
    const previousEnd = previous ? EventEditorConverter.parseEventEditorDateValue(previous.endAt) : null;
    const upcomingStart = upcoming ? EventEditorConverter.parseEventEditorDateValue(upcoming.startAt) : null;
    const currentStart = EventEditorConverter.parseEventEditorDateValue(current.startAt) ?? new Date(fallbackStart);
    const currentEnd = EventEditorConverter.parseEventEditorDateValue(current.endAt) ?? new Date(currentStart.getTime() + (60 * 60 * 1000));
    const durationMs = Math.max(60 * 1000, currentEnd.getTime() - currentStart.getTime());

    const minStartMs = Math.max(fallbackStart.getTime(), previousEnd?.getTime() ?? fallbackStart.getTime());
    const slotBoundaryEndMs = Math.min(
      fallbackEnd.getTime(),
      this.eventFrequencyBoundaryEnd(currentStart, this.eventForm.frequency)?.getTime() ?? fallbackEnd.getTime()
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
    slot: AppTypes.EventSlotTemplate,
    nextStartAt: string
  ): Pick<AppTypes.EventSlotTemplate, 'startAt' | 'endAt'> {
    const currentStart = EventEditorConverter.parseEventEditorDateValue(slot.startAt);
    const currentEnd = EventEditorConverter.parseEventEditorDateValue(slot.endAt);
    const nextStart = EventEditorConverter.parseEventEditorDateValue(nextStartAt);
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
    const baseStart = EventEditorConverter.parseEventEditorDateValue(this.eventForm.startAt);
    const baseEnd = EventEditorConverter.parseEventEditorDateValue(this.eventForm.endAt);
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

    const overrideDateValue = EventEditorConverter.parseEventEditorOverrideDate(overrideDate);
    const shiftedStartAt = overrideDateValue
      ? AppUtils.applyDatePartToIsoLocal(this.eventForm.startAt, overrideDateValue)
      : this.eventForm.startAt;
    const shiftedStart = EventEditorConverter.parseEventEditorDateValue(shiftedStartAt) ?? new Date(baseStart);
    const boundaryEnd = this.eventFrequencyBoundaryEnd(shiftedStart, this.eventForm.frequency) ?? new Date(baseEnd);
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
    const parsed = EventEditorConverter.parseEventEditorDateValue(value);
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
    const parsed = EventEditorConverter.parseEventEditorDateValue(normalizedValue);
    this.slotDateControlValueCache.set(normalizedValue, parsed);
    return parsed;
  }

  private slotOverrideDateLabel(dateKey: string): string {
    const parsed = EventEditorConverter.parseEventEditorOverrideDate(dateKey);
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
    return this.eventForm.id.trim() || this.editingEventId || this.draftEventId || '';
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
    if (this.currentRecord?.id === normalizedOwnerId && summary) {
      this.currentRecord = {
        ...this.currentRecord,
        acceptedMembers: summary.acceptedMembers,
        pendingMembers: summary.pendingMembers,
        capacityTotal: summary.capacityTotal
      };
    }
  }

  private async resolveCurrentEventMembersSummary(
    eventId: string,
    normalizedCapacity: AppTypes.EventCapacityRange
  ): Promise<AppTypes.ActivityMembersSummary> {
    const queriedSummary = eventId ? await this.activityMembersService.querySummaryByOwnerId(eventId) : null;
    const summary = queriedSummary ?? this.currentMemberSummary;
    const acceptedMembers = summary?.acceptedMembers ?? this.currentRecord?.acceptedMembers ?? 0;
    const pendingMembers = summary?.pendingMembers ?? this.currentRecord?.pendingMembers ?? 0;
    const capacityFloor = Math.max(0, normalizedCapacity.max ?? normalizedCapacity.min ?? 0);
    const capacityTotal = Math.max(
      acceptedMembers,
      capacityFloor,
      summary?.capacityTotal ?? this.currentRecord?.capacityTotal ?? 0
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

  private populateFormFromSourceEvent(sourceEvent: Record<string, unknown>): void {
    const state = EventEditorConverter.toEventEditorFormState(sourceEvent);
    this.editingEventId = state.form.id.trim() || this.editingEventId;
    this.pendingEventImageFile = null;
    this.currentSourcePublished = this.eventEditorService.mode() === 'edit' && sourceEvent['published'] !== false;
    this.publishedCapacityMaxFloor = Math.max(0, Number(state.form.capacityMax ?? 0) || 0);
    this.eventForm = {
      ...state.form,
      slotsEnabled: EventEditorConverter.normalizeEventEditorFrequency(state.form.frequency) !== 'One-time',
      pricing: PricingBuilder.clonePricingConfig(state.form.pricing),
      policies: EventEditorBuilder.cloneEventEditorPolicies(state.form.policies),
      slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(state.form.slotTemplates),
      subEvents: EventEditorBuilder.cloneEventEditorSubEvents(state.form.subEvents)
    };
    this.subEventsDisplayMode = state.subEventsDisplayMode;
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
    this.slotEditorMode = 'base';
    this.slotsPanelExpanded = this.eventFrequencyUsesSlots();
    this.showSlotsPopup = false;
    this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    this.normalizeSlotOverrideDateSelection();
    this.seedDraftAutosaveSignature();
  }

  private resetForm(target: AppTypes.EventEditorTarget = this.editorTarget): void {
    const start = new Date();
    const end = new Date(start.getTime() + (60 * 60 * 1000));

    this.pendingEventImageFile = null;
    this.currentSourcePublished = false;
    this.publishedCapacityMaxFloor = 0;
    this.eventForm = {
      id: this.draftEventId ?? '',
      title: '',
      description: '',
      imageUrl: '',
      visibility: target === 'hosting' ? 'Invitation only' : 'Public',
      frequency: 'One-time',
      location: '',
      capacityMin: 0,
      capacityMax: 0,
      blindMode: 'Open Event',
      autoInviter: false,
      ticketing: false,
      pricing: PricingBuilder.createDefaultPricingConfig('event'),
      policies: [],
      slotsEnabled: false,
      slotTemplates: [],
      topics: [],
      subEvents: [],
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end)
    };

    this.subEventsDisplayMode = 'Casual';
    this.showSlotsPopup = false;
    this.syncDateTimeControlsFromForm();
    this.slotEditorMode = 'base';
    this.slotsPanelExpanded = false;
    this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    this.normalizeSlotOverrideDateSelection();
    this.seedDraftAutosaveSignature();
  }

  private syncDateTimeControlsFromForm(): void {
    this.eventStartDateValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    this.eventEndDateValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
    this.eventStartTimeValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    this.eventEndTimeValue = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
  }

  private syncEventFormFromDateTimeControls(): void {
    this.eventForm.startAt = AppUtils.applyDatePartToIsoLocal(this.eventForm.startAt, this.eventStartDateValue);
    this.eventForm.startAt = AppUtils.applyTimePartFromDateToIsoLocal(this.eventForm.startAt, this.eventStartTimeValue);
    this.eventForm.endAt = AppUtils.applyDatePartToIsoLocal(this.eventForm.endAt, this.eventEndDateValue);
    this.eventForm.endAt = AppUtils.applyTimePartFromDateToIsoLocal(this.eventForm.endAt, this.eventEndTimeValue);
  }

  private normalizeEventDateRange(): void {
    const start = AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
    let end = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
    if (!start || !end) {
      return;
    }

    if (!this.eventFrequencyOptions.includes(this.eventForm.frequency)) {
      this.eventForm.frequency = this.eventFrequencyOptions[0] ?? 'One-time';
    }

    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + (60 * 60 * 1000));
    }

    this.eventForm.endAt = AppUtils.toIsoDateTimeLocal(end);
    this.eventForm.slotsEnabled = this.eventFrequencyUsesSlots();
    if (!this.eventForm.slotsEnabled) {
      this.eventForm.slotTemplates = [];
      this.showSlotsPopup = false;
    }
    this.normalizeSlotOverrideDateSelection();
    this.normalizeEventSlotTemplates();
  }

  private eventFrequencyBoundaryEnd(start: Date | null, frequency: string): Date | null {
    if (!start) {
      return null;
    }
    const normalizedFrequency = EventEditorConverter.normalizeEventEditorFrequency(frequency);
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
      this.eventForm.slotsEnabled = false;
      this.eventForm.slotTemplates = [];
      return;
    }
    this.eventForm.slotsEnabled = true;

    this.eventForm.slotTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(
      this.eventForm.slotTemplates.map(item => item.closed === true ? { ...item } : this.normalizeSlotTemplateBounds({ ...item }))
    );
  }

  private syncMainEventBoundsFromSubEvents(): void {
    if (this.eventForm.subEvents.length === 0) {
      return;
    }

    const tournamentMode = this.subEventsDisplayMode === 'Tournament';
    let minStartMs: number | null = null;
    let maxEndMs: number | null = null;
    let minCapacity: number | null = null;
    let maxCapacity: number | null = null;

    for (const item of this.eventForm.subEvents) {
      let startMs = EventEditorConverter.parseEventEditorDateValue(item.startAt)?.getTime() ?? Number.NaN;
      let endMs = EventEditorConverter.parseEventEditorDateValue(item.endAt)?.getTime() ?? Number.NaN;
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
      this.eventForm.startAt = AppUtils.toIsoDateTimeLocal(new Date(minStartMs));
      this.eventForm.endAt = AppUtils.toIsoDateTimeLocal(new Date(maxEndMs));
      this.syncDateTimeControlsFromForm();
    }
    if (minCapacity !== null) {
      this.eventForm.capacityMin = minCapacity;
    }
    if (maxCapacity !== null) {
      this.eventForm.capacityMax = Math.max(maxCapacity, this.eventForm.capacityMin ?? maxCapacity);
    }

    const first = EventEditorBuilder.firstEventEditorSubEventByOrder(this.eventForm.subEvents);
    if (first) {
      this.eventForm.location = EventEditorConverter.normalizeEventEditorLocation(first.location);
    }
  }

  private syncFirstSubEventLocationFromMainEvent(): void {
    if (this.isPublishedManageMode() || this.eventForm.subEvents.length === 0) {
      return;
    }
    this.eventForm.subEvents = EventEditorBuilder.withFirstEventEditorSubEventLocation(
      this.eventForm.subEvents,
      this.eventForm.location
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

  private normalizedWorkingPolicyDraft(): AppTypes.EventPolicyItem {
    return {
      id: this.workingPolicyDraft.id?.trim() || `policy-${Date.now()}`,
      title: this.workingPolicyDraft.title.trim(),
      description: this.workingPolicyDraft.description.trim(),
      required: this.workingPolicyDraft.required !== false
    };
  }

  private syncEventPoliciesFromWorkingPolicies(): void {
    this.eventForm.policies = this.workingPolicies
      .map(item => ({
        id: `${item.id ?? ''}`.trim(),
        title: `${item.title ?? ''}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        required: item.required !== false
      }))
      .filter(item => item.title.length > 0 || item.description.length > 0);
  }

  private eventLocationRouteStops(): string[] {
    const mainLocation = EventEditorConverter.normalizeEventEditorLocation(this.eventForm.location).trim();
    const subEventStops = EventEditorBuilder.sortEventEditorSubEventRefsByStartAsc(this.eventForm.subEvents)
      .map(item => EventEditorConverter.normalizeEventEditorLocation(item.location).trim())
      .filter(stop => stop.length > 0);
    const ordered = [mainLocation, ...subEventStops].filter(stop => stop.length > 0);
    return Array.from(new Set(ordered));
  }

  private async resolvePersistedEventImageUrl(activeUserId: string, eventId: string): Promise<string | null> {
    if (!this.pendingEventImageFile) {
      return this.eventForm.imageUrl.trim() || null;
    }
    const uploadResult = await this.mediaService.uploadImage(activeUserId, eventId, this.pendingEventImageFile);
    if (!uploadResult.uploaded || !uploadResult.imageUrl) {
      return null;
    }
    if (this.eventForm.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.eventForm.imageUrl);
    }
    this.pendingEventImageFile = null;
    return uploadResult.imageUrl;
  }

  private currentSubEventPanelState(): { item: AppTypes.EventEditorSubEventItem; index: number } | null {
    const source = EventEditorBuilder.sortEventEditorSubEventRefsByStartAsc(this.eventForm.subEvents);
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

  private resolveCurrentSubEventIndex(items: AppTypes.EventEditorSubEventItem[]): number {
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

  private subEventName(subEvent: AppTypes.EventEditorSubEventItem): string {
    return `${subEvent.name ?? subEvent.title ?? 'Untitled'}`;
  }
}

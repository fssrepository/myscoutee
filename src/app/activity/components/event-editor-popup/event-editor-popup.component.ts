import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatOptionModule } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { EventEditorBuilder } from '../../../shared/core/base/builders';
import { EventEditorConverter } from '../../../shared/core/base/converters';
import type * as AppTypes from '../../../shared/core/base/models';
import { ActivityMembersService, AppContext, AppPopupContext, EventEditorDataService } from '../../../shared/core';
import { HttpMediaService } from '../../../shared/core/http';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import { CounterBadgePipe, TopicPickerPopupComponent } from '../../../shared/ui';
import { environment } from '../../../../environments/environment';
import { EventSubeventsPopupComponent, EventSubeventsItem } from '../event-subevents-popup/event-subevents-popup.component';

@Component({
  selector: 'app-event-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatNativeDateModule,
    MatOptionModule,
    TopicPickerPopupComponent,
    EventSubeventsPopupComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  private static readonly SAVE_PENDING_WINDOW_MS = 1500;
  protected readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly eventEditorDataService = inject(EventEditorDataService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly httpMediaService = inject(HttpMediaService);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  @ViewChild('eventImageInput') eventImageInput!: ElementRef<HTMLInputElement>;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private editorTarget: AppTypes.EventEditorTarget = 'events';
  private lastHandledOpenSubEventsRequest = 0;
  protected editingEventId: string | null = null;
  private draftEventId: string | null = null;
  private currentRecord: DemoEventRecord | null = null;
  private currentMemberSummary: AppTypes.ActivityMembersSummary | null = null;
  private lastHandledActivityMembersSyncMs = 0;
  private pendingEventImageFile: File | null = null;
  private readonly slotDateControlValueCache = new Map<string, Date | null>();

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

      if (!isOpen) {
        this.showEventVisibilityPicker = false;
        this.showSubEventsPopup = false;
        this.showTopicPicker = false;
        return;
      }

      if (sourceEvent) {
        this.populateFormFromSourceEvent(sourceEvent);
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
      this.showEventVisibilityPicker = false;
      this.showTopicPicker = false;
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
          capacityTotal: this.currentMemberSummary.capacityTotal,
          acceptedMemberUserIds: [...this.currentMemberSummary.acceptedMemberUserIds],
          pendingMemberUserIds: [...this.currentMemberSummary.pendingMemberUserIds]
        };
      }
    });

  }

  ngOnInit(): void {
    this.openSubscription = this.eventEditorService.onOpen$.subscribe(() => {
      this.showEventVisibilityPicker = false;
      this.showSubEventsPopup = false;
      this.showTopicPicker = false;
    });

    this.closeSubscription = this.eventEditorService.onClose$.subscribe(() => {
      this.showEventVisibilityPicker = false;
      this.showSubEventsPopup = false;
      this.showTopicPicker = false;
      this.resetEditorContext();
    });
  }

  ngOnDestroy(): void {
    this.openSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
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
  showEventVisibilityPicker = false;
  showSubEventsPopup = false;
  showTopicPicker = false;
  isSavePending = false;
  readonly saveRingPerimeter = 100;

  readonly visibilityOptions: AppTypes.EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly'];

  close(): void {
    this.showEventVisibilityPicker = false;
    this.showSubEventsPopup = false;
    this.showTopicPicker = false;
    this.isSavePending = false;
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
    return 'Edit Event';
  }

  requestOpenMembers(): void {
    this.showEventVisibilityPicker = false;
    this.showTopicPicker = false;
    const source = this.eventEditorService.sourceEvent();
    const eventId = this.currentEventIdentity() || 'draft-event';
    const row: AppTypes.ActivityListRow = {
      id: eventId,
      type: this.editorTarget === 'hosting' ? 'hosting' : 'events',
      title: this.eventForm.title.trim() || 'New Event',
      subtitle: this.eventForm.description.trim() || 'Draft event',
      detail: this.eventForm.startAt || 'Draft',
      dateIso: this.eventForm.startAt || new Date().toISOString(),
      distanceKm: 0,
      unread: 0,
      metricScore: 0,
      isAdmin: true,
      source: source ?? {
        id: eventId,
        avatar: '',
        title: this.eventForm.title.trim() || 'New Event',
        shortDescription: this.eventForm.description.trim() || 'Draft event',
        timeframe: this.eventForm.startAt || 'Draft'
      }
    };
    this.popupCtx.requestActivitiesNavigation({ type: 'eventEditorMembers', row });
  }

  requestOpenSubEvents(): void {
    this.showEventVisibilityPicker = false;
    this.showTopicPicker = false;
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

  requestOpenTopics(): void {
    this.showEventVisibilityPicker = false;
    this.showSubEventsPopup = false;
    this.showTopicPicker = true;
  }

  requestOpenLocationMap(): void {
    this.showEventVisibilityPicker = false;
    const routeStops = this.eventLocationRouteStops();
    if (routeStops.length <= 1) {
      this.openGoogleMapsSearch(routeStops[0] ?? this.eventForm.location);
      return;
    }
    this.openGoogleMapsDirections(routeStops);
  }

  closeTopicPicker(): void {
    this.showTopicPicker = false;
  }

  updateTopicSelection(selected: readonly string[]): void {
    this.eventForm.topics = EventEditorConverter.normalizeEventEditorTopics(selected);
  }

  eventEditorHeaderPendingMemberCount(): number {
    const source: any = this.eventEditorService.sourceEvent();
    const pendingRaw = this.currentMemberSummary?.pendingMembers
      ?? source?.pendingMembersCount
      ?? source?.pendingCount
      ?? source?.pendingMembers
      ?? source?.pending
      ?? source?.pendingInvites
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
    return !this.eventEditorService.readOnly() && !this.isGeneratedSlotInstance();
  }

  protected isGeneratedSlotInstance(): boolean {
    return Boolean(this.currentRecord?.generated) || this.currentRecord?.eventType === 'slot';
  }

  saveEventEditorForm(): void {
    this.syncEventFormFromDateTimeControls();
    if (!this.canSubmitEventEditorForm() || this.isSavePending) {
      return;
    }
    void this.runSaveWithPendingWindow();
  }

  toggleEventVisibilityPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.showEventVisibilityPicker = !this.showEventVisibilityPicker;
  }

  selectVisibility(option: AppTypes.EventVisibility, event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.eventForm.visibility = EventEditorConverter.normalizeEventEditorVisibility(option);
    this.showEventVisibilityPicker = false;
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

  eventFrequencyClass(frequency: string): string {
    switch (EventEditorConverter.normalizeEventEditorFrequency(frequency)) {
      case 'Daily':
        return 'event-frequency-daily';
      case 'Weekly':
        return 'event-frequency-weekly';
      case 'Bi-weekly':
        return 'event-frequency-bi-weekly';
      case 'Monthly':
        return 'event-frequency-monthly';
      default:
        return 'event-frequency-one-time';
    }
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
      default:
        return 'event';
    }
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
    this.pendingEventImageFile = this.demoModeEnabled ? null : file;
    this.eventForm.imageUrl = URL.createObjectURL(file);
    target.value = '';
  }

  onEventCapacityMinChange(value: number | string): void {
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
    this.eventForm.capacityMax = parsed;
  }

  onEventCapacityMaxBlur(): void {
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
    if (this.eventEditorService.readOnly()) {
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
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.eventForm.ticketing = !this.eventForm.ticketing;
  }

  toggleEventSlots(event: Event): void {
    event.preventDefault();
    if (!this.canConfigureSlotsSeries()) {
      return;
    }
    this.eventForm.slotsEnabled = !this.eventForm.slotsEnabled;
    if (this.eventForm.slotsEnabled && this.baseSlotTemplates().length === 0) {
      this.slotEditorMode = 'base';
      this.addSlotTemplate();
    }
    this.normalizeSlotOverrideDateSelection();
  }

  protected toggleSlotsPanelExpanded(event?: Event): void {
    event?.preventDefault();
    this.slotsPanelExpanded = !this.slotsPanelExpanded;
  }

  protected selectSlotEditorMode(mode: 'base' | 'date', event?: Event): void {
    event?.preventDefault();
    if (!this.eventForm.slotsEnabled || !this.canConfigureSlotsSeries()) {
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
        ? 'Editing the date-only clone for this day. Switch the day from the picker above.'
        : 'This day starts as a clone of the base schedule. Switch the day from the picker above; your changes stay on this date only.';
    }
    return 'Base slots repeat according to the selected frequency.';
  }

  protected slotOverrideDateMin(): Date | null {
    return AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
  }

  protected slotOverrideDateMax(): Date | null {
    return AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
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

  onSlotTemplateStartDateChange(index: number, value: Date | null): void {
    if (this.isDateSlotEditorMode()) {
      return;
    }
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      startAt: AppUtils.applyDatePartToIsoLocal(item.startAt, value),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  onSlotTemplateStartTimeChange(index: number, value: Date | null): void {
    this.updateSlotTemplate(index, item => this.normalizeSlotTemplateBounds({
      ...item,
      startAt: AppUtils.applyTimePartFromDateToIsoLocal(item.startAt, value),
      overrideDate: this.slotEditorMode === 'date' ? this.selectedSlotOverrideDateKey() : null,
      closed: false
    }));
  }

  onSlotTemplateEndDateChange(index: number, value: Date | null): void {
    if (this.isDateSlotEditorMode()) {
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
    this.eventStartDateValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  onEventStartTimeChange(value: Date | null): void {
    this.eventStartTimeValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  onEventEndDateChange(value: Date | null): void {
    this.eventEndDateValue = value;
    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  onEventEndTimeChange(value: Date | null): void {
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
    if (this.showTopicPicker) {
      this.showTopicPicker = false;
      return;
    }
    if (this.showSubEventsPopup) {
      this.showSubEventsPopup = false;
      return;
    }
    if (this.showEventVisibilityPicker) {
      this.showEventVisibilityPicker = false;
      return;
    }
    this.close();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showEventVisibilityPicker = false;
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
    const cachedRecord = activeUserId ? this.eventEditorDataService.peekKnownItemById(activeUserId, row.id) : null;
    const target = cachedRecord?.type === 'hosting' || row.type === 'hosting' ? 'hosting' : 'events';
    const fallbackSource = EventEditorConverter.toEventEditorFallbackSource(row, readOnly, target);

    this.editorTarget = target;
    this.editingEventId = row.id;
    this.currentMemberSummary = this.activityMembersService.peekSummaryByOwnerId(row.id);
    void this.refreshCurrentMemberSummary(row.id);

    if (cachedRecord) {
      this.currentRecord = cachedRecord;
      this.openRecord(cachedRecord, readOnly, target);
      return;
    }

    if (!activeUserId) {
      this.eventEditorService.open('edit', fallbackSource, readOnly);
      return;
    }

    const record = await this.eventEditorDataService.queryKnownItemById(activeUserId, row.id);
    if (!record) {
      this.eventEditorService.open('edit', fallbackSource, readOnly);
      return;
    }

    this.currentRecord = record;
    this.editorTarget = record.type === 'hosting' ? 'hosting' : target;
    this.editingEventId = record.id;
    this.openRecord(record, readOnly, this.editorTarget);
  }

  private openRecord(record: DemoEventRecord, readOnly: boolean, target: AppTypes.EventEditorTarget): void {
    const source = EventEditorConverter.toEventEditorSourceFromRecord(record, target);
    if (readOnly) {
      this.eventEditorService.openView(source);
      return;
    }
    this.eventEditorService.openEdit(source);
  }

  private async persistEventEditorForm(): Promise<void> {
    console.log(Date.now());
    if (this.eventEditorService.readOnly()) {
      return;
    }

    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.normalizeEventSlotTemplates();
    this.syncFirstSubEventLocationFromMainEvent();
    const normalizedCapacity = EventEditorBuilder.normalizedEventEditorCapacityRange(this.eventForm);
    this.eventForm.capacityMin = normalizedCapacity.min;
    this.eventForm.capacityMax = normalizedCapacity.max;
    if (!this.canSubmitEventEditorForm()) {
      return;
    }

    const activeUserId = this.activeUserId();
    const eventId = this.eventForm.id.trim()
      || this.editingEventId
      || this.draftEventId
      || EventEditorBuilder.buildCreatedEventEditorId(this.editorTarget);
    this.eventForm.id = eventId;
    const uploadedImageUrl = await this.resolvePersistedEventImageUrl(activeUserId, eventId);
    if (!this.demoModeEnabled && this.pendingEventImageFile && !uploadedImageUrl) {
      return;
    }
    if (uploadedImageUrl) {
      this.eventForm.imageUrl = uploadedImageUrl;
    }
    const existingRecord = this.currentRecord
      ?? (activeUserId ? this.eventEditorDataService.peekKnownItemById(activeUserId, eventId) : null);
    const memberSummary = await this.resolveCurrentEventMembersSummary(eventId, normalizedCapacity);
    this.currentMemberSummary = memberSummary;
    const payload = EventEditorBuilder.buildEventEditorSyncPayload({
      eventId,
      target: this.editorTarget,
      form: this.eventForm,
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

    this.activitiesContext.emitActivitiesEventSync(payload);

    console.log(Date.now());
  }

  private async runSaveWithPendingWindow(): Promise<void> {
    this.isSavePending = true;
    try {
      const pendingWindowPromise = this.minimumSavePendingWindow();
      const savePromise = this.runSaveAfterUiYield();

      await Promise.all([
        pendingWindowPromise,
        savePromise
      ]);

      this.isSavePending = false;
      this.eventEditorService.close();
    } catch {
      this.isSavePending = false;
    }
  }

  private minimumSavePendingWindow(): Promise<void> {
    return this.demoModeEnabled
      ? this.wait(EventEditorPopupComponent.SAVE_PENDING_WINDOW_MS)
      : Promise.resolve();
  }

  private async runSaveAfterUiYield(): Promise<void> {
    //await this.waitForAnimationKickoff();
    await this.persistEventEditorForm();
  }

  private async waitForAnimationKickoff(): Promise<void> {
    await this.waitForNextPaint();
    await this.wait(this.demoModeEnabled ? 96 : 16);
  }

  private async wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }

  private async waitForNextPaint(): Promise<void> {
    await new Promise<void>(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(() => resolve(), 0);
    });
  }

  private get demoModeEnabled(): boolean {
    return environment.activitiesDataSource === 'demo';
  }

  private resetEditorContext(): void {
    this.editorTarget = 'events';
    this.editingEventId = null;
    this.draftEventId = null;
    this.currentRecord = null;
    this.currentMemberSummary = null;
    this.lastHandledActivityMembersSyncMs = 0;
    this.pendingEventImageFile = null;
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
    return firstOverrideDate ?? AppUtils.isoLocalDateTimeToDate(this.eventForm.startAt);
  }

  private normalizeSlotOverrideDateSelection(): void {
    const min = this.slotOverrideDateMin();
    const max = this.slotOverrideDateMax();
    let next = this.slotOverrideDateValue ?? this.defaultSlotOverrideDate();
    if (!next) {
      this.slotOverrideDateValue = null;
      return;
    }
    if (min && next.getTime() < min.getTime()) {
      next = min;
    }
    if (max && next.getTime() > max.getTime()) {
      next = max;
    }
    this.slotOverrideDateValue = next;
  }

  private buildSlotTemplateId(index: number): string {
    if (this.slotEditorMode === 'date') {
      const dateKey = this.selectedSlotOverrideDateKey() || 'date';
      return `override-${dateKey}-slot-${index}`;
    }
    return `slot-${index}`;
  }

  private projectBaseSlotTemplatesToDate(dateKey: string): AppTypes.EventSlotTemplate[] {
    const overrideDate = EventEditorConverter.parseEventEditorOverrideDate(dateKey);
    if (!overrideDate) {
      return [];
    }
    return this.baseSlotTemplates().map((item, index) => ({
      id: item.id?.trim()
        ? `override-${dateKey}-${item.id.trim()}`
        : this.buildSlotTemplateId(index + 1),
      startAt: AppUtils.applyDatePartToIsoLocal(item.startAt, overrideDate),
      endAt: AppUtils.applyDatePartToIsoLocal(item.endAt, overrideDate),
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
    const normalizedTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(nextTemplates);
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
    if (this.slotEditorMode !== 'date') {
      return this.eventForm.startAt;
    }
    const dateKey = this.selectedSlotOverrideDateKey();
    const overrideDate = EventEditorConverter.parseEventEditorOverrideDate(dateKey);
    if (!overrideDate) {
      return this.eventForm.startAt;
    }
    return AppUtils.applyDatePartToIsoLocal(this.eventForm.startAt, overrideDate);
  }

  private normalizeSlotTemplateBounds(slot: AppTypes.EventSlotTemplate): AppTypes.EventSlotTemplate {
    const startDate = EventEditorConverter.parseEventEditorDateValue(slot.startAt) ?? new Date();
    const endDate = EventEditorConverter.parseEventEditorDateValue(slot.endAt);
    const normalizedEnd = !endDate || endDate.getTime() <= startDate.getTime()
      ? new Date(startDate.getTime() + (60 * 60 * 1000))
      : endDate;
    return {
      ...slot,
      startAt: AppUtils.toIsoDateTimeLocal(startDate),
      endAt: AppUtils.toIsoDateTimeLocal(normalizedEnd)
    };
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
        capacityTotal: summary.capacityTotal,
        acceptedMemberUserIds: [...summary.acceptedMemberUserIds],
        pendingMemberUserIds: [...summary.pendingMemberUserIds]
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
      acceptedMemberUserIds: [...(summary?.acceptedMemberUserIds ?? this.currentRecord?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(summary?.pendingMemberUserIds ?? this.currentRecord?.pendingMemberUserIds ?? [])]
    };
  }

  private populateFormFromSourceEvent(sourceEvent: Record<string, unknown>): void {
    const state = EventEditorConverter.toEventEditorFormState(sourceEvent);
    this.editingEventId = state.form.id.trim() || this.editingEventId;
    this.pendingEventImageFile = null;
    this.eventForm = {
      ...state.form,
      slotTemplates: EventEditorBuilder.cloneEventEditorSlotTemplates(state.form.slotTemplates),
      subEvents: EventEditorBuilder.cloneEventEditorSubEvents(state.form.subEvents)
    };
    this.subEventsDisplayMode = state.subEventsDisplayMode;
    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
    this.slotEditorMode = 'base';
    this.slotsPanelExpanded = this.eventForm.slotsEnabled;
    this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    this.normalizeSlotOverrideDateSelection();
  }

  private resetForm(target: AppTypes.EventEditorTarget = this.editorTarget): void {
    const start = new Date();
    const end = new Date(start.getTime() + (60 * 60 * 1000));

    this.pendingEventImageFile = null;
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
      slotsEnabled: false,
      slotTemplates: [],
      topics: [],
      subEvents: [],
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end)
    };

    this.subEventsDisplayMode = 'Casual';
    this.showEventVisibilityPicker = false;
    this.syncDateTimeControlsFromForm();
    this.slotEditorMode = 'base';
    this.slotsPanelExpanded = false;
    this.slotOverrideDateValue = this.defaultSlotOverrideDate();
    this.normalizeSlotOverrideDateSelection();
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
    const end = AppUtils.isoLocalDateTimeToDate(this.eventForm.endAt);
    if (!start || !end) {
      return;
    }

    if (end.getTime() <= start.getTime()) {
      const nextEnd = new Date(start.getTime() + (60 * 60 * 1000));
      this.eventForm.endAt = AppUtils.toIsoDateTimeLocal(nextEnd);
    }

    if (!this.eventFrequencyOptions.includes(this.eventForm.frequency)) {
      this.eventForm.frequency = this.eventFrequencyOptions[0] ?? 'One-time';
    }
    this.normalizeSlotOverrideDateSelection();
  }

  private normalizeEventSlotTemplates(): void {
    if (!this.eventForm.slotsEnabled) {
      this.eventForm.slotTemplates = [];
      return;
    }

    this.eventForm.slotTemplates = EventEditorBuilder.buildPersistedEventEditorSlotTemplates(this.eventForm.slotTemplates);
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
    if (this.eventForm.subEvents.length === 0) {
      return;
    }
    this.eventForm.subEvents = EventEditorBuilder.withFirstEventEditorSubEventLocation(
      this.eventForm.subEvents,
      this.eventForm.location
    );
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
    if (this.demoModeEnabled || !this.pendingEventImageFile) {
      return this.eventForm.imageUrl.trim() || null;
    }
    const uploadResult = await this.httpMediaService.uploadImage('event', activeUserId, eventId, this.pendingEventImageFile);
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

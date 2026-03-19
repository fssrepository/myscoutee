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
import { ActivitiesDbContextService } from '../../services/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import type * as AppTypes from '../../../shared/core/base/models';
import { ActivityMembersService, AppContext, EventsService } from '../../../shared/core';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import { TopicPickerPopupComponent } from '../../../shared/ui';
import { EventSubeventsPopupComponent, EventSubeventsItem } from '../event-subevents-popup/event-subevents-popup.component';

type EventVisibility = 'Public' | 'Friends only' | 'Invitation only';
type EventBlindMode = 'Open Event' | 'Blind Event';
type SubEventsDisplayMode = 'Casual' | 'Tournament';

interface EventEditorSubEventItem {
  description?: string;
  id?: string;
  name?: string;
  title?: string;
  location?: string;
  optional?: boolean;
  startAt?: string;
  endAt?: string;
  capacityMin?: number;
  capacityMax?: number;
  groups?: EventEditorSubEventGroupItem[];
  membersPending?: number;
  membersAccepted?: number;
  carsPending?: number;
  accommodationPending?: number;
  suppliesPending?: number;
  [key: string]: unknown;
}

interface EventEditorSubEventGroupItem {
  id?: string;
  name?: string;
  source?: string;
  membersPending?: number;
  capacityMin?: number;
  capacityMax?: number;
}

interface EventEditorSavePayload {
  title: string;
  description: string;
  imageUrl: string;
  visibility: EventVisibility;
  frequency: string;
  location: string;
  capacityMin: number | null;
  capacityMax: number | null;
  blindMode: EventBlindMode;
  autoInviter: boolean;
  ticketing: boolean;
  topics: string[];
  subEvents: EventEditorSubEventItem[];
  subEventsDisplayMode: SubEventsDisplayMode;
  startAt: string;
  endAt: string;
}

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
    EventSubeventsPopupComponent
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  protected readonly eventEditorService = inject(EventEditorService);
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  protected readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  @ViewChild('eventImageInput') eventImageInput!: ElementRef<HTMLInputElement>;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private editorTarget: AppTypes.EventEditorTarget = 'events';
  private lastHandledOpenSubEventsRequest = 0;
  protected editingEventId: string | null = null;
  private draftEventId: string | null = null;
  private currentRecord: DemoEventRecord | null = null;

  constructor() {
    effect(() => {
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventEditorCreate' && request.type !== 'eventEditor')) {
        return;
      }
      this.activitiesContext.clearActivitiesNavigationRequest();
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

  eventForm = {
    title: '',
    description: '',
    imageUrl: '',
    visibility: 'Public' as EventVisibility,
    frequency: 'One-time',
    location: '',
    capacityMin: 0 as number | null,
    capacityMax: 0 as number | null,
    blindMode: 'Open Event' as EventBlindMode,
    autoInviter: false,
    ticketing: false,
    topics: [] as string[],
    subEvents: [] as EventEditorSubEventItem[],
    startAt: '',
    endAt: ''
  };

  eventStartDateValue: Date | null = null;
  eventStartTimeValue: Date | null = null;
  eventEndDateValue: Date | null = null;
  eventEndTimeValue: Date | null = null;

  subEventsDisplayMode: SubEventsDisplayMode = 'Casual';
  showEventVisibilityPicker = false;
  showSubEventsPopup = false;
  showTopicPicker = false;

  readonly visibilityOptions: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly'];

  close(): void {
    this.showEventVisibilityPicker = false;
    this.showSubEventsPopup = false;
    this.showTopicPicker = false;
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
    const row: AppTypes.ActivityListRow = {
      id: source?.id ?? this.draftEventId ?? 'draft-event',
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
        id: this.draftEventId ?? 'draft-event',
        avatar: '',
        title: this.eventForm.title.trim() || 'New Event',
        shortDescription: this.eventForm.description.trim() || 'Draft event',
        timeframe: this.eventForm.startAt || 'Draft'
      }
    };
    this.activitiesContext.requestActivitiesNavigation({ type: 'eventEditorMembers', row });
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
    const mapped: EventEditorSubEventItem[] = subEvents.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group }))
    }));
    this.eventForm.subEvents = this.cloneSubEvents(mapped);
    this.syncMainEventBoundsFromSubEvents();
    this.syncDateTimeControlsFromForm();
  }

  updateSubEventsDisplayMode(mode: SubEventsDisplayMode): void {
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
    this.eventForm.topics = selected
      .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
      .filter(item => item.length > 0)
      .slice(0, 5);
  }

  eventEditorHeaderPendingMemberCount(): number {
    const source: any = this.eventEditorService.sourceEvent();
    const pendingRaw = source?.pendingMembersCount
      ?? source?.pendingCount
      ?? source?.pendingMembers
      ?? source?.pending
      ?? source?.pendingInvites
      ?? source?.activity
      ?? source?.unread
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
    this.syncEventFormFromDateTimeControls();
    return Boolean(
      this.eventForm.title.trim()
      && this.eventForm.description.trim()
      && this.eventForm.capacityMin !== null
      && this.eventForm.capacityMax !== null
      && this.eventForm.startAt
      && this.eventForm.endAt
    );
  }

  saveEventEditorForm(): void {
    if (!this.canSubmitEventEditorForm()) {
      return;
    }
    void this.persistEventEditorForm();
  }

  private buildEventEditorPayload(): EventEditorSavePayload {
    return {
      title: this.eventForm.title.trim(),
      description: this.eventForm.description.trim(),
      imageUrl: this.eventForm.imageUrl,
      visibility: this.eventForm.visibility,
      frequency: this.eventForm.frequency,
      location: this.eventForm.location,
      capacityMin: this.eventForm.capacityMin ?? 0,
      capacityMax: this.eventForm.capacityMax ?? 0,
      blindMode: this.eventForm.blindMode,
      autoInviter: this.eventForm.autoInviter,
      ticketing: this.eventForm.ticketing,
      topics: [...this.eventForm.topics],
      subEvents: this.cloneSubEvents(this.eventForm.subEvents),
      subEventsDisplayMode: this.subEventsDisplayMode,
      startAt: this.eventForm.startAt,
      endAt: this.eventForm.endAt
    };
  }

  toggleEventVisibilityPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.showEventVisibilityPicker = !this.showEventVisibilityPicker;
  }

  selectVisibility(option: EventVisibility, event?: Event): void {
    event?.stopPropagation();
    if (this.eventEditorService.readOnly()) {
      return;
    }
    this.eventForm.visibility = this.normalizeVisibility(option);
    this.showEventVisibilityPicker = false;
  }

  getVisibilityIcon(visibility: string): string {
    switch (this.normalizeVisibility(visibility)) {
      case 'Friends only':
        return 'groups';
      case 'Invitation only':
        return 'mail_lock';
      default:
        return 'public';
    }
  }

  eventVisibilityClass(visibility: string): string {
    switch (this.normalizeVisibility(visibility)) {
      case 'Friends only':
        return 'event-visibility-friends';
      case 'Invitation only':
        return 'event-visibility-invitation';
      default:
        return 'event-visibility-public';
    }
  }

  eventBlindModeClass(mode: string): string {
    return this.normalizeBlindMode(mode) === 'Blind Event' ? 'blind-mode-blind' : 'blind-mode-open';
  }

  eventBlindModeIcon(mode: string): string {
    return this.normalizeBlindMode(mode) === 'Blind Event' ? 'visibility_off' : 'visibility';
  }

  eventBlindModeDescription(mode: string): string {
    return this.normalizeBlindMode(mode) === 'Blind Event'
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
    switch (this.normalizeFrequency(frequency)) {
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
    switch (this.normalizeFrequency(frequency)) {
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

  subEventLocationLabel(subEvent: EventEditorSubEventItem | null | undefined): string {
    const location = this.normalizeLocation(subEvent?.location).trim();
    return location || 'Location pending';
  }

  subEventPanelChipTitle(subEvent: EventEditorSubEventItem, index: number): string {
    const baseName = (this.subEventName(subEvent) || 'Untitled').trim() || 'Untitled';
    if (this.subEventsDisplayMode !== 'Tournament') {
      return baseName;
    }
    return `Stage ${index + 1} - ${baseName}`;
  }

  subEventCardRange(subEvent: EventEditorSubEventItem): string {
    const start = this.parseDateValue(subEvent.startAt);
    const end = this.parseDateValue(subEvent.endAt);
    if (!start || !end) {
      return 'Date pending';
    }
    const startLabel = `${AppUtils.pad2(start.getMonth() + 1)}/${AppUtils.pad2(start.getDate())} ${AppUtils.pad2(start.getHours())}:${AppUtils.pad2(start.getMinutes())}`;
    const endLabel = `${AppUtils.pad2(end.getMonth() + 1)}/${AppUtils.pad2(end.getDate())} ${AppUtils.pad2(end.getHours())}:${AppUtils.pad2(end.getMinutes())}`;
    return `${startLabel} - ${endLabel}`;
  }

  subEventPanelChipIsCurrent(subEvent: EventEditorSubEventItem): boolean {
    const source = this.sortSubEventRefsByStartAsc(this.eventForm.subEvents);
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
    const normalizedTopic = this.normalizeTopicToken(topic);
    if (!normalizedTopic) {
      return '';
    }
    for (const group of this.interestOptionGroups) {
      if (group.options.some(option => this.normalizeTopicToken(option) === normalizedTopic)) {
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
    this.eventForm.imageUrl = URL.createObjectURL(file);
    target.value = '';
  }

  onEventCapacityMinChange(value: number | string): void {
    const parsed = this.toCapacityInputValue(value);
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
    const parsed = this.toCapacityInputValue(value);
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

  onEventLocationChange(value: string): void {
    this.eventForm.location = this.normalizeLocation(value);
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
    this.draftEventId = `draft-${target}-${Date.now()}`;
    this.resetForm(target);
    this.eventEditorService.openCreate();
  }

  private async openEditRequest(row: AppTypes.ActivityListRow, readOnly: boolean): Promise<void> {
    this.resetEditorContext();
    const activeUserId = this.activeUserId();
    const cachedRecord = activeUserId ? this.eventsService.peekKnownItemById(activeUserId, row.id) : null;
    const target = cachedRecord?.type === 'hosting' || row.type === 'hosting' ? 'hosting' : 'events';
    const fallbackSource = this.buildFallbackSource(row, readOnly, target);

    this.editorTarget = target;
    this.editingEventId = row.id;
    if (cachedRecord) {
      this.currentRecord = cachedRecord;
      this.openRecord(cachedRecord, readOnly, target);
    } else {
      this.eventEditorService.open(readOnly ? 'edit' : 'edit', fallbackSource, readOnly);
    }

    if (!activeUserId) {
      return;
    }
    const record = await this.eventsService.queryKnownItemById(activeUserId, row.id);
    if (!record) {
      return;
    }
    this.currentRecord = record;
    this.editorTarget = record.type === 'hosting' ? 'hosting' : target;
    this.editingEventId = record.id;
    this.openRecord(record, readOnly, this.editorTarget);
  }

  private openRecord(record: DemoEventRecord, readOnly: boolean, target: AppTypes.EventEditorTarget): void {
    const source = this.buildSourceEventFromRecord(record, target);
    if (readOnly) {
      this.eventEditorService.openView(source);
      return;
    }
    this.eventEditorService.openEdit(source);
  }

  private buildSourceEventFromRecord(
    record: DemoEventRecord,
    target: AppTypes.EventEditorTarget
  ): Record<string, unknown> {
    return {
      id: record.id,
      avatar: record.creatorInitials,
      title: record.title,
      description: record.subtitle,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: target === 'hosting' ? true : record.isAdmin,
      imageUrl: record.imageUrl,
      visibility: record.visibility,
      frequency: record.frequency ?? 'One-time',
      location: record.location,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      blindMode: record.blindMode,
      autoInviter: record.autoInviter ?? false,
      ticketing: record.ticketing,
      topics: [...record.topics],
      subEvents: this.normalizeSubEvents(record.subEvents ?? []),
      subEventsDisplayMode: record.subEventsDisplayMode,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      published: record.published,
      pendingMembersCount: record.pendingMembers,
      distanceKm: record.distanceKm,
      sourceLink: record.sourceLink,
      locationCoordinates: record.locationCoordinates
    };
  }

  private buildFallbackSource(
    row: AppTypes.ActivityListRow,
    readOnly: boolean,
    target: AppTypes.EventEditorTarget
  ): Record<string, unknown> {
    const rowSource = row.source as unknown as Partial<Record<string, unknown>> | null;
    const title = this.normalizeTextValue(rowSource?.['title']) || row.title;
    const description = this.normalizeTextValue(rowSource?.['shortDescription'] ?? rowSource?.['description']) || row.subtitle;
    return {
      id: row.id,
      avatar: this.normalizeTextValue(rowSource?.['avatar']),
      title,
      description,
      shortDescription: description,
      timeframe: this.normalizeTextValue(rowSource?.['timeframe']) || row.detail,
      activity: Math.max(0, Math.trunc(Number(row.unread) || 0)),
      isAdmin: row.isAdmin === true,
      imageUrl: this.normalizeTextValue(rowSource?.['imageUrl']),
      visibility: target === 'hosting' ? 'Invitation only' : 'Public',
      frequency: 'One-time',
      location: this.normalizeTextValue(rowSource?.['location']),
      capacityMin: this.toCapacityInputValue(rowSource?.['capacityMin']),
      capacityMax: this.toCapacityInputValue(rowSource?.['capacityMax']),
      blindMode: 'Open Event',
      autoInviter: false,
      ticketing: Boolean(rowSource?.['ticketing']),
      topics: Array.isArray(rowSource?.['topics']) ? rowSource?.['topics'] : [],
      subEvents: [],
      subEventsDisplayMode: 'Casual',
      startAt: this.normalizeTextValue(rowSource?.['startAt']) || row.dateIso,
      endAt: this.normalizeTextValue(rowSource?.['endAt']) || row.dateIso,
      published: true,
      pendingMembersCount: row.unread,
      distanceKm: row.distanceKm,
      sourceLink: this.normalizeTextValue(rowSource?.['sourceLink']),
      readOnly
    };
  }

  private async persistEventEditorForm(): Promise<void> {
    if (this.eventEditorService.readOnly()) {
      return;
    }

    this.syncEventFormFromDateTimeControls();
    this.normalizeEventDateRange();
    this.syncFirstSubEventLocationFromMainEvent();
    const normalizedCapacity = this.normalizedEventCapacityRange();
    this.eventForm.capacityMin = normalizedCapacity.min;
    this.eventForm.capacityMax = normalizedCapacity.max;
    if (!this.canSubmitEventEditorForm()) {
      return;
    }

    const activeUserId = this.activeUserId();
    const eventId = this.editingEventId ?? this.buildCreatedEventId();
    const existingRecord = this.currentRecord
      ?? (activeUserId ? this.eventsService.peekKnownItemById(activeUserId, eventId) : null);
    const summary = this.editingEventId
      ? await this.activityMembersService.querySummaryByOwnerId(this.editingEventId)
      : null;
    const acceptedMembers = summary?.acceptedMembers
      ?? existingRecord?.acceptedMembers
      ?? 0;
    const pendingMembers = summary?.pendingMembers
      ?? existingRecord?.pendingMembers
      ?? 0;
    const capacityTotal = summary?.capacityTotal
      ?? existingRecord?.capacityTotal
      ?? Math.max(0, normalizedCapacity.max ?? normalizedCapacity.min ?? 0);
    const payload = this.buildActivitiesEventSyncPayload(
      eventId,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      existingRecord,
      summary?.acceptedMemberUserIds ?? existingRecord?.acceptedMemberUserIds ?? [],
      summary?.pendingMemberUserIds ?? existingRecord?.pendingMemberUserIds ?? []
    );

    this.activitiesContext.emitActivitiesEventSync(payload);
    this.eventEditorService.close();
  }

  private buildActivitiesEventSyncPayload(
    eventId: string,
    acceptedMembers: number,
    pendingMembers: number,
    capacityTotal: number,
    existingRecord: DemoEventRecord | null,
    acceptedMemberUserIds: readonly string[],
    pendingMemberUserIds: readonly string[]
  ): Omit<AppTypes.ActivitiesEventSyncPayload, 'syncKey'> {
    const activeUserId = this.activeUserId();
    const activeUserProfile = activeUserId ? this.appCtx.getUserProfile(activeUserId) : null;
    const timeframe = this.buildEventTimeframeLabel(this.eventForm.startAt, this.eventForm.endAt, this.eventForm.frequency);
    const createdByCurrentUser = Boolean(activeUserId);

    return {
      id: eventId,
      target: this.editorTarget,
      title: this.eventForm.title.trim(),
      shortDescription: this.eventForm.description.trim(),
      timeframe,
      activity: existingRecord?.activity ?? 0,
      isAdmin: true,
      startAt: this.eventForm.startAt,
      endAt: this.eventForm.endAt,
      distanceKm: existingRecord?.distanceKm ?? 0,
      imageUrl: this.eventForm.imageUrl || existingRecord?.imageUrl || '',
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(acceptedMembers, capacityTotal),
      capacityMin: this.eventForm.capacityMin,
      capacityMax: this.eventForm.capacityMax,
      autoInviter: this.eventForm.autoInviter,
      frequency: this.eventForm.frequency,
      ticketing: this.eventForm.ticketing,
      visibility: this.eventForm.visibility,
      blindMode: this.eventForm.blindMode,
      published: this.editorTarget === 'hosting'
        ? (existingRecord?.published ?? false)
        : true,
      creatorUserId: createdByCurrentUser ? activeUserId : existingRecord?.creatorUserId,
      creatorName: activeUserProfile?.name ?? existingRecord?.creatorName,
      creatorInitials: activeUserProfile?.initials ?? existingRecord?.creatorInitials,
      creatorGender: activeUserProfile?.gender ?? existingRecord?.creatorGender,
      creatorCity: activeUserProfile?.city ?? existingRecord?.creatorCity,
      location: this.eventForm.location.trim(),
      locationCoordinates: existingRecord?.locationCoordinates ?? undefined,
      sourceLink: existingRecord?.sourceLink ?? '',
      acceptedMemberUserIds: Array.from(new Set(acceptedMemberUserIds.filter(id => id.trim().length > 0))),
      pendingMemberUserIds: Array.from(new Set(pendingMemberUserIds.filter(id => id.trim().length > 0))),
      topics: [...this.eventForm.topics],
      subEvents: this.buildPersistedSubEvents(),
      subEventsDisplayMode: this.subEventsDisplayMode
    };
  }

  private buildPersistedSubEvents(): AppTypes.SubEventFormItem[] {
    return this.eventForm.subEvents.map((item, index) => {
      const rawItem = item as EventEditorSubEventItem & Record<string, unknown>;
      const capacityMin = Math.max(0, Math.trunc(Number(item.capacityMin) || 0));
      const capacityMax = Math.max(capacityMin, Math.trunc(Number(item.capacityMax) || capacityMin));

      return {
        id: item.id?.trim() || `subevent-${index + 1}`,
        name: `${item.name ?? item.title ?? `Sub Event ${index + 1}`}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        startAt: `${item.startAt ?? ''}`.trim(),
        endAt: `${item.endAt ?? ''}`.trim(),
        location: this.normalizeLocation(item.location),
        optional: Boolean(item.optional),
        capacityMin,
        capacityMax,
        tournamentGroupCount: Number.isFinite(Number(rawItem['tournamentGroupCount']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentGroupCount'])))
          : undefined,
        tournamentGroupCapacityMin: Number.isFinite(Number(rawItem['tournamentGroupCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentGroupCapacityMin'])))
          : undefined,
        tournamentGroupCapacityMax: Number.isFinite(Number(rawItem['tournamentGroupCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentGroupCapacityMax'])))
          : undefined,
        tournamentLeaderboardType: rawItem['tournamentLeaderboardType'] === 'Fifa' ? 'Fifa' : 'Score',
        tournamentAdvancePerGroup: Number.isFinite(Number(rawItem['tournamentAdvancePerGroup']))
          ? Math.max(0, Math.trunc(Number(rawItem['tournamentAdvancePerGroup'])))
          : undefined,
        groups: (item.groups ?? []).map((group, groupIndex) => {
          const groupCapacityMin = Number.isFinite(Number(group.capacityMin))
            ? Math.max(0, Math.trunc(Number(group.capacityMin)))
            : undefined;
          const groupCapacityMax = Number.isFinite(Number(group.capacityMax))
            ? Math.max(groupCapacityMin ?? 0, Math.trunc(Number(group.capacityMax)))
            : groupCapacityMin;
          return {
            id: group.id?.trim() || `group-${index + 1}-${groupIndex + 1}`,
            name: `${group.name ?? `Group ${String.fromCharCode(65 + (groupIndex % 26))}`}`.trim(),
            source: group.source === 'manual' ? 'manual' : 'generated',
            capacityMin: groupCapacityMin,
            capacityMax: groupCapacityMax
          };
        }),
        membersAccepted: Math.max(0, Math.trunc(Number(item.membersAccepted) || 0)),
        membersPending: Math.max(0, Math.trunc(Number(item.membersPending) || 0)),
        carsPending: Math.max(0, Math.trunc(Number(item.carsPending) || 0)),
        accommodationPending: Math.max(0, Math.trunc(Number(item.accommodationPending) || 0)),
        suppliesPending: Math.max(0, Math.trunc(Number(item.suppliesPending) || 0)),
        carsAccepted: Number.isFinite(Number(rawItem['carsAccepted']))
          ? Math.max(0, Math.trunc(Number(rawItem['carsAccepted'])))
          : undefined,
        accommodationAccepted: Number.isFinite(Number(rawItem['accommodationAccepted']))
          ? Math.max(0, Math.trunc(Number(rawItem['accommodationAccepted'])))
          : undefined,
        suppliesAccepted: Number.isFinite(Number(rawItem['suppliesAccepted']))
          ? Math.max(0, Math.trunc(Number(rawItem['suppliesAccepted'])))
          : undefined,
        carsCapacityMin: Number.isFinite(Number(rawItem['carsCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['carsCapacityMin'])))
          : undefined,
        carsCapacityMax: Number.isFinite(Number(rawItem['carsCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['carsCapacityMax'])))
          : undefined,
        accommodationCapacityMin: Number.isFinite(Number(rawItem['accommodationCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['accommodationCapacityMin'])))
          : undefined,
        accommodationCapacityMax: Number.isFinite(Number(rawItem['accommodationCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['accommodationCapacityMax'])))
          : undefined,
        suppliesCapacityMin: Number.isFinite(Number(rawItem['suppliesCapacityMin']))
          ? Math.max(0, Math.trunc(Number(rawItem['suppliesCapacityMin'])))
          : undefined,
        suppliesCapacityMax: Number.isFinite(Number(rawItem['suppliesCapacityMax']))
          ? Math.max(0, Math.trunc(Number(rawItem['suppliesCapacityMax'])))
          : undefined
      };
    });
  }

  private resetEditorContext(): void {
    this.editorTarget = 'events';
    this.editingEventId = null;
    this.draftEventId = null;
    this.currentRecord = null;
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim() || this.appCtx.getActiveUserId().trim();
  }

  private buildCreatedEventId(): string {
    const stamp = Date.now();
    return this.editorTarget === 'hosting' ? `h${stamp}` : `e${stamp}`;
  }

  private normalizeTextValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private populateFormFromSourceEvent(sourceEvent: any): void {
    const source = sourceEvent as any;
    const startAtDate = this.parseDateValue(source.startAt ?? source.startDate);
    const endAtDate = this.parseDateValue(source.endAt ?? source.endDate);
    const resolvedStart = startAtDate ?? new Date();
    const resolvedEnd = endAtDate ?? new Date(resolvedStart.getTime() + (60 * 60 * 1000));
    const sourceCapacity = (typeof source.capacity === 'object' && source.capacity !== null)
      ? source.capacity as { min?: unknown; max?: unknown }
      : null;

    this.eventForm = {
      title: `${source.title ?? ''}`.trim(),
      description: `${source.description ?? source.shortDescription ?? ''}`.trim(),
      imageUrl: this.resolveSourceImage(sourceEvent),
      visibility: this.normalizeVisibility(source.visibility),
      frequency: this.normalizeFrequency(source.frequency),
      location: this.normalizeLocation(source.location),
      capacityMin: this.toCapacityInputValue(source.capacityMin ?? sourceCapacity?.min) ?? 0,
      capacityMax: this.toCapacityInputValue(source.capacityMax ?? sourceCapacity?.max) ?? 0,
      blindMode: this.normalizeBlindMode(source.blindMode ?? source.matchingMode),
      autoInviter: this.normalizeAutoInviter(source.autoInviter ?? source.inviteMode),
      ticketing: this.normalizeTicketing(source.ticketing ?? source.ticketType),
      topics: this.normalizeTopics(source.topics ?? source.tags),
      subEvents: this.normalizeSubEvents(source.subEvents ?? source.subevents ?? source.sub_events),
      startAt: AppUtils.toIsoDateTimeLocal(resolvedStart),
      endAt: AppUtils.toIsoDateTimeLocal(resolvedEnd)
    };

    this.subEventsDisplayMode = this.normalizeSubEventsDisplayMode(
      source.subEventsDisplayMode,
      this.eventForm.subEvents
    );

    this.normalizeEventDateRange();
    this.syncDateTimeControlsFromForm();
  }

  private resetForm(target: AppTypes.EventEditorTarget = this.editorTarget): void {
    const start = new Date();
    const end = new Date(start.getTime() + (60 * 60 * 1000));

    this.eventForm = {
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
      topics: [],
      subEvents: [],
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end)
    };

    this.subEventsDisplayMode = 'Casual';
    this.showEventVisibilityPicker = false;
    this.syncDateTimeControlsFromForm();
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
      let startMs = this.parseDateValue(item.startAt)?.getTime() ?? Number.NaN;
      let endMs = this.parseDateValue(item.endAt)?.getTime() ?? Number.NaN;
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        if (endMs <= startMs) {
          endMs = startMs + (60 * 60 * 1000);
        }
        minStartMs = minStartMs === null ? startMs : Math.min(minStartMs, startMs);
        maxEndMs = maxEndMs === null ? endMs : Math.max(maxEndMs, endMs);
      }

      const normalizedMin = this.normalizedCapacityValueWithFloor(item.capacityMin, 0);
      const normalizedMax = this.normalizedCapacityValueWithFloor(item.capacityMax, 0);
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

    const first = this.firstSubEventByOrder();
    if (first) {
      this.eventForm.location = this.normalizeLocation(first.location);
    }
  }

  private cloneSubEvents(items: readonly EventEditorSubEventItem[]): EventEditorSubEventItem[] {
    return items.map(item => ({
      ...item,
      groups: (item.groups ?? []).map(group => ({ ...group }))
    }));
  }

  private firstSubEventByOrder(items: readonly EventEditorSubEventItem[] = this.eventForm.subEvents): EventEditorSubEventItem | null {
    const ordered = this.sortSubEventRefsByStartAsc(items);
    return ordered[0] ?? null;
  }

  private withFirstSubEventLocation(items: readonly EventEditorSubEventItem[], location: string): EventEditorSubEventItem[] {
    if (items.length === 0) {
      return [];
    }
    const first = this.firstSubEventByOrder(items);
    if (!first?.id) {
      return this.cloneSubEvents(items);
    }
    const normalizedLocation = this.normalizeLocation(location);
    return items.map(item => item.id === first.id
      ? { ...item, location: normalizedLocation, groups: (item.groups ?? []).map(group => ({ ...group })) }
      : { ...item, groups: (item.groups ?? []).map(group => ({ ...group })) });
  }

  private syncFirstSubEventLocationFromMainEvent(): void {
    if (this.eventForm.subEvents.length === 0) {
      return;
    }
    this.eventForm.subEvents = this.withFirstSubEventLocation(this.eventForm.subEvents, this.eventForm.location);
  }

  private eventLocationRouteStops(): string[] {
    const mainLocation = this.normalizeLocation(this.eventForm.location).trim();
    const subEventStops = this.sortSubEventRefsByStartAsc(this.eventForm.subEvents)
      .map(item => this.normalizeLocation(item.location).trim())
      .filter(stop => stop.length > 0);
    const ordered = [mainLocation, ...subEventStops].filter(stop => stop.length > 0);
    return Array.from(new Set(ordered));
  }

  private normalizedEventCapacityRange(): AppTypes.EventCapacityRange {
    const min = this.normalizedCapacityValueWithFloor(this.eventForm.capacityMin, 0);
    const maxCandidate = this.normalizedCapacityValueWithFloor(this.eventForm.capacityMax, 0);
    const max = min !== null && maxCandidate !== null
      ? Math.max(min, maxCandidate)
      : (maxCandidate ?? min);
    return {
      min,
      max
    };
  }

  private normalizedCapacityValueWithFloor(value: unknown, floor: number): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(floor, Math.trunc(parsed));
  }

  private normalizeVisibility(value: unknown): EventVisibility {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'private' || normalized.includes('friend')) {
      return 'Friends only';
    }
    if (normalized.includes('invitation')) {
      return 'Invitation only';
    }
    return 'Public';
  }

  private normalizeFrequency(value: unknown): string {
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
    return 'One-time';
  }

  private normalizeBlindMode(value: unknown): EventBlindMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('blind') ? 'Blind Event' : 'Open Event';
  }

  private normalizeAutoInviter(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized.includes('off') || normalized.includes('close') || normalized.includes('manual')) {
      return false;
    }
    return normalized.includes('on') || normalized.includes('open') || normalized.includes('auto');
  }

  private normalizeTicketing(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (!normalized || normalized.includes('none') || normalized.includes('off') || normalized.includes('free')) {
      return false;
    }
    return normalized.includes('on') || normalized.includes('required') || normalized.includes('ticket');
  }

  private normalizeTopics(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => `${item ?? ''}`.trim().replace(/^#+/, ''))
      .filter(item => item.length > 0)
      .slice(0, 5);
  }

  private normalizeSubEvents(value: unknown): EventEditorSubEventItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry, index) => {
      const item = (typeof entry === 'object' && entry !== null) ? entry as any : {};
      const resolvedName = `${item.name ?? item.title ?? `Sub event ${index + 1}`}`.trim() || `Sub event ${index + 1}`;
      const startAtDate = this.parseDateValue(item.startAt ?? item.startDate);
      const endAtDate = this.parseDateValue(item.endAt ?? item.endDate);
      return {
        ...item,
        name: resolvedName,
        title: `${item.title ?? resolvedName}`.trim() || resolvedName,
        location: this.normalizeLocation(item.location),
        optional: Boolean(item.optional),
        startAt: startAtDate ? AppUtils.toIsoDateTimeLocal(startAtDate) : '',
        endAt: endAtDate ? AppUtils.toIsoDateTimeLocal(endAtDate) : ''
      };
    });
  }

  private normalizeSubEventsDisplayMode(value: unknown, subEvents: readonly EventEditorSubEventItem[] = []): SubEventsDisplayMode {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'tournament') {
      return 'Tournament';
    }
    const hasTournamentGroup = subEvents.some(item => Array.isArray(item.groups) && item.groups.length > 0);
    return hasTournamentGroup ? 'Tournament' : 'Casual';
  }

  private normalizeLocation(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  private resolveSourceImage(sourceEvent: Record<string, unknown>): string {
    const source = sourceEvent as any;
    const directImage = source.imageUrl
      ?? source.image
      ?? source.coverImage
      ?? source.photoUrl
      ?? source.bannerImage
      ?? source.banner;

    if (typeof directImage === 'string' && directImage.trim()) {
      return directImage.trim();
    }

    const images = source.images;
    if (Array.isArray(images) && images.length > 0) {
      const first = images[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
    }

    return '';
  }

  private parseDateValue(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }

    const parsed = new Date(raw.replace(/\//g, '-'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toCapacityInputValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private normalizeTopicToken(value: unknown): string {
    return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
  }

  private currentSubEventPanelState(): { item: EventEditorSubEventItem; index: number } | null {
    const source = this.sortSubEventRefsByStartAsc(this.eventForm.subEvents);
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

  private sortSubEventRefsByStartAsc(items: readonly EventEditorSubEventItem[]): EventEditorSubEventItem[] {
    return [...items]
      .map((item, index) => ({
        item,
        index,
        startMs: new Date(item.startAt ?? '').getTime()
      }))
      .sort((a, b) => {
        const aTime = Number.isNaN(a.startMs) ? Number.POSITIVE_INFINITY : a.startMs;
        const bTime = Number.isNaN(b.startMs) ? Number.POSITIVE_INFINITY : b.startMs;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return a.index - b.index;
      })
      .map(entry => entry.item);
  }

  private resolveCurrentSubEventIndex(items: EventEditorSubEventItem[]): number {
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

  private buildEventTimeframeLabel(startAt: string, endAt: string, frequency: string): string {
    const start = this.parseDateValue(startAt);
    const end = this.parseDateValue(endAt);
    if (!start || !end) {
      return startAt || endAt || '';
    }

    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const normalizedFrequency = this.normalizeFrequency(frequency);

    if (normalizedFrequency === 'One-time') {
      return `${dateLabel} · ${startTime} - ${endTime}`;
    }

    return `${normalizedFrequency} · ${dateLabel} · ${startTime} - ${endTime}`;
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

  private subEventName(subEvent: EventEditorSubEventItem): string {
    return `${subEvent.name ?? subEvent.title ?? 'Untitled'}`;
  }

  private isHostingLikeSource(source: any): boolean {
    if (!source || typeof source !== 'object') {
      return false;
    }
    return !('isAdmin' in source) || source.isAdmin !== true;
  }
}

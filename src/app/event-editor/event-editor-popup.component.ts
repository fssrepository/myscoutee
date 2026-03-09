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
import { EventEditorService } from '../shared/event-editor.service';
import { APP_STATIC_DATA } from '../shared/app-static-data';
import { AppUtils } from '../shared/app-utils';
import { EventSubeventsPopupComponent, EventSubeventsItem } from './event-subevents-popup.component';

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
    EventSubeventsPopupComponent
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  protected readonly eventEditorService = inject(EventEditorService);
  private readonly interestOptionGroups = APP_STATIC_DATA.interestOptionGroups;

  @ViewChild('eventImageInput') eventImageInput!: ElementRef<HTMLInputElement>;

  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;
  private readonly openSubEventsFromAppHandler = () => {
    if (!this.eventEditorService.isOpen()) {
      return;
    }
    this.showEventVisibilityPicker = false;
    this.showSubEventsPopup = true;
  };
  private readonly closeSubEventsFromAppHandler = () => {
    this.showSubEventsPopup = false;
  };

  constructor() {
    effect(() => {
      const sourceEvent = this.eventEditorService.sourceEvent();
      const isOpen = this.eventEditorService.isOpen();

      if (!isOpen) {
        this.showEventVisibilityPicker = false;
        this.showSubEventsPopup = false;
        return;
      }

      if (sourceEvent) {
        this.populateFormFromSourceEvent(sourceEvent);
        return;
      }

      this.resetForm();
    });

    effect(() => {
      const request = this.eventEditorService.subEventResourcePopupRequest();
      if (!request || typeof window === 'undefined') {
        return;
      }
      window.dispatchEvent(new CustomEvent('app:openSubEventResourcePopupFromEventEditor', { detail: request }));
      this.eventEditorService.clearSubEventResourcePopupRequest();
    });
  }

  ngOnInit(): void {
    this.openSubscription = this.eventEditorService.onOpen$.subscribe(() => {
      this.showEventVisibilityPicker = false;
      this.showSubEventsPopup = false;
    });

    this.closeSubscription = this.eventEditorService.onClose$.subscribe(() => {
      this.showEventVisibilityPicker = false;
      this.showSubEventsPopup = false;
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('app:openSubEvents', this.openSubEventsFromAppHandler);
      window.addEventListener('app:closeSubEvents', this.closeSubEventsFromAppHandler);
    }
  }

  ngOnDestroy(): void {
    this.openSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('app:openSubEvents', this.openSubEventsFromAppHandler);
      window.removeEventListener('app:closeSubEvents', this.closeSubEventsFromAppHandler);
    }
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

  readonly visibilityOptions: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly'];

  close(): void {
    this.showEventVisibilityPicker = false;
    this.showSubEventsPopup = false;
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
    window.dispatchEvent(new CustomEvent('app:openMembers'));
  }

  requestOpenSubEvents(): void {
    this.showEventVisibilityPicker = false;
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
    window.dispatchEvent(new CustomEvent('app:openTopics'));
  }

  requestOpenLocationMap(): void {
    this.showEventVisibilityPicker = false;
    window.dispatchEvent(new CustomEvent('app:openLocationMap'));
  }

  eventEditorHeaderPendingMemberCount(): number {
    const source = this.eventEditorService.sourceEvent();
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

    this.normalizeEventDateRange();

    const payload: EventEditorSavePayload = {
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

    window.dispatchEvent(new CustomEvent<EventEditorSavePayload>('app:saveEventEditor', { detail: payload }));
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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showEventVisibilityPicker = false;
  }

  private populateFormFromSourceEvent(sourceEvent: Record<string, unknown>): void {
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

  private resetForm(): void {
    const start = new Date();
    const end = new Date(start.getTime() + (60 * 60 * 1000));

    this.eventForm = {
      title: '',
      description: '',
      imageUrl: '',
      visibility: 'Public',
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
    return items.map(item => ({ ...item }));
  }

  private firstSubEventByOrder(items: readonly EventEditorSubEventItem[] = this.eventForm.subEvents): EventEditorSubEventItem | null {
    const ordered = this.sortSubEventRefsByStartAsc(items);
    return ordered[0] ?? null;
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

  private subEventName(subEvent: EventEditorSubEventItem): string {
    return `${subEvent.name ?? subEvent.title ?? 'Untitled'}`;
  }
}

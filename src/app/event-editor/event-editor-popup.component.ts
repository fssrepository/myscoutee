import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatOptionModule } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { EventEditorService } from '../shared/event-editor.service';

@Component({
  selector: 'app-event-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatOptionModule
  ],
  templateUrl: './event-editor-popup.component.html',
  styleUrls: ['./event-editor-popup.component.scss']
})
export class EventEditorPopupComponent implements OnInit, OnDestroy {
  protected readonly eventEditorService = inject(EventEditorService);
  
  @ViewChild('eventImageInput') eventImageInput!: ElementRef<HTMLInputElement>;
  
  // Component is now standalone, uses EventEditorService for state management
  // Output events not needed - service handles all communication
  
  private openSubscription?: Subscription;
  private closeSubscription?: Subscription;

  // Subscribe to service for open/close
  constructor() {
    // Watch for sourceEvent changes and update form
    effect(() => {
      const sourceEvent = this.eventEditorService.sourceEvent();
      const isOpen = this.eventEditorService.isOpen();
      
      if (isOpen && sourceEvent) {
        this.populateFormFromSourceEvent(sourceEvent);
      } else if (isOpen && this.eventEditorService.mode() === 'create') {
        this.resetForm();
      }
    });
  }
  
  ngOnInit(): void {
    // Subscribe to service for open/close
    this.openSubscription = this.eventEditorService.onOpen$.subscribe(() => {
      // Form is now initialized via constructor effect
    });
    
    this.closeSubscription = this.eventEditorService.onClose$.subscribe(() => {
      // Popup hides
    });
  }
  
  // Populate form from source event
  private populateFormFromSourceEvent(sourceEvent: any): void {
    this.eventForm = {
      title: sourceEvent.title || '',
      description: sourceEvent.description || sourceEvent.shortDescription || '',
      imageUrl: sourceEvent.imageUrl || sourceEvent.image || sourceEvent.coverImage || '',
      visibility: sourceEvent.visibility || 'Public',
      frequency: sourceEvent.frequency || 'One-time',
      location: sourceEvent.location || '',
      capacityMin: sourceEvent.capacityMin ?? sourceEvent.capacity?.min ?? null,
      capacityMax: sourceEvent.capacityMax ?? sourceEvent.capacity?.max ?? null,
      blindMode: sourceEvent.blindMode || sourceEvent.matchingMode || 'Open',
      autoInviter: sourceEvent.autoInviter || sourceEvent.inviteMode || 'Open',
      ticketing: sourceEvent.ticketing || sourceEvent.ticketType || 'None',
      topics: sourceEvent.topics || [],
      subEvents: sourceEvent.subEvents || sourceEvent.subevents || []
    };
    
    // Parse dates if available
    if (sourceEvent.startAt) {
      const startDate = new Date(sourceEvent.startAt);
      this.eventStartDateValue = startDate.toISOString().split('T')[0];
      this.eventStartTimeValue = startDate.toTimeString().slice(0, 5);
    } else if (sourceEvent.startDate) {
      const startDate = new Date(sourceEvent.startDate);
      this.eventStartDateValue = startDate.toISOString().split('T')[0];
    }
    
    if (sourceEvent.endAt) {
      const endDate = new Date(sourceEvent.endAt);
      this.eventEndDateValue = endDate.toISOString().split('T')[0];
      this.eventEndTimeValue = endDate.toTimeString().slice(0, 5);
    } else if (sourceEvent.endDate) {
      const endDate = new Date(sourceEvent.endDate);
      this.eventEndDateValue = endDate.toISOString().split('T')[0];
    }
    
    // Sub-events display mode
    if (sourceEvent.subEventsDisplayMode) {
      this.subEventsDisplayMode = sourceEvent.subEventsDisplayMode;
    }
  }
  
  // Reset form to default values
  private resetForm(): void {
    this.eventForm = {
      title: '',
      description: '',
      imageUrl: '',
      visibility: 'Public',
      frequency: 'One-time',
      location: '',
      capacityMin: null,
      capacityMax: null,
      blindMode: 'Open',
      autoInviter: 'Open',
      ticketing: 'None',
      topics: [],
      subEvents: []
    };
    this.eventStartDateValue = '';
    this.eventStartTimeValue = '';
    this.eventEndDateValue = '';
    this.eventEndTimeValue = '';
    this.subEventsDisplayMode = 'Casual';
  }

  ngOnDestroy(): void {
    this.openSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
  }
  
  // Form data
  eventForm = {
    title: '',
    description: '',
    imageUrl: '',
    visibility: 'Public',
    frequency: 'One-time',
    location: '',
    capacityMin: null as number | null,
    capacityMax: null as number | null,
    blindMode: 'Open',
    autoInviter: 'Open',
    ticketing: 'None',
    topics: [] as string[],
    subEvents: [] as any[]
  };
  
  // Date/time values
  eventStartDateValue = '';
  eventStartTimeValue = '';
  eventEndDateValue = '';
  eventEndTimeValue = '';
  
  subEventsDisplayMode = 'Casual';
  
  // Visibility picker state
  isVisibilityPickerOpen = false;
  visibilityOptions = ['Public', 'Private', 'Invitation Only'];
  
  // Frequency options
  eventFrequencyOptions = ['One-time', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

  subEventsCountLabel = () => `${this.eventForm.subEvents.length} sub-events`;
  subEventsCurrentHeaderLabel = () => this.eventForm.subEvents[0]?.title || '';

  close(): void {
    this.eventEditorService.close();
    this.isVisibilityPickerOpen = false;
  }
  
  save(): void {
    // Save logic handled by service or local state
    // For now, just close the popup
    this.close();
  }
  
  // Get popup title based on mode
  getPopupTitle(): string {
    const mode = this.eventEditorService.mode();
    const readOnly = this.eventEditorService.readOnly();
    
    if (mode === 'create') {
      return 'Create Event';
    } else if (readOnly) {
      return 'View Event';
    } else {
      return 'Edit Event';
    }
  }
  
  // Visibility methods
  toggleVisibilityPicker(): void {
    this.isVisibilityPickerOpen = !this.isVisibilityPickerOpen;
  }
  
  selectVisibility(option: string): void {
    this.eventForm.visibility = option;
    this.isVisibilityPickerOpen = false;
  }
  
  getVisibilityIcon(visibility: string): string {
    switch (visibility) {
      case 'Public': return 'public';
      case 'Private': return 'lock';
      case 'Invitation Only': return 'mail';
      default: return 'public';
    }
  }
  
  // Request to open members
  requestOpenMembers(): void {
    window.dispatchEvent(new CustomEvent('app:openMembers'));
  }
  
  // Helper methods for UI classes
  eventVisibilityClass(visibility: string): string {
    return `visibility-${visibility.toLowerCase().replace(' ', '-')}`;
  }
  
  eventBlindModeClass(mode: string): string {
    return mode === 'Open' ? 'mode-open' : 'mode-blind';
  }
  
  eventBlindModeIcon(mode: string): string {
    return mode === 'Open' ? 'visibility' : 'visibility_off';
  }
  
  eventBlindModeDescription(mode: string): string {
    return mode === 'Open' ? 'Everyone sees participant names' : 'Names hidden until match';
  }
  
  eventTopicsPanelClass(): string {
    return this.eventForm.topics.length > 0 ? 'has-topics' : '';
  }
  
  eventTopicsPanelIcon(): string {
    return this.eventForm.topics.length > 0 ? 'label' : 'add';
  }
  
  eventAutoInviterClass(mode: string): string {
    return `auto-inviter-${mode.toLowerCase()}`;
  }
  
  eventAutoInviterIcon(mode: string): string {
    return mode === 'Open' ? 'group_add' : 'person_add_disabled';
  }
  
  eventAutoInviterLabel(mode: string): string {
    return mode === 'Open' ? 'Auto-accept' : 'Manual approve';
  }
  
  eventAutoInviterDescription(mode: string): string {
    return mode === 'Open' ? 'Automatically accept join requests' : 'Review each join request';
  }
  
  eventTicketingClass(mode: string): string {
    return `ticketing-${mode.toLowerCase()}`;
  }
  
  eventTicketingIcon(mode: string): string {
    return mode === 'None' ? 'confirmation_number' : 'paid';
  }
  
  eventTicketingLabel(mode: string): string {
    return mode === 'None' ? 'Free' : 'Ticketed';
  }
  
  eventTicketingDescription(mode: string): string {
    return mode === 'None' ? 'No ticket required' : 'Requires ticket purchase';
  }
  
  eventFrequencyClass(frequency: string): string {
    return `frequency-${frequency.toLowerCase()}`;
  }
  
  eventFrequencyIcon(frequency: string): string {
    switch (frequency) {
      case 'One-time': return 'event';
      case 'Daily': return 'today';
      case 'Weekly': return 'date_range';
      case 'Monthly': return 'calendar_month';
      case 'Yearly': return 'calendar_today';
      default: return 'event';
    }
  }
  
  // Placeholder methods
  interestOptionToneClass(topic: string): string {
    return 'tone-default';
  }
  
  eventTopicLabel(topic: string): string {
    return topic;
  }
  
  // Event handlers
  triggerEventImageUpload(event: Event): void {
    event.preventDefault();
    this.eventImageInput?.nativeElement?.click();
  }
  
  onEventImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      this.eventForm.imageUrl = URL.createObjectURL(file);
    }
  }
  
  onEventCapacityMinChange(value: number): void {
    this.eventForm.capacityMin = value;
  }
  
  onEventCapacityMaxChange(value: number): void {
    this.eventForm.capacityMax = value;
  }
  
  toggleEventBlindMode(event: Event): void {
    event.preventDefault();
    this.eventForm.blindMode = this.eventForm.blindMode === 'Open' ? 'Blind' : 'Open';
  }
  
  toggleEventAutoInviter(event: Event): void {
    event.preventDefault();
    this.eventForm.autoInviter = this.eventForm.autoInviter === 'Open' ? 'Closed' : 'Open';
  }
  
  toggleEventTicketing(event: Event): void {
    event.preventDefault();
    this.eventForm.ticketing = this.eventForm.ticketing === 'None' ? 'Required' : 'None';
  }
  
  onEventLocationChange(value: string): void {
    this.eventForm.location = value;
  }
  
  onEventStartDateChange(value: string): void {
    this.eventStartDateValue = value;
  }
  
  onEventStartTimeChange(value: string): void {
    this.eventStartTimeValue = value;
  }
  
  onEventEndDateChange(value: string): void {
    this.eventEndDateValue = value;
  }
  
  onEventEndTimeChange(value: string): void {
    this.eventEndTimeValue = value;
  }
  
  // Request to open inner popups - dispatch custom events to app
  requestOpenSubEvents(): void {
    window.dispatchEvent(new CustomEvent('app:openSubEvents'));
  }
  
  requestOpenTopics(): void {
    window.dispatchEvent(new CustomEvent('app:openTopics'));
  }
  
  requestOpenLocationMap(): void {
    window.dispatchEvent(new CustomEvent('app:openLocationMap'));
  }
}

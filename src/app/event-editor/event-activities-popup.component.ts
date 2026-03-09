import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { Subscription, fromEvent, timer } from 'rxjs';
import { EventEditorService } from '../shared/event-editor.service';
import { APP_DEMO_DATA } from '../shared/demo-data';
import type * as AppTypes from '../shared/app-types';

@Component({
  selector: 'app-event-activities-popup',
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
    MatOptionModule
  ],
  templateUrl: './event-activities-popup.component.html',
  styleUrls: ['./event-activities-popup.component.scss']
})
export class EventActivitiesPopupComponent implements OnInit {
  protected readonly eventEditorService = inject(EventEditorService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  
  // Filter options
  readonly activitiesPrimaryFilters = APP_DEMO_DATA.activitiesPrimaryFilters;
  readonly activitiesSecondaryFilters = APP_DEMO_DATA.activitiesSecondaryFilters;
  readonly activitiesChatContextFilters = APP_DEMO_DATA.activitiesChatContextFilters;
  readonly rateFilters = APP_DEMO_DATA.rateFilters;
  readonly activitiesViewOptions = APP_DEMO_DATA.activitiesViewOptions;
  
  // View refs
  @ViewChild('activitiesScrollRef') activitiesScrollRef: ElementRef<HTMLElement> | null = null;
  
  private scrollListenerUnsubscribe: (() => void) | null = null;
  
  constructor() {}
  
  ngOnInit(): void {
    this.setupScrollListener();
  }
  
  private setupScrollListener(): void {
    this.ngZone.runOutsideAngular(() => {
      const handler = () => {
        const scrollTop = window.scrollY;
        this.ngZone.run(() => this.cdr.markForCheck());
      };
      
      const scrollHandler = () => {
        timer(100).subscribe(() => handler());
      };
      
      window.addEventListener('scroll', scrollHandler, { passive: true });
      this.scrollListenerUnsubscribe = () => window.removeEventListener('scroll', scrollHandler);
    });
  }
  
  // Getters that call the service
  get activitiesPrimaryFilter(): AppTypes.ActivitiesPrimaryFilter {
    return this.eventEditorService.activitiesPrimaryFilter();
  }
  
  get activitiesSecondaryFilter(): AppTypes.ActivitiesSecondaryFilter {
    return this.eventEditorService.activitiesSecondaryFilter();
  }
  
  get activitiesChatContextFilter(): AppTypes.ActivitiesChatContextFilter {
    return this.eventEditorService.activitiesChatContextFilter();
  }
  
  get hostingPublicationFilter(): AppTypes.HostingPublicationFilter {
    return this.eventEditorService.activitiesHostingPublicationFilter();
  }
  
  get activitiesRateFilter(): AppTypes.RateFilterKey {
    return this.eventEditorService.activitiesRateFilter();
  }
  
  get activitiesView(): 'day' | 'week' | 'month' | 'distance' {
    return this.eventEditorService.activitiesView();
  }
  
  get showActivitiesViewPicker(): boolean {
    return this.eventEditorService.activitiesShowViewPicker();
  }
  
  get showActivitiesSecondaryPicker(): boolean {
    return this.eventEditorService.activitiesShowSecondaryPicker();
  }
  
  get activitiesStickyValue(): string {
    return this.eventEditorService.activitiesStickyValue();
  }
  
  get activitiesRatesFullscreenMode(): boolean {
    return this.eventEditorService.activitiesRatesFullscreenMode();
  }
  
  get selectedActivityRateId(): string | null {
    return this.eventEditorService.activitiesSelectedRateId();
  }
  
  get isMobileView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }
  
  // Filter label getters
  get activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters.find(o => o.key === this.activitiesPrimaryFilter)?.label ?? 'Chats';
  }
  
  get activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters.find(o => o.key === this.activitiesPrimaryFilter)?.icon ?? 'chat';
  }
  
  get activitiesSecondaryFilterLabel(): string {
    if (this.activitiesSecondaryFilter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find(o => o.key === this.activitiesSecondaryFilter)?.label ?? 'Relevant';
  }
  
  get activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find(o => o.key === this.activitiesSecondaryFilter)?.icon ?? 'schedule';
  }
  
  get activitiesChatContextFilterLabel(): string {
    return this.activitiesChatContextFilters.find(o => o.key === this.activitiesChatContextFilter)?.label ?? 'All';
  }
  
  get activitiesChatContextFilterIcon(): string {
    return this.activitiesChatContextFilters.find(o => o.key === this.activitiesChatContextFilter)?.icon ?? 'forum';
  }
  
  get activitiesRateFilterLabel(): string {
    const filter = this.rateFilters.find(o => o.key === this.activitiesRateFilter);
    if (!filter) return 'Given';
    const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    return `${group} · ${filter.label}`;
  }
  
  get activityViewLabel(): string {
    return this.activitiesViewOptions.find(o => o.key === this.activitiesView)?.label ?? 'View';
  }
  
  get activitiesHeaderLineOne(): string {
    const primary = this.activitiesPrimaryFilterLabel;
    if (this.activitiesPrimaryFilter === 'chats') {
      const chatFilter = this.activitiesChatContextFilter === 'all' ? '' : ` · ${this.activitiesChatContextFilterLabel}`;
      return `${primary}${chatFilter}`;
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
      const label = this.rateFilters.find(o => o.key === this.activitiesRateFilter)?.label ?? 'Given';
      return `${group} Rate · ${label}`;
    }
    if (this.activitiesView === 'month' || this.activitiesView === 'week') {
      return primary;
    }
    return `${primary} · ${this.activitiesSecondaryFilterLabel}`;
  }
  
  get activitiesHeaderLineTwo(): string {
    if (this.activitiesPrimaryFilter === 'chats') return '';
    if (this.activitiesPrimaryFilter === 'rates') return this.activitiesSecondaryFilterLabel;
    if (this.activitiesView === 'month' || this.activitiesView === 'week') return '';
    return '';
  }
  
  get activitiesStickyHeader(): string {
    if (this.activitiesStickyValue) {
      return this.activitiesStickyValue;
    }
    return this.activitiesView === 'distance' ? '5 km' : 'No items';
  }
  
  get activitiesEmptyLabel(): string {
    if (this.activitiesPrimaryFilter === 'rates') {
      return 'No rate interactions for this filter yet.';
    }
    if (this.activitiesPrimaryFilter === 'hosting' && this.hostingPublicationFilter === 'drafts') {
      return 'No drafts in hosting yet.';
    }
    return `No ${this.activitiesPrimaryFilter} items in this filter.`;
  }
  
  // Computed properties
  get isCalendarLayoutView(): boolean {
    return this.activitiesView === 'month' || this.activitiesView === 'week';
  }
  
  get isRateFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }
  
  get isHostingPublicationFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'hosting';
  }
  
  get shouldShowActivitiesExploreAction(): boolean {
    return this.activitiesPrimaryFilter === 'events';
  }
  
  get shouldShowActivitiesCreateAction(): boolean {
    return this.activitiesPrimaryFilter === 'hosting';
  }
  
  get shouldShowRatesFullscreenToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates' && !this.isCalendarLayoutView;
  }
  
  get isRatesFullscreenModeActive(): boolean {
    return this.shouldShowRatesFullscreenToggle && this.activitiesRatesFullscreenMode;
  }
  
  // Filter classes
  activitiesPrimaryFilterClass(filter?: AppTypes.ActivitiesPrimaryFilter): string {
    const f = filter ?? this.activitiesPrimaryFilter;
    if (f === 'chats') return 'activity-filter-chats';
    if (f === 'rates') return 'activity-filter-rates';
    if (f === 'invitations') return 'activity-filter-invitations';
    if (f === 'events') return 'activity-filter-events';
    if (f === 'hosting') return 'activity-filter-hosting';
    return '';
  }
  
  activitiesSecondaryFilterClass(filter?: AppTypes.ActivitiesSecondaryFilter): string {
    const f = filter ?? this.activitiesSecondaryFilter;
    if (f === 'recent') return 'activity-secondary-recent';
    if (f === 'past') return 'activity-secondary-past';
    return 'activity-secondary-relevant';
  }
  
  activitiesChatContextFilterClass(filter?: AppTypes.ActivitiesChatContextFilter): string {
    const f = filter ?? this.activitiesChatContextFilter;
    if (f === 'event') return 'activity-chat-context-event';
    if (f === 'group') return 'activity-chat-context-group';
    if (f === 'subEvent') return 'activity-chat-context-subevent';
    return 'activity-chat-context-all';
  }
  
  // Actions - call service methods
  onPrimaryFilterClick(filter: AppTypes.ActivitiesPrimaryFilter, event: Event): void {
    event.stopPropagation();
    this.eventEditorService.setActivitiesPrimaryFilter(filter);
    this.cdr.markForCheck();
  }
  
  onSecondaryFilterClick(filter: AppTypes.ActivitiesSecondaryFilter, event: Event): void {
    event.stopPropagation();
    this.eventEditorService.setActivitiesSecondaryFilter(filter);
    this.cdr.markForCheck();
  }
  
  onChatContextFilterClick(filter: AppTypes.ActivitiesChatContextFilter): void {
    this.eventEditorService.setActivitiesChatContextFilter(filter);
    this.cdr.markForCheck();
  }
  
  onHostingPublicationFilterClick(filter: AppTypes.HostingPublicationFilter, event: Event): void {
    event.stopPropagation();
    this.eventEditorService.setActivitiesHostingPublicationFilter(filter);
    this.cdr.markForCheck();
  }
  
  onRateFilterChange(filter: AppTypes.RateFilterKey): void {
    this.eventEditorService.setActivitiesRateFilter(filter);
    this.cdr.markForCheck();
  }
  
  onViewChange(view: 'day' | 'week' | 'month' | 'distance', event: Event): void {
    event.stopPropagation();
    this.eventEditorService.setActivitiesView(view);
    this.cdr.markForCheck();
  }
  
  onCloseClick(): void {
    this.eventEditorService.closeActivities();
  }
  
  onPopupSurfaceClick(event: Event): void {
    event.stopPropagation();
  }
  
  toggleViewPicker(event: Event): void {
    event.stopPropagation();
    this.eventEditorService.toggleActivitiesViewPicker();
    this.cdr.markForCheck();
  }
  
  toggleSecondaryPicker(event: Event): void {
    event.stopPropagation();
    this.eventEditorService.toggleActivitiesSecondaryPicker();
    this.cdr.markForCheck();
  }
  
  onRatesFullscreenClose(event: Event): void {
    event.stopPropagation();
    this.eventEditorService.setActivitiesRatesFullscreenMode(false);
    this.cdr.markForCheck();
  }
}

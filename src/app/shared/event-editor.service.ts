import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import type * as AppTypes from './app-types';

export interface EventEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  sourceEvent?: any;
  readOnly?: boolean;
}

export type EventEditorSubEventResourceType = 'Members' | 'Car' | 'Accommodation' | 'Supplies';

export interface EventEditorSubEventResourcePopupRequest {
  type: EventEditorSubEventResourceType;
  subEvent: any;
  group?: {
    id?: string | null;
    groupLabel?: string;
    pending?: number;
    capacityMin?: number;
    capacityMax?: number;
  } | null;
}

export type ActivitiesNavigationRequest =
  | { type: 'eventExplore' }
  | { type: 'chat'; item: unknown }
  | { type: 'members'; row: AppTypes.ActivityListRow }
  | { type: 'eventEditorCreate'; target: AppTypes.EventEditorTarget }
  | { type: 'eventEditor'; row: AppTypes.ActivityListRow; readOnly: boolean };

export interface ActivitiesEventSyncPayload {
  id: string;
  target: AppTypes.EventEditorTarget;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  isAdmin: boolean;
  startAt: string;
  distanceKm: number;
  imageUrl: string;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  syncKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class EventEditorService {
  // Signal to track the open/close state
  private _isOpen = signal(false);
  
  // Signal for the editor mode
  private _mode = signal<'create' | 'edit'>('create');
  
  // Signal for the source event (used for view/edit)
  private _sourceEvent = signal<any>(null);
  
  // Signal for read-only mode (used for view)
  private _readOnly = signal(false);
  private _subEventResourcePopupRequest = signal<EventEditorSubEventResourcePopupRequest | null>(null);
  
  // ===== Activities State =====
  private _activitiesOpen = signal(false);
  private _activitiesPrimaryFilter = signal<AppTypes.ActivitiesPrimaryFilter>('chats');
  private _activitiesSecondaryFilter = signal<AppTypes.ActivitiesSecondaryFilter>('recent');
  private _activitiesChatContextFilter = signal<AppTypes.ActivitiesChatContextFilter>('all');
  private _activitiesHostingPublicationFilter = signal<AppTypes.HostingPublicationFilter>('all');
  private _activitiesRateFilter = signal<AppTypes.RateFilterKey>('pair-received');
  private _activitiesView = signal<'day' | 'week' | 'month' | 'distance'>('day');
  private _activitiesShowViewPicker = signal(false);
  private _activitiesShowSecondaryPicker = signal(false);
  private _activitiesStickyValue = signal('');
  private _activitiesRatesFullscreenMode = signal(false);
  private _activitiesSelectedRateId = signal<string | null>(null);
  private _activitiesNavigationRequest = signal<ActivitiesNavigationRequest | null>(null);
  private _activitiesEventSync = signal<ActivitiesEventSyncPayload | null>(null);
  
  // Public readonly signals
  readonly isOpen = this._isOpen.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly sourceEvent = this._sourceEvent.asReadonly();
  readonly readOnly = this._readOnly.asReadonly();
  readonly subEventResourcePopupRequest = this._subEventResourcePopupRequest.asReadonly();
  
  // Activities public signals
  readonly activitiesOpen = this._activitiesOpen.asReadonly();
  readonly activitiesPrimaryFilter = this._activitiesPrimaryFilter.asReadonly();
  readonly activitiesSecondaryFilter = this._activitiesSecondaryFilter.asReadonly();
  readonly activitiesChatContextFilter = this._activitiesChatContextFilter.asReadonly();
  readonly activitiesHostingPublicationFilter = this._activitiesHostingPublicationFilter.asReadonly();
  readonly activitiesRateFilter = this._activitiesRateFilter.asReadonly();
  readonly activitiesView = this._activitiesView.asReadonly();
  readonly activitiesShowViewPicker = this._activitiesShowViewPicker.asReadonly();
  readonly activitiesShowSecondaryPicker = this._activitiesShowSecondaryPicker.asReadonly();
  readonly activitiesStickyValue = this._activitiesStickyValue.asReadonly();
  readonly activitiesRatesFullscreenMode = this._activitiesRatesFullscreenMode.asReadonly();
  readonly activitiesSelectedRateId = this._activitiesSelectedRateId.asReadonly();
  readonly activitiesNavigationRequest = this._activitiesNavigationRequest.asReadonly();
  readonly activitiesEventSync = this._activitiesEventSync.asReadonly();
  
  // Computed values
  readonly isOpenBoolean = computed(() => this._isOpen());
  readonly activitiesOpenBoolean = computed(() => this._activitiesOpen());
  
  // Subjects for open/close events
  private _onOpen = new Subject<void>();
  private _onClose = new Subject<void>();
  
  // Observables for open/close events
  readonly onOpen$ = this._onOpen.asObservable();
  readonly onClose$ = this._onClose.asObservable();

  constructor() {}

  /**
   * Open the event editor
   */
  open(mode: 'create' | 'edit' = 'create', sourceEvent?: any, readOnly?: boolean): void {
    this._mode.set(mode);
    this._sourceEvent.set(sourceEvent || null);
    this._readOnly.set(readOnly || false);
    this._isOpen.set(true);
    this._onOpen.next();
  }

  openView(sourceEvent: any): void {
    this.open('edit', sourceEvent, true);
  }

  openEdit(sourceEvent: any): void {
    this.open('edit', sourceEvent, false);
  }

  openCreate(): void {
    this.open('create');
  }

  close(): void {
    this._isOpen.set(false);
    this._sourceEvent.set(null);
    this._readOnly.set(false);
    this._subEventResourcePopupRequest.set(null);
    this._onClose.next();
  }

  toggle(mode: 'create' | 'edit' = 'create', sourceEvent?: any, readOnly?: boolean): void {
    if (this._isOpen()) {
      this.close();
    } else {
      this.open(mode, sourceEvent, readOnly);
    }
  }

  get isCurrentlyOpen(): boolean {
    return this._isOpen();
  }

  get currentMode(): 'create' | 'edit' {
    return this._mode();
  }

  get currentSourceEvent(): any {
    return this._sourceEvent();
  }

  get isReadOnly(): boolean {
    return this._readOnly();
  }

  requestSubEventResourcePopup(request: EventEditorSubEventResourcePopupRequest): void {
    this._subEventResourcePopupRequest.set(request);
  }

  clearSubEventResourcePopupRequest(): void {
    this._subEventResourcePopupRequest.set(null);
  }

  // ===== Activities Methods =====

  /**
   * Open the activities popup
   */
  openActivities(primaryFilter: AppTypes.ActivitiesPrimaryFilter = 'chats'): void {
    this._activitiesOpen.set(true);
    this._activitiesPrimaryFilter.set(primaryFilter);
    this._activitiesSecondaryFilter.set('recent');
    this._activitiesHostingPublicationFilter.set('all');
    this._activitiesShowViewPicker.set(false);
    this._activitiesShowSecondaryPicker.set(false);
    this._activitiesView.set('day');
    this._activitiesStickyValue.set('');
    this._activitiesRatesFullscreenMode.set(false);
    this._activitiesSelectedRateId.set(null);
    if (primaryFilter === 'rates') {
      this._activitiesRateFilter.set('individual-given');
      this._activitiesView.set('distance');
    }
  }

  /**
   * Close the activities popup
   */
  closeActivities(): void {
    this._activitiesOpen.set(false);
  }

  /**
   * Check if activities popup is open
   */
  get isActivitiesOpen(): boolean {
    return this._activitiesOpen();
  }

  /**
   * Set primary filter
   */
  setActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    this._activitiesPrimaryFilter.set(filter);
    this._activitiesHostingPublicationFilter.set('all');
    this._activitiesShowViewPicker.set(false);
    this._activitiesShowSecondaryPicker.set(false);
    this._activitiesChatContextFilter.set('all');
    if (filter !== 'rates') {
      this._activitiesRatesFullscreenMode.set(false);
    }
    if (filter === 'rates') {
      this._activitiesRateFilter.set('individual-given');
      this._activitiesView.set('distance');
      this._activitiesSelectedRateId.set(null);
    } else if (filter === 'chats') {
      this._activitiesView.set('day');
      this._activitiesSelectedRateId.set(null);
    } else {
      this._activitiesSelectedRateId.set(null);
    }
  }

  /**
   * Set secondary filter
   */
  setActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    this._activitiesSecondaryFilter.set(filter);
    this._activitiesShowSecondaryPicker.set(false);
  }

  /**
   * Set chat context filter
   */
  setActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    this._activitiesChatContextFilter.set(filter);
  }

  /**
   * Set hosting publication filter
   */
  setActivitiesHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    this._activitiesHostingPublicationFilter.set(filter);
  }

  /**
   * Set rate filter
   */
  setActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this._activitiesRateFilter.set(filter);
  }

  /**
   * Set view
   */
  setActivitiesView(view: 'day' | 'week' | 'month' | 'distance'): void {
    this._activitiesView.set(view);
    if (view !== 'distance') {
      this._activitiesStickyValue.set('');
    }
  }

  /**
   * Toggle view picker
   */
  toggleActivitiesViewPicker(): void {
    this._activitiesShowViewPicker.set(!this._activitiesShowViewPicker());
    this._activitiesShowSecondaryPicker.set(false);
  }

  /**
   * Toggle secondary picker
   */
  toggleActivitiesSecondaryPicker(): void {
    this._activitiesShowSecondaryPicker.set(!this._activitiesShowSecondaryPicker());
    this._activitiesShowViewPicker.set(false);
  }

  /**
   * Set sticky value
   */
  setActivitiesStickyValue(value: string): void {
    this._activitiesStickyValue.set(value);
  }

  /**
   * Set rates fullscreen mode
   */
  setActivitiesRatesFullscreenMode(enabled: boolean): void {
    this._activitiesRatesFullscreenMode.set(enabled);
    if (!enabled) {
      this._activitiesSelectedRateId.set(null);
    }
  }

  /**
   * Set selected rate id
   */
  setActivitiesSelectedRateId(rateId: string | null): void {
    this._activitiesSelectedRateId.set(rateId);
  }

  requestActivitiesNavigation(request: ActivitiesNavigationRequest): void {
    this._activitiesNavigationRequest.set(request);
  }

  clearActivitiesNavigationRequest(): void {
    this._activitiesNavigationRequest.set(null);
  }

  emitActivitiesEventSync(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): void {
    this._activitiesEventSync.set({
      ...payload,
      syncKey: `${payload.id}:${Date.now()}`
    });
  }

  clearActivitiesEventSync(): void {
    this._activitiesEventSync.set(null);
  }
}

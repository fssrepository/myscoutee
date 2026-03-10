import { computed, Injectable, inject, signal } from '@angular/core';

import type * as AppTypes from './app-types';
import { ACTIVITIES_DATA_SOURCE } from './activities-data-source';
import type {
  ActivitiesEventSyncPayload,
  ActivitiesNavigationRequest,
  ActivitiesPageRequest,
  ActivitiesPageResult,
  EventChatContext,
  EventChatSession
} from './activities-models';
import type { ChatMenuItem } from './demo-data';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesDbContextService {
  private readonly dataSource = inject(ACTIVITIES_DATA_SOURCE);

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
  private _eventChatSession = signal<EventChatSession | null>(null);

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
  readonly eventChatSession = this._eventChatSession.asReadonly();

  readonly activitiesOpenBoolean = computed(() => this._activitiesOpen());
  readonly eventChatOpen = computed(() => this._eventChatSession() !== null);

  readonly dataMode = this.dataSource.mode;

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

  closeActivities(): void {
    this._activitiesOpen.set(false);
    this._eventChatSession.set(null);
  }

  get isActivitiesOpen(): boolean {
    return this._activitiesOpen();
  }

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

  setActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    this._activitiesSecondaryFilter.set(filter);
    this._activitiesShowSecondaryPicker.set(false);
  }

  setActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    this._activitiesChatContextFilter.set(filter);
  }

  setActivitiesHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    this._activitiesHostingPublicationFilter.set(filter);
  }

  setActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this._activitiesRateFilter.set(filter);
  }

  setActivitiesView(view: 'day' | 'week' | 'month' | 'distance'): void {
    this._activitiesView.set(view);
    if (view !== 'distance') {
      this._activitiesStickyValue.set('');
    }
  }

  toggleActivitiesViewPicker(): void {
    this._activitiesShowViewPicker.set(!this._activitiesShowViewPicker());
    this._activitiesShowSecondaryPicker.set(false);
  }

  toggleActivitiesSecondaryPicker(): void {
    this._activitiesShowSecondaryPicker.set(!this._activitiesShowSecondaryPicker());
    this._activitiesShowViewPicker.set(false);
  }

  setActivitiesStickyValue(value: string): void {
    this._activitiesStickyValue.set(value);
  }

  setActivitiesRatesFullscreenMode(enabled: boolean): void {
    this._activitiesRatesFullscreenMode.set(enabled);
    if (!enabled) {
      this._activitiesSelectedRateId.set(null);
    }
  }

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
    const event = {
      ...payload,
      syncKey: `${payload.id}:${Date.now()}`
    };
    this._activitiesEventSync.set(event);
    void this.dataSource.syncEvent(payload).catch(() => {
      // UI remains in optimistic state; failures are surfaced by higher-level UX.
    });
  }

  clearActivitiesEventSync(): void {
    this._activitiesEventSync.set(null);
  }

  openEventChat(item: ChatMenuItem, context: EventChatContext | null = null): void {
    this._eventChatSession.set({
      item,
      openedAtIso: new Date().toISOString(),
      context
    });
  }

  closeEventChat(): void {
    this._eventChatSession.set(null);
  }

  touchEventChatSession(contextUpdater?: (context: EventChatContext) => EventChatContext): void {
    const session = this._eventChatSession();
    if (!session) {
      return;
    }
    const clonedContext = session.context
      ? {
          ...session.context,
          resources: session.context.resources.map(resource => ({ ...resource }))
        }
      : null;
    this._eventChatSession.set({
      ...session,
      context: clonedContext && contextUpdater
        ? contextUpdater(clonedContext)
        : clonedContext
    });
  }

  async loadEventChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    return this.dataSource.loadChatMessages(chat);
  }

  async loadActivitiesPage(request: ActivitiesPageRequest): Promise<ActivitiesPageResult | null> {
    return this.dataSource.loadActivitiesPage(request);
  }
}

import { computed, Injectable, inject, signal } from '@angular/core';

import type * as AppTypes from '../../shared/app-types';
import { ACTIVITIES_DATA_SOURCE } from '../../shared/activities-data-source';
import { ActivityMembersService, EventsService } from '../../shared/core';
import type {
  ActivitiesEventSyncPayload,
  ActivitiesNavigationRequest,
  EventChatContext,
  EventChatSession
} from '../../shared/activities-models';
import type { ChatMenuItem } from '../../shared/demo-data';

interface ActivitiesUiState {
  open: boolean;
  primaryFilter: AppTypes.ActivitiesPrimaryFilter;
  eventScope: AppTypes.ActivitiesEventScope;
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  chatContextFilter: AppTypes.ActivitiesChatContextFilter;
  hostingPublicationFilter: AppTypes.HostingPublicationFilter;
  rateFilter: AppTypes.RateFilterKey;
  view: AppTypes.ActivitiesView;
  showViewPicker: boolean;
  showSecondaryPicker: boolean;
  stickyValue: string;
  ratesFullscreenMode: boolean;
  selectedRateId: string | null;
}

const DEFAULT_ACTIVITIES_UI_STATE: ActivitiesUiState = {
  open: false,
  primaryFilter: 'chats',
  eventScope: 'active-events',
  secondaryFilter: 'recent',
  chatContextFilter: 'all',
  hostingPublicationFilter: 'all',
  rateFilter: 'individual-given',
  view: 'day',
  showViewPicker: false,
  showSecondaryPicker: false,
  stickyValue: '',
  ratesFullscreenMode: false,
  selectedRateId: null
};

@Injectable({
  providedIn: 'root'
})
export class ActivitiesDbContextService {
  private readonly dataSource = inject(ACTIVITIES_DATA_SOURCE);
  private readonly eventsService = inject(EventsService);
  private readonly activityMembersService = inject(ActivityMembersService);

  private readonly _uiState = signal<ActivitiesUiState>(DEFAULT_ACTIVITIES_UI_STATE);
  private _activitiesNavigationRequest = signal<ActivitiesNavigationRequest | null>(null);
  private _activitiesEventSync = signal<ActivitiesEventSyncPayload | null>(null);
  private _eventChatSession = signal<EventChatSession | null>(null);

  readonly activitiesUiState = this._uiState.asReadonly();
  readonly activitiesOpen = computed(() => this._uiState().open);
  readonly activitiesPrimaryFilter = computed(() => this._uiState().primaryFilter);
  readonly activitiesEventScope = computed(() => this._uiState().eventScope);
  readonly activitiesSecondaryFilter = computed(() => this._uiState().secondaryFilter);
  readonly activitiesChatContextFilter = computed(() => this._uiState().chatContextFilter);
  readonly activitiesHostingPublicationFilter = computed(() => this._uiState().hostingPublicationFilter);
  readonly activitiesRateFilter = computed(() => this._uiState().rateFilter);
  readonly activitiesView = computed(() => this._uiState().view);
  readonly activitiesShowViewPicker = computed(() => this._uiState().showViewPicker);
  readonly activitiesShowSecondaryPicker = computed(() => this._uiState().showSecondaryPicker);
  readonly activitiesStickyValue = computed(() => this._uiState().stickyValue);
  readonly activitiesRatesFullscreenMode = computed(() => this._uiState().ratesFullscreenMode);
  readonly activitiesSelectedRateId = computed(() => this._uiState().selectedRateId);
  readonly activitiesNavigationRequest = this._activitiesNavigationRequest.asReadonly();
  readonly activitiesEventSync = this._activitiesEventSync.asReadonly();
  readonly eventChatSession = this._eventChatSession.asReadonly();

  readonly activitiesOpenBoolean = computed(() => this._uiState().open);
  readonly eventChatOpen = computed(() => this._eventChatSession() !== null);

  readonly dataMode = this.dataSource.mode;

  openActivities(
    primaryFilter: AppTypes.ActivitiesPrimaryFilter = 'chats',
    eventScope?: AppTypes.ActivitiesEventScope,
    initialRateFilter?: AppTypes.RateFilterKey
  ): void {
    const normalizedPrimaryFilter = this.normalizeActivitiesPrimaryFilter(primaryFilter);
    const resolvedScope = this.resolveActivitiesEventScope(primaryFilter, eventScope);
    const resolvedRateFilter = initialRateFilter ?? 'individual-given';
    this._uiState.update(state => ({
      ...state,
      open: true,
      primaryFilter: normalizedPrimaryFilter,
      eventScope: resolvedScope,
      secondaryFilter: 'recent',
      hostingPublicationFilter: resolvedScope === 'drafts' ? 'drafts' : 'all',
      showViewPicker: false,
      showSecondaryPicker: false,
      view: normalizedPrimaryFilter === 'rates' ? 'distance' : 'day',
      stickyValue: '',
      ratesFullscreenMode: false,
      selectedRateId: null,
      ...(normalizedPrimaryFilter === 'rates' ? { rateFilter: resolvedRateFilter } : {})
    }));
  }

  closeActivities(): void {
    this.patchUiState({ open: false });
    this._eventChatSession.set(null);
  }

  get isActivitiesOpen(): boolean {
    return this._uiState().open;
  }

  setActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    const normalizedFilter = this.normalizeActivitiesPrimaryFilter(filter);
    this._uiState.update(state => ({
      ...state,
      primaryFilter: normalizedFilter,
      eventScope: normalizedFilter === 'events' ? 'active-events' : state.eventScope,
      hostingPublicationFilter: 'all',
      showViewPicker: false,
      showSecondaryPicker: false,
      chatContextFilter: 'all',
      ratesFullscreenMode: normalizedFilter !== 'rates' ? false : state.ratesFullscreenMode,
      rateFilter: normalizedFilter === 'rates' ? 'individual-given' : state.rateFilter,
      view: normalizedFilter === 'rates'
        ? 'distance'
        : normalizedFilter === 'chats'
          ? 'day'
          : state.view,
      selectedRateId: null
    }));
  }

  setActivitiesEventScope(scope: AppTypes.ActivitiesEventScope): void {
    this.patchUiState({
      eventScope: scope,
      hostingPublicationFilter: scope === 'drafts' ? 'drafts' : 'all'
    });
  }

  setActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    this.patchUiState({
      secondaryFilter: filter,
      showSecondaryPicker: false
    });
  }

  setActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    this.patchUiState({ chatContextFilter: filter });
  }

  setActivitiesHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    this.patchUiState({ hostingPublicationFilter: filter });
  }

  setActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this.patchUiState({ rateFilter: filter });
  }

  setActivitiesView(view: AppTypes.ActivitiesView): void {
    this.patchUiState({
      view,
      showViewPicker: false,
      ...(view !== 'distance' ? { stickyValue: '' } : {})
    });
  }

  toggleActivitiesViewPicker(): void {
    this._uiState.update(state => ({
      ...state,
      showViewPicker: !state.showViewPicker,
      showSecondaryPicker: false
    }));
  }

  toggleActivitiesSecondaryPicker(): void {
    this._uiState.update(state => ({
      ...state,
      showSecondaryPicker: !state.showSecondaryPicker,
      showViewPicker: false
    }));
  }

  setActivitiesStickyValue(value: string): void {
    this.patchUiState({ stickyValue: value });
  }

  setActivitiesRatesFullscreenMode(enabled: boolean): void {
    this.patchUiState({
      ratesFullscreenMode: enabled,
      ...(enabled ? {} : { selectedRateId: null })
    });
  }

  setActivitiesSelectedRateId(rateId: string | null): void {
    this.patchUiState({ selectedRateId: rateId });
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
    void this.eventsService.syncEventSnapshot(payload).catch(() => {
      // Demo persistence is best-effort; UI state stays optimistic.
    });
    void this.activityMembersService.syncEventMembersFromEventSnapshot(payload).catch(() => {
      // Demo persistence is best-effort; UI state stays optimistic.
    });
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

  private patchUiState(patch: Partial<ActivitiesUiState>): void {
    this._uiState.update(state => ({
      ...state,
      ...patch
    }));
  }

  private normalizeActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): AppTypes.ActivitiesPrimaryFilter {
    if (filter === 'hosting' || filter === 'invitations') {
      return 'events';
    }
    return filter;
  }

  private resolveActivitiesEventScope(
    primaryFilter: AppTypes.ActivitiesPrimaryFilter,
    explicitScope?: AppTypes.ActivitiesEventScope
  ): AppTypes.ActivitiesEventScope {
    if (explicitScope) {
      return explicitScope;
    }
    if (primaryFilter === 'invitations') {
      return 'invitations';
    }
    if (primaryFilter === 'hosting') {
      return 'my-events';
    }
    return 'active-events';
  }

}

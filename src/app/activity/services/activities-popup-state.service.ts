import { computed, Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import type * as AppTypes from '../../shared/core/base/models';
import { ActivityMembersService, ChatsService, EventsService } from '../../shared/core';
import type {
  ActivitiesEventSyncPayload,
  EventChatContext,
  EventChatSession
} from '../../shared/core/base/models';
import type { ChatMenuItem } from '../../shared/core/base/interfaces/activity-feed.interface';

interface ActivitiesUiState {
  open: boolean;
  primaryFilter: AppTypes.ActivitiesPrimaryFilter;
  eventScope: AppTypes.ActivitiesEventScope;
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  chatContextFilter: AppTypes.ActivitiesChatContextFilter;
  hostingPublicationFilter: AppTypes.HostingPublicationFilter;
  rateFilter: AppTypes.RateFilterKey;
  rateSocialBadgeEnabled: boolean;
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
  rateSocialBadgeEnabled: false,
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
export class ActivitiesPopupStateService {
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);
  private readonly activityMembersService = inject(ActivityMembersService);

  private readonly _uiState = signal<ActivitiesUiState>(DEFAULT_ACTIVITIES_UI_STATE);
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
  readonly activitiesRateSocialBadgeEnabled = computed(() => this._uiState().rateSocialBadgeEnabled);
  readonly activitiesView = computed(() => this._uiState().view);
  readonly activitiesShowViewPicker = computed(() => this._uiState().showViewPicker);
  readonly activitiesShowSecondaryPicker = computed(() => this._uiState().showSecondaryPicker);
  readonly activitiesStickyValue = computed(() => this._uiState().stickyValue);
  readonly activitiesRatesFullscreenMode = computed(() => this._uiState().ratesFullscreenMode);
  readonly activitiesSelectedRateId = computed(() => this._uiState().selectedRateId);
  readonly activitiesEventSync = this._activitiesEventSync.asReadonly();
  readonly eventChatSession = this._eventChatSession.asReadonly();

  readonly activitiesOpenBoolean = computed(() => this._uiState().open);
  readonly eventChatOpen = computed(() => this._eventChatSession() !== null);

  readonly dataMode = environment.activitiesDataSource === 'demo'
    ? 'demo'
    : 'http';

  openActivities(
    primaryFilter: AppTypes.ActivitiesPrimaryFilter = 'chats',
    eventScope?: AppTypes.ActivitiesEventScope,
    initialRateFilter?: AppTypes.RateFilterKey,
    initialRateSocialBadgeEnabled = false
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
      ...(normalizedPrimaryFilter === 'rates'
        ? {
            rateFilter: resolvedRateFilter,
            rateSocialBadgeEnabled: initialRateSocialBadgeEnabled
          }
        : { rateSocialBadgeEnabled: false })
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
      rateSocialBadgeEnabled: normalizedFilter === 'rates' ? state.rateSocialBadgeEnabled : false,
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

  setActivitiesRateSocialBadgeEnabled(enabled: boolean): void {
    this.patchUiState({ rateSocialBadgeEnabled: enabled });
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

  emitActivitiesEventSync(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    this._activitiesEventSync.set({ ...payload });
    return this.runDeferredEventPersistence(payload);
  }

  private runDeferredEventPersistence(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    const persist = async () => {
      await Promise.all([
        this.eventsService.syncEventSnapshot(payload).catch(() => {
        // Demo persistence is best-effort; UI state stays optimistic.
        }),
        this.activityMembersService.syncEventMembersFromEventSnapshot(payload).catch(() => {
        // Demo persistence is best-effort; UI state stays optimistic.
        })
      ]);
    };

    return new Promise(resolve => {
      const run = () => {
        void persist().finally(resolve);
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          setTimeout(run, 0);
        });
        return;
      }
      setTimeout(run, 0);
    });
  }

  clearActivitiesEventSync(): void {
    this._activitiesEventSync.set(null);
  }

  openEventChat(item: ChatMenuItem, context: EventChatContext | null = null): void {
    this._eventChatSession.set({
      item: this.cloneChatMenuItem(item),
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
      item: this.cloneChatMenuItem(session.item),
      context: clonedContext && contextUpdater
        ? contextUpdater(clonedContext)
        : clonedContext
    });
  }

  patchEventChatSessionItem(itemUpdater: (item: ChatMenuItem) => ChatMenuItem): void {
    const session = this._eventChatSession();
    if (!session) {
      return;
    }
    this._eventChatSession.set({
      ...session,
      item: this.cloneChatMenuItem(itemUpdater(this.cloneChatMenuItem(session.item)))
    });
  }

  async loadEventChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    return this.chatsService.loadChatMessages(chat);
  }

  async sendEventChatMessage(chat: ChatMenuItem, text: string, clientId?: string): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessage(chat, text, clientId);
  }

  async watchEventChatMessages(
    chat: ChatMenuItem,
    onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatMessages(chat, onMessage);
  }

  async watchEventChatEvents(
    chat: ChatMenuItem,
    onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatEvents(chat, onEvent);
  }

  async sendEventChatTyping(chat: ChatMenuItem, typing: boolean): Promise<void> {
    return this.chatsService.sendChatTyping(chat, typing);
  }

  async markEventChatRead(chat: ChatMenuItem, messageIds: readonly string[]): Promise<void> {
    return this.chatsService.markChatRead(chat, messageIds);
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

  private cloneChatMenuItem(item: ChatMenuItem): ChatMenuItem {
    return {
      ...item,
      memberIds: [...(item.memberIds ?? [])]
    };
  }

}

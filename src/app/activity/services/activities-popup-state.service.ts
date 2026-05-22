import { computed, Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import type * as AppTypes from '../../shared/core/base/models';
import { ChatsService, EventsService } from '../../shared/core';
import type {
  ActivitiesEventSyncPayload,
  EventChatSession
} from '../../shared/core/base/models';
import type { ActivitiesEventDisplaySync } from '../../shared/core/base/services/activities.service';
import type { ChatRecord } from '../../shared/core/base/models/chat.model';

interface ActivitiesUiState {
  open: boolean;
  openRevision: number;
  primaryFilter: AppTypes.ActivitiesPrimaryFilter;
  eventScope: AppTypes.ActivitiesEventScope;
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter;
  chatContextFilter: AppTypes.ActivitiesChatContextFilter;
  supportCaseFilter: AppTypes.SupportCaseFilter;
  hostingPublicationFilter: AppTypes.HostingPublicationFilter;
  rateFilter: AppTypes.RateFilterKey;
  rateSocialBadgeEnabled: boolean;
  rateIndividualSocialBadgeEnabled: boolean;
  ratePairSocialBadgeEnabled: boolean;
  view: AppTypes.ActivitiesView;
  showViewPicker: boolean;
  showSecondaryPicker: boolean;
  stickyValue: string;
  ratesFullscreenMode: boolean;
  selectedRateId: string | null;
  adminServiceOnly: boolean;
}

const DEFAULT_ACTIVITIES_UI_STATE: ActivitiesUiState = {
  open: false,
  openRevision: 0,
  primaryFilter: 'chats',
  eventScope: 'active-events',
  secondaryFilter: 'recent',
  chatContextFilter: 'all',
  supportCaseFilter: 'all',
  hostingPublicationFilter: 'all',
  rateFilter: 'individual-given',
  rateSocialBadgeEnabled: false,
  rateIndividualSocialBadgeEnabled: false,
  ratePairSocialBadgeEnabled: false,
  view: 'day',
  showViewPicker: false,
  showSecondaryPicker: false,
  stickyValue: '',
  ratesFullscreenMode: false,
  selectedRateId: null,
  adminServiceOnly: false
};

@Injectable({
  providedIn: 'root'
})
export class ActivitiesPopupStateService {
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);

  private readonly _uiState = signal<ActivitiesUiState>(DEFAULT_ACTIVITIES_UI_STATE);
  private _activitiesEventSync = signal<ActivitiesEventSyncPayload | ActivitiesEventDisplaySync | null>(null);
  private _eventChatSession = signal<EventChatSession | null>(null);

  readonly activitiesUiState = this._uiState.asReadonly();
  readonly activitiesOpen = computed(() => this._uiState().open);
  readonly activitiesOpenRevision = computed(() => this._uiState().openRevision);
  readonly activitiesPrimaryFilter = computed(() => this._uiState().primaryFilter);
  readonly activitiesEventScope = computed(() => this._uiState().eventScope);
  readonly activitiesSecondaryFilter = computed(() => this._uiState().secondaryFilter);
  readonly activitiesChatContextFilter = computed(() => this._uiState().chatContextFilter);
  readonly activitiesSupportCaseFilter = computed(() => this._uiState().supportCaseFilter);
  readonly activitiesHostingPublicationFilter = computed(() => this._uiState().hostingPublicationFilter);
  readonly activitiesRateFilter = computed(() => this._uiState().rateFilter);
  readonly activitiesRateSocialBadgeEnabled = computed(() => this.resolveRateSocialBadgeEnabled(this._uiState()));
  readonly activitiesIndividualRateSocialBadgeEnabled = computed(() => this._uiState().rateIndividualSocialBadgeEnabled);
  readonly activitiesPairRateSocialBadgeEnabled = computed(() => this._uiState().ratePairSocialBadgeEnabled);
  readonly activitiesView = computed(() => this._uiState().view);
  readonly activitiesShowViewPicker = computed(() => this._uiState().showViewPicker);
  readonly activitiesShowSecondaryPicker = computed(() => this._uiState().showSecondaryPicker);
  readonly activitiesStickyValue = computed(() => this._uiState().stickyValue);
  readonly activitiesRatesFullscreenMode = computed(() => this._uiState().ratesFullscreenMode);
  readonly activitiesSelectedRateId = computed(() => this._uiState().selectedRateId);
  readonly activitiesAdminServiceOnly = computed(() => this._uiState().adminServiceOnly);
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
    initialRateSocialBadgeEnabled = false,
    options: { adminServiceOnly?: boolean } = {}
  ): void {
    const adminServiceOnly = options.adminServiceOnly === true;
    const normalizedPrimaryFilter = adminServiceOnly
      ? 'chats'
      : this.normalizeActivitiesPrimaryFilter(primaryFilter);
    const resolvedScope = this.resolveActivitiesEventScope(primaryFilter, eventScope);
    const resolvedRateFilter = initialRateFilter ?? 'individual-given';
    this._uiState.update(state => ({
      ...state,
      open: true,
      openRevision: state.openRevision + 1,
      primaryFilter: normalizedPrimaryFilter,
      eventScope: resolvedScope,
      secondaryFilter: 'recent',
      hostingPublicationFilter: resolvedScope === 'drafts' ? 'drafts' : 'all',
      chatContextFilter: adminServiceOnly ? 'service' : 'all',
      supportCaseFilter: 'all',
      showViewPicker: false,
      showSecondaryPicker: false,
      view: normalizedPrimaryFilter === 'rates' ? 'distance' : 'day',
      stickyValue: '',
      ratesFullscreenMode: false,
      selectedRateId: null,
      adminServiceOnly,
      ...(normalizedPrimaryFilter === 'rates'
        ? {
            rateFilter: resolvedRateFilter,
            rateSocialBadgeEnabled: initialRateSocialBadgeEnabled,
            rateIndividualSocialBadgeEnabled: resolvedRateFilter.startsWith('individual')
              ? initialRateSocialBadgeEnabled
              : false,
            ratePairSocialBadgeEnabled: resolvedRateFilter.startsWith('pair')
              ? initialRateSocialBadgeEnabled
              : false
          }
        : {
            rateSocialBadgeEnabled: false,
            rateIndividualSocialBadgeEnabled: false,
            ratePairSocialBadgeEnabled: false
          })
    }));
  }

  closeActivities(): void {
    this.patchUiState({ open: false, adminServiceOnly: false, supportCaseFilter: 'all' });
    this._eventChatSession.set(null);
  }

  get isActivitiesOpen(): boolean {
    return this._uiState().open;
  }

  setActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    if (this._uiState().adminServiceOnly) {
      this.patchUiState({
        primaryFilter: 'chats',
        chatContextFilter: 'service',
        supportCaseFilter: 'all',
        showViewPicker: false,
        showSecondaryPicker: false
      });
      return;
    }
    const normalizedFilter = this.normalizeActivitiesPrimaryFilter(filter);
    this._uiState.update(state => ({
      ...state,
      primaryFilter: normalizedFilter,
      eventScope: normalizedFilter === 'events' ? 'active-events' : state.eventScope,
      hostingPublicationFilter: 'all',
      showViewPicker: false,
      showSecondaryPicker: false,
      chatContextFilter: 'all',
      supportCaseFilter: 'all',
      ratesFullscreenMode: normalizedFilter !== 'rates' ? false : state.ratesFullscreenMode,
      rateFilter: normalizedFilter === 'rates' ? 'individual-given' : state.rateFilter,
      rateSocialBadgeEnabled: normalizedFilter === 'rates' ? this.resolveRateSocialBadgeEnabled(state) : false,
      rateIndividualSocialBadgeEnabled: normalizedFilter === 'rates' ? state.rateIndividualSocialBadgeEnabled : false,
      ratePairSocialBadgeEnabled: normalizedFilter === 'rates' ? state.ratePairSocialBadgeEnabled : false,
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
    this.patchUiState({ chatContextFilter: this._uiState().adminServiceOnly ? 'service' : filter });
  }

  setActivitiesSupportCaseFilter(filter: AppTypes.SupportCaseFilter): void {
    const normalized = filter === 'pending' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
      ? filter
      : 'all';
    this.patchUiState({
      supportCaseFilter: normalized,
      chatContextFilter: this._uiState().adminServiceOnly ? 'service' : this._uiState().chatContextFilter
    });
  }

  setActivitiesHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    this.patchUiState({ hostingPublicationFilter: filter });
  }

  setActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    this._uiState.update(state => {
      const nextState = {
        ...state,
        rateFilter: filter
      };
      return {
        ...nextState,
        rateSocialBadgeEnabled: this.resolveRateSocialBadgeEnabled(nextState)
      };
    });
  }

  setActivitiesRateSocialBadgeEnabled(enabled: boolean): void {
    this._uiState.update(state => ({
      ...state,
      rateSocialBadgeEnabled: enabled,
      ...(state.rateFilter.startsWith('pair')
        ? { ratePairSocialBadgeEnabled: enabled }
        : { rateIndividualSocialBadgeEnabled: enabled })
    }));
  }

  setActivitiesRateSocialBadgeEnabledForGroup(group: 'individual' | 'pair', enabled: boolean): void {
    this._uiState.update(state => {
      const nextState = {
        ...state,
        ...(group === 'pair'
          ? { ratePairSocialBadgeEnabled: enabled }
          : { rateIndividualSocialBadgeEnabled: enabled })
      };
      return {
        ...nextState,
        rateSocialBadgeEnabled: this.resolveRateSocialBadgeEnabled(nextState)
      };
    });
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

  emitActivitiesEventDisplaySync(sync: ActivitiesEventDisplaySync): void {
    this._activitiesEventSync.set(sync);
  }

  private runDeferredEventPersistence(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    const persist = async () => {
      await this.eventsService.syncEventSnapshot(payload).catch(() => {
        // Demo persistence is best-effort; UI state stays optimistic.
      });
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

  openEventChat(item: ChatRecord): void {
    const chatItem = this.cloneChatRecord(item);
    this._eventChatSession.set({
      item: chatItem,
      openedAtIso: new Date().toISOString()
    });
  }

  closeEventChat(): void {
    this._eventChatSession.set(null);
  }

  patchEventChatSessionItem(itemUpdater: (item: ChatRecord) => ChatRecord): void {
    const session = this._eventChatSession();
    if (!session) {
      return;
    }
    this._eventChatSession.set({
      ...session,
      item: this.cloneChatRecord(itemUpdater(this.cloneChatRecord(session.item)))
    });
  }

  async loadEventChatMessages(chat: ChatRecord): Promise<AppTypes.ChatPopupMessage[]> {
    return this.chatsService.loadChatMessages(chat);
  }

  async sendEventChatMessage(chat: ChatRecord, text: string, clientId?: string): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessage(chat, text, clientId);
  }

  async sendEventChatMessageWithAttachments(
    chat: ChatRecord,
    text: string,
    attachments: readonly AppTypes.ChatMessageAttachment[],
    clientId?: string,
    replyTo?: AppTypes.ChatPopupMessage['replyTo']
  ): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.sendChatMessageWithAttachments(chat, text, attachments, clientId, replyTo);
  }

  async updateEventChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: AppTypes.ChatMessageMutation
  ): Promise<AppTypes.ChatPopupMessage | null> {
    return this.chatsService.updateChatMessage(chat, messageId, mutation);
  }

  async watchEventChatMessages(
    chat: ChatRecord,
    onMessage: (message: AppTypes.ChatPopupMessage) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatMessages(chat, onMessage);
  }

  async watchEventChatEvents(
    chat: ChatRecord,
    onEvent: (event: AppTypes.ChatLiveEvent) => void
  ): Promise<() => void> {
    return this.chatsService.watchChatEvents(chat, onEvent);
  }

  async sendEventChatTyping(chat: ChatRecord, typing: boolean): Promise<void> {
    return this.chatsService.sendChatTyping(chat, typing);
  }

  async markEventChatRead(chat: ChatRecord, messageIds: readonly string[]): Promise<void> {
    return this.chatsService.markChatRead(chat, messageIds);
  }

  private patchUiState(patch: Partial<ActivitiesUiState>): void {
    this._uiState.update(state => ({
      ...state,
      ...patch
    }));
  }

  private resolveRateSocialBadgeEnabled(state: Pick<ActivitiesUiState,
    'rateFilter' | 'rateIndividualSocialBadgeEnabled' | 'ratePairSocialBadgeEnabled'
  >): boolean {
    return state.rateFilter.startsWith('pair')
      ? state.ratePairSocialBadgeEnabled
      : state.rateIndividualSocialBadgeEnabled;
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

  private cloneChatRecord(item: ChatRecord): ChatRecord {
    return {
      ...item,
      memberIds: [...(item.memberIds ?? [])]
    };
  }

}

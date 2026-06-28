import { Injectable, Type, computed, signal } from '@angular/core';

import type * as ContractTypes from '../../../core/contracts';
import type { ActivityEventDTO } from '../../../core/contracts/activity.interface';
import type { ChatDTO } from '../../../core/contracts/chat.interface';
import {
  DEFAULT_ACTIVITIES_UI_STATE,
  type ActivitiesUiState,
  type EventChatSession
} from '../activities-popup.types';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesPopupStore {
  private readonly _uiState = signal<ActivitiesUiState>(DEFAULT_ACTIVITIES_UI_STATE);
  private readonly _activityEventSave = signal<ActivityEventDTO | null>(null);
  private readonly _eventChatSession = signal<EventChatSession | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventChatPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventExplorePopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventMembersPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventFeedbackPopupComponentRef = signal<Type<unknown> | null>(null);

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
  readonly activityEventSave = this._activityEventSave.asReadonly();
  readonly eventChatSession = this._eventChatSession.asReadonly();
  readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  readonly eventChatPopupComponent = this.eventChatPopupComponentRef.asReadonly();
  readonly eventExplorePopupComponent = this.eventExplorePopupComponentRef.asReadonly();
  readonly eventMembersPopupComponent = this.eventMembersPopupComponentRef.asReadonly();
  readonly eventFeedbackPopupComponent = this.eventFeedbackPopupComponentRef.asReadonly();

  readonly activitiesOpenBoolean = computed(() => this._uiState().open);
  readonly eventChatOpen = computed(() => this._eventChatSession() !== null);

  openActivities(
    primaryFilter: ContractTypes.ActivitiesPrimaryFilter = 'chats',
    eventScope?: ContractTypes.ActivitiesEventScope,
    initialRateFilter?: ContractTypes.RateFilterKey,
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

  setActivitiesPrimaryFilter(filter: ContractTypes.ActivitiesPrimaryFilter): void {
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

  setActivitiesEventScope(scope: ContractTypes.ActivitiesEventScope): void {
    this.patchUiState({
      eventScope: scope,
      hostingPublicationFilter: scope === 'drafts' ? 'drafts' : 'all'
    });
  }

  setActivitiesSecondaryFilter(filter: ContractTypes.ActivitiesSecondaryFilter): void {
    this.patchUiState({
      secondaryFilter: filter,
      showSecondaryPicker: false
    });
  }

  setActivitiesChatContextFilter(filter: ContractTypes.ActivitiesChatContextFilter): void {
    this.patchUiState({ chatContextFilter: this._uiState().adminServiceOnly ? 'service' : filter });
  }

  setActivitiesSupportCaseFilter(filter: ContractTypes.SupportCaseFilter): void {
    const normalized = filter === 'pending' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
      ? filter
      : 'all';
    this.patchUiState({
      supportCaseFilter: normalized,
      chatContextFilter: this._uiState().adminServiceOnly ? 'service' : this._uiState().chatContextFilter
    });
  }

  setActivitiesHostingPublicationFilter(filter: ContractTypes.HostingPublicationFilter): void {
    this.patchUiState({ hostingPublicationFilter: filter });
  }

  setActivitiesRateFilter(filter: ContractTypes.RateFilterKey): void {
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

  setActivitiesView(view: ContractTypes.ActivitiesView): void {
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

  emitActivityEventSaveResult(sync: ActivityEventDTO): void {
    this._activityEventSave.set(sync);
  }

  clearActivityEventSave(): void {
    this._activityEventSave.set(null);
  }

  openEventChat(item: ChatDTO): void {
    const chatItem = this.cloneChatRecord(item);
    this._eventChatSession.set({
      item: chatItem,
      openedAtIso: new Date().toISOString()
    });
  }

  closeEventChat(): void {
    this._eventChatSession.set(null);
  }

  patchEventChatSessionItem(itemUpdater: (item: ChatDTO) => ChatDTO): void {
    const session = this._eventChatSession();
    if (!session) {
      return;
    }
    this._eventChatSession.set({
      ...session,
      item: this.cloneChatRecord(itemUpdater(this.cloneChatRecord(session.item)))
    });
  }

  async ensureActivitiesPopupLoaded(): Promise<void> {
    if (this.activitiesPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/activities-popup/activities-popup.component');
    this.activitiesPopupComponentRef.set(module.ActivitiesPopupComponent);
  }

  async ensureEventChatPopupLoaded(): Promise<void> {
    if (this.eventChatPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-chat-popup/event-chat-popup.component');
    this.eventChatPopupComponentRef.set(module.EventChatPopupComponent);
  }

  async ensureEventExplorePopupLoaded(): Promise<void> {
    if (this.eventExplorePopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-explore-popup/event-explore-popup.component');
    this.eventExplorePopupComponentRef.set(module.EventExplorePopupComponent);
  }

  async ensureEventMembersPopupLoaded(): Promise<void> {
    if (this.eventMembersPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-members-popup/event-members-popup.component');
    this.eventMembersPopupComponentRef.set(module.EventMembersPopupComponent);
  }

  async ensureEventFeedbackPopupLoaded(): Promise<void> {
    if (this.eventFeedbackPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-feedback-popup/event-feedback-popup.component');
    this.eventFeedbackPopupComponentRef.set(module.EventFeedbackPopupComponent);
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

  private normalizeActivitiesPrimaryFilter(filter: ContractTypes.ActivitiesPrimaryFilter): ContractTypes.ActivitiesPrimaryFilter {
    if (filter === 'hosting' || filter === 'invitations') {
      return 'events';
    }
    return filter;
  }

  private resolveActivitiesEventScope(
    primaryFilter: ContractTypes.ActivitiesPrimaryFilter,
    explicitScope?: ContractTypes.ActivitiesEventScope
  ): ContractTypes.ActivitiesEventScope {
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

  private cloneChatRecord(item: ChatDTO): ChatDTO {
    return {
      ...item,
      memberIds: [...(item.memberIds ?? [])]
    };
  }
}

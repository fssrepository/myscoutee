import { Injectable, Type, computed, inject, signal } from '@angular/core';

import type * as ContractTypes from '../../../core/contracts';
import type { ActivityEventDTO } from '../../../core/contracts/activity.interface';
import type { ChatDTO } from '../../../core/contracts/chat.interface';
import { ActivityStore } from './activity.store';
import { UserProfileStore } from './user-profile.store';

export interface EventChatPopupRequest {
  chatId: string;
  ownerId?: string | null;
  channelType?: ContractTypes.ChatChannelType | null;
  parentZIndex?: number | null;
}

export interface EventChatHeaderState extends EventChatPopupRequest {
  avatar?: string | null;
  title?: string | null;
  memberIds?: string[];
  members?: ContractTypes.ChatMemberSummaryDto[];
  unread?: number | null;
  dateIso?: string | null;
  lastMessage?: string | null;
  lastSenderId?: string | null;
  ownerUserId?: string | null;
  supportCase?: ContractTypes.ChatSupportCase | null;
  metrics?: ContractTypes.ChatMetricsDTO | null;
}

export interface EventChatSession {
  request: EventChatPopupRequest;
  openedAtIso: string;
}

export function eventChatPopupRequestFromChat(chat: Pick<ChatDTO, 'id' | 'ownerId' | 'channelType'>): EventChatPopupRequest {
  return {
    chatId: chat.id,
    ownerId: chat.ownerId ?? null,
    channelType: chat.channelType ?? null
  };
}

export function eventChatHeaderStateFromChat(chat: ChatDTO): EventChatHeaderState {
  return {
    ...eventChatPopupRequestFromChat(chat),
    avatar: chat.avatar,
    title: chat.title,
    memberIds: [...(chat.memberIds ?? [])],
    members: (chat.members ?? []).map(member => ({ ...member })),
    unread: chat.unread,
    dateIso: chat.dateIso ?? null,
    lastMessage: chat.lastMessage,
    lastSenderId: chat.lastSenderId,
    ownerUserId: chat.ownerUserId ?? null,
    supportCase: chat.supportCase
      ? {
          ...chat.supportCase,
          assignee: chat.supportCase.assignee ? { ...chat.supportCase.assignee } : chat.supportCase.assignee
        }
      : chat.supportCase,
    metrics: chat.metrics
      ? {
          members: chat.metrics.members ? { ...chat.metrics.members } : null,
          transport: chat.metrics.transport ? { ...chat.metrics.transport } : null,
          accommodation: chat.metrics.accommodation ? { ...chat.metrics.accommodation } : null,
          supplies: chat.metrics.supplies ? { ...chat.metrics.supplies } : null,
          groupsCount: chat.metrics.groupsCount ?? null,
          pendingTotal: Math.max(0, Math.trunc(Number(chat.metrics.pendingTotal) || 0))
        }
      : chat.metrics
  };
}

export interface EventChatRowPatch {
  chatId: string;
  ownerId?: string | null;
  channelType?: ContractTypes.ChatChannelType | null;
  unread?: number | null;
  unreadDelta?: number | null;
  lastMessage?: string | null;
  lastSenderId?: string | null;
  dateIso?: string | null;
  revision: number;
}

export interface ActivitiesUiState {
  open: boolean;
  openRevision: number;
  primaryFilter: ContractTypes.ActivitiesPrimaryFilter;
  eventScope: ContractTypes.ActivitiesEventScope;
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter;
  chatContextFilter: ContractTypes.ActivitiesChatContextFilter;
  supportCaseFilter: ContractTypes.SupportCaseFilter;
  hostingPublicationFilter: ContractTypes.HostingPublicationFilter;
  rateFilter: ContractTypes.RateFilterKey;
  rateSocialBadgeEnabled: boolean;
  rateIndividualSocialBadgeEnabled: boolean;
  ratePairSocialBadgeEnabled: boolean;
  view: ContractTypes.ActivitiesView;
  showViewPicker: boolean;
  showSecondaryPicker: boolean;
  stickyValue: string;
  ratesFullscreenMode: boolean;
  selectedRateId: string | null;
  adminServiceOnly: boolean;
}

export const DEFAULT_ACTIVITIES_UI_STATE: ActivitiesUiState = {
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
export class ActivitiesPopupStore {
  private readonly activityStore = inject(ActivityStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly _uiState = signal<ActivitiesUiState>(DEFAULT_ACTIVITIES_UI_STATE);
  private readonly _activityEventSync = signal<ActivityEventDTO | null>(null);
  private readonly _eventChatSession = signal<EventChatSession | null>(null);
  private readonly _eventChatHeader = signal<EventChatHeaderState | null>(null);
  private readonly _stackedEventChatSession = signal<EventChatSession | null>(null);
  private readonly _stackedEventChatHeader = signal<EventChatHeaderState | null>(null);
  private readonly _eventChatRowPatch = signal<EventChatRowPatch | null>(null);
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
  readonly activityEventSync = this._activityEventSync.asReadonly();
  readonly activityEventSave = this.activityEventSync;
  readonly eventChatSession = this._eventChatSession.asReadonly();
  readonly eventChatHeader = this._eventChatHeader.asReadonly();
  readonly stackedEventChatSession = this._stackedEventChatSession.asReadonly();
  readonly stackedEventChatHeader = this._stackedEventChatHeader.asReadonly();
  readonly eventChatRowPatch = this._eventChatRowPatch.asReadonly();
  readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  readonly eventChatPopupComponent = this.eventChatPopupComponentRef.asReadonly();
  readonly eventExplorePopupComponent = this.eventExplorePopupComponentRef.asReadonly();
  readonly eventMembersPopupComponent = this.eventMembersPopupComponentRef.asReadonly();
  readonly eventFeedbackPopupComponent = this.eventFeedbackPopupComponentRef.asReadonly();

  readonly activitiesOpenBoolean = computed(() => this._uiState().open);
  readonly eventChatOpen = computed(() => this._eventChatSession() !== null);
  readonly stackedEventChatOpen = computed(() => this._stackedEventChatSession() !== null);
  private eventChatRowPatchRevision = 0;

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
    this._eventChatHeader.set(null);
    this._stackedEventChatSession.set(null);
    this._stackedEventChatHeader.set(null);
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
    const normalized = filter === 'pending' || filter === 'warned' || filter === 'picked' || filter === 'solved' || filter === 'blocked'
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

  emitActivityEventSync(sync: ActivityEventDTO): void {
    this._activityEventSync.set(sync);
  }

  emitActivityEventSaveResult(sync: ActivityEventDTO): void {
    this.emitActivityEventSync(sync);
  }

  clearActivityEventSync(): void {
    this._activityEventSync.set(null);
  }

  clearActivityEventSave(): void {
    this.clearActivityEventSync();
  }

  openEventChat(request: EventChatPopupRequest, header: EventChatHeaderState): void {
    const normalizedRequest = this.normalizeEventChatRequest(request);
    if (!normalizedRequest) {
      return;
    }
    this._eventChatSession.set({
      request: normalizedRequest,
      openedAtIso: new Date().toISOString()
    });
    this._eventChatHeader.set(this.cloneEventChatHeader({
      ...header,
      ...normalizedRequest
    }));
    this._stackedEventChatSession.set(null);
    this._stackedEventChatHeader.set(null);
  }

  closeEventChat(): void {
    this._eventChatSession.set(null);
    this._eventChatHeader.set(null);
    this._stackedEventChatSession.set(null);
    this._stackedEventChatHeader.set(null);
  }

  patchEventChatHeader(headerUpdater: (header: EventChatHeaderState) => EventChatHeaderState): void {
    const header = this._eventChatHeader();
    if (!header) {
      return;
    }
    this._eventChatHeader.set(this.cloneEventChatHeader(headerUpdater(this.cloneEventChatHeader(header))));
  }

  openStackedEventChat(request: EventChatPopupRequest, header: EventChatHeaderState): void {
    const normalizedRequest = this.normalizeEventChatRequest(request);
    if (!normalizedRequest) {
      return;
    }
    this._stackedEventChatSession.set({
      request: normalizedRequest,
      openedAtIso: new Date().toISOString()
    });
    this._stackedEventChatHeader.set(this.cloneEventChatHeader({
      ...header,
      ...normalizedRequest
    }));
  }

  closeStackedEventChat(): void {
    this._stackedEventChatSession.set(null);
    this._stackedEventChatHeader.set(null);
  }

  patchStackedEventChatHeader(headerUpdater: (header: EventChatHeaderState) => EventChatHeaderState): void {
    const header = this._stackedEventChatHeader();
    if (!header) {
      return;
    }
    this._stackedEventChatHeader.set(this.cloneEventChatHeader(headerUpdater(this.cloneEventChatHeader(header))));
  }

  emitEventChatRowPatch(patch: Omit<EventChatRowPatch, 'revision'>): void {
    const chatId = `${patch.chatId ?? ''}`.trim();
    const ownerId = `${patch.ownerId ?? ''}`.trim();
    const channelType = patch.channelType ?? null;
    if (!chatId && !ownerId) {
      return;
    }
    this.patchActiveChatCounterFromRowPatch(patch);
    this._eventChatRowPatch.set({
      ...patch,
      chatId,
      ownerId: ownerId || null,
      channelType,
      revision: ++this.eventChatRowPatchRevision
    });
  }

  private patchActiveChatCounterFromRowPatch(patch: Omit<EventChatRowPatch, 'revision'>): void {
    if (patch.unreadDelta === undefined || patch.unreadDelta === null) {
      return;
    }
    const unreadDelta = Number(patch.unreadDelta);
    if (!Number.isFinite(unreadDelta) || unreadDelta === 0) {
      return;
    }
    const activeUser = this.userProfileStore.activeUserProfile();
    const activeUserId = `${activeUser?.id ?? ''}`.trim();
    if (!activeUserId) {
      return;
    }
    const overrides = this.activityStore.getUserCounterOverrides(activeUserId);
    const currentChatCounter = this.normalizeEventChatCounter(overrides.chats ?? activeUser?.activities?.chats);
    const nextChatCounter = this.normalizeEventChatCounter(currentChatCounter + unreadDelta);
    const currentContexts = overrides.chat ?? activeUser?.activities?.chat ?? {};
    const contextKey = this.chatContextCounterKey(patch.channelType);
    const nextContexts = {
      all: this.normalizeEventChatCounter((currentContexts.all ?? currentChatCounter) + unreadDelta),
      event: this.normalizeEventChatCounter((currentContexts.event ?? 0) + (contextKey === 'event' ? unreadDelta : 0)),
      subEvent: this.normalizeEventChatCounter((currentContexts.subEvent ?? 0) + (contextKey === 'subEvent' ? unreadDelta : 0)),
      group: this.normalizeEventChatCounter((currentContexts.group ?? 0) + (contextKey === 'group' ? unreadDelta : 0)),
      service: this.normalizeEventChatCounter((currentContexts.service ?? 0) + (contextKey === 'service' ? unreadDelta : 0)),
      appSupport: this.normalizeEventChatCounter((currentContexts.appSupport ?? 0) + (contextKey === 'appSupport' ? unreadDelta : 0))
    };
    const counterPatch = { chats: nextChatCounter, chat: nextContexts };
    this.activityStore.patchUserCounterOverrides(activeUserId, counterPatch);
    this.userProfileStore.patchUserActivityCounters(activeUserId, counterPatch);
  }

  private chatContextCounterKey(
    channelType: EventChatRowPatch['channelType']
  ): 'event' | 'subEvent' | 'group' | 'service' | 'appSupport' | null {
    switch (channelType) {
      case 'mainEvent': return 'event';
      case 'optionalSubEvent': return 'subEvent';
      case 'groupSubEvent': return 'group';
      case 'serviceEvent': return 'service';
      case 'appSupport':
      case 'supportCase': return 'appSupport';
      default: return null;
    }
  }

  private normalizeEventChatCounter(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
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

  private normalizeEventChatRequest(request: EventChatPopupRequest): EventChatPopupRequest | null {
    const chatId = `${request.chatId ?? ''}`.trim();
    const ownerId = `${request.ownerId ?? ''}`.trim();
    const channelType = request.channelType ?? null;
    const parentZIndex = Number(request.parentZIndex);
    if (!chatId && !ownerId) {
      return null;
    }
    return {
      chatId,
      ownerId: ownerId || null,
      channelType,
      parentZIndex: Number.isFinite(parentZIndex) ? Math.max(0, Math.trunc(parentZIndex)) : null
    };
  }

  private cloneEventChatHeader(header: EventChatHeaderState): EventChatHeaderState {
    return {
      ...header,
      chatId: `${header.chatId ?? ''}`.trim(),
      ownerId: `${header.ownerId ?? ''}`.trim() || null,
      parentZIndex: Number.isFinite(Number(header.parentZIndex))
        ? Math.max(0, Math.trunc(Number(header.parentZIndex)))
        : null,
      memberIds: [...(header.memberIds ?? [])],
      members: (header.members ?? []).map(member => ({ ...member })),
      supportCase: header.supportCase
        ? {
            ...header.supportCase,
            assignee: header.supportCase.assignee ? { ...header.supportCase.assignee } : header.supportCase.assignee
          }
        : header.supportCase,
      metrics: header.metrics
        ? {
            members: header.metrics.members ? { ...header.metrics.members } : null,
            transport: header.metrics.transport ? { ...header.metrics.transport } : null,
            accommodation: header.metrics.accommodation ? { ...header.metrics.accommodation } : null,
            supplies: header.metrics.supplies ? { ...header.metrics.supplies } : null,
            groupsCount: header.metrics.groupsCount ?? null,
            pendingTotal: Math.max(0, Math.trunc(Number(header.metrics.pendingTotal) || 0))
          }
        : header.metrics
    };
  }
}

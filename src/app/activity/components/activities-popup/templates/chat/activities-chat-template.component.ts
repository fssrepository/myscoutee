import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { AppUtils } from '../../../../../shared/app-utils';
import type {
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem
} from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../../../../shared/core/base/interfaces/user.interface';
import type {
  EventChatContext,
  EventChatResourceContext
} from '../../../../../shared/core/base/models';
import type * as AppTypes from '../../../../../shared/core/base/models';
import { CounterBadgePipe } from '../../../../../shared/ui';
import {
  ActivityResourceBuilder,
  toActivitySourceRowFromMenuItem
} from '../../../../../shared/core';
import {
  buildActivitiesChatTemplateData,
  type ActivitiesChatTemplateData
} from './activities-chat-template.builder';

export interface ActivitiesChatTemplateContext {
  getActiveUserInitials: () => string;
  getChatLastSender: (chat: ChatMenuItem) => DemoUser;
  getChatMemberCount: (chat: ChatMenuItem) => number;
  getChatChannelType: (chat: ChatMenuItem) => AppTypes.ChatChannelType;
}

@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [CommonModule, CounterBadgePipe],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent implements OnChanges {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() context: ActivitiesChatTemplateContext | null = null;

  @Output() readonly rowClick = new EventEmitter<MouseEvent>();

  protected data: ActivitiesChatTemplateData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['context']) {
      this.data = this.buildTemplateData();
    }
  }

  private buildTemplateData(): ActivitiesChatTemplateData | null {
    const row = this.row;
    const context = this.context;
    if (!row || !context) {
      return null;
    }
    const chat = row.source as ChatMenuItem;
    return buildActivitiesChatTemplateData(row, {
      groupLabel: this.groupLabel,
      activeUserInitials: context.getActiveUserInitials(),
      lastSenderGender: context.getChatLastSender(chat).gender,
      memberCount: context.getChatMemberCount(chat),
      channelType: context.getChatChannelType(chat)
    });
  }

  protected onRowClick(event: MouseEvent): void {
    this.rowClick.emit(event);
  }
}

type ActivitiesChatsHost = any;

export class ActivitiesChatsController {
  constructor(private readonly host: ActivitiesChatsHost) {}

  private cachedActiveUserRef: DemoUser | null = null;
  private cachedUsersRef: readonly DemoUser[] | null = null;
  private cachedChatItemsRef: readonly ChatMenuItem[] | null = null;
  private readonly userByIdCache = new Map<string, DemoUser>();
  private readonly chatItemByIdCache = new Map<string, ChatMenuItem>();
  private readonly chatMembersByIdCache = new Map<string, DemoUser[]>();
  private readonly chatLastSenderByIdCache = new Map<string, DemoUser>();
  private cachedOtherUsers: DemoUser[] = [];

  private get activeUser() { return this.host.activeUser as DemoUser; }
  private get activitiesContext() { return this.host.activitiesContext; }
  private get activityResourcesService() { return this.host.activityResourcesService; }
  private get appCtx() { return this.host.appCtx; }
  private get assetCards() { return this.host.assetCards as AppTypes.AssetCard[]; }
  private get cdr() { return this.host.cdr; }
  private get chatItems() { return this.host.chatItems as ChatMenuItem[]; }
  private get eventDatesById() { return this.host.eventDatesById as Record<string, string>; }
  private get eventDistanceById() { return this.host.eventDistanceById as Record<string, number>; }
  private get eventEditorService() { return this.host.eventEditorService; }
  private get eventItems() { return this.host.eventItems as EventMenuItem[]; }
  private get eventSubEventsById() { return this.host.eventSubEventsById as Record<string, AppTypes.SubEventFormItem[]>; }
  private get hostingDatesById() { return this.host.hostingDatesById as Record<string, string>; }
  private get hostingDistanceById() { return this.host.hostingDistanceById as Record<string, number>; }
  private get hostingItems() { return this.host.hostingItems as HostingMenuItem[]; }
  private get users() { return this.host.users as DemoUser[]; }

  private activityPendingMemberCount(row: AppTypes.ActivityListRow): number { return this.host.activityPendingMemberCount(row); }
  private chatCountValue(value: unknown): number { return this.host.chatCountValue(value); }
  private defaultEventStartIso(): string { return this.host.defaultEventStartIso(); }
  private runAfterActivitiesRender(task: () => void): void { this.host.runAfterActivitiesRender(task); }

  public chatChannelType(item: ChatMenuItem): AppTypes.ChatChannelType {
    if (
      item.channelType === 'mainEvent'
      || item.channelType === 'optionalSubEvent'
      || item.channelType === 'groupSubEvent'
      || item.channelType === 'serviceEvent'
    ) {
      return item.channelType;
    }
    return 'general';
  }

  public chatItemsForActivities(): ChatMenuItem[] {
    return this.chatItems.map(item => ({
      ...item,
      memberIds: [...(item.memberIds ?? [])],
      channelType: this.chatChannelType(item),
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0))
    }));
  }

  private contextualChatUnreadCount(item: ChatMenuItem): number {
    const channelType = this.chatChannelType(item);
    if (channelType === 'optionalSubEvent' || channelType === 'groupSubEvent') {
      const ownerId = this.normalizeLocationValue(item.eventId).trim();
      const subEvent = this.chatSubEventForItem(item);
      if (!subEvent || !ownerId) {
        return 0;
      }
      return this.contextualSubEventPendingTotal(ownerId, subEvent, channelType === 'optionalSubEvent' || channelType === 'groupSubEvent');
    }
    if (channelType === 'mainEvent') {
      return this.mainEventContextPendingCount(item);
    }
    return Math.max(0, Math.trunc(Number(item.unread) || 0));
  }

  private contextualSubEventPendingTotal(
    ownerId: string,
    subEvent: AppTypes.SubEventFormItem,
    includeMembers = true
  ): number {
    this.syncSubEventAssetBadgeCounts(ownerId, subEvent, 'Car');
    this.syncSubEventAssetBadgeCounts(ownerId, subEvent, 'Accommodation');
    this.syncSubEventAssetBadgeCounts(ownerId, subEvent, 'Supplies');
    const members = includeMembers ? this.chatCountValue(subEvent.membersPending) : 0;
    return members
      + this.chatCountValue(subEvent.carsPending)
      + this.chatCountValue(subEvent.accommodationPending)
      + this.chatCountValue(subEvent.suppliesPending);
  }

  private subEventResourceState(
    ownerId: string,
    subEventId: string
  ): AppTypes.ActivitySubEventResourceState | null {
    return this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId, this.currentAssetOwnerUserId());
  }

  private resolveSubEventAssignedAssetIds(
    ownerId: string,
    subEventId: string,
    type: AppTypes.AssetType
  ): string[] {
    return ActivityResourceBuilder.resolveAssignedAssetIds(
      this.subEventResourceState(ownerId, subEventId),
      type,
      this.assetCards
    );
  }

  private syncSubEventAssetBadgeCounts(ownerId: string, subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType): void {
    const state = this.subEventResourceState(ownerId, subEvent.id);
    const accepted = ActivityResourceBuilder.resourceAcceptedCount(subEvent, type, state, this.assetCards);
    const pending = ActivityResourceBuilder.resourcePendingCount(subEvent, type, state, this.assetCards);
    const bounds = ActivityResourceBuilder.resourceCapacityBounds(subEvent, type, state, this.assetCards, accepted, pending);
    if (type === 'Car') {
      subEvent.carsAccepted = accepted;
      subEvent.carsPending = pending;
      subEvent.carsCapacityMin = bounds.capacityMin;
      subEvent.carsCapacityMax = bounds.capacityMax;
      return;
    }
    if (type === 'Accommodation') {
      subEvent.accommodationAccepted = accepted;
      subEvent.accommodationPending = pending;
      subEvent.accommodationCapacityMin = bounds.capacityMin;
      subEvent.accommodationCapacityMax = bounds.capacityMax;
      return;
    }
    subEvent.suppliesAccepted = accepted;
    subEvent.suppliesPending = pending;
    subEvent.suppliesCapacityMin = bounds.capacityMin;
    subEvent.suppliesCapacityMax = bounds.capacityMax;
  }

  private mainEventContextPendingCount(item: ChatMenuItem): number {
    const source = this.resolveChatEventSource(item);
    if (!source) {
      return 0;
    }
    const row = this.buildChatSourceActivityRow(source);
    const eventPending = this.activityPendingMemberCount(row);
    const eventId = this.normalizeLocationValue(item.eventId).trim() || source.id;
    const subEventsPending = this.chatEventSubEvents(eventId)
      .reduce((sum, subEvent) => sum + this.contextualSubEventPendingTotal(eventId, subEvent, true), 0);
    return eventPending + subEventsPending;
  }

  private resolveChatEventSource(item: ChatMenuItem): EventMenuItem | HostingMenuItem | null {
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    if (!eventId) {
      return this.resolveChatFocusEventSource();
    }
    return this.eventItems.find(event => event.id === eventId)
      ?? this.hostingItems.find(event => event.id === eventId)
      ?? this.resolveEventEditorSource();
  }

  private buildChatSourceActivityRow(source: EventMenuItem | HostingMenuItem): AppTypes.ActivityListRow {
    return toActivitySourceRowFromMenuItem(source, {
      isHosting: this.hostingItems.some(item => item.id === source.id),
      dateIso: this.eventDatesById[source.id] ?? this.hostingDatesById[source.id] ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[source.id] ?? this.hostingDistanceById[source.id] ?? 0,
      metricScore: source.activity
    });
  }

  private chatStageLabel(index: number): string {
    return `Stage ${index + 1}`;
  }

  private resolveChatFocusEventSource(): EventMenuItem | HostingMenuItem | null {
    const editorSource = this.resolveEventEditorSource();
    if (editorSource) {
      return editorSource;
    }
    const managed = this.eventItems.find(item => item.isAdmin);
    if (managed) {
      return managed;
    }
    return this.eventItems[0] ?? this.hostingItems[0] ?? null;
  }

  private resolveEventEditorSource(): EventMenuItem | HostingMenuItem | null {
    if (!this.eventEditorService.isOpen()) {
      return null;
    }
    const source = this.eventEditorService.sourceEvent();
    if (!source || typeof source !== 'object') {
      return null;
    }
    const sourceId = typeof (source as { id?: unknown }).id === 'string'
      ? (source as { id: string }).id.trim()
      : '';
    if (!sourceId) {
      return null;
    }
    const eventMatch = this.eventItems.find(item => item.id === sourceId);
    if (eventMatch) {
      return eventMatch;
    }
    const hostingMatch = this.hostingItems.find(item => item.id === sourceId);
    if (hostingMatch) {
      return hostingMatch;
    }
    const fallbackSource = source as Partial<EventMenuItem | HostingMenuItem>;
    return {
      id: sourceId,
      avatar: typeof fallbackSource.avatar === 'string'
        ? fallbackSource.avatar
        : AppUtils.initialsFromText(typeof fallbackSource.title === 'string' ? fallbackSource.title : 'Event'),
      title: typeof fallbackSource.title === 'string' ? fallbackSource.title : 'Event',
      shortDescription: typeof fallbackSource.shortDescription === 'string' ? fallbackSource.shortDescription : '',
      timeframe: typeof fallbackSource.timeframe === 'string' ? fallbackSource.timeframe : '',
      activity: Number.isFinite(Number(fallbackSource.activity)) ? Number(fallbackSource.activity) : 0,
      ...(typeof (fallbackSource as EventMenuItem).isAdmin === 'boolean'
        ? { isAdmin: (fallbackSource as EventMenuItem).isAdmin }
        : {})
    } as EventMenuItem | HostingMenuItem;
  }

  private chatEventSubEvents(eventId: string): AppTypes.SubEventFormItem[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    return this.sortSubEventsByStartAsc(this.cloneSubEvents(this.eventSubEventsById[normalizedEventId] ?? []));
  }

  private chatSubEventForItem(item: ChatMenuItem): AppTypes.SubEventFormItem | null {
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    const subEventId = this.normalizeLocationValue(item.subEventId).trim();
    if (!eventId || !subEventId) {
      return null;
    }
    return this.chatEventSubEvents(eventId).find(subEvent => subEvent.id === subEventId) ?? null;
  }

  private cloneSubEvents(items: AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    return items.map(item => ({
      ...item,
      location: this.normalizeLocationValue(item.location),
      groups: this.cloneSubEventGroups(item.groups)
    }));
  }

  private normalizeLocationValue(value: string | null | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  private sortSubEventsByStartAsc(items: AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    const source = this.cloneSubEvents(items);
    return source
      .map((item, index) => ({
        item,
        index,
        startMs: new Date(item.startAt).getTime()
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

  private cloneSubEventGroups(groups: AppTypes.SubEventGroupItem[] | undefined): AppTypes.SubEventGroupItem[] {
    if (!groups || groups.length === 0) {
      return [];
    }
    return groups.map(group => ({
      ...group,
      source: this.normalizedSubEventGroupSource(group)
    }));
  }

  private subEventGroupsForStage(item: AppTypes.SubEventFormItem): AppTypes.SubEventGroupItem[] {
    return this.reconcileTournamentGroupsForStage(item, this.cloneSubEventGroups(item.groups));
  }

  private normalizedSubEventGroupSource(group: Partial<AppTypes.SubEventGroupItem> | undefined): 'manual' | 'generated' {
    return group?.source === 'generated' ? 'generated' : 'manual';
  }

  private reconcileTournamentGroupsForStage(
    item: AppTypes.SubEventFormItem,
    sourceGroups: AppTypes.SubEventGroupItem[] = this.cloneSubEventGroups(item.groups)
  ): AppTypes.SubEventGroupItem[] {
    const normalizedGroups = sourceGroups.map(group => ({
      ...group,
      source: this.normalizedSubEventGroupSource(group)
    }));
    if (item.optional) {
      return normalizedGroups;
    }
    const manualGroups = normalizedGroups
      .filter(group => this.normalizedSubEventGroupSource(group) === 'manual')
      .map(group => ({
        ...group,
        source: 'manual' as const
      }));
    const generatedGroups = normalizedGroups
      .filter(group => this.normalizedSubEventGroupSource(group) === 'generated')
      .map(group => ({
        ...group,
        source: 'generated' as const
      }));
    return [...manualGroups, ...generatedGroups];
  }

  private currentAssetOwnerUserId(): string {
    return this.appCtx.activeUserId().trim() || this.activeUser.id;
  }

  private syncChatLookupCache(): void {
    const activeUser = this.activeUser;
    const users = this.users;
    const chatItems = this.chatItems;
    if (
      this.cachedActiveUserRef === activeUser
      && this.cachedUsersRef === users
      && this.cachedChatItemsRef === chatItems
    ) {
      return;
    }

    this.cachedActiveUserRef = activeUser;
    this.cachedUsersRef = users;
    this.cachedChatItemsRef = chatItems;
    this.userByIdCache.clear();
    this.chatItemByIdCache.clear();
    this.chatMembersByIdCache.clear();
    this.chatLastSenderByIdCache.clear();
    this.cachedOtherUsers = [];

    for (const user of users) {
      this.userByIdCache.set(user.id, user);
      if (user.id !== activeUser.id) {
        this.cachedOtherUsers.push(user);
      }
    }

    for (const item of chatItems) {
      this.chatItemByIdCache.set(item.id, item);
    }
  }

  private getChatItemById(chatId: string): ChatMenuItem | undefined {
    this.syncChatLookupCache();
    return this.chatItemByIdCache.get(chatId);
  }

  private getChatMembersById(chatId: string): DemoUser[] {
    this.syncChatLookupCache();
    const cachedMembers = this.chatMembersByIdCache.get(chatId);
    if (cachedMembers) {
      return cachedMembers;
    }

    const chatItem = this.getChatItemById(chatId);
    const explicitMembers = (chatItem?.memberIds ?? [])
      .map(memberId => this.userByIdCache.get(memberId))
      .filter((user): user is DemoUser => Boolean(user));
    const lastSender = chatItem?.lastSenderId
      ? this.userByIdCache.get(chatItem.lastSenderId) ?? null
      : null;

    const orderedMembers: DemoUser[] = [];
    if (lastSender) {
      orderedMembers.push(lastSender);
    }
    for (const member of explicitMembers) {
      if (!orderedMembers.some(item => item.id === member.id)) {
        orderedMembers.push(member);
      }
    }
    if (!orderedMembers.some(item => item.id === this.activeUser.id)) {
      orderedMembers.push(this.activeUser);
    }
    if (orderedMembers.length > 0) {
      this.chatMembersByIdCache.set(chatId, orderedMembers);
      return orderedMembers;
    }

    const others = this.cachedOtherUsers;
    if (!others.length) {
      const fallbackMembers = [this.activeUser];
      this.chatMembersByIdCache.set(chatId, fallbackMembers);
      return fallbackMembers;
    }
    const seed = AppUtils.hashText(chatId);
    const offsets = [0, 3, 7, 11, 15, 19];
    const memberCount = 3 + (seed % 3);
    const picked: DemoUser[] = [];
    for (const offset of offsets) {
      const user = others[(seed + offset) % others.length];
      if (!picked.some(item => item.id === user.id)) {
        picked.push(user);
      }
      if (picked.length === memberCount) {
        break;
      }
    }
    while (picked.length < memberCount) {
      picked.push(others[picked.length % others.length]);
    }
    this.chatMembersByIdCache.set(chatId, picked);
    return picked;
  }

  private explicitChatMemberCount(item: ChatMenuItem | null | undefined): number {
    const uniqueIds = new Set(
      (item?.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    );
    return uniqueIds.size;
  }

  public getChatLastSender(item: ChatMenuItem): DemoUser {
    this.syncChatLookupCache();
    const cachedLastSender = this.chatLastSenderByIdCache.get(item.id);
    if (cachedLastSender) {
      return cachedLastSender;
    }
    const nextLastSender = this.userByIdCache.get(item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
    this.chatLastSenderByIdCache.set(item.id, nextLastSender);
    return nextLastSender;
  }

  public getChatMemberCount(item: ChatMenuItem): number {
    const explicitCount = this.explicitChatMemberCount(item);
    if (explicitCount > 0) {
      return explicitCount;
    }
    return this.getChatMembersById(item.id).length;
  }

  private subEventDisplayName(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    return subEvent?.name?.trim() ?? '';
  }

  public openActivityChat(chat: ChatMenuItem): void {
    const initialContext = this.buildInitialEventChatContext(chat);
    this.activitiesContext.openEventChat(chat, initialContext);
    const openedSession = this.activitiesContext.eventChatSession();
    const openedAtIso = openedSession?.openedAtIso ?? '';
    this.runAfterActivitiesRender(() => {
      const activeSession = this.activitiesContext.eventChatSession();
      if (!activeSession || activeSession.item.id !== chat.id || activeSession.openedAtIso !== openedAtIso) {
        return;
      }
      this.activitiesContext.touchEventChatSession(() => this.buildEventChatContext(chat));
      this.cdr.markForCheck();
    });
  }

  private buildInitialEventChatContext(chat: ChatMenuItem): EventChatContext {
    const channelType = this.chatChannelType(chat);
    const hasSubEventMenu = channelType === 'optionalSubEvent' || channelType === 'groupSubEvent';
    return {
      channelType,
      hasSubEventMenu,
      actionIcon: this.eventChatActionIcon(channelType),
      actionLabel: this.eventChatActionLabel(channelType),
      actionToneClass: this.eventChatActionTone(channelType),
      actionBadgeCount: Math.max(0, Math.trunc(Number(chat.unread) || 0)),
      menuTitle: chat.title,
      eventRow: null,
      subEventRow: null,
      subEvent: null,
      group: null,
      assetAssignmentIds: {
        Car: [],
        Accommodation: [],
        Supplies: []
      },
      assetCardsByType: {
        Car: [],
        Accommodation: [],
        Supplies: []
      },
      resources: []
    };
  }

  private buildEventChatContext(chat: ChatMenuItem): EventChatContext {
    const channelType = this.chatChannelType(chat);
    const subEvent = this.chatSubEventForItem(chat);
    const group = this.eventChatGroup(chat, subEvent);
    const source = this.resolveChatEventSource(chat);
    const eventRow = source ? this.buildChatSourceActivityRow(source) : null;
    const ownerId = eventRow?.id ?? this.normalizeLocationValue(chat.eventId).trim();
    const hasSubEventMenu = channelType === 'optionalSubEvent' || channelType === 'groupSubEvent';
    return {
      channelType,
      hasSubEventMenu,
      actionIcon: this.eventChatActionIcon(channelType),
      actionLabel: this.eventChatActionLabel(channelType),
      actionToneClass: this.eventChatActionTone(channelType),
      actionBadgeCount: this.contextualChatUnreadCount(chat),
      menuTitle: this.eventChatMenuTitle(chat, subEvent, group),
      eventRow,
      subEventRow: eventRow,
      subEvent,
      group,
      assetAssignmentIds: subEvent ? this.eventChatResourceAssignmentIds(ownerId, subEvent) : {},
      assetCardsByType: this.eventChatResourceCardsByType(),
      resources: this.eventChatResources(channelType, ownerId, subEvent)
    };
  }

  private eventChatActionIcon(channelType: AppTypes.ChatChannelType): string {
    if (channelType === 'serviceEvent') {
      return 'support_agent';
    }
    if (channelType === 'groupSubEvent') {
      return 'groups';
    }
    if (channelType === 'optionalSubEvent') {
      return 'event_available';
    }
    return 'event';
  }

  private eventChatActionLabel(channelType: AppTypes.ChatChannelType): string {
    if (channelType === 'serviceEvent') {
      return 'View Event';
    }
    if (channelType === 'groupSubEvent') {
      return 'View Group';
    }
    if (channelType === 'optionalSubEvent') {
      return 'View Sub Event';
    }
    return 'View Event';
  }

  private eventChatActionTone(channelType: AppTypes.ChatChannelType): EventChatContext['actionToneClass'] {
    if (channelType === 'serviceEvent') {
      return 'popup-chat-context-btn-tone-main-event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'popup-chat-context-btn-tone-optional';
    }
    if (channelType === 'groupSubEvent') {
      return 'popup-chat-context-btn-tone-group';
    }
    return 'popup-chat-context-btn-tone-main-event';
  }

  private eventChatGroup(
    chat: ChatMenuItem,
    subEvent: AppTypes.SubEventFormItem | null
  ): EventChatContext['group'] {
    if (!subEvent || !chat.groupId) {
      return null;
    }
    const group = this.subEventGroupsForStage(subEvent).find(item => item.id === chat.groupId) ?? null;
    if (!group) {
      return null;
    }
    return {
      id: group.id,
      label: group.name
    };
  }

  private eventChatMenuTitle(
    chat: ChatMenuItem,
    subEvent: AppTypes.SubEventFormItem | null,
    group: EventChatContext['group']
  ): string {
    if (!subEvent) {
      return chat.title;
    }
    const subEventLabel = this.subEventDisplayName(subEvent) || subEvent.name || chat.title;
    if (group) {
      return `${subEventLabel} · ${group.label}`;
    }
    return subEventLabel;
  }

  private eventChatResources(
    channelType: AppTypes.ChatChannelType,
    ownerId: string,
    subEvent: AppTypes.SubEventFormItem | null
  ): EventChatResourceContext[] {
    if (!subEvent) {
      return [];
    }
    const includeMembers = channelType === 'optionalSubEvent' || channelType === 'groupSubEvent';
    return [
      {
        type: 'Members',
        icon: 'groups',
        title: 'Members',
        typeClass: 'event-subevent-badge-members',
        summary: this.subEventCapacityLabelForChat(subEvent),
        pending: Math.max(0, Math.trunc(Number(subEvent.membersPending) || 0)),
        stateClass: this.subEventCapacityStateClassForChat(subEvent),
        visible: includeMembers
      },
      this.buildEventChatAssetResource(ownerId, subEvent, 'Car', 'directions_car', 'Car', 'event-subevent-badge-car'),
      this.buildEventChatAssetResource(ownerId, subEvent, 'Accommodation', 'hotel', 'Property', 'event-subevent-badge-accommodation'),
      this.buildEventChatAssetResource(ownerId, subEvent, 'Supplies', 'inventory_2', 'Supplies', 'event-subevent-badge-supplies')
    ];
  }

  private buildEventChatAssetResource(
    ownerId: string,
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    icon: string,
    title: string,
    typeClass: string
  ): EventChatResourceContext {
    this.syncSubEventAssetBadgeCounts(ownerId, subEvent, type);
    let accepted = 0;
    let pending = 0;
    let capacityMin = 0;
    let capacityMax = 0;

    if (type === 'Car') {
      accepted = this.chatCountValue(subEvent.carsAccepted);
      pending = this.chatCountValue(subEvent.carsPending);
      capacityMin = this.chatCountValue(subEvent.carsCapacityMin);
      capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.carsCapacityMax));
    } else if (type === 'Accommodation') {
      accepted = this.chatCountValue(subEvent.accommodationAccepted);
      pending = this.chatCountValue(subEvent.accommodationPending);
      capacityMin = this.chatCountValue(subEvent.accommodationCapacityMin);
      capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.accommodationCapacityMax));
    } else {
      accepted = this.chatCountValue(subEvent.suppliesAccepted);
      pending = this.chatCountValue(subEvent.suppliesPending);
      capacityMin = this.chatCountValue(subEvent.suppliesCapacityMin);
      capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.suppliesCapacityMax));
    }

    return {
      type: type === 'Accommodation' ? 'Accommodation' : type,
      icon,
      title,
      typeClass,
      summary: `${accepted} / ${capacityMin} - ${capacityMax}`,
      pending,
      stateClass: accepted >= capacityMin && accepted <= capacityMax
        ? 'subevent-capacity-in-range'
        : 'subevent-capacity-out-of-range',
      visible: true
    };
  }

  private eventChatResourceAssignmentIds(
    ownerId: string,
    subEvent: AppTypes.SubEventFormItem
  ): Record<AppTypes.AssetType, string[]> {
    return {
      Car: [...this.resolveSubEventAssignedAssetIds(ownerId, subEvent.id, 'Car')],
      Accommodation: [...this.resolveSubEventAssignedAssetIds(ownerId, subEvent.id, 'Accommodation')],
      Supplies: [...this.resolveSubEventAssignedAssetIds(ownerId, subEvent.id, 'Supplies')]
    };
  }

  private eventChatResourceCardsByType(): Record<AppTypes.AssetType, AppTypes.AssetCard[]> {
    return {
      Car: this.assetCards.filter(card => card.type === 'Car').map(card => ({ ...card, requests: [...card.requests] })),
      Accommodation: this.assetCards.filter(card => card.type === 'Accommodation').map(card => ({ ...card, requests: [...card.requests] })),
      Supplies: this.assetCards.filter(card => card.type === 'Supplies').map(card => ({ ...card, requests: [...card.requests] }))
    };
  }

  private subEventCapacityLabelForChat(item: AppTypes.SubEventFormItem): string {
    return `${item.membersAccepted} / ${item.capacityMin} - ${item.capacityMax}`;
  }

  private subEventCapacityStateClassForChat(item: AppTypes.SubEventFormItem): string {
    return item.membersAccepted >= item.capacityMin && item.membersAccepted <= item.capacityMax
      ? 'subevent-capacity-in-range'
      : 'subevent-capacity-out-of-range';
  }

  public activityChatContextFilterKey(item: ChatMenuItem): AppTypes.ActivitiesChatContextFilter | null {
    const channelType = this.chatChannelType(item);
    if (channelType === 'mainEvent') {
      return 'event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'subEvent';
    }
    if (channelType === 'groupSubEvent') {
      return 'group';
    }
    if (channelType === 'serviceEvent') {
      return 'service';
    }
    return null;
  }
}

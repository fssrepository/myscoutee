import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../../../shared/app-utils';
import type { ChatRecord } from '../../../../../shared/core/base/models/chat.model';
import type { UserDto } from '../../../../../shared/core/contracts/user.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import type { ActivityEventRecord } from '../../../../../shared/core/base/models/events.model';
import {
  AppMenuComponent,
  CounterBadgePipe,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../../../shared/ui';
import { I18nPipe } from '../../../../../shared/ui';
import { ActivityResourceBuilder } from '../../../../../shared/core';
import {
  buildActivitiesChatTemplateData,
  type ActivitiesChatTemplateData
} from './activities-chat-template.builder';

import type * as AppDTOs from '../../../../../shared/core/base/dto';
import type * as AppConstants from '../../../../../shared/core/common/constants';
@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [CommonModule, MatIconModule, AppMenuComponent, CounterBadgePipe, I18nPipe],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent implements OnChanges {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() activeUserInitials = '';
  @Input() adminServiceMode = false;

  @Output() readonly rowClick = new EventEmitter<Event>();
  @Output() readonly supportCaseAction = new EventEmitter<AppTypes.SupportCaseAction>();

  protected data: ActivitiesChatTemplateData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['activeUserInitials'] || changes['adminServiceMode']) {
      this.data = this.buildTemplateData();
    }
  }

  private buildTemplateData(): ActivitiesChatTemplateData | null {
    const row = this.row;
    if (!row || row.type !== 'chats') {
      return null;
    }
    return buildActivitiesChatTemplateData(row, {
      groupLabel: this.groupLabel,
      activeUserInitials: this.activeUserInitials,
      adminServiceMode: this.adminServiceMode
    });
  }

  protected onRowClick(event: Event): void {
    this.rowClick.emit(event);
  }

  protected onRowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.rowClick.emit(event);
  }

  protected supportCaseMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'more_horiz',
      closeIcon: 'close',
      ariaLabel: 'activities.support.case.actions',
      hideLabel: true,
      palette: 'blue',
      shape: 'icon'
    };
  }

  protected supportCaseMenuItems(): readonly AppMenuItem<string, { action: AppTypes.SupportCaseAction }>[] {
    return this.supportCaseActions().map(item => ({
      id: `support-case-action:${item.action}`,
      label: item.labelKey,
      icon: item.icon,
      palette: this.supportCaseMenuPalette(item.tone),
      surface: 'tinted',
      context: { action: item.action }
    }));
  }

  protected onSupportCaseMenuSelect(event: AppMenuItemSelectEvent<string, { action: AppTypes.SupportCaseAction }>): void {
    const action = event.context?.action;
    if (!action) {
      return;
    }
    this.supportCaseAction.emit(action);
  }

  protected supportCaseActions(): Array<{ action: AppTypes.SupportCaseAction; labelKey: string; icon: string; tone: string }> {
    const status = this.data?.supportCaseStatus ?? 'pending';
    if (status === 'solved' || status === 'blocked') {
      return [
        { action: 'reopen', labelKey: 'activities.support.case.action.reopen', icon: 'restart_alt', tone: 'neutral' }
      ];
    }
    if (status === 'picked') {
      return [
        { action: 'unpick', labelKey: 'activities.support.case.action.unpick', icon: 'person_remove', tone: 'neutral' },
        { action: 'solve', labelKey: 'activities.support.case.action.solve', icon: 'check_circle', tone: 'accent' },
        { action: 'block', labelKey: 'activities.support.case.action.block', icon: 'block', tone: 'danger' }
      ];
    }
    return [
      { action: 'pick', labelKey: 'activities.support.case.action.pick', icon: 'person_add', tone: 'accent' },
      { action: 'solve', labelKey: 'activities.support.case.action.solve', icon: 'check_circle', tone: 'accent' },
      { action: 'block', labelKey: 'activities.support.case.action.block', icon: 'block', tone: 'danger' }
    ];
  }

  private supportCaseMenuPalette(tone: string): AppMenuPalette {
    switch (tone) {
      case 'danger':
        return 'danger';
      case 'accent':
        return 'green';
      default:
        return 'neutral';
    }
  }
}

type ActivitiesChatsHost = any;

export class ActivitiesChatsController {
  constructor(private readonly host: ActivitiesChatsHost) {}

  private cachedActiveUserRef: UserDto | null = null;
  private cachedUsersRef: readonly UserDto[] | null = null;
  private cachedChatItemsRef: readonly ChatRecord[] | null = null;
  private readonly userByIdCache = new Map<string, UserDto>();
  private readonly chatItemByIdCache = new Map<string, ChatRecord>();
  private readonly chatMembersByIdCache = new Map<string, UserDto[]>();
  private readonly chatLastSenderByIdCache = new Map<string, UserDto>();
  private cachedOtherUsers: UserDto[] = [];

  private get activeUser() { return this.host.activeUser as UserDto; }
  private get activitiesContext() { return this.host.activitiesContext; }
  private get activitiesService() { return this.host.activitiesService; }
  private get activityResourcesService() { return this.host.activityResourcesService; }
  private get appCtx() { return this.host.appCtx; }
  private get assetCards() { return this.host.assetCards as AppDTOs.AssetCardDTO[]; }
  private get cdr() { return this.host.cdr; }
  private get chatItems() { return this.host.chatItems as ChatRecord[]; }
  private get eventDatesById() { return this.host.eventDatesById as Record<string, string>; }
  private get eventDistanceById() { return this.host.eventDistanceById as Record<string, number>; }
  private get eventEditorService() { return this.host.eventEditorService; }
  private get eventItems() { return this.host.eventItems as ActivityEventRecord[]; }
  private get eventSubEventsById() { return this.host.eventSubEventsById as Record<string, AppTypes.SubEventFormItem[]>; }
  private get hostingDatesById() { return this.host.hostingDatesById as Record<string, string>; }
  private get hostingDistanceById() { return this.host.hostingDistanceById as Record<string, number>; }
  private get hostingItems() { return this.host.hostingItems as ActivityEventRecord[]; }
  private get users() { return this.host.users as UserDto[]; }

  private activityPendingMemberCount(row: AppTypes.ActivityListRow): number { return this.host.activityPendingMemberCount(row); }
  private chatCountValue(value: unknown): number { return this.host.chatCountValue(value); }
  private defaultEventStartIso(): string { return this.host.defaultEventStartIso(); }
  public chatChannelType(item: ChatRecord): AppTypes.ChatChannelType {
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

  public chatItemsForActivities(): ChatRecord[] {
    return this.chatItems.map(item => ({
      ...item,
      memberIds: [...(item.memberIds ?? [])],
      channelType: this.chatChannelType(item),
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0))
    }));
  }

  private contextualChatUnreadCount(item: ChatRecord): number {
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
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    return this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId, this.currentAssetOwnerUserId());
  }

  private resolveSubEventAssignedAssetIds(
    ownerId: string,
    subEventId: string,
    type: AppConstants.AssetType
  ): string[] {
    return ActivityResourceBuilder.resolveAssignedAssetIds(
      this.subEventResourceState(ownerId, subEventId),
      type,
      this.assetCards
    );
  }

  private syncSubEventAssetBadgeCounts(ownerId: string, subEvent: AppTypes.SubEventFormItem, type: AppConstants.AssetType): void {
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

  private mainEventContextPendingCount(item: ChatRecord): number {
    const source = this.resolveChatEventSource(item);
    if (!source) {
      return 0;
    }
    const row = this.buildChatEventActivityRow(source);
    const eventPending = this.activityPendingMemberCount(row);
    const eventId = this.normalizeLocationValue(item.eventId).trim() || source.id;
    const subEventsPending = this.chatEventSubEvents(eventId)
      .reduce((sum, subEvent) => sum + this.contextualSubEventPendingTotal(eventId, subEvent, true), 0);
    return eventPending + subEventsPending;
  }

  private resolveChatEventSource(item: ChatRecord): ActivityEventRecord | null {
    const eventId = this.normalizeLocationValue(item.eventId).trim();
    if (!eventId) {
      return this.resolveChatFocusEventSource();
    }
    return this.eventItems.find(event => event.id === eventId)
      ?? this.hostingItems.find(event => event.id === eventId)
      ?? this.resolveEventEditorSource();
  }

  private buildChatEventActivityRow(record: ActivityEventRecord): AppTypes.ActivityListRow {
    return this.activitiesService.buildEventDisplayRow({
      ...record,
      startAtIso: this.eventDatesById[record.id] ?? this.hostingDatesById[record.id] ?? record.startAtIso ?? this.defaultEventStartIso(),
      distanceKm: this.eventDistanceById[record.id] ?? this.hostingDistanceById[record.id] ?? record.distanceKm ?? 0
    }, {
      activeUserId: this.activeUser.id
    });
  }

  private chatStageLabel(index: number): string {
    return `Stage ${index + 1}`;
  }

  private resolveChatFocusEventSource(): ActivityEventRecord | null {
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

  private resolveEventEditorSource(): ActivityEventRecord | null {
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
    return this.buildFallbackEventEditorRecord(source, sourceId);
  }

  private buildFallbackEventEditorRecord(source: object, sourceId: string): ActivityEventRecord {
    const value = source as Partial<ActivityEventRecord> & {
      shortDescription?: string;
      startAt?: string;
      endAt?: string;
    };
    const title = typeof value.title === 'string' && value.title.trim() ? value.title : 'Event';
    const subtitle = typeof value.subtitle === 'string'
      ? value.subtitle
      : typeof value.shortDescription === 'string'
        ? value.shortDescription
        : '';
    const startAtIso = typeof value.startAtIso === 'string'
      ? value.startAtIso
      : typeof value.startAt === 'string'
        ? value.startAt
        : this.defaultEventStartIso();
    const endAtIso = typeof value.endAtIso === 'string'
      ? value.endAtIso
      : typeof value.endAt === 'string'
        ? value.endAt
        : startAtIso;
    const type = value.type === 'hosting' || value.type === 'invitations' ? value.type : 'events';
    const creatorInitials = value.creatorInitials ?? value.avatar ?? AppUtils.initialsFromText(title);
    return {
      id: sourceId,
      userId: value.userId ?? this.activeUser.id,
      type,
      status: value.status ?? (type === 'hosting' ? 'H' : type === 'invitations' ? 'INV' : 'A'),
      statusBeforeSuppression: value.statusBeforeSuppression ?? null,
      avatar: value.avatar ?? creatorInitials,
      title,
      subtitle,
      timeframe: value.timeframe ?? '',
      inviter: value.inviter ?? null,
      unread: value.unread ?? 0,
      activity: Number.isFinite(Number(value.activity)) ? Number(value.activity) : 0,
      isAdmin: value.isAdmin ?? type === 'hosting',
      isInvitation: type === 'invitations',
      isHosting: type === 'hosting',
      isTrashed: value.isTrashed ?? false,
      published: value.published ?? true,
      trashedAtIso: value.trashedAtIso ?? null,
      creatorUserId: value.creatorUserId ?? this.activeUser.id,
      creatorName: value.creatorName ?? title,
      creatorInitials,
      creatorGender: value.creatorGender ?? 'man',
      creatorCity: value.creatorCity ?? '',
      visibility: value.visibility ?? 'Public',
      blindMode: value.blindMode ?? 'Open Event',
      startAtIso,
      endAtIso,
      distanceKm: Number.isFinite(Number(value.distanceKm)) ? Number(value.distanceKm) : 0,
      imageUrl: value.imageUrl ?? '',
      sourceLink: value.sourceLink ?? '',
      location: value.location ?? '',
      locationCoordinates: value.locationCoordinates ?? null,
      capacityMin: value.capacityMin ?? null,
      capacityMax: value.capacityMax ?? null,
      capacityTotal: value.capacityTotal ?? 0,
      autoInviter: value.autoInviter,
      frequency: value.frequency,
      ticketing: value.ticketing ?? false,
      pricing: value.pricing ?? null,
      policies: value.policies ? value.policies.map(policy => ({ ...policy })) : [],
      slotsEnabled: value.slotsEnabled,
      slotTemplates: value.slotTemplates ? value.slotTemplates.map(item => ({ ...item })) : undefined,
      parentEventId: value.parentEventId ?? null,
      slotTemplateId: value.slotTemplateId ?? null,
      generated: value.generated,
      eventType: value.eventType,
      nextSlot: value.nextSlot ? { ...value.nextSlot } : null,
      upcomingSlots: value.upcomingSlots ? value.upcomingSlots.map(item => ({ ...item })) : undefined,
      acceptedMembers: value.acceptedMembers ?? 0,
      pendingMembers: value.pendingMembers ?? 0,
      pendingReason: value.pendingReason ?? null,
      topics: [...(value.topics ?? [])],
      subEvents: value.subEvents
        ? value.subEvents.map(item => ({
          ...item,
          groups: [...(item.groups ?? [])]
        }))
        : undefined,
      subEventsDisplayMode: value.subEventsDisplayMode,
      rating: value.rating ?? 0,
      boost: value.boost ?? 0,
      affinity: value.affinity ?? 0
    };
  }

  private chatEventSubEvents(eventId: string): AppTypes.SubEventFormItem[] {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return [];
    }
    return this.sortSubEventsByStartAsc(this.cloneSubEvents(this.eventSubEventsById[normalizedEventId] ?? []));
  }

  private chatSubEventForItem(item: ChatRecord): AppTypes.SubEventFormItem | null {
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

  private getChatItemById(chatId: string): ChatRecord | undefined {
    this.syncChatLookupCache();
    return this.chatItemByIdCache.get(chatId);
  }

  private getChatMembersById(chatId: string): UserDto[] {
    this.syncChatLookupCache();
    const cachedMembers = this.chatMembersByIdCache.get(chatId);
    if (cachedMembers) {
      return cachedMembers;
    }

    const chatItem = this.getChatItemById(chatId);
    const explicitMembers = (chatItem?.memberIds ?? [])
      .map(memberId => this.userByIdCache.get(memberId))
      .filter((user): user is UserDto => Boolean(user));
    const lastSender = chatItem?.lastSenderId
      ? this.userByIdCache.get(chatItem.lastSenderId) ?? null
      : null;

    const orderedMembers: UserDto[] = [];
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
    const picked: UserDto[] = [];
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

  private explicitChatMemberCount(item: ChatRecord | null | undefined): number {
    const uniqueIds = new Set(
      (item?.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    );
    return uniqueIds.size;
  }

  public getChatLastSender(item: ChatRecord): UserDto {
    this.syncChatLookupCache();
    const cachedLastSender = this.chatLastSenderByIdCache.get(item.id);
    if (cachedLastSender) {
      return cachedLastSender;
    }
    const nextLastSender = this.userByIdCache.get(item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
    this.chatLastSenderByIdCache.set(item.id, nextLastSender);
    return nextLastSender;
  }

  public getChatMemberCount(item: ChatRecord): number {
    const explicitCount = this.explicitChatMemberCount(item);
    if (explicitCount > 0) {
      return explicitCount;
    }
    return this.getChatMembersById(item.id).length;
  }

  public openActivityChat(chat: ChatRecord): void {
    this.activitiesContext.openEventChat(chat);
  }

  public activityChatContextFilterKey(item: ChatRecord): AppTypes.ActivitiesChatContextFilter | null {
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

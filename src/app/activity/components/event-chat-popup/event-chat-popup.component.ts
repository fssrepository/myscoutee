import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { delay, from, of } from 'rxjs';

import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import type { EventChatResourceContext } from '../../../shared/core/base/models';
import { AppContext, AppPopupContext } from '../../../shared/core';
import type { ChatMenuItem, EventMenuItem } from '../../../shared/core/base/interfaces/activity-feed.interface';
import {
  CounterBadgePipe,
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';

interface ChatThreadFilters {
  revision?: number;
  sessionKey?: string;
}

@Component({
  selector: 'app-event-chat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, SmartListComponent, CounterBadgePipe],
  templateUrl: './event-chat-popup.component.html',
  styleUrl: './event-chat-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventChatPopupComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);

  protected readonly session = computed(() => this.activitiesContext.eventChatSession());
  protected chatInitialLoadPending = false;
  protected allMessages: AppTypes.ChatPopupMessage[] = [];
  protected draftMessage = '';
  protected showContextMenu = false;
  protected contextMenuOpenUp = false;
  protected chatHeaderProgress = 0;
  protected chatHeaderProgressLoading = false;
  protected chatHeaderLoadingProgress = 0;
  protected chatHeaderLoadingOverdue = false;
  protected preparedChatContext: AppTypes.EventChatContext | null = null;
  protected preparedChatMembersResource: EventChatResourceContext | null = null;
  protected preparedChatAssetResources: EventChatResourceContext[] = [];
  protected typingIndicators: AppTypes.ChatTypingIndicator[] = [];

  private readonly chatHistoryPageSize = 10;
  private readonly chatInitialLoadMessageCount = 15;
  private readonly chatHistoryPreloadOffsetPx = 48;
  private readonly chatLoadOlderDelayMs = resolveCurrentRouteDelayMs('/activities/chats', 1500);
  private readonly headerLoadingWindowMs = 3000;
  private readonly headerLoadingTickMs = 16;
  private readonly chatTypingIdleMs = 1800;
  private readonly chatTypingRemoteTtlMs = 3200;
  private readonly chatTransientFxMs = 1600;
  private chatThreadRevision = 0;
  protected chatThreadQuery: Partial<ListQuery<ChatThreadFilters>> = {};
  protected readonly chatThreadSmartListConfig: SmartListConfig<AppTypes.ChatPopupMessage, ChatThreadFilters> = {
    pageSize: this.chatHistoryPageSize,
    initialPageCount: 1,
    initialPageSize: this.chatInitialLoadMessageCount,
    preloadOffsetPx: this.chatHistoryPreloadOffsetPx,
    loadingDelayMs: resolveCurrentRouteDelayMs('/activities/chats'),
    showStickyHeader: false,
    showFirstGroupMarker: true,
    loadTriggerEdge: 'start',
    mergeStrategy: 'prepend',
    initialScrollAnchor: 'end',
    prependRestoreMode: 'manual',
    containerClass: 'chat-thread-list',
    groupMarkerClass: 'chat-thread-group-marker',
    headerProgress: {
      enabled: true,
      tone: 'chat'
    },
    emptyLabel: () => this.chatInitialLoadPending ? '' : 'No messages yet',
    emptyDescription: () => this.chatInitialLoadPending ? '' : 'Start the conversation.',
    emptyStickyLabel: '',
    trackBy: (_index, message) => message.id,
    groupBy: message => this.chatDayLabel(new Date(message.sentAtIso))
  };
  protected readonly chatThreadLoadPage: SmartListLoadPage<AppTypes.ChatPopupMessage, ChatThreadFilters> = (
    query: ListQuery<ChatThreadFilters>
  ) => {
    const sessionKey = `${query.filters?.sessionKey ?? ''}`.trim();
    if (query.page === 0 && sessionKey && this.initialChatLoadedSessionKey !== sessionKey) {
      return from(this.loadInitialChatThreadPage(query, sessionKey));
    }
    return of(this.chatThreadPageResult(query)).pipe(delay(query.page > 0 ? this.chatLoadOlderDelayMs : 0));
  };

  @ViewChild('chatThreadSmartList')
  private chatThreadSmartList?: SmartListComponent<AppTypes.ChatPopupMessage, ChatThreadFilters>;

  private loadedSessionKey: string | null = null;
  private initialChatLoadedSessionKey: string | null = null;
  private chatInitialLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private chatHeaderLoadingCounter = 0;
  private chatHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private chatHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private chatHeaderLoadingStartedAtMs = 0;
  private liveChatUnsubscribe: (() => void) | null = null;
  private typingIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private localTypingActive = false;
  private readonly latestVisibleReadMessageIdByReaderId: Record<string, string> = {};
  private readonly freshMessageIds = new Set<string>();
  private readonly freshReadKeys = new Set<string>();
  private readonly remoteTypingExpiryByUserId: Record<string, ReturnType<typeof setTimeout> | null> = {};

  constructor() {
    effect(() => {
      const session = this.session();
      const sessionKey = session ? `${session.item.id}:${session.openedAtIso}` : null;
      this.syncPreparedChatContext(session?.context ?? null);
      if (session && this.loadedSessionKey === sessionKey) {
        this.cdr.markForCheck();
        return;
      }
      this.teardownLiveChatUpdates();
      this.loadedSessionKey = sessionKey;
      this.initialChatLoadedSessionKey = null;
      this.draftMessage = '';
      this.showContextMenu = false;
      this.contextMenuOpenUp = false;
      this.allMessages = [];
      this.typingIndicators = [];
      this.localTypingActive = false;
      this.clearTypingIdleTimer();
      this.clearRemoteTypingIndicators();
      this.clearTransientMessageState();
      this.resetVisibleReadReceipts();
      this.chatThreadRevision = 0;
      this.syncChatThreadQuery();
      this.chatHeaderProgress = 0;
      this.cancelChatInitialLoadTimer();
      if (!session) {
        this.loadedSessionKey = null;
        this.chatThreadQuery = {};
        this.chatInitialLoadPending = false;
        this.syncPreparedChatContext(null);
        this.clearChatHeaderLoadingAnimation();
        this.cdr.markForCheck();
        return;
      }
      this.chatInitialLoadPending = true;
      // Warm event-editor service path while chat is active to reduce first-action flicker.
      this.eventEditorService.isOpen();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.stopLocalTyping();
    this.teardownLiveChatUpdates();
    this.cancelChatInitialLoadTimer();
    this.clearChatHeaderLoadingAnimation();
  }

  protected close(): void {
    this.showContextMenu = false;
    this.contextMenuOpenUp = false;
    this.stopLocalTyping();
    this.teardownLiveChatUpdates();
    this.cancelChatInitialLoadTimer();
    this.clearChatHeaderLoadingAnimation();
    this.loadedSessionKey = null;
    this.chatThreadQuery = {};
    this.activitiesContext.closeEventChat();
  }

  protected selectedChatHasSubEventMenu(): boolean {
    return this.preparedChatContext?.hasSubEventMenu === true;
  }

  protected selectedChatHeaderActionIcon(): string {
    return this.preparedChatContext?.actionIcon ?? 'event';
  }

  protected selectedChatHeaderActionLabel(): string {
    return this.preparedChatContext?.actionLabel ?? 'View Event';
  }

  protected selectedChatHeaderActionToneClass(): string {
    return this.preparedChatContext?.actionToneClass ?? 'popup-chat-context-btn-tone-main-event';
  }

  protected selectedChatHeaderActionBadgeCount(): number {
    return Math.max(0, Math.trunc(Number(this.preparedChatContext?.actionBadgeCount) || 0));
  }

  protected selectedChatContextMenuTitle(): string {
    return this.preparedChatContext?.menuTitle ?? this.session()?.item.title ?? 'Chat';
  }

  protected selectedChatMembersResource(): EventChatResourceContext | null {
    return this.preparedChatMembersResource;
  }

  protected selectedChatAssetResources(): EventChatResourceContext[] {
    return this.preparedChatAssetResources;
  }

  protected isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  protected openSelectedChatEvent(event?: Event): void {
    event?.stopPropagation();
    this.showContextMenu = false;
    const row = this.preparedChatContext?.eventRow ?? this.chatEventRow();
    if (!row) {
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: true
    });
  }

  protected openSelectedChatPrimaryContext(event?: Event): void {
    const channelType = this.preparedChatContext?.channelType;
    if (channelType === 'groupSubEvent') {
      this.openSelectedChatGroup(event);
      return;
    }
    if (channelType === 'optionalSubEvent') {
      this.openSelectedChatSubEvent(event);
      return;
    }
    this.openSelectedChatEvent(event);
  }

  protected openSelectedChatSubEvent(event?: Event): void {
    event?.stopPropagation();
    this.openSelectedChatEvent();
    this.eventEditorService.requestOpenSubEventsPopup();
  }

  protected openSelectedChatGroup(event?: Event): void {
    event?.stopPropagation();
    this.openSelectedChatSubEvent();
  }

  protected openSelectedChatSubEventResource(
    type: 'Members' | 'Car' | 'Accommodation' | 'Supplies',
    event?: Event
  ): void {
    event?.stopPropagation();
    const session = this.session();
    const context = session?.context;
    if (!session || !context?.subEvent) {
      return;
    }
    this.showContextMenu = false;
    this.popupCtx.requestActivitiesNavigation({
      type: 'chatResource',
      ownerId: context.eventRow?.id ?? session.item.eventId,
      item: session.item,
      resourceType: type,
      subEvent: context.subEvent,
      assetAssignmentIds: context.assetAssignmentIds,
      assetCardsByType: context.assetCardsByType,
      group: context.group
        ? {
            id: context.group.id,
            groupLabel: context.group.label
          }
        : null
      });
  }

  protected isSelectedChatContextMenuOpen(): boolean {
    return this.showContextMenu;
  }

  protected isSelectedChatContextMenuOpenUp(): boolean {
    return this.showContextMenu && this.contextMenuOpenUp;
  }

  protected toggleSelectedChatContextMenu(event: Event): void {
    event.stopPropagation();
    if (!this.selectedChatHasSubEventMenu()) {
      return;
    }
    if (this.showContextMenu) {
      this.showContextMenu = false;
      this.contextMenuOpenUp = false;
      return;
    }
    this.contextMenuOpenUp = this.shouldOpenContextMenuUp(event);
    this.showContextMenu = true;
  }

  protected closeContextMenu(event?: Event): void {
    event?.stopPropagation();
    this.showContextMenu = false;
    this.contextMenuOpenUp = false;
  }

  protected onChatThreadSmartListStateChange(
    state: SmartListStateChange<AppTypes.ChatPopupMessage, ChatThreadFilters>
  ): void {
    if (this.chatInitialLoadPending) {
      return;
    }
    this.chatHeaderProgress = state.scrollable
      ? state.progress
      : (state.items.length > 0 ? 1 : 0);
    this.chatHeaderProgressLoading = state.loading;
    this.chatHeaderLoadingProgress = state.loadingProgress;
    this.chatHeaderLoadingOverdue = state.loadingOverdue;
    this.cdr.markForCheck();
  }

  protected onDraftMessageChange(value: string): void {
    this.draftMessage = value;
    const session = this.session();
    if (!session || this.chatInitialLoadPending) {
      return;
    }
    const hasText = value.trim().length > 0;
    if (!hasText) {
      this.stopLocalTyping();
      return;
    }
    if (!this.localTypingActive) {
      this.localTypingActive = true;
      void this.activitiesContext.sendEventChatTyping(session.item, true);
    }
    this.clearTypingIdleTimer();
    this.typingIdleTimer = setTimeout(() => {
      this.stopLocalTyping();
    }, this.chatTypingIdleMs);
  }

  protected typingIndicatorLabel(): string {
    if (this.typingIndicators.length === 0) {
      return '';
    }
    if (this.typingIndicators.length === 1) {
      return `${this.typingIndicators[0].userName || this.typingIndicators[0].userInitials} is typing`;
    }
    return 'Several people are typing';
  }

  protected visibleReadBy(message: AppTypes.ChatPopupMessage): AppTypes.ChatReadAvatar[] {
    return (message.readBy ?? []).filter(reader => this.latestVisibleReadMessageIdByReaderId[reader.id] === message.id);
  }

  protected isFreshMessage(messageId: string): boolean {
    return this.freshMessageIds.has(messageId);
  }

  protected isFreshRead(messageId: string, readerId: string): boolean {
    return this.freshReadKeys.has(`${messageId}:${readerId}`);
  }

  protected sendMessage(): void {
    const text = this.draftMessage.trim();
    const session = this.session();
    if (!session || !text) {
      return;
    }
    const sessionKey = `${session.item.id}:${session.openedAtIso}`;
    this.draftMessage = '';
    this.stopLocalTyping();
    this.cdr.markForCheck();
    void this.activitiesContext.sendEventChatMessage(session.item, text)
      .then(message => {
        if (message) {
          this.mergeIncomingChatMessage(message);
        }
      })
      .catch(() => {
        if (this.loadedSessionKey !== sessionKey) {
          return;
        }
        this.draftMessage = text;
        this.cdr.markForCheck();
      });
  }

  private async loadInitialChatThreadPage(
    query: ListQuery<ChatThreadFilters>,
    sessionKey: string
  ): Promise<PageResult<AppTypes.ChatPopupMessage>> {
    const session = this.session();
    if (!session || this.loadedSessionKey !== sessionKey) {
      return this.chatThreadPageResult(query);
    }
    this.chatInitialLoadPending = true;
    this.cdr.markForCheck();
    try {
      const nextMessages = await this.activitiesContext.loadEventChatMessages(session.item);
      if (this.loadedSessionKey !== sessionKey) {
        return this.chatThreadPageResult(query);
      }
      this.allMessages = [...nextMessages]
        .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
      this.rebuildVisibleReadReceipts();
      this.initialChatLoadedSessionKey = sessionKey;
      await this.startLiveChatUpdates(session.item, sessionKey);
      return this.chatThreadPageResult(query);
    } catch {
      if (this.loadedSessionKey !== sessionKey) {
        return this.chatThreadPageResult(query);
      }
      this.allMessages = [];
      this.rebuildVisibleReadReceipts();
      this.initialChatLoadedSessionKey = sessionKey;
      await this.startLiveChatUpdates(session.item, sessionKey);
      return this.chatThreadPageResult(query);
    } finally {
      if (this.loadedSessionKey === sessionKey) {
        this.chatInitialLoadPending = false;
        this.cdr.markForCheck();
      }
    }
  }

  private chatThreadPageResult(query: ListQuery<ChatThreadFilters>): PageResult<AppTypes.ChatPopupMessage> {
    const total = this.allMessages.length;
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || this.chatHistoryPageSize));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    let start = 0;
    let end = total;

    if (page === 0) {
      start = Math.max(0, total - pageSize);
    } else {
      const initialBlockSize = Math.max(this.chatHistoryPageSize, this.chatInitialLoadMessageCount);
      end = Math.max(0, total - initialBlockSize - ((page - 1) * this.chatHistoryPageSize));
      start = Math.max(0, end - this.chatHistoryPageSize);
    }

    return {
      items: this.allMessages.slice(start, end),
      total
    };
  }

  private syncChatThreadQuery(): void {
    if (!this.loadedSessionKey) {
      this.chatThreadQuery = {};
      return;
    }
    this.chatThreadQuery = {
      filters: {
        revision: this.chatThreadRevision,
        sessionKey: this.loadedSessionKey
      }
    };
  }

  private async startLiveChatUpdates(chat: ChatMenuItem, sessionKey: string): Promise<void> {
    if (this.loadedSessionKey !== sessionKey || this.liveChatUnsubscribe) {
      return;
    }
    this.liveChatUnsubscribe = await this.activitiesContext.watchEventChatEvents(chat, event => {
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      this.handleLiveChatEvent(chat, event);
    });
  }

  private teardownLiveChatUpdates(): void {
    this.liveChatUnsubscribe?.();
    this.liveChatUnsubscribe = null;
    this.clearRemoteTypingIndicators();
  }

  private mergeIncomingChatMessage(message: AppTypes.ChatPopupMessage): void {
    if (this.allMessages.some(existingMessage => existingMessage.id === message.id)) {
      return;
    }
    this.flagFreshMessage(message.id);
    this.allMessages = [...this.allMessages, message]
      .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.chatThreadRevision += 1;
    this.syncChatThreadQuery();
    this.cdr.markForCheck();
  }

  private handleLiveChatEvent(chat: ChatMenuItem, event: AppTypes.ChatLiveEvent): void {
    if (event.type === 'typing') {
      this.applyTypingIndicator(event.typing);
      return;
    }
    if (event.type === 'read') {
      this.applyReadReceipt(event.read);
      return;
    }

    this.mergeIncomingChatMessage(event.message);
    if (!event.message.mine) {
      void this.activitiesContext.markEventChatRead(chat, [event.message.id]);
    }
  }

  private applyTypingIndicator(indicator: AppTypes.ChatTypingIndicator): void {
    const activeUserId = this.activeUserId();
    if (!indicator.userId || indicator.userId === activeUserId) {
      return;
    }
    const nextIndicators = this.typingIndicators.filter(item => item.userId !== indicator.userId);
    if (indicator.typing) {
      nextIndicators.push({ ...indicator });
      this.refreshRemoteTypingExpiry(indicator.userId);
    } else {
      this.clearRemoteTypingExpiry(indicator.userId);
    }
    this.typingIndicators = nextIndicators;
    this.cdr.markForCheck();
  }

  private applyReadReceipt(read: AppTypes.ChatReadReceipt): void {
    if (!read.userId || read.userId === this.activeUserId()) {
      return;
    }
    const loadedMessageIds = new Set(this.allMessages.map(message => message.id));
    const matchedMessageIds = (read.messageIds ?? []).filter(messageId => loadedMessageIds.has(messageId));
    if (matchedMessageIds.length === 0) {
      return;
    }

    let changed = false;
    this.allMessages = this.allMessages.map(message => {
      if (!message.mine || !matchedMessageIds.includes(message.id)) {
        return message;
      }
      if ((message.readBy ?? []).some(reader => reader.id === read.userId)) {
        return message;
      }
      changed = true;
      return {
        ...message,
        readBy: [
          ...(message.readBy ?? []),
          {
            id: read.userId,
            initials: read.userInitials,
            gender: read.userGender
          }
        ]
      };
    });

    if (!changed) {
      return;
    }
    this.rebuildVisibleReadReceipts();
    const lastVisibleMessageId = this.latestVisibleReadMessageIdByReaderId[read.userId];
    if (lastVisibleMessageId) {
      this.flagFreshRead(lastVisibleMessageId, read.userId);
    }
    this.cdr.markForCheck();
  }

  private rebuildVisibleReadReceipts(): void {
    for (const key of Object.keys(this.latestVisibleReadMessageIdByReaderId)) {
      delete this.latestVisibleReadMessageIdByReaderId[key];
    }
    for (const message of this.allMessages) {
      if (!message.mine) {
        continue;
      }
      for (const reader of message.readBy ?? []) {
        if (!reader.id) {
          continue;
        }
        this.latestVisibleReadMessageIdByReaderId[reader.id] = message.id;
      }
    }
  }

  private resetVisibleReadReceipts(): void {
    for (const key of Object.keys(this.latestVisibleReadMessageIdByReaderId)) {
      delete this.latestVisibleReadMessageIdByReaderId[key];
    }
  }

  private flagFreshMessage(messageId: string): void {
    if (!messageId) {
      return;
    }
    this.freshMessageIds.add(messageId);
    setTimeout(() => {
      this.freshMessageIds.delete(messageId);
      this.cdr.markForCheck();
    }, this.chatTransientFxMs);
  }

  private flagFreshRead(messageId: string, readerId: string): void {
    const key = `${messageId}:${readerId}`;
    this.freshReadKeys.add(key);
    setTimeout(() => {
      this.freshReadKeys.delete(key);
      this.cdr.markForCheck();
    }, this.chatTransientFxMs);
  }

  private clearTransientMessageState(): void {
    this.freshMessageIds.clear();
    this.freshReadKeys.clear();
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
  }

  private refreshRemoteTypingExpiry(userId: string): void {
    this.clearRemoteTypingExpiry(userId);
    this.remoteTypingExpiryByUserId[userId] = setTimeout(() => {
      this.typingIndicators = this.typingIndicators.filter(item => item.userId !== userId);
      this.remoteTypingExpiryByUserId[userId] = null;
      this.cdr.markForCheck();
    }, this.chatTypingRemoteTtlMs);
  }

  private clearRemoteTypingExpiry(userId: string): void {
    const existing = this.remoteTypingExpiryByUserId[userId];
    if (!existing) {
      return;
    }
    clearTimeout(existing);
    this.remoteTypingExpiryByUserId[userId] = null;
  }

  private clearRemoteTypingIndicators(): void {
    for (const [userId, timer] of Object.entries(this.remoteTypingExpiryByUserId)) {
      if (timer) {
        clearTimeout(timer);
      }
      this.remoteTypingExpiryByUserId[userId] = null;
    }
    this.typingIndicators = [];
  }

  private clearTypingIdleTimer(): void {
    if (!this.typingIdleTimer) {
      return;
    }
    clearTimeout(this.typingIdleTimer);
    this.typingIdleTimer = null;
  }

  private stopLocalTyping(): void {
    this.clearTypingIdleTimer();
    if (!this.localTypingActive) {
      return;
    }
    this.localTypingActive = false;
    const session = this.session();
    if (session) {
      void this.activitiesContext.sendEventChatTyping(session.item, false);
    }
  }

  private chatDayLabel(value: Date): string {
    if (Number.isNaN(value.getTime())) {
      return 'Unknown day';
    }
    const day = AppUtils.dateOnly(value);
    const current = AppUtils.dateOnly(new Date());
    if (AppUtils.toIsoDate(day) === AppUtils.toIsoDate(current)) {
      return 'Today';
    }
    const yesterday = AppUtils.addDays(current, -1);
    if (AppUtils.toIsoDate(day) === AppUtils.toIsoDate(yesterday)) {
      return 'Yesterday';
    }
    return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private syncPreparedChatContext(context: AppTypes.EventChatContext | null): void {
    this.preparedChatContext = context
      ? {
          ...context,
          group: context.group ? { ...context.group } : null,
          resources: context.resources.map(resource => ({ ...resource }))
        }
      : null;
    const resources = this.preparedChatContext?.resources.filter(resource => resource.visible) ?? [];
    this.preparedChatMembersResource = resources.find(resource => resource.type === 'Members') ?? null;
    this.preparedChatAssetResources = resources.filter(resource => resource.type !== 'Members');
  }

  private chatEventRow(): AppTypes.ActivityListRow | null {
    const session = this.session();
    if (!session?.item.eventId) {
      return null;
    }
    const eventId = session.item.eventId;
    const source: EventMenuItem = {
      id: eventId,
      avatar: AppUtils.initialsFromText(session.item.title),
      title: session.item.title,
      shortDescription: session.item.lastMessage || 'Chat-linked event',
      timeframe: 'From chat',
      activity: Math.max(0, session.item.unread),
      isAdmin: false
    };
    return {
      id: eventId,
      type: 'events',
      title: source.title,
      subtitle: source.shortDescription,
      detail: source.timeframe,
      dateIso: new Date().toISOString(),
      distanceKm: 0,
      unread: source.activity,
      metricScore: source.activity,
      source
    };
  }

  private shouldOpenContextMenuUp(event: Event): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    if (!trigger) {
      return false;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 248;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
  }

  private beginChatHeaderProgressLoading(): void {
    this.chatHeaderLoadingCounter += 1;
    if (this.chatHeaderLoadingCounter > 1) {
      return;
    }
    this.chatHeaderProgressLoading = true;
    this.chatHeaderLoadingOverdue = false;
    this.chatHeaderLoadingProgress = 0.02;
    this.chatHeaderLoadingStartedAtMs = performance.now();
    this.cdr.markForCheck();
    if (this.chatHeaderLoadingCompleteTimer) {
      clearTimeout(this.chatHeaderLoadingCompleteTimer);
      this.chatHeaderLoadingCompleteTimer = null;
    }
    if (this.chatHeaderLoadingInterval) {
      clearInterval(this.chatHeaderLoadingInterval);
      this.chatHeaderLoadingInterval = null;
    }
    this.updateChatHeaderLoadingWindow();
    this.chatHeaderLoadingInterval = this.ngZone.runOutsideAngular(() =>
      setInterval(() => {
        this.updateChatHeaderLoadingWindow();
        this.cdr.markForCheck();
      }, this.headerLoadingTickMs)
    );
  }

  private endChatHeaderProgressLoading(): void {
    if (this.chatHeaderLoadingCounter === 0) {
      return;
    }
    this.chatHeaderLoadingCounter = Math.max(0, this.chatHeaderLoadingCounter - 1);
    if (this.chatHeaderLoadingCounter !== 0) {
      return;
    }
    this.completeChatHeaderLoading();
  }

  private completeChatHeaderLoading(): void {
    if (this.chatHeaderLoadingInterval) {
      clearInterval(this.chatHeaderLoadingInterval);
      this.chatHeaderLoadingInterval = null;
    }
    this.chatHeaderLoadingProgress = 1;
    this.chatHeaderLoadingOverdue = false;
    this.cdr.markForCheck();
    if (this.chatHeaderLoadingCompleteTimer) {
      clearTimeout(this.chatHeaderLoadingCompleteTimer);
    }
    this.chatHeaderLoadingCompleteTimer = this.ngZone.runOutsideAngular(() =>
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.chatHeaderLoadingCounter !== 0) {
            return;
          }
          this.chatHeaderProgressLoading = false;
          this.chatHeaderLoadingProgress = 0;
          this.chatHeaderLoadingOverdue = false;
          this.chatHeaderLoadingStartedAtMs = 0;
          this.chatHeaderLoadingCompleteTimer = null;
          if (this.chatInitialLoadPending) {
            this.chatInitialLoadPending = false;
            this.chatHeaderProgress = this.allMessages.length > 0 ? 1 : 0;
          }
          this.cdr.markForCheck();
        });
      }, 100)
    );
  }

  private updateChatHeaderLoadingWindow(): void {
    if (!this.chatHeaderProgressLoading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.chatHeaderLoadingStartedAtMs);
    const nextProgress = AppUtils.clampNumber(elapsed / this.headerLoadingWindowMs, 0, 1);
    this.chatHeaderLoadingProgress = Math.max(this.chatHeaderLoadingProgress, nextProgress);
    this.chatHeaderLoadingOverdue = elapsed >= this.headerLoadingWindowMs && this.chatHeaderLoadingCounter > 0;
  }

  private clearChatHeaderLoadingAnimation(): void {
    if (this.chatHeaderLoadingInterval) {
      clearInterval(this.chatHeaderLoadingInterval);
      this.chatHeaderLoadingInterval = null;
    }
    if (this.chatHeaderLoadingCompleteTimer) {
      clearTimeout(this.chatHeaderLoadingCompleteTimer);
      this.chatHeaderLoadingCompleteTimer = null;
    }
    this.chatHeaderLoadingCounter = 0;
    this.chatHeaderLoadingProgress = 0;
    this.chatHeaderProgressLoading = false;
    this.chatHeaderLoadingOverdue = false;
    this.chatHeaderLoadingStartedAtMs = 0;
    this.cdr.markForCheck();
  }

  private cancelChatInitialLoadTimer(): void {
    if (!this.chatInitialLoadTimer) {
      return;
    }
    clearTimeout(this.chatInitialLoadTimer);
    this.chatInitialLoadTimer = null;
  }
}

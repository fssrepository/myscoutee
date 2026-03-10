import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
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

import type * as AppTypes from '../../../shared/app-types';
import { AppUtils } from '../../../shared/app-utils';
import { ActivitiesDbContextService } from '../../../shared/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import type { EventChatResourceContext } from '../../../shared/activities-models';
import type { EventMenuItem } from '../../../shared/demo-data';

@Component({
  selector: 'app-event-chat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './event-chat-popup.component.html',
  styleUrl: './event-chat-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventChatPopupComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly eventEditorService = inject(EventEditorService);

  @ViewChild('chatThread')
  private chatThreadRef?: ElementRef<HTMLDivElement>;

  protected readonly session = computed(() => this.activitiesContext.eventChatSession());
  protected get chatPopupMessages(): AppTypes.ChatPopupMessage[] {
    if (this.allMessages.length === 0) {
      return [];
    }
    const start = Math.max(0, this.allMessages.length - this.chatVisibleMessageCount);
    return this.allMessages.slice(start);
  }

  protected get groupedMessages(): AppTypes.ChatPopupDayGroup[] {
    return this.toDayGroups(this.chatPopupMessages);
  }

  protected chatInitialLoadPending = false;
  protected chatHistoryLoadingOlder = false;
  protected allMessages: AppTypes.ChatPopupMessage[] = [];
  protected draftMessage = '';
  protected showContextMenu = false;
  protected contextMenuOpenUp = false;
  protected chatHeaderProgress = 0;
  protected chatHeaderProgressLoading = false;
  protected chatHeaderLoadingProgress = 0;
  protected chatHeaderLoadingOverdue = false;

  private readonly chatHistoryPageSize = 10;
  private readonly chatInitialVisiblePageCount = 2;
  protected chatVisibleMessageCount = this.chatHistoryPageSize;
  private readonly chatLoadOlderDelayMs = 1000;
  private readonly headerLoadingWindowMs = 3000;
  private readonly headerLoadingTickMs = 16;

  private loadSequence = 0;
  private loadedSessionKey: string | null = null;
  private chatHistoryLoadOlderTimer: ReturnType<typeof setTimeout> | null = null;
  private chatInitialLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private chatHeaderLoadingCounter = 0;
  private chatHeaderLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private chatHeaderLoadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private chatHeaderLoadingStartedAtMs = 0;

  constructor() {
    effect(() => {
      const session = this.session();
      const sessionKey = session ? `${session.item.id}:${session.openedAtIso}` : null;
      if (session && this.loadedSessionKey === sessionKey) {
        this.cdr.markForCheck();
        return;
      }
      this.loadedSessionKey = sessionKey;
      this.loadSequence += 1;
      const sequence = this.loadSequence;
      this.draftMessage = '';
      this.showContextMenu = false;
      this.contextMenuOpenUp = false;
      this.allMessages = [];
      this.chatVisibleMessageCount = this.chatHistoryPageSize;
      this.chatHeaderProgress = 0;
      this.cancelChatHistoryLoadOlder();
      this.cancelChatInitialLoadTimer();
      if (!session) {
        this.loadedSessionKey = null;
        this.chatInitialLoadPending = false;
        this.clearChatHeaderLoadingAnimation();
        this.cdr.markForCheck();
        return;
      }
      this.chatInitialLoadPending = true;
      // Warm event-editor service path while chat is active to reduce first-action flicker.
      this.eventEditorService.isOpen();
      this.beginChatHeaderProgressLoading();
      const loadStartedAtMs = performance.now();
      this.cdr.markForCheck();
      void this.activitiesContext.loadEventChatMessages(session.item)
        .then(nextMessages => {
          if (sequence !== this.loadSequence) {
            return;
          }
          this.finishInitialChatLoad(
            sequence,
            [...nextMessages]
              .sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso)),
            loadStartedAtMs
          );
        })
        .catch(() => {
          if (sequence !== this.loadSequence) {
            return;
          }
          this.finishInitialChatLoad(sequence, [], loadStartedAtMs);
        });
    });
  }

  ngOnDestroy(): void {
    this.cancelChatHistoryLoadOlder();
    this.cancelChatInitialLoadTimer();
    this.clearChatHeaderLoadingAnimation();
  }

  protected close(): void {
    this.showContextMenu = false;
    this.contextMenuOpenUp = false;
    this.cancelChatHistoryLoadOlder();
    this.cancelChatInitialLoadTimer();
    this.clearChatHeaderLoadingAnimation();
    this.loadedSessionKey = null;
    this.activitiesContext.closeEventChat();
  }

  protected trackByDayGroup(_index: number, group: AppTypes.ChatPopupDayGroup): string {
    return group.key;
  }

  protected trackByMessage(_index: number, message: AppTypes.ChatPopupMessage): string {
    return message.id;
  }

  protected selectedChatHasSubEventMenu(): boolean {
    return this.session()?.context?.hasSubEventMenu === true;
  }

  protected selectedChatHeaderActionIcon(): string {
    return this.session()?.context?.actionIcon ?? 'event';
  }

  protected selectedChatHeaderActionLabel(): string {
    return this.session()?.context?.actionLabel ?? 'View Event';
  }

  protected selectedChatHeaderActionToneClass(): string {
    return this.session()?.context?.actionToneClass ?? 'popup-chat-context-btn-tone-main-event';
  }

  protected selectedChatHeaderActionBadgeCount(): number {
    return Math.max(0, Math.trunc(Number(this.session()?.context?.actionBadgeCount) || 0));
  }

  protected selectedChatContextMenuTitle(): string {
    return this.session()?.context?.menuTitle ?? this.session()?.item.title ?? 'Chat';
  }

  protected selectedChatResources(): EventChatResourceContext[] {
    const session = this.session();
    const resources = (session?.context?.resources ?? []).filter(resource => resource.visible);
    const subEvent = session?.context?.subEvent;
    if (!subEvent) {
      return resources;
    }
    return resources.map(resource => {
      if (resource.type === 'Members') {
        const accepted = this.chatCountValue(subEvent.membersAccepted);
        const pending = this.chatCountValue(subEvent.membersPending);
        const capacityMin = this.chatCountValue(subEvent.capacityMin);
        const capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.capacityMax));
        return {
          ...resource,
          summary: `${accepted} / ${capacityMin} - ${capacityMax}`,
          pending,
          stateClass: accepted >= capacityMin && accepted <= capacityMax
            ? 'subevent-capacity-in-range'
            : 'subevent-capacity-out-of-range'
        };
      }
      const accepted = this.chatSubEventAssetAcceptedCount(subEvent, resource.type);
      const pending = this.chatSubEventAssetPendingCount(subEvent, resource.type);
      const { capacityMin, capacityMax } = this.chatSubEventAssetCapacityBounds(subEvent, resource.type, accepted, pending);
      return {
        ...resource,
        summary: `${accepted} / ${capacityMin} - ${capacityMax}`,
        pending,
        stateClass: accepted >= capacityMin && accepted <= capacityMax
          ? 'subevent-capacity-in-range'
          : 'subevent-capacity-out-of-range'
      };
    });
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
    const row = this.session()?.context?.eventRow ?? this.chatEventRow();
    if (!row) {
      return;
    }
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditor',
      row,
      readOnly: true
    });
  }

  protected openSelectedChatSubEvent(event?: Event): void {
    event?.stopPropagation();
    this.openSelectedChatEvent();
    setTimeout(() => {
      if (typeof window === 'undefined') {
        return;
      }
      window.dispatchEvent(new CustomEvent('app:openSubEvents'));
    }, 60);
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
    this.activitiesContext.requestActivitiesNavigation({
      type: 'chatResource',
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

  protected hasMoreChatMessages(): boolean {
    return this.chatVisibleMessageCount < this.allMessages.length;
  }

  protected onChatThreadScroll(event: Event): void {
    const thread = event.target as HTMLElement | null;
    if (thread) {
      this.updateChatHeaderProgress(thread);
    }
    if (this.chatHistoryLoadingOlder || !this.hasMoreChatMessages()) {
      return;
    }
    if (!thread) {
      return;
    }
    if (thread.scrollTop > 48) {
      return;
    }
    const beforeHeight = thread.scrollHeight;
    const beforeTop = thread.scrollTop;
    const threadRect = thread.getBoundingClientRect();
    const anchorMessage =
      Array.from(thread.querySelectorAll<HTMLElement>('.chat-message[data-chat-message-id]'))
        .find(message => message.getBoundingClientRect().bottom > threadRect.top + 8) ?? null;
    const anchorMessageId = anchorMessage?.dataset['chatMessageId'] ?? null;
    const anchorOffsetTop = anchorMessage ? anchorMessage.getBoundingClientRect().top - threadRect.top : 0;
    this.chatHistoryLoadingOlder = true;
    this.beginChatHeaderProgressLoading();
    this.chatHistoryLoadOlderTimer = setTimeout(() => {
      this.chatHistoryLoadOlderTimer = null;
      this.chatVisibleMessageCount = Math.min(this.chatVisibleMessageCount + this.chatHistoryPageSize, this.allMessages.length);
      this.cdr.detectChanges();
      this.runAfterThreadRender(() => {
        if (anchorMessageId) {
          const restoredAnchor = thread.querySelector<HTMLElement>(`.chat-message[data-chat-message-id="${anchorMessageId}"]`);
          if (restoredAnchor) {
            const restoredThreadRect = thread.getBoundingClientRect();
            const restoredOffsetTop = restoredAnchor.getBoundingClientRect().top - restoredThreadRect.top;
            thread.scrollTop += restoredOffsetTop - anchorOffsetTop;
          } else {
            const afterHeight = thread.scrollHeight;
            thread.scrollTop = beforeTop + (afterHeight - beforeHeight);
          }
        } else {
          const afterHeight = thread.scrollHeight;
          thread.scrollTop = beforeTop + (afterHeight - beforeHeight);
        }
        this.triggerChatHistoryArrivalBump(thread).finally(() => {
          this.updateChatHeaderProgress(thread);
          this.chatHistoryLoadingOlder = false;
          this.endChatHeaderProgressLoading();
          this.cdr.markForCheck();
        });
      });
    }, this.chatLoadOlderDelayMs);
  }

  protected sendMessage(): void {
    const text = this.draftMessage.trim();
    const session = this.session();
    if (!session || !text) {
      return;
    }
    const sentAt = new Date();
    this.allMessages = [
      ...this.allMessages,
      {
        id: `${session.item.id}:${sentAt.getTime()}`,
        sender: 'You',
        senderAvatar: {
          id: 'self',
          initials: 'ME',
          gender: 'man'
        },
        text,
        time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        sentAtIso: AppUtils.toIsoDateTime(sentAt),
        mine: true,
        readBy: []
      }
    ];
    this.chatVisibleMessageCount = Math.max(this.chatVisibleMessageCount, this.chatHistoryPageSize);
    this.chatVisibleMessageCount = Math.min(this.chatVisibleMessageCount, this.allMessages.length);
    this.draftMessage = '';
    this.cdr.markForCheck();
    this.runAfterThreadRender(() => this.scrollThreadToBottom());
  }

  private toDayGroups(messages: readonly AppTypes.ChatPopupMessage[]): AppTypes.ChatPopupDayGroup[] {
    const groups: AppTypes.ChatPopupDayGroup[] = [];
    for (const message of messages) {
      const sentAt = new Date(message.sentAtIso);
      const dayKey = Number.isNaN(sentAt.getTime())
        ? 'unknown'
        : `${sentAt.getFullYear()}-${AppUtils.pad2(sentAt.getMonth() + 1)}-${AppUtils.pad2(sentAt.getDate())}`;
      const group = groups[groups.length - 1];
      if (!group || group.key !== dayKey) {
        groups.push({
          key: dayKey,
          label: this.chatDayLabel(sentAt),
          messages: [message]
        });
        continue;
      }
      group.messages.push(message);
    }
    return groups;
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

  private initialChatVisibleMessageCount(totalMessages: number): number {
    const chunkSize = this.chatHistoryPageSize * this.chatInitialVisiblePageCount;
    return Math.min(totalMessages, Math.max(this.chatHistoryPageSize, chunkSize));
  }

  private chatCountValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private chatSubEventAssetAcceptedCount(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType): number {
    if (type === 'Car') {
      return this.chatCountValue(subEvent.carsAccepted);
    }
    if (type === 'Accommodation') {
      return this.chatCountValue(subEvent.accommodationAccepted);
    }
    return this.chatCountValue(subEvent.suppliesAccepted);
  }

  private chatSubEventAssetPendingCount(subEvent: AppTypes.SubEventFormItem, type: AppTypes.AssetType): number {
    if (type === 'Car') {
      return this.chatCountValue(subEvent.carsPending);
    }
    if (type === 'Accommodation') {
      return this.chatCountValue(subEvent.accommodationPending);
    }
    return this.chatCountValue(subEvent.suppliesPending);
  }

  private chatSubEventAssetCapacityBounds(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    accepted: number,
    pending: number
  ): { capacityMin: number; capacityMax: number } {
    const observed = Math.max(accepted, accepted + pending);
    if (type === 'Car') {
      const capacityMin = this.chatCountValue(subEvent.carsCapacityMin);
      const capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.carsCapacityMax) || observed);
      return { capacityMin, capacityMax };
    }
    if (type === 'Accommodation') {
      const capacityMin = this.chatCountValue(subEvent.accommodationCapacityMin);
      const capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.accommodationCapacityMax) || observed);
      return { capacityMin, capacityMax };
    }
    const capacityMin = this.chatCountValue(subEvent.suppliesCapacityMin);
    const capacityMax = Math.max(capacityMin, this.chatCountValue(subEvent.suppliesCapacityMax) || observed);
    return { capacityMin, capacityMax };
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

  private runAfterThreadRender(task: () => void): void {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(task));
      return;
    }
    setTimeout(task, 0);
  }

  private triggerChatHistoryArrivalBump(thread: HTMLElement): Promise<void> {
    const firstMessage = this.firstVisibleChatMessage(thread) ?? thread.querySelector<HTMLElement>('.chat-message');
    const startTop = thread.scrollTop;
    const messageHeight = firstMessage?.offsetHeight ?? 68;
    const bumpDistance = Math.max(24, Math.round(messageHeight * 0.72));
    const bumpTop = Math.max(0, startTop - bumpDistance);
    if (bumpTop >= startTop - 0.5) {
      return Promise.resolve();
    }
    if (typeof thread.animate !== 'function' || typeof globalThis.requestAnimationFrame !== 'function') {
      thread.scrollTo({ top: bumpTop, behavior: 'smooth' });
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const durationMs = 240;
      const animation = thread.animate(
        [
          { transform: 'translateZ(0)' },
          { transform: 'translateZ(0)' }
        ],
        {
          duration: durationMs,
          easing: 'linear',
          fill: 'none'
        }
      );
      let done = false;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        thread.scrollTop = bumpTop;
        resolve();
      };
      const tick = () => {
        if (done) {
          return;
        }
        const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
        const progress = AppUtils.clampNumber(currentTime / durationMs, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        thread.scrollTop = startTop + (bumpTop - startTop) * eased;
        if (progress >= 1 || animation.playState === 'finished' || animation.playState === 'idle') {
          finish();
          return;
        }
        globalThis.requestAnimationFrame(tick);
      };
      animation.oncancel = finish;
      animation.onfinish = finish;
      globalThis.requestAnimationFrame(tick);
    });
  }

  private firstVisibleChatMessage(thread: HTMLElement): HTMLElement | null {
    const threadRect = thread.getBoundingClientRect();
    return (
      Array.from(thread.querySelectorAll<HTMLElement>('.chat-message[data-chat-message-id]'))
        .find(message => message.getBoundingClientRect().bottom > threadRect.top + 8) ?? null
    );
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
            this.scrollThreadToBottomAfterLoad();
          }
          this.cdr.markForCheck();
        });
      }, 100)
    );
  }

  private scrollThreadToBottomAfterLoad(): void {
    if (this.chatHeaderProgressLoading || !this.session()) {
      return;
    }
    const run = () => this.scrollThreadToBottom();
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
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

  private updateChatHeaderProgress(chatThread: HTMLElement): void {
    const maxVerticalScroll = Math.max(0, chatThread.scrollHeight - chatThread.clientHeight);
    if (maxVerticalScroll <= 0) {
      this.chatHeaderProgress = 1;
      return;
    }
    this.chatHeaderProgress = AppUtils.clampNumber(chatThread.scrollTop / maxVerticalScroll, 0, 1);
  }

  private cancelChatHistoryLoadOlder(): void {
    if (!this.chatHistoryLoadOlderTimer) {
      return;
    }
    clearTimeout(this.chatHistoryLoadOlderTimer);
    this.chatHistoryLoadOlderTimer = null;
    this.chatHistoryLoadingOlder = false;
  }

  private finishInitialChatLoad(
    sequence: number,
    messages: AppTypes.ChatPopupMessage[],
    loadStartedAtMs: number
  ): void {
    const elapsedMs = Math.max(0, performance.now() - loadStartedAtMs);
    const remainingMs = Math.max(0, this.chatLoadOlderDelayMs - elapsedMs);
    const commit = () => {
      this.chatInitialLoadTimer = null;
      if (sequence !== this.loadSequence) {
        return;
      }
      this.allMessages = [...messages];
      this.chatVisibleMessageCount = this.initialChatVisibleMessageCount(this.allMessages.length);
      this.endChatHeaderProgressLoading();
      this.cdr.markForCheck();
    };
    if (remainingMs <= 0) {
      commit();
      return;
    }
    this.chatInitialLoadTimer = setTimeout(() => {
      this.ngZone.run(() => commit());
    }, remainingMs);
  }

  private cancelChatInitialLoadTimer(): void {
    if (!this.chatInitialLoadTimer) {
      return;
    }
    clearTimeout(this.chatInitialLoadTimer);
    this.chatInitialLoadTimer = null;
  }

  private scrollThreadToBottom(): void {
    setTimeout(() => {
      const thread = this.chatThreadRef?.nativeElement;
      if (!thread) {
        return;
      }
      thread.scrollTop = thread.scrollHeight;
      this.updateChatHeaderProgress(thread);
      this.cdr.markForCheck();
    }, 0);
  }
}

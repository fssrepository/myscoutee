import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
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
  type SmartListLoadPage
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { HttpMediaService } from '../../../shared/core/http';

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
  protected readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly httpMediaService = inject(HttpMediaService);

  protected readonly session = computed(() => this.activitiesContext.eventChatSession());
  protected chatInitialLoadPending = false;
  protected allMessages: AppTypes.ChatPopupMessage[] = [];
  protected draftMessage = '';
  protected showContextMenu = false;
  protected contextMenuOpenUp = false;
  protected chatComposeDetachedSpace = 108;
  protected preparedChatContext: AppTypes.EventChatContext | null = null;
  protected preparedChatMembersResource: EventChatResourceContext | null = null;
  protected preparedChatAssetResources: EventChatResourceContext[] = [];
  protected typingIndicators: AppTypes.ChatTypingIndicator[] = [];
  protected composerMenuOpen = false;
  protected selectedMessageId = '';
  protected quickReactionMessageId = '';
  protected emojiPickerMessageId = '';
  protected emojiPickerQuery = '';
  protected emojiPickerCategory = 'smileys';
  protected messageActionMenuId = '';
  protected messageActionMenuOpenUp = false;
  protected reactionDetailsMessageId = '';
  protected reactionDetailsFilter = 'all';
  protected pinnedDialogOpen = false;
  protected replyTarget: AppTypes.ChatPopupMessage['replyTo'] = null;
  protected editingMessageId = '';
  protected highlightedMessageId = '';
  protected readonly quickReactionEmojis = ['❤️', '😆', '😮', '😢', '😡', '👍'];
  protected readonly emojiPickerCategories = [
    {
      key: 'smileys',
      label: 'Smileys & people',
      icon: 'sentiment_satisfied',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '🥹', '😂', '🤣', '🥲', '😊', '☺️', '😉',
        '😍', '🥰', '😘', '😗', '😋', '😛', '😝', '🤪', '🤨', '🧐', '😎', '🥳',
        '😟', '😢', '😭', '😤', '😡', '🤯', '👍', '👎', '👏', '🙌', '🙏', '💪'
      ]
    },
    { key: 'animals', label: 'Animals & nature', icon: 'pets', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐸', '🐵', '🌲', '🌵', '🌻', '🌙'] },
    { key: 'food', label: 'Food & drink', icon: 'restaurant', emojis: ['🍏', '🍎', '🍌', '🍓', '🍇', '🍉', '🍕', '🍔', '🍟', '🌮', '🍜', '🍣', '🍰', '☕', '🍺', '🍷', '🥂', '🍽️'] },
    { key: 'activity', label: 'Activities', icon: 'sports_soccer', emojis: ['⚽', '🏀', '🏈', '🎾', '🏐', '🎱', '🏓', '🎯', '🎮', '🎲', '🎸', '🎤', '🎬', '🎨', '🏆', '🎉', '✨', '🔥'] },
    { key: 'travel', label: 'Travel & places', icon: 'directions_car', emojis: ['🚗', '🚕', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚲', '✈️', '🚆', '🚢', '🏠', '🏙️', '⛰️', '🏖️', '🌍', '🧭', '📍'] },
    { key: 'objects', label: 'Objects', icon: 'lightbulb', emojis: ['💡', '📱', '💻', '⌚', '📷', '🎁', '🔑', '🔒', '📌', '📎', '✏️', '📅', '💬', '🔔', '❤️', '🧡', '💙', '💜'] },
    { key: 'symbols', label: 'Symbols', icon: 'shuffle', emojis: ['✅', '☑️', '❌', '⚠️', '❗', '❓', '➕', '➖', '➡️', '⬅️', '🔄', '🔁', '💯', '🔴', '🟢', '🔵', '⭐', '📌'] },
    { key: 'flags', label: 'Flags', icon: 'flag', emojis: ['🏳️', '🏴', '🏁', '🚩', '🇺🇸', '🇨🇦', '🇬🇧', '🇮🇪', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇭🇺', '🇸🇰', '🇨🇿', '🇵🇱', '🇺🇦', '🇪🇺'] }
  ];

  private readonly chatHistoryPageSize = 10;
  private readonly chatInitialLoadMessageCount = 15;
  private readonly chatHistoryPreloadOffsetPx = 48;
  private readonly chatLoadOlderDelayMs = resolveCurrentRouteDelayMs('/activities/chats', 1500);
  private readonly chatTypingIdleMs = 1800;
  private readonly chatTypingRemoteTtlMs = 3200;
  private readonly chatTransientFxMs = 1600;
  private readonly pendingMessageTimeoutMs = 7000;
  private readonly pendingMessageMatchWindowMs = 45000;
  private chatThreadRevision = 0;
  protected chatThreadQuery: Partial<ListQuery<ChatThreadFilters>> = {};
  protected readonly chatThreadSmartListConfig: SmartListConfig<AppTypes.ChatPopupMessage, ChatThreadFilters> = {
    pageSize: this.chatHistoryPageSize,
    mobilePageSizeCap: null,
    initialPageCount: 1,
    initialPageSize: this.chatInitialLoadMessageCount,
    preloadOffsetPx: this.chatHistoryPreloadOffsetPx,
    loadingDelayMs: resolveCurrentRouteDelayMs('/activities/chats'),
    showStickyHeader: false,
    showFirstGroupMarker: true,
    loadTriggerEdge: 'end',
    mergeStrategy: 'append',
    initialScrollAnchor: 'start',
    listLayout: 'thread',
    listFlow: 'reverse',
    containerClass: ['chat-thread-list', 'chat-thread-list--reverse'],
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

  @ViewChild('messageTextarea')
  private messageTextarea?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('imageAttachmentInput')
  private imageAttachmentInput?: ElementRef<HTMLInputElement>;

  @ViewChild('chatComposeBox')
  private set chatComposeBox(value: ElementRef<HTMLDivElement> | undefined) {
    this.chatComposeBoxRef = value;
    this.observeChatComposeBox();
  }

  private loadedSessionKey: string | null = null;
  private initialChatLoadedSessionKey: string | null = null;
  private chatComposeBoxRef?: ElementRef<HTMLDivElement>;
  private chatComposeResizeObserver: ResizeObserver | null = null;
  private liveChatUnsubscribe: (() => void) | null = null;
  private typingIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private localTypingActive = false;
  private visibleChatThreadTotal = 0;
  private readonly latestVisibleReadMessageIdByReaderId: Record<string, string> = {};
  protected readonly visibleReadReceiptsByMessageId: Record<string, AppTypes.ChatReadAvatar[]> = {};
  private readonly freshMessageIds = new Set<string>();
  private readonly freshReadKeys = new Set<string>();
  private readonly remoteTypingExpiryByUserId: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private readonly pendingMessageTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly reactionMutationSequenceByMessageId = new Map<string, number>();
  private messageLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private optimisticMessageSequence = 0;

  protected readonly trackByChatReader = (_index: number, reader: AppTypes.ChatReadAvatar): string => reader.id;

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
      this.closeTransientMessageUi();
      this.replyTarget = null;
      this.editingMessageId = '';
      this.showContextMenu = false;
      this.contextMenuOpenUp = false;
      this.allMessages = [];
      this.typingIndicators = [];
      this.localTypingActive = false;
      this.clearTypingIdleTimer();
      this.clearRemoteTypingIndicators();
      this.clearTransientMessageState();
      this.clearPendingMessageTimers();
      this.resetVisibleReadReceipts();
      this.chatThreadRevision = 0;
      this.visibleChatThreadTotal = 0;
      this.syncChatThreadQuery();
      if (!session) {
        this.loadedSessionKey = null;
        this.chatThreadQuery = {};
        this.chatInitialLoadPending = false;
        this.syncPreparedChatContext(null);
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
    this.clearChatComposeResizeObserver();
    this.clearMessageLongPress();
    this.stopLocalTyping();
    this.teardownLiveChatUpdates();
    this.clearPendingMessageTimers();
    this.visibleChatThreadTotal = 0;
  }

  protected close(): void {
    this.showContextMenu = false;
    this.contextMenuOpenUp = false;
    this.stopLocalTyping();
    this.teardownLiveChatUpdates();
    this.clearPendingMessageTimers();
    this.visibleChatThreadTotal = 0;
    this.loadedSessionKey = null;
    this.chatThreadQuery = {};
    this.closeTransientMessageUi();
    if (this.isBlockedSupportChat()) {
      this.activitiesContext.closeActivities();
      return;
    }
    this.activitiesContext.closeEventChat();
  }

  protected isBlockedSupportChat(): boolean {
    return this.session()?.item.id.startsWith('c-support-blocked-') === true;
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
    return window.matchMedia('(max-width: 760px)').matches;
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

  protected onDraftMessageChange(value: string): void {
    this.draftMessage = value;
    this.resizeComposerTextarea();
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

  protected isFreshMessage(messageId: string): boolean {
    return this.freshMessageIds.has(messageId);
  }

  protected isFreshRead(messageId: string, readerId: string): boolean {
    return this.freshReadKeys.has(`${messageId}:${readerId}`);
  }

  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || this.isMobileInputMode()) {
      return;
    }
    event.preventDefault();
    this.sendMessage();
  }

  protected resizeComposerTextarea(): void {
    const textarea = this.messageTextarea?.nativeElement;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    textarea.style.height = `${Math.min(textarea.scrollHeight, Math.round(lineHeight * 6))}px`;
  }

  protected toggleComposerMenu(event?: Event): void {
    event?.stopPropagation();
    this.composerMenuOpen = !this.composerMenuOpen;
  }

  protected openImageAttachmentPicker(event?: Event): void {
    event?.stopPropagation();
    this.composerMenuOpen = false;
    this.imageAttachmentInput?.nativeElement.click();
  }

  protected onImageAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (input) {
      input.value = '';
    }
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    void this.sendLocalImageAttachment(file);
  }

  protected selectMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.selectedMessageId = this.selectedMessageId === message.id ? '' : message.id;
    this.messageActionMenuId = '';
    this.quickReactionMessageId = '';
    this.emojiPickerMessageId = '';
  }

  protected startMessageLongPress(message: AppTypes.ChatPopupMessage): void {
    this.clearMessageLongPress();
    this.messageLongPressTimer = setTimeout(() => {
      this.selectedMessageId = message.id;
      this.quickReactionMessageId = message.id;
      this.cdr.markForCheck();
    }, 420);
  }

  protected clearMessageLongPress(): void {
    if (!this.messageLongPressTimer) {
      return;
    }
    clearTimeout(this.messageLongPressTimer);
    this.messageLongPressTimer = null;
  }

  protected toggleQuickReactions(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.selectedMessageId = message.id;
    this.messageActionMenuId = '';
    this.emojiPickerMessageId = '';
    this.quickReactionMessageId = this.quickReactionMessageId === message.id ? '' : message.id;
  }

  protected openEmojiPicker(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.selectedMessageId = message.id;
    this.quickReactionMessageId = '';
    this.messageActionMenuId = '';
    this.emojiPickerMessageId = message.id;
    this.emojiPickerQuery = '';
    this.emojiPickerCategory = 'smileys';
  }

  protected filteredEmojiPickerEmojis(): string[] {
    const query = this.emojiPickerQuery.trim().toLowerCase();
    const emojis = query
      ? this.emojiPickerCategories.flatMap(category => category.emojis)
      : (this.emojiPickerCategories.find(category => category.key === this.emojiPickerCategory)?.emojis ?? []);
    return query ? emojis.filter(emoji => emoji.includes(query)) : emojis;
  }

  protected activeEmojiPickerCategoryLabel(): string {
    return this.emojiPickerCategories.find(category => category.key === this.emojiPickerCategory)?.label ?? 'Smileys & people';
  }

  protected toggleReaction(message: AppTypes.ChatPopupMessage, emoji: string, event?: Event): void {
    event?.stopPropagation();
    const activeUserId = this.activeUserId() || 'self';
    const presentation = this.resolveOptimisticSenderPresentation(activeUserId);
    const withoutMine = (message.reactions ?? []).filter(reaction => reaction.userId !== activeUserId);
    const sameReaction = (message.reactions ?? []).some(reaction => reaction.userId === activeUserId && reaction.emoji === emoji);
    const reactionEmoji = sameReaction ? null : emoji;
    this.replaceExistingChatMessage({
      ...message,
      reactions: reactionEmoji ? [
        ...withoutMine,
        {
          emoji: reactionEmoji,
          userId: activeUserId,
          userName: presentation.sender,
          userInitials: presentation.senderAvatar.initials,
          userGender: presentation.senderAvatar.gender,
          reactedAtIso: new Date().toISOString()
        }
      ] : withoutMine
    });
    this.quickReactionMessageId = '';
    this.emojiPickerMessageId = '';
    this.cdr.markForCheck();
    const session = this.session();
    if (session) {
      const mutationSequence = (this.reactionMutationSequenceByMessageId.get(message.id) ?? 0) + 1;
      this.reactionMutationSequenceByMessageId.set(message.id, mutationSequence);
      void this.activitiesContext.updateEventChatMessage(session.item, message.id, { reactionEmoji })
        .then(updated => {
          if (updated && this.reactionMutationSequenceByMessageId.get(message.id) === mutationSequence) {
            this.replaceExistingChatMessage(updated);
          }
        });
    }
  }

  protected reactionSummary(message: AppTypes.ChatPopupMessage): Array<{ emoji: string; count: number }> {
    const counts = new Map<string, number>();
    for (const reaction of message.reactions ?? []) {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
  }

  protected openReactionDetails(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.reactionDetailsMessageId = message.id;
    this.reactionDetailsFilter = 'all';
  }

  protected closeReactionDetails(): void {
    this.reactionDetailsMessageId = '';
  }

  protected reactionDetailsMessage(): AppTypes.ChatPopupMessage | null {
    return this.allMessages.find(message => message.id === this.reactionDetailsMessageId) ?? null;
  }

  protected emojiPickerMessage(): AppTypes.ChatPopupMessage | null {
    return this.allMessages.find(message => message.id === this.emojiPickerMessageId) ?? null;
  }

  protected reactionDetailsRows(message: AppTypes.ChatPopupMessage): AppTypes.ChatMessageReaction[] {
    return this.reactionDetailsFilter === 'all'
      ? (message.reactions ?? [])
      : (message.reactions ?? []).filter(reaction => reaction.emoji === this.reactionDetailsFilter);
  }

  protected openMessageActionMenu(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedMessageId = message.id;
    this.quickReactionMessageId = '';
    this.emojiPickerMessageId = '';
    this.messageActionMenuOpenUp = this.shouldOpenMessageActionMenuUp(event);
    this.messageActionMenuId = this.messageActionMenuId === message.id ? '' : message.id;
  }

  protected setReplyTarget(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    if (message.deletedAtIso) {
      return;
    }
    this.replyTarget = {
      id: message.id,
      sender: message.mine ? 'yourself' : message.sender,
      text: this.replyReferenceText(message)
    };
    this.closeTransientMessageUi();
    this.focusComposerSoon();
  }

  protected replyPreviewText(replyTo: AppTypes.ChatPopupMessage['replyTo']): string {
    const text = `${replyTo?.text ?? ''}`.trim();
    return text === 'Sent an image' ? 'Image' : text || 'Message';
  }

  protected jumpToReplySource(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const targetId = `${message.replyTo?.id ?? ''}`.trim();
    if (!targetId) {
      return;
    }
    this.selectedMessageId = '';
    this.highlightedMessageId = targetId;
    this.messageActionMenuId = '';
    this.quickReactionMessageId = '';
    this.emojiPickerMessageId = '';
    this.cdr.markForCheck();
    this.scheduleChatThreadScrollToMessage(targetId);
    setTimeout(() => {
      if (this.highlightedMessageId === targetId) {
        this.highlightedMessageId = '';
        this.cdr.markForCheck();
      }
    }, 1200);
  }

  protected clearReplyTarget(): void {
    this.replyTarget = null;
  }

  protected beginEditMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    if (!message.mine || message.deletedAtIso) {
      return;
    }
    this.editingMessageId = message.id;
    this.draftMessage = message.text;
    this.closeTransientMessageUi({ keepEditing: true });
    this.focusComposerSoon();
    this.resizeComposerTextareaSoon();
  }

  protected cancelEditing(): void {
    this.editingMessageId = '';
    this.draftMessage = '';
    this.resizeComposerTextareaSoon();
  }

  protected unsendMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    if (!message.mine) {
      return;
    }
    this.replaceExistingChatMessage({
      ...message,
      text: '',
      deletedAtIso: new Date().toISOString(),
      deletedByUserId: this.activeUserId() || 'self',
      deletedByName: 'You',
      reactions: []
    });
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
    const session = this.session();
    if (session) {
      void this.activitiesContext.updateEventChatMessage(session.item, message.id, { deleted: true })
        .then(updated => {
          if (updated) {
            this.replaceExistingChatMessage(updated);
          }
        });
    }
  }

  protected deletedMessageLabel(message: AppTypes.ChatPopupMessage): string {
    return message.mine || message.deletedByName === 'You'
      ? 'You deleted this message'
      : `${message.deletedByName || message.sender} deleted this message`;
  }

  protected togglePinMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const activeUserId = this.activeUserId() || 'self';
    const pinned = !message.pinnedAtIso;
    this.replaceExistingChatMessage({
      ...message,
      pinnedAtIso: pinned ? new Date().toISOString() : null,
      pinnedByUserId: pinned ? activeUserId : null
    });
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
    const session = this.session();
    if (session) {
      void this.activitiesContext.updateEventChatMessage(session.item, message.id, { pinned })
        .then(updated => {
          if (updated) {
            this.replaceExistingChatMessage(updated);
          }
        });
    }
  }

  protected pinnedMessages(): AppTypes.ChatPopupMessage[] {
    return this.allMessages
      .filter(message => !!message.pinnedAtIso)
      .sort((first, second) => AppUtils.toSortableDate(second.pinnedAtIso ?? '') - AppUtils.toSortableDate(first.pinnedAtIso ?? ''));
  }

  protected openPinnedMessagesDialog(event?: Event): void {
    event?.stopPropagation();
    this.pinnedDialogOpen = true;
  }

  protected closePinnedMessagesDialog(): void {
    this.pinnedDialogOpen = false;
  }

  protected selectPinnedMessage(message: AppTypes.ChatPopupMessage): void {
    this.selectedMessageId = message.id;
    this.closePinnedMessagesDialog();
    this.scheduleChatThreadScrollToEnd();
  }

  protected reportMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.messageActionMenuId = '';
    this.confirmationDialogService.openInfo(`Report prepared for ${message.sender}.`, {
      title: 'Report message',
      confirmLabel: 'OK',
      confirmTone: 'danger'
    });
  }

  protected sendMessage(): void {
    const text = this.draftMessage.trim();
    const session = this.session();
    if (!session || !text) {
      return;
    }
    if (this.editingMessageId) {
      this.commitEditMessage(text);
      return;
    }
    const sessionKey = `${session.item.id}:${session.openedAtIso}`;
    const optimisticMessage = this.buildOptimisticChatMessage(text);
    this.draftMessage = '';
    this.replyTarget = null;
    this.resizeComposerTextareaSoon();
    this.stopLocalTyping();
    this.mergeIncomingChatMessage(optimisticMessage);
    this.schedulePendingMessageTimeout(optimisticMessage.id);
    this.cdr.markForCheck();
    void this.activitiesContext.sendEventChatMessageWithAttachments(session.item, text, [], optimisticMessage.clientId, optimisticMessage.replyTo)
      .then(message => {
        if (this.loadedSessionKey !== sessionKey) {
          return;
        }
        if (message) {
          this.confirmPendingChatMessage(optimisticMessage.id, message);
        }
      })
      .catch(() => {
        if (this.loadedSessionKey !== sessionKey) {
          return;
        }
        this.markPendingMessageTimedOut(optimisticMessage.id);
        this.cdr.markForCheck();
      });
  }

  private async sendLocalImageAttachment(file: File): Promise<void> {
    const session = this.session();
    if (!session || this.chatInitialLoadPending) {
      return;
    }
    const previewUrl = await this.readFileAsDataUrl(file);
    const sentAt = new Date();
    const activeUserId = this.activeUserId();
    const senderPresentation = this.resolveOptimisticSenderPresentation(activeUserId);
    const clientId = `pending:image:${activeUserId || 'self'}:${sentAt.getTime()}:${++this.optimisticMessageSequence}`;
    const attachmentId = `${clientId}:image`;
    const imageAttachment: AppTypes.ChatMessageAttachment = {
      id: attachmentId,
      type: 'image',
      title: file.name || 'Image',
      previewUrl,
      mimeType: file.type || null,
      sizeBytes: file.size
    };
    const imageMessage: AppTypes.ChatPopupMessage = {
      id: clientId,
      clientId,
      sender: senderPresentation.sender,
      senderAvatar: senderPresentation.senderAvatar,
      text: this.draftMessage.trim(),
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: sentAt.toISOString(),
      mine: true,
      readBy: [],
      deliveryState: 'pending',
      replyTo: this.replyTarget ? { ...this.replyTarget } : null,
      attachments: [{ ...imageAttachment }]
    };
    const caption = this.draftMessage.trim();
    const sessionKey = `${session.item.id}:${session.openedAtIso}`;
    this.draftMessage = '';
    this.replyTarget = null;
    this.resizeComposerTextareaSoon();
    this.stopLocalTyping();
    this.mergeIncomingChatMessage(imageMessage);
    this.schedulePendingMessageTimeout(imageMessage.id);
    this.cdr.markForCheck();
    try {
      const persistedAttachment = await this.resolvePersistableImageAttachment(session.item, imageAttachment, file);
      const persistedMessage = await this.activitiesContext.sendEventChatMessageWithAttachments(
        session.item,
        caption,
        [persistedAttachment],
        imageMessage.clientId,
        imageMessage.replyTo
      );
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      if (persistedMessage) {
        this.confirmPendingChatMessage(imageMessage.id, persistedMessage);
        return;
      }
      this.markPendingMessageTimedOut(imageMessage.id);
      this.cdr.markForCheck();
    } catch {
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      this.markPendingMessageTimedOut(imageMessage.id);
      this.cdr.markForCheck();
    }
  }

  private async resolvePersistableImageAttachment(
    chat: ChatMenuItem,
    attachment: AppTypes.ChatMessageAttachment,
    file: File
  ): Promise<AppTypes.ChatMessageAttachment> {
    if (this.activitiesContext.dataMode !== 'http') {
      return { ...attachment };
    }
    const upload = await this.httpMediaService.uploadImage(
      'chat',
      this.activeUserId() || 'chat',
      `${chat.id || 'chat'}-${Date.now()}`,
      file
    );
    if (!upload.uploaded || !upload.imageUrl) {
      throw new Error('Unable to upload chat image.');
    }
    return {
      ...attachment,
      url: upload.imageUrl,
      previewUrl: upload.imageUrl
    };
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(`${reader.result ?? ''}`);
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read image.'));
      reader.readAsDataURL(file);
    });
  }

  private commitEditMessage(text: string): void {
    const editingMessageId = this.editingMessageId;
    if (!editingMessageId) {
      return;
    }
    const session = this.session();
    this.allMessages = this.allMessages.map(message => message.id === editingMessageId
      ? {
          ...message,
          text,
          editedAtIso: new Date().toISOString(),
          deliveryState: 'pending'
        }
      : message);
    this.draftMessage = '';
    this.editingMessageId = '';
    this.resizeComposerTextareaSoon();
    this.refreshVisibleChatThreadSurface();
    this.cdr.markForCheck();
    if (session) {
      void this.activitiesContext.updateEventChatMessage(session.item, editingMessageId, { text })
        .then(updated => {
          if (updated) {
            this.replaceExistingChatMessage({ ...updated, deliveryState: undefined });
          }
        })
        .catch(() => {
          this.markPendingMessageTimedOut(editingMessageId);
        });
    }
    setTimeout(() => {
      this.allMessages = this.allMessages.map(message => message.id === editingMessageId
        ? { ...message, deliveryState: undefined }
        : message);
      this.refreshVisibleChatThreadSurface();
      this.cdr.markForCheck();
    }, 900);
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
    this.clearOpenChatUnreadState();
    this.cdr.markForCheck();
    try {
      const nextMessages = await this.activitiesContext.loadEventChatMessages(session.item);
      if (this.loadedSessionKey !== sessionKey) {
        return this.chatThreadPageResult(query);
      }
      this.allMessages = this.normalizeChatMessages(nextMessages)
        .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
      this.rebuildVisibleReadReceipts();
      this.syncEventChatSummaryFromLatestMessage();
      this.initialChatLoadedSessionKey = sessionKey;
      this.markLoadedChatThreadAsRead(session.item, this.allMessages);
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
    let end = 0;

    if (page === 0) {
      end = Math.min(total, pageSize);
    } else {
      const initialBlockSize = Math.max(this.chatHistoryPageSize, this.chatInitialLoadMessageCount);
      start = Math.min(total, initialBlockSize + ((page - 1) * this.chatHistoryPageSize));
      end = Math.min(total, start + this.chatHistoryPageSize);
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

  private buildOptimisticChatMessage(text: string): AppTypes.ChatPopupMessage {
    const sentAt = new Date();
    const activeUserId = this.activeUserId();
    const senderPresentation = this.resolveOptimisticSenderPresentation(activeUserId);
    const clientId = `pending:${activeUserId || 'self'}:${sentAt.getTime()}:${++this.optimisticMessageSequence}`;

    return {
      id: clientId,
      clientId,
      sender: senderPresentation.sender,
      senderAvatar: senderPresentation.senderAvatar,
      text,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: sentAt.toISOString(),
      mine: true,
      readBy: [],
      deliveryState: 'pending',
      replyTo: this.replyTarget
        ? { ...this.replyTarget }
        : null
    } satisfies AppTypes.ChatPopupMessage;
  }

  private confirmPendingChatMessage(pendingMessageId: string, message: AppTypes.ChatPopupMessage): void {
    if (this.replacePendingMessage(pendingMessageId, message, true)) {
      return;
    }
    this.mergeIncomingChatMessage(message);
  }

  private mergeIncomingChatMessage(message: AppTypes.ChatPopupMessage): void {
    const normalizedMessage = this.normalizeChatMessage(message);
    const shouldStickToEnd = normalizedMessage.mine || this.isChatThreadNearEnd();
    const matchedPendingId = this.matchPendingMessageId(normalizedMessage);
    if (matchedPendingId) {
      this.replacePendingMessage(matchedPendingId, normalizedMessage, shouldStickToEnd);
      return;
    }
    if (this.allMessages.some(existingMessage => existingMessage.id === normalizedMessage.id)) {
      this.replaceExistingChatMessage(normalizedMessage);
      return;
    }
    this.flagFreshMessage(normalizedMessage.id);
    this.allMessages = [...this.allMessages, normalizedMessage]
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(normalizedMessage);

    this.refreshVisibleChatThreadSurface();

    if (shouldStickToEnd) {
      this.scheduleChatThreadScrollToEnd();
    }

    this.cdr.markForCheck();
  }

  private replaceExistingChatMessage(message: AppTypes.ChatPopupMessage): void {
    const normalizedMessage = this.normalizeChatMessage(message);
    let changed = false;
    this.allMessages = this.allMessages.map(existingMessage => {
      if (existingMessage.id !== normalizedMessage.id) {
        return existingMessage;
      }
      changed = true;
      return normalizedMessage;
    });
    if (!changed) {
      this.allMessages = [...this.allMessages, normalizedMessage];
    }
    this.allMessages = this.allMessages
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(normalizedMessage);
    this.refreshVisibleChatThreadSurface();
    this.cdr.markForCheck();
  }

  private handleLiveChatEvent(chat: ChatMenuItem, event: AppTypes.ChatLiveEvent): void {
    if (event.type === 'reconnected') {
      this.clearRemoteTypingIndicators();
      void this.resyncChatThreadFromServer(chat);
      return;
    }
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
      this.clearOpenChatUnreadState();
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
    const matchedMessageIds = new Set((read.messageIds ?? []).filter(messageId => loadedMessageIds.has(messageId)));
    if (matchedMessageIds.size === 0) {
      return;
    }

    let changed = false;
    this.allMessages = this.allMessages.map(message => {
      if (!message.mine || !matchedMessageIds.has(message.id)) {
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
    for (const key of Object.keys(this.visibleReadReceiptsByMessageId)) {
      delete this.visibleReadReceiptsByMessageId[key];
    }
    for (let index = this.allMessages.length - 1; index >= 0; index -= 1) {
      const message = this.allMessages[index];
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
    for (const message of this.allMessages) {
      if (!message.mine || (message.readBy?.length ?? 0) === 0) {
        continue;
      }
      const visibleReaders = (message.readBy ?? []).filter(reader => this.latestVisibleReadMessageIdByReaderId[reader.id] === message.id);
      if (visibleReaders.length > 0) {
        this.visibleReadReceiptsByMessageId[message.id] = visibleReaders;
      }
    }
  }

  private resetVisibleReadReceipts(): void {
    for (const key of Object.keys(this.latestVisibleReadMessageIdByReaderId)) {
      delete this.latestVisibleReadMessageIdByReaderId[key];
    }
    for (const key of Object.keys(this.visibleReadReceiptsByMessageId)) {
      delete this.visibleReadReceiptsByMessageId[key];
    }
  }

  private matchPendingMessageId(message: AppTypes.ChatPopupMessage): string | null {
    if (!message.mine) {
      return null;
    }
    const normalizedClientId = `${message.clientId ?? ''}`.trim();
    if (normalizedClientId) {
      const exactPendingMatch = this.allMessages.find(pendingMessage =>
        pendingMessage.mine
        && (pendingMessage.deliveryState === 'pending' || pendingMessage.deliveryState === 'timed-out')
        && `${pendingMessage.clientId ?? ''}`.trim() === normalizedClientId
      );
      if (exactPendingMatch) {
        return exactPendingMatch.id;
      }
    }
    let matchedId: string | null = null;
    let matchedDiff = Number.POSITIVE_INFINITY;
    const messageSentAtMs = AppUtils.toSortableDate(message.sentAtIso);

    for (const pendingMessage of this.allMessages) {
      if (
        !pendingMessage.mine
        || (pendingMessage.deliveryState !== 'pending' && pendingMessage.deliveryState !== 'timed-out')
        || pendingMessage.text !== message.text
      ) {
        continue;
      }
      const diffMs = Math.abs(AppUtils.toSortableDate(pendingMessage.sentAtIso) - messageSentAtMs);
      if (diffMs > this.pendingMessageMatchWindowMs || diffMs >= matchedDiff) {
        continue;
      }
      matchedId = pendingMessage.id;
      matchedDiff = diffMs;
    }

    return matchedId;
  }

  private replacePendingMessage(
    pendingMessageId: string,
    message: AppTypes.ChatPopupMessage,
    stickToEnd: boolean
  ): boolean {
    const pendingIndex = this.allMessages.findIndex(existingMessage => existingMessage.id === pendingMessageId);
    if (pendingIndex < 0) {
      return false;
    }

    this.clearPendingMessageTimeout(pendingMessageId);
    const pendingMessage = this.allMessages[pendingIndex];
    const pendingClientId = pendingMessage?.clientId;
    const resolvedMessage = this.normalizeChatMessage(message);
    const normalizedMessage = resolvedMessage.mine
      ? {
          ...resolvedMessage,
          sender: pendingMessage?.sender ?? resolvedMessage.sender,
          senderAvatar: pendingMessage?.senderAvatar ?? resolvedMessage.senderAvatar
        }
      : resolvedMessage;
    const nextMessage: AppTypes.ChatPopupMessage = {
      ...normalizedMessage,
      id: `${normalizedMessage.id ?? ''}`.trim() || pendingMessageId,
      clientId: pendingClientId || normalizedMessage.clientId
    };
    let nextMessages = [...this.allMessages];
    if (nextMessages.some((existingMessage, index) => index !== pendingIndex && existingMessage.id === nextMessage.id)) {
      nextMessages = nextMessages.filter((_existingMessage, index) => index !== pendingIndex);
    } else {
      nextMessages[pendingIndex] = nextMessage;
    }

    this.allMessages = nextMessages
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(nextMessage);

    this.refreshVisibleChatThreadSurface();

    if (stickToEnd) {
      this.scheduleChatThreadScrollToEnd();
    }

    this.cdr.markForCheck();
    return true;
  }

  private async resyncChatThreadFromServer(chat: ChatMenuItem): Promise<void> {
    const sessionKey = this.loadedSessionKey;
    if (!sessionKey) {
      return;
    }
    const shouldStickToEnd = this.isChatThreadNearEnd();

    try {
      const snapshot = await this.activitiesContext.loadEventChatMessages(chat);
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      
      // FIX: Instead of replacing everything, we merge and sort
      // This preserves the "history" the user has already loaded in the UI
      const mergedMessages = this.mergeServerSnapshotWithPendingMessages(snapshot);
    
      this.allMessages = mergedMessages
        .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));

      this.rebuildVisibleReadReceipts();
      this.syncEventChatSummaryFromLatestMessage();

      if (shouldStickToEnd) {
        this.scheduleChatThreadScrollToEnd();
      }

      this.refreshVisibleChatThreadSurface();
      this.cdr.markForCheck();
    } catch {
      // Keep the current optimistic/live state if the reconnect snapshot fails.
    }
  }

  private mergeServerSnapshotWithPendingMessages(
    snapshot: readonly AppTypes.ChatPopupMessage[]
  ): AppTypes.ChatPopupMessage[] {
    const matchedPendingIds = new Set<string>();
    const snapshotMessages = snapshot.map(message => {
      const pendingId = this.matchPendingMessageId(message);
      if (!pendingId) {
        return message;
      }
      matchedPendingIds.add(pendingId);
      this.clearPendingMessageTimeout(pendingId);
      const pendingMessage = this.allMessages.find(existingMessage => existingMessage.id === pendingId);
      return this.normalizeChatMessage({
        ...message,
        clientId: pendingMessage?.clientId
      });
    });
    const unresolvedPendingMessages = this.allMessages.filter(message =>
      (message.deliveryState === 'pending' || message.deliveryState === 'timed-out')
      && !matchedPendingIds.has(message.id)
    );

    return [...this.normalizeChatMessages(snapshotMessages), ...unresolvedPendingMessages];
  }

  private schedulePendingMessageTimeout(messageId: string): void {
    this.clearPendingMessageTimeout(messageId);
    this.pendingMessageTimeouts.set(messageId, setTimeout(() => {
      this.pendingMessageTimeouts.delete(messageId);
      this.markPendingMessageTimedOut(messageId);
    }, this.pendingMessageTimeoutMs));
  }

  private clearPendingMessageTimeout(messageId: string): void {
    const timer = this.pendingMessageTimeouts.get(messageId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.pendingMessageTimeouts.delete(messageId);
  }

  private clearPendingMessageTimers(): void {
    for (const timer of this.pendingMessageTimeouts.values()) {
      clearTimeout(timer);
    }
    this.pendingMessageTimeouts.clear();
  }

  private markPendingMessageTimedOut(messageId: string): void {
    const pendingIndex = this.allMessages.findIndex(message => message.id === messageId && message.deliveryState === 'pending');
    if (pendingIndex < 0) {
      return;
    }
    const nextMessages = [...this.allMessages];
    nextMessages[pendingIndex] = {
      ...nextMessages[pendingIndex],
      deliveryState: 'timed-out'
    };
    this.allMessages = nextMessages;
    
    this.refreshVisibleChatThreadSurface();

    this.cdr.markForCheck();
  }

  private refreshVisibleChatThreadSurface(): void {
    const previousTotal = this.visibleChatThreadTotal;
    this.visibleChatThreadTotal = this.allMessages.length;
    const smartList = this.chatThreadSmartList;
    const visibleCount = smartList?.itemsSnapshot().length ?? 0;
    if (!smartList) {
      this.chatThreadRevision++;
      this.syncChatThreadQuery();
      return;
    }
    const addedCount = Math.max(0, this.allMessages.length - previousTotal);
    const nextVisibleCount = visibleCount > 0
      ? Math.min(this.allMessages.length, visibleCount + addedCount)
      : Math.min(this.allMessages.length, this.chatInitialLoadMessageCount);
    if (nextVisibleCount === 0) {
      smartList.replaceVisibleItems([], { total: 0 });
      return;
    }
    smartList.replaceVisibleItems(
      this.allMessages.slice(0, Math.min(this.allMessages.length, nextVisibleCount)),
      { total: this.allMessages.length }
    );
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

  private clearOpenChatUnreadState(): void {
    const session = this.session();
    if (!session || Math.max(0, Math.trunc(Number(session.item.unread) || 0)) === 0) {
      return;
    }
    this.activitiesContext.patchEventChatSessionItem(item => ({
      ...item,
      unread: 0
    }));
  }

  private markLoadedChatThreadAsRead(
    chat: ChatMenuItem,
    messages: readonly AppTypes.ChatPopupMessage[]
  ): void {
    const activeUserId = this.activeUserId();
    const unreadMessageIds = messages
      .filter(message =>
        !message.mine
        && `${message.id ?? ''}`.trim().length > 0
        && !(message.readBy ?? []).some(reader => `${reader.id ?? ''}`.trim() === activeUserId)
      )
      .map(message => `${message.id ?? ''}`.trim());

    if (unreadMessageIds.length === 0) {
      return;
    }
    void this.activitiesContext.markEventChatRead(chat, unreadMessageIds);
  }

  private syncEventChatSummaryFromLatestMessage(): void {
    const latestMessage = this.allMessages[0];
    if (!latestMessage) {
      return;
    }
    this.syncEventChatSummaryFromMessage(latestMessage);
  }

  private syncEventChatSummaryFromMessage(message: AppTypes.ChatPopupMessage): void {
    const session = this.session();
    if (!session) {
      return;
    }
    const nextLastMessage = `${message.text ?? ''}`.trim() || this.chatAttachmentSummary(message);
    const nextDateIso = `${message.sentAtIso ?? ''}`.trim();
    const nextLastSenderId = this.resolveChatMessageSenderId(message, session.item.lastSenderId);
    if (!nextLastMessage && !nextDateIso && !nextLastSenderId) {
      return;
    }
    this.activitiesContext.patchEventChatSessionItem(item => ({
      ...item,
      lastMessage: nextLastMessage || item.lastMessage,
      lastSenderId: nextLastSenderId || item.lastSenderId,
      dateIso: nextDateIso || item.dateIso
    }));
  }

  private resolveChatMessageSenderId(
    message: AppTypes.ChatPopupMessage,
    fallbackSenderId: string
  ): string {
    if (message.mine) {
      return this.activeUserId() || fallbackSenderId;
    }
    const senderId = `${message.senderAvatar?.id ?? ''}`.trim();
    return senderId || fallbackSenderId;
  }

  private normalizeChatMessages(
    messages: readonly AppTypes.ChatPopupMessage[]
  ): AppTypes.ChatPopupMessage[] {
    return messages.map(message => this.normalizeChatMessage(message));
  }

  private normalizeChatMessage(message: AppTypes.ChatPopupMessage): AppTypes.ChatPopupMessage {
    if (!message.mine) {
      return message;
    }
    const senderPresentation = this.resolveOptimisticSenderPresentation(message.senderAvatar?.id || this.activeUserId());
    return {
      ...message,
      sender: senderPresentation.sender,
      senderAvatar: senderPresentation.senderAvatar
    };
  }

  private chatAttachmentSummary(message: AppTypes.ChatPopupMessage): string {
    const firstAttachment = message.attachments?.[0];
    if (!firstAttachment) {
      return '';
    }
    switch (firstAttachment.type) {
      case 'image':
        return 'Sent an image';
      case 'event':
        return 'Shared an event';
      case 'asset':
        return 'Shared an asset';
      case 'poll':
        return 'Created a poll';
      case 'voice':
        return 'Sent a voice clip';
      default:
        return firstAttachment.title || 'Shared a link';
    }
  }

  private resolveOptimisticSenderPresentation(
    activeUserId: string
  ): Pick<AppTypes.ChatPopupMessage, 'sender' | 'senderAvatar'> {
    const activeUser = this.appCtx.activeUserProfile() ?? (activeUserId ? this.appCtx.getUserProfile(activeUserId) : null);
    const initials = activeUser?.initials?.trim()
      || AppUtils.initialsFromText(activeUser?.name ?? 'Me');
    return {
      sender: 'You',
      senderAvatar: {
        id: activeUser?.id?.trim() || activeUserId || 'self',
        initials: initials || 'ME',
        gender: activeUser?.gender ?? 'man'
      }
    };
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

  private closeTransientMessageUi(options: { keepEditing?: boolean } = {}): void {
    this.composerMenuOpen = false;
    this.selectedMessageId = '';
    this.quickReactionMessageId = '';
    this.emojiPickerMessageId = '';
    this.emojiPickerQuery = '';
    this.messageActionMenuId = '';
    this.reactionDetailsMessageId = '';
    if (!options.keepEditing) {
      this.editingMessageId = '';
    }
  }

  private isMobileInputMode(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(hover: none), (pointer: coarse), (max-width: 760px)').matches;
  }

  private focusComposerSoon(): void {
    setTimeout(() => {
      this.messageTextarea?.nativeElement.focus();
    }, 0);
  }

  private resizeComposerTextareaSoon(): void {
    setTimeout(() => this.resizeComposerTextarea(), 0);
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
    return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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

  private shouldOpenMessageActionMenuUp(event?: Event): boolean {
    const target = event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event?.target instanceof HTMLElement
        ? event.target
        : null;
    const scrollElement = this.chatThreadSmartList?.scrollElement();
    if (!target || !scrollElement) {
      return false;
    }
    const targetRect = target.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    return (scrollRect.bottom - targetRect.bottom) < 180 && (targetRect.top - scrollRect.top) > 160;
  }

  private isChatThreadNearEnd(): boolean {
    const scrollElement = this.chatThreadSmartList?.scrollElement();
    if (!scrollElement) {
      return true;
    }
    return Math.abs(scrollElement.scrollTop) <= 72;
  }

  private scheduleChatThreadScrollToEnd(): void {
    const run = () => {
      const scrollElement = this.chatThreadSmartList?.scrollElement();
      if (!scrollElement) {
        return;
      }
      scrollElement.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private scheduleChatThreadScrollToMessage(messageId: string): void {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedMessageId) {
      return;
    }
    const run = () => {
      const scrollElement = this.chatThreadSmartList?.scrollElement();
      const target = scrollElement?.querySelector<HTMLElement>(`[data-chat-message-id="${CSS.escape(normalizedMessageId)}"]`);
      if (!target) {
        return;
      }
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth'
      });
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
      return;
    }
    setTimeout(run, 0);
  }

  private replyReferenceText(message: AppTypes.ChatPopupMessage): string {
    if (message.text?.trim()) {
      return message.text.trim();
    }
    const firstAttachment = message.attachments?.[0];
    if (firstAttachment?.type === 'image') {
      return 'Image';
    }
    return this.chatAttachmentSummary(message) || 'Message';
  }

  private observeChatComposeBox(): void {
    this.clearChatComposeResizeObserver();
    this.syncChatComposeDetachedSpace();
    const composeElement = this.chatComposeBoxRef?.nativeElement;
    if (!composeElement || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.chatComposeResizeObserver = new ResizeObserver(() => {
      this.syncChatComposeDetachedSpace();
    });
    this.chatComposeResizeObserver.observe(composeElement);
  }

  private clearChatComposeResizeObserver(): void {
    this.chatComposeResizeObserver?.disconnect();
    this.chatComposeResizeObserver = null;
  }

  private syncChatComposeDetachedSpace(): void {
    const composeElement = this.chatComposeBoxRef?.nativeElement;
    const measuredHeight = composeElement?.getBoundingClientRect().height ?? 0;
    const nextSpace = Math.max(72, Math.ceil(measuredHeight + 16));
    if (nextSpace === this.chatComposeDetachedSpace) {
      return;
    }
    this.chatComposeDetachedSpace = nextSpace;
    this.cdr.markForCheck();
  }
}

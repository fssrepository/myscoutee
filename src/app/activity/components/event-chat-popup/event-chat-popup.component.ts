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
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { delay, from, of } from 'rxjs';

import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import { ActivitiesPopupStateService } from '../../services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../services/event-editor-popup-state.service';
import { ActivitiesService, ActivityResourceBuilder, ActivityResourcesService, AppContext, AppPopupContext, ChatsService, EventsService, ShareTokensService } from '../../../shared/core';
import { AppMemoryDb } from '../../../shared/core/base';
import type { ChatRecord } from '../../../shared/core/base/models/chat.model';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
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
import { NavigatorService } from '../../../navigator';

interface ChatThreadFilters {
  revision?: number;
  sessionKey?: string;
}

interface StoredVoiceClip {
  dataUrl: string;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
}

interface ChatPollOptionState {
  id: string;
  text: string;
  votes: Array<{
    userId: string;
    name?: string;
    initials: string;
    gender: AppTypes.ChatUserGender;
  }>;
}

interface ChatPollState {
  question: string;
  options: ChatPollOptionState[];
}

interface ChatTextSegment {
  id: string;
  text: string;
  url?: string;
}

type SelectedChatActionTone =
  | 'popup-chat-context-btn-tone-main-event'
  | 'popup-chat-context-btn-tone-optional'
  | 'popup-chat-context-btn-tone-group';

type SelectedChatResourceType = 'Members' | AppTypes.AssetType;

interface SelectedChatGroupState {
  id: string;
  label: string;
}

interface SelectedChatNavigationState {
  channelType: AppTypes.ChatChannelType;
  eventRow: AppTypes.ActivityListRow | null;
  subEvent: AppTypes.SubEventFormItem | null;
  group: SelectedChatGroupState | null;
  assetAssignmentIds: AppTypes.SubEventAssetAssignmentIds;
  assetCardsByType: AppTypes.SubEventAssetCardsByType;
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
  private readonly chatsService = inject(ChatsService);
  private readonly activitiesService = inject(ActivitiesService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly eventsService = inject(EventsService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly httpMediaService = inject(HttpMediaService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly location = inject(Location);
  private readonly memoryDb = inject(AppMemoryDb);

  protected readonly session = computed(() => this.activitiesContext.eventChatSession());
  protected chatInitialLoadPending = false;
  protected allMessages: AppTypes.ChatPopupMessage[] = [];
  protected draftMessage = '';
  protected showContextMenu = false;
  protected contextMenuOpenUp = false;
  protected chatComposeDetachedSpace = 108;
  protected chatHeaderContext: AppTypes.PopupHeaderContext | null = null;
  private selectedChatNavigationState: SelectedChatNavigationState | null = null;
  private resolvedChatEventRecord: DemoEventRecord | null = null;
  private resolvedChatEventRecordKey = '';
  private resolvedChatResourceState: AppTypes.ActivitySubEventResourceState | null = null;
  private resolvedChatResourceStateKey = '';
  protected typingIndicators: AppTypes.ChatTypingIndicator[] = [];
  protected composerMenuOpen = false;
  protected voiceComposerOpen = false;
  protected voiceRecordingState: 'idle' | 'recording' | 'recorded' | 'saving' = 'idle';
  protected voiceRecorderSeconds = 0;
  protected voiceRecorderError = '';
  protected voiceClipDataUrl = '';
  protected voiceClipMimeType = '';
  protected voiceClipSizeBytes = 0;
  protected voiceAttachmentSrcByKey: Record<string, string> = {};
  protected pollComposerOpen = false;
  protected pollQuestionDraft = '';
  protected pollOptionDrafts = ['', ''];
  protected selectedPollOptionByMessageId: Record<string, string> = {};
  protected pollVoteMessageId = '';
  protected pollVoteAttachmentId = '';
  protected selectedMessageId = '';
  protected selectedMessageToolsDown = false;
  protected quickReactionMessageId = '';
  protected quickReactionOpenDown = false;
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
  private readonly pendingMessageTimeoutMs = 3000;
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
  private readonly loadingVoiceClipKeys = new Set<string>();
  private readonly reactionMutationSequenceByMessageId = new Map<string, number>();
  private readonly pollVoteMutationSequenceByMessageId = new Map<string, number>();
  private readonly queuedReactionByPendingMessageId = new Map<string, string | null>();
  private voiceRecorder: MediaRecorder | null = null;
  private voiceRecorderStream: MediaStream | null = null;
  private voiceRecorderChunks: BlobPart[] = [];
  private voiceRecorderTimer: ReturnType<typeof setInterval> | null = null;
  private chatThreadScrollDismissElement: HTMLElement | null = null;
  private suppressTouchContextMenuUntilMs = 0;
  private readonly dismissMessageUiOnChatScroll = () => {
    if (!this.selectedMessageId && !this.quickReactionMessageId && !this.messageActionMenuId && !this.emojiPickerMessageId) {
      return;
    }
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
  };
  private messageLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private optimisticMessageSequence = 0;

  protected readonly trackByChatReader = (_index: number, reader: AppTypes.ChatReadAvatar): string => reader.id;

  constructor() {
    effect(() => {
      const session = this.session();
      const sessionKey = session ? `${session.item.id}:${session.openedAtIso}` : null;
      this.syncSelectedChatHeader(session?.item ?? null);
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
        this.syncSelectedChatHeader(null);
        this.cdr.markForCheck();
        return;
      }
      this.chatInitialLoadPending = true;
      // Warm event-editor service path while chat is active to reduce first-action flicker.
      this.eventEditorService.isOpen();
      void this.refreshSelectedChatHeader(session.item, sessionKey);
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.clearChatComposeResizeObserver();
    this.clearChatThreadScrollDismissListener();
    this.clearMessageLongPress();
    this.stopLocalTyping();
    this.resetVoiceRecorder();
    this.teardownLiveChatUpdates();
    this.clearPendingMessageTimers();
    this.visibleChatThreadTotal = 0;
  }

  protected close(): void {
    this.showContextMenu = false;
    this.contextMenuOpenUp = false;
    this.stopLocalTyping();
    this.resetVoiceRecorder();
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

  protected chatHeaderTitle(chatSession: AppTypes.EventChatSession): string {
    return `${this.chatHeaderContext?.title ?? chatSession.item.title ?? ''}`.trim() || 'Chat';
  }

  protected chatHeaderMembersControl(): AppTypes.PopupHeaderControl | null {
    const controls = this.chatHeaderContext?.controls ?? [];
    return controls.find(control => control.id === 'members') ?? null;
  }

  protected selectedChatContextControl(): AppTypes.PopupHeaderControl | null {
    const controls = this.chatHeaderContext?.controls ?? [];
    return controls.find(control => control.id === 'chat-context') ?? null;
  }

  protected chatHeaderControlIcon(control: AppTypes.PopupHeaderControl): string {
    return control.visual?.kind === 'icon' ? control.visual.icon : 'groups';
  }

  protected chatHeaderControlLabel(control: AppTypes.PopupHeaderControl): string {
    return `${control.summary ?? control.label ?? ''}`.trim() || 'Members';
  }

  protected chatHeaderThumbs(control: AppTypes.PopupHeaderControl): AppTypes.PopupHeaderThumb[] {
    if (control.visual?.kind !== 'thumbStack') {
      return [];
    }
    const maxVisible = Math.max(1, Math.trunc(Number(control.visual.maxVisible) || 4));
    return control.visual.thumbs.slice(0, maxVisible).map(thumb => ({ ...thumb }));
  }

  protected chatHeaderControlBadgeValue(control: AppTypes.PopupHeaderControl): number {
    return Math.max(0, Math.trunc(Number(control.badge?.value) || 0));
  }

  protected openChatHeaderControl(control: AppTypes.PopupHeaderControl, event?: Event): void {
    event?.stopPropagation();
    if (control.id !== 'members') {
      return;
    }
    const lookup = control.lookup;
    const ownerId = `${lookup?.id ?? ''}`.trim();
    if (!ownerId) {
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'members',
      ownerId,
      subtitle: this.chatHeaderContext?.title ?? this.session()?.item.title ?? 'Chat',
      viewOnly: true,
      lookup: lookup ? { ...lookup } : undefined
    });
  }

  protected isBlockedSupportChat(): boolean {
    return this.session()?.item.id.startsWith('c-support-blocked-') === true;
  }

  protected isServiceChat(): boolean {
    return this.session()?.item.channelType === 'serviceEvent';
  }

  protected selectedChatHasSubEventMenu(): boolean {
    const menu = this.selectedChatContextControl()?.menu;
    return Array.isArray(menu?.groups) && menu.groups.some(group => group.controls.length > 0);
  }

  protected selectedChatHeaderActionIcon(): string {
    if (this.isServiceChat()) {
      return 'support_agent';
    }
    return this.chatHeaderControlIcon(this.selectedChatContextControl() ?? {
      id: 'fallback-event',
      label: 'View Event',
      visual: { kind: 'icon', icon: 'event' }
    });
  }

  protected selectedChatHeaderActionLabel(): string {
    if (this.isServiceChat()) {
      return 'Service';
    }
    return this.selectedChatContextControl()?.label ?? 'View Event';
  }

  protected selectedChatHeaderActionToneClass(): string {
    if (this.isServiceChat()) {
      return 'popup-chat-context-btn-tone-service';
    }
    return this.selectedChatActionToneClass();
  }

  protected selectedChatHeaderActionBadgeCount(): number {
    return this.chatHeaderControlBadgeValue(this.selectedChatContextControl() ?? {
      id: 'fallback-event',
      label: 'View Event'
    });
  }

  protected selectedChatContextMenuTitle(): string {
    return this.selectedChatContextControl()?.menu?.title ?? this.session()?.item.title ?? 'Chat';
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
    const row = this.selectedChatNavigationState?.eventRow ?? this.chatEventRow();
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
    if (this.isServiceChat()) {
      event?.stopPropagation();
      return;
    }
    const channelType = this.selectedChatNavigationState?.channelType;
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
    event?: Event,
    openExplore = false,
    assetViewId?: string
  ): void {
    event?.stopPropagation();
    const session = this.session();
    const state = this.selectedChatNavigationState;
    if (!session || !state?.subEvent) {
      return;
    }
    this.showContextMenu = false;
    this.popupCtx.requestActivitiesNavigation({
      type: 'chatResource',
      ownerId: state.eventRow?.id ?? session.item.eventId,
      item: session.item,
      resourceType: type,
      subEvent: state.subEvent,
      assetAssignmentIds: state.assetAssignmentIds,
      assetCardsByType: state.assetCardsByType,
      openExplore,
      assetViewId,
      group: state.group
        ? {
            id: state.group.id,
            groupLabel: state.group.label
          }
        : null
      });
  }

  protected selectedChatContextMenuGroups(): AppTypes.PopupHeaderControlGroup[] {
    return this.selectedChatContextControl()?.menu?.groups
      ?.map(group => ({
        ...group,
        controls: group.controls.map(control => ({ ...control }))
      }))
      ?? [];
  }

  protected selectedChatMenuControlIcon(control: AppTypes.PopupHeaderControl): string {
    return this.chatHeaderControlIcon(control);
  }

  protected selectedChatMenuControlBadgeCount(control: AppTypes.PopupHeaderControl): number {
    return this.chatHeaderControlBadgeValue(control);
  }

  protected selectedChatMenuControlClasses(control: AppTypes.PopupHeaderControl): string[] {
    const resourceType = this.popupControlResourceType(control);
    return resourceType
      ? ['subevent-resource-menu-item', this.resourceTypeClass(resourceType)]
      : [];
  }

  protected openSelectedChatMenuControl(control: AppTypes.PopupHeaderControl, event?: Event): void {
    event?.stopPropagation();
    const resourceType = this.popupControlResourceType(control);
    if (resourceType) {
      this.openSelectedChatSubEventResource(resourceType, event);
      return;
    }
    this.openSelectedChatPrimaryContext(event);
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

  protected openVoiceComposer(event?: Event): void {
    event?.stopPropagation();
    this.composerMenuOpen = false;
    this.pollComposerOpen = false;
    this.voiceComposerOpen = true;
    this.voiceRecorderError = '';
  }

  protected openPollComposer(event?: Event): void {
    event?.stopPropagation();
    this.composerMenuOpen = false;
    this.resetVoiceRecorder();
    this.pollComposerOpen = true;
    if (this.pollOptionDrafts.length < 2) {
      this.pollOptionDrafts = ['', ''];
    }
  }

  protected closePollComposer(event?: Event): void {
    event?.stopPropagation();
    this.pollComposerOpen = false;
    this.pollQuestionDraft = '';
    this.pollOptionDrafts = ['', ''];
  }

  protected addPollOption(event?: Event): void {
    event?.stopPropagation();
    if (this.pollOptionDrafts.length >= 6) {
      return;
    }
    this.pollOptionDrafts = [...this.pollOptionDrafts, ''];
  }

  protected removePollOption(index: number, event?: Event): void {
    event?.stopPropagation();
    if (this.pollOptionDrafts.length <= 2) {
      this.pollOptionDrafts = this.pollOptionDrafts.map((value, valueIndex) => valueIndex === index ? '' : value);
      return;
    }
    this.pollOptionDrafts = this.pollOptionDrafts.filter((_value, valueIndex) => valueIndex !== index);
  }

  protected pollDraftOptionTrack(index: number): number {
    return index;
  }

  protected canCreatePoll(): boolean {
    return this.pollQuestionDraft.trim().length > 0
      && this.pollOptionDrafts.filter(option => option.trim().length > 0).length >= 2
      && !this.chatInitialLoadPending;
  }

  protected sendPoll(event?: Event): void {
    event?.stopPropagation();
    if (!this.canCreatePoll()) {
      return;
    }
    const question = this.pollQuestionDraft.trim();
    const options = this.pollOptionDrafts
      .map(option => option.trim())
      .filter(Boolean)
      .slice(0, 6);
    this.closePollComposer();
    const pollId = `poll:${this.activeUserId() || 'self'}:${Date.now()}`;
    const pollState: ChatPollState = {
      question,
      options: options.map((option, index) => ({
          id: `${pollId}:option:${index + 1}`,
          text: option,
          votes: []
        }))
    };
    this.sendLocalAttachmentMessage({
      id: pollId,
      type: 'poll',
      title: pollState.question,
      description: this.serializePollState(pollState)
    }, '');
  }

  protected async startVoiceRecording(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.voiceRecordingState === 'recording' || this.voiceRecordingState === 'saving') {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.voiceRecorderError = 'Voice recording is not available on this device.';
      return;
    }
    this.resetVoiceRecorder({ keepOpen: true });
    this.voiceComposerOpen = true;
    this.voiceRecordingState = 'recording';
    this.voiceRecorderError = '';
    this.cdr.markForCheck();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, this.preferredVoiceRecorderOptions());
      this.voiceRecorderStream = stream;
      this.voiceRecorder = recorder;
      this.voiceClipMimeType = recorder.mimeType || 'audio/webm';
      recorder.ondataavailable = dataEvent => {
        if (dataEvent.data.size > 0) {
          this.voiceRecorderChunks.push(dataEvent.data);
        }
      };
      recorder.onstop = () => {
        void this.finalizeVoiceRecording();
      };
      recorder.start();
      this.voiceRecorderTimer = setInterval(() => {
        this.voiceRecorderSeconds += 1;
        this.cdr.markForCheck();
      }, 1000);
    } catch {
      this.voiceRecorderError = 'Microphone access was blocked.';
      this.resetVoiceRecorder({ keepOpen: true, keepError: true });
      this.cdr.markForCheck();
    }
  }

  protected stopVoiceRecording(event?: Event): void {
    event?.stopPropagation();
    if (this.voiceRecorder?.state === 'recording') {
      this.voiceRecorder.stop();
      return;
    }
    this.resetVoiceRecorder({ keepOpen: true });
  }

  protected discardVoiceRecording(event?: Event): void {
    event?.stopPropagation();
    this.resetVoiceRecorder();
  }

  protected canSendVoiceClip(): boolean {
    return this.voiceRecordingState === 'recorded' && !!this.voiceClipDataUrl && !this.chatInitialLoadPending;
  }

  protected async sendVoiceClip(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canSendVoiceClip()) {
      return;
    }
    this.voiceRecordingState = 'saving';
    this.voiceRecorderError = '';
    this.cdr.markForCheck();
    const voiceKey = `voice:${this.activeUserId() || 'self'}:${Date.now()}`;
    const voiceUrl = await this.persistVoiceClipByConfiguredMode(voiceKey);
    if (!voiceUrl) {
      this.voiceRecordingState = 'recorded';
      this.cdr.markForCheck();
      return;
    }
    this.sendLocalAttachmentMessage({
      id: voiceKey,
      type: 'voice',
      title: 'Voice clip',
      subtitle: this.formatVoiceDuration(this.voiceRecorderSeconds),
      url: voiceUrl,
      mimeType: this.voiceClipMimeType || null,
      sizeBytes: this.voiceClipSizeBytes || null
    }, '');
    this.resetVoiceRecorder();
  }

  protected voiceAttachmentAudioSrc(attachment: AppTypes.ChatMessageAttachment): string {
    const url = `${attachment.url ?? attachment.previewUrl ?? ''}`.trim();
    if (!url.startsWith('indexeddb:')) {
      return url;
    }
    const key = url.slice('indexeddb:'.length);
    const cached = this.voiceAttachmentSrcByKey[key];
    if (cached) {
      return cached;
    }
    if (!this.loadingVoiceClipKeys.has(key)) {
      this.loadingVoiceClipKeys.add(key);
      void this.loadVoiceClipFromIndexedDb(key)
        .then(clip => {
          if (clip?.dataUrl) {
            this.voiceAttachmentSrcByKey[key] = clip.dataUrl;
          }
        })
        .finally(() => {
          this.loadingVoiceClipKeys.delete(key);
          this.cdr.markForCheck();
        });
    }
    return '';
  }

  protected pollState(attachment: AppTypes.ChatMessageAttachment): ChatPollState {
    return this.parsePollState(attachment);
  }

  protected pollTotalVotes(poll: ChatPollState): number {
    return poll.options.reduce((total, option) => total + option.votes.length, 0);
  }

  protected pollOptionPercent(poll: ChatPollState, option: ChatPollOptionState): number {
    const memberTotal = Math.max(0, this.session()?.item.memberIds?.length ?? 0);
    const total = Math.max(memberTotal, this.pollTotalVotes(poll), 1);
    return total > 0 ? Math.round((option.votes.length / total) * 100) : 0;
  }

  protected selectedPollOptionId(message: AppTypes.ChatPopupMessage, attachment: AppTypes.ChatMessageAttachment): string {
    const messageId = `${message.id ?? ''}`.trim();
    return messageId ? this.selectedPollOptionByMessageId[messageId] || this.pollOwnVoteOptionId(attachment) : '';
  }

  protected openPollVoteDialog(message: AppTypes.ChatPopupMessage, attachment: AppTypes.ChatMessageAttachment, event?: Event): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    const attachmentId = `${attachment.id ?? ''}`.trim();
    if (!messageId || !attachmentId) {
      return;
    }
    this.pollVoteMessageId = messageId;
    this.pollVoteAttachmentId = attachmentId;
    this.selectedPollOptionByMessageId = {
      ...this.selectedPollOptionByMessageId,
      [messageId]: this.selectedPollOptionId({ ...message, id: messageId }, { ...attachment, id: attachmentId })
    };
  }

  protected closePollVoteDialog(): void {
    this.pollVoteMessageId = '';
    this.pollVoteAttachmentId = '';
  }

  protected pollVoteDialogContext(): {
    message: AppTypes.ChatPopupMessage;
    attachment: AppTypes.ChatMessageAttachment;
    poll: ChatPollState;
  } | null {
    const message = this.allMessages.find(item => item.id === this.pollVoteMessageId) ?? null;
    const attachment = message?.attachments?.find(item => item.id === this.pollVoteAttachmentId && item.type === 'poll') ?? null;
    return message && attachment
      ? {
          message,
          attachment,
          poll: this.parsePollState(attachment)
        }
      : null;
  }

  protected selectPollOption(
    message: AppTypes.ChatPopupMessage,
    attachment: AppTypes.ChatMessageAttachment,
    option: ChatPollOptionState,
    event?: Event
  ): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    const optionId = `${option.id ?? ''}`.trim();
    if (!messageId || !optionId) {
      return;
    }
    this.selectedPollOptionByMessageId = {
      ...this.selectedPollOptionByMessageId,
      [messageId]: optionId
    };
  }

  protected canSubmitPollVote(message: AppTypes.ChatPopupMessage, attachment: AppTypes.ChatMessageAttachment): boolean {
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      return false;
    }
    const selectedOptionId = this.selectedPollOptionByMessageId[messageId] || '';
    return !!selectedOptionId && selectedOptionId !== this.pollOwnVoteOptionId(attachment);
  }

  protected submitPollVote(
    message: AppTypes.ChatPopupMessage,
    attachment: AppTypes.ChatMessageAttachment,
    event?: Event
  ): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closePollVoteDialog();
      return;
    }
    const selectedOptionId = this.selectedPollOptionByMessageId[messageId] || '';
    if (!selectedOptionId) {
      return;
    }
    const activeUserId = this.activeUserId() || 'self';
    const presentation = this.resolveOptimisticSenderPresentation(activeUserId);
    const currentMessage = this.allMessages.find(item => item.id === messageId) ?? { ...message, id: messageId };
    const poll = this.parsePollState(attachment);
    const nextPoll: ChatPollState = {
      ...poll,
      options: poll.options.map(option => ({
        ...option,
        votes: [
          ...option.votes.filter(vote => vote.userId !== activeUserId),
          ...(option.id === selectedOptionId
            ? [{
                userId: activeUserId,
                initials: presentation.senderAvatar.initials,
                gender: presentation.senderAvatar.gender
              }]
            : [])
        ]
      }))
    };
    const nextAttachment: AppTypes.ChatMessageAttachment = {
      ...attachment,
      title: nextPoll.question,
      description: this.serializePollState(nextPoll)
    };
    const nextAttachments = (currentMessage.attachments ?? []).map(item => item.id === attachment.id ? nextAttachment : { ...item });
    const optimisticMessage: AppTypes.ChatPopupMessage = {
      ...currentMessage,
      attachments: nextAttachments,
      deliveryState: 'pending'
    };
    this.replaceExistingChatMessage(optimisticMessage);
    this.schedulePendingMessageTimeout(messageId);
    this.closePollVoteDialog();
    this.cdr.markForCheck();
    const session = this.session();
    if (!session) {
      return;
    }
    const mutationSequence = (this.pollVoteMutationSequenceByMessageId.get(messageId) ?? 0) + 1;
    this.pollVoteMutationSequenceByMessageId.set(messageId, mutationSequence);
    void this.activitiesContext.updateEventChatMessage(session.item, messageId, { attachments: nextAttachments })
      .then(updated => {
        if (this.pollVoteMutationSequenceByMessageId.get(messageId) !== mutationSequence) {
          return;
        }
        if (updated) {
          this.clearPendingMessageTimeout(messageId);
          this.clearPendingMessageState(messageId);
        }
        this.pollVoteMutationSequenceByMessageId.delete(messageId);
      })
      .catch(() => {
        if (this.pollVoteMutationSequenceByMessageId.get(messageId) === mutationSequence) {
          this.pollVoteMutationSequenceByMessageId.delete(messageId);
        }
      });
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

  protected shareCurrentEvent(event?: Event): void {
    event?.stopPropagation();
    this.composerMenuOpen = false;
    this.popupCtx.requestActivitiesNavigation({ type: 'eventExplore', stacked: true });
  }

  protected shareFirstAvailableAsset(event?: Event): void {
    event?.stopPropagation();
    this.composerMenuOpen = false;
    const resourceType = this.firstAvailableAssetType();
    this.popupCtx.requestActivitiesNavigation({
      type: 'assetExplore',
      assetType: resourceType ?? 'Car'
    });
  }

  protected chatAttachmentIcon(attachment: AppTypes.ChatMessageAttachment): string {
    switch (attachment.type) {
      case 'event':
        return 'event';
      case 'asset':
        return 'inventory_2';
      case 'link':
        return 'link';
      case 'poll':
        return 'poll';
      default:
        return 'attachment';
    }
  }

  protected chatAttachmentTypeLabel(attachment: AppTypes.ChatMessageAttachment): string {
    switch (attachment.type) {
      case 'event':
        return 'Event';
      case 'asset':
        return 'Asset';
      case 'link':
        return 'Link';
      case 'poll':
        return 'Poll';
      default:
        return 'Attachment';
    }
  }

  protected isAttachmentUnavailable(attachment: AppTypes.ChatMessageAttachment): boolean {
    return `${attachment.status ?? ''}`.trim().toLowerCase() === 'unavailable';
  }

  protected unavailableAttachmentLabel(attachment: AppTypes.ChatMessageAttachment): string {
    const reason = `${attachment.unavailableReason ?? ''}`.trim().toLowerCase();
    const typeLabel = this.chatAttachmentTypeLabel(attachment).toLowerCase();
    switch (reason) {
      case 'trashed':
        return `${this.capitalize(typeLabel)} deleted`;
      case 'blocked':
      case 'deleted':
      case 'inactive':
        return `${this.capitalize(typeLabel)} unavailable`;
      default:
        return `${this.capitalize(typeLabel)} unavailable`;
    }
  }

  protected openChatAttachment(attachment: AppTypes.ChatMessageAttachment, event?: Event): void {
    event?.stopPropagation();
    if (this.isAttachmentUnavailable(attachment)) {
      this.confirmationDialogService.openInfo(this.unavailableAttachmentLabel(attachment), {
        title: attachment.title || this.chatAttachmentTypeLabel(attachment)
      });
      return;
    }
    if (this.isInternalHelpUrl(`${attachment.url ?? ''}`)) {
      this.openExternalAttachmentUrl(attachment);
      return;
    }
    if (attachment.type === 'event') {
      const attachmentEventId = `${attachment.entityId ?? ''}`.trim();
      const contextEventId = `${this.selectedChatNavigationState?.eventRow?.id ?? this.session()?.item.eventId ?? ''}`.trim();
      if (!attachmentEventId || attachmentEventId === contextEventId) {
        this.openSelectedChatEvent();
        return;
      }
      void this.openSharedEventAttachment(attachment);
      return;
    }
    if (attachment.type === 'asset') {
      this.openSharedAssetAttachment(attachment);
      return;
    }
    this.openExternalAttachmentUrl(attachment);
  }

  protected selectMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    this.bindChatThreadScrollDismissListener();
    if (message.deletedAtIso) {
      this.closeTransientMessageUi();
      return;
    }
    this.selectedMessageId = this.selectedMessageId === messageId ? '' : messageId;
    this.selectedMessageToolsDown = this.selectedMessageId ? this.shouldOpenMessageToolsDown(event) : false;
    this.messageActionMenuId = '';
    this.quickReactionMessageId = '';
    this.quickReactionOpenDown = false;
    this.emojiPickerMessageId = '';
  }

  protected startMessageLongPress(message: AppTypes.ChatPopupMessage): void {
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId || message.deletedAtIso) {
      return;
    }
    this.suppressTouchContextMenuUntilMs = Date.now() + 1100;
    this.clearMessageLongPress();
    this.messageLongPressTimer = setTimeout(() => {
      this.selectedMessageId = messageId;
      this.selectedMessageToolsDown = this.shouldOpenMessageToolsDown();
      this.quickReactionMessageId = '';
      this.quickReactionOpenDown = false;
      this.emojiPickerMessageId = '';
      this.messageActionMenuId = '';
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
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    this.bindChatThreadScrollDismissListener();
    const wasOpen = this.quickReactionMessageId === messageId;
    this.selectedMessageId = messageId;
    this.messageActionMenuId = '';
    this.emojiPickerMessageId = '';
    this.quickReactionOpenDown = this.shouldOpenQuickReactionsDown(event);
    this.quickReactionMessageId = wasOpen ? '' : messageId;
    if (wasOpen) {
      this.blurEventTarget(event);
    }
  }

  protected openEmojiPicker(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    this.selectedMessageId = messageId;
    this.quickReactionMessageId = '';
    this.quickReactionOpenDown = false;
    this.messageActionMenuId = '';
    this.emojiPickerMessageId = messageId;
    this.emojiPickerQuery = '';
    this.emojiPickerCategory = 'smileys';
  }

  protected closeEmojiPicker(event?: Event): void {
    event?.stopPropagation();
    this.emojiPickerMessageId = '';
    this.emojiPickerQuery = '';
    this.blurEventTarget(event);
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
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    const activeUserId = this.activeUserId() || 'self';
    const presentation = this.resolveOptimisticSenderPresentation(activeUserId);
    const currentMessage = this.allMessages.find(item => item.id === messageId) ?? { ...message, id: messageId };
    const withoutMine = (currentMessage.reactions ?? []).filter(reaction => !this.isOwnReaction(reaction, activeUserId, presentation));
    const sameReaction = (currentMessage.reactions ?? []).some(reaction =>
      this.isOwnReaction(reaction, activeUserId, presentation) && reaction.emoji === emoji
    );
    const reactionEmoji = sameReaction ? null : emoji;
    const optimisticMessage: AppTypes.ChatPopupMessage = {
      ...currentMessage,
      deliveryState: 'pending',
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
    };
    const queueUntilStored = this.isPendingOutgoingChatMessage(currentMessage);
    this.replaceExistingChatMessage(optimisticMessage);
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
    if (queueUntilStored) {
      this.queuedReactionByPendingMessageId.set(messageId, reactionEmoji);
      return;
    }
    this.schedulePendingMessageTimeout(messageId);
    const session = this.session();
    if (session) {
      const mutationSequence = (this.reactionMutationSequenceByMessageId.get(messageId) ?? 0) + 1;
      this.reactionMutationSequenceByMessageId.set(messageId, mutationSequence);
      void this.activitiesContext.updateEventChatMessage(session.item, messageId, { reactionEmoji })
        .then(updated => {
          if (this.reactionMutationSequenceByMessageId.get(messageId) !== mutationSequence) {
            return;
          }
          if (updated) {
            this.clearPendingMessageTimeout(messageId);
            this.clearPendingMessageState(messageId);
          }
          this.reactionMutationSequenceByMessageId.delete(messageId);
        })
        .catch(() => {
          if (this.reactionMutationSequenceByMessageId.get(messageId) === mutationSequence) {
            this.reactionMutationSequenceByMessageId.delete(messageId);
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

  private isOwnReaction(
    reaction: AppTypes.ChatMessageReaction,
    activeUserId: string,
    presentation: Pick<AppTypes.ChatPopupMessage, 'sender' | 'senderAvatar'>
  ): boolean {
    const reactionUserId = `${reaction.userId ?? ''}`.trim();
    const knownOwnIds = new Set([
      `${activeUserId ?? ''}`.trim(),
      `${presentation.senderAvatar.id ?? ''}`.trim(),
      `${this.appCtx.activeUserProfile()?.id ?? ''}`.trim(),
      'self',
      'me'
    ].filter(Boolean));
    if (knownOwnIds.has(reactionUserId)) {
      return true;
    }
    const reactionName = `${reaction.userName ?? ''}`.trim().toLowerCase();
    return reactionName === 'you';
  }

  protected openReactionDetails(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    if ((message.reactions?.length ?? 0) === 0) {
      this.reactionDetailsMessageId = '';
      return;
    }
    this.reactionDetailsMessageId = `${message.id ?? ''}`.trim();
    this.reactionDetailsFilter = 'all';
  }

  protected closeReactionDetails(): void {
    this.reactionDetailsMessageId = '';
  }

  protected reactionDetailsMessage(): AppTypes.ChatPopupMessage | null {
    const messageId = `${this.reactionDetailsMessageId ?? ''}`.trim();
    if (!messageId) {
      return null;
    }
    const message = this.allMessages.find(item => item.id === messageId) ?? null;
    return message && (message.reactions?.length ?? 0) > 0 ? message : null;
  }

  protected emojiPickerMessage(): AppTypes.ChatPopupMessage | null {
    const messageId = `${this.emojiPickerMessageId ?? ''}`.trim();
    if (!messageId) {
      return null;
    }
    return this.allMessages.find(message => message.id === messageId && !message.deletedAtIso) ?? null;
  }

  protected reactionDetailsRows(message: AppTypes.ChatPopupMessage): AppTypes.ChatMessageReaction[] {
    return this.reactionDetailsFilter === 'all'
      ? (message.reactions ?? [])
      : (message.reactions ?? []).filter(reaction => reaction.emoji === this.reactionDetailsFilter);
  }

  protected openMessageActionMenu(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (event?.type === 'contextmenu') {
      return;
    }
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId || message.deletedAtIso) {
      this.closeTransientMessageUi();
      return;
    }
    this.bindChatThreadScrollDismissListener();
    this.selectedMessageId = messageId;
    this.selectedMessageToolsDown = this.shouldOpenMessageToolsDown(event);
    this.quickReactionMessageId = '';
    this.emojiPickerMessageId = '';
    this.messageActionMenuOpenUp = this.shouldOpenMessageActionMenuUp(event);
    const wasOpen = this.messageActionMenuId === messageId;
    this.messageActionMenuId = wasOpen ? '' : messageId;
    if (wasOpen) {
      this.blurEventTarget(event);
    }
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
    const preview = this.replyPreviewParts(replyTo);
    return preview.meta ? `${preview.title} · ${preview.meta}` : preview.title;
  }

  protected replyPreviewParts(replyTo: AppTypes.ChatPopupMessage['replyTo']): { title: string; meta: string } {
    const sourceMessage = this.allMessages.find(message => message.id === `${replyTo?.id ?? ''}`.trim());
    const sourceAttachment = sourceMessage?.attachments?.[0];
    if (sourceAttachment?.type === 'event') {
      return this.attachmentReferenceParts(sourceAttachment, 'Event');
    }
    if (sourceAttachment?.type === 'asset') {
      return this.attachmentReferenceParts(sourceAttachment, 'Asset');
    }
    if (sourceAttachment?.type === 'image') {
      return { title: 'Image', meta: '' };
    }
    const text = `${replyTo?.text ?? ''}`.trim();
    return { title: text === 'Sent an image' ? 'Image' : text || 'Message', meta: '' };
  }

  protected jumpToReplySource(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const targetId = `${message.replyTo?.id ?? ''}`.trim();
    if (!targetId) {
      return;
    }
    if (!this.ensureChatThreadMessageVisible(targetId)) {
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
      deliveryState: 'pending',
      deletedAtIso: new Date().toISOString(),
      deletedByUserId: this.activeUserId() || 'self',
      deletedByName: 'You',
      reactions: [],
      readBy: []
    });
    this.schedulePendingMessageTimeout(message.id);
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
    const session = this.session();
    if (session) {
      void this.activitiesContext.updateEventChatMessage(session.item, message.id, { deleted: true })
        .then(updated => {
          if (updated) {
            this.clearPendingMessageTimeout(message.id);
            this.clearPendingMessageState(message.id);
          }
        })
        .catch(() => {
          return;
        });
    }
  }

  protected deletedMessageLabel(message: AppTypes.ChatPopupMessage): string {
    if (message.deliveryState === 'pending') {
      return 'Deleting message';
    }
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
      deliveryState: 'pending',
      pinnedAtIso: pinned ? new Date().toISOString() : null,
      pinnedByUserId: pinned ? activeUserId : null
    });
    this.schedulePendingMessageTimeout(message.id);
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
    const session = this.session();
    if (session) {
      void this.activitiesContext.updateEventChatMessage(session.item, message.id, { pinned })
        .then(updated => {
          if (updated) {
            this.clearPendingMessageTimeout(message.id);
            this.clearPendingMessageState(message.id);
          }
        })
        .catch(() => {
          return;
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
    this.selectedMessageToolsDown = false;
    this.highlightedMessageId = message.id;
    this.closePinnedMessagesDialog();
    this.scheduleChatThreadScrollToMessage(message.id);
    setTimeout(() => {
      if (this.highlightedMessageId === message.id) {
        this.highlightedMessageId = '';
        this.cdr.markForCheck();
      }
    }, 1200);
  }

  protected reportMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.messageActionMenuId = '';
    if (!this.canReportMessage(message)) {
      return;
    }
    const session = this.session();
    const target = this.resolveChatReportTarget(message);
    const eventId = `${session?.item.eventId ?? session?.item.id ?? ''}`.trim();
    if (!target || !eventId) {
      return;
    }
    const attachment = this.resolveViewableMessageAttachment(message);
    this.navigatorService.openReportUserPopup({
      targetUserId: target.userId,
      targetName: target.name,
      eventId,
      eventTitle: session?.item.title ?? null,
      eventTimeframe: session?.item.dateIso ?? null,
      ownerType: 'event',
      sourceType: 'chat',
      sourceId: message.id,
      sourceText: message.text?.trim() || this.chatAttachmentSummary(message),
      chatId: session?.item.id ?? null,
      messageId: message.id,
      assetId: attachment?.type === 'asset' ? (attachment.entityId ?? attachment.id) : null,
      assetType: attachment?.type === 'asset' ? (attachment.assetType ?? null) : null
    });
  }

  protected canReportMessage(message: AppTypes.ChatPopupMessage): boolean {
    if (this.isAdminRoleActive() || message.mine) {
      return false;
    }
    return this.resolveChatReportTarget(message) !== null;
  }

  private isAdminRoleActive(): boolean {
    const hostTier = `${this.appCtx.activeUserProfile()?.hostTier ?? ''}`.trim().toLowerCase();
    if (hostTier === 'admin') {
      return true;
    }
    const activeUserId = this.activeUserId();
    return activeUserId === 'admin' || activeUserId.startsWith('admin-');
  }

  private resolveChatReportTarget(message: AppTypes.ChatPopupMessage): { userId: string; name: string } | null {
    if (message.mine) {
      return null;
    }
    const activeUserId = this.activeUserId();
    const messageSenderId = `${message.senderAvatar?.id ?? ''}`.trim();
    if (messageSenderId && messageSenderId !== activeUserId) {
      return {
        userId: messageSenderId,
        name: `${message.sender ?? ''}`.trim() || 'Chat member'
      };
    }
    return null;
  }

  protected messageHasViewableAttachment(message: AppTypes.ChatPopupMessage): boolean {
    return this.resolveViewableMessageAttachment(message) !== null;
  }

  protected viewSharedMessage(message: AppTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const attachment = this.resolveViewableMessageAttachment(message);
    if (!attachment) {
      return;
    }
    this.closeTransientMessageUi();
    this.openChatAttachment(attachment, event);
  }

  protected chatTextSegments(text: string): ChatTextSegment[] {
    const value = `${text ?? ''}`;
    const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    const segments: ChatTextSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlPattern.exec(value)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          id: `text:${lastIndex}`,
          text: value.slice(lastIndex, match.index)
        });
      }
      const rawUrl = match[0].replace(/[),.;!?]+$/g, '');
      const trailing = match[0].slice(rawUrl.length);
      segments.push({
        id: `link:${match.index}`,
        text: rawUrl,
        url: rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
      });
      if (trailing) {
        segments.push({
          id: `text:${match.index + rawUrl.length}`,
          text: trailing
        });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) {
      segments.push({
        id: `text:${lastIndex}`,
        text: value.slice(lastIndex)
      });
    }
    return segments.length > 0 ? segments : [{ id: 'text:0', text: value }];
  }

  protected openChatTextLink(url: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const safeUrl = `${url ?? ''}`.trim();
    if (!safeUrl) {
      return;
    }
    this.confirmExternalLink(safeUrl);
  }

  protected async sendMessage(): Promise<void> {
    const text = this.draftMessage.trim();
    const session = this.session();
    if (!session || !text) {
      return;
    }
    if (this.editingMessageId) {
      this.commitEditMessage(text);
      return;
    }
    const sharedAttachment = await this.resolveShareAttachmentFromText(text);
    if (sharedAttachment) {
      this.sendLocalAttachmentMessage(sharedAttachment, '');
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
      this.cdr.markForCheck();
    } catch {
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      this.markPendingMessageTimedOut(imageMessage.id);
      this.cdr.markForCheck();
    }
  }

  private sendLocalAttachmentMessage(attachment: AppTypes.ChatMessageAttachment, captionOverride?: string): void {
    const session = this.session();
    if (!session || this.chatInitialLoadPending) {
      return;
    }
    const caption = captionOverride ?? this.draftMessage.trim();
    const optimisticMessage = {
      ...this.buildOptimisticChatMessage(caption),
      attachments: [{ ...attachment }]
    } satisfies AppTypes.ChatPopupMessage;
    const sessionKey = `${session.item.id}:${session.openedAtIso}`;
    this.draftMessage = '';
    this.replyTarget = null;
    this.resizeComposerTextareaSoon();
    this.stopLocalTyping();
    this.mergeIncomingChatMessage(optimisticMessage);
    this.schedulePendingMessageTimeout(optimisticMessage.id);
    this.cdr.markForCheck();
    void this.activitiesContext.sendEventChatMessageWithAttachments(
      session.item,
      caption,
      [{ ...attachment }],
      optimisticMessage.clientId,
      optimisticMessage.replyTo
    )
      .then(message => {
        if (this.loadedSessionKey !== sessionKey) {
          return;
        }
        if (message) {
          this.confirmPendingChatMessage(optimisticMessage.id, message);
          return;
        }
        this.cdr.markForCheck();
      })
      .catch(() => {
        if (this.loadedSessionKey !== sessionKey) {
          return;
        }
        this.cdr.markForCheck();
      });
  }

  private buildCurrentEventAttachment(): AppTypes.ChatMessageAttachment | null {
    const session = this.session();
    const row = this.selectedChatNavigationState?.eventRow ?? this.chatEventRow();
    const eventId = `${row?.id ?? session?.item.eventId ?? ''}`.trim();
    const title = `${row?.title ?? session?.item.title ?? ''}`.trim();
    if (!eventId || !title) {
      return null;
    }
    return {
      id: `event:${eventId}:${Date.now()}`,
      type: 'event',
      entityId: eventId,
      title,
      subtitle: `${row?.detail ?? ''}`.trim() || null,
      description: `${row?.subtitle ?? ''}`.trim() || null,
      url: null,
      previewUrl: `${row?.imageUrl ?? ''}`.trim() || null
    };
  }

  private async resolveShareAttachmentFromText(text: string): Promise<AppTypes.ChatMessageAttachment | null> {
    const token = this.parseShareToken(text);
    if (!token) {
      return null;
    }
    const resolved = await this.shareTokensService.resolveToken(token, this.activeUserId());
    if (!resolved) {
      this.confirmationDialogService.openInfo('This share token is expired or no longer available.', {
        title: 'Share link'
      });
      return null;
    }
    if (resolved.kind === 'adminHelp') {
      return {
        id: `adminHelp:${resolved.ownerUserId ?? 'user'}:${Date.now()}`,
        type: 'link',
        entityId: token,
        ownerUserId: resolved.ownerUserId ?? null,
        title: resolved.title || 'Open shared help view',
        subtitle: resolved.subtitle ?? null,
        description: null,
        url: this.location.prepareExternalUrl(`/admin/help/${encodeURIComponent(token)}`),
        previewUrl: resolved.imageUrl ?? null
      };
    }
    return {
      id: `${resolved.kind}:${resolved.entityId}:${Date.now()}`,
      type: resolved.kind,
      entityId: resolved.entityId,
      assetType: resolved.kind === 'asset' ? (resolved.assetType ?? null) : null,
      ownerUserId: resolved.kind === 'asset' ? (resolved.ownerUserId ?? null) : null,
      title: resolved.title,
      subtitle: resolved.subtitle ?? null,
      description: resolved.description ?? null,
      url: resolved.url ?? null,
      previewUrl: resolved.imageUrl ?? null
    };
  }

  private parseShareToken(text: string): string | null {
    const normalized = `${text ?? ''}`.trim();
    return normalized.match(/^myscoutee:token:[A-Za-z0-9-]+$/) ? normalized : null;
  }

  private buildFirstAssetAttachment(): AppTypes.ChatMessageAttachment | null {
    const state = this.selectedChatNavigationState;
    if (!state) {
      return null;
    }
    const assetTypes: Array<'Car' | 'Accommodation' | 'Supplies'> = ['Car', 'Accommodation', 'Supplies'];
    for (const type of assetTypes) {
      const card = state.assetCardsByType[type]?.[0];
      if (!card) {
        continue;
      }
      return {
        id: `asset:${card.id}:${Date.now()}`,
        type: 'asset',
        entityId: card.id,
        assetType: type,
        ownerUserId: card.ownerUserId ?? null,
        title: card.title,
        subtitle: [type, card.city].filter(Boolean).join(' - ') || null,
        description: `${card.details || card.subtitle || ''}`.trim() || null,
        url: `${card.sourceLink ?? ''}`.trim() || null,
        previewUrl: `${card.imageUrl ?? ''}`.trim() || null
      };
    }
    return null;
  }

  private findSharedAssetResourceType(
    attachment: AppTypes.ChatMessageAttachment
  ): 'Car' | 'Accommodation' | 'Supplies' | null {
    const assetId = `${attachment.entityId ?? ''}`.trim();
    const state = this.selectedChatNavigationState;
    if (!assetId || !state?.subEvent) {
      return null;
    }
    const assetTypes: Array<'Car' | 'Accommodation' | 'Supplies'> = ['Car', 'Accommodation', 'Supplies'];
    return assetTypes.find(type => state.assetCardsByType[type]?.some(card => {
      const sourceAssetId = 'sourceAssetId' in card
        ? `${card.sourceAssetId ?? ''}`.trim()
        : '';
      return card.id === assetId || sourceAssetId === assetId;
    })) ?? null;
  }

  private openSharedAssetAttachment(attachment: AppTypes.ChatMessageAttachment): void {
    const resourceType = this.findSharedAssetResourceType(attachment);
    if (resourceType) {
      this.openSelectedChatSubEventResource(
        resourceType,
        undefined,
        false,
        `${attachment.entityId ?? ''}`.trim() || undefined
      );
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'assetExplore',
      assetType: this.normalizeAttachmentAssetType(attachment.assetType) ?? 'Car',
      assetId: `${attachment.entityId ?? ''}`.trim() || undefined,
      viewOnly: true,
      fallbackAsset: this.assetAttachmentToViewCard(attachment)
    });
  }

  private assetAttachmentToViewCard(attachment: AppTypes.ChatMessageAttachment): AppTypes.AssetCard | undefined {
    const assetId = `${attachment.entityId ?? ''}`.trim();
    const assetType = this.normalizeAttachmentAssetType(attachment.assetType) ?? 'Car';
    if (!assetId) {
      return undefined;
    }
    const subtitle = `${attachment.subtitle ?? ''}`.trim();
    const subtitleParts = subtitle.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
    return {
      id: assetId,
      type: assetType,
      title: `${attachment.title ?? ''}`.trim() || 'Shared asset',
      subtitle: subtitleParts.length > 1 ? subtitleParts.slice(1).join(' - ') : subtitle,
      category: undefined,
      city: subtitleParts.length > 1 ? subtitleParts[subtitleParts.length - 1] : '',
      capacityTotal: 1,
      quantity: 1,
      details: `${attachment.description ?? ''}`.trim(),
      imageUrl: `${attachment.previewUrl ?? ''}`.trim(),
      sourceLink: `${attachment.url ?? ''}`.trim(),
      routes: [],
      topics: [],
      policies: [],
      pricing: null,
      visibility: 'Public',
      ownerUserId: `${attachment.ownerUserId ?? ''}`.trim() || undefined,
      requests: []
    };
  }

  private normalizeAttachmentAssetType(value: unknown): AppTypes.AssetType | null {
    return value === 'Car' || value === 'Accommodation' || value === 'Supplies' ? value : null;
  }

  private openExternalAttachmentUrl(attachment: AppTypes.ChatMessageAttachment): void {
    const url = `${attachment.url ?? ''}`.trim();
    if (!url) {
      this.confirmationDialogService.openInfo('This shared item is not available from the current chat context.', {
        title: attachment.title || 'Shared item'
      });
      return;
    }
    if (this.isInternalHelpUrl(url)) {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    this.confirmExternalLink(url);
  }

  private isInternalHelpUrl(url: string): boolean {
    const normalized = `${url ?? ''}`.trim();
    if (normalized.startsWith('/admin/help/')) {
      return true;
    }
    if (typeof document === 'undefined') {
      return false;
    }
    try {
      const parsed = new URL(normalized, document.baseURI);
      const basePath = new URL(document.baseURI).pathname.replace(/\/$/, '');
      const baseHelpPath = `${basePath}/admin/help/`.replace(/\/{2,}/g, '/');
      return parsed.origin === window.location.origin
        && (parsed.pathname.startsWith('/admin/help/') || parsed.pathname.startsWith(baseHelpPath));
    } catch {
      return false;
    }
  }

  private confirmExternalLink(url: string): void {
    this.confirmationDialogService.open({
      title: 'Open external link?',
      message: 'This link opens outside MyScoutee. Be vigilant and continue only if you trust it.',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      confirmTone: 'accent',
      onConfirm: () => {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  private async openSharedEventAttachment(attachment: AppTypes.ChatMessageAttachment): Promise<void> {
    const eventId = `${attachment.entityId ?? ''}`.trim();
    if (!eventId) {
      this.confirmationDialogService.openInfo('This event is not available anymore.', {
        title: attachment.title || 'Shared event'
      });
      return;
    }
    const eventRecord = await this.eventsService.queryKnownItemById(this.activeUserId(), eventId);
    if (!eventRecord) {
      this.confirmationDialogService.openInfo('This event is not available anymore.', {
        title: attachment.title || 'Shared event'
      });
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditor',
      row: this.activitiesService.buildEventDisplayRow(eventRecord, { activeUserId: this.activeUserId() }),
      readOnly: true
    });
  }

  private resolveViewableMessageAttachment(message: AppTypes.ChatPopupMessage): AppTypes.ChatMessageAttachment | null {
    if (message.deletedAtIso) {
      return null;
    }
    return (message.attachments ?? []).find(attachment =>
      (attachment.type === 'event' || attachment.type === 'asset' || attachment.type === 'link')
        && !this.isAttachmentUnavailable(attachment)
    ) ?? null;
  }

  private async resolvePersistableImageAttachment(
    chat: ChatRecord,
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

  private async persistVoiceClipByConfiguredMode(voiceKey: string): Promise<string | null> {
    const mimeType = this.voiceClipMimeType || 'audio/webm';
    if (this.activitiesContext.dataMode === 'demo') {
      try {
        await this.saveVoiceClipToIndexedDb(voiceKey, {
          dataUrl: this.voiceClipDataUrl,
          mimeType,
          durationSeconds: this.voiceRecorderSeconds,
          sizeBytes: this.voiceClipSizeBytes
        });
        this.voiceAttachmentSrcByKey[voiceKey] = this.voiceClipDataUrl;
        return `indexeddb:${voiceKey}`;
      } catch {
        this.voiceRecorderError = 'Voice clip could not be saved on this device.';
        return null;
      }
    }

    const session = this.session();
    const ownerId = `${session?.item.id ?? this.activeUserId() ?? 'chat'}`.trim();
    const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = this.dataUrlToFile(this.voiceClipDataUrl, `${voiceKey.replace(/[^a-zA-Z0-9._-]+/g, '-')}.${extension}`, mimeType);
    const upload = await this.httpMediaService.uploadAudio('chat', ownerId || 'chat', voiceKey, file);
    if (upload.uploaded && upload.audioUrl) {
      return upload.audioUrl;
    }
    this.voiceRecorderError = 'Voice upload failed.';
    return null;
  }

  private parsePollState(attachment: AppTypes.ChatMessageAttachment): ChatPollState {
    const fallbackOptions = `${attachment.subtitle ?? ''}`
      .split('\n')
      .map(option => option.trim())
      .filter(Boolean);
    try {
      const parsed = JSON.parse(`${attachment.description ?? ''}`);
      const question = `${parsed?.question ?? attachment.title ?? ''}`.trim();
      const options = Array.isArray(parsed?.options)
        ? parsed.options
            .map((option: unknown, index: number): ChatPollOptionState | null => {
              const value = option as Partial<ChatPollOptionState>;
              const text = `${value.text ?? ''}`.trim();
              if (!text) {
                return null;
              }
              return {
                id: `${value.id ?? `${attachment.id}:option:${index + 1}`}`,
                text,
                votes: Array.isArray(value.votes)
                  ? value.votes
                      .map((vote: unknown): ChatPollOptionState['votes'][number] | null => {
                        const voteValue = vote as { userId?: unknown; name?: unknown; initials?: unknown; gender?: unknown };
                        const userId = `${voteValue.userId ?? ''}`.trim();
                        if (!userId) {
                          return null;
                        }
                        return {
                          userId,
                          name: `${voteValue.name ?? ''}`.trim() || undefined,
                          initials: `${voteValue.initials ?? 'ME'}`.trim() || 'ME',
                          gender: this.normalizeChatUserGender(voteValue.gender)
                        };
                      })
                      .filter((vote: ChatPollOptionState['votes'][number] | null): vote is ChatPollOptionState['votes'][number] => vote !== null)
                  : []
              };
            })
            .filter((option: ChatPollOptionState | null): option is ChatPollOptionState => option !== null)
        : [];
      if (question && options.length > 0) {
        return { question, options };
      }
    } catch {
      // Older poll data may not be JSON; fall through to the attachment fields.
    }
    return {
      question: `${attachment.title ?? 'Poll'}`.trim() || 'Poll',
      options: fallbackOptions.map((option, index) => ({
        id: `${attachment.id}:option:${index + 1}`,
        text: option,
        votes: []
      }))
    };
  }

  private serializePollState(poll: ChatPollState): string {
    return JSON.stringify({
      question: poll.question,
      options: poll.options.map(option => ({
        id: option.id,
        text: option.text,
        votes: option.votes.map(vote => ({
          userId: vote.userId,
          name: vote.name,
          initials: vote.initials,
          gender: vote.gender
        }))
      }))
    });
  }

  private normalizeChatUserGender(value: unknown): AppTypes.ChatUserGender {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'deleted' || normalized === 'du') {
      return 'deleted';
    }
    return normalized === 'woman' || normalized.startsWith('w') || normalized.startsWith('f') ? 'woman' : 'man';
  }

  protected pollOwnVoteOptionId(attachment: AppTypes.ChatMessageAttachment): string {
    const activeUserId = this.activeUserId() || 'self';
    const poll = this.parsePollState(attachment);
    return poll.options.find(option => option.votes.some(vote => vote.userId === activeUserId))?.id ?? '';
  }

  private dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
    const [meta, encoded] = dataUrl.split(',', 2);
    const resolvedMimeType = (meta.match(/^data:([^;]+);base64$/)?.[1] ?? mimeType).trim();
    const binary = atob(encoded ?? '');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], filename, { type: resolvedMimeType });
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
    this.schedulePendingMessageTimeout(editingMessageId);
    if (session) {
      void this.activitiesContext.updateEventChatMessage(session.item, editingMessageId, { text })
        .then(updated => {
          if (updated) {
            this.clearPendingMessageTimeout(editingMessageId);
            this.clearPendingMessageState(editingMessageId);
          }
        })
        .catch(() => {
          return;
        });
    }
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
      const initialChat = session.item;
      const resolvedChatPromise = this.chatsService
        .resolveRepositoryEventServiceChat(initialChat)
        .catch(() => null);
      const messagesPromise = this.activitiesContext.loadEventChatMessages(initialChat);
      const [resolvedChat, nextMessages] = await Promise.all([resolvedChatPromise, messagesPromise]);
      if (this.loadedSessionKey !== sessionKey) {
        return this.chatThreadPageResult(query);
      }
      const chat = this.applyResolvedInitialChatItem(initialChat, resolvedChat, sessionKey);
      if (this.loadedSessionKey !== sessionKey) {
        return this.chatThreadPageResult(query);
      }
      this.allMessages = this.normalizeChatMessages(nextMessages)
        .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
      this.rebuildVisibleReadReceipts();
      this.syncEventChatSummaryFromLatestMessage();
      this.initialChatLoadedSessionKey = sessionKey;
      this.markLoadedChatThreadAsRead(chat, this.allMessages);
      await this.startLiveChatUpdates(chat, sessionKey);
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

  private applyResolvedInitialChatItem(
    chat: ChatRecord,
    resolvedChat: ChatRecord | null,
    sessionKey: string
  ): ChatRecord {
    if (!resolvedChat || this.loadedSessionKey !== sessionKey || resolvedChat.id !== chat.id) {
      return chat;
    }
    this.activitiesContext.patchEventChatSessionItem(current =>
      current.id === chat.id
        ? resolvedChat
        : current
    );
    this.syncSelectedChatHeader(resolvedChat);
    void this.refreshSelectedChatHeader(resolvedChat, sessionKey);
    return resolvedChat;
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
      total,
      context: this.chatHeaderContext ?? undefined
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

  private async startLiveChatUpdates(chat: ChatRecord, sessionKey: string): Promise<void> {
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

  private isPendingOutgoingChatMessage(message: AppTypes.ChatPopupMessage): boolean {
    const messageId = `${message.id ?? ''}`.trim();
    const clientId = `${message.clientId ?? ''}`.trim();
    return message.deliveryState === 'pending'
      && !!messageId
      && messageId === clientId
      && messageId.startsWith('pending:');
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
    if (this.confirmPendingStoredMessageEcho(normalizedMessage)) {
      return;
    }
    const matchedPendingId = this.matchPendingMessageId(normalizedMessage);
    if (matchedPendingId) {
      this.replacePendingMessage(matchedPendingId, normalizedMessage, shouldStickToEnd);
      return;
    }
    if (this.allMessages.some(existingMessage => this.isSameChatMessage(existingMessage, normalizedMessage))) {
      this.replaceExistingChatMessage(normalizedMessage);
      return;
    }
    this.flagFreshMessage(normalizedMessage.id);
    this.allMessages = this.deduplicateChatMessages([...this.allMessages, normalizedMessage])
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
      if (!this.isSameChatMessage(existingMessage, normalizedMessage)) {
        return existingMessage;
      }
      changed = true;
      const existingMessageId = `${existingMessage.id ?? ''}`.trim();
      const normalizedMessageId = `${normalizedMessage.id ?? ''}`.trim();
      return existingMessageId && normalizedMessageId && existingMessageId !== normalizedMessageId
        ? { ...normalizedMessage, id: existingMessageId }
        : normalizedMessage;
    });
    if (!changed) {
      return;
    }
    this.allMessages = this.deduplicateChatMessages(this.allMessages)
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(normalizedMessage);
    this.refreshVisibleChatThreadSurface();
    this.cdr.markForCheck();
  }

  private confirmPendingStoredMessageEcho(message: AppTypes.ChatPopupMessage): boolean {
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      return false;
    }
    const existing = this.allMessages.find(item => item.id === messageId);
    if (!existing || existing.deliveryState !== 'pending') {
      return false;
    }
    this.clearPendingMessageTimeout(messageId);
    this.clearPendingMessageState(messageId);
    this.syncEventChatSummaryFromMessage(existing);
    return true;
  }

  private isSameChatMessage(
    first: AppTypes.ChatPopupMessage,
    second: AppTypes.ChatPopupMessage
  ): boolean {
    const firstId = `${first.id ?? ''}`.trim();
    const secondId = `${second.id ?? ''}`.trim();
    if (firstId && secondId && firstId === secondId) {
      return true;
    }

    const firstClientId = `${first.clientId ?? ''}`.trim();
    const secondClientId = `${second.clientId ?? ''}`.trim();
    if (firstClientId && secondClientId && firstClientId === secondClientId) {
      return true;
    }

    const firstSentAtIso = `${first.sentAtIso ?? ''}`.trim();
    const secondSentAtIso = `${second.sentAtIso ?? ''}`.trim();
    if (!firstSentAtIso || firstSentAtIso !== secondSentAtIso) {
      return false;
    }

    return `${first.senderAvatar?.id ?? ''}`.trim() === `${second.senderAvatar?.id ?? ''}`.trim()
      && `${first.text ?? ''}`.trim() === `${second.text ?? ''}`.trim()
      && this.chatMessageAttachmentIdentity(first) === this.chatMessageAttachmentIdentity(second);
  }

  private deduplicateChatMessages(messages: readonly AppTypes.ChatPopupMessage[]): AppTypes.ChatPopupMessage[] {
    const deduped: AppTypes.ChatPopupMessage[] = [];
    const indexByKey = new Map<string, number>();
    for (const message of messages) {
      const keys = this.chatMessageIdentityKeys(message);
      const existingIndex = keys
        .map(key => indexByKey.get(key))
        .find((index): index is number => typeof index === 'number');
      if (existingIndex === undefined) {
        const nextIndex = deduped.length;
        deduped.push(message);
        keys.forEach(key => indexByKey.set(key, nextIndex));
        continue;
      }
      deduped[existingIndex] = this.mergeDuplicateChatMessages(deduped[existingIndex], message);
      this.chatMessageIdentityKeys(deduped[existingIndex]).forEach(key => indexByKey.set(key, existingIndex));
    }
    return deduped;
  }

  private chatMessageIdentityKeys(message: AppTypes.ChatPopupMessage): string[] {
    const id = `${message.id ?? ''}`.trim();
    const clientId = `${message.clientId ?? ''}`.trim();
    return [
      id ? `id:${id}` : '',
      clientId ? `client:${clientId}` : ''
    ].filter(Boolean);
  }

  private mergeDuplicateChatMessages(
    existing: AppTypes.ChatPopupMessage,
    candidate: AppTypes.ChatPopupMessage
  ): AppTypes.ChatPopupMessage {
    const existingPending = existing.deliveryState === 'pending' || existing.deliveryState === 'timed-out';
    const candidatePending = candidate.deliveryState === 'pending' || candidate.deliveryState === 'timed-out';
    const preferred = candidatePending && !existingPending ? existing : candidate;
    const fallback = preferred === existing ? candidate : existing;
    const preferredReactions = preferred.reactions ?? [];
    const fallbackReactions = fallback.reactions ?? [];
    return {
      ...preferred,
      clientId: preferred.clientId || fallback.clientId,
      reactions: preferredReactions.length >= fallbackReactions.length ? preferredReactions : fallbackReactions
    };
  }

  private chatMessageAttachmentIdentity(message: AppTypes.ChatPopupMessage): string {
    return (message.attachments ?? [])
      .map(attachment => [
        `${attachment.id ?? ''}`.trim(),
        `${attachment.type ?? ''}`.trim(),
        `${attachment.title ?? ''}`.trim()
      ].join(':'))
      .join(',');
  }

  private handleLiveChatEvent(chat: ChatRecord, event: AppTypes.ChatLiveEvent): void {
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
    if (event.type === 'error') {
      this.markPendingMessageTimedOut(`${event.messageId ?? event.clientId ?? ''}`.trim());
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
    const hasQueuedReaction = this.queuedReactionByPendingMessageId.has(pendingMessageId);
    const queuedReactionEmoji = hasQueuedReaction
      ? (this.queuedReactionByPendingMessageId.get(pendingMessageId) ?? null)
      : null;
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
      clientId: pendingClientId || normalizedMessage.clientId,
      reactions: hasQueuedReaction ? (pendingMessage?.reactions ?? []) : normalizedMessage.reactions,
      deliveryState: hasQueuedReaction ? 'pending' : normalizedMessage.deliveryState
    };
    let nextMessages = [...this.allMessages];
    const duplicateIndex = nextMessages.findIndex((existingMessage, index) => index !== pendingIndex && existingMessage.id === nextMessage.id);
    if (duplicateIndex >= 0) {
      nextMessages[duplicateIndex] = nextMessage;
      nextMessages = nextMessages.filter((_existingMessage, index) => index !== pendingIndex);
    } else {
      nextMessages[pendingIndex] = nextMessage;
    }

    this.allMessages = this.deduplicateChatMessages(nextMessages)
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(nextMessage);

    this.refreshVisibleChatThreadSurface();

    if (stickToEnd) {
      this.scheduleChatThreadScrollToEnd();
    }

    this.cdr.markForCheck();
    if (hasQueuedReaction) {
      this.flushQueuedReactionForStoredMessage(pendingMessageId, nextMessage.id, queuedReactionEmoji);
    }
    return true;
  }

  private flushQueuedReactionForStoredMessage(
    pendingMessageId: string,
    storedMessageId: string,
    reactionEmoji: string | null
  ): void {
    this.queuedReactionByPendingMessageId.delete(pendingMessageId);
    const normalizedStoredMessageId = `${storedMessageId ?? ''}`.trim();
    if (!normalizedStoredMessageId) {
      return;
    }
    const session = this.session();
    if (!session) {
      this.clearPendingMessageState(normalizedStoredMessageId);
      return;
    }
    this.schedulePendingMessageTimeout(normalizedStoredMessageId);
    const mutationSequence = (this.reactionMutationSequenceByMessageId.get(normalizedStoredMessageId) ?? 0) + 1;
    this.reactionMutationSequenceByMessageId.set(normalizedStoredMessageId, mutationSequence);
    void this.activitiesContext.updateEventChatMessage(session.item, normalizedStoredMessageId, { reactionEmoji })
      .then(updated => {
        if (this.reactionMutationSequenceByMessageId.get(normalizedStoredMessageId) !== mutationSequence) {
          return;
        }
        if (updated) {
          this.clearPendingMessageTimeout(normalizedStoredMessageId);
          this.clearPendingMessageState(normalizedStoredMessageId);
        }
        this.reactionMutationSequenceByMessageId.delete(normalizedStoredMessageId);
      })
      .catch(() => {
        if (this.reactionMutationSequenceByMessageId.get(normalizedStoredMessageId) === mutationSequence) {
          this.reactionMutationSequenceByMessageId.delete(normalizedStoredMessageId);
        }
      });
  }

  private async resyncChatThreadFromServer(chat: ChatRecord): Promise<void> {
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

  private clearPendingMessageState(messageId: string): void {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedMessageId) {
      return;
    }
    let changed = false;
    this.allMessages = this.allMessages.map(message => {
      if (message.id !== normalizedMessageId || message.deliveryState !== 'pending') {
        return message;
      }
      changed = true;
      return {
        ...message,
        deliveryState: undefined
      };
    });
    if (!changed) {
      return;
    }
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
    chat: ChatRecord,
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
    return messages.map((message, index) => this.normalizeChatMessage(message, index));
  }

  private normalizeChatMessage(
    message: AppTypes.ChatPopupMessage,
    fallbackIndex: number | null = null
  ): AppTypes.ChatPopupMessage {
    const normalizedMessage = this.withResolvedChatMessageId(message, fallbackIndex);
    if (normalizedMessage.deletedAtIso) {
      return {
        ...normalizedMessage,
        text: '',
        readBy: [],
        reactions: [],
        attachments: [],
        replyTo: null,
        editedAtIso: null,
        pinnedAtIso: null,
        pinnedByUserId: null
      };
    }
    if (!normalizedMessage.mine) {
      return normalizedMessage;
    }
    const senderPresentation = this.resolveOptimisticSenderPresentation(normalizedMessage.senderAvatar?.id || this.activeUserId());
    const senderAvatar = normalizedMessage.senderAvatar;
    return {
      ...normalizedMessage,
      sender: senderPresentation.sender,
      senderAvatar: {
        id: `${senderAvatar?.id ?? ''}`.trim() || senderPresentation.senderAvatar.id,
        initials: `${senderAvatar?.initials ?? ''}`.trim() || senderPresentation.senderAvatar.initials,
        gender: senderAvatar?.gender ?? senderPresentation.senderAvatar.gender,
        imageUrl: senderAvatar?.imageUrl ?? senderPresentation.senderAvatar.imageUrl ?? null
      }
    };
  }

  private withResolvedChatMessageId(
    message: AppTypes.ChatPopupMessage,
    fallbackIndex: number | null
  ): AppTypes.ChatPopupMessage {
    const messageId = `${message.id ?? ''}`.trim();
    if (messageId) {
      return messageId === message.id ? message : { ...message, id: messageId };
    }
    const attachmentKey = (message.attachments ?? [])
      .map(attachment => [
        `${attachment.id ?? ''}`.trim(),
        `${attachment.type ?? ''}`.trim(),
        `${attachment.title ?? ''}`.trim()
      ].join(':'))
      .join(',');
    const seed = [
      `${this.session()?.item.id ?? ''}`.trim(),
      `${message.senderAvatar?.id ?? ''}`.trim(),
      `${message.sentAtIso ?? ''}`.trim(),
      `${message.text ?? ''}`.trim(),
      attachmentKey
    ].join('|');
    return {
      ...message,
      id: `chat-message:${AppUtils.hashText(seed)}`
    };
  }

  protected chatAttachmentSummary(message: AppTypes.ChatPopupMessage): string {
    const firstAttachment = message.attachments?.[0];
    if (!firstAttachment) {
      return '';
    }
    switch (firstAttachment.type) {
      case 'image':
        return 'Sent an image';
      case 'event':
        return this.attachmentReferenceLabel(firstAttachment, 'Event');
      case 'asset':
        return this.attachmentReferenceLabel(firstAttachment, 'Asset');
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
        gender: activeUser?.gender ?? 'man',
        imageUrl: activeUser?.images?.map(image => image.trim()).find(Boolean) ?? null
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
    if (this.voiceComposerOpen) {
      this.resetVoiceRecorder();
    }
    if (this.pollComposerOpen) {
      this.closePollComposer();
    }
    this.selectedMessageId = '';
    this.selectedMessageToolsDown = false;
    this.quickReactionMessageId = '';
    this.quickReactionOpenDown = false;
    this.emojiPickerMessageId = '';
    this.emojiPickerQuery = '';
    this.messageActionMenuId = '';
    this.reactionDetailsMessageId = '';
    this.closePollVoteDialog();
    if (!options.keepEditing) {
      this.editingMessageId = '';
    }
  }

  private blurEventTarget(event?: Event): void {
    const target = event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event?.target instanceof HTMLElement
        ? event.target
        : null;
    target?.blur();
  }

  private async finalizeVoiceRecording(): Promise<void> {
    this.clearVoiceRecorderTimer();
    this.stopVoiceRecorderStream();
    const blob = new Blob(this.voiceRecorderChunks, { type: this.voiceClipMimeType || 'audio/webm' });
    this.voiceClipSizeBytes = blob.size;
    this.voiceClipDataUrl = blob.size > 0 ? await this.blobToDataUrl(blob) : '';
    this.voiceRecordingState = this.voiceClipDataUrl ? 'recorded' : 'idle';
    this.voiceRecorder = null;
    this.voiceRecorderChunks = [];
    if (!this.voiceClipDataUrl) {
      this.voiceRecorderError = 'No audio was recorded.';
    }
    this.cdr.markForCheck();
  }

  private resetVoiceRecorder(options: { keepOpen?: boolean; keepError?: boolean } = {}): void {
    this.clearVoiceRecorderTimer();
    const recorder = this.voiceRecorder;
    this.voiceRecorder = null;
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    this.stopVoiceRecorderStream();
    this.voiceRecorderChunks = [];
    this.voiceRecordingState = 'idle';
    this.voiceRecorderSeconds = 0;
    if (!options.keepError) {
      this.voiceRecorderError = '';
    }
    this.voiceClipDataUrl = '';
    this.voiceClipMimeType = '';
    this.voiceClipSizeBytes = 0;
    this.voiceComposerOpen = options.keepOpen === true;
  }

  private clearVoiceRecorderTimer(): void {
    if (!this.voiceRecorderTimer) {
      return;
    }
    clearInterval(this.voiceRecorderTimer);
    this.voiceRecorderTimer = null;
  }

  private stopVoiceRecorderStream(): void {
    this.voiceRecorderStream?.getTracks().forEach(track => track.stop());
    this.voiceRecorderStream = null;
  }

  private preferredVoiceRecorderOptions(): MediaRecorderOptions | undefined {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    const mimeType = candidates.find(candidate => {
      try {
        return MediaRecorder.isTypeSupported(candidate);
      } catch {
        return false;
      }
    });
    return mimeType ? { mimeType } : undefined;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(`${reader.result ?? ''}`);
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read voice clip.'));
      reader.readAsDataURL(blob);
    });
  }

  private async saveVoiceClipToIndexedDb(key: string, clip: StoredVoiceClip): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(this.voiceClipStorageKey(key), clip);
  }

  private async loadVoiceClipFromIndexedDb(key: string): Promise<StoredVoiceClip | null> {
    return await this.memoryDb.readIndexedDbTableEntry<StoredVoiceClip>(this.voiceClipStorageKey(key));
  }

  private voiceClipStorageKey(key: string): string {
    return `chatVoiceClip:${key}`;
  }

  protected formatVoiceDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  private bindChatThreadScrollDismissListener(): void {
    const scrollElement = this.chatThreadSmartList?.scrollElement() ?? null;
    if (!scrollElement || scrollElement === this.chatThreadScrollDismissElement) {
      return;
    }
    this.clearChatThreadScrollDismissListener();
    this.chatThreadScrollDismissElement = scrollElement;
    scrollElement.addEventListener('scroll', this.dismissMessageUiOnChatScroll, { passive: true });
  }

  private clearChatThreadScrollDismissListener(): void {
    this.chatThreadScrollDismissElement?.removeEventListener('scroll', this.dismissMessageUiOnChatScroll);
    this.chatThreadScrollDismissElement = null;
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

  private syncSelectedChatHeader(chat: ChatRecord | null): void {
    if (!chat) {
      this.chatHeaderContext = null;
      this.selectedChatNavigationState = null;
      this.resolvedChatEventRecord = null;
      this.resolvedChatEventRecordKey = '';
      this.resolvedChatResourceState = null;
      this.resolvedChatResourceStateKey = '';
      return;
    }
    this.selectedChatNavigationState = this.buildSelectedChatNavigationState(chat);
    this.chatHeaderContext = this.buildSelectedChatHeaderContext(chat, this.selectedChatNavigationState);
  }

  private async refreshSelectedChatHeader(chat: ChatRecord, sessionKey: string | null): Promise<void> {
    if (!sessionKey || this.loadedSessionKey !== sessionKey) {
      return;
    }
    const eventId = `${chat.eventId ?? ''}`.trim();
    if (eventId && this.resolvedChatEventRecordKey !== eventId) {
      const record = await this.eventsService.queryKnownItemById(this.activeUserId(), eventId).catch(() => null);
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      this.resolvedChatEventRecord = record;
      this.resolvedChatEventRecordKey = eventId;
      this.syncSelectedChatHeader(chat);
      this.cdr.markForCheck();
    }

    const state = this.selectedChatNavigationState;
    const ownerId = `${state?.eventRow?.id ?? chat.eventId ?? ''}`.trim();
    const subEventId = `${state?.subEvent?.id ?? ''}`.trim();
    const resourceKey = ownerId && subEventId ? `${ownerId}:${subEventId}` : '';
    if (!resourceKey || this.resolvedChatResourceStateKey === resourceKey) {
      return;
    }
    const resourceState = await this.activityResourcesService
      .querySubEventResourceState(ownerId, subEventId)
      .catch(() => null);
    if (this.loadedSessionKey !== sessionKey) {
      return;
    }
    this.resolvedChatResourceState = ActivityResourceBuilder.cloneState(resourceState);
    this.resolvedChatResourceStateKey = resourceKey;
    this.syncSelectedChatHeader(chat);
    this.cdr.markForCheck();
  }

  private buildSelectedChatHeaderContext(
    chat: ChatRecord,
    state: SelectedChatNavigationState | null
  ): AppTypes.PopupHeaderContext {
    const baseContext = this.chatsService.buildChatPopupHeaderContext(chat, { includeThumbs: true });
    const controls = [...(baseContext.controls ?? []).map(control => ({ ...control }))];
    if (!this.isBlockedSupportChat() && chat.channelType !== 'serviceEvent') {
      controls.push(this.buildSelectedChatContextControl(chat, state));
    }
    return {
      ...baseContext,
      controls
    };
  }

  private buildSelectedChatContextControl(
    chat: ChatRecord,
    state: SelectedChatNavigationState | null
  ): AppTypes.PopupHeaderControl {
    const primaryControl = this.buildSelectedChatPrimaryControl(chat, state);
    const menu = state ? this.buildSelectedChatControlMenu(state, primaryControl) : null;
    return {
      ...primaryControl,
      id: 'chat-context',
      menu
    };
  }

  private buildSelectedChatPrimaryControl(
    chat: ChatRecord,
    state: SelectedChatNavigationState | null
  ): AppTypes.PopupHeaderControl {
    const channelType = state?.channelType ?? this.chatChannelType(chat);
    const label = channelType === 'groupSubEvent'
      ? (state?.group?.label ?? state?.subEvent?.name ?? 'Group')
      : channelType === 'optionalSubEvent'
        ? (state?.subEvent?.name ?? 'Sub-event')
        : 'View Event';
    const icon = channelType === 'groupSubEvent'
      ? 'groups'
      : channelType === 'optionalSubEvent'
        ? 'event_available'
        : 'event';
    const badgeValue = this.selectedChatActionBadgeCount(chat, state);
    return {
      id: 'chat-primary',
      label,
      visual: { kind: 'icon', icon },
      badge: badgeValue > 0 ? { value: badgeValue, tone: 'danger' } : null,
      lookup: {
        type: 'chatPrimary',
        id: `${state?.eventRow?.id ?? chat.eventId ?? chat.id}`.trim()
      }
    };
  }

  private buildSelectedChatControlMenu(
    state: SelectedChatNavigationState,
    primaryControl: AppTypes.PopupHeaderControl
  ): AppTypes.PopupHeaderControlMenu | null {
    if (!state.subEvent || (state.channelType !== 'optionalSubEvent' && state.channelType !== 'groupSubEvent')) {
      return null;
    }
    const assetControls = (['Car', 'Accommodation', 'Supplies'] as const)
      .map(type => this.buildResourceControl(state.subEvent as AppTypes.SubEventFormItem, state, type));
    return {
      title: state.group?.label ?? state.subEvent.name,
      groups: [
        {
          id: 'primary',
          controls: [{ ...primaryControl }]
        },
        {
          id: 'members',
          controls: [this.buildResourceControl(state.subEvent, state, 'Members')]
        },
        {
          id: 'assets',
          label: 'Assets',
          controls: assetControls
        }
      ]
    };
  }

  private buildResourceControl(
    subEvent: AppTypes.SubEventFormItem,
    state: SelectedChatNavigationState,
    type: SelectedChatResourceType
  ): AppTypes.PopupHeaderControl {
    const pending = this.resourcePendingCount(subEvent, state, type);
    return {
      id: `chat-resource-${type.toLowerCase()}`,
      label: this.resourceTypeLabel(type),
      summary: this.resourceSummary(subEvent, state, type),
      visual: { kind: 'icon', icon: this.resourceTypeIcon(type) },
      badge: pending > 0 ? { value: pending, tone: 'danger' } : null,
      lookup: {
        type: 'chatResource',
        id: type
      }
    };
  }

  private buildSelectedChatNavigationState(chat: ChatRecord): SelectedChatNavigationState | null {
    const eventId = `${chat.eventId ?? ''}`.trim();
    const eventRecord = this.resolveSelectedChatEventRecord(chat);
    const eventRow = eventRecord
      ? this.activitiesService.buildEventDisplayRow(eventRecord, { activeUserId: this.activeUserId() })
      : this.chatEventFallbackRow(chat);
    const rawSubEvent = this.resolveSelectedChatSubEvent(chat, eventRecord);
    const resourceState = rawSubEvent && eventId
      ? this.resolveSelectedChatResourceState(eventId, rawSubEvent.id)
      : null;
    const assetCardsByType = ActivityResourceBuilder.cloneFallbackAssetCardsByType(
      resourceState?.fallbackAssetCardsByType
    );
    const assetCards = this.flattenAssetCards(assetCardsByType);
    const subEvent = rawSubEvent
      ? this.syncSubEventResourceCounts(this.cloneSubEvent(rawSubEvent), resourceState, assetCards)
      : null;
    return {
      channelType: this.chatChannelType(chat),
      eventRow,
      subEvent,
      group: this.resolveSelectedChatGroup(chat, subEvent),
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(resourceState?.assetAssignmentIds),
      assetCardsByType
    };
  }

  private chatChannelType(chat: ChatRecord): AppTypes.ChatChannelType {
    const channelType = `${chat.channelType ?? ''}`.trim();
    if (
      channelType === 'general'
      || channelType === 'mainEvent'
      || channelType === 'optionalSubEvent'
      || channelType === 'groupSubEvent'
      || channelType === 'serviceEvent'
    ) {
      return channelType;
    }
    if (chat.serviceContext === 'event' || chat.serviceContext === 'asset' || chat.serviceContext === 'notification') {
      return 'serviceEvent';
    }
    if (`${chat.groupId ?? ''}`.trim()) {
      return 'groupSubEvent';
    }
    if (`${chat.subEventId ?? ''}`.trim()) {
      return 'optionalSubEvent';
    }
    return `${chat.eventId ?? ''}`.trim() ? 'mainEvent' : 'general';
  }

  private resolveSelectedChatEventRecord(chat: ChatRecord): DemoEventRecord | null {
    const eventId = `${chat.eventId ?? ''}`.trim();
    if (!eventId) {
      return null;
    }
    if (this.resolvedChatEventRecordKey === eventId) {
      return this.resolvedChatEventRecord;
    }
    return this.eventsService.peekKnownItemById(this.activeUserId(), eventId);
  }

  private resolveSelectedChatSubEvent(
    chat: ChatRecord,
    eventRecord: DemoEventRecord | null
  ): AppTypes.SubEventFormItem | null {
    const subEventId = `${chat.subEventId ?? ''}`.trim();
    if (!subEventId) {
      return null;
    }
    return eventRecord?.subEvents?.find(subEvent => subEvent.id === subEventId) ?? null;
  }

  private resolveSelectedChatGroup(
    chat: ChatRecord,
    subEvent: AppTypes.SubEventFormItem | null
  ): SelectedChatGroupState | null {
    const groupId = `${chat.groupId ?? ''}`.trim();
    if (!groupId || !subEvent?.groups?.length) {
      return null;
    }
    const group = subEvent.groups.find(item => item.id === groupId);
    return group
      ? {
          id: group.id,
          label: group.name
        }
      : null;
  }

  private resolveSelectedChatResourceState(
    ownerId: string,
    subEventId: string
  ): AppTypes.ActivitySubEventResourceState | null {
    const resourceKey = `${ownerId}:${subEventId}`;
    if (this.resolvedChatResourceStateKey === resourceKey) {
      return ActivityResourceBuilder.cloneState(this.resolvedChatResourceState);
    }
    return ActivityResourceBuilder.cloneState(
      this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId)
    );
  }

  private syncSubEventResourceCounts(
    subEvent: AppTypes.SubEventFormItem,
    state: AppTypes.ActivitySubEventResourceState | null,
    assetCards: readonly AppTypes.AssetCard[]
  ): AppTypes.SubEventFormItem {
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const accepted = ActivityResourceBuilder.resourceAcceptedCount(subEvent, type, state, assetCards);
      const pending = ActivityResourceBuilder.resourcePendingCount(subEvent, type, state, assetCards);
      const bounds = ActivityResourceBuilder.resourceCapacityBounds(subEvent, type, state, assetCards, accepted, pending);
      if (type === 'Car') {
        subEvent.carsAccepted = accepted;
        subEvent.carsPending = pending;
        subEvent.carsCapacityMin = bounds.capacityMin;
        subEvent.carsCapacityMax = bounds.capacityMax;
      } else if (type === 'Accommodation') {
        subEvent.accommodationAccepted = accepted;
        subEvent.accommodationPending = pending;
        subEvent.accommodationCapacityMin = bounds.capacityMin;
        subEvent.accommodationCapacityMax = bounds.capacityMax;
      } else {
        subEvent.suppliesAccepted = accepted;
        subEvent.suppliesPending = pending;
        subEvent.suppliesCapacityMin = bounds.capacityMin;
        subEvent.suppliesCapacityMax = bounds.capacityMax;
      }
    }
    return subEvent;
  }

  private cloneSubEvent(subEvent: AppTypes.SubEventFormItem): AppTypes.SubEventFormItem {
    return {
      ...subEvent,
      groups: subEvent.groups?.map(group => ({ ...group })) ?? []
    };
  }

  private flattenAssetCards(assetCardsByType: AppTypes.SubEventAssetCardsByType): AppTypes.AssetCard[] {
    return (['Car', 'Accommodation', 'Supplies'] as const)
      .flatMap(type => assetCardsByType[type] ?? []);
  }

  private selectedChatActionToneClass(): SelectedChatActionTone {
    const channelType = this.selectedChatNavigationState?.channelType;
    if (channelType === 'groupSubEvent') {
      return 'popup-chat-context-btn-tone-group';
    }
    if (channelType === 'optionalSubEvent') {
      return 'popup-chat-context-btn-tone-optional';
    }
    return 'popup-chat-context-btn-tone-main-event';
  }

  private selectedChatActionBadgeCount(
    chat: ChatRecord,
    state: SelectedChatNavigationState | null
  ): number {
    if (state?.subEvent && (state.channelType === 'optionalSubEvent' || state.channelType === 'groupSubEvent')) {
      return this.subEventPendingTotal(state.subEvent);
    }
    const eventPending = Math.max(0, Math.trunc(Number(state?.eventRow?.pendingMembers) || 0));
    const eventRecord = this.resolveSelectedChatEventRecord(chat);
    const subEventPending = eventRecord?.subEvents?.reduce((sum, subEvent) => {
      const cloned = this.cloneSubEvent(subEvent);
      const resourceState = this.resolveSelectedChatResourceState(eventRecord.id, cloned.id);
      const cards = this.flattenAssetCards(ActivityResourceBuilder.cloneFallbackAssetCardsByType(
        resourceState?.fallbackAssetCardsByType
      ));
      return sum + this.subEventPendingTotal(this.syncSubEventResourceCounts(cloned, resourceState, cards));
    }, 0) ?? 0;
    return eventPending + subEventPending;
  }

  private subEventPendingTotal(subEvent: AppTypes.SubEventFormItem): number {
    return this.chatCountValue(subEvent.membersPending)
      + this.chatCountValue(subEvent.carsPending)
      + this.chatCountValue(subEvent.accommodationPending)
      + this.chatCountValue(subEvent.suppliesPending);
  }

  private chatCountValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private resourceSummary(
    subEvent: AppTypes.SubEventFormItem,
    state: SelectedChatNavigationState,
    type: SelectedChatResourceType
  ): string {
    if (type === 'Members') {
      const accepted = this.chatCountValue(subEvent.membersAccepted);
      const min = this.chatCountValue(subEvent.capacityMin);
      const max = Math.max(min, this.chatCountValue(subEvent.capacityMax), accepted);
      return `${accepted} / ${min} - ${max}`;
    }
    const accepted = this.resourceAcceptedCount(subEvent, state, type);
    const pending = this.resourcePendingCount(subEvent, state, type);
    const bounds = ActivityResourceBuilder.resourceCapacityBounds(
      subEvent,
      type,
      this.resolveSelectedChatResourceState(`${state.eventRow?.id ?? ''}`, subEvent.id),
      this.flattenAssetCards(state.assetCardsByType),
      accepted,
      pending
    );
    return `${accepted} / ${bounds.capacityMin} - ${bounds.capacityMax}`;
  }

  private resourceAcceptedCount(
    subEvent: AppTypes.SubEventFormItem,
    state: SelectedChatNavigationState,
    type: AppTypes.AssetType
  ): number {
    return ActivityResourceBuilder.resourceAcceptedCount(
      subEvent,
      type,
      this.resolveSelectedChatResourceState(`${state.eventRow?.id ?? ''}`, subEvent.id),
      this.flattenAssetCards(state.assetCardsByType)
    );
  }

  private resourcePendingCount(
    subEvent: AppTypes.SubEventFormItem,
    state: SelectedChatNavigationState,
    type: SelectedChatResourceType
  ): number {
    if (type === 'Members') {
      return this.chatCountValue(subEvent.membersPending);
    }
    return ActivityResourceBuilder.resourcePendingCount(
      subEvent,
      type,
      this.resolveSelectedChatResourceState(`${state.eventRow?.id ?? ''}`, subEvent.id),
      this.flattenAssetCards(state.assetCardsByType)
    );
  }

  private popupControlResourceType(control: AppTypes.PopupHeaderControl): SelectedChatResourceType | null {
    if (control.lookup?.type !== 'chatResource') {
      return null;
    }
    const id = `${control.lookup.id ?? ''}`.trim();
    return id === 'Members' || id === 'Car' || id === 'Accommodation' || id === 'Supplies'
      ? id
      : null;
  }

  private resourceTypeClass(type: SelectedChatResourceType): string {
    return `event-subevent-badge-${type.toLowerCase()}`;
  }

  private resourceTypeIcon(type: SelectedChatResourceType): string {
    if (type === 'Members') {
      return 'groups';
    }
    if (type === 'Car') {
      return 'directions_car';
    }
    if (type === 'Accommodation') {
      return 'apartment';
    }
    return 'inventory_2';
  }

  private resourceTypeLabel(type: SelectedChatResourceType): string {
    return type === 'Accommodation' ? 'Property' : type;
  }

  private firstAvailableAssetType(): AppTypes.AssetType | null {
    const state = this.selectedChatNavigationState;
    if (!state) {
      return null;
    }
    return (['Car', 'Accommodation', 'Supplies'] as const)
      .find(type => (state.assetCardsByType[type]?.length ?? 0) > 0)
      ?? null;
  }

  private chatEventRow(): AppTypes.ActivityListRow | null {
    const session = this.session();
    return session ? this.chatEventFallbackRow(session.item) : null;
  }

  private chatEventFallbackRow(chat: ChatRecord): AppTypes.ActivityListRow | null {
    if (!chat.eventId) {
      return null;
    }
    const eventId = chat.eventId;
    const title = chat.title;
    const subtitle = chat.lastMessage || 'Chat-linked event';
    const activity = Math.max(0, Math.trunc(Number(chat.unread) || 0));
    return {
      id: eventId,
      type: 'events',
      title,
      subtitle,
      detail: 'From chat',
      dateIso: new Date().toISOString(),
      distanceMetersExact: 0,
      unread: activity,
      metricScore: activity,
      avatarInitials: AppUtils.initialsFromText(title)
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
    const target = this.messagePlacementTarget(event);
    const scrollElement = this.chatThreadSmartList?.scrollElement();
    if (!target || !scrollElement) {
      return false;
    }
    const targetRect = target.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    return (scrollRect.bottom - targetRect.bottom) < 180 && (targetRect.top - scrollRect.top) > 160;
  }

  private shouldOpenMessageToolsDown(event?: Event): boolean {
    const target = this.messagePlacementTarget(event);
    const scrollElement = this.chatThreadSmartList?.scrollElement();
    if (!target || !scrollElement) {
      return false;
    }
    const targetRect = target.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    return (targetRect.top - scrollRect.top) < 44;
  }

  private shouldOpenQuickReactionsDown(event?: Event): boolean {
    const target = this.messagePlacementTarget(event);
    const scrollElement = this.chatThreadSmartList?.scrollElement();
    if (!target || !scrollElement) {
      return false;
    }
    const targetRect = target.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    return (targetRect.top - scrollRect.top) < 92;
  }

  private messagePlacementTarget(event?: Event): HTMLElement | null {
    const rawTarget = event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event?.target instanceof HTMLElement
        ? event.target
        : null;
    if (!rawTarget) {
      return null;
    }
    return rawTarget.closest<HTMLElement>('.chat-bubble')
      ?? rawTarget.closest<HTMLElement>('.chat-message')
      ?? rawTarget;
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

  private ensureChatThreadMessageVisible(messageId: string): boolean {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedMessageId) {
      return false;
    }
    const targetIndex = this.allMessages.findIndex(message => `${message.id ?? ''}`.trim() === normalizedMessageId);
    if (targetIndex < 0) {
      return false;
    }
    const smartList = this.chatThreadSmartList;
    const visibleCount = smartList?.itemsSnapshot().length ?? 0;
    if (!smartList || targetIndex < visibleCount) {
      return true;
    }
    smartList.replaceVisibleItems(
      this.allMessages.slice(0, targetIndex + 1),
      { total: this.allMessages.length }
    );
    return true;
  }

  private replyReferenceText(message: AppTypes.ChatPopupMessage): string {
    if (message.text?.trim()) {
      return message.text.trim();
    }
    const firstAttachment = message.attachments?.[0];
    if (firstAttachment?.type === 'image') {
      return 'Image';
    }
    if (firstAttachment?.type === 'event') {
      return this.attachmentReferenceLabel(firstAttachment, 'Event');
    }
    if (firstAttachment?.type === 'asset') {
      return this.attachmentReferenceLabel(firstAttachment, 'Asset');
    }
    return this.chatAttachmentSummary(message) || 'Message';
  }

  private attachmentReferenceLabel(attachment: AppTypes.ChatMessageAttachment, fallbackType: string): string {
    const parts = this.attachmentReferenceParts(attachment, fallbackType);
    return [parts.title, parts.meta].filter(Boolean).join(' · ') || fallbackType;
  }

  private attachmentReferenceParts(attachment: AppTypes.ChatMessageAttachment, fallbackType: string): { title: string; meta: string } {
    const title = `${attachment.title ?? ''}`.trim();
    const subtitle = `${attachment.subtitle ?? ''}`.trim();
    const typeLabel = attachment.type === 'event'
      ? 'Event'
      : attachment.type === 'asset'
        ? 'Asset'
        : fallbackType;
    return {
      title: [typeLabel, title].filter(Boolean).join(' · ') || typeLabel,
      meta: subtitle
    };
  }

  private capitalize(value: string): string {
    const normalized = `${value ?? ''}`.trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
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

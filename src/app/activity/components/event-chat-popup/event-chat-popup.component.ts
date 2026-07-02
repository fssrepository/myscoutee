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
import {
  CommonModule,
  Location
} from '@angular/common';
import {
  FormsModule
} from '@angular/forms';
import {
  MatButtonModule
} from '@angular/material/button';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  from,
  of
} from 'rxjs';

import type * as AppUiTypes from '../../../shared/ui/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import {
  AppUtils,
  type AsciiEmojiConversion
} from '../../../shared/app-utils';
import type { EventChatSession } from '../../../shared/ui/context/stores/activities-popup.store';
import {
  ActivitiesPopupStore
} from '../../../shared/ui/context/stores/activities-popup.store';
import {
  ActivityResourceBuilder,
  ActivityResourcesService,
  ChatsService,
  ChatVoiceClipsService,
  EventsService,
  MediaService,
  ShareTokensService
} from '../../../shared/core';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import type { ActivityEventRecord } from '../../../shared/core/contracts/activity.interface';
import {
  ASSET_TYPES,
  type AssetType,
  type SubEventResourceFilter
} from '../../../shared/core/common/constants';
import {
  AppMenuComponent,
  AppMenuTriggerComponent,
  CounterBadgePipe,
  SmartListComponent,
  type AppMenuGroup,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';

import type * as AppDTOs from '../../../shared/core/contracts';
import type * as AppConstants from '../../../shared/core/common/constants';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
import { EventSubeventsPopupStore } from '../../../shared/ui/context/stores/event-subevents-popup.store';
import {
  SubEventResourcePopupStore,
  type SubEventResourceMetricsUpdate,
  type SubEventResourcePopupRequest
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import {
  ActivityEventInfoCardMenuConverter,
  type ActivityEventInfoCardMenuSubject
} from '../../../shared/ui/converters';
interface ChatThreadFilters {
  revision?: number;
  sessionKey?: string;
}

interface ChatPollOptionState {
  id: string;
  text: string;
  votes: Array<{
    userId: string;
    name?: string;
    initials: string;
    gender: ContractTypes.ChatUserGender;
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

type SelectedChatResourceType = 'Members' | AppConstants.AssetType;
type SubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
type SubEventAssetCard = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  description?: string;
  details?: string;
};
type SubEventAssetCardsByType = Partial<Record<AssetType, SubEventAssetCard[]>>;

type ChatMenuContext =
  | { menu: 'chat-context'; control: AppUiTypes.PopupHeaderControl }
  | { menu: 'composer'; action: 'image' | 'voice' | 'poll' | 'event' | 'asset' }
  | { menu: 'message-action'; message: ContractTypes.ChatPopupMessage; action: 'view' | 'reply' | 'edit' | 'unsend' | 'pin' | 'report' };

interface SelectedChatGroupState {
  id: string;
  label: string;
  source?: string | null;
  accepted?: number;
  pending?: number;
  capacityMin?: number;
  capacityMax?: number;
}

interface SelectedChatNavigationState {
  channelType: ContractTypes.ChatChannelType;
  eventId: string | null;
  eventTarget: ContractTypes.EventEditorTarget;
  eventTitle: string | null;
  eventPendingMembers: number;
  subEvent: ContractTypes.SubEventDTO | null;
  group: SelectedChatGroupState | null;
  assetAssignmentIds: SubEventAssetAssignmentIds;
  assetCardsByType: SubEventAssetCardsByType;
}

@Component({
  selector: 'app-event-chat-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuTriggerComponent,
    SmartListComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-chat-popup.component.html',
  styleUrl: './event-chat-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventChatPopupComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  protected readonly memberMenuStore = inject(MemberMenuStore);
  protected readonly eventSubeventsStore = inject(EventSubeventsPopupStore);
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly chatsService = inject(ChatsService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly eventsService = inject(EventsService);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly chatVoiceClipsService = inject(ChatVoiceClipsService);
  private readonly dialogStore = inject(DialogStore);
  private readonly mediaService = inject(MediaService);
  private readonly profileStore = inject(ProfileStore);
  private readonly location = inject(Location);

  protected readonly session = computed(() => this.activitiesStore.eventChatSession());
  protected chatInitialLoadPending = false;
  protected messages: ContractTypes.ChatPopupMessage[] = [];
  protected draftMessage = '';
  protected chatComposeDetachedSpace = 108;
  protected chatHeaderContext: AppUiTypes.PopupHeaderContext | null = null;
  protected chatHeaderControlsHydrated = false;
  private selectedChatNavigationState: SelectedChatNavigationState | null = null;
  private resolvedChatEventRecord: ActivityEventRecord | null = null;
  private resolvedChatEventRecordKey = '';
  private resolvedChatResourceState: AppDTOs.ActivitySubEventResourceStateDTO | null = null;
  private resolvedChatResourceStateKey = '';
  private resolvedChatGroupSnapshot: ContractTypes.EventTournamentGroupDTO | null = null;
  private resolvedChatGroupSnapshotKey = '';
  protected typingIndicators: ContractTypes.ChatTypingIndicator[] = [];
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
  protected reactionDetailsMessageId = '';
  protected reactionDetailsFilter = 'all';
  protected pinnedDialogOpen = false;
  protected replyTarget: ContractTypes.ChatPopupMessage['replyTo'] = null;
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
  private readonly chatTypingIdleMs = 1800;
  private readonly chatTypingRemoteTtlMs = 3200;
  private readonly chatTransientFxMs = 1600;
  private readonly pendingMessageTimeoutMs = 3000;
  private readonly pendingMessageMatchWindowMs = 45000;
  private chatThreadRevision = 0;
  protected chatThreadQuery: Partial<ListQuery<ChatThreadFilters>> = {};
  protected readonly chatThreadSmartListConfig: SmartListConfig<ContractTypes.ChatPopupMessage, ChatThreadFilters> = {
    pageSize: this.chatHistoryPageSize,
    mobilePageSizeCap: null,
    initialPageCount: 1,
    initialPageSize: this.chatInitialLoadMessageCount,
    preloadOffsetPx: this.chatHistoryPreloadOffsetPx,
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
      tone: 'chat',
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
    },
    emptyLabel: () => this.chatInitialLoadPending ? '' : 'No messages yet',
    emptyDescription: () => this.chatInitialLoadPending ? '' : 'Start the conversation.',
    emptyStickyLabel: '',
    trackBy: (_index, message) => message.id,
    groupBy: message => this.chatDayLabel(new Date(message.sentAtIso))
  };
  protected readonly chatThreadLoadPage: SmartListLoadPage<ContractTypes.ChatPopupMessage, ChatThreadFilters> = (
    query: ListQuery<ChatThreadFilters>
  ) => {
    const sessionKey = `${query.filters?.sessionKey ?? ''}`.trim();
    if (!sessionKey) {
      return of(this.emptyChatThreadPage());
    }
    return from(this.loadChatThreadPage(query, sessionKey));
  };

  @ViewChild('chatThreadSmartList')
  private chatThreadSmartList?: SmartListComponent<ContractTypes.ChatPopupMessage, ChatThreadFilters>;

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
  private chatThreadKnownTotal = 0;
  private readonly latestVisibleReadMessageIdByReaderId: Record<string, string> = {};
  protected readonly visibleReadReceiptsByMessageId: Record<string, ContractTypes.ChatReadAvatar[]> = {};
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
    if (!this.selectedMessageId && !this.quickReactionMessageId && !this.emojiPickerMessageId && !(this.chatThreadSmartList?.menuOpen() ?? false)) {
      return;
    }
    this.closeTransientMessageUi();
    this.cdr.markForCheck();
  };
  private messageLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private optimisticMessageSequence = 0;

  protected readonly trackByChatReader = (_index: number, reader: ContractTypes.ChatReadAvatar): string => reader.id;

  constructor() {
    effect(() => {
      if (!this.shouldHostChatResourcePopup()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourcePopupLoaded();
    });

    effect(() => {
      if (!this.shouldHostChatResourcePopup() || !this.resourcePopupStore.assetExplorePopupRef()) {
        return;
      }
      void this.resourcePopupStore.ensureEventResourceAssetExploreLoaded();
    });

    effect(() => {
      if (!this.shouldHostChatSupplyContributionsPopup()) {
        return;
      }
      void this.resourcePopupStore.ensureEventSupplyContributionsPopupLoaded();
    });

    effect(() => {
      const update = this.resourcePopupStore.subEventResourceMetricsUpdate();
      if (!update) {
        return;
      }
      this.applySelectedChatResourceMetricsUpdate(update);
    });

    effect(() => {
      const request = this.eventSubeventsStore.eventSubeventsListPopup();
      if (!request || request.host !== 'chat' || !this.session()) {
        return;
      }
      void this.eventSubeventsStore.ensureEventSubeventsListPopupLoaded();
    });

    effect(() => {
      const session = this.session();
      const sessionKey = session ? `${session.item.id}:${session.openedAtIso}` : null;
      if (session && this.loadedSessionKey === sessionKey) {
        this.syncSelectedChatHeader(session.item, { hydrateControls: this.chatHeaderControlsHydrated });
        this.cdr.markForCheck();
        return;
      }
      this.teardownLiveChatUpdates();
      this.loadedSessionKey = sessionKey;
      this.initialChatLoadedSessionKey = null;
      this.chatHeaderControlsHydrated = false;
      this.draftMessage = '';
      this.closeTransientMessageUi();
      this.replyTarget = null;
      this.editingMessageId = '';
      this.chatThreadSmartList?.closeMenu();
      this.messages = [];
      this.typingIndicators = [];
      this.localTypingActive = false;
      this.clearTypingIdleTimer();
      this.clearRemoteTypingIndicators();
      this.clearTransientMessageState();
      this.clearPendingMessageTimers();
      this.resetVisibleReadReceipts();
      this.chatThreadRevision = 0;
      this.visibleChatThreadTotal = 0;
      this.chatThreadKnownTotal = 0;
      this.syncChatThreadQuery();
      if (!session) {
        this.loadedSessionKey = null;
        this.chatThreadQuery = {};
        this.chatInitialLoadPending = false;
        this.syncSelectedChatHeader(null);
        this.cdr.markForCheck();
        return;
      }
      this.syncSelectedChatHeader(session.item, { hydrateControls: false });
      this.chatInitialLoadPending = true;
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
    this.chatThreadKnownTotal = 0;
  }

  protected close(): void {
    this.chatThreadSmartList?.closeMenu();
    this.resourcePopupStore.closeResourcePopup();
    this.stopLocalTyping();
    this.resetVoiceRecorder();
    this.teardownLiveChatUpdates();
    this.clearPendingMessageTimers();
    this.visibleChatThreadTotal = 0;
    this.chatThreadKnownTotal = 0;
    this.loadedSessionKey = null;
    this.chatThreadQuery = {};
    this.chatHeaderControlsHydrated = false;
    this.closeTransientMessageUi();
    if (this.isBlockedSupportChat()) {
      this.activitiesStore.closeActivities();
      return;
    }
    this.activitiesStore.closeEventChat();
  }

  protected chatHeaderTitle(chatSession: EventChatSession): string {
    return `${this.chatHeaderContext?.title ?? chatSession.item.title ?? ''}`.trim() || 'Chat';
  }

  protected chatHeaderMembersControl(): AppUiTypes.PopupHeaderControl | null {
    const controls = this.chatHeaderContext?.controls ?? [];
    return controls.find(control => control.id === 'members') ?? null;
  }

  protected selectedChatContextControl(): AppUiTypes.PopupHeaderControl | null {
    const controls = this.chatHeaderContext?.controls ?? [];
    return controls.find(control => control.id === 'chat-context') ?? null;
  }

  protected chatHeaderControlIcon(control: AppUiTypes.PopupHeaderControl): string {
    return control.visual?.kind === 'icon' ? control.visual.icon : 'groups';
  }

  protected chatHeaderControlLabel(control: AppUiTypes.PopupHeaderControl): string {
    return `${control.summary ?? control.label ?? ''}`.trim() || 'Members';
  }

  protected chatHeaderThumbs(control: AppUiTypes.PopupHeaderControl): AppUiTypes.PopupHeaderThumb[] {
    if (control.visual?.kind !== 'thumbStack') {
      return [];
    }
    const maxVisible = Math.max(1, Math.trunc(Number(control.visual.maxVisible) || 4));
    return control.visual.thumbs.slice(0, maxVisible).map(thumb => ({
      ...thumb,
      imageUrl: AppUtils.mediaImageVariantUrl(thumb.imageUrl, 'small') || null
    }));
  }

  protected chatHeaderControlBadgeValue(control: AppUiTypes.PopupHeaderControl): number {
    return Math.max(0, Math.trunc(Number(control.badge?.value) || 0));
  }

  protected openChatHeaderControl(control: AppUiTypes.PopupHeaderControl, event?: Event): void {
    event?.stopPropagation();
    if (control.id !== 'members') {
      return;
    }
    const lookup = control.lookup;
    const ownerId = `${lookup?.id ?? ''}`.trim();
    if (!ownerId) {
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
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

  protected shouldHostChatResourcePopup(): boolean {
    const request = this.memberMenuStore.activitiesNavigationRequest();
    return Boolean(this.session())
      && (request?.type === 'chatResource'
        || request?.type === 'assetExplore'
        || this.resourcePopupStore.popupContextRef()?.origin === 'chat'
        || this.shouldHostChatSubEventResourcePopup());
  }

  protected shouldHostChatSupplyContributionsPopup(): boolean {
    return this.shouldHostChatResourcePopup()
      && !this.resourcePopupStore.assetExploreOnlyRef()
      && this.resourcePopupStore.supplyPopupRef() !== null;
  }

  private shouldHostChatSubEventResourcePopup(): boolean {
    if (this.eventSubeventsStore.eventSubeventsListPopup()?.host === 'chat') {
      return false;
    }
    const request = this.resourcePopupStore.subEventResourcePopupRequest();
    if (request && this.isSelectedChatSubEventResourceRequest(request)) {
      return true;
    }
    const context = this.resourcePopupStore.popupContextRef();
    return context?.origin === 'subEventResource'
      && this.isSelectedChatResourceTarget(context.ownerId, context.subEvent.id);
  }

  private isSelectedChatSubEventResourceRequest(request: SubEventResourcePopupRequest): boolean {
    return this.isSelectedChatResourceTarget(request.ownerId, `${request.subEventId ?? ''}`);
  }

  private isSelectedChatResourceTarget(ownerId: string | null | undefined, subEventId: string | null | undefined): boolean {
    const session = this.session();
    const state = this.selectedChatNavigationState;
    const selectedOwnerId = `${state?.eventId ?? session?.item.eventId ?? ''}`.trim();
    const selectedSubEventId = `${state?.subEvent?.id ?? session?.item.subEventId ?? ''}`.trim();
    return !!selectedOwnerId
      && !!selectedSubEventId
      && `${ownerId ?? ''}`.trim() === selectedOwnerId
      && `${subEventId ?? ''}`.trim() === selectedSubEventId;
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

  protected selectedChatContextMenuTrigger(): AppMenuTrigger {
    return {
      label: this.selectedChatHeaderActionLabel(),
      icon: this.selectedChatHeaderActionIcon(),
      palette: this.selectedChatHeaderActionPalette(),
      counter: this.selectedChatHeaderActionBadgeCount(),
      ariaLabel: 'Open chat context menu',
      layout: 'pill'
    };
  }

  protected selectedChatContextMenuGroupsModel(): readonly AppMenuGroup<string, ChatMenuContext>[] {
    return this.selectedChatContextMenuGroups()
      .map(group => ({
        id: group.id,
        label: group.label,
        items: group.controls.map(control => this.chatContextControlMenuItem(control))
      }))
      .filter(group => group.items.length > 0);
  }

  protected composerMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'add',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: 'blue',
      ariaLabel: 'Open chat tools'
    };
  }

  protected composerMenuItems(): readonly AppMenuItem<string, ChatMenuContext>[] {
    return [
      { id: 'chat-composer-image', label: 'Upload image', icon: 'image', palette: 'sky', surface: 'tinted', context: { menu: 'composer', action: 'image' } },
      { id: 'chat-composer-voice', label: 'Send a voice clip', icon: 'mic', palette: 'violet', surface: 'tinted', context: { menu: 'composer', action: 'voice' } },
      { id: 'chat-composer-poll', label: 'Create a poll', icon: 'poll', palette: 'green', surface: 'tinted', context: { menu: 'composer', action: 'poll' } },
      { id: 'chat-composer-event', label: 'Share event', icon: 'event', palette: 'blue', surface: 'tinted', context: { menu: 'composer', action: 'event' } },
      { id: 'chat-composer-asset', label: 'Share asset', icon: 'inventory_2', palette: 'brown', surface: 'tinted', context: { menu: 'composer', action: 'asset' } }
    ];
  }

  protected onInlineChatMenuSelect(event: AppMenuItemSelectEvent<string, ChatMenuContext>): void {
    const context = event.context;
    if (!context) {
      return;
    }
    if (context.menu === 'chat-context') {
      this.openSelectedChatMenuControl(context.control, event.sourceEvent);
      return;
    }
    if (context.menu === 'composer') {
      switch (context.action) {
        case 'image':
          this.openImageAttachmentPicker(event.sourceEvent);
          break;
        case 'voice':
          this.openVoiceComposer(event.sourceEvent);
          break;
        case 'poll':
          this.openPollComposer(event.sourceEvent);
          break;
        case 'event':
          this.shareCurrentEvent(event.sourceEvent);
          break;
        case 'asset':
          this.shareFirstAvailableAsset(event.sourceEvent);
          break;
      }
    }
  }

  protected messageActionMenuIdFor(message: ContractTypes.ChatPopupMessage): string {
    return `chat-message-action:${message.id}`;
  }

  protected messageActionMenuTrigger(message: ContractTypes.ChatPopupMessage): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: message.mine ? 'blue' : 'default',
      ariaLabel: 'More message actions'
    };
  }

  protected messageActionMenuItems(message: ContractTypes.ChatPopupMessage): readonly AppMenuItem<string, ChatMenuContext>[] {
    const items: AppMenuItem<string, ChatMenuContext>[] = [];
    if (this.messageHasViewableAttachment(message)) {
      items.push({
        id: `chat-message-view-${message.id}`,
        label: 'View',
        icon: 'visibility',
        context: { menu: 'message-action', message, action: 'view' }
      });
    }
    items.push({
      id: `chat-message-reply-${message.id}`,
      label: 'Reply',
      icon: 'reply',
      context: { menu: 'message-action', message, action: 'reply' }
    });
    if (message.mine && !message.deletedAtIso) {
      items.push({
        id: `chat-message-edit-${message.id}`,
        label: 'Edit',
        icon: 'edit',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'message-action', message, action: 'edit' }
      });
      items.push({
        id: `chat-message-unsend-${message.id}`,
        label: 'Unsend',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted',
        context: { menu: 'message-action', message, action: 'unsend' }
      });
    }
    items.push({
      id: `chat-message-pin-${message.id}`,
      label: message.pinnedAtIso ? 'Unpin' : 'Pin',
      icon: message.pinnedAtIso ? 'push_pin' : 'push_pin',
      palette: message.pinnedAtIso ? 'muted' : 'amber',
      surface: 'tinted',
      context: { menu: 'message-action', message, action: 'pin' }
    });
    if (this.canReportMessage(message)) {
      items.push({
        id: `chat-message-report-${message.id}`,
        label: 'Report',
        icon: 'flag',
        palette: 'danger',
        surface: 'tinted',
        context: { menu: 'message-action', message, action: 'report' }
      });
    }
    return items;
  }

  protected onDispatchedChatMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as ChatMenuContext | undefined;
    if (context?.menu !== 'message-action') {
      return;
    }
    switch (context.action) {
      case 'view':
        this.viewSharedMessage(context.message, event.sourceEvent);
        break;
      case 'reply':
        this.setReplyTarget(context.message, event.sourceEvent);
        break;
      case 'edit':
        this.beginEditMessage(context.message, event.sourceEvent);
        break;
      case 'unsend':
        this.unsendMessage(context.message, event.sourceEvent);
        break;
      case 'pin':
        this.togglePinMessage(context.message, event.sourceEvent);
        break;
      case 'report':
        this.reportMessage(context.message, event.sourceEvent);
        break;
    }
  }

  protected isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 760px)').matches;
  }

  protected openSelectedChatEvent(event?: Event): void {
    this.openSelectedChatSubeventsPopup(event);
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
    this.openSelectedChatSubeventsPopup(event);
  }

  protected openSelectedChatGroup(event?: Event): void {
    event?.stopPropagation();
    this.openSelectedChatSubEvent();
  }

  private openSelectedChatSubeventsPopup(event?: Event): void {
    event?.stopPropagation();
    this.chatThreadSmartList?.closeMenu();
    const session = this.session();
    const state = this.selectedChatNavigationState;
    const eventId = `${state?.eventId ?? session?.item.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    const record = this.selectedChatEventRecord(eventId);
    this.eventSubeventsStore.openEventSubeventsListPopup({
      eventId,
      host: 'chat',
      target: this.selectedChatEventEditorTarget(record, state),
      title: record?.title ?? state?.eventTitle ?? session?.item.title ?? null,
      timeframe: record?.timeframe ?? null,
      startAtIso: record?.startAtIso ?? null,
      endAtIso: record?.endAtIso ?? null,
      canEdit: this.canEditSelectedChatEvent(record, state)
    });
  }

  protected openSelectedChatSubEventResource(
    type: SubEventResourceFilter,
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
    this.chatThreadSmartList?.closeMenu();
    if (!openExplore && !assetViewId) {
      const ownerId = `${state.eventId ?? session.item.eventId ?? ''}`.trim();
      const subEventId = `${state.subEvent.id ?? ''}`.trim();
      if (!ownerId || !subEventId) {
        return;
      }
      this.resourcePopupStore.requestSubEventResourcePopup({
        type,
        ownerId,
        parentTitle: `${state.eventTitle ?? session.item.title ?? ''}`.trim() || session.item.title,
        subEventId,
        subEventHeader: {
          name: state.subEvent.name,
          title: state.subEvent.name,
          description: state.subEvent.description,
          location: state.subEvent.location,
          startAt: state.subEvent.startAt,
          endAt: state.subEvent.endAt
        },
        group: this.selectedChatResourceRequestGroup(type)
      });
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'chatResource',
      ownerId: state.eventId ?? session.item.eventId,
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

  private selectedChatResourceRequestGroup(type: SubEventResourceFilter): SubEventResourcePopupRequest['group'] {
    const state = this.selectedChatNavigationState;
    const group = state?.group;
    if (!state || !group) {
      return null;
    }
    const isMembersPopup = type === 'Members';
    return {
      id: group.id,
      groupLabel: group.label,
      source: group.source ?? null,
      accepted: isMembersPopup ? undefined : group.accepted,
      pending: isMembersPopup ? undefined : group.pending,
      capacityMin: group.capacityMin,
      capacityMax: group.capacityMax,
      canManage: isMembersPopup
        ? this.canEditSelectedChatEvent(this.selectedChatEventRecord(`${state.eventId ?? ''}`), state)
        : undefined
    };
  }

  protected selectedChatContextMenuGroups(): AppUiTypes.PopupHeaderControlGroup[] {
    return this.selectedChatContextControl()?.menu?.groups
      ?.map(group => ({
        ...group,
        controls: group.controls.map(control => ({ ...control }))
      }))
      ?? [];
  }

  protected selectedChatMenuControlIcon(control: AppUiTypes.PopupHeaderControl): string {
    return this.chatHeaderControlIcon(control);
  }

  protected selectedChatMenuControlBadgeCount(control: AppUiTypes.PopupHeaderControl): number {
    return this.chatHeaderControlBadgeValue(control);
  }

  protected openSelectedChatMenuControl(control: AppUiTypes.PopupHeaderControl, event?: Event): void {
    event?.stopPropagation();
    const resourceType = this.popupControlResourceType(control);
    if (resourceType) {
      this.openSelectedChatSubEventResource(resourceType, event);
      return;
    }
    this.openSelectedChatPrimaryContext(event);
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
      void this.chatsService.sendChatTyping(session.item, true);
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

  protected composerEmojiSuggestions(): readonly AsciiEmojiConversion[] {
    if (this.chatInitialLoadPending || this.voiceComposerOpen || this.pollComposerOpen) {
      return [];
    }
    return AppUtils.asciiEmojiSuggestionsForToken(
      AppUtils.trailingAsciiEmojiToken(this.draftMessage),
      6
    );
  }

  protected applyComposerEmojiSuggestion(suggestion: AsciiEmojiConversion, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.onDraftMessageChange(
      AppUtils.replaceTrailingAsciiEmojiToken(this.draftMessage, suggestion.emoji)
    );
    this.focusComposerSoon();
    this.resizeComposerTextareaSoon();
  }

  protected openImageAttachmentPicker(event?: Event): void {
    event?.stopPropagation();
    this.imageAttachmentInput?.nativeElement.click();
  }

  protected openVoiceComposer(event?: Event): void {
    event?.stopPropagation();
    this.pollComposerOpen = false;
    this.voiceComposerOpen = true;
    this.voiceRecorderError = '';
  }

  protected openPollComposer(event?: Event): void {
    event?.stopPropagation();
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

  protected voiceAttachmentAudioSrc(attachment: ContractTypes.ChatMessageAttachment): string {
    const url = `${attachment.url ?? attachment.previewUrl ?? ''}`.trim();
    if (!this.chatVoiceClipsService.isVoiceClipUrl(url)) {
      return url;
    }
    const cached = this.voiceAttachmentSrcByKey[url];
    if (cached) {
      return cached;
    }
    if (!this.loadingVoiceClipKeys.has(url)) {
      this.loadingVoiceClipKeys.add(url);
      void this.chatVoiceClipsService.loadVoiceClipByUrl(url)
        .then(clip => {
          if (clip?.dataUrl) {
            this.voiceAttachmentSrcByKey[url] = clip.dataUrl;
          }
        })
        .finally(() => {
          this.loadingVoiceClipKeys.delete(url);
          this.cdr.markForCheck();
        });
    }
    return '';
  }

  protected pollState(attachment: ContractTypes.ChatMessageAttachment): ChatPollState {
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

  protected selectedPollOptionId(message: ContractTypes.ChatPopupMessage, attachment: ContractTypes.ChatMessageAttachment): string {
    const messageId = `${message.id ?? ''}`.trim();
    return messageId ? this.selectedPollOptionByMessageId[messageId] || this.pollOwnVoteOptionId(attachment) : '';
  }

  protected openPollVoteDialog(message: ContractTypes.ChatPopupMessage, attachment: ContractTypes.ChatMessageAttachment, event?: Event): void {
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
    message: ContractTypes.ChatPopupMessage;
    attachment: ContractTypes.ChatMessageAttachment;
    poll: ChatPollState;
  } | null {
    const message = this.messages.find(item => item.id === this.pollVoteMessageId) ?? null;
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
    message: ContractTypes.ChatPopupMessage,
    attachment: ContractTypes.ChatMessageAttachment,
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

  protected canSubmitPollVote(message: ContractTypes.ChatPopupMessage, attachment: ContractTypes.ChatMessageAttachment): boolean {
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      return false;
    }
    const selectedOptionId = this.selectedPollOptionByMessageId[messageId] || '';
    return !!selectedOptionId && selectedOptionId !== this.pollOwnVoteOptionId(attachment);
  }

  protected submitPollVote(
    message: ContractTypes.ChatPopupMessage,
    attachment: ContractTypes.ChatMessageAttachment,
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
    const currentMessage = this.messages.find(item => item.id === messageId) ?? { ...message, id: messageId };
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
    const nextAttachment: ContractTypes.ChatMessageAttachment = {
      ...attachment,
      title: nextPoll.question,
      description: this.serializePollState(nextPoll)
    };
    const nextAttachments = (currentMessage.attachments ?? []).map(item => item.id === attachment.id ? nextAttachment : { ...item });
    const optimisticMessage: ContractTypes.ChatPopupMessage = {
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
    void this.chatsService.updateChatMessage(session.item, messageId, { attachments: nextAttachments })
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
    this.memberMenuStore.requestActivitiesNavigation({ type: 'eventExplore', stacked: true });
  }

  protected shareFirstAvailableAsset(event?: Event): void {
    event?.stopPropagation();
    const state = this.selectedChatNavigationState;
    const resourceType = this.firstAvailableAssetType();
    if (state?.subEvent) {
      this.openSelectedChatSubEventResource(resourceType ?? 'Car', event, true);
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'assetExplore',
      assetType: resourceType ?? 'Car'
    });
  }

  protected chatAttachmentIcon(attachment: ContractTypes.ChatMessageAttachment): string {
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

  protected chatAttachmentTypeLabel(attachment: ContractTypes.ChatMessageAttachment): string {
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

  protected isAttachmentUnavailable(attachment: ContractTypes.ChatMessageAttachment): boolean {
    return `${attachment.status ?? ''}`.trim().toLowerCase() === 'unavailable';
  }

  protected unavailableAttachmentLabel(attachment: ContractTypes.ChatMessageAttachment): string {
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

  protected openChatAttachment(attachment: ContractTypes.ChatMessageAttachment, event?: Event): void {
    event?.stopPropagation();
    if (this.isAttachmentUnavailable(attachment)) {
      this.dialogStore.openInfo(this.unavailableAttachmentLabel(attachment), {
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
      const contextEventId = `${this.selectedChatNavigationState?.eventId ?? this.session()?.item.eventId ?? ''}`.trim();
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

  protected selectMessage(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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
    this.chatThreadSmartList?.closeMenu();
    this.quickReactionMessageId = '';
    this.quickReactionOpenDown = false;
    this.emojiPickerMessageId = '';
  }

  protected startMessageLongPress(message: ContractTypes.ChatPopupMessage): void {
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
      this.chatThreadSmartList?.closeMenu();
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

  protected toggleQuickReactions(message: ContractTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    this.bindChatThreadScrollDismissListener();
    const wasOpen = this.quickReactionMessageId === messageId;
    this.selectedMessageId = messageId;
    this.chatThreadSmartList?.closeMenu();
    this.emojiPickerMessageId = '';
    this.quickReactionOpenDown = this.shouldOpenQuickReactionsDown(event);
    this.quickReactionMessageId = wasOpen ? '' : messageId;
    if (wasOpen) {
      this.blurEventTarget(event);
    }
  }

  protected openEmojiPicker(message: ContractTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    this.selectedMessageId = messageId;
    this.quickReactionMessageId = '';
    this.quickReactionOpenDown = false;
    this.chatThreadSmartList?.closeMenu();
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

  protected toggleReaction(message: ContractTypes.ChatPopupMessage, emoji: string, event?: Event): void {
    event?.stopPropagation();
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      this.closeTransientMessageUi();
      return;
    }
    const activeUserId = this.activeUserId() || 'self';
    const presentation = this.resolveOptimisticSenderPresentation(activeUserId);
    const currentMessage = this.messages.find(item => item.id === messageId) ?? { ...message, id: messageId };
    const withoutMine = (currentMessage.reactions ?? []).filter(reaction => !this.isOwnReaction(reaction, activeUserId, presentation));
    const sameReaction = (currentMessage.reactions ?? []).some(reaction =>
      this.isOwnReaction(reaction, activeUserId, presentation) && reaction.emoji === emoji
    );
    const reactionEmoji = sameReaction ? null : emoji;
    const optimisticMessage: ContractTypes.ChatPopupMessage = {
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
      void this.chatsService.updateChatMessage(session.item, messageId, { reactionEmoji })
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

  protected reactionSummary(message: ContractTypes.ChatPopupMessage): Array<{ emoji: string; count: number }> {
    const counts = new Map<string, number>();
    for (const reaction of message.reactions ?? []) {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
  }

  private isOwnReaction(
    reaction: ContractTypes.ChatMessageReaction,
    activeUserId: string,
    presentation: Pick<ContractTypes.ChatPopupMessage, 'sender' | 'senderAvatar'>
  ): boolean {
    const reactionUserId = `${reaction.userId ?? ''}`.trim();
    const knownOwnIds = new Set([
      `${activeUserId ?? ''}`.trim(),
      `${presentation.senderAvatar.id ?? ''}`.trim(),
      `${this.userProfileStore.activeUserProfile()?.id ?? ''}`.trim(),
      'self',
      'me'
    ].filter(Boolean));
    if (knownOwnIds.has(reactionUserId)) {
      return true;
    }
    const reactionName = `${reaction.userName ?? ''}`.trim().toLowerCase();
    return reactionName === 'you';
  }

  protected openReactionDetails(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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

  protected reactionDetailsMessage(): ContractTypes.ChatPopupMessage | null {
    const messageId = `${this.reactionDetailsMessageId ?? ''}`.trim();
    if (!messageId) {
      return null;
    }
    const message = this.messages.find(item => item.id === messageId) ?? null;
    return message && (message.reactions?.length ?? 0) > 0 ? message : null;
  }

  protected emojiPickerMessage(): ContractTypes.ChatPopupMessage | null {
    const messageId = `${this.emojiPickerMessageId ?? ''}`.trim();
    if (!messageId) {
      return null;
    }
    return this.messages.find(message => message.id === messageId && !message.deletedAtIso) ?? null;
  }

  protected reactionDetailsRows(message: ContractTypes.ChatPopupMessage): ContractTypes.ChatMessageReaction[] {
    return this.reactionDetailsFilter === 'all'
      ? (message.reactions ?? [])
      : (message.reactions ?? []).filter(reaction => reaction.emoji === this.reactionDetailsFilter);
  }

  protected setReplyTarget(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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

  protected replyPreviewText(replyTo: ContractTypes.ChatPopupMessage['replyTo']): string {
    const preview = this.replyPreviewParts(replyTo);
    return preview.meta ? `${preview.title} · ${preview.meta}` : preview.title;
  }

  protected replyPreviewParts(replyTo: ContractTypes.ChatPopupMessage['replyTo']): { title: string; meta: string } {
    const sourceMessage = this.messages.find(message => message.id === `${replyTo?.id ?? ''}`.trim());
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

  protected jumpToReplySource(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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
    this.chatThreadSmartList?.closeMenu();
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

  protected beginEditMessage(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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

  protected unsendMessage(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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
      void this.chatsService.updateChatMessage(session.item, message.id, { deleted: true })
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

  protected deletedMessageLabel(message: ContractTypes.ChatPopupMessage): string {
    if (message.deliveryState === 'pending') {
      return 'Deleting message';
    }
    return message.mine || message.deletedByName === 'You'
      ? 'You deleted this message'
      : `${message.deletedByName || message.sender} deleted this message`;
  }

  protected togglePinMessage(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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
      void this.chatsService.updateChatMessage(session.item, message.id, { pinned })
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

  protected pinnedMessages(): ContractTypes.ChatPopupMessage[] {
    return this.messages
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

  protected selectPinnedMessage(message: ContractTypes.ChatPopupMessage): void {
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

  protected reportMessage(message: ContractTypes.ChatPopupMessage, event?: Event): void {
    event?.stopPropagation();
    this.chatThreadSmartList?.closeMenu();
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
    this.profileStore.openReportUserPopup({
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

  protected canReportMessage(message: ContractTypes.ChatPopupMessage): boolean {
    if (this.isAdminRoleActive() || message.mine) {
      return false;
    }
    return this.resolveChatReportTarget(message) !== null;
  }

  private isAdminRoleActive(): boolean {
    const hostTier = `${this.userProfileStore.activeUserProfile()?.hostTier ?? ''}`.trim().toLowerCase();
    if (hostTier === 'admin') {
      return true;
    }
    const activeUserId = this.activeUserId();
    return activeUserId === 'admin' || activeUserId.startsWith('admin-');
  }

  private resolveChatReportTarget(message: ContractTypes.ChatPopupMessage): { userId: string; name: string } | null {
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

  protected messageHasViewableAttachment(message: ContractTypes.ChatPopupMessage): boolean {
    return this.resolveViewableMessageAttachment(message) !== null;
  }

  protected viewSharedMessage(message: ContractTypes.ChatPopupMessage, event?: Event): void {
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
    const text = AppUtils.convertAsciiEmojis(this.draftMessage.trim());
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
    void this.chatsService.sendChatMessageWithAttachments(session.item, text, [], optimisticMessage.clientId, optimisticMessage.replyTo)
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
    const imageAttachment: ContractTypes.ChatMessageAttachment = {
      id: attachmentId,
      type: 'image',
      title: file.name || 'Image',
      previewUrl,
      mimeType: file.type || null,
      sizeBytes: file.size
    };
    const imageMessage: ContractTypes.ChatPopupMessage = {
      id: clientId,
      clientId,
      sender: senderPresentation.sender,
      senderAvatar: senderPresentation.senderAvatar,
      text: AppUtils.convertAsciiEmojis(this.draftMessage.trim()),
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: sentAt.toISOString(),
      mine: true,
      readBy: [],
      deliveryState: 'pending',
      replyTo: this.replyTarget ? { ...this.replyTarget } : null,
      attachments: [{ ...imageAttachment }]
    };
    const caption = AppUtils.convertAsciiEmojis(this.draftMessage.trim());
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
      const persistedMessage = await this.chatsService.sendChatMessageWithAttachments(
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

  private sendLocalAttachmentMessage(attachment: ContractTypes.ChatMessageAttachment, captionOverride?: string): void {
    const session = this.session();
    if (!session || this.chatInitialLoadPending) {
      return;
    }
    const caption = AppUtils.convertAsciiEmojis(captionOverride ?? this.draftMessage.trim());
    const optimisticMessage = {
      ...this.buildOptimisticChatMessage(caption),
      attachments: [{ ...attachment }]
    } satisfies ContractTypes.ChatPopupMessage;
    const sessionKey = `${session.item.id}:${session.openedAtIso}`;
    this.draftMessage = '';
    this.replyTarget = null;
    this.resizeComposerTextareaSoon();
    this.stopLocalTyping();
    this.mergeIncomingChatMessage(optimisticMessage);
    this.schedulePendingMessageTimeout(optimisticMessage.id);
    this.cdr.markForCheck();
    void this.chatsService.sendChatMessageWithAttachments(
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

  private buildCurrentEventAttachment(): ContractTypes.ChatMessageAttachment | null {
    const session = this.session();
    const eventId = `${this.selectedChatNavigationState?.eventId ?? session?.item.eventId ?? ''}`.trim();
    const title = `${this.selectedChatNavigationState?.eventTitle ?? session?.item.title ?? ''}`.trim();
    if (!eventId || !title) {
      return null;
    }
    return {
      id: `event:${eventId}:${Date.now()}`,
      type: 'event',
      entityId: eventId,
      title,
      subtitle: `${session?.item.lastMessage ?? ''}`.trim() || null,
      description: null,
      url: null,
      previewUrl: null
    };
  }

  private async resolveShareAttachmentFromText(text: string): Promise<ContractTypes.ChatMessageAttachment | null> {
    const token = this.parseShareToken(text);
    if (!token) {
      return null;
    }
    const resolved = await this.shareTokensService.resolveToken(token, this.activeUserId());
    if (!resolved) {
      this.dialogStore.openInfo('This share token is expired or no longer available.', {
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

  private buildFirstAssetAttachment(): ContractTypes.ChatMessageAttachment | null {
    const state = this.selectedChatNavigationState;
    if (!state) {
      return null;
    }
    for (const type of ASSET_TYPES) {
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
        description: `${card.description ?? card.details ?? card.subtitle ?? ''}`.trim() || null,
        url: null,
        previewUrl: `${card.imageUrl ?? ''}`.trim() || null
      };
    }
    return null;
  }

  private findSharedAssetResourceType(
    attachment: ContractTypes.ChatMessageAttachment
  ): AssetType | null {
    const assetId = `${attachment.entityId ?? ''}`.trim();
    const state = this.selectedChatNavigationState;
    if (!assetId || !state?.subEvent) {
      return null;
    }
    return ASSET_TYPES.find(type => state.assetCardsByType[type]?.some(card => {
      const sourceAssetId = 'sourceAssetId' in card
        ? `${card.sourceAssetId ?? ''}`.trim()
        : '';
      return card.id === assetId || sourceAssetId === assetId;
    })) ?? null;
  }

  private openSharedAssetAttachment(attachment: ContractTypes.ChatMessageAttachment): void {
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
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'assetExplore',
      assetType: this.normalizeAttachmentAssetType(attachment.assetType) ?? 'Car',
      assetId: `${attachment.entityId ?? ''}`.trim() || undefined,
      viewOnly: true,
      fallbackAsset: this.assetAttachmentToViewCard(attachment)
    });
  }

  private assetAttachmentToViewCard(attachment: ContractTypes.ChatMessageAttachment): AppDTOs.AssetDTO | undefined {
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
      description: `${attachment.description ?? ''}`.trim(),
      imageUrl: `${attachment.previewUrl ?? ''}`.trim(),
      visibility: 'Public',
      ownerUserId: `${attachment.ownerUserId ?? ''}`.trim() || undefined,
      requests: []
    };
  }

  private normalizeAttachmentAssetType(value: unknown): AppConstants.AssetType | null {
    return value === 'Car' || value === 'Accommodation' || value === 'Supplies' ? value : null;
  }

  private openExternalAttachmentUrl(attachment: ContractTypes.ChatMessageAttachment): void {
    const url = `${attachment.url ?? ''}`.trim();
    if (!url) {
      this.dialogStore.openInfo('This shared item is not available from the current chat context.', {
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
    this.dialogStore.open({
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

  private async openSharedEventAttachment(attachment: ContractTypes.ChatMessageAttachment): Promise<void> {
    const eventId = `${attachment.entityId ?? ''}`.trim();
    if (!eventId) {
      this.dialogStore.openInfo('This event is not available anymore.', {
        title: attachment.title || 'Shared event'
      });
      return;
    }
    const eventRecord = await this.eventsService.queryKnownRecordById(this.activeUserId(), eventId);
    if (!eventRecord) {
      this.dialogStore.openInfo('This event is not available anymore.', {
        title: attachment.title || 'Shared event'
      });
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'eventEditor',
      eventId: eventRecord.id,
      target: this.eventEditorTargetForRecord(eventRecord),
      readOnly: true
    });
  }

  private resolveViewableMessageAttachment(message: ContractTypes.ChatPopupMessage): ContractTypes.ChatMessageAttachment | null {
    if (message.deletedAtIso) {
      return null;
    }
    return (message.attachments ?? []).find(attachment =>
      (attachment.type === 'event' || attachment.type === 'asset' || attachment.type === 'link')
        && !this.isAttachmentUnavailable(attachment)
    ) ?? null;
  }

  private async resolvePersistableImageAttachment(
    chat: ChatDTO,
    attachment: ContractTypes.ChatMessageAttachment,
    file: File
  ): Promise<ContractTypes.ChatMessageAttachment> {
    const upload = await this.mediaService.uploadImage(
      this.activeUserId() || 'chat',
      `${chat.id || 'chat'}-${Date.now()}`,
      file
    );
    if (!upload.uploaded || !upload.imageUrl) {
      throw new Error('Unable to upload chat image.');
    }
    const mediaUrl = upload.imageSet?.largeUrl ?? upload.imageUrl;
    const previewUrl = upload.imageSet?.mediumUrl ?? upload.imageUrl;
    return {
      ...attachment,
      url: mediaUrl,
      previewUrl
    };
  }

  private async persistVoiceClipByConfiguredMode(voiceKey: string): Promise<string | null> {
    const mimeType = this.voiceClipMimeType || 'audio/webm';
    const session = this.session();
    const ownerId = `${session?.item.id ?? this.activeUserId() ?? 'chat'}`.trim();
    const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = this.dataUrlToFile(this.voiceClipDataUrl, `${voiceKey.replace(/[^a-zA-Z0-9._-]+/g, '-')}.${extension}`, mimeType);
    const upload = await this.mediaService.uploadAudio(ownerId || 'chat', voiceKey, file, {
      dataUrl: this.voiceClipDataUrl,
      durationSeconds: this.voiceRecorderSeconds,
      sizeBytes: this.voiceClipSizeBytes
    });
    if (upload.uploaded && upload.audioUrl) {
      if (this.chatVoiceClipsService.isVoiceClipUrl(upload.audioUrl)) {
        this.voiceAttachmentSrcByKey[upload.audioUrl] = this.voiceClipDataUrl;
      }
      return upload.audioUrl;
    }
    this.voiceRecorderError = 'Voice upload failed.';
    return null;
  }

  private parsePollState(attachment: ContractTypes.ChatMessageAttachment): ChatPollState {
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

  private normalizeChatUserGender(value: unknown): ContractTypes.ChatUserGender {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'deleted' || normalized === 'du') {
      return 'deleted';
    }
    return normalized === 'woman' || normalized.startsWith('w') || normalized.startsWith('f') ? 'woman' : 'man';
  }

  protected pollOwnVoteOptionId(attachment: ContractTypes.ChatMessageAttachment): string {
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
    const convertedText = AppUtils.convertAsciiEmojis(text.trim());
    const editingMessageId = this.editingMessageId;
    if (!editingMessageId || !convertedText) {
      return;
    }
    const session = this.session();
    this.messages = this.messages.map(message => message.id === editingMessageId
      ? {
          ...message,
          text: convertedText,
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
      void this.chatsService.updateChatMessage(session.item, editingMessageId, { text: convertedText })
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

  private async loadChatThreadPage(
    query: ListQuery<ChatThreadFilters>,
    sessionKey: string
  ): Promise<PageResult<ContractTypes.ChatPopupMessage>> {
    if (query.page === 0 && this.initialChatLoadedSessionKey !== sessionKey) {
      return this.loadInitialChatThreadPage(query, sessionKey);
    }
    const session = this.session();
    if (!session || this.loadedSessionKey !== sessionKey) {
      return this.emptyChatThreadPage();
    }

    try {
      const messagesPage = await this.chatsService.loadChatMessagesResult(session.item, query);
      if (this.loadedSessionKey !== sessionKey) {
        return this.emptyChatThreadPage();
      }
      const result = this.applyChatThreadMessagesPage(messagesPage);
      this.rebuildVisibleReadReceipts();
      this.markLoadedChatThreadAsRead(session.item, result.items);
      return result;
    } catch {
      return this.emptyChatThreadPage();
    }
  }

  private async loadInitialChatThreadPage(
    query: ListQuery<ChatThreadFilters>,
    sessionKey: string
  ): Promise<PageResult<ContractTypes.ChatPopupMessage>> {
    const session = this.session();
    if (!session || this.loadedSessionKey !== sessionKey) {
      return this.emptyChatThreadPage();
    }
    this.chatInitialLoadPending = true;
    this.clearOpenChatUnreadState();
    this.cdr.markForCheck();
    try {
      const initialChat = session.item;
      const resolvedChatPromise = this.chatsService
        .resolveRepositoryEventServiceChat(initialChat)
        .catch(() => null);
      const messagesPromise = this.chatsService.loadChatMessagesResult(initialChat, query);
      const [resolvedChat, messagesPage] = await Promise.all([resolvedChatPromise, messagesPromise]);
      if (this.loadedSessionKey !== sessionKey) {
        return this.emptyChatThreadPage();
      }
      const chat = this.applyResolvedInitialChatItem(initialChat, resolvedChat, sessionKey);
      if (this.loadedSessionKey !== sessionKey) {
        return this.emptyChatThreadPage();
      }
      this.chatHeaderControlsHydrated = true;
      this.syncSelectedChatHeader(chat, {
        hydrateControls: true,
        baseContext: messagesPage.context ?? null
      });
      void this.refreshSelectedChatHeader(chat, sessionKey);
      const result = this.applyChatThreadMessagesPage(messagesPage, { replace: true });
      this.rebuildVisibleReadReceipts();
      this.syncEventChatSummaryFromLatestMessage();
      this.initialChatLoadedSessionKey = sessionKey;
      this.markLoadedChatThreadAsRead(chat, result.items);
      await this.startLiveChatUpdates(chat, sessionKey);
      return result;
    } catch {
      if (this.loadedSessionKey !== sessionKey) {
        return this.emptyChatThreadPage();
      }
      this.chatHeaderControlsHydrated = true;
      this.syncSelectedChatHeader(session.item, { hydrateControls: true });
      void this.refreshSelectedChatHeader(session.item, sessionKey);
      this.messages = [];
      this.rebuildVisibleReadReceipts();
      this.initialChatLoadedSessionKey = sessionKey;
      await this.startLiveChatUpdates(session.item, sessionKey);
      return this.emptyChatThreadPage();
    } finally {
      if (this.loadedSessionKey === sessionKey) {
        this.chatInitialLoadPending = false;
        this.cdr.markForCheck();
      }
    }
  }

  private applyResolvedInitialChatItem(
    chat: ChatDTO,
    resolvedChat: ChatDTO | null,
    sessionKey: string
  ): ChatDTO {
    if (!resolvedChat || this.loadedSessionKey !== sessionKey || resolvedChat.id !== chat.id) {
      return chat;
    }
    this.activitiesStore.patchEventChatSessionItem(current =>
      current.id === chat.id
        ? resolvedChat
        : current
    );
    if (this.chatHeaderControlsHydrated) {
      this.syncSelectedChatHeader(resolvedChat, { hydrateControls: true });
      void this.refreshSelectedChatHeader(resolvedChat, sessionKey);
    }
    return resolvedChat;
  }

  private applyChatThreadMessagesPage(
    page: PageResult<ContractTypes.ChatPopupMessage, AppUiTypes.PopupHeaderContext>,
    options: { replace?: boolean } = {}
  ): PageResult<ContractTypes.ChatPopupMessage> {
    const items = this.normalizeChatMessages(page.items)
      .sort((first, second) =>
        AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso)
      );
    this.messages = this.deduplicateChatMessages(options.replace === true
      ? items
      : [...this.messages, ...items]
    ).sort((first, second) =>
      AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso)
    );
    this.visibleChatThreadTotal = this.messages.length;
    const pageTotal = Math.trunc(Number(page.total) || 0);
    this.chatThreadKnownTotal = options.replace === true
      ? Math.max(this.messages.length, pageTotal)
      : Math.max(this.chatThreadKnownTotal, this.messages.length, pageTotal);
    return {
      items,
      total: this.chatThreadKnownTotal,
      nextCursor: page.nextCursor ?? null,
      context: page.context ?? this.chatHeaderContext ?? undefined
    };
  }

  private emptyChatThreadPage(): PageResult<ContractTypes.ChatPopupMessage> {
    return {
      items: [],
      total: this.chatThreadVisibleTotal(),
      nextCursor: null,
      context: this.chatHeaderContext ?? undefined
    };
  }

  private chatThreadVisibleTotal(): number {
    return Math.max(this.chatThreadKnownTotal, this.messages.length);
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

  private async startLiveChatUpdates(chat: ChatDTO, sessionKey: string): Promise<void> {
    if (this.loadedSessionKey !== sessionKey || this.liveChatUnsubscribe) {
      return;
    }
    this.liveChatUnsubscribe = await this.chatsService.watchChatEvents(chat, event => {
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

  private buildOptimisticChatMessage(text: string): ContractTypes.ChatPopupMessage {
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
    } satisfies ContractTypes.ChatPopupMessage;
  }

  private isPendingOutgoingChatMessage(message: ContractTypes.ChatPopupMessage): boolean {
    const messageId = `${message.id ?? ''}`.trim();
    const clientId = `${message.clientId ?? ''}`.trim();
    return message.deliveryState === 'pending'
      && !!messageId
      && messageId === clientId
      && messageId.startsWith('pending:');
  }

  private confirmPendingChatMessage(pendingMessageId: string, message: ContractTypes.ChatPopupMessage): void {
    if (this.replacePendingMessage(pendingMessageId, message, true)) {
      return;
    }
    this.mergeIncomingChatMessage(message);
  }

  private mergeIncomingChatMessage(message: ContractTypes.ChatPopupMessage): void {
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
    if (this.messages.some(existingMessage => this.isSameChatMessage(existingMessage, normalizedMessage))) {
      this.replaceExistingChatMessage(normalizedMessage);
      return;
    }
    this.flagFreshMessage(normalizedMessage.id);
    this.messages = this.deduplicateChatMessages([...this.messages, normalizedMessage])
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(normalizedMessage);

    this.addMessageToVisibleThreadBottom(normalizedMessage.id, shouldStickToEnd);

    this.cdr.markForCheck();
  }

  private replaceExistingChatMessage(message: ContractTypes.ChatPopupMessage): void {
    const normalizedMessage = this.normalizeChatMessage(message);
    let changed = false;
    this.messages = this.messages.map(existingMessage => {
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
    this.messages = this.deduplicateChatMessages(this.messages)
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(normalizedMessage);
    this.refreshVisibleChatThreadSurface();
    this.cdr.markForCheck();
  }

  private confirmPendingStoredMessageEcho(message: ContractTypes.ChatPopupMessage): boolean {
    const messageId = `${message.id ?? ''}`.trim();
    if (!messageId) {
      return false;
    }
    const existing = this.messages.find(item => item.id === messageId);
    if (!existing || existing.deliveryState !== 'pending') {
      return false;
    }
    this.clearPendingMessageTimeout(messageId);
    this.clearPendingMessageState(messageId);
    this.syncEventChatSummaryFromMessage(existing);
    return true;
  }

  private isSameChatMessage(
    first: ContractTypes.ChatPopupMessage,
    second: ContractTypes.ChatPopupMessage
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

  private deduplicateChatMessages(messages: readonly ContractTypes.ChatPopupMessage[]): ContractTypes.ChatPopupMessage[] {
    const deduped: ContractTypes.ChatPopupMessage[] = [];
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

  private chatMessageIdentityKeys(message: ContractTypes.ChatPopupMessage): string[] {
    const id = `${message.id ?? ''}`.trim();
    const clientId = `${message.clientId ?? ''}`.trim();
    return [
      id ? `id:${id}` : '',
      clientId ? `client:${clientId}` : ''
    ].filter(Boolean);
  }

  private mergeDuplicateChatMessages(
    existing: ContractTypes.ChatPopupMessage,
    candidate: ContractTypes.ChatPopupMessage
  ): ContractTypes.ChatPopupMessage {
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

  private chatMessageAttachmentIdentity(message: ContractTypes.ChatPopupMessage): string {
    return (message.attachments ?? [])
      .map(attachment => [
        `${attachment.id ?? ''}`.trim(),
        `${attachment.type ?? ''}`.trim(),
        `${attachment.title ?? ''}`.trim()
      ].join(':'))
      .join(',');
  }

  private handleLiveChatEvent(chat: ChatDTO, event: ContractTypes.ChatLiveEvent): void {
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
    if (event.type === 'ack') {
      if (event.message) {
        this.mergeIncomingChatMessage(event.message);
      }
      return;
    }

    this.mergeIncomingChatMessage(event.message);
    if (!event.message.mine) {
      this.clearOpenChatUnreadState();
      void this.chatsService.markChatRead(chat, [event.message.id]);
    }
  }

  private applyTypingIndicator(indicator: ContractTypes.ChatTypingIndicator): void {
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

  private applyReadReceipt(read: ContractTypes.ChatReadReceipt): void {
    if (!read.userId || read.userId === this.activeUserId()) {
      return;
    }
    const loadedMessageIds = new Set(this.messages.map(message => message.id));
    const matchedMessageIds = new Set((read.messageIds ?? []).filter(messageId => loadedMessageIds.has(messageId)));
    if (matchedMessageIds.size === 0) {
      return;
    }

    let changed = false;
    this.messages = this.messages.map(message => {
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
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index];
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
    for (const message of this.messages) {
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

  private matchPendingMessageId(message: ContractTypes.ChatPopupMessage): string | null {
    if (!message.mine) {
      return null;
    }
    const normalizedClientId = `${message.clientId ?? ''}`.trim();
    if (normalizedClientId) {
      const exactPendingMatch = this.messages.find(pendingMessage =>
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

    for (const pendingMessage of this.messages) {
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
    message: ContractTypes.ChatPopupMessage,
    stickToEnd: boolean
  ): boolean {
    const pendingIndex = this.messages.findIndex(existingMessage => existingMessage.id === pendingMessageId);
    if (pendingIndex < 0) {
      return false;
    }

    this.clearPendingMessageTimeout(pendingMessageId);
    const pendingMessage = this.messages[pendingIndex];
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
    const nextMessage: ContractTypes.ChatPopupMessage = {
      ...normalizedMessage,
      id: `${normalizedMessage.id ?? ''}`.trim() || pendingMessageId,
      clientId: pendingClientId || normalizedMessage.clientId,
      reactions: hasQueuedReaction ? (pendingMessage?.reactions ?? []) : normalizedMessage.reactions,
      deliveryState: hasQueuedReaction ? 'pending' : normalizedMessage.deliveryState
    };
    let nextMessages = [...this.messages];
    const duplicateIndex = nextMessages.findIndex((existingMessage, index) => index !== pendingIndex && existingMessage.id === nextMessage.id);
    if (duplicateIndex >= 0) {
      nextMessages[duplicateIndex] = nextMessage;
      nextMessages = nextMessages.filter((_existingMessage, index) => index !== pendingIndex);
    } else {
      nextMessages[pendingIndex] = nextMessage;
    }

    this.messages = this.deduplicateChatMessages(nextMessages)
      .sort((first, second) => AppUtils.toSortableDate(second.sentAtIso) - AppUtils.toSortableDate(first.sentAtIso));
    this.rebuildVisibleReadReceipts();
    this.syncEventChatSummaryFromMessage(nextMessage);

    this.addMessageToVisibleThreadBottom(nextMessage.id, stickToEnd);

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
    void this.chatsService.updateChatMessage(session.item, normalizedStoredMessageId, { reactionEmoji })
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

  private async resyncChatThreadFromServer(chat: ChatDTO): Promise<void> {
    const sessionKey = this.loadedSessionKey;
    if (!sessionKey) {
      return;
    }
    const shouldStickToEnd = this.isChatThreadNearEnd();

    try {
      const snapshot = await this.chatsService.loadChatMessages(chat);
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      
      // FIX: Instead of replacing everything, we merge and sort
      // This preserves the "history" the user has already loaded in the UI
      const mergedMessages = this.mergeServerSnapshotWithPendingMessages(snapshot);
    
      this.messages = mergedMessages
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
    snapshot: readonly ContractTypes.ChatPopupMessage[]
  ): ContractTypes.ChatPopupMessage[] {
    const matchedPendingIds = new Set<string>();
    const snapshotMessages = snapshot.map(message => {
      const pendingId = this.matchPendingMessageId(message);
      if (!pendingId) {
        return message;
      }
      matchedPendingIds.add(pendingId);
      this.clearPendingMessageTimeout(pendingId);
      const pendingMessage = this.messages.find(existingMessage => existingMessage.id === pendingId);
      return this.normalizeChatMessage({
        ...message,
        clientId: pendingMessage?.clientId
      });
    });
    const unresolvedPendingMessages = this.messages.filter(message =>
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
    const pendingIndex = this.messages.findIndex(message => message.id === messageId && message.deliveryState === 'pending');
    if (pendingIndex < 0) {
      return;
    }
    const nextMessages = [...this.messages];
    nextMessages[pendingIndex] = {
      ...nextMessages[pendingIndex],
      deliveryState: 'timed-out'
    };
    this.messages = nextMessages;
    
    this.refreshVisibleChatThreadSurface();

    this.cdr.markForCheck();
  }

  private clearPendingMessageState(messageId: string): void {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    if (!normalizedMessageId) {
      return;
    }
    let changed = false;
    this.messages = this.messages.map(message => {
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
    const nextTotal = this.messages.length;
    this.visibleChatThreadTotal = nextTotal;
    if (this.chatThreadKnownTotal > previousTotal && nextTotal > previousTotal) {
      this.chatThreadKnownTotal += nextTotal - previousTotal;
    }
    const visibleTotal = this.chatThreadVisibleTotal();
    const smartList = this.chatThreadSmartList;
    if (!smartList) {
      this.chatThreadRevision++;
      this.syncChatThreadQuery();
      return;
    }

    const latestMessageById = new Map(this.messages.map(message => [message.id, message] as const));
    const currentVisibleItems = smartList.itemsSnapshot()
      .map(message => latestMessageById.get(message.id) ?? message)
      .filter(message => latestMessageById.has(message.id));
    if (currentVisibleItems.length === 0) {
      const nextVisibleCount = Math.min(nextTotal, this.chatInitialLoadMessageCount);
      if (nextVisibleCount === 0) {
        smartList.replaceVisibleItems([], { total: 0 });
        return;
      }
      smartList.replaceVisibleItems(
        this.messages.slice(0, nextVisibleCount),
        { total: visibleTotal }
      );
      return;
    }

    const addedCount = Math.max(0, nextTotal - previousTotal);
    const visibleMessageIds = new Set(currentVisibleItems.map(message => message.id));
    const addedBottomItems = addedCount > 0
      ? this.messages.filter(message => !visibleMessageIds.has(message.id)).slice(0, addedCount)
      : [];
    const nextVisibleItems = addedBottomItems.length > 0
      ? [...addedBottomItems, ...currentVisibleItems]
      : currentVisibleItems;
    if (nextVisibleItems.length === 0) {
      smartList.replaceVisibleItems([], { total: 0 });
      return;
    }
    smartList.replaceVisibleItems(
      nextVisibleItems,
      { total: visibleTotal }
    );
  }

  private addMessageToVisibleThreadBottom(messageId: string, stickToEnd: boolean): void {
    const normalizedMessageId = `${messageId ?? ''}`.trim();
    const smartList = this.chatThreadSmartList;
    if (!smartList) {
      this.chatThreadRevision++;
      this.syncChatThreadQuery();
      return;
    }

    const latestMessageById = new Map(this.messages.map(message => [message.id, message] as const));
    const currentVisibleItems = smartList.itemsSnapshot()
      .map(message => latestMessageById.get(message.id) ?? message)
      .filter(message => latestMessageById.has(message.id));
    const bottomMessage = normalizedMessageId ? latestMessageById.get(normalizedMessageId) : null;
    const nextVisibleItems = bottomMessage && !currentVisibleItems.some(message => message.id === bottomMessage.id)
      ? [bottomMessage, ...currentVisibleItems]
      : currentVisibleItems;

    smartList.replaceVisibleItems(nextVisibleItems, {
      total: this.chatThreadVisibleTotal()
    });
    this.visibleChatThreadTotal = this.messages.length;

    if (stickToEnd) {
      this.scheduleChatThreadScrollToEnd();
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
    return this.userProfileStore.activeUserId().trim();
  }

  private clearOpenChatUnreadState(): void {
    const session = this.session();
    if (!session || Math.max(0, Math.trunc(Number(session.item.unread) || 0)) === 0) {
      return;
    }
    this.activitiesStore.patchEventChatSessionItem(item => ({
      ...item,
      unread: 0
    }));
  }

  private markLoadedChatThreadAsRead(
    chat: ChatDTO,
    messages: readonly ContractTypes.ChatPopupMessage[]
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
    void this.chatsService.markChatRead(chat, unreadMessageIds);
  }

  private syncEventChatSummaryFromLatestMessage(): void {
    const latestMessage = this.messages[0];
    if (!latestMessage) {
      return;
    }
    this.syncEventChatSummaryFromMessage(latestMessage);
  }

  private syncEventChatSummaryFromMessage(message: ContractTypes.ChatPopupMessage): void {
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
    this.activitiesStore.patchEventChatSessionItem(item => ({
      ...item,
      lastMessage: nextLastMessage || item.lastMessage,
      lastSenderId: nextLastSenderId || item.lastSenderId,
      dateIso: nextDateIso || item.dateIso
    }));
  }

  private resolveChatMessageSenderId(
    message: ContractTypes.ChatPopupMessage,
    fallbackSenderId: string
  ): string {
    if (message.mine) {
      return this.activeUserId() || fallbackSenderId;
    }
    const senderId = `${message.senderAvatar?.id ?? ''}`.trim();
    return senderId || fallbackSenderId;
  }

  private normalizeChatMessages(
    messages: readonly ContractTypes.ChatPopupMessage[]
  ): ContractTypes.ChatPopupMessage[] {
    return messages.map((message, index) => this.normalizeChatMessage(message, index));
  }

  private normalizeChatMessage(
    message: ContractTypes.ChatPopupMessage,
    fallbackIndex: number | null = null
  ): ContractTypes.ChatPopupMessage {
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
    message: ContractTypes.ChatPopupMessage,
    fallbackIndex: number | null
  ): ContractTypes.ChatPopupMessage {
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

  protected chatAttachmentSummary(message: ContractTypes.ChatPopupMessage): string {
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
  ): Pick<ContractTypes.ChatPopupMessage, 'sender' | 'senderAvatar'> {
    const activeUser = this.userProfileStore.activeUserProfile() ?? (activeUserId ? this.userProfileStore.getUserProfile(activeUserId) : null);
    const initials = activeUser?.initials?.trim()
      || AppUtils.initialsFromText(activeUser?.name ?? 'Me');
    return {
      sender: 'You',
      senderAvatar: {
        id: activeUser?.id?.trim() || activeUserId || 'self',
        initials: initials || 'ME',
        gender: activeUser?.gender ?? 'man',
        imageUrl: AppUtils.mediaImageVariantUrl(activeUser?.images?.map(image => image.trim()).find(Boolean), 'small') || null
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
      void this.chatsService.sendChatTyping(session.item, false);
    }
  }

  private closeTransientMessageUi(options: { keepEditing?: boolean } = {}): void {
    this.chatThreadSmartList?.closeMenu();
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

  private syncSelectedChatHeader(
    chat: ChatDTO | null,
    options: {
      hydrateControls?: boolean;
      baseContext?: AppUiTypes.PopupHeaderContext | null;
    } = {}
  ): void {
    if (!chat) {
      this.chatHeaderContext = null;
      this.selectedChatNavigationState = null;
      this.resolvedChatEventRecord = null;
      this.resolvedChatEventRecordKey = '';
      this.resolvedChatResourceState = null;
      this.resolvedChatResourceStateKey = '';
      this.resolvedChatGroupSnapshot = null;
      this.resolvedChatGroupSnapshotKey = '';
      return;
    }
    if (options.hydrateControls === false) {
      this.selectedChatNavigationState = null;
      this.resolvedChatEventRecord = null;
      this.resolvedChatEventRecordKey = '';
      this.resolvedChatResourceState = null;
      this.resolvedChatResourceStateKey = '';
      this.resolvedChatGroupSnapshot = null;
      this.resolvedChatGroupSnapshotKey = '';
      this.chatHeaderContext = this.buildTitleOnlyChatHeaderContext(chat);
      return;
    }
    this.selectedChatNavigationState = this.buildSelectedChatNavigationState(chat);
    this.chatHeaderContext = this.buildSelectedChatHeaderContext(
      chat,
      this.selectedChatNavigationState,
      options.baseContext ?? null
    );
  }

  private buildTitleOnlyChatHeaderContext(chat: ChatDTO): AppUiTypes.PopupHeaderContext {
    const title = `${chat.title ?? ''}`.trim() || 'Chat';
    return {
      revision: `title:${chat.id}:${title}`,
      title,
      controls: []
    };
  }

  private async refreshSelectedChatHeader(chat: ChatDTO, sessionKey: string | null): Promise<void> {
    if (!sessionKey || this.loadedSessionKey !== sessionKey) {
      return;
    }
    const eventId = `${chat.eventId ?? ''}`.trim();
    if (eventId && this.resolvedChatEventRecordKey !== eventId) {
      const record = await this.eventsService.queryKnownRecordById(this.activeUserId(), eventId).catch(() => null);
      if (this.loadedSessionKey !== sessionKey) {
        return;
      }
      this.resolvedChatEventRecord = record;
      this.resolvedChatEventRecordKey = eventId;
      this.syncSelectedChatHeader(chat);
      this.cdr.markForCheck();
    }

    const state = this.selectedChatNavigationState;
    const ownerId = `${state?.eventId ?? chat.eventId ?? ''}`.trim();
    const subEventId = `${state?.subEvent?.id ?? ''}`.trim();
    const resourceKey = ownerId && subEventId ? `${ownerId}:${subEventId}` : '';
    if (resourceKey && this.resolvedChatResourceStateKey !== resourceKey) {
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

    await this.refreshSelectedChatGroupSnapshot(chat, sessionKey);
  }

  private async refreshSelectedChatGroupSnapshot(chat: ChatDTO, sessionKey: string | null): Promise<void> {
    if (!sessionKey || this.loadedSessionKey !== sessionKey) {
      return;
    }
    const state = this.selectedChatNavigationState;
    const ownerId = `${state?.eventId ?? chat.eventId ?? ''}`.trim();
    const subEventId = `${state?.subEvent?.id ?? chat.subEventId ?? ''}`.trim();
    const groupId = `${state?.group?.id ?? chat.groupId ?? ''}`.trim();
    const groupKey = this.selectedChatGroupSnapshotKey(ownerId, subEventId, groupId);
    if (!groupKey) {
      this.resolvedChatGroupSnapshot = null;
      this.resolvedChatGroupSnapshotKey = '';
      return;
    }
    if (this.resolvedChatGroupSnapshotKey === groupKey) {
      return;
    }
    const groups = await this.eventsService
      .queryTournamentStageGroups({
        eventId: ownerId,
        slotId: null,
        stageId: subEventId
      })
      .catch(() => []);
    if (this.loadedSessionKey !== sessionKey) {
      return;
    }
    this.resolvedChatGroupSnapshot = groups.find(group => `${group.id ?? ''}`.trim() === groupId) ?? null;
    this.resolvedChatGroupSnapshotKey = groupKey;
    this.syncSelectedChatHeader(chat);
    this.cdr.markForCheck();
  }

  private buildSelectedChatHeaderContext(
    chat: ChatDTO,
    state: SelectedChatNavigationState | null,
    loadedContext: AppUiTypes.PopupHeaderContext | null = null
  ): AppUiTypes.PopupHeaderContext {
    const baseContext = loadedContext
      ? this.clonePopupHeaderContext(loadedContext)
      : this.chatsService.buildChatPopupHeaderContext(chat, { includeThumbs: true });
    const controls = [...(baseContext.controls ?? []).map(control => ({ ...control }))];
    if (!this.isBlockedSupportChat() && chat.channelType !== 'serviceEvent') {
      controls.push(this.buildSelectedChatContextControl(chat, state));
    }
    return {
      ...baseContext,
      controls
    };
  }

  private clonePopupHeaderContext(context: AppUiTypes.PopupHeaderContext): AppUiTypes.PopupHeaderContext {
    return {
      ...context,
      controls: (context.controls ?? []).map(control => ({
        ...control,
        badge: control.badge ? { ...control.badge } : null,
        lookup: control.lookup ? { ...control.lookup } : null,
        visual: control.visual?.kind === 'thumbStack'
          ? {
              ...control.visual,
              thumbs: control.visual.thumbs.map(thumb => ({ ...thumb }))
            }
          : control.visual
            ? { ...control.visual }
            : null,
        menu: control.menu
          ? {
              ...control.menu,
              groups: control.menu.groups.map(group => ({
                ...group,
                controls: group.controls.map(menuControl => ({
                  ...menuControl,
                  badge: menuControl.badge ? { ...menuControl.badge } : null,
                  lookup: menuControl.lookup ? { ...menuControl.lookup } : null,
                  visual: menuControl.visual ? { ...menuControl.visual } : null
                }))
              }))
            }
          : null
      }))
    };
  }

  private buildSelectedChatContextControl(
    chat: ChatDTO,
    state: SelectedChatNavigationState | null
  ): AppUiTypes.PopupHeaderControl {
    const primaryControl = this.buildSelectedChatPrimaryControl(chat, state);
    const menu = state ? this.buildSelectedChatControlMenu(state, primaryControl) : null;
    return {
      ...primaryControl,
      id: 'chat-context',
      menu
    };
  }

  private buildSelectedChatPrimaryControl(
    chat: ChatDTO,
    state: SelectedChatNavigationState | null
  ): AppUiTypes.PopupHeaderControl {
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
        id: `${state?.eventId ?? chat.eventId ?? chat.id}`.trim()
      }
    };
  }

  private buildSelectedChatControlMenu(
    state: SelectedChatNavigationState,
    primaryControl: AppUiTypes.PopupHeaderControl
  ): AppUiTypes.PopupHeaderControlMenu | null {
    if (!state.subEvent || (state.channelType !== 'optionalSubEvent' && state.channelType !== 'groupSubEvent')) {
      return null;
    }
    const assetControls = (['Car', 'Accommodation', 'Supplies'] as const)
      .map(type => this.buildResourceControl(state.subEvent as ContractTypes.SubEventDTO, state, type));
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
    subEvent: ContractTypes.SubEventDTO,
    state: SelectedChatNavigationState,
    type: SelectedChatResourceType
  ): AppUiTypes.PopupHeaderControl {
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

  private buildSelectedChatNavigationState(chat: ChatDTO): SelectedChatNavigationState | null {
    const eventId = `${chat.eventId ?? ''}`.trim();
    const eventRecord = this.resolveSelectedChatEventRecord(chat);
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
      eventId: (eventRecord?.id ?? eventId) || null,
      eventTarget: eventRecord ? this.eventEditorTargetForRecord(eventRecord) : 'events',
      eventTitle: eventRecord?.title ?? chat.title ?? null,
      eventPendingMembers: Math.max(0, Math.trunc(Number(eventRecord?.pendingMembers) || 0)),
      subEvent,
      group: this.resolveSelectedChatGroup(chat, subEvent, (eventRecord?.id ?? eventId) || null),
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(resourceState?.assetAssignmentIds),
      assetCardsByType
    };
  }

  private selectedChatEventRecord(eventId: string): ActivityEventRecord | null {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    if (!normalizedEventId) {
      return null;
    }
    if (this.resolvedChatEventRecordKey === normalizedEventId) {
      return this.resolvedChatEventRecord;
    }
    return this.eventsService.peekKnownRecordById(this.activeUserId(), normalizedEventId);
  }

  private selectedChatEventEditorTarget(
    record: ActivityEventRecord | null,
    state: SelectedChatNavigationState | null
  ): ContractTypes.EventEditorTarget {
    return record
      ? this.eventEditorTargetForRecord(record)
      : state?.eventTarget ?? 'events';
  }

  private canEditSelectedChatEvent(
    record: ActivityEventRecord | null,
    state: SelectedChatNavigationState | null
  ): boolean {
    const subject = this.selectedChatEventMenuSubject(record, state);
    return ActivityEventInfoCardMenuConverter.canEditEvent(subject, {
      activeUserId: this.activeUserId()
    });
  }

  private selectedChatEventMenuSubject(
    record: ActivityEventRecord | null,
    state: SelectedChatNavigationState | null
  ): ActivityEventInfoCardMenuSubject | null {
    const eventId = `${record?.id ?? state?.eventId ?? this.session()?.item.eventId ?? ''}`.trim();
    if (!eventId) {
      return null;
    }
    return {
      menu: 'activity-event-card',
      id: eventId,
      status: record?.status ?? null,
      ownerUserId: record?.creatorUserId ?? null,
      adminIds: [...(record?.adminIds ?? [])],
      acceptedMemberUserIds: [...(record?.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record?.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(record?.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(record?.pendingRequestMemberUserIds ?? [])],
      eventScope: record?.type ?? null
    };
  }

  private eventEditorTargetForRecord(record: Pick<ActivityEventRecord, 'type' | 'creatorUserId' | 'adminIds'>): ContractTypes.EventEditorTarget {
    const activeUserId = this.activeUserId().trim();
    if (
      record.type === 'hosting'
      || (!!activeUserId && record.creatorUserId === activeUserId)
      || (record.adminIds ?? []).includes(activeUserId)
    ) {
      return 'hosting';
    }
    return 'events';
  }

  private chatChannelType(chat: ChatDTO): ContractTypes.ChatChannelType {
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

  private resolveSelectedChatEventRecord(chat: ChatDTO): ActivityEventRecord | null {
    const eventId = `${chat.eventId ?? ''}`.trim();
    if (!eventId) {
      return null;
    }
    if (this.resolvedChatEventRecordKey === eventId) {
      return this.resolvedChatEventRecord;
    }
    return this.eventsService.peekKnownRecordById(this.activeUserId(), eventId);
  }

  private resolveSelectedChatSubEvent(
    chat: ChatDTO,
    eventRecord: ActivityEventRecord | null
  ): ContractTypes.SubEventDTO | null {
    const subEventId = `${chat.subEventId ?? ''}`.trim();
    if (!subEventId) {
      return null;
    }
    return eventRecord?.subEvents?.find(subEvent => subEvent.id === subEventId) ?? null;
  }

  private resolveSelectedChatGroup(
    chat: ChatDTO,
    subEvent: ContractTypes.SubEventDTO | null,
    eventId: string | null
  ): SelectedChatGroupState | null {
    const groupId = `${chat.groupId ?? ''}`.trim();
    if (!groupId || !subEvent) {
      return null;
    }
    const groupKey = this.selectedChatGroupSnapshotKey(eventId, subEvent.id, groupId);
    const snapshot = groupKey && this.resolvedChatGroupSnapshotKey === groupKey
      ? this.resolvedChatGroupSnapshot
      : null;
    return {
      id: groupId,
      label: `${snapshot?.name ?? groupId}`.trim() || groupId,
      source: snapshot?.source ?? null,
      accepted: snapshot ? this.chatCountValue(snapshot.membersAccepted) : undefined,
      pending: snapshot ? this.chatCountValue(snapshot.membersPending) : undefined,
      capacityMin: snapshot ? this.chatCountValue(snapshot.capacityMin) : undefined,
      capacityMax: snapshot ? this.chatCountValue(snapshot.capacityMax) : undefined
    };
  }

  private selectedChatGroupSnapshotKey(
    eventId: string | null | undefined,
    subEventId: string | null | undefined,
    groupId: string | null | undefined
  ): string {
    const normalizedEventId = `${eventId ?? ''}`.trim();
    const normalizedSubEventId = `${subEventId ?? ''}`.trim();
    const normalizedGroupId = `${groupId ?? ''}`.trim();
    return normalizedEventId && normalizedSubEventId && normalizedGroupId
      ? `${normalizedEventId}:${normalizedSubEventId}:${normalizedGroupId}`
      : '';
  }

  private resolveSelectedChatResourceState(
    ownerId: string,
    subEventId: string
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const resourceKey = `${ownerId}:${subEventId}`;
    if (this.resolvedChatResourceStateKey === resourceKey) {
      return ActivityResourceBuilder.cloneState(this.resolvedChatResourceState);
    }
    return ActivityResourceBuilder.cloneState(
      this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId)
    );
  }

  private syncSubEventResourceCounts(
    subEvent: ContractTypes.SubEventDTO,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null,
    assetCards: readonly SubEventAssetCard[]
  ): ContractTypes.SubEventDTO {
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

  private applySelectedChatResourceMetricsUpdate(update: SubEventResourceMetricsUpdate): void {
    const session = this.session();
    const state = this.selectedChatNavigationState;
    const ownerId = `${state?.eventId ?? session?.item.eventId ?? ''}`.trim();
    const subEventId = `${state?.subEvent?.id ?? ''}`.trim();
    if (
      !session
      || !state?.subEvent
      || !ownerId
      || !subEventId
      || `${update.ownerId ?? ''}`.trim() !== ownerId
      || `${update.subEventId ?? ''}`.trim() !== subEventId
    ) {
      return;
    }
    const nextSubEvent: ContractTypes.SubEventDTO = {
      ...state.subEvent,
      carsAccepted: update.subEvent.carsAccepted,
      carsPending: update.subEvent.carsPending,
      carsCapacityMin: update.subEvent.carsCapacityMin,
      carsCapacityMax: update.subEvent.carsCapacityMax,
      accommodationAccepted: update.subEvent.accommodationAccepted,
      accommodationPending: update.subEvent.accommodationPending,
      accommodationCapacityMin: update.subEvent.accommodationCapacityMin,
      accommodationCapacityMax: update.subEvent.accommodationCapacityMax,
      suppliesAccepted: update.subEvent.suppliesAccepted,
      suppliesPending: update.subEvent.suppliesPending,
      suppliesCapacityMin: update.subEvent.suppliesCapacityMin,
      suppliesCapacityMax: update.subEvent.suppliesCapacityMax
    };
    this.resolvedChatResourceState = null;
    this.resolvedChatResourceStateKey = `${ownerId}:${subEventId}`;
    this.selectedChatNavigationState = {
      ...state,
      subEvent: nextSubEvent
    };
    this.chatHeaderContext = this.buildSelectedChatHeaderContext(session.item, this.selectedChatNavigationState);
    this.cdr.markForCheck();
  }

  private cloneSubEvent(subEvent: ContractTypes.SubEventDTO): ContractTypes.SubEventDTO {
    return {
      ...subEvent
    };
  }

  private flattenAssetCards(assetCardsByType: SubEventAssetCardsByType): SubEventAssetCard[] {
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

  private selectedChatHeaderActionPalette(): AppMenuPalette {
    const tone = this.selectedChatActionToneClass();
    if (tone === 'popup-chat-context-btn-tone-group') {
      return 'green';
    }
    if (tone === 'popup-chat-context-btn-tone-optional') {
      return 'violet';
    }
    return 'blue';
  }

  private chatContextControlMenuItem(control: AppUiTypes.PopupHeaderControl): AppMenuItem<string, ChatMenuContext> {
    const resourceType = this.popupControlResourceType(control);
    const counter = this.selectedChatMenuControlBadgeCount(control);
    return {
      id: `chat-context-${control.id}`,
      label: control.label,
      description: control.summary || undefined,
      icon: this.selectedChatMenuControlIcon(control),
      kind: 'action',
      layout: control.summary ? 'pill' : 'default',
      palette: resourceType ? this.resourceTypePalette(resourceType) : 'default',
      surface: resourceType ? 'tinted' : 'plain',
      counter: counter > 0 ? counter : null,
      context: { menu: 'chat-context', control }
    };
  }

  private selectedChatActionBadgeCount(
    chat: ChatDTO,
    state: SelectedChatNavigationState | null
  ): number {
    if (state?.subEvent && (state.channelType === 'optionalSubEvent' || state.channelType === 'groupSubEvent')) {
      return this.subEventPendingTotal(state.subEvent);
    }
    const eventPending = Math.max(0, Math.trunc(Number(state?.eventPendingMembers) || 0));
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

  private subEventPendingTotal(subEvent: ContractTypes.SubEventDTO): number {
    return this.chatCountValue(subEvent.membersPending)
      + this.chatCountValue(subEvent.carsPending)
      + this.chatCountValue(subEvent.accommodationPending)
      + this.chatCountValue(subEvent.suppliesPending);
  }

  private chatCountValue(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private resourceSummary(
    subEvent: ContractTypes.SubEventDTO,
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
      this.resolveSelectedChatResourceState(`${state.eventId ?? ''}`, subEvent.id),
      this.flattenAssetCards(state.assetCardsByType),
      accepted,
      pending
    );
    return `${accepted} / ${bounds.capacityMin} - ${bounds.capacityMax}`;
  }

  private resourceAcceptedCount(
    subEvent: ContractTypes.SubEventDTO,
    state: SelectedChatNavigationState,
    type: AppConstants.AssetType
  ): number {
    return ActivityResourceBuilder.resourceAcceptedCount(
      subEvent,
      type,
      this.resolveSelectedChatResourceState(`${state.eventId ?? ''}`, subEvent.id),
      this.flattenAssetCards(state.assetCardsByType)
    );
  }

  private resourcePendingCount(
    subEvent: ContractTypes.SubEventDTO,
    state: SelectedChatNavigationState,
    type: SelectedChatResourceType
  ): number {
    if (type === 'Members') {
      return this.chatCountValue(subEvent.membersPending);
    }
    return ActivityResourceBuilder.resourcePendingCount(
      subEvent,
      type,
      this.resolveSelectedChatResourceState(`${state.eventId ?? ''}`, subEvent.id),
      this.flattenAssetCards(state.assetCardsByType)
    );
  }

  private popupControlResourceType(control: AppUiTypes.PopupHeaderControl): SelectedChatResourceType | null {
    if (control.lookup?.type !== 'chatResource') {
      return null;
    }
    const id = `${control.lookup.id ?? ''}`.trim();
    return id === 'Members' || id === 'Car' || id === 'Accommodation' || id === 'Supplies'
      ? id
      : null;
  }

  private resourceTypePalette(type: SelectedChatResourceType): AppMenuPalette {
    if (type === 'Members') {
      return 'violet';
    }
    if (type === 'Car') {
      return 'blue';
    }
    if (type === 'Accommodation') {
      return 'green';
    }
    return 'brown';
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

  private firstAvailableAssetType(): AppConstants.AssetType | null {
    const state = this.selectedChatNavigationState;
    if (!state) {
      return null;
    }
    return (['Car', 'Accommodation', 'Supplies'] as const)
      .find(type => (state.assetCardsByType[type]?.length ?? 0) > 0)
      ?? null;
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
    const targetIndex = this.messages.findIndex(message => `${message.id ?? ''}`.trim() === normalizedMessageId);
    if (targetIndex < 0) {
      return false;
    }
    const smartList = this.chatThreadSmartList;
    const visibleCount = smartList?.itemsSnapshot().length ?? 0;
    if (!smartList || targetIndex < visibleCount) {
      return true;
    }
    smartList.replaceVisibleItems(
      this.messages.slice(0, targetIndex + 1),
      { total: this.chatThreadVisibleTotal() }
    );
    return true;
  }

  private replyReferenceText(message: ContractTypes.ChatPopupMessage): string {
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

  private attachmentReferenceLabel(attachment: ContractTypes.ChatMessageAttachment, fallbackType: string): string {
    const parts = this.attachmentReferenceParts(attachment, fallbackType);
    return [parts.title, parts.meta].filter(Boolean).join(' · ') || fallbackType;
  }

  private attachmentReferenceParts(attachment: ContractTypes.ChatMessageAttachment, fallbackType: string): { title: string; meta: string } {
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

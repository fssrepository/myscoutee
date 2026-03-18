import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  TemplateRef,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { AlertService } from '../../../shared/alert.service';
import type { ActivityMemberOwnerRef } from '../../../shared/activities-models';
import { APP_DEMO_DATA } from '../../../shared/demo-data';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppDemoGenerators } from '../../../shared/app-demo-generators';
import type * as AppTypes from '../../../shared/app-types';
import { AppUtils } from '../../../shared/app-utils';
import { ActivityMembersService, AppContext, type ActivityMembersSyncState, EventsService, GameService, UsersService, type UserDto } from '../../../shared/core';
import {
  InfoCardComponent,
  SmartListComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListStateChange
} from '../../../shared/ui';
import { NavigatorService } from '../../../navigator';
import { ActivitiesDbContextService } from '../../services/activities-db-context.service';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';

interface EventExploreFilters {
  userId: string;
  order: AppTypes.EventExploreOrder;
  friendsOnly: boolean;
  openSpotsOnly: boolean;
  topic: string;
}

@Component({
  selector: 'app-event-explore-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    InfoCardComponent,
    SmartListComponent
  ],
  templateUrl: './event-explore-popup.component.html',
  styleUrl: './event-explore-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventExplorePopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly gameService = inject(GameService);
  private readonly usersService = inject(UsersService);
  protected readonly navigatorService = inject(NavigatorService);
  protected readonly alertService = inject(AlertService);
  private readonly appCtx = inject(AppContext);

  protected readonly eventExploreOrderOptions = APP_DEMO_DATA.eventExploreOrderOptions;
  protected readonly topicFilterGroups = APP_STATIC_DATA.interestOptionGroups;

  private users: UserDto[] = [];
  private userByIdMap = new Map<string, UserDto>();

  protected isOpen = false;
  protected showOrderPicker = false;
  protected showTopicPicker = false;
  protected eventExploreOrder: AppTypes.EventExploreOrder = 'upcoming';
  protected eventExploreFilterFriendsOnly = false;
  protected eventExploreFilterHasRooms = false;
  protected eventExploreFilterTopic = '';

  protected eventExploreHeaderProgress = 0;
  protected eventExploreHeaderProgressLoading = false;
  protected eventExploreHeaderLoadingProgress = 0;
  protected eventExploreHeaderLoadingOverdue = false;
  protected eventExploreStickyLabel = 'No items';
  protected eventExploreHeaderDateLabel = '';

  protected selectedMembers: AppTypes.ActivityMemberEntry[] = [];
  protected selectedMembersTitle = '';
  protected selectedMembersPendingOnly = false;
  protected selectedMembersRecord: DemoEventRecord | null = null;

  private activeUserId = 'u1';
  private readonly exploreCache = new Map<string, DemoEventRecord[]>();
  private eventEditorPrewarmStarted = false;
  private lastAppliedActivityMembersUpdatedMs = 0;

  protected eventExploreSmartListQuery: Partial<ListQuery<EventExploreFilters>> = {};

  @ViewChild('eventExploreSmartList')
  private eventExploreSmartList?: SmartListComponent<DemoEventRecord, EventExploreFilters>;

  protected eventExploreItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<DemoEventRecord, EventExploreFilters>>;

  @ViewChild('eventExploreItemTemplate', { read: TemplateRef })
  private set eventExploreItemTemplate(value: TemplateRef<SmartListItemTemplateContext<DemoEventRecord, EventExploreFilters>> | undefined) {
    this.eventExploreItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly eventExploreLoadPage = (query: ListQuery<EventExploreFilters>) =>
    from(this.loadEventExplorePage(query));

  protected readonly eventExploreSmartListConfig: SmartListConfig<DemoEventRecord, EventExploreFilters> = {
    pageSize: 10,
    loadingDelayMs: 0,
    defaultView: 'list',
    emptyLabel: 'No visible events right now.',
    emptyDescription: 'Try another filter or check back later.',
    headerProgress: {
      enabled: true
    },
    presentation: 'list',
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'mandatory',
    scrollPaddingTop: '2.6rem',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true
    },
    stickyHeaderClass: 'event-explore-sticky-header',
    trackBy: (_index, record) => `${record.type}:${record.id}`,
    showGroupMarker: ({ groupIndex, scrollable }) => {
      if (groupIndex > 0) {
        return true;
      }
      return scrollable;
    },
    groupBy: (record, query) => this.eventExploreGroupLabel(record, query.filters?.order ?? this.eventExploreOrder)
  };

  constructor() {
    this.refreshUsersDirectory();

    effect(() => {
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request || request.type !== 'eventExplore') {
        return;
      }
      this.activitiesContext.clearActivitiesNavigationRequest();
      this.openEventExplore();
    });

    effect(() => {
      const nextActiveUserId = this.appCtx.activeUserId().trim() || 'u1';
      if (nextActiveUserId === this.activeUserId) {
        return;
      }
      this.activeUserId = nextActiveUserId;
      this.clearExploreCache();
      this.syncEventExploreQuery();
      if (this.isOpen) {
        this.reloadEventExploreSmartList();
      }
      this.cdr.markForCheck();
    });

    effect(() => {
      const sync = this.appCtx.activityMembersSync();
      if (!sync || sync.updatedMs <= this.lastAppliedActivityMembersUpdatedMs) {
        return;
      }
      this.lastAppliedActivityMembersUpdatedMs = sync.updatedMs;
      this.applyActivityMembersSyncState(sync);
    });
  }

  @HostListener('window:openFeaturePopup', ['$event'])
  protected onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type?: 'eventEditor' | 'eventExplore' }>;
    if (popupEvent.detail?.type !== 'eventExplore') {
      return;
    }
    this.openEventExplore();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.isOpen || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.selectedMembersRecord) {
      this.closeMembersPopup();
      return;
    }
    if (this.showTopicPicker) {
      this.showTopicPicker = false;
      this.cdr.markForCheck();
      return;
    }
    if (this.showOrderPicker) {
      this.showOrderPicker = false;
      this.cdr.markForCheck();
      return;
    }
    this.closeEventExplore();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (this.showOrderPicker && !target.closest('.event-explore-order-picker')) {
      this.showOrderPicker = false;
    }
    this.cdr.markForCheck();
  }

  protected onEventExploreSmartListStateChange(state: SmartListStateChange<DemoEventRecord, EventExploreFilters>): void {
    this.eventExploreHeaderProgress = state.progress;
    this.eventExploreHeaderProgressLoading = state.loading;
    this.eventExploreHeaderLoadingProgress = state.loadingProgress;
    this.eventExploreHeaderLoadingOverdue = state.loadingOverdue;
    this.eventExploreStickyLabel = state.stickyLabel || 'No items';
    this.cdr.markForCheck();
  }

  protected closeEventExplore(): void {
    this.isOpen = false;
    this.showOrderPicker = false;
    this.showTopicPicker = false;
    this.closeMembersPopup();
    this.resetHeaderState();
    this.cdr.markForCheck();
  }

  protected toggleEventExploreOrderPicker(event: Event): void {
    event.stopPropagation();
    this.showTopicPicker = false;
    this.showOrderPicker = !this.showOrderPicker;
  }

  protected selectEventExploreOrder(order: AppTypes.EventExploreOrder, event?: Event): void {
    event?.stopPropagation();
    if (this.eventExploreOrder === order) {
      this.showOrderPicker = false;
      this.cdr.markForCheck();
      return;
    }
    this.eventExploreOrder = order;
    this.showOrderPicker = false;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected toggleEventExploreFriendsOnly(event?: Event): void {
    event?.stopPropagation();
    this.eventExploreFilterFriendsOnly = !this.eventExploreFilterFriendsOnly;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected toggleEventExploreHasRooms(event?: Event): void {
    event?.stopPropagation();
    this.eventExploreFilterHasRooms = !this.eventExploreFilterHasRooms;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected toggleEventExploreTopicPicker(event: Event): void {
    event.stopPropagation();
    this.showOrderPicker = false;
    this.showTopicPicker = !this.showTopicPicker;
    this.cdr.markForCheck();
  }

  protected closeEventExploreTopicPicker(event?: Event): void {
    event?.stopPropagation();
    this.showTopicPicker = false;
    this.cdr.markForCheck();
  }

  protected selectEventExploreTopicFilter(topic: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedTopic = this.normalizeTopic(topic);
    this.eventExploreFilterTopic = normalizedTopic === this.normalizeTopic(this.eventExploreFilterTopic) ? '' : topic;
    this.showTopicPicker = false;
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  protected eventExploreTopicFilterLabel(): string {
    if (!this.eventExploreFilterTopic) {
      return 'Topic';
    }
    return `#${this.eventExploreTopicLabel(this.eventExploreFilterTopic)}`;
  }

  protected eventExploreOrderLabel(order: AppTypes.EventExploreOrder = this.eventExploreOrder): string {
    return this.eventExploreOrderOptions.find(option => option.key === order)?.label ?? 'Upcoming';
  }

  protected eventExploreOrderIcon(order: AppTypes.EventExploreOrder = this.eventExploreOrder): string {
    return this.eventExploreOrderOptions.find(option => option.key === order)?.icon ?? 'event_upcoming';
  }

  protected eventExploreOrderClass(order: AppTypes.EventExploreOrder = this.eventExploreOrder): string {
    if (order === 'upcoming') {
      return 'event-explore-order-upcoming';
    }
    if (order === 'past-events') {
      return 'event-explore-order-past-events';
    }
    if (order === 'nearby') {
      return 'event-explore-order-nearby';
    }
    if (order === 'top-rated') {
      return 'event-explore-order-top-rated';
    }
    return 'event-explore-order-most-relevant';
  }

  protected eventExploreHeaderTitle(): string {
    return 'Event Explore';
  }

  protected eventExploreHeaderSubtitle(): string {
    const parts = [this.eventExploreOrderLabel()];
    if (this.eventExploreFilterFriendsOnly) {
      parts.push('Friends going');
    }
    if (this.eventExploreFilterHasRooms) {
      parts.push('Open spots');
    }
    if (this.eventExploreFilterTopic) {
      parts.push(`#${this.eventExploreTopicLabel(this.eventExploreFilterTopic)}`);
    }
    return parts.join(' · ');
  }

  protected openEventExploreMembers(
    record: DemoEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    if (!this.isEventExploreOpenEvent(record)) {
      return;
    }
    this.activitiesContext.requestActivitiesNavigation({
      type: 'members',
      ownerId: record.id
    });
    this.cdr.markForCheck();
  }

  protected closeMembersPopup(): void {
    this.selectedMembersRecord = null;
    this.selectedMembers = [];
    this.selectedMembersTitle = '';
    this.selectedMembersPendingOnly = false;
  }

  protected activityMembersPendingCount(): number {
    return this.selectedMembers.filter(member => member.status === 'pending').length;
  }

  protected activityMembersHeaderSummary(): string {
    const pendingCount = this.activityMembersPendingCount();
    const acceptedCount = this.selectedMembers.length - pendingCount;
    if (pendingCount <= 0) {
      return `${acceptedCount} members`;
    }
    return `${acceptedCount} members · ${pendingCount} pending`;
  }

  protected get activityMembersOrdered(): AppTypes.ActivityMemberEntry[] {
    if (!this.selectedMembersPendingOnly) {
      return this.sortMembersByActionTimeDesc(this.selectedMembers);
    }
    return this.sortMembersByActionTimeDesc(this.selectedMembers)
      .filter(member => member.status === 'pending');
  }

  protected handleMembersTogglePendingOnly(): void {
    this.selectedMembersPendingOnly = !this.selectedMembersPendingOnly;
  }

  protected runEventExploreViewAction(
    record: DemoEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    this.activitiesContext.requestActivitiesNavigation({
      type: 'eventEditor',
      row: this.eventExploreRow(record),
      readOnly: true
    });
    this.cdr.markForCheck();
  }

  protected runEventExploreJoinAction(
    record: DemoEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    this.alertService.open(`Join request for ${record.title} is ready for backend wiring.`);
    this.cdr.markForCheck();
  }

  protected openHostImpressions(
    record: DemoEventRecord,
    event?: { stopPropagation?: () => void; preventDefault?: () => void }
  ): void {
    this.stopDomEvent(event);
    this.appCtx.setUserProfile(this.resolveUser(record.creatorUserId, record));
    void this.usersService.loadUserById(record.creatorUserId);
    this.navigatorService.openImpressionsPopup(record.creatorUserId);
  }

  protected eventExploreCreatorInitials(record: DemoEventRecord): string {
    return record.creatorInitials || AppUtils.initialsFromText(record.creatorName || record.title);
  }

  protected eventExploreVisibility(record: DemoEventRecord): AppTypes.EventVisibility {
    return record.visibility;
  }

  protected eventVisibilityIcon(visibility: AppTypes.EventVisibility): string {
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  protected eventExploreHasRooms(record: DemoEventRecord): boolean {
    return record.capacityTotal > record.acceptedMembers;
  }

  protected eventExploreIsFull(record: DemoEventRecord): boolean {
    return record.capacityTotal > 0 && record.acceptedMembers >= record.capacityTotal;
  }

  protected eventExploreMembersVisibilityIcon(record: DemoEventRecord): string {
    return this.eventBlindModeIcon(record.blindMode);
  }

  protected eventExploreMembersLabel(record: DemoEventRecord): string {
    if (record.capacityTotal <= 0) {
      return '0 / 0';
    }
    return `${record.acceptedMembers} / ${record.capacityTotal}`;
  }

  protected isEventExploreOpenEvent(record: DemoEventRecord): boolean {
    return record.blindMode === 'Open Event';
  }

  protected eventExploreTopicLabel(topic: string): string {
    return topic.replace(/^#+\s*/, '');
  }

  protected interestOptionToneClass(topic: string): string {
    const normalizedTopic = this.normalizeTopic(topic);
    if (!normalizedTopic) {
      return '';
    }
    for (const group of this.topicFilterGroups) {
      if (group.options.some(option => this.normalizeTopic(option) === normalizedTopic)) {
        return group.toneClass;
      }
    }
    return '';
  }

  protected eventExploreViewLabel(record: DemoEventRecord): string {
    return record.type === 'hosting' ? 'View hosted event' : 'View event';
  }

  protected eventExploreInfoCard(
    record: DemoEventRecord,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return {
      rowId: record.id,
      groupLabel: options.groupLabel ?? null,
      title: record.title,
      imageUrl: record.imageUrl,
      metaRows: [
        `${this.eventExploreTypeLabel(record)} · ${this.eventExploreVisibility(record)} · ${this.eventExploreDistanceLabel(record)}`
      ],
      description: record.subtitle,
      detailRows: [record.timeframe],
      detailStyle: 'mono',
      footerChips: record.topics.map(topic => ({
        label: `#${this.eventExploreTopicLabel(topic)}`,
        toneClass: this.interestOptionToneClass(topic)
      })),
      surfaceTone: this.eventExploreIsFull(record) ? 'full' : 'default',
      leadingIcon: {
        icon: this.eventVisibilityIcon(this.eventExploreVisibility(record)),
        tone: this.eventExploreVisibilityTone(record)
      },
      mediaStart: {
        variant: 'badge',
        layout: 'avatar-metric',
        tone: this.eventExploreCreatorOverlayTone(record),
        interactive: true,
        ariaLabel: 'Open host impressions',
        leadingAccessory: {
          label: this.eventExploreCreatorInitials(record),
          tone: this.eventExploreCreatorAvatarOverlayTone(record)
        },
        detailLabel: record.rating.toFixed(1),
        detailIcon: 'star'
      },
      mediaEnd: {
        variant: 'badge',
        layout: 'badge-with-leading-accessory',
        tone: this.isEventExploreOpenEvent(record)
          ? (this.eventExploreIsFull(record) ? 'full' : 'default')
          : 'inactive',
        interactive: this.isEventExploreOpenEvent(record),
        disabled: !this.isEventExploreOpenEvent(record),
        ariaLabel: this.isEventExploreOpenEvent(record) ? 'Open event members' : 'Members hidden for this event',
        label: this.eventExploreMembersLabel(record),
        leadingAccessory: {
          icon: this.eventExploreMembersVisibilityIcon(record),
          tone: this.eventExploreMembersVisibilityTone(record)
        }
      },
      menuActions: this.eventExploreInfoCardMenuActions(record),
      clickable: false
    };
  }

  protected onEventExploreInfoCardMenuAction(record: DemoEventRecord, action: InfoCardMenuActionEvent): void {
    if (action.actionId === 'view') {
      this.runEventExploreViewAction(record);
      return;
    }
    if (action.actionId === 'join') {
      this.runEventExploreJoinAction(record);
    }
  }

  private eventExploreInfoCardMenuActions(record: DemoEventRecord): readonly InfoCardMenuAction[] {
    return [
      {
        id: 'view',
        label: this.eventExploreViewLabel(record),
        icon: this.eventVisibilityIcon(this.eventExploreVisibility(record))
      },
      {
        id: 'join',
        label: 'Request join',
        icon: 'person_add',
        tone: 'accent'
      }
    ];
  }

  private eventExploreCreatorOverlayTone(record: DemoEventRecord): 'cool' | 'cool-mid' | 'neutral' | 'warm-mid' | 'warm' {
    const rating = AppUtils.clampNumber(record.rating, 0, 10);
    if (rating <= 3.0) {
      return 'cool';
    }
    if (rating <= 5.5) {
      return 'cool-mid';
    }
    if (rating <= 7.2) {
      return 'neutral';
    }
    if (rating <= 8.6) {
      return 'warm-mid';
    }
    return 'warm';
  }

  private eventExploreCreatorAvatarOverlayTone(
    record: DemoEventRecord
  ): 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8' {
    const toneIndex = (AppDemoGenerators.hashText(`${record.type}:${record.id}:${this.eventExploreCreatorInitials(record)}`) % 8) + 1;
    return `tone-${toneIndex}` as 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'tone-8';
  }

  private eventExploreMembersVisibilityTone(record: DemoEventRecord): 'positive' | 'negative' {
    return record.blindMode === 'Open Event' ? 'positive' : 'negative';
  }

  private eventExploreVisibilityTone(
    record: DemoEventRecord
  ): 'public' | 'friends' | 'invitation' {
    if (record.visibility === 'Friends only') {
      return 'friends';
    }
    if (record.visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  protected eventExploreDistanceLabel(record: DemoEventRecord): string {
    const rounded = Math.round(record.distanceKm * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  protected eventExploreTypeLabel(record: DemoEventRecord): string {
    return record.type === 'hosting' ? 'Hosting' : 'Event';
  }

  private openEventExplore(): void {
    this.isOpen = true;
    this.prewarmEventEditorPopup();
    this.refreshUsersDirectory();
    this.showOrderPicker = false;
    this.showTopicPicker = false;
    this.closeMembersPopup();
    this.clearExploreCache();
    this.syncEventExploreQuery();
    this.reloadEventExploreSmartList();
  }

  private syncEventExploreQuery(): void {
    this.eventExploreSmartListQuery = {
      filters: {
        userId: this.activeUserId,
        order: this.eventExploreOrder,
        friendsOnly: this.eventExploreFilterFriendsOnly,
        openSpotsOnly: this.eventExploreFilterHasRooms,
        topic: this.normalizeTopic(this.eventExploreFilterTopic)
      }
    };
  }

  private async loadEventExplorePage(query: ListQuery<EventExploreFilters>): Promise<PageResult<DemoEventRecord>> {
    const filters = this.resolveFilters(query);
    const items = await this.loadRecordsForFilters(filters);
    const pageSize = Math.max(1, Number(query.pageSize) || 10);
    const start = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length
    };
  }

  private async loadRecordsForFilters(filters: EventExploreFilters): Promise<DemoEventRecord[]> {
    const cacheKey = this.eventExploreCacheKey(filters);
    const cached = this.exploreCache.get(cacheKey);
    if (cached) {
      const cachedRecords = cached.map(record => this.cloneRecord(record));
      this.syncEventExploreHeaderDateLabel(cachedRecords);
      return cachedRecords;
    }
    const loaded = await this.eventsService.queryExploreItems(filters.userId);
    const filtered = this.sortExploreRecords(this.applyExploreFilters(loaded, filters), filters.order);
    this.syncEventExploreHeaderDateLabel(filtered);
    this.exploreCache.set(cacheKey, filtered.map(record => this.cloneRecord(record)));
    return filtered.map(record => this.cloneRecord(record));
  }

  private applyActivityMembersSyncState(sync: ActivityMembersSyncState): void {
    let changed = false;
    for (const [cacheKey, records] of this.exploreCache.entries()) {
      const nextRecords = records.map(record => {
        if (record.id !== sync.id) {
          return record;
        }
        changed = true;
        return {
          ...record,
          acceptedMembers: Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
          pendingMembers: Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0)),
          capacityTotal: Math.max(
            Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
            Math.trunc(Number(sync.capacityTotal) || 0)
          )
        };
      });
      this.exploreCache.set(cacheKey, nextRecords);
    }
    if (this.selectedMembersRecord?.id === sync.id) {
      this.selectedMembersRecord = {
        ...this.selectedMembersRecord,
        acceptedMembers: Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(sync.pendingMembers) || 0)),
        capacityTotal: Math.max(
          Math.max(0, Math.trunc(Number(sync.acceptedMembers) || 0)),
          Math.trunc(Number(sync.capacityTotal) || 0)
        )
      };
      changed = true;
    }
    if (changed && this.isOpen) {
      this.reloadEventExploreSmartList();
    }
    if (changed) {
      this.cdr.markForCheck();
    }
  }

  private applyExploreFilters(records: readonly DemoEventRecord[], filters: EventExploreFilters): DemoEventRecord[] {
    const selectedTopic = this.normalizeTopic(filters.topic);
    return records
      .filter(record => !filters.friendsOnly || this.eventExploreHasFriendGoing(record, filters.userId))
      .filter(record => !filters.openSpotsOnly || this.eventExploreHasRooms(record))
      .filter(record => !selectedTopic || record.topics.some(topic => this.normalizeTopic(topic) === selectedTopic))
      .map(record => this.cloneRecord(record));
  }

  private sortExploreRecords(
    records: readonly DemoEventRecord[],
    order: AppTypes.EventExploreOrder
  ): DemoEventRecord[] {
    const nowMs = Date.now();
    const startAtMs = (record: DemoEventRecord) => {
      const parsed = new Date(record.startAtIso).getTime();
      return Number.isFinite(parsed) ? parsed : nowMs;
    };
    const sorted = [...records];
    if (order === 'upcoming') {
      return sorted.sort((left, right) => {
        const leftMs = startAtMs(left);
        const rightMs = startAtMs(right);
        const leftPast = leftMs < nowMs;
        const rightPast = rightMs < nowMs;
        if (leftPast !== rightPast) {
          return Number(leftPast) - Number(rightPast);
        }
        return leftMs - rightMs;
      });
    }
    if (order === 'past-events') {
      return sorted.sort((left, right) => {
        const leftMs = startAtMs(left);
        const rightMs = startAtMs(right);
        const leftPast = leftMs < nowMs;
        const rightPast = rightMs < nowMs;
        if (leftPast !== rightPast) {
          return Number(rightPast) - Number(leftPast);
        }
        return rightMs - leftMs;
      });
    }
    if (order === 'nearby') {
      return sorted.sort((left, right) => left.distanceKm - right.distanceKm || right.relevance - left.relevance);
    }
    if (order === 'top-rated') {
      return sorted.sort((left, right) => right.rating - left.rating || right.relevance - left.relevance);
    }
    return sorted.sort((left, right) => right.relevance - left.relevance || startAtMs(left) - startAtMs(right));
  }

  private eventExploreGroupLabel(
    record: DemoEventRecord,
    order: AppTypes.EventExploreOrder
  ): string {
    if (order === 'nearby') {
      const bucket = Math.max(5, Math.ceil(record.distanceKm / 5) * 5);
      return `${bucket} km`;
    }
    if (order === 'top-rated') {
      const bucket = Math.max(1, Math.min(10, Math.round(AppUtils.clampNumber(record.rating, 0, 10))));
      return `${bucket} / 10`;
    }
    const parsed = new Date(record.startAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private eventExploreHasFriendGoing(record: DemoEventRecord, activeUserId: string): boolean {
    return record.acceptedMemberUserIds.some(userId =>
      userId !== activeUserId && AppDemoGenerators.isFriendOfActiveUser(userId, activeUserId)
    );
  }

  private eventExploreRow(record: DemoEventRecord): AppTypes.ActivityListRow {
    const sourceBase = {
      id: record.id,
      avatar: record.creatorInitials,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      imageUrl: record.imageUrl,
      visibility: record.visibility,
      blindMode: record.blindMode,
      location: record.location,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      topics: [...record.topics],
      sourceLink: record.sourceLink,
      creatorUserId: record.creatorUserId,
      creatorName: record.creatorName,
      creatorInitials: record.creatorInitials
    };
    if (record.type === 'hosting') {
      return {
        id: record.id,
        type: 'hosting',
        title: record.title,
        subtitle: record.subtitle,
        detail: record.timeframe,
        dateIso: record.startAtIso,
        distanceKm: record.distanceKm,
        unread: 0,
        metricScore: record.relevance,
        isAdmin: false,
        source: {
          ...sourceBase,
          published: record.published
        }
      };
    }
    return {
      id: record.id,
      type: 'events',
      title: record.title,
      subtitle: record.subtitle,
      detail: record.timeframe,
      dateIso: record.startAtIso,
      distanceKm: record.distanceKm,
      unread: 0,
      metricScore: record.relevance,
      isAdmin: false,
      source: {
        ...sourceBase,
        isAdmin: false
      }
    };
  }

  private eventMembersOwner(record: DemoEventRecord): ActivityMemberOwnerRef {
    return {
      ownerType: 'event',
      ownerId: record.id
    };
  }

  private async loadEventExploreMembers(owner: ActivityMemberOwnerRef, record: DemoEventRecord): Promise<void> {
    const members = await this.activityMembersService.queryMembersByOwner(owner);
    if (!this.selectedMembersRecord || this.selectedMembersRecord.id !== record.id) {
      return;
    }
    this.selectedMembers = this.sortMembersByActionTimeDesc(members);
    this.cdr.markForCheck();
  }

  private buildMemberEntries(record: DemoEventRecord): AppTypes.ActivityMemberEntry[] {
    const row = this.eventExploreRow(record);
    const rowKey = `${row.type}:${row.id}`;
    const acceptedUserIds = this.ensureMemberUserIds(
      record.acceptedMemberUserIds,
      record.acceptedMembers,
      record,
      new Set<string>(),
      true
    );
    const pendingUserIds = this.ensureMemberUserIds(
      record.pendingMemberUserIds,
      record.pendingMembers,
      record,
      new Set(acceptedUserIds),
      false
    );

    const entries: AppTypes.ActivityMemberEntry[] = [];
    for (const userId of acceptedUserIds) {
      const user = this.resolveUser(userId, record);
      const base = AppDemoGenerators.toActivityMemberEntry(
        user,
        { ...row, isAdmin: true },
        rowKey,
        record.creatorUserId,
        { status: 'accepted', pendingSource: null, invitedByActiveUser: false },
        APP_DEMO_DATA.activityMemberMetPlaces
      );
      entries.push({
        ...base,
        role: user.id === record.creatorUserId ? 'Admin' : 'Member'
      });
    }
    for (const userId of pendingUserIds) {
      const user = this.resolveUser(userId, record);
      const base = AppDemoGenerators.toActivityMemberEntry(
        user,
        { ...row, isAdmin: true },
        rowKey,
        record.creatorUserId,
        { status: 'pending', pendingSource: 'admin', invitedByActiveUser: false },
        APP_DEMO_DATA.activityMemberMetPlaces
      );
      entries.push({
        ...base,
        requestKind: 'invite',
        statusText: 'Invitation pending.'
      });
    }
    return entries;
  }

  private ensureMemberUserIds(
    sourceUserIds: readonly string[],
    count: number,
    record: DemoEventRecord,
    excluded: Set<string>,
    includeCreatorFirst: boolean
  ): string[] {
    const normalizedCount = Math.max(0, Math.trunc(Number(count) || 0));
    if (normalizedCount <= 0) {
      return [];
    }
    const result: string[] = [];
    const seen = new Set<string>(excluded);
    const tryAdd = (userId: string): void => {
      const normalized = `${userId ?? ''}`.trim();
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      result.push(normalized);
    };

    if (includeCreatorFirst) {
      tryAdd(record.creatorUserId);
    }
    for (const userId of sourceUserIds) {
      tryAdd(userId);
      if (result.length >= normalizedCount) {
        return result.slice(0, normalizedCount);
      }
    }

    const pool = [record.creatorUserId, ...this.users.map(user => user.id)];
    const seed = AppDemoGenerators.hashText(`event-explore-members:${record.id}:${record.type}:${includeCreatorFirst ? 'accepted' : 'pending'}`);
    for (let index = 0; result.length < normalizedCount && index < pool.length * 3; index += 1) {
      tryAdd(pool[(seed + index) % pool.length]);
    }
    return result.slice(0, normalizedCount);
  }

  private resolveUser(userId: string, record: DemoEventRecord): UserDto {
    return this.userByIdMap.get(userId)
      ?? this.userByIdMap.get(record.creatorUserId)
      ?? this.users[0]
      ?? {
        id: userId,
        name: record.creatorName,
        age: 30,
        birthday: '1996-01-01',
        city: record.creatorCity || 'Austin',
        height: '175 cm',
        physique: 'Athletic',
        languages: ['English'],
        horoscope: 'Aries',
        initials: AppUtils.initialsFromText(record.creatorName),
        gender: record.creatorGender,
        statusText: 'Recently Active',
        hostTier: 'Host',
        traitLabel: 'Reliable',
        completion: 60,
        headline: '',
        about: '',
        profileStatus: 'public',
        activities: { game: 0, chat: 0, invitations: 0, events: 0, hosting: 0 }
      };
  }

  private sortMembersByActionTimeDesc(entries: readonly AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    return [...entries].sort((left, right) =>
      AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso)
    );
  }

  private stopDomEvent(event?: { stopPropagation?: () => void; preventDefault?: () => void } | null): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  private resolveFilters(query: ListQuery<EventExploreFilters>): EventExploreFilters {
    return {
      userId: query.filters?.userId?.trim() || this.activeUserId,
      order: query.filters?.order ?? this.eventExploreOrder,
      friendsOnly: query.filters?.friendsOnly ?? this.eventExploreFilterFriendsOnly,
      openSpotsOnly: query.filters?.openSpotsOnly ?? this.eventExploreFilterHasRooms,
      topic: query.filters?.topic ?? this.normalizeTopic(this.eventExploreFilterTopic)
    };
  }

  private eventExploreCacheKey(filters: EventExploreFilters): string {
    return [
      filters.userId,
      filters.order,
      filters.friendsOnly ? 'friends' : 'all',
      filters.openSpotsOnly ? 'rooms' : 'all',
      filters.topic
    ].join('|');
  }

  private clearExploreCache(): void {
    this.exploreCache.clear();
  }

  private refreshUsersDirectory(): void {
    const users = this.gameService.getGameCardsUsersSnapshot();
    const activeProfile = this.appCtx.activeUserProfile();
    const nextUsers = [...users];

    if (activeProfile && !nextUsers.some(user => user.id === activeProfile.id)) {
      nextUsers.push(activeProfile);
    }

    this.users = nextUsers;
    this.userByIdMap = new Map(nextUsers.map(user => [user.id, user]));
  }

  private prewarmEventEditorPopup(): void {
    if (this.eventEditorPrewarmStarted) {
      return;
    }
    this.eventEditorPrewarmStarted = true;
    void import('../event-editor-popup/event-editor-popup.component');
  }

  private reloadEventExploreSmartList(): void {
    this.resetHeaderState();
    this.primeEventExploreHeaderDateLabel();
    this.eventExploreSmartList?.reload();
    this.cdr.markForCheck();
  }

  private resetHeaderState(): void {
    this.eventExploreHeaderProgress = 0;
    this.eventExploreHeaderProgressLoading = false;
    this.eventExploreHeaderLoadingProgress = 0;
    this.eventExploreHeaderLoadingOverdue = false;
    this.eventExploreStickyLabel = 'No items';
    this.eventExploreHeaderDateLabel = '';
  }

  private cloneRecord(record: DemoEventRecord): DemoEventRecord {
    return {
      ...record,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      topics: [...record.topics]
    };
  }

  protected normalizeTopic(topic: string | null | undefined): string {
    return AppUtils.normalizeText(topic ?? '');
  }

  private syncEventExploreHeaderDateLabel(records: readonly DemoEventRecord[]): void {
    this.eventExploreHeaderDateLabel = this.resolveEventExploreHeaderDateLabel(records);
    this.cdr.markForCheck();
  }

  private primeEventExploreHeaderDateLabel(): void {
    const filters = this.currentEventExploreFilters();
    const peeked = this.eventsService.peekExploreItems(filters.userId);
    if (peeked.length === 0) {
      return;
    }
    const filtered = this.sortExploreRecords(this.applyExploreFilters(peeked, filters), filters.order);
    this.eventExploreHeaderDateLabel = this.resolveEventExploreHeaderDateLabel(filtered);
  }

  private currentEventExploreFilters(): EventExploreFilters {
    return {
      userId: this.activeUserId,
      order: this.eventExploreOrder,
      friendsOnly: this.eventExploreFilterFriendsOnly,
      openSpotsOnly: this.eventExploreFilterHasRooms,
      topic: this.normalizeTopic(this.eventExploreFilterTopic)
    };
  }

  private resolveEventExploreHeaderDateLabel(records: readonly DemoEventRecord[]): string {
    const firstDatedRecord = records.find(record => this.isDateLikeEventExploreLabel(this.eventExploreDateLabel(record)));
    return firstDatedRecord ? this.eventExploreDateLabel(firstDatedRecord) : '';
  }

  private eventExploreDateLabel(record: DemoEventRecord): string {
    const parsed = new Date(record.startAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private isDateLikeEventExploreLabel(label: string | null | undefined): boolean {
    const normalizedLabel = `${label ?? ''}`.trim();
    if (!normalizedLabel) {
      return false;
    }
    return /^[A-Za-z]{3},\s[A-Za-z]{3}\s\d{1,2}$/.test(normalizedLabel);
  }

  private eventVisibilityClass(visibility: AppTypes.EventVisibility): string {
    if (visibility === 'Friends only') {
      return 'event-visibility-friends';
    }
    if (visibility === 'Invitation only') {
      return 'event-visibility-invitation';
    }
    return 'event-visibility-public';
  }

  private eventBlindModeIcon(mode: AppTypes.EventBlindMode): string {
    return mode === 'Blind Event' ? 'visibility_off' : 'visibility';
  }

  private eventBlindModeClass(mode: AppTypes.EventBlindMode): string {
    return mode === 'Blind Event' ? 'blind-mode-blind' : 'blind-mode-open';
  }

  private activityMemberAge(entry: AppTypes.ActivityMemberEntry): number {
    return this.userByIdMap.get(entry.userId)?.age ?? 0;
  }

  private activityMemberRoleLabel(entry: AppTypes.ActivityMemberEntry): string {
    return entry.role;
  }

  private activityMemberStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return 'Approved';
    }
    if (entry.requestKind === 'join') {
      return 'Waiting For Join Approval';
    }
    if (entry.pendingSource === 'admin') {
      return 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  private memberCardStatusIcon(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'admin_panel_settings' : 'person';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  private memberCardStatusClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-status-admin' : 'member-status-member';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-status-awaiting-approval';
    }
    return 'member-status-invite-pending';
  }

  private memberCardToneClass(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role === 'Admin' ? 'member-card-tone-admin' : 'member-card-tone-accepted';
    }
    if (entry.requestKind === 'join' || entry.pendingSource === 'member') {
      return 'member-card-tone-awaiting-approval';
    }
    return 'member-card-tone-invite-pending';
  }

  private memberCardStatusLabel(entry: AppTypes.ActivityMemberEntry): string {
    if (entry.status === 'accepted') {
      return entry.role;
    }
    return this.activityMemberStatusLabel(entry);
  }

  private activityMemberDeleteLabel(entry: AppTypes.ActivityMemberEntry): string {
    return entry.status === 'accepted' ? 'Remove member' : 'Delete invitation';
  }
}

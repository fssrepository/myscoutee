import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';
import { EventSubeventGroupFormPopupComponent } from '../event-subevent-group-form-popup/event-subevent-group-form-popup.component';
import { EventSubeventLeaderboardGroup, EventSubeventLeaderboardPopupComponent } from '../event-subevent-leaderboard-popup/event-subevent-leaderboard-popup.component';
import { EventSubeventStageFormPopupComponent, type EventSubeventStageFormPopupView } from '../event-subevent-stage-form-popup/event-subevent-stage-form-popup.component';
import { AppUtils } from '../../../shared/app-utils';
import { OwnedAssetsPopupFacadeService } from '../../../asset/owned-assets-popup-facade.service';
import type * as AppTypes from '../../../shared/core/base/models';
import { ActivityResourceBuilder, ActivityResourcesService, AppContext, EventsService } from '../../../shared/core';
import type { DemoEventRecord } from '../../../shared/core/demo/models/events.model';
import { EventEditorPopupStateService, EventEditorSubEventResourceType } from '../../services/event-editor-popup-state.service';
import {
  CounterBadgePipe,
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig
} from '../../../shared/ui';

type SubEventsDisplayMode = 'Casual' | 'Tournament';
type StageMenuAction = 'add-group' | 'leaderboard' | 'edit-stage' | 'delete-stage';
type GroupMenuAction = 'edit-group' | 'delete-group';
type StageInsertPlacement = 'before' | 'after';
type TournamentLeaderboardType = 'Score' | 'Fifa';

export interface EventSubeventsGroupItem {
  id?: string;
  name?: string;
  source?: string;
  membersPending?: number;
  capacityMin?: number;
  capacityMax?: number;
}

export interface EventSubeventsItem {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  location?: string;
  optional?: boolean;
  startAt?: string;
  endAt?: string;
  capacityMin?: number;
  capacityMax?: number;
  tournamentGroupCount?: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
  groups?: readonly EventSubeventsGroupItem[];
  membersPending?: number;
  membersAccepted?: number;
  carsPending?: number;
  accommodationPending?: number;
  suppliesPending?: number;
  carsAccepted?: number;
  accommodationAccepted?: number;
  suppliesAccepted?: number;
  carsCapacityMin?: number;
  carsCapacityMax?: number;
  accommodationCapacityMin?: number;
  accommodationCapacityMax?: number;
  suppliesCapacityMin?: number;
  suppliesCapacityMax?: number;
}

interface EventSubeventsStageRow {
  key: string;
  label: string;
  pending: number;
  groupId: string | null;
  groupName: string;
  tone: 'amber' | 'green' | 'mint' | 'teal';
  source: 'manual' | 'generated';
  stageSourceIndex: number;
}

interface EventSubeventsStageCard {
  key: string;
  menuKey: string;
  sourceIndex: number;
  stageNumber: number;
  title: string;
  subtitle: string;
  description: string;
  location: string;
  rangeLabel: string;
  groupsLabel: string;
  accentHue: number;
  startMs: number;
  endMs: number;
  rows: EventSubeventsStageRow[];
}

interface EventSubeventsPreparedItem extends EventSubeventsItem {
  resourceMetrics: EventSubeventsAssetMetricsByType;
  casualMenuPendingCount: number;
}

interface EventSubeventsSortedEntry {
  item: EventSubeventsPreparedItem;
  sourceIndex: number;
  startMs: number;
  stageId: string;
}

interface SubEventFormModel {
  id?: string;
  name: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  optional: boolean;
  capacityMin: number;
  capacityMax: number;
  tournamentGroupCount?: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
  groups?: readonly EventSubeventsGroupItem[];
}

interface GroupFormModel {
  name: string;
  capacityMin: number;
  capacityMax: number;
  membersPending: number;
}

interface DeleteTargetState {
  kind: 'stage' | 'group' | 'subevent';
  stageSourceIndex: number;
  groupId: string | null;
  label: string;
}

interface EventSubeventsAssetMetrics {
  accepted: number;
  pending: number;
  capacityMin: number;
  capacityMax: number;
}

type EventSubeventsAssetMetricsByType = Record<Exclude<EventEditorSubEventResourceType, 'Members'>, EventSubeventsAssetMetrics>;

@Component({
  selector: 'app-event-subevents-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    SmartListComponent,
    EventSubeventStageFormPopupComponent,
    EventSubeventGroupFormPopupComponent,
    EventSubeventLeaderboardPopupComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-subevents-popup.component.html',
  styleUrl: './event-subevents-popup.component.scss'
})
export class EventSubeventsPopupComponent implements OnChanges {
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  private readonly eventsService = inject(EventsService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly appCtx = inject(AppContext);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);

  @Input() open = false;
  @Input() readOnly = false;
  @Input() parentTitle = '';
  @Input() ownerId: string | null = null;
  @Input() subEvents: readonly EventSubeventsItem[] = [];
  @Input() displayMode: SubEventsDisplayMode = 'Casual';

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly displayModeChange = new EventEmitter<SubEventsDisplayMode>();
  @Output() readonly subEventsChange = new EventEmitter<EventSubeventsItem[]>();

  protected readonly displayModeOptions: readonly SubEventsDisplayMode[] = ['Casual', 'Tournament'];
  protected showDisplayModePicker = false;
  protected stagePageIndex = 0;
  protected isMobileViewport = this.readViewportWidth() <= 920;

  protected openStageMenuKey: string | null = null;
  protected openGroupMenuKey: string | null = null;
  protected openCasualMenuKey: string | null = null;

  protected showSubEventForm = false;
  protected subEventFormMode: 'create' | 'edit' = 'create';
  protected subEventFormSourceIndex: number | null = null;
  protected subEventForm: SubEventFormModel = this.createEmptySubEventForm();
  protected showSubEventOptionalPicker = false;
  protected subEventStageInsertPlacement: StageInsertPlacement = 'after';
  protected subEventStageInsertTargetId: string | null = null;
  protected readonly tournamentLeaderboardTypeOptions: readonly TournamentLeaderboardType[] = ['Score', 'Fifa'];

  protected showGroupForm = false;
  protected groupFormSourceIndex: number | null = null;
  protected groupFormGroupId: string | null = null;
  protected groupFormStageTitle = '';
  protected groupForm: GroupFormModel = this.createEmptyGroupForm();

  protected showLeaderboardPopup = false;
  protected leaderboardPopupStageKey: string | null = null;
  protected leaderboardPopupStageTitle = '';

  protected pendingDeleteTarget: DeleteTargetState | null = null;
  protected leaderboardPopupGroups: readonly EventSubeventLeaderboardGroup[] = [];
  protected leaderboardPopupMode: TournamentLeaderboardType = 'Score';

  private subEventFormPopupViewCacheKey = '';
  private subEventFormPopupViewCache: EventSubeventStageFormPopupView | null = null;

  private stageSwipeStartX: number | null = null;
  private stageSwipeDeltaX = 0;
  private workingSubEvents: EventSubeventsItem[] = [];
  protected sortedSubEvents: EventSubeventsPreparedItem[] = [];
  protected stageCards: EventSubeventsStageCard[] = [];
  protected stagePages: EventSubeventsStageCard[][] = [];
  protected visibleStageCards: EventSubeventsStageCard[] = [];
  private sortedEntries: EventSubeventsSortedEntry[] = [];
  private stagePageStartIndexesCache: number[] = [];
  private stageCardByKey = new Map<string, EventSubeventsStageCard>();
  private ownerHydrationSequence = 0;
  private localMutationVersion = 0;
  private casualListRevision = 0;

  protected casualSmartListQuery: Partial<ListQuery<{ revision: number }>> = {
    filters: { revision: 0 }
  };

  protected readonly casualSmartListConfig: SmartListConfig<EventSubeventsItem, { revision: number }> = {
    pageSize: 18,
    loadingDelayMs: 1500,
    defaultView: 'list',
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No sub events yet.',
    emptyDescription: 'Use + to add the first sub event.',
    listLayout: 'card-grid',
    desktopColumns: () => this.isMobileViewport ? 1 : 3,
    snapMode: 'none',
    containerClass: () => ({
      'subevents-casual-grid': true,
      'subevents-casual-grid-smart-list': true
    }),
    trackBy: (_index, item) => item.id ?? item.name ?? item.title ?? _index
  };

  protected readonly casualSmartListLoadPage = (query: ListQuery<{ revision: number }>) => of(this.loadCasualSubEventsPage(query));

  constructor() {
    effect(() => {
      this.ownedAssets.assetListRevision();
      this.rebuildRenderModel();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subEvents']) {
      this.applyWorkingSubEvents(this.subEvents);
    }

    if (changes['open']) {
      if (this.open) {
        this.resetTransientUi();
        this.rebuildRenderModel();
        this.alignPageToCurrentStage();
        void this.hydrateOwnerRecord();
      } else {
        this.resetTransientUi();
      }
    }

    if (changes['ownerId'] && this.open) {
      this.rebuildRenderModel();
      void this.hydrateOwnerRecord();
    }

    if (changes['displayMode'] && !changes['displayMode'].firstChange) {
      this.stagePageIndex = 0;
      this.clampStagePageIndex();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const nextMobileViewport = this.readViewportWidth() <= 920;
    if (nextMobileViewport === this.isMobileViewport) {
      return;
    }
    this.isMobileViewport = nextMobileViewport;
    this.rebuildRenderModel();
    this.alignPageToCurrentStage();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.subevents-mode-picker')) {
      this.showDisplayModePicker = false;
    }
    if (!target?.closest('.subevents-stage-actions')) {
      this.openStageMenuKey = null;
    }
    if (!target?.closest('.subevents-group-actions')) {
      this.openGroupMenuKey = null;
    }
    if (!target?.closest('.subevents-casual-actions')) {
      this.openCasualMenuKey = null;
    }
    if (!target?.closest('.subevent-optional-field')) {
      this.showSubEventOptionalPicker = false;
    }
  }

  protected requestClose(): void {
    this.resetTransientUi();
    this.close.emit();
  }

  protected openCreateSubEventForm(event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.showLeaderboardPopup = false;
    this.leaderboardPopupStageKey = null;
    this.leaderboardPopupStageTitle = '';
    this.leaderboardPopupGroups = [];
    this.leaderboardPopupMode = 'Score';
    this.showGroupForm = false;
    this.openStageMenuKey = null;
    this.openGroupMenuKey = null;
    this.openCasualMenuKey = null;
    this.subEventFormMode = 'create';
    this.subEventFormSourceIndex = null;

    const start = this.resolveNextSubEventStartAt();
    const end = new Date(start.getTime() + (2 * 60 * 60 * 1000));
    const stageNumber = this.workingSubEvents.length + 1;
    const defaultName = this.displayMode === 'Tournament' ? `Stage ${stageNumber}` : `Sub Event ${stageNumber}`;
    this.resetSubEventStageInsertControls();
    const fallbackGroupMin = this.defaultTournamentGroupCapacityMin();
    const fallbackGroupMax = this.defaultTournamentGroupCapacityMax(fallbackGroupMin);
    const fallbackStageMin = Math.max(fallbackGroupMin, this.defaultStageCapacityMin());
    const fallbackStageMax = Math.max(fallbackStageMin, this.defaultStageCapacityMax(fallbackStageMin));

    this.subEventForm = {
      id: undefined,
      name: defaultName,
      description: '',
      location: '',
      startAt: this.toInputDateTime(start),
      endAt: this.toInputDateTime(end),
      optional: this.displayMode !== 'Tournament',
      capacityMin: fallbackStageMin,
      capacityMax: fallbackStageMax,
      tournamentGroupCount: undefined,
      tournamentGroupCapacityMin: fallbackGroupMin,
      tournamentGroupCapacityMax: fallbackGroupMax,
      tournamentLeaderboardType: this.defaultTournamentLeaderboardType(),
      tournamentAdvancePerGroup: this.defaultTournamentAdvancePerGroup(),
      groups: []
    };

    this.showSubEventOptionalPicker = false;
    this.applySubEventInsertTargetDateRangeToForm();
    this.showSubEventForm = true;
  }

  protected toggleDisplayModePicker(event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.showDisplayModePicker = !this.showDisplayModePicker;
  }

  protected selectDisplayMode(mode: SubEventsDisplayMode, event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.showDisplayModePicker = false;
    if (this.displayMode === mode) {
      return;
    }
    this.localMutationVersion += 1;
    this.displayModeChange.emit(mode);
    this.stagePageIndex = 0;
  }

  protected currentDisplayModeIcon(mode: SubEventsDisplayMode = this.displayMode): string {
    return mode === 'Tournament' ? 'emoji_events' : 'groups';
  }

  protected canScrollStagePages(direction: -1 | 1): boolean {
    if (this.stagePages.length <= 1) {
      return false;
    }
    if (direction < 0) {
      return this.stagePageIndex > 0;
    }
    return this.stagePageIndex < this.stagePages.length - 1;
  }

  protected scrollStagePages(direction: -1 | 1, event: Event): void {
    event.stopPropagation();
    this.scrollStagePagesBy(direction);
  }

  protected onStageSwipeStart(event: TouchEvent): void {
    if (!this.isMobileViewport || this.displayMode !== 'Tournament') {
      return;
    }
    if (event.touches.length !== 1) {
      return;
    }
    this.stageSwipeStartX = event.touches[0]?.clientX ?? null;
    this.stageSwipeDeltaX = 0;
  }

  protected onStageSwipeMove(event: TouchEvent): void {
    if (!this.isMobileViewport || this.stageSwipeStartX === null || event.touches.length !== 1) {
      return;
    }
    this.stageSwipeDeltaX = (event.touches[0]?.clientX ?? this.stageSwipeStartX) - this.stageSwipeStartX;
  }

  protected onStageSwipeEnd(event: TouchEvent): void {
    if (!this.isMobileViewport || this.stageSwipeStartX === null) {
      this.onStageSwipeCancel();
      return;
    }

    const deltaX = this.stageSwipeDeltaX;
    this.onStageSwipeCancel();
    if (Math.abs(deltaX) < 44) {
      return;
    }

    if (deltaX < 0) {
      this.scrollStagePagesBy(1);
      return;
    }

    this.scrollStagePagesBy(-1);
  }

  protected onStageSwipeCancel(): void {
    this.stageSwipeStartX = null;
    this.stageSwipeDeltaX = 0;
  }

  protected stageRangeLabel(): string {
    const visible = this.visibleStageCards;
    if (visible.length === 0) {
      return 'Stage';
    }
    const first = visible[0]?.stageNumber ?? 1;
    const last = visible[visible.length - 1]?.stageNumber ?? first;
    return first === last ? `Stage ${first}` : `Stage ${first} - Stage ${last}`;
  }

  protected visibleStageStartLabel(): string {
    return this.visibleStageEdges()?.start.title ?? '';
  }

  protected visibleStageEndLabel(): string {
    return this.visibleStageEdges()?.end.title ?? '';
  }

  protected visibleStageHasRange(): boolean {
    const edges = this.visibleStageEdges();
    return !!edges && edges.start.stageNumber !== edges.end.stageNumber;
  }

  protected visibleStageStartColor(): string {
    const edges = this.visibleStageEdges();
    if (!edges) {
      return '';
    }
    return this.stageAccentColorByNumber(edges.start.stageNumber);
  }

  protected visibleStageEndColor(): string {
    const edges = this.visibleStageEdges();
    if (!edges) {
      return '';
    }
    return this.stageAccentColorByNumber(edges.end.stageNumber);
  }

  protected stagePeriodLabel(): string {
    const visible = this.visibleStagesForRangeLabel();
    if (visible.length === 0) {
      return '';
    }

    const finiteStart = visible
      .map(stage => stage.startMs)
      .filter(value => Number.isFinite(value));
    const finiteEnd = visible
      .map(stage => stage.endMs)
      .filter(value => Number.isFinite(value));

    if (finiteStart.length === 0 || finiteEnd.length === 0) {
      return 'Date pending';
    }

    const minStart = Math.min(...finiteStart);
    const maxEnd = Math.max(...finiteEnd);
    return `${this.shortMonthDay(minStart)} - ${this.shortMonthDay(maxEnd)}`;
  }

  protected previousStageLabel(): string {
    return this.previousStage()?.title ?? '';
  }

  protected previousStageColor(): string {
    const stage = this.previousStage();
    if (!stage) {
      return '';
    }
    return this.stageAccentColorByNumber(stage.stageNumber);
  }

  protected nextStageLabel(): string {
    return this.nextStage()?.title ?? '';
  }

  protected nextStageColor(): string {
    const stage = this.nextStage();
    if (!stage) {
      return '';
    }
    return this.stageAccentColorByNumber(stage.stageNumber);
  }

  protected stageAccentColor(stage: EventSubeventsStageCard): string {
    return `hsl(${stage.accentHue} 76% 54%)`;
  }

  protected stageRowToneClass(stage: EventSubeventsStageCard, row: EventSubeventsStageRow): string {
    return `subevents-group-row-${row.tone}`;
  }

  protected casualCardToneClass(item: EventSubeventsItem): string {
    return item.optional ? 'subevents-casual-card-optional' : 'subevents-casual-card-mandatory';
  }

  protected casualCardTitle(item: EventSubeventsItem, index: number): string {
    const fallback = `Sub event ${index + 1}`;
    return `${item.name ?? item.title ?? fallback}`.trim() || fallback;
  }

  protected casualCardRange(item: EventSubeventsItem): string {
    return this.subEventRangeLabel(item);
  }

  protected casualCardResources(item: EventSubeventsItem): string {
    const members = this.toPendingCount(item.membersPending);
    const cars = this.toPendingCount(item.carsPending);
    const accommodation = this.toPendingCount(item.accommodationPending);
    const supplies = this.toPendingCount(item.suppliesPending);
    const acceptedMembers = this.toPendingCount(item.membersAccepted);
    return `Members ${acceptedMembers}/${Math.max(acceptedMembers, members + acceptedMembers)} · Car ${cars} · Accommodation ${accommodation} · Supplies ${supplies}`;
  }

  protected subEventMembersResourceLabel(item: EventSubeventsItem, row?: EventSubeventsStageRow | null): string {
    const accepted = this.toPendingCount(item.membersAccepted);
    const { min, max } = this.resourceCapacityRange(item, row);
    return `${accepted} / ${min} - ${max}`;
  }

  protected subEventAssetResourceLabel(
    item: EventSubeventsItem,
    type: Exclude<EventEditorSubEventResourceType, 'Members'>,
    row?: EventSubeventsStageRow | null
  ): string {
    const joined = this.resourceJoinedCount(item, type);
    const { min, max } = this.resourceAssetCapacityRange(item, type, row);
    return `${joined} / ${min} - ${max}`;
  }

  protected resourcePendingCount(
    item: EventSubeventsItem,
    type: EventEditorSubEventResourceType,
    row?: EventSubeventsStageRow | null
  ): number {
    if (type === 'Members') {
      if (row) {
        return this.toPendingCount(row.pending);
      }
      return this.toPendingCount(item.membersPending);
    }
    const subEvent = this.toSubEventResourceItem(item);
    if (!subEvent) {
      if (type === 'Car') {
        return this.toPendingCount(item.carsPending);
      }
      if (type === 'Accommodation') {
        return this.toPendingCount(item.accommodationPending);
      }
      return this.toPendingCount(item.suppliesPending);
    }
    return this.preparedAssetMetricsForItem(item, type, subEvent).pending;
  }

  protected openSubEventResourcePopup(
    type: EventEditorSubEventResourceType,
    item: EventSubeventsItem,
    event: Event,
    row?: EventSubeventsStageRow | null
  ): void {
    event.stopPropagation();
    this.openStageMenuKey = null;
    this.openGroupMenuKey = null;
    this.openCasualMenuKey = null;

    const group = row
      ? (() => {
        const range = type === 'Members'
          ? this.resourceCapacityRange(item, row)
          : this.resourceAssetCapacityRange(item, type, row);
        return {
          id: row.groupId,
          groupLabel: row.groupName,
          pending: this.resourcePendingCount(item, type, row),
          capacityMin: range.min,
          capacityMax: range.max
        };
      })()
      : null;

    this.eventEditorService.requestSubEventResourcePopup({
      type,
      ownerId: this.ownerId,
      parentTitle: this.parentTitle,
      subEvent: {
        ...item,
        id: item.id ?? this.nextId('subevent')
      },
      group
    });
  }

  protected casualCardMenuKey(item: EventSubeventsItem, index: number): string {
    return item.id ?? `casual-${index}`;
  }

  protected isCasualActionMenuOpen(item: EventSubeventsItem, index: number): boolean {
    return this.openCasualMenuKey === this.casualCardMenuKey(item, index);
  }

  protected casualMenuPendingCount(item: EventSubeventsItem): number {
    return (item as EventSubeventsPreparedItem).casualMenuPendingCount ?? this.buildCasualMenuPendingCount(item);
  }

  protected groupMenuPendingCount(item: EventSubeventsItem, row: EventSubeventsStageRow): number {
    const members = this.resourcePendingCount(item, 'Members', row);
    return members
      + this.preparedAssetMetricsForItem(item, 'Car').pending
      + this.preparedAssetMetricsForItem(item, 'Accommodation').pending
      + this.preparedAssetMetricsForItem(item, 'Supplies').pending;
  }

  protected toggleCasualActionMenu(item: EventSubeventsItem, index: number, event: Event): void {
    event.stopPropagation();
    this.openStageMenuKey = null;
    this.openGroupMenuKey = null;
    const key = this.casualCardMenuKey(item, index);
    this.openCasualMenuKey = this.openCasualMenuKey === key ? null : key;
  }

  protected runCasualMenuAction(action: 'edit' | 'delete', item: EventSubeventsItem, index: number, event: Event): void {
    event.stopPropagation();
    this.openCasualMenuKey = null;
    if (this.readOnly) {
      return;
    }

    const sourceIndex = this.sourceIndexForItem(item, index);
    if (sourceIndex < 0) {
      return;
    }

    if (action === 'edit') {
      this.openEditSubEventFormAtIndex(sourceIndex);
      return;
    }

    this.pendingDeleteTarget = {
      kind: 'subevent',
      stageSourceIndex: sourceIndex,
      groupId: null,
      label: this.casualCardTitle(item, index)
    };
  }

  protected isStageActionMenuOpen(stage: EventSubeventsStageCard): boolean {
    return this.openStageMenuKey === stage.key;
  }

  protected toggleStageActionMenu(stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    this.openGroupMenuKey = null;
    this.openCasualMenuKey = null;
    this.openStageMenuKey = this.openStageMenuKey === stage.key ? null : stage.key;
  }

  protected runStageMenuAction(action: StageMenuAction, stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    this.openStageMenuKey = null;
    if (this.readOnly && action !== 'leaderboard') {
      return;
    }

    switch (action) {
      case 'add-group':
        this.openCreateGroupForm(stage, event);
        return;
      case 'leaderboard':
        this.openStageLeaderboard(stage, event);
        return;
      case 'edit-stage':
        this.openEditStageForm(stage, event);
        return;
      case 'delete-stage':
        this.requestDeleteStage(stage, event);
        return;
      default:
        return;
    }
  }

  protected openStageLeaderboard(stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    this.openStageMenuKey = null;
    this.openLeaderboardPopup(stage, event);
  }

  protected canOpenStageLocation(stage: EventSubeventsStageCard): boolean {
    const source = this.workingSubEvents[stage.sourceIndex] ?? null;
    return this.canOpenSubEventLocation(source);
  }

  protected openStageLocation(stage: EventSubeventsStageCard, event?: Event): void {
    const source = this.workingSubEvents[stage.sourceIndex] ?? null;
    if (!source) {
      return;
    }
    this.openSubEventLocation(source, event);
  }

  protected isGroupActionMenuOpen(row: EventSubeventsStageRow): boolean {
    return this.openGroupMenuKey === row.key;
  }

  protected toggleGroupActionMenu(row: EventSubeventsStageRow, event: Event): void {
    event.stopPropagation();
    this.openStageMenuKey = null;
    this.openCasualMenuKey = null;
    this.openGroupMenuKey = this.openGroupMenuKey === row.key ? null : row.key;
  }

  protected runGroupMenuAction(action: GroupMenuAction, row: EventSubeventsStageRow, event: Event): void {
    event.stopPropagation();
    this.openGroupMenuKey = null;
    if (this.readOnly) {
      return;
    }

    if (action === 'edit-group') {
      this.openEditGroupForm(row, event);
      return;
    }

    this.requestDeleteGroup(row, event);
  }

  protected subEventModeClass(optional: boolean): 'subevent-mode-mandatory' | 'subevent-mode-optional' {
    return optional ? 'subevent-mode-optional' : 'subevent-mode-mandatory';
  }

  protected subEventModeIcon(optional: boolean): string {
    return optional ? 'toggle_on' : 'block';
  }

  protected toggleSubEventOptionalPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.displayMode === 'Tournament') {
      this.showSubEventOptionalPicker = false;
      return;
    }
    this.showSubEventOptionalPicker = !this.showSubEventOptionalPicker;
  }

  protected selectSubEventOptional(optional: boolean): void {
    if (this.displayMode === 'Tournament') {
      this.subEventForm.optional = false;
      this.showSubEventOptionalPicker = false;
      return;
    }
    this.subEventForm.optional = optional;
    if (optional) {
      this.normalizeSubEventCapacityRange();
    }
    this.showSubEventOptionalPicker = false;
  }

  protected onSubEventCapacityMinChange(value: number | string): void {
    const parsed = Number(value);
    this.subEventForm.capacityMin = Math.max(0, Number.isFinite(parsed) ? Math.trunc(parsed) : this.subEventForm.capacityMin);
    this.normalizeSubEventCapacityRange();
  }

  protected onSubEventCapacityMaxChange(value: number | string): void {
    if (value === '' || value === null || value === undefined) {
      return;
    }
    const parsed = Number(value);
    this.subEventForm.capacityMax = Math.max(
      Math.max(0, this.subEventForm.capacityMin),
      Number.isFinite(parsed) ? Math.trunc(parsed) : this.subEventForm.capacityMax
    );
    this.normalizeSubEventCapacityRange();
  }

  protected showSubEventOptionalToggle(): boolean {
    return this.displayMode !== 'Tournament';
  }

  protected showSubEventInsertControls(): boolean {
    return this.subEventInsertTargetSource().length > 0;
  }

  protected subEventInsertFieldLabel(): string {
    return this.displayMode === 'Tournament' ? 'Insert Stage' : 'Insert Sub Event';
  }

  protected get subEventStageInsertOptions(): Array<{ id: string; label: string }> {
    const source = this.subEventInsertTargetSource();
    return source.map((item, index) => ({
      id: item.id ?? `subevent-option-${index}`,
      label: this.displayMode === 'Tournament'
        ? `Stage ${this.resolveStageNumberById(item.id) ?? (index + 1)} · ${item.name ?? item.title ?? 'Untitled'}`
        : `${item.name ?? item.title ?? `Sub Event ${index + 1}`}`
    }));
  }

  protected trackBySubEventStageInsertOption(_: number, option: { id: string }): string {
    return option.id;
  }

  protected selectSubEventStageInsertPlacement(placement: StageInsertPlacement): void {
    if (this.subEventStageInsertPlacement === placement) {
      return;
    }
    this.subEventStageInsertPlacement = placement;
    this.applySubEventInsertTargetDateRangeToForm();
  }

  protected onSubEventStageInsertTargetChange(value: string | null | undefined): void {
    const nextValue = value || null;
    if (this.subEventStageInsertTargetId === nextValue) {
      return;
    }
    this.subEventStageInsertTargetId = nextValue;
    this.applySubEventInsertTargetDateRangeToForm();
  }

  protected showTournamentStageConfigFields(): boolean {
    return this.displayMode === 'Tournament';
  }

  protected onTournamentGroupCapacityMinChange(value: number | string): void {
    if (value === '' || value === null || value === undefined) {
      this.subEventForm.tournamentGroupCapacityMin = undefined;
      return;
    }
    const parsed = Number(value);
    this.subEventForm.tournamentGroupCapacityMin = Number.isFinite(parsed)
      ? Math.max(0, Math.trunc(parsed))
      : this.subEventForm.tournamentGroupCapacityMin;
    this.normalizeTournamentStageConfigOnForm();
  }

  protected onTournamentGroupCapacityMaxChange(value: number | string): void {
    if (value === '' || value === null || value === undefined) {
      this.subEventForm.tournamentGroupCapacityMax = undefined;
      return;
    }
    const parsed = Number(value);
    this.subEventForm.tournamentGroupCapacityMax = Number.isFinite(parsed)
      ? Math.max(0, Math.trunc(parsed))
      : this.subEventForm.tournamentGroupCapacityMax;
    this.normalizeTournamentStageConfigOnForm();
  }

  protected tournamentLeaderboardTypeValue(): TournamentLeaderboardType {
    return this.normalizedTournamentLeaderboardType(this.subEventForm.tournamentLeaderboardType);
  }

  protected tournamentLeaderboardTypeIcon(value: TournamentLeaderboardType = this.tournamentLeaderboardTypeValue()): string {
    return value === 'Fifa' ? 'sports_soccer' : 'leaderboard';
  }

  protected tournamentLeaderboardTypeClass(value: TournamentLeaderboardType = this.tournamentLeaderboardTypeValue()): string {
    return value === 'Fifa' ? 'tournament-leaderboard-fifa' : 'tournament-leaderboard-score';
  }

  protected onTournamentLeaderboardTypeChange(value: TournamentLeaderboardType | string | null | undefined): void {
    this.subEventForm.tournamentLeaderboardType = this.normalizedTournamentLeaderboardType(value);
  }

  protected onTournamentAdvancePerGroupChange(value: number | string): void {
    if (value === '' || value === null || value === undefined) {
      this.subEventForm.tournamentAdvancePerGroup = undefined;
      return;
    }
    const parsed = Number(value);
    this.subEventForm.tournamentAdvancePerGroup = Number.isFinite(parsed)
      ? Math.max(0, Math.trunc(parsed))
      : this.subEventForm.tournamentAdvancePerGroup;
  }


  protected subEventFormPopupView(): EventSubeventStageFormPopupView {
    const title = this.subEventFormTitle();
    const canSave = this.canSaveSubEventForm();
    const invalidName = this.subEventFieldInvalid('name');
    const invalidDescription = this.subEventFieldInvalid('description');
    const showOptionalToggle = this.showSubEventOptionalToggle();
    const modeClass = this.subEventModeClass(this.subEventForm.optional);
    const modeIcon = this.subEventModeIcon(this.subEventForm.optional);
    const showInsertControls = this.showSubEventInsertControls();
    const insertFieldLabel = this.subEventInsertFieldLabel();
    const insertOptions = this.subEventStageInsertOptions;
    const showTournamentFields = this.showTournamentStageConfigFields();
    const tournamentLeaderboardTypeValue = this.tournamentLeaderboardTypeValue();
    const tournamentLeaderboardTypeClass = this.tournamentLeaderboardTypeClass(tournamentLeaderboardTypeValue);
    const tournamentLeaderboardTypeIcon = this.tournamentLeaderboardTypeIcon(tournamentLeaderboardTypeValue);
    const tournamentEstimatedGroupCountLabel = this.tournamentEstimatedGroupCountLabel();

    const cacheKey = [
      this.showSubEventForm ? '1' : '0',
      this.parentTitle,
      title,
      this.readOnly ? '1' : '0',
      canSave ? '1' : '0',
      invalidName ? '1' : '0',
      invalidDescription ? '1' : '0',
      showOptionalToggle ? '1' : '0',
      this.showSubEventOptionalPicker ? '1' : '0',
      this.subEventForm.optional ? '1' : '0',
      modeClass,
      modeIcon,
      showInsertControls ? '1' : '0',
      insertFieldLabel,
      this.subEventStageInsertPlacement,
      this.subEventStageInsertTargetId ?? '',
      insertOptions.map(option => `${option.id}:${option.label}`).join('|'),
      showTournamentFields ? '1' : '0',
      tournamentLeaderboardTypeValue,
      tournamentLeaderboardTypeClass,
      tournamentLeaderboardTypeIcon,
      tournamentEstimatedGroupCountLabel
    ].join('||');

    if (this.subEventFormPopupViewCacheKey === cacheKey && this.subEventFormPopupViewCache) {
      return this.subEventFormPopupViewCache;
    }

    const nextView: EventSubeventStageFormPopupView = {
      open: this.showSubEventForm,
      parentTitle: this.parentTitle,
      title,
      readOnly: this.readOnly,
      canSave,
      invalidName,
      invalidDescription,
      showOptionalToggle,
      showOptionalPicker: this.showSubEventOptionalPicker,
      modeClass,
      modeIcon,
      showInsertControls,
      insertFieldLabel,
      insertPlacement: this.subEventStageInsertPlacement,
      insertTargetId: this.subEventStageInsertTargetId,
      insertOptions,
      showTournamentFields,
      tournamentLeaderboardTypeOptions: this.tournamentLeaderboardTypeOptions,
      tournamentLeaderboardTypeValue,
      tournamentLeaderboardTypeClass,
      tournamentLeaderboardTypeIcon,
      tournamentEstimatedGroupCountLabel
    };

    this.subEventFormPopupViewCacheKey = cacheKey;
    this.subEventFormPopupViewCache = nextView;
    return nextView;
  }

  protected tournamentEstimatedGroupCountLabel(): string {
    const groupMin = this.defaultTournamentGroupCapacityMin();
    const groupMax = this.defaultTournamentGroupCapacityMax(groupMin);
    const stageMin = Math.max(0, Math.trunc(Number(this.subEventForm.capacityMin) || 0));
    const stageMax = Math.max(stageMin, Math.trunc(Number(this.subEventForm.capacityMax) || stageMin));
    const estimateMin = Math.max(1, Math.ceil(stageMin / Math.max(1, groupMax)));
    const estimateMax = Math.max(estimateMin, Math.ceil(stageMax / Math.max(1, groupMin)));
    return `${estimateMin} - ${estimateMax}`;
  }

  protected openSubEventLocationMap(event?: Event): void {
    event?.stopPropagation();
    const query = `${this.subEventForm.location ?? ''}`.trim();
    if (!query || typeof window === 'undefined') {
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }

  protected canOpenSubEventLocation(item: EventSubeventsItem | null | undefined): boolean {
    return `${item?.location ?? ''}`.trim().length > 0;
  }

  protected openSubEventLocation(item: EventSubeventsItem | null | undefined, event?: Event): void {
    event?.stopPropagation();
    const query = `${item?.location ?? ''}`.trim();
    if (!query || typeof window === 'undefined') {
      return;
    }
    this.openStageMenuKey = null;
    this.openGroupMenuKey = null;
    this.openCasualMenuKey = null;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }

  protected canSaveSubEventForm(): boolean {
    if (this.readOnly) {
      return false;
    }
    return Boolean(
      this.subEventForm.name.trim()
      && this.subEventForm.description.trim()
      && this.subEventForm.startAt
      && this.subEventForm.endAt
    );
  }

  protected saveSubEventForm(event: Event): void {
    event.stopPropagation();
    if (!this.canSaveSubEventForm()) {
      return;
    }
    this.normalizeSubEventCapacityRange();
    const forceMandatoryTournament = this.displayMode === 'Tournament';
    if (forceMandatoryTournament) {
      this.normalizeTournamentStageConfigOnForm();
    }

    const dateRange = this.normalizedInputDateRange(this.subEventForm.startAt, this.subEventForm.endAt);
    const existingId = this.editingSubEventId();
    const existingItem = existingId
      ? this.workingSubEvents.find(item => item.id === existingId) ?? null
      : null;
    const normalizedCapacityMin = Math.max(0, Math.trunc(Number(this.subEventForm.capacityMin) || 0));
    const normalizedCapacityMax = Math.max(
      normalizedCapacityMin,
      Math.trunc(Number(this.subEventForm.capacityMax) || normalizedCapacityMin)
    );

    const baseGroupsSource = (this.subEventForm.groups?.length ?? 0) > 0
      ? this.subEventForm.groups
      : ((existingItem?.groups?.length ?? 0) > 0 ? existingItem?.groups : []);

    let baseItem: EventSubeventsItem = {
      id: existingId ?? this.nextId('subevent'),
      name: this.subEventForm.name.trim(),
      title: this.subEventForm.name.trim(),
      description: this.subEventForm.description.trim(),
      location: this.subEventForm.location.trim(),
      optional: forceMandatoryTournament ? false : this.subEventForm.optional,
      startAt: dateRange.startAt,
      endAt: dateRange.endAt,
      capacityMin: normalizedCapacityMin,
      capacityMax: normalizedCapacityMax,
      tournamentGroupCount: this.normalizedNonNegativeInt(this.subEventForm.tournamentGroupCount) ?? undefined,
      tournamentGroupCapacityMin: forceMandatoryTournament
        ? this.defaultTournamentGroupCapacityMin(this.subEventForm)
        : undefined,
      tournamentGroupCapacityMax: forceMandatoryTournament
        ? this.defaultTournamentGroupCapacityMax(this.defaultTournamentGroupCapacityMin(this.subEventForm), this.subEventForm)
        : undefined,
      tournamentLeaderboardType: forceMandatoryTournament
        ? this.normalizedTournamentLeaderboardType(this.subEventForm.tournamentLeaderboardType)
        : undefined,
      tournamentAdvancePerGroup: forceMandatoryTournament
        ? Math.max(0, Math.trunc(Number(this.subEventForm.tournamentAdvancePerGroup) || 0))
        : undefined,
      groups: forceMandatoryTournament
        ? this.ensureStageGroups(this.subEventFormMode, this.subEventFormSourceIndex, {
          ...this.subEventForm,
          groups: this.cloneGroups(baseGroupsSource)
        })
        : [],
      membersAccepted: existingItem ? this.toPendingCount(existingItem.membersAccepted ?? 0) : Math.min(2, normalizedCapacityMin),
      membersPending: existingItem
        ? this.toPendingCount(existingItem.membersPending ?? 0)
        : Math.max(0, normalizedCapacityMax - Math.min(2, normalizedCapacityMin)),
      carsPending: existingItem ? this.toPendingCount(existingItem.carsPending ?? 0) : 1,
      accommodationPending: existingItem ? this.toPendingCount(existingItem.accommodationPending ?? 0) : 2,
      suppliesPending: existingItem ? this.toPendingCount(existingItem.suppliesPending ?? 0) : 3
    };
    if (forceMandatoryTournament) {
      const reconciledGroups = this.reconcileTournamentGroupsForStage(baseItem, this.cloneGroups(baseItem.groups));
      const totals = this.groupCapacityTotals(reconciledGroups);
      const accepted = Math.min(this.toPendingCount(baseItem.membersAccepted ?? 0), totals.max);
      baseItem = {
        ...baseItem,
        groups: this.cloneGroups(reconciledGroups),
        tournamentGroupCount: reconciledGroups.length,
        capacityMin: totals.min,
        capacityMax: totals.max,
        membersAccepted: accepted,
        membersPending: Math.max(0, totals.max - accepted)
      };
    }

    const sourceWithoutCurrent = this.sortSubEventsByStartAsc(
      existingId
        ? this.workingSubEvents.filter(item => item.id !== existingId)
        : this.workingSubEvents
    );
    const insertIndex = this.subEventInsertIndex(sourceWithoutCurrent);
    const insertedItems = [
      ...sourceWithoutCurrent.slice(0, insertIndex),
      baseItem,
      ...sourceWithoutCurrent.slice(insertIndex)
    ];

    this.workingSubEvents = this.sortSubEventsByStartAsc(this.applyGapShiftAfterInsert(insertedItems, insertIndex));

    this.closeSubEventForm();
    this.emitWorkingSubEvents();
    this.alignPageToCurrentStage();
  }

  protected closeSubEventForm(event?: Event): void {
    event?.stopPropagation();
    this.showSubEventForm = false;
    this.showSubEventOptionalPicker = false;
    this.resetSubEventStageInsertControls();
    this.subEventFormMode = 'create';
    this.subEventFormSourceIndex = null;
    this.subEventForm = this.createEmptySubEventForm();
  }

  protected canSaveGroupForm(): boolean {
    if (this.readOnly) {
      return false;
    }
    return Boolean(this.groupForm.name.trim());
  }

  protected onGroupCapacityMinChange(value: number | string): void {
    const parsed = Number(value);
    const nextMin = Math.max(0, Number.isFinite(parsed) ? Math.trunc(parsed) : this.groupForm.capacityMin);
    this.groupForm.capacityMin = nextMin;
    if (this.groupForm.capacityMax < nextMin) {
      this.groupForm.capacityMax = nextMin;
    }
  }

  protected onGroupCapacityMaxChange(value: number | string): void {
    if (value === '' || value === null || value === undefined) {
      return;
    }
    const parsed = Number(value);
    this.groupForm.capacityMax = Math.max(
      this.groupForm.capacityMin,
      Number.isFinite(parsed) ? Math.trunc(parsed) : this.groupForm.capacityMax
    );
  }

  protected saveGroupForm(event: Event): void {
    event.stopPropagation();
    if (!this.canSaveGroupForm() || this.groupFormSourceIndex === null) {
      return;
    }

    const stageItem = this.workingSubEvents[this.groupFormSourceIndex];
    if (!stageItem) {
      return;
    }

    const groups = this.cloneGroups(stageItem.groups);

    if (this.groupFormGroupId) {
      const targetIndex = groups.findIndex(group => group.id === this.groupFormGroupId);
      if (targetIndex >= 0) {
        const current = groups[targetIndex];
        groups[targetIndex] = {
          ...current,
          name: this.groupForm.name.trim(),
          capacityMin: Math.max(0, Number(this.groupForm.capacityMin) || 0),
          capacityMax: Math.max(
            Math.max(0, Number(this.groupForm.capacityMin) || 0),
            Number(this.groupForm.capacityMax) || Math.max(0, Number(this.groupForm.capacityMin) || 0)
          ),
          membersPending: this.toPendingCount(current?.membersPending ?? this.groupForm.membersPending),
          source: 'manual'
        };
      }
    } else {
      groups.push({
        id: this.nextId('group'),
        name: this.groupForm.name.trim(),
        source: 'manual',
        capacityMin: Math.max(0, Number(this.groupForm.capacityMin) || 0),
        capacityMax: Math.max(
          Math.max(0, Number(this.groupForm.capacityMin) || 0),
          Number(this.groupForm.capacityMax) || Math.max(0, Number(this.groupForm.capacityMin) || 0)
        ),
        membersPending: this.toPendingCount(this.groupForm.membersPending)
      });
    }

    this.workingSubEvents[this.groupFormSourceIndex] = {
      ...stageItem,
      ...this.stageWithReconciledGroups(stageItem, groups)
    };

    this.closeGroupForm();
    this.emitWorkingSubEvents();
  }

  protected closeGroupForm(event?: Event): void {
    event?.stopPropagation();
    this.showGroupForm = false;
    this.groupFormSourceIndex = null;
    this.groupFormGroupId = null;
    this.groupFormStageTitle = '';
    this.groupForm = this.createEmptyGroupForm();
  }

  protected closeLeaderboardPopup(event?: Event): void {
    event?.stopPropagation();
    this.showLeaderboardPopup = false;
    this.leaderboardPopupStageKey = null;
    this.leaderboardPopupStageTitle = '';
    this.leaderboardPopupGroups = [];
    this.leaderboardPopupMode = 'Score';
  }

  protected requestDeleteStage(stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.pendingDeleteTarget = {
      kind: 'stage',
      stageSourceIndex: stage.sourceIndex,
      groupId: null,
      label: stage.subtitle
    };
  }

  protected requestDeleteGroup(row: EventSubeventsStageRow, event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.pendingDeleteTarget = {
      kind: 'group',
      stageSourceIndex: row.stageSourceIndex,
      groupId: row.groupId,
      label: row.groupName
    };
  }

  protected cancelDeleteTarget(event?: Event): void {
    event?.stopPropagation();
    this.pendingDeleteTarget = null;
  }

  protected confirmDeleteTarget(event: Event): void {
    event.stopPropagation();
    const target = this.pendingDeleteTarget;
    if (!target) {
      return;
    }

    if (target.kind === 'stage' || target.kind === 'subevent') {
      this.workingSubEvents = this.workingSubEvents.filter((_, index) => index !== target.stageSourceIndex);
      this.pendingDeleteTarget = null;
      this.emitWorkingSubEvents();
      this.alignPageToCurrentStage();
      return;
    }

    const stage = this.workingSubEvents[target.stageSourceIndex];
    if (!stage) {
      this.pendingDeleteTarget = null;
      return;
    }

    if (!target.groupId) {
      this.pendingDeleteTarget = null;
      return;
    }

    const groups = this.cloneGroups(stage.groups).filter(group => group.id !== target.groupId);
    this.workingSubEvents[target.stageSourceIndex] = {
      ...stage,
      ...this.stageWithReconciledGroups(stage, groups)
    };
    this.pendingDeleteTarget = null;
    this.emitWorkingSubEvents();
  }

  protected deleteTargetTitle(): string {
    const target = this.pendingDeleteTarget;
    if (!target) {
      return 'Delete';
    }
    if (target.kind === 'group') {
      return 'Delete Group';
    }
    return target.kind === 'stage' ? 'Delete Stage' : 'Delete Sub Event';
  }

  protected deleteTargetDescription(): string {
    const target = this.pendingDeleteTarget;
    if (!target) {
      return '';
    }
    if (target.kind === 'stage') {
      return `Delete ${target.label}?`;
    }
    if (target.kind === 'subevent') {
      return `Delete ${target.label}?`;
    }
    return `Delete ${target.label}?`;
  }

  protected trackByStageKey(_: number, stage: EventSubeventsStageCard): string {
    return stage.key;
  }

  protected subEventFormTitle(): string {
    if (this.displayMode === 'Tournament') {
      let stageNumber = this.subEventFormMode === 'edit'
        ? this.resolveStageNumberById(this.editingSubEventId())
        : this.subEventInsertStageNumberPreview();
      if (stageNumber === null) {
        stageNumber = this.workingSubEvents.length + 1;
      }
      return this.subEventFormMode === 'edit'
        ? `Edit Stage ${stageNumber} Event`
        : `Create Stage ${stageNumber} Event`;
    }
    return this.subEventFormMode === 'edit' ? 'Edit Sub Event' : 'Create Sub Event';
  }

  protected groupFormTitle(): string {
    return this.groupFormGroupId ? 'Edit Group' : 'Create Group';
  }

  protected leaderboardPopupTitle(): string {
    if (!this.leaderboardPopupStageTitle.trim()) {
      return 'Leaderboard';
    }
    return `${this.leaderboardPopupStageTitle} Leaderboard`;
  }

  private buildLeaderboardGroups(stage: EventSubeventsStageCard | null): EventSubeventLeaderboardGroup[] {
    if (!stage) {
      return [];
    }

    const source = this.workingSubEvents[stage.sourceIndex];
    const advancePerGroup = Math.max(0, Math.trunc(Number(source?.tournamentAdvancePerGroup) || 0));
    const sourceGroups = this.cloneGroups(source?.groups);
    const fallbackStageCapacity = Math.max(
      0,
      Math.trunc(Number(source?.tournamentGroupCapacityMax ?? source?.capacityMax) || 0)
    );

    return stage.rows.map(row => ({
      key: row.key,
      title: row.groupName,
      pending: this.toPendingCount(row.pending),
      advancePerGroup,
      memberCount: this.resolveLeaderboardGroupMemberCount(row, sourceGroups, fallbackStageCapacity)
    }));
  }

  private resolveLeaderboardMode(stage: EventSubeventsStageCard | null): TournamentLeaderboardType {
    if (!stage) {
      return 'Score';
    }
    const source = this.workingSubEvents[stage.sourceIndex];
    return this.normalizedTournamentLeaderboardType(source?.tournamentLeaderboardType);
  }

  private syncLeaderboardPopupState(): void {
    const stage = this.leaderboardStageCard();
    this.leaderboardPopupGroups = this.buildLeaderboardGroups(stage);
    this.leaderboardPopupMode = this.resolveLeaderboardMode(stage);
  }

  protected trackByStageRowKey(_: number, row: EventSubeventsStageRow): string {
    return row.key;
  }

  protected trackByStagePageIndex(index: number): number {
    return this.stagePageStartIndexesCache[index] ?? index;
  }

  protected trackByIndex(index: number): number {
    return index;
  }

  protected subEventFieldInvalid(field: 'name' | 'description'): boolean {
    return !this.subEventForm[field].trim();
  }

  protected groupFieldInvalid(): boolean {
    return !this.groupForm.name.trim();
  }

  protected leaderboardStageCard(): EventSubeventsStageCard | null {
    const key = this.leaderboardPopupStageKey;
    if (!key) {
      return null;
    }
    return this.stageCardByKey.get(key) ?? null;
  }

  protected stageGridTemplateColumns(page: readonly EventSubeventsStageCard[]): string {
    const columnCount = this.isMobileViewport ? 1 : Math.max(1, page.length);
    return `repeat(${columnCount}, minmax(0, 1fr))`;
  }

  private rebuildRenderModel(): void {
    this.sortedEntries = this.buildSortedEntries(this.workingSubEvents);
    this.sortedSubEvents = this.sortedEntries.map(entry => entry.item);
    this.stageCards = this.buildStageCards(this.sortedEntries);
    this.stageCardByKey = new Map<string, EventSubeventsStageCard>(
      this.stageCards.map<[string, EventSubeventsStageCard]>(stage => [stage.key, stage])
    );
    this.stagePageStartIndexesCache = this.buildStagePageStartIndexes(this.stageCards);
    const visibleStageCount = this.columnsPerPage();
    this.stagePages = this.stagePageStartIndexesCache.map(startIndex => this.stageCards.slice(startIndex, startIndex + visibleStageCount));
    this.clampStagePageIndex();
    if (this.showLeaderboardPopup) {
      this.syncLeaderboardPopupState();
    }
  }

  private buildSortedEntries(source: readonly EventSubeventsItem[]): EventSubeventsSortedEntry[] {
    return source
      .map((item, sourceIndex) => ({
        item,
        sourceIndex,
        startMs: this.parseDateValue(item.startAt)?.getTime() ?? Number.POSITIVE_INFINITY,
        stageId: `${item.id ?? item.name ?? item.title ?? `subevent-${sourceIndex + 1}`}`
      }))
      .sort((a, b) => {
        if (a.startMs !== b.startMs) {
          return a.startMs - b.startMs;
        }
        return a.sourceIndex - b.sourceIndex;
      })
      .map(entry => ({
        ...entry,
        item: this.prepareRenderItem(entry.item)
      }));
  }

  private buildStageCards(entries: readonly EventSubeventsSortedEntry[]): EventSubeventsStageCard[] {
    const totalStages = Math.max(entries.length, 1);
    return entries.map((entry, index) => {
      const item = entry.item;
      const stageNumber = index + 1;
      const title = `${item.name ?? item.title ?? `Stage ${stageNumber}`}`.trim() || `Stage ${stageNumber}`;
      const description = `${item.description ?? ''}`.trim();
      const location = `${item.location ?? ''}`.trim();
      const rows = this.stageRowsForItem(item, entry.sourceIndex, entry.stageId);
      const startMs = this.parseDateValue(item.startAt)?.getTime() ?? Number.NaN;
      const endMs = this.parseDateValue(item.endAt)?.getTime() ?? Number.NaN;

      return {
        key: `${entry.stageId}-${entry.sourceIndex}`,
        menuKey: entry.stageId,
        sourceIndex: entry.sourceIndex,
        stageNumber,
        title: `Stage ${stageNumber}`,
        subtitle: title,
        description,
        location: location || 'Location pending',
        rangeLabel: this.subEventRangeLabel(item),
        groupsLabel: rows.length === 1 ? '1 group' : `${rows.length} groups`,
        accentHue: this.stageAccentHue(stageNumber, totalStages),
        startMs,
        endMs,
        rows
      };
    });
  }

  private buildStagePageStartIndexes(cards: readonly EventSubeventsStageCard[]): number[] {
    if (cards.length === 0) {
      return [];
    }

    if (!this.isMobileViewport) {
      return this.desktopStagePageStarts(cards.length);
    }

    const viewportColumns = this.columnsPerPage();
    const maxStartIndex = Math.max(0, cards.length - viewportColumns);
    const starts: number[] = [];

    for (let startIndex = 0; startIndex <= maxStartIndex; startIndex += viewportColumns) {
      starts.push(startIndex);
    }

    if (starts.length === 0 || starts[starts.length - 1] !== maxStartIndex) {
      starts.push(maxStartIndex);
    }

    return Array.from(new Set(starts));
  }

  private syncVisibleStageCards(): void {
    this.visibleStageCards = this.stagePages[this.stagePageIndex] ?? [];
  }

  private stageRowsForItem(item: EventSubeventsItem, stageSourceIndex: number, stageId: string): EventSubeventsStageRow[] {
    const groups = this.cloneGroups(item.groups);
    const toneByIndex: Array<'amber' | 'green' | 'mint' | 'teal'> = ['amber', 'green', 'mint', 'teal'];
    const explicitGroupCount = this.normalizedNonNegativeInt(item.tournamentGroupCount);
    const stageCapacityMax = Math.max(0, Math.trunc(Number(item.capacityMax) || 0));
    const groupCapacityMin = Math.max(1, Math.trunc(Number(item.tournamentGroupCapacityMin) || 0) || 1);
    const inferredGroupCount = stageCapacityMax > 0
      ? Math.max(1, Math.ceil(stageCapacityMax / groupCapacityMin))
      : 0;
    const targetGroupCount = Math.max(groups.length, explicitGroupCount ?? inferredGroupCount, 1);
    const rows: EventSubeventsStageRow[] = [];

    for (let index = 0; index < targetGroupCount; index += 1) {
      const group = groups[index] ?? null;
      const letter = String.fromCharCode(65 + (index % 26));
      const groupName = `${group?.name ?? `Group ${letter}`}`.trim() || `Group ${letter}`;
      const source = group ? this.normalizeGroupSource(group.source) : 'generated';
      rows.push({
        key: `${stageId}-${group?.id ?? `generated-${index}`}`,
        label: `${groupName.toUpperCase()} · ${source.toUpperCase()}`,
        pending: this.toPendingCount(group?.membersPending ?? item.membersPending ?? 6),
        groupId: group?.id ?? null,
        groupName,
        tone: toneByIndex[index % toneByIndex.length],
        source,
        stageSourceIndex
      });
    }

    return rows;
  }

  private resolveLeaderboardGroupMemberCount(
    row: EventSubeventsStageRow,
    sourceGroups: EventSubeventsGroupItem[],
    fallbackStageCapacity: number
  ): number {
    const sourceGroup = row.groupId ? sourceGroups.find(group => group.id === row.groupId) : null;
    const explicit = Number(sourceGroup?.capacityMax);
    if (Number.isFinite(explicit) && explicit > 0) {
      return Math.max(2, Math.trunc(explicit));
    }
    if (fallbackStageCapacity > 0) {
      return Math.max(2, fallbackStageCapacity);
    }
    const pending = this.toPendingCount(row.pending);
    return Math.max(2, pending);
  }

  private openEditSubEventFormAtIndex(sourceIndex: number): void {
    if (this.readOnly) {
      return;
    }
    this.openStageMenuKey = null;
    this.openGroupMenuKey = null;
    this.openCasualMenuKey = null;
    this.showLeaderboardPopup = false;
    this.leaderboardPopupStageKey = null;
    this.leaderboardPopupStageTitle = '';
    this.leaderboardPopupGroups = [];
    this.leaderboardPopupMode = 'Score';
    this.showGroupForm = false;
    this.showSubEventOptionalPicker = false;
    const sourceItem = this.workingSubEvents[sourceIndex];
    if (!sourceItem) {
      return;
    }

    this.subEventFormMode = 'edit';
    this.subEventFormSourceIndex = sourceIndex;
    const fallbackName = this.displayMode === 'Tournament'
      ? `Stage ${sourceIndex + 1}`
      : `Sub Event ${sourceIndex + 1}`;
    this.subEventForm = {
      id: sourceItem.id,
      name: `${sourceItem.name ?? sourceItem.title ?? fallbackName}`.trim(),
      description: `${sourceItem.description ?? ''}`.trim(),
      location: `${sourceItem.location ?? ''}`.trim(),
      startAt: this.toInputDateTime(this.parseDateValue(sourceItem.startAt) ?? new Date()),
      endAt: this.toInputDateTime(this.parseDateValue(sourceItem.endAt) ?? new Date(Date.now() + (2 * 60 * 60 * 1000))),
      optional: sourceItem.optional ?? (this.displayMode !== 'Tournament'),
      capacityMin: Math.max(0, Number(sourceItem.capacityMin) || 0),
      capacityMax: Math.max(
        Math.max(0, Number(sourceItem.capacityMin) || 0),
        Number(sourceItem.capacityMax) || Math.max(0, Number(sourceItem.capacityMin) || 0)
      ),
      tournamentGroupCount: this.normalizedNonNegativeInt(sourceItem.tournamentGroupCount) ?? undefined,
      tournamentGroupCapacityMin: Number.isFinite(Number(sourceItem.tournamentGroupCapacityMin))
        ? Math.max(0, Math.trunc(Number(sourceItem.tournamentGroupCapacityMin)))
        : this.defaultTournamentGroupCapacityMin(),
      tournamentGroupCapacityMax: Number.isFinite(Number(sourceItem.tournamentGroupCapacityMax))
        ? Math.max(0, Math.trunc(Number(sourceItem.tournamentGroupCapacityMax)))
        : this.defaultTournamentGroupCapacityMax(this.defaultTournamentGroupCapacityMin()),
      tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(sourceItem.tournamentLeaderboardType),
      tournamentAdvancePerGroup: Math.max(0, Math.trunc(Number(sourceItem.tournamentAdvancePerGroup) || 0)),
      groups: this.cloneGroups(sourceItem.groups)
    };
    this.resetSubEventStageInsertControls(sourceItem.id ?? null);
    this.showSubEventForm = true;
  }

  private openEditStageForm(stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    this.openEditSubEventFormAtIndex(stage.sourceIndex);
  }

  private openCreateGroupForm(stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.showLeaderboardPopup = false;
    this.leaderboardPopupStageKey = null;
    this.leaderboardPopupStageTitle = '';
    this.leaderboardPopupGroups = [];
    this.leaderboardPopupMode = 'Score';
    this.showSubEventForm = false;
    this.groupFormSourceIndex = stage.sourceIndex;
    const sourceItem = this.workingSubEvents[stage.sourceIndex];
    const stageGroups = this.cloneGroups(sourceItem?.groups);
    const nextIndex = stageGroups.length;
    const letter = String.fromCharCode(65 + (nextIndex % 26));
    const reference = stageGroups[stageGroups.length - 1];
    const fallbackMin = Math.max(0, Number(sourceItem?.tournamentGroupCapacityMin) || 4);
    const fallbackMax = Math.max(fallbackMin, Number(sourceItem?.tournamentGroupCapacityMax) || 7);
    const capacityMin = Math.max(0, Number(reference?.capacityMin) || fallbackMin);
    const capacityMax = Math.max(capacityMin, Number(reference?.capacityMax) || fallbackMax);
    this.groupFormGroupId = null;
    this.groupFormStageTitle = stage.subtitle;
    this.groupForm = {
      name: `Group ${letter}`,
      capacityMin,
      capacityMax,
      membersPending: 6
    };
    this.showGroupForm = true;
  }

  private openEditGroupForm(row: EventSubeventsStageRow, event: Event): void {
    event.stopPropagation();
    if (this.readOnly) {
      return;
    }
    this.showLeaderboardPopup = false;
    this.leaderboardPopupStageKey = null;
    this.leaderboardPopupStageTitle = '';
    this.leaderboardPopupGroups = [];
    this.leaderboardPopupMode = 'Score';
    this.showSubEventForm = false;
    this.groupFormSourceIndex = row.stageSourceIndex;
    this.groupFormGroupId = row.groupId;
    this.groupFormStageTitle = this.workingSubEvents[row.stageSourceIndex]?.name ?? '';
    const sourceItem = this.workingSubEvents[row.stageSourceIndex];
    const group = this.cloneGroups(this.workingSubEvents[row.stageSourceIndex]?.groups)
      .find(entry => entry.id === row.groupId);
    const fallbackMin = Math.max(0, Number(sourceItem?.tournamentGroupCapacityMin) || 4);
    const fallbackMax = Math.max(fallbackMin, Number(sourceItem?.tournamentGroupCapacityMax) || 7);
    const capacityMin = Math.max(0, Number(group?.capacityMin) || fallbackMin);
    const capacityMax = Math.max(capacityMin, Number(group?.capacityMax) || fallbackMax);
    this.groupForm = {
      name: row.groupName,
      capacityMin,
      capacityMax,
      membersPending: this.toPendingCount(row.pending)
    };
    this.showGroupForm = true;
  }

  private openLeaderboardPopup(stage: EventSubeventsStageCard, event: Event): void {
    event.stopPropagation();
    this.showSubEventForm = false;
    this.showSubEventOptionalPicker = false;
    this.showGroupForm = false;
    this.groupFormSourceIndex = null;
    this.groupFormGroupId = null;
    this.groupFormStageTitle = '';
    this.groupForm = this.createEmptyGroupForm();
    this.leaderboardPopupStageKey = stage.key;
    this.leaderboardPopupStageTitle = stage.subtitle;
    this.syncLeaderboardPopupState();
    this.showLeaderboardPopup = true;
  }

  private ensureStageGroups(
    mode: 'create' | 'edit',
    sourceIndex: number | null,
    draft: SubEventFormModel
  ): EventSubeventsGroupItem[] {
    if (this.displayMode !== 'Tournament') {
      return [];
    }

    if (mode === 'edit' && sourceIndex !== null) {
      const existing = this.cloneGroups(this.workingSubEvents[sourceIndex]?.groups);
      if (existing.length > 0) {
        return existing;
      }
    }

    if ((draft.groups?.length ?? 0) > 0) {
      return this.cloneGroups(draft.groups);
    }

    return [{
      id: this.nextId('group'),
      name: 'Group A',
      source: 'generated',
      capacityMin: this.defaultTournamentGroupCapacityMin(draft),
      capacityMax: this.defaultTournamentGroupCapacityMax(this.defaultTournamentGroupCapacityMin(draft), draft),
      membersPending: 6
    }];
  }

  private normalizedInputDateRange(startInput: string, endInput: string): { startAt: string; endAt: string } {
    const startDate = this.parseInputDate(startInput) ?? new Date();
    const endDate = this.parseInputDate(endInput) ?? new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

    const safeEnd = endDate.getTime() <= startDate.getTime()
      ? new Date(startDate.getTime() + (60 * 60 * 1000))
      : endDate;

    return {
      startAt: AppUtils.toIsoDateTimeLocal(startDate),
      endAt: AppUtils.toIsoDateTimeLocal(safeEnd)
    };
  }

  private parseDateValue(value: unknown): Date | null {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw.replace(/\//g, '-'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private subEventRangeLabel(item: EventSubeventsItem): string {
    const start = this.parseDateValue(item.startAt);
    const end = this.parseDateValue(item.endAt);
    if (!start || !end) {
      return 'Date pending';
    }
    return `${this.monthDayTime(start)} - ${this.monthDayTime(end)}`;
  }

  private monthDayTime(value: Date): string {
    return `${AppUtils.pad2(value.getMonth() + 1)}/${AppUtils.pad2(value.getDate())} ${AppUtils.pad2(value.getHours())}:${AppUtils.pad2(value.getMinutes())}`;
  }

  private shortMonthDay(valueMs: number): string {
    const value = new Date(valueMs);
    const month = value.toLocaleString('en-US', { month: 'short' });
    return `${month} ${value.getDate()}`;
  }

  private toPendingCount(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.trunc(parsed);
  }

  private normalizeGroupSource(value: unknown): 'manual' | 'generated' {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized === 'manual' ? 'manual' : 'generated';
  }

  private sourceIndexForItem(item: EventSubeventsItem, fallbackIndex = -1): number {
    if (item.id) {
      const byId = this.workingSubEvents.findIndex(entry => entry.id === item.id);
      if (byId >= 0) {
        return byId;
      }
    }
    if (fallbackIndex >= 0 && fallbackIndex < this.sortedEntries.length) {
      const entry = this.sortedEntries[fallbackIndex];
      if (entry) {
        return entry.sourceIndex;
      }
    }
    return -1;
  }

  private resourceCapacityRange(item: EventSubeventsItem, row?: EventSubeventsStageRow | null): { min: number; max: number } {
    if (row) {
      const stage = this.workingSubEvents[row.stageSourceIndex];
      const sourceGroup = this.cloneGroups(stage?.groups).find(group => group.id === row.groupId);
      const min = Math.max(0, Number(sourceGroup?.capacityMin ?? stage?.capacityMin) || 0);
      const max = Math.max(min, Number(sourceGroup?.capacityMax ?? stage?.capacityMax) || min);
      return { min, max };
    }

    const min = Math.max(0, Number(item.capacityMin) || 0);
    const max = Math.max(min, Number(item.capacityMax) || min);
    return { min, max };
  }

  private resourceJoinedCount(item: EventSubeventsItem, type: Exclude<EventEditorSubEventResourceType, 'Members'>): number {
    return this.preparedAssetMetricsForItem(item, type).accepted;
  }

  private resourceAssetCapacityRange(
    item: EventSubeventsItem,
    type: Exclude<EventEditorSubEventResourceType, 'Members'>,
    _row?: EventSubeventsStageRow | null
  ): { min: number; max: number } {
    const metrics = this.preparedAssetMetricsForItem(item, type);
    return {
      min: metrics.capacityMin,
      max: metrics.capacityMax
    };
  }

  private preparedAssetMetricsForItem(
    item: EventSubeventsItem,
    type: Exclude<EventEditorSubEventResourceType, 'Members'>,
    fallbackSubEvent: AppTypes.SubEventFormItem | null = this.toSubEventResourceItem(item)
  ): EventSubeventsAssetMetrics {
    const prepared = (item as EventSubeventsPreparedItem).resourceMetrics?.[type];
    if (prepared) {
      return prepared;
    }
    return this.buildAssetMetricsForType(item, fallbackSubEvent, type);
  }

  private prepareRenderItem(item: EventSubeventsItem): EventSubeventsPreparedItem {
    const subEvent = this.toSubEventResourceItem(item);
    const resourceMetrics: EventSubeventsAssetMetricsByType = {
      Car: this.buildAssetMetricsForType(item, subEvent, 'Car'),
      Accommodation: this.buildAssetMetricsForType(item, subEvent, 'Accommodation'),
      Supplies: this.buildAssetMetricsForType(item, subEvent, 'Supplies')
    };
    return {
      ...item,
      resourceMetrics,
      casualMenuPendingCount: this.buildCasualMenuPendingCount(item, resourceMetrics)
    };
  }

  private buildCasualMenuPendingCount(
    item: EventSubeventsItem,
    resourceMetrics: EventSubeventsAssetMetricsByType = {
      Car: this.preparedAssetMetricsForItem(item, 'Car'),
      Accommodation: this.preparedAssetMetricsForItem(item, 'Accommodation'),
      Supplies: this.preparedAssetMetricsForItem(item, 'Supplies')
    }
  ): number {
    const members = item.optional ? this.toPendingCount(item.membersPending) : 0;
    return members
      + resourceMetrics.Car.pending
      + resourceMetrics.Accommodation.pending
      + resourceMetrics.Supplies.pending;
  }

  private buildAssetMetricsForType(
    item: EventSubeventsItem,
    subEvent: AppTypes.SubEventFormItem | null,
    type: Exclude<EventEditorSubEventResourceType, 'Members'>
  ): EventSubeventsAssetMetrics {
    if (!subEvent) {
      return this.fallbackAssetMetrics(item, type);
    }
    const state = this.activityResourcesService.peekSubEventResourceState(this.ownerId ?? '', subEvent.id, this.activeUserId());
    const accepted = ActivityResourceBuilder.resourceAcceptedCount(subEvent, type, state, this.ownedAssets.assetCards);
    const pending = ActivityResourceBuilder.resourcePendingCount(subEvent, type, state, this.ownedAssets.assetCards);
    const bounds = ActivityResourceBuilder.resourceCapacityBounds(
      subEvent,
      type,
      state,
      this.ownedAssets.assetCards,
      accepted,
      pending
    );
    return {
      accepted,
      pending,
      capacityMin: bounds.capacityMin,
      capacityMax: bounds.capacityMax
    };
  }

  private fallbackAssetMetrics(
    item: EventSubeventsItem,
    type: Exclude<EventEditorSubEventResourceType, 'Members'>
  ): EventSubeventsAssetMetrics {
    const fallback = this.resourceCapacityRange(item);
    if (type === 'Car') {
      const bounds = this.normalizeAssetCapacityRange(item.carsCapacityMin, item.carsCapacityMax, fallback);
      return {
        accepted: this.toPendingCount(item.carsAccepted),
        pending: this.toPendingCount(item.carsPending),
        capacityMin: bounds.min,
        capacityMax: bounds.max
      };
    }
    if (type === 'Accommodation') {
      const bounds = this.normalizeAssetCapacityRange(item.accommodationCapacityMin, item.accommodationCapacityMax, fallback);
      return {
        accepted: this.toPendingCount(item.accommodationAccepted),
        pending: this.toPendingCount(item.accommodationPending),
        capacityMin: bounds.min,
        capacityMax: bounds.max
      };
    }
    const bounds = this.normalizeAssetCapacityRange(item.suppliesCapacityMin, item.suppliesCapacityMax, fallback);
    return {
      accepted: this.toPendingCount(item.suppliesAccepted),
      pending: this.toPendingCount(item.suppliesPending),
      capacityMin: bounds.min,
      capacityMax: bounds.max
    };
  }

  private toSubEventResourceItem(item: EventSubeventsItem): AppTypes.SubEventFormItem | null {
    const subEventId = `${item.id ?? ''}`.trim();
    if (!subEventId) {
      return null;
    }
    return {
      id: subEventId,
      name: item.name ?? item.title ?? '',
      description: item.description ?? '',
      startAt: item.startAt ?? '',
      endAt: item.endAt ?? '',
      location: item.location ?? '',
      groups: this.cloneGroups(item.groups).map(group => ({
        id: group.id ?? '',
        name: group.name ?? '',
        capacityMin: this.toPendingCount(group.capacityMin),
        capacityMax: this.toPendingCount(group.capacityMax),
        source: group.source === 'generated' ? 'generated' : 'manual'
      })),
      optional: item.optional === true,
      capacityMin: this.toPendingCount(item.capacityMin),
      capacityMax: Math.max(this.toPendingCount(item.capacityMin), this.toPendingCount(item.capacityMax)),
      membersAccepted: this.toPendingCount(item.membersAccepted),
      membersPending: this.toPendingCount(item.membersPending),
      carsPending: this.toPendingCount(item.carsPending),
      accommodationPending: this.toPendingCount(item.accommodationPending),
      suppliesPending: this.toPendingCount(item.suppliesPending),
      carsAccepted: this.toPendingCount(item.carsAccepted),
      accommodationAccepted: this.toPendingCount(item.accommodationAccepted),
      suppliesAccepted: this.toPendingCount(item.suppliesAccepted),
      carsCapacityMin: this.toPendingCount(item.carsCapacityMin),
      carsCapacityMax: this.toPendingCount(item.carsCapacityMax),
      accommodationCapacityMin: this.toPendingCount(item.accommodationCapacityMin),
      accommodationCapacityMax: this.toPendingCount(item.accommodationCapacityMax),
      suppliesCapacityMin: this.toPendingCount(item.suppliesCapacityMin),
      suppliesCapacityMax: this.toPendingCount(item.suppliesCapacityMax)
    };
  }

  private normalizeAssetCapacityRange(
    minValue: unknown,
    maxValue: unknown,
    fallback: { min: number; max: number }
  ): { min: number; max: number } {
    const minCandidate = Number(minValue);
    const resolvedMin = Number.isFinite(minCandidate) && minCandidate >= 0
      ? Math.trunc(minCandidate)
      : fallback.min;
    const maxCandidate = Number(maxValue);
    const fallbackMax = Math.max(resolvedMin, fallback.max);
    const resolvedMax = Number.isFinite(maxCandidate) && maxCandidate >= resolvedMin
      ? Math.trunc(maxCandidate)
      : fallbackMax;
    return { min: resolvedMin, max: resolvedMax };
  }

  private reconcileTournamentGroupsForStage(
    item: EventSubeventsItem,
    sourceGroups: EventSubeventsGroupItem[] = this.cloneGroups(item.groups)
  ): EventSubeventsGroupItem[] {
    const normalizedGroups = sourceGroups.map(group => ({
      ...group,
      source: this.normalizeGroupSource(group.source)
    }));
    if (item.optional) {
      return normalizedGroups;
    }
    const manualGroups = normalizedGroups
      .filter(group => this.normalizeGroupSource(group.source) === 'manual')
      .map(group => ({ ...group, source: 'manual' as const }));
    const generatedGroups = normalizedGroups
      .filter(group => this.normalizeGroupSource(group.source) === 'generated')
      .map(group => ({ ...group, source: 'generated' as const }));
    return [...manualGroups, ...generatedGroups];
  }

  private groupCapacityTotals(groups: EventSubeventsGroupItem[]): { min: number; max: number } {
    if (groups.length === 0) {
      return { min: 0, max: 0 };
    }
    let totalMin = 0;
    let totalMax = 0;
    for (const group of groups) {
      const min = Math.max(0, Number(group.capacityMin) || 0);
      const max = Math.max(min, Number(group.capacityMax) || min);
      totalMin += min;
      totalMax += max;
    }
    return {
      min: Math.max(0, totalMin),
      max: Math.max(Math.max(0, totalMin), totalMax)
    };
  }

  private stageWithReconciledGroups(stage: EventSubeventsItem, groups: EventSubeventsGroupItem[]): Partial<EventSubeventsItem> {
    const reconciledGroups = this.reconcileTournamentGroupsForStage(stage, groups);
    if (stage.optional) {
      return {
        groups: this.cloneGroups(reconciledGroups)
      };
    }
    const totals = this.groupCapacityTotals(reconciledGroups);
    return {
      groups: this.cloneGroups(reconciledGroups),
      tournamentGroupCount: reconciledGroups.length,
      capacityMin: totals.min,
      capacityMax: totals.max
    };
  }

  private stageAccentHue(stageNumber: number, totalStages: number): number {
    if (totalStages <= 1) {
      return 210;
    }
    const ratio = AppUtils.clampNumber((stageNumber - 1) / (totalStages - 1), 0, 1);
    return Math.round(210 - (210 * ratio));
  }

  private stageAccentColorByNumber(stageNumber: number): string {
    const total = Math.max(this.stageCards.length, 1);
    return `hsl(${this.stageAccentHue(stageNumber, total)} 76% 54%)`;
  }

  private resolveStageNumberById(stageId: string | null | undefined): number | null {
    if (!stageId) {
      return null;
    }
    const source = this.sortSubEventRefsByStartAsc(this.workingSubEvents);
    const index = source.findIndex(item => item.id === stageId);
    return index >= 0 ? index + 1 : null;
  }

  private readViewportWidth(): number {
    if (typeof window === 'undefined') {
      return 1280;
    }
    return window.innerWidth || 1280;
  }

  private columnsPerPage(): number {
    return this.isMobileViewport ? 1 : 3;
  }

  private clampStagePageIndex(): void {
    const maxIndex = Math.max(0, this.stagePages.length - 1);
    this.stagePageIndex = AppUtils.clampNumber(this.stagePageIndex, 0, maxIndex);
    this.syncVisibleStageCards();
  }

  private scrollStagePagesBy(direction: -1 | 1): void {
    if (!this.canScrollStagePages(direction)) {
      return;
    }
    this.stagePageIndex = AppUtils.clampNumber(
      this.stagePageIndex + direction,
      0,
      Math.max(0, this.stagePages.length - 1)
    );
    this.syncVisibleStageCards();
  }

  protected stageGridTransform(): string {
    if (this.stageCards.length === 0 || this.displayMode !== 'Tournament') {
      return '';
    }
    const startIndex = this.stagePageStartIndexesCache[this.stagePageIndex] ?? 0;
    const columns = this.columnsPerPage();
    // Move by (100% / columns + gap / columns) * startIndex
    // But easier to do in CSS with variables
    return '';
  }

  protected get stageGridStartIndex(): number {
    return this.stagePageStartIndexesCache[this.stagePageIndex] ?? 0;
  }

  protected get stageGridColumns(): number {
    return this.columnsPerPage();
  }

  private alignPageToCurrentStage(): void {
    if (this.displayMode !== 'Tournament') {
      this.stagePageIndex = 0;
      this.syncVisibleStageCards();
      return;
    }

    const entries = this.sortedEntries;
    if (entries.length === 0) {
      this.stagePageIndex = 0;
      this.syncVisibleStageCards();
      return;
    }

    const now = Date.now();
    let currentIndex = entries.length - 1;

    for (let index = 0; index < entries.length; index += 1) {
      const start = this.parseDateValue(entries[index].item.startAt)?.getTime();
      const end = this.parseDateValue(entries[index].item.endAt)?.getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      if ((start as number) <= now && now <= (end as number)) {
        currentIndex = index;
        break;
      }
      if ((start as number) > now) {
        currentIndex = index;
        break;
      }
    }

    const pageStarts = this.stagePageStartIndexes();
    let nextPageIndex = 0;
    for (let index = 0; index < pageStarts.length; index += 1) {
      const startIndex = pageStarts[index];
      const endIndex = startIndex + this.columnsPerPage() - 1;
      if (startIndex <= currentIndex && currentIndex <= endIndex) {
        nextPageIndex = index;
        break;
      }
      if (currentIndex < startIndex) {
        nextPageIndex = Math.max(0, index - 1);
        break;
      }
      nextPageIndex = index;
    }

    this.stagePageIndex = AppUtils.clampNumber(nextPageIndex, 0, Math.max(0, pageStarts.length - 1));
    this.syncVisibleStageCards();
  }


  private desktopStagePageStarts(totalStages: number): number[] {
    const visibleColumns = 3;
    if (totalStages <= 0) {
      return [0];
    }
    if (totalStages <= visibleColumns) {
      return [0];
    }
    const starts: number[] = [0];
    const lastStart = totalStages - visibleColumns;
    for (let start = visibleColumns; start < lastStart; start += visibleColumns) {
      starts.push(start);
    }
    if (starts[starts.length - 1] !== lastStart) {
      starts.push(lastStart);
    }
    return starts;
  }

  private visibleStageBounds(): { start: number; end: number } | null {
    const total = this.stageCards.length;
    if (total === 0) {
      return null;
    }
    if (this.isMobileViewport) {
      const pages = this.stagePages;
      if (pages.length === 0) {
        return null;
      }
      const pageIndex = AppUtils.clampNumber(this.stagePageIndex, 0, pages.length - 1);
      const pageSize = this.columnsPerPage();
      const start = AppUtils.clampNumber(pageIndex * pageSize, 0, Math.max(0, total - 1));
      const pageLength = Math.max(1, pages[pageIndex]?.length ?? 0);
      const end = AppUtils.clampNumber(start + pageLength - 1, start, total - 1);
      return { start, end };
    }
    const starts = this.desktopStagePageStarts(total);
    const startIndex = AppUtils.clampNumber(this.stagePageIndex, 0, Math.max(0, starts.length - 1));
    const start = AppUtils.clampNumber(starts[startIndex] ?? 0, 0, Math.max(0, total - 1));
    const end = AppUtils.clampNumber(start + 2, start, total - 1);
    return { start, end };
  }

  private previousStage(): EventSubeventsStageCard | null {
    const bounds = this.visibleStageBounds();
    if (!bounds || bounds.start <= 0) {
      return null;
    }
    return this.stageCards[bounds.start - 1] ?? null;
  }

  private nextStage(): EventSubeventsStageCard | null {
    const bounds = this.visibleStageBounds();
    if (!bounds || bounds.end >= (this.stageCards.length - 1)) {
      return null;
    }
    return this.stageCards[bounds.end + 1] ?? null;
  }

  private visibleStageEdges(): { start: EventSubeventsStageCard; end: EventSubeventsStageCard } | null {
    const bounds = this.visibleStageBounds();
    if (!bounds) {
      return null;
    }
    const start = this.stageCards[bounds.start];
    const end = this.stageCards[bounds.end];
    if (!start || !end) {
      return null;
    }
    return { start, end };
  }

  private visibleStagesForRangeLabel(): EventSubeventsStageCard[] {
    const bounds = this.visibleStageBounds();
    if (!bounds) {
      return [];
    }
    return this.stageCards.slice(bounds.start, bounds.end + 1);
  }

  private emitWorkingSubEvents(): void {
    this.localMutationVersion += 1;
    this.rebuildRenderModel();
    this.subEventsChange.emit(this.cloneSubEvents(this.workingSubEvents));
    this.bumpCasualSmartListRevision();
  }

  private applyWorkingSubEvents(source: readonly EventSubeventsItem[]): void {
    this.workingSubEvents = this.cloneSubEvents(source).map(item => ({
      ...item,
      id: item.id ?? this.nextId('subevent')
    }));
    this.rebuildRenderModel();
    this.bumpCasualSmartListRevision();
  }

  private stagePageStartIndexes(): number[] {
    return this.stagePageStartIndexesCache;
  }

  private async hydrateOwnerRecord(): Promise<void> {
    const ownerId = `${this.ownerId ?? ''}`.trim();
    if (!this.open || !ownerId) {
      return;
    }

    // Keep the editor-provided subevent state as the source of truth.
    if (this.subEvents.length > 0) {
      return;
    }

    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }

    const sequence = ++this.ownerHydrationSequence;
    const mutationVersion = this.localMutationVersion;
    const cached = this.eventsService.peekKnownItemById(activeUserId, ownerId);
    this.applyHydratedOwnerRecord(cached, ownerId, sequence, mutationVersion);

    const record = await this.eventsService.queryKnownItemById(activeUserId, ownerId);
    this.applyHydratedOwnerRecord(record, ownerId, sequence, mutationVersion);
  }

  private applyHydratedOwnerRecord(
    record: DemoEventRecord | null,
    ownerId: string,
    sequence: number,
    mutationVersion: number
  ): void {
    if (!record || sequence !== this.ownerHydrationSequence || !this.open || `${this.ownerId ?? ''}`.trim() !== ownerId) {
      return;
    }
    if (this.localMutationVersion !== mutationVersion) {
      return;
    }

    const nextSubEvents = this.cloneSubEvents(record.subEvents ?? []).map(item => ({
      ...item,
      id: item.id ?? this.nextId('subevent')
    }));
    this.workingSubEvents = nextSubEvents;
    this.rebuildRenderModel();
    this.bumpCasualSmartListRevision();
    this.alignPageToCurrentStage();

    const nextDisplayMode = record.subEventsDisplayMode === 'Tournament' ? 'Tournament' : 'Casual';
    if (nextDisplayMode !== this.displayMode) {
      this.displayModeChange.emit(nextDisplayMode);
    }
    this.subEventsChange.emit(this.cloneSubEvents(this.workingSubEvents));
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim() || this.appCtx.getActiveUserId().trim();
  }

  private bumpCasualSmartListRevision(): void {
    this.casualListRevision += 1;
    this.casualSmartListQuery = {
      filters: {
        revision: this.casualListRevision
      }
    };
  }

  private loadCasualSubEventsPage(query: ListQuery<{ revision: number }>): PageResult<EventSubeventsItem> {
    const source = [...this.sortedSubEvents];
    const pageSize = Math.max(1, Math.trunc(query.pageSize) || 18);
    const pageIndex = Math.max(1, Math.trunc(query.page) || 1);
    const startIndex = (pageIndex - 1) * pageSize;
    const items = source.slice(startIndex, startIndex + pageSize);
    return {
      items,
      total: source.length,
      nextCursor: startIndex + pageSize < source.length ? `${pageIndex + 1}` : null
    };
  }

  private resolveNextSubEventStartAt(): Date {
    const lastEnd = this.workingSubEvents
      .map(item => this.parseDateValue(item.endAt ?? item.startAt))
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())
      .pop();

    return lastEnd ? new Date(lastEnd.getTime()) : new Date();
  }

  private normalizeSubEventCapacityRange(): void {
    const min = Math.max(0, Math.trunc(Number(this.subEventForm.capacityMin) || 0));
    const max = Math.max(min, Math.trunc(Number(this.subEventForm.capacityMax) || min));
    this.subEventForm.capacityMin = min;
    this.subEventForm.capacityMax = max;
  }

  private resetSubEventStageInsertControls(editingSubEventId: string | null = null): void {
    this.subEventStageInsertPlacement = 'after';
    const source = this.sortSubEventRefsByStartAsc(this.workingSubEvents);
    if (source.length === 0) {
      this.subEventStageInsertTargetId = null;
      return;
    }
    if (!editingSubEventId) {
      this.subEventStageInsertTargetId = source[source.length - 1]?.id ?? null;
      return;
    }

    const editingIndex = source.findIndex(item => item.id === editingSubEventId);
    const options = source.filter(item => item.id !== editingSubEventId);
    if (options.length === 0) {
      this.subEventStageInsertTargetId = null;
      return;
    }
    if (editingIndex <= 0) {
      this.subEventStageInsertPlacement = 'before';
      this.subEventStageInsertTargetId = options[0]?.id ?? null;
      return;
    }
    this.subEventStageInsertPlacement = 'after';
    this.subEventStageInsertTargetId = source[editingIndex - 1]?.id ?? options[options.length - 1]?.id ?? null;
  }

  private subEventInsertTargetSource(): EventSubeventsItem[] {
    const source = this.sortSubEventRefsByStartAsc(this.workingSubEvents);
    const editingSubEventId = this.editingSubEventId();
    if (!editingSubEventId) {
      return source;
    }
    return source.filter(item => item.id !== editingSubEventId);
  }

  private editingSubEventId(): string | null {
    if (this.subEventFormMode !== 'edit') {
      return null;
    }
    if (this.subEventForm.id) {
      return this.subEventForm.id;
    }
    if (this.subEventFormSourceIndex === null) {
      return null;
    }
    return this.workingSubEvents[this.subEventFormSourceIndex]?.id ?? null;
  }

  private subEventInsertIndex(items: EventSubeventsItem[]): number {
    if (items.length === 0) {
      return 0;
    }

    const fallbackTargetIndex = items.length - 1;
    const requestedTargetIndex = this.subEventStageInsertTargetId
      ? items.findIndex(item => item.id === this.subEventStageInsertTargetId)
      : -1;
    const targetIndex = requestedTargetIndex >= 0 ? requestedTargetIndex : fallbackTargetIndex;
    return this.subEventStageInsertPlacement === 'before' ? targetIndex : targetIndex + 1;
  }

  private applySubEventInsertTargetDateRangeToForm(): void {
    if (!this.subEventStageInsertTargetId) {
      return;
    }
    const source = this.subEventInsertTargetSource();
    const targetIndex = source.findIndex(item => item.id === this.subEventStageInsertTargetId);
    if (targetIndex < 0) {
      return;
    }
    const target = source[targetIndex];
    if (!target) {
      return;
    }
    const previous = source[targetIndex - 1] ?? null;
    const next = source[targetIndex + 1] ?? null;
    const beforeStartBoundary = previous?.endAt ?? target.startAt;
    const beforeEndBoundary = target.startAt;
    const afterStartBoundary = target.endAt;
    const afterEndBoundary = next?.startAt ?? target.endAt;

    const draftStartAt = this.subEventStageInsertPlacement === 'before'
      ? beforeStartBoundary
      : afterStartBoundary;
    const draftEndAt = this.subEventStageInsertPlacement === 'before'
      ? beforeEndBoundary
      : afterEndBoundary;

    if (!draftStartAt || !draftEndAt) {
      return;
    }
    this.subEventForm = {
      ...this.subEventForm,
      startAt: draftStartAt,
      endAt: draftEndAt
    };
  }

  private subEventInsertStageNumberPreview(): number | null {
    const source = this.sortSubEventRefsByStartAsc(this.workingSubEvents);
    const count = source.length;
    if (!this.showSubEventInsertControls()) {
      return count > 0 ? count + 1 : 1;
    }
    const fallback = count + 1;
    if (!this.subEventStageInsertTargetId) {
      return fallback;
    }
    const targetIndex = source.findIndex(item => item.id === this.subEventStageInsertTargetId);
    if (targetIndex < 0) {
      return fallback;
    }
    return this.subEventStageInsertPlacement === 'before'
      ? targetIndex + 1
      : Math.min(count + 1, targetIndex + 2);
  }

  private applyGapShiftAfterInsert(items: EventSubeventsItem[], insertIndex: number): EventSubeventsItem[] {
    const nextItems = this.cloneSubEvents(items);
    const inserted = nextItems[insertIndex] ?? null;
    if (!inserted) {
      return nextItems;
    }

    const insertedId = inserted.id;
    const insertedStartMs = this.parseDateValue(inserted.startAt)?.getTime();
    const insertedEndMs = this.parseDateValue(inserted.endAt)?.getTime();
    if (!Number.isFinite(insertedStartMs) || !Number.isFinite(insertedEndMs)) {
      return nextItems;
    }

    const ordered = nextItems
      .map((item, index) => ({
        item,
        index,
        startMs: this.parseDateValue(item.startAt)?.getTime(),
        endMs: this.parseDateValue(item.endAt)?.getTime()
      }))
      .filter(entry => Number.isFinite(entry.startMs) && Number.isFinite(entry.endMs))
      .sort((a, b) => {
        if ((a.startMs as number) !== (b.startMs as number)) {
          return (a.startMs as number) - (b.startMs as number);
        }
        return a.index - b.index;
      });

    let trimCandidate: (typeof ordered)[number] | null = null;
    for (const entry of ordered) {
      if (entry.item.id === insertedId) {
        continue;
      }
      if (!this.shouldAutoAdjustInsertedSubEventOverlap(inserted, entry.item)) {
        continue;
      }
      if ((entry.startMs as number) < (insertedStartMs as number) && (entry.endMs as number) > (insertedStartMs as number)) {
        trimCandidate = entry;
      }
    }
    if (trimCandidate) {
      trimCandidate.item.endAt = AppUtils.toIsoDateTimeLocal(new Date(insertedStartMs as number));
    }

    const firstShiftOverlap = ordered.find(entry =>
      entry.item.id !== insertedId
      && this.shouldAutoAdjustInsertedSubEventOverlap(inserted, entry.item)
      && (entry.startMs as number) >= (insertedStartMs as number)
      && (entry.startMs as number) < (insertedEndMs as number)
    );
    if (!firstShiftOverlap) {
      return nextItems;
    }

    const shiftStartMs = firstShiftOverlap.startMs as number;
    const shiftMs = (insertedEndMs as number) - shiftStartMs;
    if (shiftMs <= 0) {
      return nextItems;
    }

    for (const entry of ordered) {
      if (
        entry.item.id === insertedId
        || (entry.startMs as number) < shiftStartMs
        || !this.shouldAutoAdjustInsertedSubEventOverlap(inserted, entry.item)
      ) {
        continue;
      }
      entry.item.startAt = AppUtils.toIsoDateTimeLocal(new Date((entry.startMs as number) + shiftMs));
      entry.item.endAt = AppUtils.toIsoDateTimeLocal(new Date((entry.endMs as number) + shiftMs));
    }

    return nextItems;
  }

  private shouldAutoAdjustInsertedSubEventOverlap(
    inserted: Pick<EventSubeventsItem, 'optional'>,
    candidate: Pick<EventSubeventsItem, 'optional'>
  ): boolean {
    return !(inserted.optional === true && candidate.optional === true);
  }

  private normalizedTournamentLeaderboardType(value: unknown): TournamentLeaderboardType {
    return `${value ?? ''}`.trim().toLowerCase() === 'fifa' ? 'Fifa' : 'Score';
  }

  private defaultTournamentLeaderboardType(): TournamentLeaderboardType {
    return this.normalizedTournamentLeaderboardType(this.subEventForm.tournamentLeaderboardType);
  }

  private defaultTournamentAdvancePerGroup(): number {
    return Math.max(0, Math.trunc(Number(this.subEventForm.tournamentAdvancePerGroup) || 0));
  }

  private defaultTournamentGroupCapacityMin(draft: SubEventFormModel = this.subEventForm): number {
    const fromDraft = Number(draft.tournamentGroupCapacityMin);
    if (Number.isFinite(fromDraft)) {
      return Math.max(0, Math.trunc(fromDraft));
    }
    const reference = this.referenceSubEventForDraft();
    const fromReference = Number(reference?.tournamentGroupCapacityMin);
    if (Number.isFinite(fromReference)) {
      return Math.max(0, Math.trunc(fromReference));
    }
    return 4;
  }

  private defaultTournamentGroupCapacityMax(min: number, draft: SubEventFormModel = this.subEventForm): number {
    const fromDraft = Number(draft.tournamentGroupCapacityMax);
    if (Number.isFinite(fromDraft)) {
      return Math.max(min, Math.trunc(fromDraft));
    }
    const reference = this.referenceSubEventForDraft();
    const fromReference = Number(reference?.tournamentGroupCapacityMax);
    if (Number.isFinite(fromReference)) {
      return Math.max(min, Math.trunc(fromReference));
    }
    return Math.max(min, 7);
  }

  private defaultStageCapacityMin(): number {
    const reference = this.referenceSubEventForDraft();
    const fromReference = Number(reference?.capacityMin);
    if (Number.isFinite(fromReference)) {
      return Math.max(0, Math.trunc(fromReference));
    }
    return 4;
  }

  private defaultStageCapacityMax(min: number): number {
    const reference = this.referenceSubEventForDraft();
    const fromReference = Number(reference?.capacityMax);
    if (Number.isFinite(fromReference)) {
      return Math.max(min, Math.trunc(fromReference));
    }
    return Math.max(min, 7);
  }

  private referenceSubEventForDraft(): EventSubeventsItem | null {
    const source = this.subEventInsertTargetSource();
    if (source.length === 0) {
      const entries = this.sortedEntries;
      return entries.length > 0 ? entries[entries.length - 1].item : null;
    }
    if (!this.subEventStageInsertTargetId) {
      return source[source.length - 1] ?? null;
    }
    const index = source.findIndex(item => item.id === this.subEventStageInsertTargetId);
    if (index < 0) {
      return source[source.length - 1] ?? null;
    }
    return source[index] ?? null;
  }

  private normalizeTournamentStageConfigOnForm(): void {
    const min = this.defaultTournamentGroupCapacityMin();
    const max = this.defaultTournamentGroupCapacityMax(min);
    this.subEventForm.tournamentGroupCapacityMin = min;
    this.subEventForm.tournamentGroupCapacityMax = max;
  }

  private normalizedNonNegativeInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  private createEmptySubEventForm(): SubEventFormModel {
    return {
      id: undefined,
      name: '',
      description: '',
      location: '',
      startAt: '',
      endAt: '',
      optional: this.displayMode !== 'Tournament',
      capacityMin: 4,
      capacityMax: 7,
      tournamentGroupCount: undefined,
      tournamentGroupCapacityMin: 4,
      tournamentGroupCapacityMax: 7,
      tournamentLeaderboardType: 'Score',
      tournamentAdvancePerGroup: 0,
      groups: []
    };
  }

  private createEmptyGroupForm(): GroupFormModel {
    return {
      name: '',
      capacityMin: 4,
      capacityMax: 7,
      membersPending: 6
    };
  }

  private resetTransientUi(): void {
    this.showDisplayModePicker = false;
    this.openStageMenuKey = null;
    this.openGroupMenuKey = null;
    this.openCasualMenuKey = null;
    this.showSubEventForm = false;
    this.showSubEventOptionalPicker = false;
    this.resetSubEventStageInsertControls();
    this.subEventFormMode = 'create';
    this.subEventFormSourceIndex = null;
    this.subEventForm = this.createEmptySubEventForm();
    this.showGroupForm = false;
    this.groupFormSourceIndex = null;
    this.groupFormGroupId = null;
    this.groupFormStageTitle = '';
    this.groupForm = this.createEmptyGroupForm();
    this.showLeaderboardPopup = false;
    this.leaderboardPopupStageKey = null;
    this.leaderboardPopupStageTitle = '';
    this.leaderboardPopupGroups = [];
    this.leaderboardPopupMode = 'Score';
    this.pendingDeleteTarget = null;
    this.onStageSwipeCancel();
  }

  private cloneSubEvents(items: readonly EventSubeventsItem[]): EventSubeventsItem[] {
    return items.map(item => ({
      ...item,
      groups: this.cloneGroups(item.groups)
    }));
  }

  private sortSubEventsByStartAsc(items: EventSubeventsItem[]): EventSubeventsItem[] {
    return this.cloneSubEvents(items)
      .map((item, index) => ({
        item,
        index,
        startMs: this.parseDateValue(item.startAt)?.getTime() ?? Number.POSITIVE_INFINITY
      }))
      .sort((a, b) => {
        if (a.startMs !== b.startMs) {
          return a.startMs - b.startMs;
        }
        return a.index - b.index;
      })
      .map(entry => entry.item);
  }

  private sortSubEventRefsByStartAsc(items: readonly EventSubeventsItem[]): EventSubeventsItem[] {
    return items
      .map((item, index) => ({
        item,
        index,
        startMs: this.parseDateValue(item.startAt)?.getTime() ?? Number.POSITIVE_INFINITY
      }))
      .sort((a, b) => {
        if (a.startMs !== b.startMs) {
          return a.startMs - b.startMs;
        }
        return a.index - b.index;
      })
      .map(entry => entry.item);
  }

  private cloneGroups(groups: readonly EventSubeventsGroupItem[] | undefined): EventSubeventsGroupItem[] {
    if (!groups || groups.length === 0) {
      return [];
    }
    return groups.map(group => ({ ...group }));
  }

  private nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private toInputDateTime(value: Date): string {
    return `${value.getFullYear()}-${AppUtils.pad2(value.getMonth() + 1)}-${AppUtils.pad2(value.getDate())}T${AppUtils.pad2(value.getHours())}:${AppUtils.pad2(value.getMinutes())}`;
  }

  private parseInputDate(value: string): Date | null {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}

import { CommonModule } from '@angular/common';
import {
  Component,
  DoCheck,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../../shared/app-static-data';
import { AssetDefaultsBuilder } from '../../../../shared/core/base/builders/asset-defaults.builder';
import type * as AppConstants from '../../../../shared/core/common/constants';
import type * as ContractTypes from '../../../../shared/core/contracts';
import type * as AppDTOs from '../../../../shared/core/contracts/activity.interface';
import { ActivityResourcesService } from '../../../../shared/core/base/services/activity-resources.service';
import type { ListQuery, PageResult } from '../../../../shared/core/contracts/list.interface';
import {
  ActivityStore,
  type ActivityChatMetricBucketType
} from '../../../../shared/ui/context/stores/activity.store';
import { SubEventResourcePopupStore } from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import { AppMenuComponent } from '../../../../shared/ui/components/core/menu/menu.component';
import { AppMenuDispatcher } from '../../../../shared/ui/components/core/menu/menu-dispatcher.service';
import { AppMenuOutletComponent } from '../../../../shared/ui/components/core/menu/outlet/menu-outlet.component';
import type {
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuPalette,
  AppMenuTrigger
} from '../../../../shared/ui/components/core/menu/menu.types';
import {
  CARD_MENU_ACTIONS,
  type CardMenuAction,
  type CardMenuActionEvent,
  type CardMenuRequestEvent,
  type InfoCardData
} from '../../../../shared/ui/components/core/smart-list/card/card.types';
import { InfoCardComponent } from '../../../../shared/ui/components/core/smart-list/card/info-card/info-card.component';
import { SmartListComponent } from '../../../../shared/ui/components/core/smart-list/smart-list.component';
import type {
  SmartListConfig,
  SmartListLoadPage,
  SmartListRefreshEvent,
  SmartListStateChange
} from '../../../../shared/ui/components/core/smart-list/smart-list.types';

export interface EventResourceListItem {
  card: AppDTOs.SubEventResourceCardDTO;
  infoCard: InfoCardData;
}

export interface EventResourceListModel {
  filter: AppConstants.AssetType;
  metricIdentity: string;
  filterCounts: Record<AppConstants.AssetType, number>;
  items: readonly EventResourceListItem[];
}

export interface EventResourceCardActionRequest {
  card: AppDTOs.SubEventResourceCardDTO;
  event: CardMenuActionEvent<InfoCardData>;
}

interface ResourceSmartListFilters {
  revision?: number;
  contextKey?: string;
}

type EventResourceListMenuContext =
  | { menu: 'resource-filter'; filter: AppConstants.AssetType }
  | { menu: 'quick-action'; action: 'assign' | 'explore' }
  | {
      menu: 'resource-card';
      card: AppDTOs.SubEventResourceCardDTO;
      infoCard: InfoCardData;
      action: CardMenuAction;
    };

const EMPTY_FILTER_COUNTS: Record<AppConstants.AssetType, number> = {
  Car: 0,
  Accommodation: 0,
  Supplies: 0
};

const EMPTY_MODEL: EventResourceListModel = {
  filter: 'Car',
  metricIdentity: '',
  filterCounts: EMPTY_FILTER_COUNTS,
  items: []
};

@Component({
  selector: 'app-event-resource-list',
  standalone: true,
  imports: [
    CommonModule,
    AppMenuComponent,
    AppMenuOutletComponent,
    InfoCardComponent,
    SmartListComponent
  ],
  templateUrl: './event-resource-list.component.html',
  styleUrl: './event-resource-list.component.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [AppMenuDispatcher]
})
export class EventResourceListComponent implements DoCheck {
  @Input() model: EventResourceListModel | null = null;

  @Output() filterSelected = new EventEmitter<AppConstants.AssetType>();
  @Output() assignRequested = new EventEmitter<Event>();
  @Output() exploreRequested = new EventEmitter<Event>();
  @Output() mapRequested = new EventEmitter<AppDTOs.SubEventResourceCardDTO>();
  @Output() badgeDetailsRequested = new EventEmitter<AppDTOs.SubEventResourceCardDTO>();
  @Output() cardActionRequested = new EventEmitter<EventResourceCardActionRequest>();
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly activityStore = inject(ActivityStore);
  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly activityResourcesService = inject(ActivityResourcesService);

  private lastItemsSignature = '';
  private lastContextKey = '';
  private lastItemCount = 0;
  private resourceListReady = false;
  private resourceListVisibleCount = 0;

  protected readonly resourceFilterOptions: readonly AppConstants.AssetType[] = ['Car', 'Accommodation', 'Supplies'];

  protected resourceSmartListQuery: Partial<ListQuery<ResourceSmartListFilters>> = {
    filters: {
      revision: 0,
      contextKey: ''
    }
  };

  @ViewChild('resourceSmartList')
  private resourceSmartList?: SmartListComponent<EventResourceListItem, ResourceSmartListFilters>;

  protected readonly resourceSmartListLoadPage: SmartListLoadPage<EventResourceListItem, ResourceSmartListFilters> = (
    query
  ) => from(this.loadResourceSmartListPage(query));

  protected readonly resourceSmartListConfig: SmartListConfig<EventResourceListItem, ResourceSmartListFilters> = {
    pageSize: 18,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    emptyLabel: 'No assigned resources yet.',
    emptyDescription: 'Assign current-user assets to see them here.',
    showStickyHeader: false,
    showGroupMarker: () => false,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'subevent-resource-card-list': true
    },
    trackBy: (_index, item) => item.card.id
  };

  ngDoCheck(): void {
    const model = this.currentModel();
    const contextKey = model.filter;
    const signature = `${contextKey}:${model.items.map(item => this.itemSignature(item)).join('|')}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      this.lastItemsSignature = signature;
      this.lastItemCount = model.items.length;
      this.resourceListReady = false;
      this.resourceListVisibleCount = 0;
      this.resourceSmartListQuery = {
        filters: {
          revision: Date.now(),
          contextKey
        }
      };
    } else if (signature !== this.lastItemsSignature) {
      const previousItemCount = this.lastItemCount;
      this.lastItemsSignature = signature;
      this.lastItemCount = model.items.length;
      this.syncVisibleResourceItems(model.items, previousItemCount);
    }
  }

  protected onResourceSmartListStateChange(
    change: SmartListStateChange<EventResourceListItem, ResourceSmartListFilters>
  ): void {
    this.resourceListVisibleCount = change.items.length;
    this.resourceListReady = !change.initialLoading;
    if (!this.resourceListReady) {
      return;
    }
    const items = this.currentModel().items;
    if (change.total !== items.length) {
      this.syncVisibleResourceItems(items, change.total);
    }
  }

  protected resourceFilterMenuTrigger(): AppMenuTrigger {
    const model = this.currentModel();
    const count = this.resourceFilterCount(model.filter);
    return {
      label: this.resourceTypeLabel(model.filter).toLowerCase(),
      icon: this.resourceTypeIcon(model.filter),
      ariaLabel: 'Open asset filter',
      palette: this.resourceTypePalette(model.filter),
      counter: count > 0 ? { value: count, max: 99 } : null,
      layout: 'pill'
    };
  }

  protected resourceFilterMenuItems(): readonly AppMenuItem<string, EventResourceListMenuContext>[] {
    const active = this.currentModel().filter;
    return this.resourceFilterOptions.map(option => {
      const count = this.resourceFilterCount(option);
      return {
        id: `resource-filter-${option}`,
        label: this.resourceTypeLabel(option).toLowerCase(),
        icon: this.resourceTypeIcon(option),
        kind: 'radio',
        active: option === active,
        checked: option === active,
        palette: this.resourceTypePalette(option),
        surface: 'tinted',
        counter: count > 0 ? { value: count, max: 99 } : null,
        context: { menu: 'resource-filter', filter: option }
      };
    });
  }

  protected quickActionsMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'add',
      closeIcon: 'close',
      ariaLabel: 'Open sub-event asset actions',
      hideLabel: true,
      palette: 'green',
      layout: 'icon'
    };
  }

  protected quickActionsMenuItems(): readonly AppMenuItem<string, EventResourceListMenuContext>[] {
    return [
      {
        id: 'quick-assign',
        label: 'Assign',
        icon: 'assignment_ind',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'quick-action', action: 'assign' }
      },
      {
        id: 'quick-explore',
        label: 'Explore',
        icon: 'explore',
        palette: 'green',
        surface: 'tinted',
        context: { menu: 'quick-action', action: 'explore' }
      }
    ];
  }

  protected onEventResourceMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as EventResourceListMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'resource-filter':
        event.sourceEvent.stopPropagation();
        this.filterSelected.emit(context.filter);
        return;
      case 'quick-action':
        if (context.action === 'assign') {
          this.assignRequested.emit(event.sourceEvent);
          return;
        }
        this.exploreRequested.emit(event.sourceEvent);
        return;
      case 'resource-card':
        this.cardActionRequested.emit({
          card: context.card,
          event: {
            id: context.infoCard.id,
            actionId: context.action.id,
            action: context.action,
            card: context.infoCard
          }
        });
        return;
      default:
        return;
    }
  }

  protected openResourceInfoCardMenu(
    item: EventResourceListItem,
    request: CardMenuRequestEvent<InfoCardData>
  ): void {
    const menuId = `event-resource-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(menuId)) {
      this.appMenuDispatcher.close(menuId);
      return;
    }
    this.appMenuDispatcher.open({
      id: menuId,
      kind: 'select',
      title: this.infoCardMenuTitle(request.card),
      items: this.infoCardMenuItems(item.card, request),
      triggerRect: request.triggerRect,
      openUp: request.openUp,
      panelAlign: 'auto',
      closeOnSelect: true,
      onClose: request.closeTrigger
    }, null);
  }

  protected openResourceCardMap(item: EventResourceListItem): void {
    this.mapRequested.emit(item.card);
  }

  protected openResourceCardBadgeDetails(item: EventResourceListItem): void {
    this.badgeDetailsRequested.emit(item.card);
  }

  protected onResourceCardMenuAction(
    item: EventResourceListItem,
    event: CardMenuActionEvent<InfoCardData>
  ): void {
    this.cardActionRequested.emit({
      card: item.card,
      event
    });
  }

  protected onResourceSmartListRefresh(event: SmartListRefreshEvent<EventResourceListItem, ResourceSmartListFilters>): void {
    const model = this.currentModel();
    const refreshedItems = this.resourceListItemsFromRefresh(event);
    const metricItems = refreshedItems.length >= model.items.length ? refreshedItems : model.items;
    this.publishSubEventResourceMetricsFromRefresh(model.filter, metricItems);
    const identity = `${model.metricIdentity ?? ''}`.trim();
    const bucketType = this.chatMetricBucketType(model.filter);
    if (!identity || !bucketType) {
      return;
    }
    this.activityStore.emitActivityChatMetricBucketPatch({
      identity,
      bucketType,
      bucket: {
        accepted: refreshedItems.reduce((sum, item) => sum + this.nonNegativeCount(item.card.accepted), 0),
        pending: refreshedItems.reduce((sum, item) => sum + this.nonNegativeCount(item.card.pending), 0),
        capacityMin: 0,
        capacityMax: refreshedItems.reduce((sum, item) => sum + this.nonNegativeCount(item.card.capacityTotal), 0)
      }
    });
  }

  private publishSubEventResourceMetricsFromRefresh(
    filter: AppConstants.AssetType,
    items: readonly EventResourceListItem[]
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const metrics = {
      accepted: items.reduce((sum, item) => sum + this.nonNegativeCount(item.card.accepted), 0),
      pending: items.reduce((sum, item) => sum + this.nonNegativeCount(item.card.pending), 0),
      capacityMin: this.resourceCapacityMin(context.subEvent.id, filter, items),
      capacityMax: items.reduce((sum, item) => sum + this.nonNegativeCount(item.card.capacityTotal), 0)
    };
    const nextSubEvent = { ...context.subEvent };
    if (filter === 'Car') {
      nextSubEvent.carsAccepted = metrics.accepted;
      nextSubEvent.carsPending = metrics.pending;
      nextSubEvent.carsCapacityMin = metrics.capacityMin;
      nextSubEvent.carsCapacityMax = metrics.capacityMax;
    } else if (filter === 'Accommodation') {
      nextSubEvent.accommodationAccepted = metrics.accepted;
      nextSubEvent.accommodationPending = metrics.pending;
      nextSubEvent.accommodationCapacityMin = metrics.capacityMin;
      nextSubEvent.accommodationCapacityMax = metrics.capacityMax;
    } else {
      nextSubEvent.suppliesAccepted = metrics.accepted;
      nextSubEvent.suppliesPending = metrics.pending;
      nextSubEvent.suppliesCapacityMin = metrics.capacityMin;
      nextSubEvent.suppliesCapacityMax = metrics.capacityMax;
    }
    if (!this.subEventResourceMetricsChanged(context.subEvent, nextSubEvent)) {
      return;
    }
    const nextContext = {
      ...context,
      subEvent: nextSubEvent
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    this.resourcePopupStore.publishSubEventResourceMetrics(nextContext);
  }

  private resourceCapacityMin(
    subEventId: string,
    filter: AppConstants.AssetType,
    items: readonly EventResourceListItem[]
  ): number {
    const settings = this.resourcePopupStore.assignedAssetSettingsByKey[
      this.resourcePopupStore.assetAssignmentKey(subEventId, filter)
    ] ?? {};
    return items.reduce((sum, item) => {
      const assetId = `${item.card.sourceAssetId ?? ''}`.trim();
      return sum + this.nonNegativeCount(assetId ? settings[assetId]?.capacityMin : 0);
    }, 0);
  }

  private subEventResourceMetricsChanged(current: ContractTypes.SubEventDTO, next: ContractTypes.SubEventDTO): boolean {
    return current.carsAccepted !== next.carsAccepted
      || current.carsPending !== next.carsPending
      || current.carsCapacityMin !== next.carsCapacityMin
      || current.carsCapacityMax !== next.carsCapacityMax
      || current.accommodationAccepted !== next.accommodationAccepted
      || current.accommodationPending !== next.accommodationPending
      || current.accommodationCapacityMin !== next.accommodationCapacityMin
      || current.accommodationCapacityMax !== next.accommodationCapacityMax
      || current.suppliesAccepted !== next.suppliesAccepted
      || current.suppliesPending !== next.suppliesPending
      || current.suppliesCapacityMin !== next.suppliesCapacityMin
      || current.suppliesCapacityMax !== next.suppliesCapacityMax;
  }

  private async loadResourceSmartListPage(
    query: ListQuery<ResourceSmartListFilters>
  ): Promise<PageResult<EventResourceListItem>> {
    await this.activityResourcesService.waitForResourceRouteDelay();
    const items = this.currentModel().items;
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length
    };
  }

  private syncVisibleResourceItems(
    items: readonly EventResourceListItem[],
    previousItemCount: number
  ): void {
    if (!this.resourceListReady || !this.resourceSmartList) {
      return;
    }

    const visibleCount = Math.max(this.resourceListVisibleCount, this.resourceSmartList.itemsSnapshot().length);
    const allItemsWereVisible = visibleCount >= previousItemCount;
    let nextVisibleCount = Math.min(items.length, visibleCount);

    if (items.length > previousItemCount && allItemsWereVisible) {
      nextVisibleCount = Math.min(items.length, visibleCount + (items.length - previousItemCount));
    }

    this.resourceSmartList.syncVisibleItems(items.slice(0, nextVisibleCount), {
      total: items.length,
      trackBy: (_index, item) => item.card.id,
      equals: (current, next) => this.itemSignature(current) === this.itemSignature(next)
    });
  }

  private itemSignature(item: EventResourceListItem): string {
    return [
      item.card.id,
      item.card.accepted,
      item.card.pending,
      item.card.capacityTotal,
      ...(item.card.routes ?? []),
      item.infoCard.title,
      item.infoCard.mediaSubtitle,
      item.infoCard.description,
      ...(item.infoCard.detailRows ?? []),
      ...(item.infoCard.menuActions ?? [])
    ].join(':');
  }

  private resourceListItemsFromRefresh(
    event: SmartListRefreshEvent<EventResourceListItem, ResourceSmartListFilters>
  ): EventResourceListItem[] {
    const sourceItems = event.sourceItems
      .map(item => this.eventResourceListItem(item))
      .filter((item): item is EventResourceListItem => item !== null);
    if (sourceItems.length > 0 || event.items.length === 0) {
      return sourceItems;
    }
    return event.items.map(item => this.eventResourceListItem(item)).filter((item): item is EventResourceListItem => item !== null);
  }

  private eventResourceListItem(value: unknown): EventResourceListItem | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const item = value as Partial<EventResourceListItem>;
    return item.card && typeof item.card.id === 'string' ? item as EventResourceListItem : null;
  }

  private chatMetricBucketType(type: AppConstants.SubEventResourceFilter): ActivityChatMetricBucketType | null {
    if (type === 'Car') {
      return 'car';
    }
    if (type === 'Accommodation') {
      return 'accommodation';
    }
    if (type === 'Supplies') {
      return 'supplies';
    }
    return null;
  }

  private nonNegativeCount(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private infoCardMenuTitle(card: InfoCardData): string | null {
    if (card.menuTitle === null) {
      return null;
    }
    return `${card.menuTitle ?? card.title ?? ''}`.trim();
  }

  private infoCardMenuItems(
    card: AppDTOs.SubEventResourceCardDTO,
    request: CardMenuRequestEvent<InfoCardData>
  ): readonly AppMenuItem<string, EventResourceListMenuContext>[] {
    return (request.actions ?? []).flatMap(actionId => {
      const config = CARD_MENU_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: CardMenuAction = {
        id: actionId,
        ...config
      };
      const context: EventResourceListMenuContext = {
        menu: 'resource-card',
        card,
        infoCard: request.card,
        action
      };
      return [{
        id: actionId,
        label: config.label,
        icon: config.icon,
        palette: this.infoCardActionPalette(config.tone),
        surface: 'tinted',
        context
      }];
    });
  }

  private infoCardActionPalette(tone: CardMenuAction['tone']): AppMenuPalette {
    switch (tone) {
      case 'accent':
        return 'green';
      case 'review':
        return 'violet';
      case 'warning':
        return 'warning';
      case 'destructive':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  private resourceFilterCount(type: AppConstants.AssetType): number {
    return this.currentModel().filterCounts[type] ?? 0;
  }

  private currentModel(): EventResourceListModel {
    return this.model ?? EMPTY_MODEL;
  }

  private resourceTypeIcon(type: AppConstants.SubEventResourceFilter): string {
    return type === 'Members' ? 'groups' : AssetDefaultsBuilder.assetTypeIcon(type);
  }

  private resourceTypeLabel(type: AppConstants.SubEventResourceFilter): string {
    return APP_STATIC_DATA.subEventResourceFilterLabels[type];
  }

  private resourceTypePalette(type: AppConstants.SubEventResourceFilter): AppMenuPalette {
    switch (type) {
      case 'Members':
        return 'blue';
      case 'Car':
        return 'sky';
      case 'Accommodation':
        return 'green';
      case 'Supplies':
        return 'brown';
      default:
        return 'default';
    }
  }
}

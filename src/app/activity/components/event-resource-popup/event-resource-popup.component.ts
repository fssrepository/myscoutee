import { CommonModule } from '@angular/common';
import { Component, DoCheck, HostListener, Input, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule, MatSelect } from '@angular/material/select';
import { of } from 'rxjs';

import {
  CounterBadgePipe,
  InfoCardComponent,
  SmartListComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage,
  type SmartListStateChange
} from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { resolveCurrentDemoDelayMs } from '../../../shared/core/base/services/route-delay.service';

interface CapacityEditorState {
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
  busy: boolean;
  error: string | null;
}

interface RouteEditorState {
  title: string;
  routes: string[];
  busy: boolean;
  error: string | null;
}

interface PendingResourceDeleteState {
  title: string;
  busy: boolean;
  error: string | null;
}

interface ResourceSmartListFilters {
  revision?: number;
  contextKey?: string;
}

export interface AssetExplorePopupViewState {
  title: string;
  subtitle: string;
  type: AppTypes.AssetType;
  category: AppTypes.AssetCategory;
  categoryOptions: readonly AppTypes.AssetCategory[];
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  loading: boolean;
  error: string | null;
  cards: AppTypes.AssetCard[];
}

export interface AssetExploreBorrowDialogViewState {
  title: string;
  subtitle: string;
  quantity: number;
  availableQuantity: number;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  busy: boolean;
  error: string | null;
}

export interface EventResourcePopupHost {
  title(): string;
  subtitle(): string;
  summary(): string;
  isMobileView(): boolean;
  isMobilePopupSheetViewport(): boolean;
  resourceFilter(): AppTypes.AssetType;
  resourceFilterOptions(): readonly AppTypes.AssetType[];
  resourceFilterPanelWidth(): string;
  resourceFilterCount(type: AppTypes.AssetType): number;
  resourceTypeClass(type: AppTypes.SubEventResourceFilter): string;
  resourceTypeIcon(type: AppTypes.SubEventResourceFilter): string;
  resourceTypeLabel(type: AppTypes.SubEventResourceFilter): string;
  cards(): AppTypes.SubEventResourceCard[];
  capacityEditor(): CapacityEditorState | null;
  routeEditor(): RouteEditorState | null;
  pendingDeleteCard(): PendingResourceDeleteState | null;
  assetExplorePopup(): AssetExplorePopupViewState | null;
  assetExploreBorrowDialog(): AssetExploreBorrowDialogViewState | null;
  close(): void;
  selectResourceFilter(filter: AppTypes.SubEventResourceFilter): void;
  onResourceFilterOpened(isOpen: boolean, select: MatSelect): void;
  openMobileResourceFilterSelector(event?: Event): void;
  openAssignPopup(event?: Event): void;
  openExplorePopup(event?: Event): void;
  closeExplorePopup(event?: Event): void;
  selectAssetExploreCategory(category: AppTypes.AssetCategory, event?: Event): void;
  setAssetExploreDateRange(start: Date | null, end: Date | null): void;
  setAssetExploreTime(edge: 'start' | 'end', value: string): void;
  assetExploreAvailabilityLabel(card: AppTypes.AssetCard): string;
  assetExploreCanBorrow(card: AppTypes.AssetCard): boolean;
  openAssetExploreBorrowDialog(card: AppTypes.AssetCard, event?: Event): void;
  closeAssetExploreBorrowDialog(event?: Event): void;
  setAssetExploreBorrowDateRange(start: Date | null, end: Date | null): void;
  setAssetExploreBorrowTime(edge: 'start' | 'end', value: string): void;
  onAssetExploreBorrowQuantityChange(value: number | string): void;
  canSubmitAssetExploreBorrow(): boolean;
  confirmAssetExploreBorrow(event?: Event): void;
  assetExploreBorrowRingPerimeter(): number;
  trackByCard(index: number, card: AppTypes.SubEventResourceCard): string;
  canOpenMap(card: AppTypes.SubEventResourceCard): boolean;
  openMap(card: AppTypes.SubEventResourceCard, event?: Event): void;
  canOpenBadgeDetails(card: AppTypes.SubEventResourceCard): boolean;
  openBadgeDetails(card: AppTypes.SubEventResourceCard, event?: Event): void;
  occupancyLabel(card: AppTypes.SubEventResourceCard): string;
  canOpenAssetMembers(card: AppTypes.SubEventResourceCard): boolean;
  isItemActionMenuOpen(card: AppTypes.SubEventResourceCard): boolean;
  isItemActionMenuOpenUp(card: AppTypes.SubEventResourceCard): boolean;
  toggleItemActionMenu(card: AppTypes.SubEventResourceCard, event: Event): void;
  canJoin(card: AppTypes.SubEventResourceCard): boolean;
  join(card: AppTypes.SubEventResourceCard, event: Event): void;
  canEditCapacity(card: AppTypes.SubEventResourceCard): boolean;
  openCapacityEditor(card: AppTypes.SubEventResourceCard, event: Event): void;
  canEditRoute(card: AppTypes.SubEventResourceCard): boolean;
  routeMenuLabel(card: AppTypes.SubEventResourceCard): string;
  openRouteEditor(card: AppTypes.SubEventResourceCard, event: Event): void;
  delete(card: AppTypes.SubEventResourceCard, event: Event): void;
  closeCapacityEditor(event?: Event): void;
  canSubmitCapacityEditor(): boolean;
  onCapacityMinChange(value: number | string): void;
  onCapacityMaxChange(value: number | string): void;
  saveCapacityEditor(event?: Event): void;
  closeRouteEditor(event?: Event): void;
  routeEditorSupportsMultiRoute(): boolean;
  openRouteMap(event?: Event): void;
  addRouteStop(): void;
  dropRouteStop(event: unknown): void;
  updateRouteStop(index: number, value: string): void;
  openRouteStopMap(index: number, event?: Event): void;
  removeRouteStop(index: number): void;
  canSubmitRouteEditor(): boolean;
  saveRouteEditor(event?: Event): void;
  editorSaveRingPerimeter(): number;
  isCapacitySavePending(): boolean;
  capacitySaveErrorMessage(): string;
  isRouteSavePending(): boolean;
  routeSaveErrorMessage(): string;
  cancelDeleteCard(): void;
  deleteCardLabel(): string;
  deleteCardConfirmRingPerimeter(): number;
  isDeleteCardPending(): boolean;
  deleteCardErrorMessage(): string;
  confirmDeleteCard(): void;
}

@Component({
  selector: 'app-event-resource-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatButtonModule,
    MatDatepickerModule,
    MatIconModule,
    MatNativeDateModule,
    MatSelectModule,
    SmartListComponent,
    InfoCardComponent,
    CounterBadgePipe
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss']
})
export class EventResourcePopupComponent implements DoCheck {
  private lastCardsSignature = '';
  private lastContextKey = '';
  private lastCardCount = 0;
  private resourceListReady = false;
  private resourceListVisibleCount = 0;

  @Input({ required: true }) host!: EventResourcePopupHost;

  protected resourceFilterOpen = false;
  protected showMobileResourceFilterPicker = false;
  protected showQuickActionsMenu = false;

  protected resourceSmartListQuery: Partial<ListQuery<ResourceSmartListFilters>> = {
    filters: {
      revision: 0,
      contextKey: ''
    }
  };

  @ViewChild('resourceSmartList')
  private resourceSmartList?: SmartListComponent<AppTypes.SubEventResourceCard, ResourceSmartListFilters>;

  protected resourceItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventResourceCard, ResourceSmartListFilters>>;

  @ViewChild('resourceItemTemplate', { read: TemplateRef })
  private set resourceItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventResourceCard, ResourceSmartListFilters>> | undefined
  ) {
    this.resourceItemTemplateRef = value;
  }

  protected readonly resourceSmartListLoadPage: SmartListLoadPage<AppTypes.SubEventResourceCard, ResourceSmartListFilters> = (
    query
  ) => {
    const cards = this.host?.cards?.() ?? [];
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return of({
      items: cards.slice(start, start + pageSize),
      total: cards.length
    });
  };

  protected readonly resourceSmartListConfig: SmartListConfig<AppTypes.SubEventResourceCard, ResourceSmartListFilters> = {
    pageSize: 18,
    loadingDelayMs: resolveCurrentDemoDelayMs(1500),
    loadingWindowMs: 3000,
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
    trackBy: (_index, card) => card.id
  };

  ngDoCheck(): void {
    const cards = this.host?.cards?.() ?? [];
    const contextKey = `${this.host?.title?.() ?? ''}:${this.host?.subtitle?.() ?? ''}:${this.host?.resourceFilter?.() ?? ''}`;
    const signature = `${contextKey}:${cards.map(card => [
      card.id,
      card.accepted,
      card.pending,
      card.capacityTotal,
      ...(card.routes ?? [])
    ].join(':')).join('|')}`;

    if (contextKey !== this.lastContextKey) {
      this.lastContextKey = contextKey;
      this.lastCardsSignature = signature;
      this.lastCardCount = cards.length;
      this.resourceListReady = false;
      this.resourceListVisibleCount = 0;
      this.resourceSmartListQuery = {
        filters: {
          revision: Date.now(),
          contextKey
        }
      };
      return;
    }

    if (signature === this.lastCardsSignature) {
      return;
    }

    const previousCardCount = this.lastCardCount;
    this.lastCardsSignature = signature;
    this.lastCardCount = cards.length;
    this.syncVisibleResourceCards(cards, previousCardCount);
  }

  protected onResourceSmartListStateChange(
    change: SmartListStateChange<AppTypes.SubEventResourceCard, ResourceSmartListFilters>
  ): void {
    this.resourceListVisibleCount = change.items.length;
    this.resourceListReady = !change.initialLoading;
    if (!this.resourceListReady) {
      return;
    }
    const cards = this.host?.cards?.() ?? [];
    if (change.total !== cards.length) {
      this.syncVisibleResourceCards(cards, change.total);
    }
  }

  protected resourceInfoCard(
    card: AppTypes.SubEventResourceCard,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return {
      rowId: card.id,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [`${card.type} · ${card.subtitle} · ${card.city}`],
      description: card.details,
      leadingIcon: {
        icon: this.host.resourceTypeIcon(card.type)
      },
      mediaStart: this.resourceMediaStart(card),
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.host.occupancyLabel(card),
        interactive: this.host.canOpenBadgeDetails(card),
        pendingCount: card.pending,
        ariaLabel: this.host.canOpenAssetMembers(card)
          ? 'Open member requests'
          : 'Open resource details'
      },
      menuActions: this.resourceMenuActions(card),
      clickable: false
    };
  }

  protected openResourceCardMap(card: AppTypes.SubEventResourceCard): void {
    if (!this.host.canOpenMap(card)) {
      return;
    }
    this.host.openMap(card);
  }

  protected openResourceCardBadgeDetails(card: AppTypes.SubEventResourceCard): void {
    if (!this.host.canOpenBadgeDetails(card)) {
      return;
    }
    this.host.openBadgeDetails(card);
  }

  protected onResourceFilterOpenedChange(isOpen: boolean, select: MatSelect): void {
    this.resourceFilterOpen = isOpen;
    this.host.onResourceFilterOpened(isOpen, select);
  }

  protected openMobileResourceFilterSelector(event: Event): void {
    if (!this.isMobileResourceFilterSheetViewport()) {
      return;
    }
    event.stopPropagation();
    this.resourceFilterOpen = false;
    this.showMobileResourceFilterPicker = !this.showMobileResourceFilterPicker;
  }

  protected toggleQuickActionsMenu(event: Event): void {
    event.stopPropagation();
    this.showQuickActionsMenu = !this.showQuickActionsMenu;
  }

  protected openAssignQuickAction(event: Event): void {
    event.stopPropagation();
    this.showQuickActionsMenu = false;
    this.host.openAssignPopup(event);
  }

  protected openExploreQuickAction(event: Event): void {
    event.stopPropagation();
    this.showQuickActionsMenu = false;
    this.host.openExplorePopup(event);
  }

  protected selectMobileResourceFilter(filter: AppTypes.AssetType, event?: Event): void {
    event?.stopPropagation();
    this.showMobileResourceFilterPicker = false;
    this.host.selectResourceFilter(filter);
  }

  protected assetExploreInfoCard(card: AppTypes.AssetCard): InfoCardData {
    const visibility = card.visibility === 'Friends only'
      ? 'Friends only'
      : card.visibility === 'Invitation only'
        ? 'Invitation only'
        : 'Public';
    const canBorrow = this.host.assetExploreCanBorrow(card);
    return {
      rowId: `asset-explore:${card.id}`,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [[
        this.host.resourceTypeLabel(card.type),
        card.category ?? '',
        card.city
      ].filter(Boolean).join(' · ')],
      description: card.details,
      detailRows: [[
        card.ownerName?.trim() || 'Unknown owner',
        visibility
      ].filter(Boolean).join(' · ')],
      leadingIcon: {
        icon: visibility === 'Friends only'
          ? 'groups'
          : visibility === 'Invitation only'
            ? 'mail_lock'
            : 'public',
        tone: visibility === 'Friends only'
          ? 'friends'
          : visibility === 'Invitation only'
            ? 'invitation'
            : 'public'
      },
      mediaStart: {
        variant: 'avatar',
        tone: `tone-${(AppUtils.hashText(`${card.ownerUserId ?? card.id}:${card.ownerName ?? card.title}`) % 8) + 1}` as NonNullable<InfoCardData['mediaStart']>['tone'],
        label: AppUtils.initialsFromText(card.ownerName?.trim() || card.title),
        interactive: false,
        ariaLabel: null
      },
      mediaEnd: {
        variant: 'badge',
        tone: canBorrow ? 'default' : 'inactive',
        label: this.host.assetExploreAvailabilityLabel(card),
        interactive: canBorrow,
        disabled: !canBorrow,
        ariaLabel: canBorrow ? 'Borrow asset' : 'Asset unavailable for this time'
      },
      menuActions: canBorrow ? [{
        id: 'borrow',
        label: 'Borrow',
        icon: 'volunteer_activism',
        tone: 'accent'
      }] : [],
      clickable: false
    };
  }

  protected openAssetExploreBorrowFromBadge(card: AppTypes.AssetCard): void {
    if (!this.host.assetExploreCanBorrow(card)) {
      return;
    }
    this.host.openAssetExploreBorrowDialog(card);
  }

  protected onAssetExploreInfoCardMenuAction(card: AppTypes.AssetCard, event: InfoCardMenuActionEvent): void {
    if (event.actionId !== 'borrow') {
      return;
    }
    this.host.openAssetExploreBorrowDialog(card, new Event('click'));
  }

  protected onAssetExploreDateRangeChange(
    start: Date | null,
    end: Date | null
  ): void {
    this.host.setAssetExploreDateRange(start, end);
  }

  protected onAssetExploreBorrowDateRangeChange(
    start: Date | null,
    end: Date | null
  ): void {
    this.host.setAssetExploreBorrowDateRange(start, end);
  }

  protected onResourceCardMenuAction(card: AppTypes.SubEventResourceCard, event: InfoCardMenuActionEvent): void {
    if (event.actionId === 'join') {
      this.host.join(card, new Event('click'));
      return;
    }
    if (event.actionId === 'capacity') {
      this.host.openCapacityEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'route') {
      this.host.openRouteEditor(card, new Event('click'));
      return;
    }
    this.host.delete(card, new Event('click'));
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.host.assetExploreBorrowDialog()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.host.closeAssetExploreBorrowDialog();
      return;
    }
    if (this.host.assetExplorePopup()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.host.closeExplorePopup();
      return;
    }
    if (this.showQuickActionsMenu) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.showQuickActionsMenu = false;
      return;
    }
    if (!this.showMobileResourceFilterPicker) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.showMobileResourceFilterPicker = false;
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.popup-mobile-filter-picker')) {
      this.showMobileResourceFilterPicker = false;
    }
    if (!target.closest('.subevent-assets-quick-actions')) {
      this.showQuickActionsMenu = false;
    }
  }

  private syncVisibleResourceCards(
    cards: AppTypes.SubEventResourceCard[],
    previousCardCount: number
  ): void {
    if (!this.resourceListReady || !this.resourceSmartList) {
      return;
    }

    const visibleCount = Math.max(this.resourceListVisibleCount, this.resourceSmartList.itemsSnapshot().length);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);

    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + 1);
    }

    this.resourceSmartList.replaceVisibleItems(cards.slice(0, nextVisibleCount), {
      total: cards.length
    });
  }

  protected isMobileResourceFilterSheetViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  private resourceMediaStart(card: AppTypes.SubEventResourceCard): NonNullable<InfoCardData['mediaStart']> | null {
    if (!this.host.canOpenMap(card)) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: card.type === 'Car' ? 'Open route map' : 'Open accommodation map'
    };
  }

  private resourceMenuActions(card: AppTypes.SubEventResourceCard): readonly InfoCardMenuAction[] {
    const actions: InfoCardMenuAction[] = [];
    if (this.host.canJoin(card)) {
      actions.push({
        id: 'join',
        label: 'Join',
        icon: 'login',
        tone: 'accent'
      });
    }
    if (this.host.canEditCapacity(card)) {
      actions.push({
        id: 'capacity',
        label: 'Edit Capacity',
        icon: 'edit'
      });
    }
    if (this.host.canEditRoute(card)) {
      actions.push({
        id: 'route',
        label: this.host.routeMenuLabel(card),
        icon: 'route'
      });
    }
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      tone: 'destructive'
    });
    return actions;
  }
}

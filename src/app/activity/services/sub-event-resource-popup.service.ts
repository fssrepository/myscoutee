import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import type { MatSelect } from '@angular/material/select';

import { AssetPopupService } from '../../asset/asset-popup.service';
import type { AssetPopupHost } from '../../asset/asset-popup.host';
import { OwnedAssetsPopupService } from '../../asset/owned-assets-popup.service';
import { AppDemoGenerators } from '../../shared/app-demo-generators';
import { AppUtils } from '../../shared/app-utils';
import type * as AppTypes from '../../shared/core/base/models';
import { AppContext } from '../../shared/core';
import type { DemoUser } from '../../shared/demo-data';
import { ActivitiesDbContextService } from './activities-db-context.service';
import { EventEditorService } from '../../shared/event-editor.service';
import type {
  EventResourcePopupHost
} from '../components/event-resource-popup/event-resource-popup.component';
import type {
  EventSupplyContributionsPopupHost
} from '../components/event-supply-contributions-popup/event-supply-contributions-popup.component';

interface ResourcePopupContext {
  origin: 'chat' | 'eventEditor';
  parentTitle: string;
  subEvent: AppTypes.SubEventFormItem;
  groupId?: string;
  groupName?: string;
  fallbackCardsByType: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>;
}

interface CapacityEditorState {
  subEventId: string;
  type: AppTypes.AssetType;
  assetId: string;
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
}

interface RouteEditorState {
  subEventId: string;
  type: 'Car';
  assetId: string;
  title: string;
  routes: string[];
}

interface SupplyContributionPopupState {
  subEventId: string;
  assetId: string;
  title: string;
}

interface SupplyBringDialogState {
  subEventId: string;
  cardId: string;
  title: string;
  quantity: number;
  min: number;
  max: number;
}

@Injectable({
  providedIn: 'root'
})
export class SubEventResourcePopupService {
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly eventEditorService = inject(EventEditorService);
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly ownedAssets = inject(OwnedAssetsPopupService);
  private readonly appCtx = inject(AppContext);

  private readonly users: DemoUser[] = AppDemoGenerators.buildExpandedDemoUsers(50);
  private readonly userById = new Map(this.users.map(user => [user.id, user]));

  private readonly popupContextRef = signal<ResourcePopupContext | null>(null);
  private readonly resourceFilterRef = signal<AppTypes.AssetType>('Car');
  private readonly inlineItemActionMenuRef = signal<{ id: string; openUp: boolean } | null>(null);
  private readonly capacityEditorRef = signal<CapacityEditorState | null>(null);
  private readonly routeEditorRef = signal<RouteEditorState | null>(null);
  private readonly supplyPopupRef = signal<SupplyContributionPopupState | null>(null);
  private readonly bringDialogRef = signal<SupplyBringDialogState | null>(null);
  private readonly pendingSupplyDeleteRef = signal<{ subEventId: string; assetId: string; entryId: string; label: string } | null>(null);
  private readonly assignContextRef = signal<{ subEventId: string; type: AppTypes.AssetType } | null>(null);
  private readonly selectedAssignAssetIdsRef = signal<string[]>([]);

  private readonly assignedAssetIdsByKey: Record<string, string[]> = {};
  private readonly assignedAssetSettingsByKey: Record<string, Record<string, AppTypes.SubEventAssignedAssetSettings>> = {};
  private readonly supplyContributionEntriesByAssignmentKey: Record<string, AppTypes.SubEventSupplyContributionEntry[]> = {};

  readonly resourceHost = computed<EventResourcePopupHost | null>(() =>
    this.popupContextRef() && !this.supplyPopupRef() ? this.eventResourcePopupHost : null
  );

  readonly supplyContributionsHost = computed<EventSupplyContributionsPopupHost | null>(() =>
    this.popupContextRef() && this.supplyPopupRef() ? this.eventSupplyContributionsPopupHost : null
  );

  private readonly eventResourcePopupHost: EventResourcePopupHost = {
    title: () => this.popupTitle(),
    subtitle: () => this.popupSubtitle(),
    summary: () => this.popupSummary(),
    isMobileView: () => this.isMobileView(),
    isMobilePopupSheetViewport: () => false,
    resourceFilter: () => this.resourceFilterRef(),
    resourceFilterOptions: () => ['Car', 'Accommodation', 'Supplies'],
    resourceFilterCount: type => this.resourceFilterCount(type),
    resourceTypeClass: type => this.ownedAssets.assetTypeClass(type === 'Members' ? 'Car' : type),
    resourceTypeIcon: type => type === 'Members' ? 'groups' : this.ownedAssets.assetTypeIcon(type),
    cards: () => this.resourceCards(),
    capacityEditor: () => this.capacityEditorRef(),
    routeEditor: () => this.routeEditorRef(),
    close: () => this.closeResourcePopup(),
    selectResourceFilter: filter => this.selectResourceFilter(filter),
    onResourceFilterOpened: (isOpen, select) => this.onResourceFilterOpened(isOpen, select),
    openMobileResourceFilterSelector: () => undefined,
    openAssignPopup: event => this.openAssignPopup(event),
    trackByCard: (_index, card) => card.id,
    canOpenMap: card => this.canOpenResourceMap(card),
    openMap: (card, event) => this.openResourceMap(card, event),
    canOpenBadgeDetails: card => card.type === 'Supplies' && !!card.sourceAssetId,
    openBadgeDetails: (card, event) => this.openSupplyContributionsPopup(card, event),
    occupancyLabel: card => this.occupancyLabel(card),
    canOpenAssetMembers: () => false,
    isItemActionMenuOpen: card => this.inlineItemActionMenuRef()?.id === card.id,
    isItemActionMenuOpenUp: card => this.inlineItemActionMenuRef()?.id === card.id && this.inlineItemActionMenuRef()?.openUp === true,
    toggleItemActionMenu: (card, event) => this.toggleItemActionMenu(card, event),
    canJoin: card => this.canJoin(card),
    join: (card, event) => this.join(card, event),
    canEditCapacity: card => this.canEditCapacity(card),
    openCapacityEditor: (card, event) => this.openCapacityEditor(card, event),
    canEditRoute: card => this.canEditRoute(card),
    routeMenuLabel: () => 'Edit Route',
    openRouteEditor: (card, event) => this.openRouteEditor(card, event),
    delete: (card, event) => this.delete(card, event),
    closeCapacityEditor: event => this.closeCapacityEditor(event),
    canSubmitCapacityEditor: () => this.canSubmitCapacityEditor(),
    onCapacityMinChange: value => this.onCapacityMinChange(value),
    onCapacityMaxChange: value => this.onCapacityMaxChange(value),
    saveCapacityEditor: event => this.saveCapacityEditor(event),
    closeRouteEditor: event => this.closeRouteEditor(event),
    routeEditorSupportsMultiRoute: () => !!this.routeEditorRef(),
    openRouteMap: event => this.openRouteMap(event),
    addRouteStop: () => this.addRouteStop(),
    dropRouteStop: event => this.dropRouteStop(event as CdkDragDrop<string[]>),
    updateRouteStop: (index, value) => this.updateRouteStop(index, value),
    openRouteStopMap: (index, event) => this.openRouteStopMap(index, event),
    removeRouteStop: index => this.removeRouteStop(index),
    canSubmitRouteEditor: () => this.canSubmitRouteEditor(),
    saveRouteEditor: event => this.saveRouteEditor(event)
  };

  private readonly eventSupplyContributionsPopupHost: EventSupplyContributionsPopupHost = {
    title: () => this.supplyPopupTitle(),
    subtitle: () => this.popupSubtitle(),
    summary: () => this.supplyContributionTotalLabel(),
    rows: () => this.supplyContributionRows(),
    bringDialog: () => this.bringDialogRef(),
    pendingDelete: () => this.pendingSupplyDeleteRef(),
    close: () => this.closeSupplyContributionsPopup(),
    openBringDialog: event => this.openBringDialog(event),
    addedLabel: addedAtIso => this.addedLabel(addedAtIso),
    quantityLabel: quantity => this.quantityLabel(quantity),
    canDelete: row => row.userId === this.activeUser().id,
    requestDelete: (row, event) => this.requestDeleteSupplyContribution(row, event),
    cancelBringDialog: () => this.bringDialogRef.set(null),
    canSubmitBringDialog: () => this.canSubmitBringDialog(),
    onBringQuantityChange: value => this.onBringQuantityChange(value),
    confirmBringDialog: event => this.confirmBringDialog(event),
    cancelDelete: () => this.pendingSupplyDeleteRef.set(null),
    pendingDeleteLabel: () => this.pendingDeleteLabel(),
    confirmDelete: () => this.confirmDeleteSupplyContribution()
  };

  private readonly assetAssignHost: AssetPopupHost = {
    isMobileView: () => this.isMobileView(),
    isSubEventAssetAssignPopup: () => this.assignContextRef() !== null,
    assetTypeIcon: type => this.ownedAssets.assetTypeIcon(type),
    assetTypeClass: type => this.ownedAssets.assetTypeClass(type),
    subEventAssetAssignHeaderTitle: () => this.assignPopupTitle(),
    subEventAssetAssignHeaderSubtitle: () => this.popupSubtitle(),
    canConfirmSubEventAssetAssignSelection: () => this.selectedAssignAssetIdsRef().length > 0,
    closeSubEventAssetAssignPopup: apply => this.closeAssignPopup(apply),
    confirmSubEventAssetAssignSelection: event => this.confirmAssignPopup(event),
    subEventAssetAssignCandidates: () => this.assignCandidates(),
    selectedSubEventAssetAssignChips: () => this.assignSelectedChips(),
    toggleSubEventAssetAssignCard: (cardId, event) => this.toggleAssignCard(cardId, event),
    isSubEventAssetAssignCardSelected: cardId => this.selectedAssignAssetIdsRef().includes(cardId)
  };

  constructor() {
    this.assetPopupService.registerHost(this.assetAssignHost);
    this.ownedAssets.registerRuntimeHooks({
      onAssetDeleted: cardId => this.handleOwnedAssetDeleted(cardId),
      onAssetsChanged: () => this.handleOwnedAssetsChanged()
    });

    effect(() => {
      const request = this.activitiesContext.activitiesNavigationRequest();
      if (!request || request.type !== 'chatResource') {
        return;
      }
      this.activitiesContext.clearActivitiesNavigationRequest();
      this.openFromChatRequest(request);
    }, { allowSignalWrites: true });

    effect(() => {
      const request = this.eventEditorService.subEventResourcePopupRequest();
      if (!request) {
        return;
      }
      this.eventEditorService.clearSubEventResourcePopupRequest();
      this.openFromEventEditorRequest(request);
    }, { allowSignalWrites: true });
  }

  private activeUser(): DemoUser {
    const activeUserId = this.appCtx.activeUserId().trim();
    return this.users.find(user => user.id === activeUserId) ?? this.users[0];
  }

  private openFromChatRequest(request: Extract<AppTypes.ActivitiesNavigationRequest, { type: 'chatResource' }>): void {
    if (request.resourceType === 'Members') {
      this.activitiesContext.requestActivitiesNavigation({
        type: 'members',
        ownerId: request.group?.id?.trim() || request.subEvent.id,
        ownerType: request.group?.id ? 'group' : 'subEvent'
      });
      return;
    }

    const context = this.buildPopupContext(
      'chat',
      request.item.title,
      request.resourceType,
      request.subEvent,
      request.group ?? null,
      request.assetCardsByType
    );
    this.seedAssignmentsFromRequest(context.subEvent.id, request.assetAssignmentIds, context.fallbackCardsByType);
    this.openPopupContext(context, request.resourceType);
  }

  private openFromEventEditorRequest(request: NonNullable<ReturnType<EventEditorService['subEventResourcePopupRequest']>>): void {
    if (request.type === 'Members') {
      this.activitiesContext.requestActivitiesNavigation({
        type: 'members',
        ownerId: request.group?.id?.trim() || `${request.subEvent.id ?? ''}`.trim(),
        ownerType: request.group?.id ? 'group' : 'subEvent'
      });
      return;
    }

    const context = this.buildPopupContext(
      'eventEditor',
      request.parentTitle?.trim() || 'Event',
      request.type,
      request.subEvent,
      request.group ?? null
    );
    this.openPopupContext(context, request.type);
  }

  private buildPopupContext(
    origin: 'chat' | 'eventEditor',
    parentTitle: string,
    type: AppTypes.AssetType,
    rawSubEvent: AppTypes.SubEventFormItem,
    group: { id?: string | null; groupLabel?: string; pending?: number; capacityMin?: number; capacityMax?: number } | null | undefined,
    fallbackCardsByType?: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): ResourcePopupContext {
    const subEvent = this.cloneSubEvent(rawSubEvent);
    const scopedSubEvent = group?.id
      ? this.applyGroupScopedAssetSnapshot(subEvent, type, group)
      : subEvent;

    return {
      origin,
      parentTitle: parentTitle.trim() || 'Event',
      subEvent: scopedSubEvent,
      groupId: group?.id?.trim() || undefined,
      groupName: group?.groupLabel?.trim() || undefined,
      fallbackCardsByType: this.cloneFallbackCards(fallbackCardsByType)
    };
  }

  private openPopupContext(context: ResourcePopupContext, type: AppTypes.AssetType): void {
    this.popupContextRef.set(context);
    this.resourceFilterRef.set(type);
    this.inlineItemActionMenuRef.set(null);
    this.capacityEditorRef.set(null);
    this.routeEditorRef.set(null);
    this.supplyPopupRef.set(null);
    this.bringDialogRef.set(null);
    this.pendingSupplyDeleteRef.set(null);
    this.closeAssignPopup(false);
    this.syncPopupSubEventMetrics();
  }

  private closeResourcePopup(): void {
    this.popupContextRef.set(null);
    this.inlineItemActionMenuRef.set(null);
    this.capacityEditorRef.set(null);
    this.routeEditorRef.set(null);
    this.supplyPopupRef.set(null);
    this.bringDialogRef.set(null);
    this.pendingSupplyDeleteRef.set(null);
    this.closeAssignPopup(false);
  }

  private popupTitle(): string {
    const context = this.popupContextRef();
    const subEvent = context?.subEvent;
    if (!context || !subEvent) {
      return this.resourceFilterRef();
    }
    const stageLabel = this.subEventStageLabel(subEvent);
    return stageLabel ? `${this.resourceFilterRef()} - ${stageLabel}` : this.resourceFilterRef();
  }

  private popupSubtitle(): string {
    const context = this.popupContextRef();
    if (!context) {
      return 'Event';
    }
    const subEventName = this.subEventDisplayName(context.subEvent);
    if (context.parentTitle && subEventName) {
      return `${context.parentTitle} - ${subEventName}`;
    }
    return context.parentTitle || subEventName || 'Event';
  }

  private popupSummary(): string {
    const context = this.popupContextRef();
    if (!context) {
      return '0 members';
    }
    const metrics = this.subEventAssetCapacityMetrics(context.subEvent, this.resourceFilterRef());
    if (metrics.pending <= 0) {
      return `${metrics.joined} members`;
    }
    return `${metrics.joined} members · ${metrics.pending} pending`;
  }

  private supplyPopupTitle(): string {
    const context = this.supplyPopupRef();
    const popup = this.popupContextRef();
    if (!context || !popup) {
      return 'Supplies';
    }
    const stageLabel = this.subEventStageLabel(popup.subEvent);
    return stageLabel ? `${context.title} - ${stageLabel}` : context.title;
  }

  private supplyContributionRows(): AppTypes.SubEventSupplyContributionRow[] {
    const context = this.supplyPopupRef();
    if (!context) {
      return [];
    }
    return this.subEventSupplyContributionEntries(context.subEventId, context.assetId)
      .map(entry => {
        const user = this.userById.get(entry.userId) ?? null;
        return {
          id: entry.id,
          userId: entry.userId,
          name: user?.name ?? 'Unknown member',
          initials: user?.initials ?? AppUtils.initialsFromText(user?.name ?? 'Unknown member'),
          gender: user?.gender ?? 'woman',
          age: user?.age ?? 0,
          city: user?.city ?? '',
          addedAtIso: entry.addedAtIso,
          quantity: AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER)
        };
      })
      .sort((a, b) => AppUtils.toSortableDate(b.addedAtIso) - AppUtils.toSortableDate(a.addedAtIso));
  }

  private openSupplyContributionsPopup(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
    if (!context || card.type !== 'Supplies' || !card.sourceAssetId) {
      return;
    }
    this.supplyPopupRef.set({
      subEventId: context.subEvent.id,
      assetId: card.sourceAssetId,
      title: card.title
    });
    this.pendingSupplyDeleteRef.set(null);
    this.bringDialogRef.set(null);
  }

  private closeSupplyContributionsPopup(): void {
    this.supplyPopupRef.set(null);
    this.pendingSupplyDeleteRef.set(null);
    this.bringDialogRef.set(null);
  }

  private openBringDialog(event?: Event): void {
    event?.stopPropagation();
    const context = this.supplyPopupRef();
    if (!context) {
      return;
    }
    const source = this.ownedAssets.assetCards.find(card => card.id === context.assetId && card.type === 'Supplies');
    const settings = this.getSubEventAssignedAssetSettings(context.subEventId, 'Supplies');
    const max = Math.max(1, settings[context.assetId]?.capacityMax ?? source?.capacityTotal ?? 1);
    this.bringDialogRef.set({
      subEventId: context.subEventId,
      cardId: context.assetId,
      title: context.title,
      quantity: 1,
      min: 0,
      max
    });
  }

  private canSubmitBringDialog(): boolean {
    const dialog = this.bringDialogRef();
    return !!dialog && dialog.quantity >= dialog.min && dialog.quantity <= dialog.max;
  }

  private onBringQuantityChange(value: number | string): void {
    const dialog = this.bringDialogRef();
    if (!dialog) {
      return;
    }
    const parsed = Number(value);
    this.bringDialogRef.set({
      ...dialog,
      quantity: AppUtils.clampNumber(
        Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
        dialog.min,
        dialog.max
      )
    });
  }

  private confirmBringDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.bringDialogRef();
    if (!dialog || !this.canSubmitBringDialog()) {
      return;
    }
    const key = this.subEventSupplyAssignmentKey(dialog.subEventId, dialog.cardId);
    const current = this.supplyContributionEntriesByAssignmentKey[key] ?? [];
    if (dialog.quantity > 0) {
      current.push({
        id: `subevent-supply-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: this.activeUser().id,
        quantity: dialog.quantity,
        addedAtIso: AppUtils.toIsoDateTime(new Date())
      });
    }
    this.supplyContributionEntriesByAssignmentKey[key] = [...current];
    this.bringDialogRef.set(null);
    this.syncPopupSubEventMetrics();
  }

  private requestDeleteSupplyContribution(row: AppTypes.SubEventSupplyContributionRow, event?: Event): void {
    event?.stopPropagation();
    const context = this.supplyPopupRef();
    if (!context || row.userId !== this.activeUser().id) {
      return;
    }
    this.pendingSupplyDeleteRef.set({
      subEventId: context.subEventId,
      assetId: context.assetId,
      entryId: row.id,
      label: `${row.name} · ${row.quantity}`
    });
  }

  private confirmDeleteSupplyContribution(): void {
    const pending = this.pendingSupplyDeleteRef();
    if (!pending) {
      return;
    }
    const key = this.subEventSupplyAssignmentKey(pending.subEventId, pending.assetId);
    this.supplyContributionEntriesByAssignmentKey[key] = (this.supplyContributionEntriesByAssignmentKey[key] ?? [])
      .filter(entry => entry.id !== pending.entryId);
    this.pendingSupplyDeleteRef.set(null);
    this.syncPopupSubEventMetrics();
  }

  private pendingDeleteLabel(): string {
    const pending = this.pendingSupplyDeleteRef();
    return pending ? `Delete "${pending.label}" from supplies?` : '';
  }

  private supplyContributionTotalQuantity(): number {
    const context = this.supplyPopupRef();
    if (!context) {
      return 0;
    }
    return this.subEventSupplyContributionEntries(context.subEventId, context.assetId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private supplyContributionTotalLabel(): string {
    return this.quantityLabel(this.supplyContributionTotalQuantity());
  }

  private addedLabel(addedAtIso: string): string {
    const parsed = new Date(addedAtIso);
    const value = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private quantityLabel(quantity: number): string {
    const normalized = AppUtils.clampNumber(Math.trunc(quantity), 0, Number.MAX_SAFE_INTEGER);
    return normalized === 1 ? '1 item' : `${normalized} items`;
  }

  private selectResourceFilter(filter: AppTypes.SubEventResourceFilter): void {
    if (filter === 'Members') {
      return;
    }
    this.resourceFilterRef.set(filter);
    this.inlineItemActionMenuRef.set(null);
    this.capacityEditorRef.set(null);
    this.routeEditorRef.set(null);
  }

  private onResourceFilterOpened(isOpen: boolean, select: MatSelect): void {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }
    const overlayRef = (
      select as unknown as { _overlayDir?: { overlayRef?: { updatePosition: () => void } } }
    )._overlayDir?.overlayRef;
    const reposition = (): void => {
      if (select.panelOpen) {
        overlayRef?.updatePosition();
      }
    };
    window.requestAnimationFrame(() => {
      reposition();
      window.setTimeout(reposition, 0);
      window.setTimeout(reposition, 40);
    });
  }

  private resourceCards(): AppTypes.SubEventResourceCard[] {
    const context = this.popupContextRef();
    if (!context) {
      return [];
    }
    const type = this.resourceFilterRef();
    const assignedIds = this.resolveSubEventAssignedAssetIds(context.subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);

    let baseCards = assignedIds
      .map(id => this.ownedAssets.assetCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);

    if (baseCards.length === 0) {
      const fallbackCards = context.fallbackCardsByType[type] ?? [];
      baseCards = fallbackCards.length > 0
        ? fallbackCards.map(card => ({ ...card, requests: [...card.requests], routes: [...(card.routes ?? [])] }))
        : this.ownedAssets.assetCards.filter(card => card.type === type);
    }

    return baseCards.map(card => ({
      id: `subevent-${card.id}`,
      type: card.type,
      sourceAssetId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      city: card.city,
      details: card.details,
      imageUrl: card.imageUrl,
      sourceLink: card.sourceLink,
      routes: card.type === 'Accommodation'
        ? this.normalizeAssetRoutes(card.type, card.routes)
        : this.normalizeAssetRoutes(card.type, settings[card.id]?.routes ?? card.routes),
      capacityTotal: settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal),
      accepted: card.type === 'Supplies'
        ? this.subEventSupplyProvidedCount(card.id, context.subEvent.id)
        : this.assetAcceptedCount(card),
      pending: this.assetPendingCount(card),
      isMembers: false
    }));
  }

  private occupancyLabel(card: AppTypes.SubEventResourceCard): string {
    const context = this.popupContextRef();
    if (card.type === 'Supplies' && card.sourceAssetId && context) {
      return `${this.subEventSupplyProvidedCount(card.sourceAssetId, context.subEvent.id)} / 1 - ${card.capacityTotal}`;
    }
    return `${card.accepted} / ${card.capacityTotal}`;
  }

  private canOpenResourceMap(card: AppTypes.SubEventResourceCard): boolean {
    if (!card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes).some(stop => stop.trim().length > 0);
  }

  private openResourceMap(card: AppTypes.SubEventResourceCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenResourceMap(card)) {
      return;
    }
    const routes = this.normalizeAssetRoutes(card.type as AppTypes.AssetType, card.routes);
    if (card.type === 'Accommodation') {
      this.openGoogleMapsSearch(routes[0] ?? card.city);
      return;
    }
    this.openGoogleMapsDirections(routes);
  }

  private toggleItemActionMenu(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (this.inlineItemActionMenuRef()?.id === card.id) {
      this.inlineItemActionMenuRef.set(null);
      return;
    }
    this.inlineItemActionMenuRef.set({
      id: card.id,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    });
  }

  private canJoin(card: AppTypes.SubEventResourceCard): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation');
  }

  private join(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!this.canJoin(card) || !card.sourceAssetId) {
      return;
    }
    const activeUser = this.activeUser();
    this.ownedAssets.assetCards = this.ownedAssets.assetCards.map(asset => {
      if (asset.id !== card.sourceAssetId) {
        return asset;
      }
      const nextRequests = asset.requests.filter(request => AppUtils.resolveAssetRequestUserId(request, this.users) !== activeUser.id);
      nextRequests.unshift({
        id: activeUser.id,
        userId: activeUser.id,
        name: activeUser.name,
        initials: activeUser.initials,
        gender: activeUser.gender,
        status: 'pending',
        note: 'Join request from sub-event assets.'
      });
      return {
        ...asset,
        requests: nextRequests
      };
    });
    this.inlineItemActionMenuRef.set(null);
    this.syncPopupSubEventMetrics();
  }

  private canEditCapacity(card: AppTypes.SubEventResourceCard): boolean {
    const context = this.popupContextRef();
    if (!context || !card.sourceAssetId) {
      return false;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, card.type as AppTypes.AssetType);
    return settings[card.sourceAssetId]?.addedByUserId === this.activeUser().id;
  }

  private canEditRoute(card: AppTypes.SubEventResourceCard): boolean {
    return card.type === 'Car' && this.canEditCapacity(card);
  }

  private openCapacityEditor(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
    if (!context || !card.sourceAssetId || !this.canEditCapacity(card)) {
      return;
    }
    const type = card.type as AppTypes.AssetType;
    const source = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === type);
    if (!source) {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const current = settings[card.sourceAssetId];
    const capacityLimit = Math.max(0, source.capacityTotal);
    const capacityMax = AppUtils.clampNumber(Math.trunc(current?.capacityMax ?? capacityLimit), 0, capacityLimit);
    const capacityMin = AppUtils.clampNumber(Math.trunc(current?.capacityMin ?? 0), 0, capacityMax);
    this.capacityEditorRef.set({
      subEventId: context.subEvent.id,
      type,
      assetId: card.sourceAssetId,
      title: card.title,
      capacityMin,
      capacityMax,
      capacityLimit
    });
    this.routeEditorRef.set(null);
    this.inlineItemActionMenuRef.set(null);
  }

  private closeCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    this.capacityEditorRef.set(null);
  }

  private canSubmitCapacityEditor(): boolean {
    const editor = this.capacityEditorRef();
    return !!editor
      && editor.capacityMin >= 0
      && editor.capacityMax >= editor.capacityMin
      && editor.capacityMax <= editor.capacityLimit;
  }

  private onCapacityMinChange(value: number | string): void {
    const editor = this.capacityEditorRef();
    if (!editor) {
      return;
    }
    const parsed = Number(value);
    this.capacityEditorRef.set({
      ...editor,
      capacityMin: AppUtils.clampNumber(
        Number.isFinite(parsed) ? Math.trunc(parsed) : editor.capacityMin,
        0,
        editor.capacityMax
      )
    });
  }

  private onCapacityMaxChange(value: number | string): void {
    const editor = this.capacityEditorRef();
    if (!editor) {
      return;
    }
    const parsed = Number(value);
    const capacityMax = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : editor.capacityMax,
      0,
      editor.capacityLimit
    );
    this.capacityEditorRef.set({
      ...editor,
      capacityMin: Math.min(editor.capacityMin, capacityMax),
      capacityMax
    });
  }

  private saveCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.capacityEditorRef();
    if (!editor || !this.canSubmitCapacityEditor()) {
      return;
    }
    const key = this.subEventAssetAssignmentKey(editor.subEventId, editor.type);
    const nextSettings = { ...this.getSubEventAssignedAssetSettings(editor.subEventId, editor.type) };
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: editor.capacityLimit,
      addedByUserId: this.activeUser().id,
      routes: []
    };
    nextSettings[editor.assetId] = {
      ...current,
      capacityMin: editor.capacityMin,
      capacityMax: editor.capacityMax
    };
    this.assignedAssetSettingsByKey[key] = nextSettings;
    this.capacityEditorRef.set(null);
    this.syncPopupSubEventMetrics();
  }

  private openRouteEditor(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    const context = this.popupContextRef();
    if (!context || card.type !== 'Car' || !card.sourceAssetId || !this.canEditRoute(card)) {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, 'Car');
    const source = this.ownedAssets.assetCards.find(item => item.id === card.sourceAssetId && item.type === 'Car');
    this.routeEditorRef.set({
      subEventId: context.subEvent.id,
      type: 'Car',
      assetId: card.sourceAssetId,
      title: card.title,
      routes: this.normalizeAssetRoutes('Car', settings[card.sourceAssetId]?.routes ?? source?.routes)
    });
    this.capacityEditorRef.set(null);
    this.inlineItemActionMenuRef.set(null);
  }

  private closeRouteEditor(event?: Event): void {
    event?.stopPropagation();
    this.routeEditorRef.set(null);
  }

  private addRouteStop(): void {
    const editor = this.routeEditorRef();
    if (!editor) {
      return;
    }
    this.routeEditorRef.set({
      ...editor,
      routes: [...editor.routes, '']
    });
  }

  private removeRouteStop(index: number): void {
    const editor = this.routeEditorRef();
    if (!editor || index < 0 || index >= editor.routes.length) {
      return;
    }
    this.routeEditorRef.set({
      ...editor,
      routes: editor.routes.filter((_stop, stopIndex) => stopIndex !== index)
    });
  }

  private dropRouteStop(event: CdkDragDrop<string[]>): void {
    const editor = this.routeEditorRef();
    if (!editor || event.previousIndex === event.currentIndex) {
      return;
    }
    const routes = [...editor.routes];
    const [moved] = routes.splice(event.previousIndex, 1);
    routes.splice(event.currentIndex, 0, moved);
    this.routeEditorRef.set({
      ...editor,
      routes
    });
  }

  private updateRouteStop(index: number, value: string): void {
    const editor = this.routeEditorRef();
    if (!editor || index < 0 || index >= editor.routes.length) {
      return;
    }
    const routes = [...editor.routes];
    routes[index] = value;
    this.routeEditorRef.set({
      ...editor,
      routes
    });
  }

  private openRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const editor = this.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsSearch(editor.routes[index] ?? '');
  }

  private openRouteMap(event?: Event): void {
    event?.stopPropagation();
    const editor = this.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsDirections(editor.routes);
  }

  private canSubmitRouteEditor(): boolean {
    const editor = this.routeEditorRef();
    return !!editor && editor.routes.some(stop => stop.trim().length > 0);
  }

  private saveRouteEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.routeEditorRef();
    if (!editor || !this.canSubmitRouteEditor()) {
      return;
    }
    const key = this.subEventAssetAssignmentKey(editor.subEventId, editor.type);
    const nextSettings = { ...this.getSubEventAssignedAssetSettings(editor.subEventId, editor.type) };
    const source = this.ownedAssets.assetCards.find(item => item.id === editor.assetId && item.type === editor.type);
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: Math.max(0, source?.capacityTotal ?? 0),
      addedByUserId: this.activeUser().id,
      routes: []
    };
    nextSettings[editor.assetId] = {
      ...current,
      routes: this.normalizeAssetRoutes(editor.type, editor.routes)
    };
    this.assignedAssetSettingsByKey[key] = nextSettings;
    this.routeEditorRef.set(null);
    this.syncPopupSubEventMetrics();
  }

  private delete(card: AppTypes.SubEventResourceCard, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId) {
      return;
    }
    this.ownedAssets.openPopup(card.type as AppTypes.AssetType);
    this.ownedAssets.pendingAssetDeleteCardId = card.sourceAssetId;
    this.inlineItemActionMenuRef.set(null);
  }

  private openAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.popupContextRef();
    if (!context) {
      return;
    }
    const type = this.resourceFilterRef();
    this.assignContextRef.set({ subEventId: context.subEvent.id, type });
    this.selectedAssignAssetIdsRef.set([...this.resolveSubEventAssignedAssetIds(context.subEvent.id, type)]);
    this.assetPopupService.setBasketVisible(true);
  }

  private closeAssignPopup(apply = false): void {
    if (apply) {
      this.applyAssignSelection();
    }
    this.assignContextRef.set(null);
    this.selectedAssignAssetIdsRef.set([]);
    this.assetPopupService.setBasketVisible(false);
  }

  private confirmAssignPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.selectedAssignAssetIdsRef().length === 0) {
      return;
    }
    this.closeAssignPopup(true);
  }

  private assignPopupTitle(): string {
    const context = this.assignContextRef();
    const popup = this.popupContextRef();
    if (!context || !popup) {
      return `Assign ${this.resourceFilterRef()}`;
    }
    const stageLabel = this.subEventStageLabel(popup.subEvent);
    return stageLabel ? `Assign ${context.type} - ${stageLabel}` : `Assign ${context.type}`;
  }

  private assignCandidates(): AppTypes.AssetCard[] {
    const context = this.assignContextRef();
    if (!context) {
      return [];
    }
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(context.subEventId, context.type));
    return this.ownedAssets.assetCards
      .filter(card => card.type === context.type)
      .sort((a, b) => {
        const aAssigned = assignedIds.has(a.id) ? 1 : 0;
        const bAssigned = assignedIds.has(b.id) ? 1 : 0;
        if (aAssigned !== bAssigned) {
          return bAssigned - aAssigned;
        }
        return a.title.localeCompare(b.title);
      });
  }

  private assignSelectedChips(): AppTypes.AssetCard[] {
    const selected = new Set(this.selectedAssignAssetIdsRef());
    return this.assignCandidates().filter(card => selected.has(card.id));
  }

  private toggleAssignCard(cardId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedAssignAssetIdsRef().includes(cardId)) {
      this.selectedAssignAssetIdsRef.set(this.selectedAssignAssetIdsRef().filter(id => id !== cardId));
      return;
    }
    this.selectedAssignAssetIdsRef.set([...this.selectedAssignAssetIdsRef(), cardId]);
  }

  private applyAssignSelection(): void {
    const context = this.assignContextRef();
    if (!context) {
      return;
    }
    const allowedIds = new Set(this.ownedAssets.assetCards.filter(card => card.type === context.type).map(card => card.id));
    const nextIds = this.selectedAssignAssetIdsRef().filter((id, index, arr) => allowedIds.has(id) && arr.indexOf(id) === index);
    const key = this.subEventAssetAssignmentKey(context.subEventId, context.type);
    const previousSettings = this.assignedAssetSettingsByKey[key] ?? {};
    const nextSettings: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
    for (const assetId of nextIds) {
      const source = this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === context.type);
      if (!source) {
        continue;
      }
      const previous = previousSettings[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax);
      nextSettings[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routes: this.normalizeAssetRoutes(context.type, previous?.routes)
      };
    }
    if (context.type === 'Supplies') {
      const removedIds = Object.keys(previousSettings).filter(assetId => !nextIds.includes(assetId));
      for (const assetId of removedIds) {
        delete this.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(context.subEventId, assetId)];
      }
    }
    this.assignedAssetIdsByKey[key] = [...nextIds];
    this.assignedAssetSettingsByKey[key] = nextSettings;
    this.syncPopupSubEventMetrics();
  }

  private resourceFilterCount(type: AppTypes.AssetType): number {
    const context = this.popupContextRef();
    if (!context) {
      return 0;
    }
    return this.subEventAssetCapacityMetrics(context.subEvent, type).pending;
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppTypes.AssetType): AppTypes.AssetCard[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type)
      .map(id => this.ownedAssets.assetCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
  }

  private getSubEventAssignedAssetSettings(subEventId: string, type: AppTypes.AssetType): Record<string, AppTypes.SubEventAssignedAssetSettings> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.assignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
    for (const assetId of assignedIds) {
      const source = this.ownedAssets.assetCards.find(card => card.id === assetId && card.type === type);
      if (!source) {
        continue;
      }
      const previous = existing[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax);
      next[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routes: this.normalizeAssetRoutes(type, previous?.routes)
      };
    }
    this.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppTypes.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id);
    const eligible = new Set(eligibleIds);
    const stored = this.assignedAssetIdsByKey[key];
    if (!stored) {
      this.assignedAssetIdsByKey[key] = [...eligibleIds];
      return [...eligibleIds];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length === 0 && eligibleIds.length > 0) {
      const existingSettings = this.assignedAssetSettingsByKey[key] ?? {};
      const settingIds = Object.keys(existingSettings).filter(id => eligible.has(id));
      const recovered = settingIds.length > 0 ? settingIds : eligibleIds;
      this.assignedAssetIdsByKey[key] = [...recovered];
      return [...recovered];
    }
    if (normalized.length !== stored.length) {
      this.assignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private seedAssignmentsFromRequest(
    subEventId: string,
    assetAssignmentIds: Partial<Record<AppTypes.AssetType, string[]>> | undefined,
    fallbackCardsByType: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): void {
    if (!subEventId || !assetAssignmentIds) {
      return;
    }
    const types: AppTypes.AssetType[] = ['Car', 'Accommodation', 'Supplies'];
    for (const type of types) {
      const raw = assetAssignmentIds[type];
      if (!Array.isArray(raw)) {
        continue;
      }
      const allowedIds = new Set([
        ...this.ownedAssets.assetCards.filter(card => card.type === type).map(card => card.id),
        ...(fallbackCardsByType[type] ?? []).map(card => card.id)
      ]);
      const normalized = raw.filter((id, index, arr): id is string =>
        typeof id === 'string' && arr.indexOf(id) === index && allowedIds.has(id)
      );
      this.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEventId, type)] = [...normalized];
    }
  }

  private subEventAssetCapacityMetrics(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType
  ): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = cards.reduce((sum, card) => sum + this.assetPendingCount(card), 0);
    if (type === 'Supplies') {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    const joinedIds = new Set<string>();
    for (const card of cards) {
      for (const request of card.requests) {
        if (request.status === 'accepted') {
          joinedIds.add(request.id);
        }
      }
    }
    return {
      joined: joinedIds.size,
      capacityMin,
      capacityMax,
      pending
    };
  }

  private syncPopupSubEventMetrics(): void {
    const context = this.popupContextRef();
    if (!context) {
      return;
    }
    const nextSubEvent = this.cloneSubEvent(context.subEvent);
    const cars = this.subEventAssetCapacityMetrics(nextSubEvent, 'Car');
    const accommodation = this.subEventAssetCapacityMetrics(nextSubEvent, 'Accommodation');
    const supplies = this.subEventAssetCapacityMetrics(nextSubEvent, 'Supplies');
    nextSubEvent.carsAccepted = cars.joined;
    nextSubEvent.carsPending = cars.pending;
    nextSubEvent.carsCapacityMin = cars.capacityMin;
    nextSubEvent.carsCapacityMax = cars.capacityMax;
    nextSubEvent.accommodationAccepted = accommodation.joined;
    nextSubEvent.accommodationPending = accommodation.pending;
    nextSubEvent.accommodationCapacityMin = accommodation.capacityMin;
    nextSubEvent.accommodationCapacityMax = accommodation.capacityMax;
    nextSubEvent.suppliesAccepted = supplies.joined;
    nextSubEvent.suppliesPending = supplies.pending;
    nextSubEvent.suppliesCapacityMin = supplies.capacityMin;
    nextSubEvent.suppliesCapacityMax = supplies.capacityMax;
    this.popupContextRef.set({
      ...context,
      subEvent: nextSubEvent
    });
    this.refreshEventChatSessionResourceContext(nextSubEvent);
  }

  private refreshEventChatSessionResourceContext(subEvent: AppTypes.SubEventFormItem): void {
    const context = this.popupContextRef();
    if (!context || context.origin !== 'chat') {
      return;
    }
    this.activitiesContext.touchEventChatSession(sessionContext => {
      if (sessionContext.subEvent?.id !== subEvent.id) {
        return sessionContext;
      }
      return {
        ...sessionContext,
        subEvent: this.cloneSubEvent(subEvent),
        assetAssignmentIds: {
          ...sessionContext.assetAssignmentIds,
          Car: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Car')],
          Accommodation: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Accommodation')],
          Supplies: [...this.resolveSubEventAssignedAssetIds(subEvent.id, 'Supplies')]
        },
        assetCardsByType: {
          Car: this.ownedAssets.assetCards.filter(card => card.type === 'Car').map(card => this.cloneAsset(card)),
          Accommodation: this.ownedAssets.assetCards.filter(card => card.type === 'Accommodation').map(card => this.cloneAsset(card)),
          Supplies: this.ownedAssets.assetCards.filter(card => card.type === 'Supplies').map(card => this.cloneAsset(card))
        },
        resources: sessionContext.resources.map(resource => ({ ...resource }))
      };
    });
  }

  private handleOwnedAssetDeleted(cardId: string): void {
    for (const key of Object.keys(this.supplyContributionEntriesByAssignmentKey)) {
      if (key.endsWith(`:${cardId}`)) {
        delete this.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const key of Object.keys(this.assignedAssetIdsByKey)) {
      this.assignedAssetIdsByKey[key] = this.assignedAssetIdsByKey[key].filter(id => id !== cardId);
    }
    for (const key of Object.keys(this.assignedAssetSettingsByKey)) {
      if (!this.assignedAssetSettingsByKey[key][cardId]) {
        continue;
      }
      const next = { ...this.assignedAssetSettingsByKey[key] };
      delete next[cardId];
      this.assignedAssetSettingsByKey[key] = next;
    }
    const supplyContext = this.supplyPopupRef();
    if (supplyContext?.assetId === cardId) {
      this.closeSupplyContributionsPopup();
    }
    this.syncPopupSubEventMetrics();
  }

  private handleOwnedAssetsChanged(): void {
    this.syncPopupSubEventMetrics();
  }

  private cloneSubEvent(subEvent: AppTypes.SubEventFormItem): AppTypes.SubEventFormItem {
    return {
      ...subEvent,
      groups: Array.isArray(subEvent.groups)
        ? subEvent.groups.map(group => ({ ...group }))
        : []
    };
  }

  private cloneAsset(card: AppTypes.AssetCard): AppTypes.AssetCard {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      requests: card.requests.map(request => ({ ...request }))
    };
  }

  private cloneFallbackCards(
    fallbackCardsByType?: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>>
  ): Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> {
    const next: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = fallbackCardsByType?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => this.cloneAsset(card));
    }
    return next;
  }

  private applyGroupScopedAssetSnapshot(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    group: { pending?: number; capacityMin?: number; capacityMax?: number }
  ): AppTypes.SubEventFormItem {
    const scopedPending = Number.isFinite(Number(group.pending)) ? Math.max(0, Math.trunc(Number(group.pending))) : undefined;
    const scopedMin = Number.isFinite(Number(group.capacityMin)) ? Math.max(0, Math.trunc(Number(group.capacityMin))) : undefined;
    const scopedMax = Number.isFinite(Number(group.capacityMax)) ? Math.max(0, Math.trunc(Number(group.capacityMax))) : undefined;
    if (type === 'Car') {
      return {
        ...subEvent,
        carsPending: scopedPending ?? subEvent.carsPending,
        carsCapacityMin: scopedMin ?? subEvent.carsCapacityMin,
        carsCapacityMax: scopedMax ?? subEvent.carsCapacityMax
      };
    }
    if (type === 'Accommodation') {
      return {
        ...subEvent,
        accommodationPending: scopedPending ?? subEvent.accommodationPending,
        accommodationCapacityMin: scopedMin ?? subEvent.accommodationCapacityMin,
        accommodationCapacityMax: scopedMax ?? subEvent.accommodationCapacityMax
      };
    }
    return {
      ...subEvent,
      suppliesPending: scopedPending ?? subEvent.suppliesPending,
      suppliesCapacityMin: scopedMin ?? subEvent.suppliesCapacityMin,
      suppliesCapacityMax: scopedMax ?? subEvent.suppliesCapacityMax
    };
  }

  private normalizeAssetRoutes(type: AppTypes.AssetType, routes: string[] | undefined | null): string[] {
    if (type === 'Supplies') {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === 'Accommodation') {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  private assetPendingCount(card: AppTypes.AssetCard): number {
    return card.requests.filter(request => request.status === 'pending').length;
  }

  private assetAcceptedCount(card: AppTypes.AssetCard): number {
    return card.requests.filter(request => request.status === 'accepted').length;
  }

  private subEventSupplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppTypes.SubEventSupplyContributionEntry[] {
    return this.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppTypes.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private subEventDisplayName(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    return `${subEvent?.name ?? ''}`.trim();
  }

  private subEventStageLabel(subEvent: AppTypes.SubEventFormItem | null | undefined): string {
    const name = this.subEventDisplayName(subEvent);
    return name || 'Sub Event';
  }

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!target || typeof window === 'undefined') {
      return false;
    }
    const rect = target.getBoundingClientRect();
    return rect.bottom > window.innerHeight - 180;
  }

  private isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  private openGoogleMapsDirections(stops: string[]): void {
    const normalized = stops.map(stop => stop.trim()).filter(Boolean);
    if (normalized.length === 0 || typeof window === 'undefined') {
      return;
    }
    if (normalized.length === 1) {
      this.openGoogleMapsSearch(normalized[0]);
      return;
    }
    const origin = normalized[0];
    const destination = normalized[normalized.length - 1];
    const waypoints = normalized.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

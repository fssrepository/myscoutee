import { Injectable, Type, signal } from '@angular/core';

import type * as AppConstants from '../../../core/common/constants';
import type * as AppDTOs from '../../../core/contracts';
import type * as ContractTypes from '../../../core/contracts';

export type ResourceAssetDTO = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  description?: string;
  details?: string;
  sourceLink?: string;
  routes?: string[];
  topics?: string[];
  policies?: AppDTOs.EventPolicyItemDTO[];
  pricing?: AppDTOs.PricingConfig | null;
  locationLabel?: string;
  priceLabel?: string;
  policyCount?: number;
};

export interface ResourceAssetViewState {
  card: AppDTOs.SubEventResourceCardDTO;
  mode: 'view' | 'edit';
  source: ResourceAssetDTO | null;
  memberLabel: string;
  memberCount: number;
  pendingCount: number;
  canOpenMembers: boolean;
  canEditCapacity: boolean;
  canEditRoute: boolean;
}

export interface ResourceAssetViewRequest {
  view: ResourceAssetViewState;
  sourceEvent: Event;
}

interface OutletActionRequest {
  requestId: number;
}

type ResourceAssetViewOutletContext = 'resourcePopup' | 'assetExplore';

export type EventResourcePopupOutletActionRequest =
  | (OutletActionRequest & { kind: 'assetViewClose'; event?: Event })
  | (OutletActionRequest & { kind: 'assetViewMembers'; view: ResourceAssetViewState; event: Event })
  | (OutletActionRequest & { kind: 'assetViewRouteView'; view: ResourceAssetViewState; event: Event })
  | (OutletActionRequest & { kind: 'assetViewRouteSetup'; view: ResourceAssetViewState; event: Event })
  | (OutletActionRequest & { kind: 'capacityEditorClose'; event?: Event })
  | (OutletActionRequest & { kind: 'capacityEditorSave'; event?: Event })
  | (OutletActionRequest & { kind: 'routeEditorClose'; event?: Event })
  | (OutletActionRequest & { kind: 'routeEditorSave'; event?: Event })
  | (OutletActionRequest & { kind: 'assignedAssetJoinClose'; event?: Event })
  | (OutletActionRequest & { kind: 'assignedAssetJoinPolicyToggle'; policyId: string })
  | (OutletActionRequest & { kind: 'assignedAssetJoinConfirm'; event?: Event });

export type EventResourceAssetExploreOutletActionRequest =
  | (OutletActionRequest & { kind: 'assetViewClose'; event?: Event })
  | (OutletActionRequest & { kind: 'assetViewRouteView'; request: ResourceAssetViewRequest })
  | (OutletActionRequest & { kind: 'borrowDialogClose'; event?: Event })
  | (OutletActionRequest & { kind: 'borrowDialogBack'; event?: Event })
  | (OutletActionRequest & { kind: 'borrowDateRangeChange'; start: Date | null; end: Date | null })
  | (OutletActionRequest & { kind: 'borrowTimeChange'; edge: 'start' | 'end'; value: string })
  | (OutletActionRequest & { kind: 'borrowQuantityChange'; value: number | string })
  | (OutletActionRequest & { kind: 'borrowQuantityBlur'; value: number | string })
  | (OutletActionRequest & { kind: 'borrowPolicyToggle'; policyId: string })
  | (OutletActionRequest & { kind: 'borrowConfirm'; event?: Event });

export interface ResourcePopupContext {
  origin: 'chat' | 'eventEditor';
  ownerId: string;
  parentTitle: string;
  subEvent: ContractTypes.SubEventDTO;
  groupId?: string;
  groupName?: string;
  fallbackCardsByType: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>;
}

export interface CapacityEditorState {
  subEventId: string;
  type: AppConstants.AssetType;
  assetId: string;
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
  busy: boolean;
  error: string | null;
}

export interface RouteEditorState {
  subEventId: string;
  type: 'Car';
  assetId: string;
  title: string;
  mode: 'view' | 'edit';
  routes: string[];
  routeRowIds: string[];
  busy: boolean;
  error: string | null;
}

export interface SupplyContributionPopupState {
  subEventId: string;
  assetId: string;
  title: string;
}

export interface PendingAssignSaveState {
  subEventId: string;
  type: AppConstants.AssetType;
  busy: boolean;
  error: string | null;
}

export interface AssetExplorePopupState {
  subEventId: string;
  type: AppConstants.AssetType;
  category: AppConstants.AssetCategory;
  startAtIso: string;
  endAtIso: string;
  loading: boolean;
  error: string | null;
  cards: ResourceAssetDTO[];
}

export interface AssetExploreBorrowDialogState {
  cardId: string;
  ownerUserId: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  availableQuantity: number;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentStep: boolean;
  busy: boolean;
  error: string | null;
}

export interface AssignedAssetJoinDialogState {
  cardId: string;
  type: 'Car' | 'Accommodation';
  sourceAssetId: string;
  acceptedPolicyIds: string[];
  busy: boolean;
  error: string | null;
}

export interface AssetExploreBorrowDraftState {
  userId: string;
  subEventId: string;
  cardId: string;
  ownerUserId: string;
  title: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentStep: boolean;
  updatedAtMs: number;
}

export interface AssetExploreBorrowPricingPreview {
  amount: number;
  currency: string;
}

export interface SupplyBringDialogState {
  subEventId: string;
  cardId: string;
  title: string;
  quantity: number;
  min: number;
  max: number;
  busy: boolean;
  error: string | null;
}

export interface AssignedAssetJoinPricingPreview {
  totalAmount: number;
  shareAmount: number;
  shareMemberCount: number;
  currency: string;
  chargeType: AppConstants.PricingChargeType | null;
}

@Injectable({
  providedIn: 'root'
})
export class SubEventResourcePopupStore {
  readonly assignedAssetIdsByKey: Record<string, string[]> = {};
  readonly assignedAssetSettingsByKey: Record<string, Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO>> = {};
  readonly supplyContributionEntriesByAssignmentKey: Record<string, AppDTOs.SubEventSupplyContributionEntryDTO[]> = {};

  readonly popupContextRef = signal<ResourcePopupContext | null>(null);
  readonly resourceFilterRef = signal<AppConstants.AssetType>('Car');
  readonly resourceAssetViewIdRef = signal<string | null>(null);
  readonly resourceAssetViewModeRef = signal<'view' | 'edit'>('view');
  readonly resourceAssetViewReturnToChatRef = signal(false);
  readonly capacityEditorRef = signal<CapacityEditorState | null>(null);
  readonly routeEditorRef = signal<RouteEditorState | null>(null);
  readonly supplyPopupRef = signal<SupplyContributionPopupState | null>(null);
  readonly bringDialogRef = signal<SupplyBringDialogState | null>(null);
  readonly pendingAssignSaveRef = signal<PendingAssignSaveState | null>(null);
  readonly assetExplorePopupRef = signal<AssetExplorePopupState | null>(null);
  readonly assetExploreAssetViewIdRef = signal<string | null>(null);
  readonly assetExploreOnlyRef = signal(false);
  readonly assetExploreBorrowDialogRef = signal<AssetExploreBorrowDialogState | null>(null);
  readonly assignedAssetJoinDialogRef = signal<AssignedAssetJoinDialogState | null>(null);
  readonly assetExploreBorrowDraftsRef = signal<Record<string, AssetExploreBorrowDraftState>>({});
  readonly assignContextRef = signal<{ subEventId: string; type: AppConstants.AssetType } | null>(null);
  readonly selectedAssignAssetIdsRef = signal<string[]>([]);
  private readonly eventResourcePopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetExploreComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventSupplyContributionsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetViewComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceCapacityEditorComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceRouteEditorComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssignedAssetJoinDialogComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetExploreBorrowDialogComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourcePopupOutletActionRequestRef = signal<EventResourcePopupOutletActionRequest | null>(null);
  private readonly eventResourceAssetExploreOutletActionRequestRef = signal<EventResourceAssetExploreOutletActionRequest | null>(null);
  private outletActionRequestSequence = 0;

  readonly eventResourcePopupComponent = this.eventResourcePopupComponentRef.asReadonly();
  readonly eventResourceAssetExploreComponent = this.eventResourceAssetExploreComponentRef.asReadonly();
  readonly eventSupplyContributionsPopupComponent = this.eventSupplyContributionsPopupComponentRef.asReadonly();
  readonly eventResourceAssetViewComponent = this.eventResourceAssetViewComponentRef.asReadonly();
  readonly eventResourceCapacityEditorComponent = this.eventResourceCapacityEditorComponentRef.asReadonly();
  readonly eventResourceRouteEditorComponent = this.eventResourceRouteEditorComponentRef.asReadonly();
  readonly eventResourceAssignedAssetJoinDialogComponent = this.eventResourceAssignedAssetJoinDialogComponentRef.asReadonly();
  readonly eventResourceAssetExploreBorrowDialogComponent = this.eventResourceAssetExploreBorrowDialogComponentRef.asReadonly();
  readonly eventResourcePopupOutletActionRequest = this.eventResourcePopupOutletActionRequestRef.asReadonly();
  readonly eventResourceAssetExploreOutletActionRequest = this.eventResourceAssetExploreOutletActionRequestRef.asReadonly();

  openResourcePopup(context: ResourcePopupContext, type: AppConstants.AssetType): void {
    this.popupContextRef.set(context);
    this.resourceFilterRef.set(type);
    this.resetResourcePopupState();
  }

  closeResourcePopup(): void {
    this.popupContextRef.set(null);
    this.resetResourcePopupState();
  }

  resetResourcePopupState(): void {
    this.resourceAssetViewIdRef.set(null);
    this.resourceAssetViewModeRef.set('view');
    this.resourceAssetViewReturnToChatRef.set(false);
    this.capacityEditorRef.set(null);
    this.routeEditorRef.set(null);
    this.supplyPopupRef.set(null);
    this.bringDialogRef.set(null);
    this.assignedAssetJoinDialogRef.set(null);
    this.assetExploreBorrowDialogRef.set(null);
    this.assetExplorePopupRef.set(null);
    this.assetExploreAssetViewIdRef.set(null);
    this.assetExploreOnlyRef.set(false);
  }

  assetAssignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return `${subEventId}:${type}`;
  }

  supplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  supplyContributionEntries(subEventId: string, cardId: string): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    return this.supplyContributionEntriesByAssignmentKey[this.supplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  requestResourceAssetViewClose(event?: Event): void {
    const resolvedContext = this.resolveAssetViewOutletContext();
    if (!resolvedContext) {
      return;
    }
    if (resolvedContext === 'assetExplore') {
      this.eventResourceAssetExploreOutletActionRequestRef.set({
        requestId: this.nextOutletActionRequestId(),
        kind: 'assetViewClose',
        event
      });
      return;
    }
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assetViewClose',
      event
    });
  }

  requestResourceAssetViewMembers(view: ResourceAssetViewState, event: Event): void {
    if (this.resolveAssetViewOutletContext() !== 'resourcePopup') {
      return;
    }
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assetViewMembers',
      view,
      event
    });
  }

  requestResourceAssetViewRouteView(view: ResourceAssetViewState, event: Event): void {
    const resolvedContext = this.resolveAssetViewOutletContext();
    if (!resolvedContext) {
      return;
    }
    if (resolvedContext === 'assetExplore') {
      this.eventResourceAssetExploreOutletActionRequestRef.set({
        requestId: this.nextOutletActionRequestId(),
        kind: 'assetViewRouteView',
        request: { view, sourceEvent: event }
      });
      return;
    }
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assetViewRouteView',
      view,
      event
    });
  }

  requestResourceAssetViewRouteSetup(view: ResourceAssetViewState, event: Event): void {
    if (this.resolveAssetViewOutletContext() !== 'resourcePopup') {
      return;
    }
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assetViewRouteSetup',
      view,
      event
    });
  }

  requestCapacityEditorClose(event?: Event): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'capacityEditorClose',
      event
    });
  }

  requestCapacityEditorSave(event?: Event): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'capacityEditorSave',
      event
    });
  }

  requestRouteEditorClose(event?: Event): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'routeEditorClose',
      event
    });
  }

  requestRouteEditorSave(event?: Event): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'routeEditorSave',
      event
    });
  }

  requestAssignedAssetJoinClose(event?: Event): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assignedAssetJoinClose',
      event
    });
  }

  requestAssignedAssetJoinPolicyToggle(policyId: string): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assignedAssetJoinPolicyToggle',
      policyId
    });
  }

  requestAssignedAssetJoinConfirm(event?: Event): void {
    this.eventResourcePopupOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'assignedAssetJoinConfirm',
      event
    });
  }

  requestBorrowDialogClose(event?: Event): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowDialogClose',
      event
    });
  }

  requestBorrowDialogBack(event?: Event): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowDialogBack',
      event
    });
  }

  requestBorrowDateRangeChange(start: Date | null, end: Date | null): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowDateRangeChange',
      start,
      end
    });
  }

  requestBorrowTimeChange(edge: 'start' | 'end', value: string): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowTimeChange',
      edge,
      value
    });
  }

  requestBorrowQuantityChange(value: number | string): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowQuantityChange',
      value
    });
  }

  requestBorrowQuantityBlur(value: number | string): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowQuantityBlur',
      value
    });
  }

  requestBorrowPolicyToggle(policyId: string): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowPolicyToggle',
      policyId
    });
  }

  requestBorrowConfirm(event?: Event): void {
    this.eventResourceAssetExploreOutletActionRequestRef.set({
      requestId: this.nextOutletActionRequestId(),
      kind: 'borrowConfirm',
      event
    });
  }

  async ensureEventResourcePopupLoaded(): Promise<void> {
    if (this.eventResourcePopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/event-resource-popup.component');
    this.eventResourcePopupComponentRef.set(module.EventResourcePopupComponent);
  }

  async ensureEventResourceAssetExploreLoaded(): Promise<void> {
    if (this.eventResourceAssetExploreComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/asset-explore/event-resource-asset-explore.component');
    this.eventResourceAssetExploreComponentRef.set(module.EventResourceAssetExploreComponent);
  }

  async ensureEventSupplyContributionsPopupLoaded(): Promise<void> {
    if (this.eventSupplyContributionsPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-supply-contributions-popup/event-supply-contributions-popup.component');
    this.eventSupplyContributionsPopupComponentRef.set(module.EventSupplyContributionsPopupComponent);
  }

  async ensureEventResourceAssetViewLoaded(): Promise<void> {
    if (this.eventResourceAssetViewComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/asset-view/event-resource-asset-view.component');
    this.eventResourceAssetViewComponentRef.set(module.EventResourceAssetViewComponent);
  }

  async ensureEventResourceCapacityEditorLoaded(): Promise<void> {
    if (this.eventResourceCapacityEditorComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/capacity-editor/event-resource-capacity-editor.component');
    this.eventResourceCapacityEditorComponentRef.set(module.EventResourceCapacityEditorComponent);
  }

  async ensureEventResourceRouteEditorLoaded(): Promise<void> {
    if (this.eventResourceRouteEditorComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/route-editor/event-resource-route-editor.component');
    this.eventResourceRouteEditorComponentRef.set(module.EventResourceRouteEditorComponent);
  }

  async ensureEventResourceAssignedAssetJoinDialogLoaded(): Promise<void> {
    if (this.eventResourceAssignedAssetJoinDialogComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/assigned-asset-join-dialog/event-resource-assigned-asset-join-dialog.component');
    this.eventResourceAssignedAssetJoinDialogComponentRef.set(module.EventResourceAssignedAssetJoinDialogComponent);
  }

  async ensureEventResourceAssetExploreBorrowDialogLoaded(): Promise<void> {
    if (this.eventResourceAssetExploreBorrowDialogComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-resource-popup/asset-explore-borrow-dialog/event-resource-asset-explore-borrow-dialog.component');
    this.eventResourceAssetExploreBorrowDialogComponentRef.set(module.EventResourceAssetExploreBorrowDialogComponent);
  }

  private nextOutletActionRequestId(): number {
    this.outletActionRequestSequence += 1;
    return this.outletActionRequestSequence;
  }

  private resolveAssetViewOutletContext(): ResourceAssetViewOutletContext | null {
    if (this.assetExploreAssetViewIdRef()) {
      return 'assetExplore';
    }
    if (this.resourceAssetViewIdRef()) {
      return 'resourcePopup';
    }
    return null;
  }
}

import { Injectable, Type, computed, signal } from '@angular/core';

import * as AppConstants from '../../../core/common/constants';
import type * as AppDTOs from '../../../core/contracts';
import type * as ContractTypes from '../../../core/contracts';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';

export type ResourceAssetDTO = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  description?: string;
  details?: string;
  sourceLink?: string;
  routes?: string[];
  topics?: string[];
  policiesEnabled?: boolean;
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
}

interface OutletActionRequest {
  requestId: number;
}

type ResourceAssetViewOutletContext = 'resourcePopup' | 'assetExplore';

export type EventResourcePopupOutletActionRequest =
  | (OutletActionRequest & { kind: 'assetViewClose'; event?: Event })
  | (OutletActionRequest & { kind: 'assetViewMembers'; view: ResourceAssetViewState; event: Event })
  | (OutletActionRequest & { kind: 'capacityEditorClose'; event?: Event })
  | (OutletActionRequest & { kind: 'capacityEditorSave'; event?: Event })
  | (OutletActionRequest & { kind: 'assignedAssetJoinClose'; event?: Event })
  | (OutletActionRequest & { kind: 'assignedAssetJoinPolicyToggle'; policyId: string })
  | (OutletActionRequest & { kind: 'assignedAssetJoinConfirm'; event?: Event });

export type EventResourceAssetExploreOutletActionRequest =
  | (OutletActionRequest & { kind: 'assetViewClose'; event?: Event })
  | (OutletActionRequest & { kind: 'borrowDialogClose'; event?: Event })
  | (OutletActionRequest & { kind: 'borrowDialogBack'; event?: Event })
  | (OutletActionRequest & { kind: 'borrowDateRangeChange'; start: Date | null; end: Date | null })
  | (OutletActionRequest & { kind: 'borrowTimeChange'; edge: 'start' | 'end'; value: string })
  | (OutletActionRequest & { kind: 'borrowQuantityChange'; value: number | string })
  | (OutletActionRequest & { kind: 'borrowQuantityBlur'; value: number | string })
  | (OutletActionRequest & { kind: 'borrowPolicyToggle'; policyId: string })
  | (OutletActionRequest & { kind: 'borrowConfirm'; event?: Event });

export interface ResourcePopupContext {
  origin: 'chat' | 'subEventResource';
  ownerId: string;
  parentTitle: string;
  popupHeader?: SubEventResourcePopupPresentationHeader | null;
  subEvent: ContractTypes.SubEventDTO;
  groupId?: string;
  groupName?: string;
  fallbackCardsByType: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>;
}

export type SubEventResourcePopupType = AppConstants.SubEventResourceFilter;

export interface SubEventResourcePopupPresentationHeader {
  title: string;
  subtitle?: string | null;
}

export interface SubEventResourcePopupHeader {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}

export interface SubEventResourcePopupRequest {
  type: SubEventResourcePopupType;
  ownerId: string;
  subEventId?: string | null;
  subEventIndex?: number | null;
  subEventHeader?: SubEventResourcePopupHeader | null;
  popupHeader?: SubEventResourcePopupPresentationHeader | null;
  parentTitle?: string;
  group?: {
    id?: string | null;
    groupLabel?: string;
    source?: string | null;
    pending?: number;
    accepted?: number;
    capacityMin?: number;
    capacityMax?: number;
    canManage?: boolean;
    members?: readonly ActivityMemberDTO[];
    onMembersChanged?: (members: readonly ActivityMemberDTO[]) => void;
  } | null;
}

export interface SubEventResourceMetricsUpdate {
  revision: number;
  ownerId: string;
  subEventId: string;
  subEvent: ContractTypes.SubEventDTO;
  assignmentQuantityUpdates?: readonly SubEventResourceAssignmentQuantityUpdate[];
}

export interface SubEventResourceAssignmentQuantityUpdate {
  assetId: string;
  type: AppConstants.AssetType;
  subEventId: string;
  quantity: number;
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
  type: typeof AppConstants.ASSET_TYPE_TRANSPORT | typeof AppConstants.ASSET_TYPE_ACCOMMODATION;
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
  readonly resourceFilterRef = signal<AppConstants.AssetType>(AppConstants.ASSET_TYPE_TRANSPORT);
  readonly resourceAssetViewIdRef = signal<string | null>(null);
  readonly resourceAssetViewModeRef = signal<'view' | 'edit'>('view');
  readonly resourceAssetViewReturnToChatRef = signal(false);
  readonly capacityEditorRef = signal<CapacityEditorState | null>(null);
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
  private readonly subEventResourcePopupRequestRef = signal<SubEventResourcePopupRequest | null>(null);
  private readonly eventResourcePopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetExploreComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventSupplyContributionsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetViewComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceCapacityEditorComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssignedAssetJoinDialogComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetExploreBorrowDialogComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourcePopupOutletActionRequestRef = signal<EventResourcePopupOutletActionRequest | null>(null);
  private readonly eventResourceAssetExploreOutletActionRequestRef = signal<EventResourceAssetExploreOutletActionRequest | null>(null);
  private readonly resourceMetricsRevisionRef = signal(0);
  private readonly subEventResourceMetricsUpdateRef = signal<SubEventResourceMetricsUpdate | null>(null);
  private outletActionRequestSequence = 0;

  readonly eventResourcePopupComponent = this.eventResourcePopupComponentRef.asReadonly();
  readonly eventResourceAssetExploreComponent = this.eventResourceAssetExploreComponentRef.asReadonly();
  readonly eventSupplyContributionsPopupComponent = this.eventSupplyContributionsPopupComponentRef.asReadonly();
  readonly eventResourceAssetViewComponent = this.eventResourceAssetViewComponentRef.asReadonly();
  readonly eventResourceCapacityEditorComponent = this.eventResourceCapacityEditorComponentRef.asReadonly();
  readonly eventResourceAssignedAssetJoinDialogComponent = this.eventResourceAssignedAssetJoinDialogComponentRef.asReadonly();
  readonly eventResourceAssetExploreBorrowDialogComponent = this.eventResourceAssetExploreBorrowDialogComponentRef.asReadonly();
  readonly eventResourcePopupOutletActionRequest = this.eventResourcePopupOutletActionRequestRef.asReadonly();
  readonly eventResourceAssetExploreOutletActionRequest = this.eventResourceAssetExploreOutletActionRequestRef.asReadonly();
  readonly subEventResourcePopupRequest = this.subEventResourcePopupRequestRef.asReadonly();
  readonly assetViewOutletContext = computed(() => this.resolveAssetViewOutletContext());
  readonly resourceMetricsRevision = this.resourceMetricsRevisionRef.asReadonly();
  readonly subEventResourceMetricsUpdate = this.subEventResourceMetricsUpdateRef.asReadonly();

  requestSubEventResourcePopup(request: SubEventResourcePopupRequest): void {
    this.subEventResourcePopupRequestRef.set(request);
  }

  clearSubEventResourcePopupRequest(): void {
    this.subEventResourcePopupRequestRef.set(null);
  }

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

  publishSubEventResourceMetrics(
    context: ResourcePopupContext,
    options: {
      assignmentQuantityUpdates?: readonly SubEventResourceAssignmentQuantityUpdate[];
    } = {}
  ): void {
    const revision = this.resourceMetricsRevisionRef() + 1;
    this.resourceMetricsRevisionRef.set(revision);
    this.subEventResourceMetricsUpdateRef.set({
      revision,
      ownerId: context.ownerId,
      subEventId: context.subEvent.id,
      subEvent: { ...context.subEvent },
      assignmentQuantityUpdates: [...(options.assignmentQuantityUpdates ?? [])]
    });
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

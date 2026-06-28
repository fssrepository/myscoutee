import { Injectable, Type, signal } from '@angular/core';

import type * as AppConstants from '../../../core/common/constants';
import type * as AppDTOs from '../../../core/contracts';
import type {
  AssetExploreBorrowDialogState,
  AssetExploreBorrowDraftState,
  AssetExplorePopupState,
  AssignedAssetJoinDialogState,
  CapacityEditorState,
  PendingAssignSaveState,
  ResourcePopupContext,
  RouteEditorState,
  SupplyContributionPopupState,
  SupplyBringDialogState
} from '../sub-event-resource-popup.types';

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
  readonly assetExploreOnlyRef = signal(false);
  readonly assetExploreBorrowDialogRef = signal<AssetExploreBorrowDialogState | null>(null);
  readonly assignedAssetJoinDialogRef = signal<AssignedAssetJoinDialogState | null>(null);
  readonly assetExploreBorrowDraftsRef = signal<Record<string, AssetExploreBorrowDraftState>>({});
  readonly assignContextRef = signal<{ subEventId: string; type: AppConstants.AssetType } | null>(null);
  readonly selectedAssignAssetIdsRef = signal<string[]>([]);
  private readonly eventResourcePopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourceAssetExploreComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventSupplyContributionsPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly eventResourcePopupComponent = this.eventResourcePopupComponentRef.asReadonly();
  readonly eventResourceAssetExploreComponent = this.eventResourceAssetExploreComponentRef.asReadonly();
  readonly eventSupplyContributionsPopupComponent = this.eventSupplyContributionsPopupComponentRef.asReadonly();

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
}

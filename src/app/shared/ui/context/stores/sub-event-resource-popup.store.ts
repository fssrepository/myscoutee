import { Injectable, signal } from '@angular/core';

import type * as AppConstants from '../../../core/common/constants';
import type {
  AssetExploreBorrowDialogState,
  AssetExploreBorrowDraftState,
  AssetExplorePopupState,
  AssignedAssetJoinDialogState,
  CapacityEditorState,
  PendingAssignSaveState,
  PendingResourceDeleteState,
  PendingSupplyDeleteState,
  ResourcePopupContext,
  RouteEditorState,
  SupplyContributionPopupState,
  SupplyBringDialogState
} from '../sub-event-resource-popup.types';

@Injectable({
  providedIn: 'root'
})
export class SubEventResourcePopupStore {
  readonly popupContextRef = signal<ResourcePopupContext | null>(null);
  readonly resourceFilterRef = signal<AppConstants.AssetType>('Car');
  readonly resourceAssetViewIdRef = signal<string | null>(null);
  readonly resourceAssetViewModeRef = signal<'view' | 'edit'>('view');
  readonly resourceAssetViewReturnToChatRef = signal(false);
  readonly capacityEditorRef = signal<CapacityEditorState | null>(null);
  readonly routeEditorRef = signal<RouteEditorState | null>(null);
  readonly supplyPopupRef = signal<SupplyContributionPopupState | null>(null);
  readonly bringDialogRef = signal<SupplyBringDialogState | null>(null);
  readonly pendingSupplyDeleteRef = signal<PendingSupplyDeleteState | null>(null);
  readonly pendingResourceDeleteRef = signal<PendingResourceDeleteState | null>(null);
  readonly pendingAssignSaveRef = signal<PendingAssignSaveState | null>(null);
  readonly assetExplorePopupRef = signal<AssetExplorePopupState | null>(null);
  readonly assetExploreOnlyRef = signal(false);
  readonly assetExploreBorrowDialogRef = signal<AssetExploreBorrowDialogState | null>(null);
  readonly assignedAssetJoinDialogRef = signal<AssignedAssetJoinDialogState | null>(null);
  readonly assetExploreBorrowDraftsRef = signal<Record<string, AssetExploreBorrowDraftState>>({});
  readonly assignContextRef = signal<{ subEventId: string; type: AppConstants.AssetType } | null>(null);
  readonly selectedAssignAssetIdsRef = signal<string[]>([]);
}

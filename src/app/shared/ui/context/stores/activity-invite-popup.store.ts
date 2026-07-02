import {
  Injectable,
  Type,
  signal
} from '@angular/core';

import type { ActivityMemberOwnerType } from '../../../core/common/constants';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';

export interface ActivityInvitePopupState {
  updatedMs: number;
  ownerId: string;
  ownerType?: ActivityMemberOwnerType;
  title?: string;
  initialCandidates?: readonly ActivityMemberDTO[];
  initialSelection?: readonly ActivityMemberDTO[];
  onApply?: (selectedCandidates: readonly ActivityMemberDTO[]) => void | Promise<void>;
  closeOwnerPopupOnClose?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityInvitePopupStore {
  private readonly activityInvitePopupRef = signal<ActivityInvitePopupState | null>(null);
  private readonly assetMemberPickerPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly activityInvitePopup = this.activityInvitePopupRef.asReadonly();
  readonly assetMemberPickerPopupComponent = this.assetMemberPickerPopupComponentRef.asReadonly();

  openActivityInvitePopup(payload: {
    ownerId: string;
    ownerType?: ActivityMemberOwnerType;
    title?: string;
    initialCandidates?: readonly ActivityMemberDTO[];
    initialSelection?: readonly ActivityMemberDTO[];
    onApply?: (selectedCandidates: readonly ActivityMemberDTO[]) => void | Promise<void>;
    closeOwnerPopupOnClose?: boolean;
  }): void {
    const normalizedOwnerId = payload.ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    this.activityInvitePopupRef.set({
      updatedMs: Date.now(),
      ownerId: normalizedOwnerId,
      ownerType: payload.ownerType === 'asset' || payload.ownerType === 'group' || payload.ownerType === 'subEvent'
        ? payload.ownerType
        : 'event',
      title: payload.title?.trim() || undefined,
      initialCandidates: Array.isArray(payload.initialCandidates)
        ? payload.initialCandidates.map(candidate => ({ ...candidate }))
        : undefined,
      initialSelection: Array.isArray(payload.initialSelection)
        ? payload.initialSelection.map(candidate => ({ ...candidate }))
        : undefined,
      onApply: payload.onApply,
      closeOwnerPopupOnClose: payload.closeOwnerPopupOnClose === true
    });
  }

  closeActivityInvitePopup(): void {
    this.activityInvitePopupRef.set(null);
  }

  async ensureAssetMemberPickerPopupLoaded(): Promise<void> {
    if (this.assetMemberPickerPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../asset/components/asset-member-picker-popup/asset-member-picker-popup.component');
    this.assetMemberPickerPopupComponentRef.set(module.AssetMemberPickerPopupComponent);
  }
}

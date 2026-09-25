import {
  Injectable,
  Type,
  signal
} from '@angular/core';

import type { ActivityMemberOwnerType } from '../../../core/common/constants';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';
import type { ActivityMembersInviteResultDTO } from '../../../core/contracts/activity.interface';

export interface ActivityInvitePopupState {
  updatedMs: number;
  ownerId: string;
  ownerType?: ActivityMemberOwnerType;
  parentOwner?: { ownerId: string; ownerType: ActivityMemberOwnerType } | null;
  title?: string;
  initialCandidates?: readonly ActivityMemberDTO[];
  selectionLimit?: number;
  parentZIndex?: number;
  initialSelection?: readonly ActivityMemberDTO[];
  onApply?: (selectedCandidates: readonly ActivityMemberDTO[]) => ActivityMembersInviteResultDTO | void | Promise<ActivityMembersInviteResultDTO | void>;
  closeOwnerPopupOnClose?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityInvitePopupStore {
  readonly externalInvite = signal<{ ownerType: 'event' | 'community' | 'asset'; entityId: string; title: string; userId: string; assetType?: import('../../../core/common/constants').AssetType } | null>(null);
  readonly externalInviteComponent = signal<Type<unknown> | null>(null);
  async openExternalInvitePopup(ownerType: 'event' | 'community' | 'asset', entityId: string, title: string, userId: string, assetType?: import('../../../core/common/constants').AssetType): Promise<void> {
    this.externalInvite.set({ ownerType, entityId, title, userId, assetType });
    if (!this.externalInviteComponent()) {
      const module = await import('../../components/external-invite-popup/external-invite-popup.component');
      this.externalInviteComponent.set(module.ExternalInvitePopupComponent);
    }
  }

  private readonly activityInvitePopupRef = signal<ActivityInvitePopupState | null>(null);
  private readonly assetMemberPickerPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly activityInvitePopup = this.activityInvitePopupRef.asReadonly();
  readonly assetMemberPickerPopupComponent = this.assetMemberPickerPopupComponentRef.asReadonly();

  openActivityInvitePopup(payload: {
    ownerId: string;
    ownerType?: ActivityMemberOwnerType;
    parentOwner?: { ownerId: string; ownerType: ActivityMemberOwnerType } | null;
    title?: string;
    initialCandidates?: readonly ActivityMemberDTO[];
    selectionLimit?: number;
    parentZIndex?: number;
    initialSelection?: readonly ActivityMemberDTO[];
    onApply?: (selectedCandidates: readonly ActivityMemberDTO[]) => ActivityMembersInviteResultDTO | void | Promise<ActivityMembersInviteResultDTO | void>;
    closeOwnerPopupOnClose?: boolean;
  }): void {
    const normalizedOwnerId = payload.ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    this.activityInvitePopupRef.set({
      updatedMs: Date.now(),
      ownerId: normalizedOwnerId,
      ownerType: payload.ownerType === 'community' || payload.ownerType === 'asset' || payload.ownerType === 'group' || payload.ownerType === 'subEvent'
        ? payload.ownerType
        : 'event',
      parentOwner: payload.parentOwner?.ownerId?.trim()
        ? {
            ownerId: payload.parentOwner.ownerId.trim(),
            ownerType: payload.parentOwner.ownerType
          }
        : null,
      title: payload.title?.trim() || undefined,
      selectionLimit: payload.selectionLimit,
      parentZIndex: payload.parentZIndex,
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

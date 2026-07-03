import {
  Injectable,
  signal
} from '@angular/core';

import type {
  ActivityMemberOwnerType,
  AssetFilterType,
  AssetType,
  SubEventResourceFilter
} from '../../../core/common/constants';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';
import type { ChatDTO } from '../../../core/contracts/chat.interface';
import type { AssetDTO } from '../../../core/contracts';
import type { EventEditorTarget, SubEventDTO } from '../../../core/contracts/event.interface';
import type { PopupHeaderLookup } from '../../models';
import type { ResourceAssetDTO } from './sub-event-resource-popup.store';

export interface NavigatorActivitiesRequest {
  updatedMs: number;
  primaryFilter: 'rates' | 'chats' | 'events';
  eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash';
  adminServiceOnly?: boolean;
}

export interface NavigatorAssetRequest {
  updatedMs: number;
  assetFilter: AssetFilterType;
}

export interface NavigatorEventFeedbackRequest {
  updatedMs: number;
}

export type ActivitiesNavigationRequest =
  | { type: 'eventExplore'; stacked?: boolean }
  | { type: 'eventCheckoutDraft'; sourceId: string }
  | { type: 'assetExplore'; assetType?: AssetType; assetId?: string; viewOnly?: boolean; fallbackAsset?: AssetDTO }
  | {
      type: 'chatResource';
      ownerId?: string;
      item: ChatDTO;
      resourceType: SubEventResourceFilter;
      subEvent: SubEventDTO;
      group?: { id: string; groupLabel: string } | null;
      assetAssignmentIds?: Partial<Record<AssetType, string[]>>;
      assetCardsByType?: Partial<Record<AssetType, ResourceAssetDTO[]>>;
      openExplore?: boolean;
      assetViewId?: string;
    }
  | {
      type: 'members';
      ownerId: string;
      ownerType?: ActivityMemberOwnerType;
      subtitle?: string;
      canManage?: boolean;
      viewOnly?: boolean;
      acceptedMembers?: number;
      pendingMembers?: number;
      capacityTotal?: number;
      members?: readonly ActivityMemberDTO[];
      metricIdentity?: string;
      lookup?: PopupHeaderLookup;
      onMembersChanged?: (members: readonly ActivityMemberDTO[]) => void;
    }
  | { type: 'eventEditorMembers'; ownerId: string; title?: string; canManage?: boolean }
  | { type: 'eventEditorCreate'; target: EventEditorTarget }
  | { type: 'eventEditor'; eventId: string; target: EventEditorTarget; readOnly: boolean };

@Injectable({
  providedIn: 'root'
})
export class MemberMenuStore {
  private readonly navigatorActivitiesRequestRef = signal<NavigatorActivitiesRequest | null>(null);
  private readonly navigatorAssetRequestRef = signal<NavigatorAssetRequest | null>(null);
  private readonly navigatorEventFeedbackRequestRef = signal<NavigatorEventFeedbackRequest | null>(null);
  private readonly activitiesNavigationRequestRef = signal<ActivitiesNavigationRequest | null>(null);

  readonly navigatorActivitiesRequest = this.navigatorActivitiesRequestRef.asReadonly();
  readonly navigatorAssetRequest = this.navigatorAssetRequestRef.asReadonly();
  readonly navigatorEventFeedbackRequest = this.navigatorEventFeedbackRequestRef.asReadonly();
  readonly activitiesNavigationRequest = this.activitiesNavigationRequestRef.asReadonly();

  openNavigatorActivitiesRequest(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash',
    options: { adminServiceOnly?: boolean } = {}
  ): void {
    this.navigatorActivitiesRequestRef.set({
      updatedMs: Date.now(),
      primaryFilter,
      eventScope,
      adminServiceOnly: options.adminServiceOnly === true
    });
  }

  clearNavigatorActivitiesRequest(): void {
    this.navigatorActivitiesRequestRef.set(null);
  }

  openNavigatorAssetRequest(assetFilter: AssetFilterType): void {
    this.navigatorAssetRequestRef.set({
      updatedMs: Date.now(),
      assetFilter
    });
  }

  clearNavigatorAssetRequest(): void {
    this.navigatorAssetRequestRef.set(null);
  }

  openNavigatorEventFeedbackRequest(): void {
    this.navigatorEventFeedbackRequestRef.set({
      updatedMs: Date.now()
    });
  }

  clearNavigatorEventFeedbackRequest(): void {
    this.navigatorEventFeedbackRequestRef.set(null);
  }

  requestActivitiesNavigation(request: ActivitiesNavigationRequest): void {
    this.activitiesNavigationRequestRef.set(request);
  }

  clearActivitiesNavigationRequest(): void {
    this.activitiesNavigationRequestRef.set(null);
  }
}

import { Injectable, signal } from '@angular/core';
import type { ActivityMemberEntry } from '../models/activity-member.model';
import type { ActivitiesNavigationRequest, ActivityMemberOwnerType } from '../models/activities.model';

export interface ActivityInvitePopupState {
  updatedMs: number;
  ownerId: string;
  ownerType?: ActivityMemberOwnerType;
  title?: string;
  initialCandidates?: readonly ActivityMemberEntry[];
  initialSelection?: readonly ActivityMemberEntry[];
  onApply?: (selectedCandidates: readonly ActivityMemberEntry[]) => void | Promise<void>;
  closeOwnerPopupOnClose?: boolean;
}

export interface NavigatorActivitiesRequest {
  updatedMs: number;
  primaryFilter: 'rates' | 'chats' | 'events';
  eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash';
}

export interface NavigatorAssetRequest {
  updatedMs: number;
  assetFilter: 'Car' | 'Accommodation' | 'Supplies' | 'Ticket';
}

export interface NavigatorEventFeedbackRequest {
  updatedMs: number;
}

export interface AdminNavigatorRequest {
  updatedMs: number;
  popup: 'reports' | 'feedback' | 'chat' | 'profile';
}

@Injectable({
  providedIn: 'root'
})
export class AppPopupContext {
  private readonly _activityInvitePopup = signal<ActivityInvitePopupState | null>(null);
  private readonly _navigatorActivitiesRequest = signal<NavigatorActivitiesRequest | null>(null);
  private readonly _navigatorAssetRequest = signal<NavigatorAssetRequest | null>(null);
  private readonly _navigatorEventFeedbackRequest = signal<NavigatorEventFeedbackRequest | null>(null);
  private readonly _adminNavigatorRequest = signal<AdminNavigatorRequest | null>(null);
  private readonly _activitiesNavigationRequest = signal<ActivitiesNavigationRequest | null>(null);

  readonly activityInvitePopup = this._activityInvitePopup.asReadonly();
  readonly navigatorActivitiesRequest = this._navigatorActivitiesRequest.asReadonly();
  readonly navigatorAssetRequest = this._navigatorAssetRequest.asReadonly();
  readonly navigatorEventFeedbackRequest = this._navigatorEventFeedbackRequest.asReadonly();
  readonly adminNavigatorRequest = this._adminNavigatorRequest.asReadonly();
  readonly activitiesNavigationRequest = this._activitiesNavigationRequest.asReadonly();

  openActivityInvitePopup(payload: {
    ownerId: string;
    ownerType?: ActivityMemberOwnerType;
    title?: string;
    initialCandidates?: readonly ActivityMemberEntry[];
    initialSelection?: readonly ActivityMemberEntry[];
    onApply?: (selectedCandidates: readonly ActivityMemberEntry[]) => void | Promise<void>;
    closeOwnerPopupOnClose?: boolean;
  }): void {
    const normalizedOwnerId = payload.ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    this._activityInvitePopup.set({
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
    this._activityInvitePopup.set(null);
  }

  openNavigatorActivitiesRequest(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash'
  ): void {
    this._navigatorActivitiesRequest.set({
      updatedMs: Date.now(),
      primaryFilter,
      eventScope
    });
  }

  openNavigatorAssetRequest(assetFilter: 'Car' | 'Accommodation' | 'Supplies' | 'Ticket'): void {
    this._navigatorAssetRequest.set({
      updatedMs: Date.now(),
      assetFilter
    });
  }

  openNavigatorEventFeedbackRequest(): void {
    this._navigatorEventFeedbackRequest.set({
      updatedMs: Date.now()
    });
  }

  clearNavigatorActivitiesRequest(): void {
    this._navigatorActivitiesRequest.set(null);
  }

  clearNavigatorAssetRequest(): void {
    this._navigatorAssetRequest.set(null);
  }

  clearNavigatorEventFeedbackRequest(): void {
    this._navigatorEventFeedbackRequest.set(null);
  }

  openAdminNavigatorRequest(popup: AdminNavigatorRequest['popup']): void {
    this._adminNavigatorRequest.set({
      updatedMs: Date.now(),
      popup
    });
  }

  clearAdminNavigatorRequest(): void {
    this._adminNavigatorRequest.set(null);
  }

  requestActivitiesNavigation(request: ActivitiesNavigationRequest): void {
    this._activitiesNavigationRequest.set(request);
  }

  clearActivitiesNavigationRequest(): void {
    this._activitiesNavigationRequest.set(null);
  }
}

import { Injectable, signal } from '@angular/core';
import type { UserSelectorListItemDto } from '../../core/contracts/user.interface';
import type { ActivityMemberOwnerType, AssetFilterType } from '../../core/common/constants';
import type { ActivityMemberEntry } from '../../core/contracts/activity.interface';
import type { ActivitiesNavigationRequest } from '../../core/base/models/activities-ui.model';
import type { EventEditorTarget, EventTournamentStageDTO } from '../../core/contracts/event.interface';

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
  adminServiceOnly?: boolean;
}

export interface NavigatorAssetRequest {
  updatedMs: number;
  assetFilter: AssetFilterType;
}

export interface NavigatorEventFeedbackRequest {
  updatedMs: number;
}

export interface EventSubeventsListPopupRequest {
  updatedMs: number;
  eventId: string;
  target: EventEditorTarget;
  title: string | null;
  canEdit: boolean;
}

export interface EventTournamentGroupsPopupRequest {
  updatedMs: number;
  eventId: string;
  slotId: string | null;
  title: string | null;
  canManage: boolean;
  stages: readonly EventTournamentStageDTO[];
  selectedStageId?: string | null;
  selectedGroupId?: string | null;
}

export interface AdminNavigatorRequest {
  updatedMs: number;
  popup: 'reports' | 'feedback' | 'chat' | 'profile' | 'help-editor' | 'idea-editor' | 'notifications' | 'params' | 'stats' | 'affinity-graph' | 'monitoring';
}

export type DemoBootstrapSelectorMode = 'member' | 'admin';

export interface DemoBootstrapSelectorState {
  updatedMs: number;
  mode: DemoBootstrapSelectorMode;
  title?: string;
  subtitle?: string;
  autoSelectUserId?: string;
  users?: readonly UserSelectorListItemDto[];
  onSelect: (userId: string) => boolean | Promise<boolean>;
  onNewProfile?: () => boolean | Promise<boolean>;
  onClose?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class AppPopupContext {
  private readonly _activityInvitePopup = signal<ActivityInvitePopupState | null>(null);
  private readonly _demoBootstrapSelector = signal<DemoBootstrapSelectorState | null>(null);
  private readonly _navigatorActivitiesRequest = signal<NavigatorActivitiesRequest | null>(null);
  private readonly _navigatorAssetRequest = signal<NavigatorAssetRequest | null>(null);
  private readonly _navigatorEventFeedbackRequest = signal<NavigatorEventFeedbackRequest | null>(null);
  private readonly _eventSubeventsListPopup = signal<EventSubeventsListPopupRequest | null>(null);
  private readonly _eventTournamentGroupsPopup = signal<EventTournamentGroupsPopupRequest | null>(null);
  private readonly _adminNavigatorRequest = signal<AdminNavigatorRequest | null>(null);
  private readonly _activitiesNavigationRequest = signal<ActivitiesNavigationRequest | null>(null);

  readonly activityInvitePopup = this._activityInvitePopup.asReadonly();
  readonly demoBootstrapSelector = this._demoBootstrapSelector.asReadonly();
  readonly navigatorActivitiesRequest = this._navigatorActivitiesRequest.asReadonly();
  readonly navigatorAssetRequest = this._navigatorAssetRequest.asReadonly();
  readonly navigatorEventFeedbackRequest = this._navigatorEventFeedbackRequest.asReadonly();
  readonly eventSubeventsListPopup = this._eventSubeventsListPopup.asReadonly();
  readonly eventTournamentGroupsPopup = this._eventTournamentGroupsPopup.asReadonly();
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

  openDemoBootstrapSelector(payload: {
    mode: DemoBootstrapSelectorMode;
    title?: string;
    subtitle?: string;
    autoSelectUserId?: string;
    users?: readonly UserSelectorListItemDto[];
    onSelect: (userId: string) => boolean | Promise<boolean>;
    onNewProfile?: () => boolean | Promise<boolean>;
    onClose?: () => void;
  }): void {
    this._demoBootstrapSelector.set({
      updatedMs: Date.now(),
      mode: payload.mode === 'admin' ? 'admin' : 'member',
      title: payload.title?.trim() || undefined,
      subtitle: payload.subtitle?.trim() || undefined,
      autoSelectUserId: payload.autoSelectUserId?.trim() || undefined,
      users: payload.users?.map(user => ({ ...user })),
      onSelect: async userId => {
        const accepted = await payload.onSelect(userId);
        if (accepted !== false) {
          this.closeDemoBootstrapSelector();
        }
        return accepted;
      },
      onNewProfile: payload.onNewProfile
        ? async () => {
            const accepted = await payload.onNewProfile?.();
            if (accepted !== false) {
              this.closeDemoBootstrapSelector();
            }
            return accepted !== false;
          }
        : undefined,
      onClose: () => {
        try {
          payload.onClose?.();
        } finally {
          this.closeDemoBootstrapSelector();
        }
      }
    });
  }

  closeDemoBootstrapSelector(): void {
    this._demoBootstrapSelector.set(null);
  }

  openNavigatorActivitiesRequest(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash',
    options: { adminServiceOnly?: boolean } = {}
  ): void {
    this._navigatorActivitiesRequest.set({
      updatedMs: Date.now(),
      primaryFilter,
      eventScope,
      adminServiceOnly: options.adminServiceOnly === true
    });
  }

  openNavigatorAssetRequest(assetFilter: AssetFilterType): void {
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

  openEventSubeventsListPopup(payload: {
    eventId: string;
    target?: EventEditorTarget;
    title?: string | null;
    canEdit?: boolean;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this._eventSubeventsListPopup.set({
      updatedMs: Date.now(),
      eventId,
      target: payload.target ?? 'events',
      title: `${payload.title ?? ''}`.trim() || null,
      canEdit: payload.canEdit === true
    });
  }

  openEventTournamentGroupsPopup(payload: {
    eventId: string;
    slotId?: string | null;
    title?: string | null;
    canManage?: boolean | null;
    stages?: readonly EventTournamentStageDTO[] | null;
    selectedStageId?: string | null;
    selectedGroupId?: string | null;
  }): void {
    const eventId = `${payload.eventId ?? ''}`.trim();
    if (!eventId) {
      return;
    }
    this._eventTournamentGroupsPopup.set({
      updatedMs: Date.now(),
      eventId,
      slotId: `${payload.slotId ?? ''}`.trim() || null,
      title: `${payload.title ?? ''}`.trim() || null,
      canManage: payload.canManage === true,
      stages: (payload.stages ?? []).map(stage => ({
        ...stage,
        groups: []
      })),
      selectedStageId: `${payload.selectedStageId ?? ''}`.trim() || null,
      selectedGroupId: `${payload.selectedGroupId ?? ''}`.trim() || null
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

  closeEventSubeventsListPopup(): void {
    this._eventSubeventsListPopup.set(null);
  }

  closeEventTournamentGroupsPopup(): void {
    this._eventTournamentGroupsPopup.set(null);
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

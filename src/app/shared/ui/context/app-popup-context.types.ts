import type { UserSelectorListItemDto } from '../../core/contracts/user.interface';
import type {
  ActivityMemberOwnerType,
  AssetFilterType,
  AssetType,
  SubEventResourceFilter
} from '../../core/common/constants';
import type { ActivityMemberEntry } from '../../core/contracts/activity.interface';
import type { ChatDTO } from '../../core/contracts/chat.interface';
import type { EventEditorTarget, EventTournamentStageDTO, SubEventDTO } from '../../core/contracts/event.interface';
import type { AssetDTO } from '../../core/contracts';
import type { PopupHeaderLookup } from '../models';
import type { ResourceAssetDTO } from './sub-event-resource-popup.types';

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
      members?: readonly ActivityMemberEntry[];
      lookup?: PopupHeaderLookup;
      onMembersChanged?: (members: readonly ActivityMemberEntry[]) => void;
    }
  | { type: 'eventEditorMembers'; ownerId: string; title?: string; canManage?: boolean }
  | { type: 'eventEditorCreate'; target: EventEditorTarget }
  | { type: 'eventEditor'; eventId: string; target: EventEditorTarget; readOnly: boolean };

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

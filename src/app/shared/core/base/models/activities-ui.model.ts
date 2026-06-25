import type { ActivitiesPrimaryFilter, ActivityMemberEntry, RateFilterKey } from '../../contracts/activity.interface';
import type { ChatRecord } from '../../contracts/chat.interface';
import type { EventEditorTarget, SubEventDTO } from '../../contracts/event.interface';
import type { ActivityMemberOwnerType, AssetType, SubEventResourceFilter } from '../../common/constants';
import type { AssetCardDTO } from '../dto';
import type { PopupHeaderLookup } from './popup-ui.model';

export type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

export type SubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
export type SubEventAssetCardsByType = Partial<Record<AssetType, AssetCardDTO[]>>;

export interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}

export type ActivitiesNavigationRequest =
  | { type: 'eventExplore'; stacked?: boolean }
  | { type: 'eventCheckoutDraft'; sourceId: string }
  | { type: 'assetExplore'; assetType?: AssetType; assetId?: string; viewOnly?: boolean; fallbackAsset?: AssetCardDTO }
  | {
      type: 'chatResource';
      ownerId?: string;
      item: ChatRecord;
      resourceType: SubEventResourceFilter;
      subEvent: SubEventDTO;
      group?: { id: string; groupLabel: string } | null;
      assetAssignmentIds?: SubEventAssetAssignmentIds;
      assetCardsByType?: SubEventAssetCardsByType;
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

export interface EventChatSession {
  item: ChatRecord;
  openedAtIso: string;
}

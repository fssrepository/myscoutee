import type { ActivityMemberEntry } from '../../contracts/activity.interface';
import type { ChatRecord } from '../../contracts/chat.interface';
import type { EventEditorTarget, SubEventFormItem } from '../../contracts/event.interface';
import type { PopupHeaderLookup } from './popup.model';
import type { ActivityMemberOwnerType, AssetType, SubEventResourceFilter } from '../../common/constants';
import type { AssetCardDTO } from '../dto';
import type { ActivityListRow } from './activities-ui.model';

export type SubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
export type SubEventAssetCardsByType = Partial<Record<AssetType, AssetCardDTO[]>>;

export type ActivitiesNavigationRequest =
  | { type: 'eventExplore'; stacked?: boolean }
  | { type: 'assetExplore'; assetType?: AssetType; assetId?: string; viewOnly?: boolean; fallbackAsset?: AssetCardDTO }
  | {
      type: 'chatResource';
      ownerId?: string;
      item: ChatRecord;
      resourceType: SubEventResourceFilter;
      subEvent: SubEventFormItem;
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
  | { type: 'eventEditorMembers'; row: ActivityListRow }
  | { type: 'eventEditorCreate'; target: EventEditorTarget }
  | { type: 'eventEditor'; row: ActivityListRow; readOnly: boolean };

export interface EventChatSession {
  item: ChatRecord;
  openedAtIso: string;
}

export interface ActivitiesPageResult {
  rows: ActivityListRow[];
  total: number;
  nextCursor?: string | null;
}

import type { ImageCardData, InfoCardData, SingleRowData } from '../../../ui';
import type { ActivitiesPrimaryFilter, ActivityMemberEntry, RateFilterKey } from '../../contracts/activity.interface';
import type { ChatRecord } from '../../contracts/chat.interface';
import type { EventEditorTarget, SubEventFormItem } from '../../contracts/event.interface';
import type { ActivityMemberOwnerType, AssetType, EventVisibility, SubEventResourceFilter } from '../../common/constants';
import type { AssetCardDTO } from '../dto';
import type { PopupHeaderLookup } from './popup-ui.model';

export type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

export type SubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
export type SubEventAssetCardsByType = Partial<Record<AssetType, AssetCardDTO[]>>;

export interface ActivityListItemBase<TDetailRecord = unknown> {
  id: string;
  type: ActivitiesPrimaryFilter;
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  dateIso: string;
  distanceMetersExact?: number;
  unread: number;
  metricScore: number;
  isAdmin?: boolean;
  detailRecord?: TDetailRecord | null;
  startAt?: string | null;
  endAt?: string | null;
  boost?: number | null;
  imageUrl?: string | null;
  visibility?: EventVisibility | null;
  avatarInitials?: string | null;
  creatorInitials?: string | null;
  acceptedMembers?: number | null;
  pendingMembers?: number | null;
  capacityTotal?: number | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
  isTrashed?: boolean;
  published?: boolean;
  memberCount?: number | null;
}

export type ActivityInfoCardRow<TDetailRecord = unknown> =
  InfoCardData<TDetailRecord>
  & ActivityListItemBase<TDetailRecord>
  & { type: 'events' | 'hosting' | 'invitations'; subtitle: string; detail: string };

export type ActivityImageCardRow<TDetailRecord = unknown> =
  ImageCardData<TDetailRecord>
  & ActivityListItemBase<TDetailRecord>
  & { type: 'rates'; subtitle: string; detail: string };

export type ActivitySingleRow<TDetailRecord = unknown> =
  SingleRowData<TDetailRecord>
  & ActivityListItemBase<TDetailRecord>
  & { type: 'chats'; subtitle: string; detail: string };

export type ActivityListRow<TDetailRecord = unknown> =
  | ActivityInfoCardRow<TDetailRecord>
  | ActivityImageCardRow<TDetailRecord>
  | ActivitySingleRow<TDetailRecord>;

export interface ActivityGroup {
  label: string;
  rows: ActivityListRow[];
}

export interface CalendarDayCell {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  rows: ActivityListRow[];
}

export interface CalendarMonthPage {
  key: string;
  label: string;
  weeks: CalendarMonthWeek[];
}

export interface CalendarMonthWeek {
  start: Date;
  end: Date;
  days: CalendarDayCell[];
  spans: CalendarMonthSpan[];
}

export interface CalendarMonthSpan {
  key: string;
  row: ActivityListRow;
  startCol: number;
  endCol: number;
  lane: number;
}

export interface CalendarWeekPage {
  key: string;
  label: string;
  days: CalendarDayCell[];
}

export interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}

export interface CalendarTimedBadge {
  row: ActivityListRow;
  topPct: number;
  heightPct: number;
}

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

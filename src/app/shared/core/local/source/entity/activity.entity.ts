import type {
  ActivityMemberOwnerType,
  ActivityMemberRequestKind,
  ActivityMemberRole,
  ActivityMemberStatus,
  ActivityPendingSource,
  UserGender
} from '../../../common/constants';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
import type { AssetType } from '../../../common/constants';
import type { AssetSnapshotRecord } from './asset.entity';
import type { UserRecord } from './user.entity';

export const ACTIVITY_MEMBERS_TABLE_NAME = APP_INDEXED_DB_KEYS.activityMembers;
export const ACTIVITY_RESOURCES_TABLE_NAME = APP_INDEXED_DB_KEYS.activityResources;
export const ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME = APP_INDEXED_DB_KEYS.activitySubEventStageRuntime;

export interface ActivityMemberRecord {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserGender;
  city: string;
  statusText: string;
  role: ActivityMemberRole;
  status: ActivityMemberStatus;
  pendingSource: ActivityPendingSource;
  requestKind: ActivityMemberRequestKind;
  invitedByActiveUser: boolean;
  invitedByUserId?: string | null;
  metAtIso: string;
  actionAtIso: string;
  metWhere: string;
  avatarUrl: string;
  profile?: UserRecord | null;
  ownerType: ActivityMemberOwnerType;
  ownerId: string;
  ownerKey: string;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ActivityMembersRecordCollection {
  byId: Record<string, ActivityMemberRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type ActivityMembersMemorySchema = Record<typeof ACTIVITY_MEMBERS_TABLE_NAME, ActivityMembersRecordCollection>;

export interface ActivitySubEventAssignedAssetSettingsRecord {
  capacityMin: number;
  capacityMax: number;
  addedByUserId: string;
  routes: string[];
}

export interface ActivitySubEventSupplyContributionEntryRecord {
  id: string;
  userId: string;
  quantity: number;
  addedAtIso: string;
}

export type ActivitySubEventAssetAssignmentIdsRecord = Partial<Record<AssetType, string[]>>;
export type ActivitySubEventAssetSettingsByTypeRecord = Partial<
  Record<AssetType, Record<string, ActivitySubEventAssignedAssetSettingsRecord>>
>;
export type ActivitySubEventSupplyContributionsByAssetIdRecord = Record<string, ActivitySubEventSupplyContributionEntryRecord[]>;

export interface ActivitySubEventResourceRecord {
  id: string;
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
  assetAssignmentIds: ActivitySubEventAssetAssignmentIdsRecord;
  assetSettingsByType: ActivitySubEventAssetSettingsByTypeRecord;
  supplyContributionEntriesByAssetId: ActivitySubEventSupplyContributionsByAssetIdRecord;
  fallbackAssetCardsByType?: Partial<Record<AssetType, AssetSnapshotRecord[]>>;
  ownerKey: string;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ActivityResourcesRecordCollection {
  byId: Record<string, ActivitySubEventResourceRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type ActivityResourcesMemorySchema = Record<typeof ACTIVITY_RESOURCES_TABLE_NAME, ActivityResourcesRecordCollection>;

export interface ActivitySubEventStageRuntimeRecord {
  id: string;
  ownerId: string;
  subEventId: string;
  stageStatus: string | null;
  stageStatusReason: string | null;
  stageStatusUpdatedAt: string | null;
  stageFinalizedAt: string | null;
  stageFinalizedByUserId: string | null;
  ownerKey: string;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ActivitySubEventStageRuntimeRecordCollection {
  byId: Record<string, ActivitySubEventStageRuntimeRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type ActivitySubEventStageRuntimeMemorySchema = Record<
  typeof ACTIVITY_SUB_EVENT_STAGE_RUNTIME_TABLE_NAME,
  ActivitySubEventStageRuntimeRecordCollection
>;

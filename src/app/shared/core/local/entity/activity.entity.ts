import type {
  ActivityMemberOwnerType,
  ActivityMemberRequestKind,
  ActivityMemberRole,
  ActivityMemberStatus,
  ActivityPendingSource
} from '../../contracts/activity.interface';
import type { UserDto } from '../../contracts/user.interface';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';
import type {
  ActivitySubEventAssetAssignmentIds,
  ActivitySubEventAssetSettingsByType,
  ActivitySubEventSupplyContributionsByAssetId
} from '../../base/models/activity-resource.model';
import type { AssetCard, AssetType } from '../../base/models/asset.model';

export const ACTIVITY_MEMBERS_TABLE_NAME = APP_INDEXED_DB_KEYS.activityMembers;
export const ACTIVITY_RESOURCES_TABLE_NAME = APP_INDEXED_DB_KEYS.activityResources;

export interface ActivityMemberRecord {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: 'woman' | 'man';
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
  profile?: UserDto | null;
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

export interface ActivitySubEventResourceRecord {
  id: string;
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
  assetAssignmentIds: ActivitySubEventAssetAssignmentIds;
  assetSettingsByType: ActivitySubEventAssetSettingsByType;
  supplyContributionEntriesByAssetId: ActivitySubEventSupplyContributionsByAssetId;
  fallbackAssetCardsByType?: Partial<Record<AssetType, AssetCard[]>>;
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

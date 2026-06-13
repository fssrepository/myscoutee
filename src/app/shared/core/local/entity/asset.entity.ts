import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';
import type {
  AssetCategory,
  AssetLifecycleStatus,
  AssetMemberRequest,
  AssetType
} from '../../base/models/asset.model';
import type { EventPolicyItem, EventVisibility } from '../../base/models/event.model';
import type { PricingConfig } from '../../base/models/pricing.model';

export const ASSETS_TABLE_NAME = APP_INDEXED_DB_KEYS.assets;

export interface AssetRecord {
  id: string;
  type: AssetType;
  title: string;
  subtitle: string;
  category?: AssetCategory;
  city: string;
  capacityTotal: number;
  quantity: number;
  details: string;
  imageUrl: string;
  sourceLink: string;
  routes?: string[];
  topics?: string[];
  policies?: EventPolicyItem[];
  pricing?: PricingConfig | null;
  ownerUserId: string;
  ownerName?: string;
  requests: AssetMemberRequest[];
  menuActions?: string[];
  visibility: EventVisibility;
  status?: AssetLifecycleStatus | string;
  statusBeforeSuppression?: AssetLifecycleStatus | string | null;
  affinity?: number;
  boost?: number;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AssetsRecordCollection {
  byId: Record<string, AssetRecord>;
  ids: string[];
  idsByOwnerUserId: Record<string, string[]>;
}

export type AssetsMemorySchema = Record<typeof ASSETS_TABLE_NAME, AssetsRecordCollection>;

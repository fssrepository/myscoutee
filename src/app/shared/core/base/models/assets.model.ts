import type * as AppTypes from '.';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const ASSETS_TABLE_NAME = APP_INDEXED_DB_KEYS.assets;

export interface AssetRecord extends AppTypes.AssetCard {
  ownerUserId: string;
  visibility: AppTypes.EventVisibility;
  statusBeforeSuppression?: AppTypes.AssetLifecycleStatus | string | null;
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

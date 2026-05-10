import type * as AppTypes from '../../../core/base/models';

export const ASSETS_TABLE_NAME = 'assets' as const;

export interface DemoAssetRecord extends AppTypes.AssetCard {
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

export interface DemoAssetsRecordCollection {
  byId: Record<string, DemoAssetRecord>;
  ids: string[];
  idsByOwnerUserId: Record<string, string[]>;
}

export type DemoAssetsMemorySchema = Record<typeof ASSETS_TABLE_NAME, DemoAssetsRecordCollection>;

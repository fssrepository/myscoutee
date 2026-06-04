import type * as AppTypes from '../../../core/base/models';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const ACTIVITY_RESOURCES_TABLE_NAME = APP_INDEXED_DB_KEYS.activityResources;

export interface DemoActivitySubEventResourceRecord extends AppTypes.ActivitySubEventResourceState {
  id: string;
  ownerKey: string;
  createdMs: number;
  updatedMs: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface DemoActivityResourcesRecordCollection {
  byId: Record<string, DemoActivitySubEventResourceRecord>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export type DemoActivityResourcesMemorySchema = Record<typeof ACTIVITY_RESOURCES_TABLE_NAME, DemoActivityResourcesRecordCollection>;

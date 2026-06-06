import type * as AppTypes from '.';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const ACTIVITY_RESOURCES_TABLE_NAME = APP_INDEXED_DB_KEYS.activityResources;

export interface ActivitySubEventResourceRecord extends AppTypes.ActivitySubEventResourceState {
  id: string;
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

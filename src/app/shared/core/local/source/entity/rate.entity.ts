import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
import type { UserGender } from '../../../common/constants';

export const USER_RATES_TABLE_NAME = APP_INDEXED_DB_KEYS.userRates;
export const USER_RATES_OUTBOX_TABLE_NAME = APP_INDEXED_DB_KEYS.userRatesOutbox;
export const USER_FILTER_PREFERENCES_TABLE_NAME = APP_INDEXED_DB_KEYS.userFilterPreferences;

export interface UserRateRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  rate: number;
  mode: 'single' | 'pair';
  createdAtIso: string;
  updatedAtIso: string;
  ownerUserId?: string;
  displayId?: string;
  displayDirection?: 'given' | 'received' | 'mutual' | 'met';
  socialContext?: 'separated-friends' | 'friends-in-common';
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven?: number;
  scoreReceived?: number;
  eventName?: string;
  happenedAtIso?: string;
  distanceMetersExact?: number;
}

export type ActivityRateRecordSort = 'happenedAt' | 'distance' | 'relevance';

export interface ActivityRateRecordQuery {
  ownerUserId: string;
  mode: 'single' | 'pair';
  displayDirection: 'given' | 'received' | 'mutual' | 'met';
  socialBadgeEnabled?: boolean;
  sort: ActivityRateRecordSort;
  sortDirection?: 'asc' | 'desc';
  cursor?: string | null;
  offset?: number;
  limit?: number;
  rangeStartIso?: string;
  rangeEndIso?: string;
}

export interface ActivityRateRecordQueryResult {
  records: UserRateRecord[];
  total: number;
  nextCursor?: string | null;
}

export interface UserRateOutboxRecord {
  id: string;
  rateId: string;
  action: 'upsert';
  payload: UserRateRecord;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  queuedAtIso: string;
  updatedAtIso: string;
  lastTriedAtIso: string | null;
  syncedAtIso: string | null;
  lastError: string | null;
}

export interface UserRatesRecordCollection {
  byId: Record<string, UserRateRecord>;
  ids: string[];
  idsByRelevantUserId: Record<string, string[]>;
}

export interface UserRatesOutboxRecordCollection {
  byId: Record<string, UserRateOutboxRecord>;
  ids: string[];
}

export interface UserFilterPreferencesRecord {
  ageMin?: number;
  ageMax?: number;
  heightMinCm?: number;
  heightMaxCm?: number;
  interests?: string[];
  values?: string[];
  physiques?: string[];
  languages?: string[];
  genders?: UserGender[];
  horoscopes?: string[];
  traitLabels?: string[];
  smoking?: string[];
  drinking?: string[];
  workout?: string[];
  pets?: string[];
  familyPlans?: string[];
  children?: string[];
  loveStyles?: string[];
  communicationStyles?: string[];
  sexualOrientations?: string[];
  religions?: string[];
}

export interface UserFilterPreferencesRecordCollection {
  byId: Record<string, UserFilterPreferencesRecord>;
  ids: string[];
}

export type UserRatesMemorySchema = Record<typeof USER_RATES_TABLE_NAME, UserRatesRecordCollection>
  & Record<typeof USER_RATES_OUTBOX_TABLE_NAME, UserRatesOutboxRecordCollection>
  & Record<typeof USER_FILTER_PREFERENCES_TABLE_NAME, UserFilterPreferencesRecordCollection>;

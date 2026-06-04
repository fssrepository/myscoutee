import type {
  UserGameFilterPreferencesDto,
  UserRateOutboxRecord,
  UserRateRecord
} from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const USERS_TABLE_NAME = APP_INDEXED_DB_KEYS.users;
export const USER_RATES_TABLE_NAME = APP_INDEXED_DB_KEYS.userRates;
export const USER_RATES_OUTBOX_TABLE_NAME = APP_INDEXED_DB_KEYS.userRatesOutbox;
export const USER_FILTER_PREFERENCES_TABLE_NAME = APP_INDEXED_DB_KEYS.userFilterPreferences;

export interface DemoUsersRecordCollection {
  byId: Record<string, UserDto>;
  ids: string[];
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

export interface UserFilterPreferencesRecordCollection {
  byId: Record<string, UserGameFilterPreferencesDto>;
  ids: string[];
}

export type DemoUsersMemorySchema = Record<typeof USERS_TABLE_NAME, DemoUsersRecordCollection>
  & Record<typeof USER_RATES_TABLE_NAME, UserRatesRecordCollection>
  & Record<typeof USER_RATES_OUTBOX_TABLE_NAME, UserRatesOutboxRecordCollection>
  & Record<typeof USER_FILTER_PREFERENCES_TABLE_NAME, UserFilterPreferencesRecordCollection>;

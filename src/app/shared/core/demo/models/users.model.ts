import type {
  UserGameFilterPreferencesDto,
  UserRateOutboxRecord,
  UserRateRecord
} from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';

export const USERS_TABLE_NAME = 'users' as const;
export const USER_RATES_TABLE_NAME = 'userRates' as const;
export const USER_RATES_OUTBOX_TABLE_NAME = 'userRatesOutbox' as const;
export const USER_FILTER_PREFERENCES_TABLE_NAME = 'userFilterPreferences' as const;

export interface DemoUsersRecordCollection {
  byId: Record<string, UserDto>;
  ids: string[];
}

export interface UserRatesRecordCollection {
  byId: Record<string, UserRateRecord>;
  ids: string[];
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

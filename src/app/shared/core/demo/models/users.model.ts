import type { UserDto } from '../../user.interface';

export const USERS_TABLE_NAME = 'users' as const;
export const USER_RATES_TABLE_NAME = 'userRates' as const;

export interface DemoUsersRecordCollection {
  byId: Record<string, UserDto>;
  ids: string[];
}

export interface UserRateRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  rate: number;
  mode: 'single' | 'pair';
  source: 'game-card';
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UserRatesRecordCollection {
  byId: Record<string, UserRateRecord>;
  ids: string[];
}

export type DemoUsersMemorySchema = Record<typeof USERS_TABLE_NAME, DemoUsersRecordCollection>
  & Record<typeof USER_RATES_TABLE_NAME, UserRatesRecordCollection>;

import type { UserDto } from '../../user.interface';

export const DEMO_USERS_TABLE_NAME = 'demoUsers' as const;

export interface DemoUsersRecordCollection {
  byId: Record<string, UserDto>;
  ids: string[];
}

export type DemoUsersMemorySchema = Record<typeof DEMO_USERS_TABLE_NAME, DemoUsersRecordCollection>;

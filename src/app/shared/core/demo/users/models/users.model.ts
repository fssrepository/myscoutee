import type { UserDto } from '../../../interfaces/user.interface';

export const DEMO_USERS_TABLE_NAME = 'demoUsers' as const;

export interface DemoUsersRecordCollection {
  byId: Record<string, UserDto>;
  ids: string[];
  loading: boolean;
  loadedAtIso: string | null;
  error: string | null;
}

export type DemoUsersMemorySchema = Record<typeof DEMO_USERS_TABLE_NAME, DemoUsersRecordCollection>;

import type { UserDto } from '../../user.interface';

export const DEMO_USERS_TABLE_NAME = 'demoUsers' as const;
export type UsersLoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';

export interface DemoUsersRecordCollection {
  byId: Record<string, UserDto>;
  ids: string[];
  loading: boolean;
  status: UsersLoadStatus;
  loadedAtIso: string | null;
  error: string | null;
}

export type DemoUsersMemorySchema = Record<typeof DEMO_USERS_TABLE_NAME, DemoUsersRecordCollection>;

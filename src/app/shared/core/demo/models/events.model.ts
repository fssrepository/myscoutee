export const EVENTS_TABLE_NAME = 'events' as const;

export type DemoEventScopeFilter =
  | 'all'
  | 'active-events'
  | 'invitations'
  | 'my-events'
  | 'drafts'
  | 'trash';

export type DemoRepositoryEventItemType = 'events' | 'hosting' | 'invitations';

export interface DemoEventRecord {
  id: string;
  userId: string;
  type: DemoRepositoryEventItemType;
  avatar: string;
  title: string;
  subtitle: string;
  timeframe: string;
  inviter: string | null;
  unread: number;
  activity: number;
  isAdmin: boolean;
  isInvitation: boolean;
  isHosting: boolean;
  isTrashed: boolean;
  published: boolean;
  trashedAtIso: string | null;
}

export interface DemoEventRecordCollection {
  byId: Record<string, DemoEventRecord>;
  ids: string[];
}

export type DemoEventsMemorySchema = Record<typeof EVENTS_TABLE_NAME, DemoEventRecordCollection>;

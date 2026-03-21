import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';

export const CHATS_TABLE_NAME = 'chats' as const;

export interface DemoChatRecord extends ChatMenuItem {
  ownerUserId: string;
}

export interface DemoChatRecordCollection {
  byId: Record<string, DemoChatRecord>;
  ids: string[];
}

export type DemoChatsMemorySchema = Record<typeof CHATS_TABLE_NAME, DemoChatRecordCollection>;

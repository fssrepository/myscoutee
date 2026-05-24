import type { ChatPopupMessage } from '../../base/models/chat.model';
import type { ChatRecord } from '../../base/models/chat.model';

export const CHATS_TABLE_NAME = 'chats' as const;

export interface DemoChatRecord extends ChatRecord {
  ownerUserId: string;
  messages?: ChatPopupMessage[];
}

export interface DemoChatRecordCollection {
  byId: Record<string, DemoChatRecord>;
  ids: string[];
}

export type DemoChatsMemorySchema = Record<typeof CHATS_TABLE_NAME, DemoChatRecordCollection>;

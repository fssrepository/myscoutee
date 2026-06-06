import type { ChatPopupMessage } from './chat.model';
import type { ChatRecord } from './chat.model';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const CHATS_TABLE_NAME = APP_INDEXED_DB_KEYS.chats;

export interface ChatThreadRecord extends ChatRecord {
  ownerUserId: string;
  messages?: ChatPopupMessage[];
}

export interface ChatThreadRecordCollection {
  byId: Record<string, ChatThreadRecord>;
  ids: string[];
}

export type ChatsMemorySchema = Record<typeof CHATS_TABLE_NAME, ChatThreadRecordCollection>;

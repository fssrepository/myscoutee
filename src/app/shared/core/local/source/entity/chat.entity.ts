import type {
  ChatChannelType,
  ChatSupportCase,
  ChatPopupMessage,
} from '../../../contracts/chat.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const CHATS_TABLE_NAME = APP_INDEXED_DB_KEYS.chats;

export interface ChatRecord {
  id: string;
  avatar: string;
  title: string;
  lastMessage: string;
  lastSenderId: string;
  memberIds: string[];
  unread: number;
  dateIso?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
  channelType?: ChatChannelType;
  serviceContext?: 'event' | 'asset' | 'notification';
  ownerId?: string;
  supportCase?: ChatSupportCase | null;
}

export interface ChatThreadRecord extends ChatRecord {
  ownerUserId: string;
  messages?: ChatPopupMessage[];
}

export interface ChatThreadRecordCollection {
  byId: Record<string, ChatThreadRecord>;
  ids: string[];
}

export type ChatsMemorySchema = Record<typeof CHATS_TABLE_NAME, ChatThreadRecordCollection>;

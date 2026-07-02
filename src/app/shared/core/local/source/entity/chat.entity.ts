import type {
  ChatChannelType,
  ChatMessageAttachmentType,
  ChatMessageDeliveryState,
  ChatSupportCase,
  ChatUserGender,
  ChatMemberSummaryDto,
} from '../../../contracts/chat.interface';
import type * as AppConstants from '../../../common/constants';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const CHATS_TABLE_NAME = APP_INDEXED_DB_KEYS.chats;
export const CHAT_MESSAGES_TABLE_NAME = APP_INDEXED_DB_KEYS.chatMessages;

export interface ChatRecord {
  id: string;
  avatar: string;
  title: string;
  lastMessage: string;
  lastSenderId: string;
  memberIds: string[];
  members?: ChatMemberSummaryDto[];
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
}

export interface ChatMessageAvatarRecord {
  userId: string;
  initials: string;
  gender: ChatUserGender;
  imageUrl?: string | null;
}

export interface ChatMessageReplyRecord {
  messageId: string;
  senderName: string;
  bodyText: string;
}

export interface ChatMessageReactionRecord {
  emoji: string;
  userId: string;
  userName: string;
  userInitials: string;
  userGender: ChatUserGender;
  reactedAtIso: string;
}

export interface ChatMessageAttachmentRecord {
  attachmentId: string;
  type: ChatMessageAttachmentType;
  title: string;
  entityId?: string | null;
  assetType?: AppConstants.AssetType | null;
  ownerUserId?: string | null;
  status?: 'available' | 'unavailable' | null;
  unavailableReason?: string | null;
  subtitle?: string | null;
  description?: string | null;
  url?: string | null;
  previewUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface ChatMessageRecord {
  recordId: string;
  ownerUserId: string;
  chatId: string;
  messageId: string;
  clientId?: string | null;
  senderName: string;
  senderAvatar: ChatMessageAvatarRecord;
  bodyText: string;
  timeLabel: string;
  sentAtIso: string;
  mine: boolean;
  readBy: ChatMessageAvatarRecord[];
  deliveryState?: ChatMessageDeliveryState | null;
  deletedAtIso?: string | null;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
  editedAtIso?: string | null;
  pinnedAtIso?: string | null;
  pinnedByUserId?: string | null;
  replyTo?: ChatMessageReplyRecord | null;
  reactions?: ChatMessageReactionRecord[];
  attachments?: ChatMessageAttachmentRecord[];
}

export interface ChatThreadRecordCollection {
  byId: Record<string, ChatThreadRecord>;
  ids: string[];
}

export interface ChatMessageRecordCollection {
  byId: Record<string, ChatMessageRecord>;
  ids: string[];
  idsByChatKey: Record<string, string[]>;
}

export type ChatsMemorySchema =
  Record<typeof CHATS_TABLE_NAME, ChatThreadRecordCollection>
  & Record<typeof CHAT_MESSAGES_TABLE_NAME, ChatMessageRecordCollection>;

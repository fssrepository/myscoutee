import type { AssetType } from './asset.model';

export interface ChatReadAvatar {
  id: string;
  initials: string;
  gender: 'woman' | 'man';
}

export type ChatMessageDeliveryState = 'pending' | 'timed-out';

export interface ChatPopupMessage {
  id: string;
  sender: string;
  senderAvatar: ChatReadAvatar;
  text: string;
  time: string;
  sentAtIso: string;
  mine: boolean;
  readBy: ChatReadAvatar[];
  clientId?: string;
  deliveryState?: ChatMessageDeliveryState;
  deletedAtIso?: string | null;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
  editedAtIso?: string | null;
  pinnedAtIso?: string | null;
  pinnedByUserId?: string | null;
  replyTo?: {
    id: string;
    sender: string;
    text: string;
  } | null;
  reactions?: ChatMessageReaction[];
  attachments?: ChatMessageAttachment[];
}

export interface ChatMessageReplyRef {
  id: string;
  sender: string;
  text: string;
}

export interface ChatMessageMutation {
  text?: string;
  deleted?: boolean;
  pinned?: boolean;
  reactionEmoji?: string | null;
  attachments?: ChatMessageAttachment[];
}

export interface ChatMessageReaction {
  emoji: string;
  userId: string;
  userName: string;
  userInitials: string;
  userGender: 'woman' | 'man';
  reactedAtIso: string;
}

export type ChatMessageAttachmentType = 'image' | 'event' | 'asset' | 'link' | 'poll' | 'voice';

export interface ChatMessageAttachment {
  id: string;
  type: ChatMessageAttachmentType;
  title: string;
  entityId?: string | null;
  assetType?: AssetType | null;
  ownerUserId?: string | null;
  subtitle?: string | null;
  description?: string | null;
  url?: string | null;
  previewUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface ChatTypingIndicator {
  userId: string;
  userName: string;
  userInitials: string;
  userGender: 'woman' | 'man';
  typing: boolean;
}

export interface ChatReadReceipt {
  userId: string;
  userInitials: string;
  userGender: 'woman' | 'man';
  messageIds: string[];
  readAtIso: string;
}

export type ChatLiveEvent =
  | { type: 'message'; chatId: string; message: ChatPopupMessage }
  | { type: 'typing'; chatId: string; typing: ChatTypingIndicator }
  | { type: 'read'; chatId: string; read: ChatReadReceipt }
  | { type: 'reconnected'; chatId: string };

export interface ChatPopupDayGroup {
  key: string;
  label: string;
  messages: ChatPopupMessage[];
}

export type ChatChannelType = 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent' | 'serviceEvent';
export type ActivitiesChatContextFilter = 'all' | 'event' | 'subEvent' | 'group' | 'service';

import type * as AppConstants from '../common/constants';

export type ChatUserGender = 'woman' | 'man' | 'deleted';

export interface ChatReadAvatar {
  id: string;
  initials: string;
  gender: ChatUserGender;
  imageUrl?: string | null;
}

export interface ChatMemberSummaryDto extends ChatReadAvatar {
  name?: string | null;
}

export type ChatMessageDeliveryState = 'pending' | 'timed-out';

export interface ChatMessageDto {
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
  userGender: ChatUserGender;
  reactedAtIso: string;
}

export type ChatMessageAttachmentType = 'image' | 'event' | 'asset' | 'link' | 'poll' | 'voice';

export interface ChatMessageAttachment {
  id: string;
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

export interface ChatTypingIndicator {
  userId: string;
  userName: string;
  userInitials: string;
  userGender: ChatUserGender;
  typing: boolean;
}

export interface ChatReadReceipt {
  userId: string;
  userInitials: string;
  userGender: ChatUserGender;
  messageIds: string[];
  readAtIso: string;
  unread?: number | null;
}

export type ChatLiveEvent =
  | { type: 'message'; chatId: string; message: ChatMessageDto }
  | { type: 'ack'; chatId: string; message?: ChatMessageDto; messageId?: string; clientId?: string }
  | { type: 'typing'; chatId: string; typing: ChatTypingIndicator }
  | { type: 'read'; chatId: string; read: ChatReadReceipt }
  | { type: 'error'; chatId: string; messageId?: string; clientId?: string; error?: string }
  | { type: 'reconnected'; chatId: string };

export type ChatChannelType = 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent' | 'serviceEvent' | 'appSupport' | 'supportCase';
export type ActivitiesChatContextFilter = 'all' | 'event' | 'subEvent' | 'group' | 'service' | 'appSupport';
export type SupportCaseStatus = 'pending' | 'picked' | 'solved' | 'blocked';
export type SupportCaseFilter = 'all' | SupportCaseStatus;
export type SupportCaseAction = 'pick' | 'unpick' | 'solve' | 'block' | 'reopen';

export interface ChatSupportCase {
  status: SupportCaseStatus;
  assignee?: {
    userId: string;
    name: string;
    initials: string;
  } | null;
  updatedAtIso?: string | null;
}

export interface ChatMetricBucketDTO {
  accepted: number;
  pending: number;
  capacityMin: number;
  capacityMax: number;
}

export interface ChatMetricsDTO {
  members?: ChatMetricBucketDTO | null;
  car?: ChatMetricBucketDTO | null;
  accommodation?: ChatMetricBucketDTO | null;
  supplies?: ChatMetricBucketDTO | null;
  groupsCount?: number | null;
  pendingTotal: number;
}

export interface ChatDTO {
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
  ownerUserId?: string | null;
  metrics?: ChatMetricsDTO | null;
}

export interface ActivitiesChatPageResultDTO {
  items: ChatDTO[];
  total: number;
  nextCursor?: string | null;
}

export interface ChatMessagesPageResultDTO {
  items: ChatMessageDto[];
  total: number;
  nextCursor?: string | null;
  readReceipt?: ChatReadReceipt | null;
}

export interface ChatVoiceClip {
  dataUrl: string;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
}

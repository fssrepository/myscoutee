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

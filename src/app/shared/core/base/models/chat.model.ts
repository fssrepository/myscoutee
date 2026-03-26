export interface ChatReadAvatar {
  id: string;
  initials: string;
  gender: 'woman' | 'man';
}

export interface ChatPopupMessage {
  id: string;
  sender: string;
  senderAvatar: ChatReadAvatar;
  text: string;
  time: string;
  sentAtIso: string;
  mine: boolean;
  readBy: ChatReadAvatar[];
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
  | { type: 'read'; chatId: string; read: ChatReadReceipt };

export interface ChatPopupDayGroup {
  key: string;
  label: string;
  messages: ChatPopupMessage[];
}

export type ChatChannelType = 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent';
export type ActivitiesChatContextFilter = 'all' | 'event' | 'subEvent' | 'group';

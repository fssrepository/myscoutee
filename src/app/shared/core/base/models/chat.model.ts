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

export interface ChatPopupDayGroup {
  key: string;
  label: string;
  messages: ChatPopupMessage[];
}

export type ChatChannelType = 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent';
export type ActivitiesChatContextFilter = 'all' | 'event' | 'subEvent' | 'group';


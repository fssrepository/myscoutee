import type { ChatPopupMessage } from '../../contracts/chat.interface';

export interface ChatPopupDayGroup {
  key: string;
  label: string;
  messages: ChatPopupMessage[];
}

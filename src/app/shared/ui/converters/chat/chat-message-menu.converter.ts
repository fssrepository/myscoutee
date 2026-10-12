import type { AppMenuItem } from '@fssrepository/myscoutee-components';
import type { ChatMessageDto } from '../../../core/contracts/chat/chat.interface';

export interface ChatMessageMenuContext {
  menu: 'message-action';
  message: ChatMessageDto;
  action: 'reply' | 'edit' | 'unsend' | 'pin' | 'resend';
}

/** Conversation actions; product-specific actions are appended by their owning screen. */
export class ChatMessageMenuConverter {
  static readonly emojiCategories = [
    {
      key: 'smileys',
      label: 'Smileys & people',
      icon: 'sentiment_satisfied',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '🥹', '😂', '🤣', '🥲', '😊', '☺️', '😉',
        '😍', '🥰', '😘', '😗', '😋', '😛', '😝', '🤪', '🤨', '🧐', '😎', '🥳',
        '😟', '😢', '😭', '😤', '😡', '🤯', '👍', '👎', '👏', '🙌', '🙏', '💪'
      ]
    },
    { key: 'animals', label: 'Animals & nature', icon: 'pets', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐸', '🐵', '🌲', '🌵', '🌻', '🌙'] },
    { key: 'food', label: 'Food & drink', icon: 'restaurant', emojis: ['🍏', '🍎', '🍌', '🍓', '🍇', '🍉', '🍕', '🍔', '🍟', '🌮', '🍜', '🍣', '🍰', '☕', '🍺', '🍷', '🥂', '🍽️'] },
    { key: 'activity', label: 'Activities', icon: 'sports_soccer', emojis: ['⚽', '🏀', '🏈', '🎾', '🏐', '🎱', '🏓', '🎯', '🎮', '🎲', '🎸', '🎤', '🎬', '🎨', '🏆', '🎉', '✨', '🔥'] },
    { key: 'travel', label: 'Travel & places', icon: 'directions_car', emojis: ['🚗', '🚕', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚲', '✈️', '🚆', '🚢', '🏠', '🏙️', '⛰️', '🏖️', '🌍', '🧭', '📍'] },
    { key: 'objects', label: 'Objects', icon: 'lightbulb', emojis: ['💡', '📱', '💻', '⌚', '📷', '🎁', '🔑', '🔒', '📌', '📎', '✏️', '📅', '💬', '🔔', '❤️', '🧡', '💙', '💜'] },
    { key: 'symbols', label: 'Symbols', icon: 'shuffle', emojis: ['✅', '☑️', '❌', '⚠️', '❗', '❓', '➕', '➖', '➡️', '⬅️', '🔄', '🔁', '💯', '🔴', '🟢', '🔵', '⭐', '📌'] },
    { key: 'flags', label: 'Flags', icon: 'flag', emojis: ['🏳️', '🏴', '🏁', '🚩', '🇺🇸', '🇨🇦', '🇬🇧', '🇮🇪', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇭🇺', '🇸🇰', '🇨🇿', '🇵🇱', '🇺🇦', '🇪🇺'] }
  ];

  static items(message: ChatMessageDto): AppMenuItem<string, ChatMessageMenuContext>[] {
    const items: AppMenuItem<string, ChatMessageMenuContext>[] = [];
    items.push({
      id: `chat-message-reply-${message.id}`,
      label: 'Reply',
      icon: 'reply',
      context: { menu: 'message-action', message, action: 'reply' }
    });
    if (message.mine && !message.deletedAtIso) {
      items.push({
        id: `chat-message-edit-${message.id}`,
        label: 'Edit',
        icon: 'edit',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'message-action', message, action: 'edit' }
      });
      items.push({
        id: `chat-message-unsend-${message.id}`,
        label: 'Unsend',
        icon: 'delete',
        palette: 'danger',
        surface: 'tinted',
        context: { menu: 'message-action', message, action: 'unsend' }
      });
    }
    items.push({
      id: `chat-message-pin-${message.id}`,
      label: message.pinnedAtIso ? 'Unpin' : 'Pin',
      icon: message.pinnedAtIso ? 'push_pin' : 'push_pin',
      palette: message.pinnedAtIso ? 'muted' : 'amber',
      surface: 'tinted',
      context: { menu: 'message-action', message, action: 'pin' }
    });
    if (message.mine && message.deliveryState === 'timed-out') {
      items.push({
        id: `chat-message-resend-${message.id}`,
        label: 'Resend',
        icon: 'send',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'message-action', message, action: 'resend' }
      });
    }
    return items;
  }
}

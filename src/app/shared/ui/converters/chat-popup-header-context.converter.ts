import { AppUtils } from '../../app-utils';
import type {
  ChatDTO,
  ChatMemberSummaryDto
} from '../../core/contracts/chat.interface';
import type {
  PopupHeaderContext,
  PopupHeaderControl,
  PopupHeaderThumb
} from '../models';

export interface ChatPopupHeaderContextConverterOptions {
  includeThumbs?: boolean;
}

export class ChatPopupHeaderContextConverter {
  static convert(
    chat: ChatDTO,
    options: ChatPopupHeaderContextConverterOptions = {}
  ): PopupHeaderContext {
    const chatId = `${chat.id ?? ''}`.trim();
    const title = `${chat.title ?? ''}`.trim() || 'Chat';
    const members = this.resolveChatMembers(chat);
    const memberIds = this.uniqueUserIds([
      ...(chat.memberIds ?? []),
      ...members.map(member => member.id)
    ]);
    const controls: PopupHeaderControl[] = [];

    if (chatId && memberIds.length > 0) {
      const maxVisibleThumbs = 4;
      const thumbs = options.includeThumbs === true
        ? this.buildChatHeaderThumbs(members, maxVisibleThumbs)
        : [];
      const hiddenThumbCount = thumbs.length > 0 ? Math.max(0, memberIds.length - thumbs.length) : 0;

      controls.push({
        id: 'members',
        label: 'Members',
        summary: this.memberCountLabel(memberIds.length),
        visual: thumbs.length > 0
          ? { kind: 'thumbStack', thumbs, maxVisible: maxVisibleThumbs }
          : { kind: 'icon', icon: 'groups' },
        badge: hiddenThumbCount > 0 ? { value: hiddenThumbCount, tone: 'danger' } : null,
        lookup: {
          type: 'chat',
          id: chatId
        }
      });
    }

    return {
      revision: this.chatHeaderRevision(chatId, title, memberIds),
      title,
      controls
    };
  }

  private static uniqueUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds.map(userId => userId.trim()).filter(Boolean))];
  }

  private static resolveChatMembers(
    chat: Pick<ChatDTO, 'memberIds' | 'members'>
  ): ChatMemberSummaryDto[] {
    return (chat.members ?? [])
      .map(member => ({
        ...member,
        id: `${member.id ?? ''}`.trim(),
        name: `${member.name ?? ''}`.trim() || null,
        initials: `${member.initials ?? ''}`.trim(),
        imageUrl: `${member.imageUrl ?? ''}`.trim() || null
      }))
      .filter(member => member.id.length > 0);
  }

  private static buildChatHeaderThumbs(
    members: readonly ChatMemberSummaryDto[],
    maxVisible: number
  ): PopupHeaderThumb[] {
    return members.slice(0, Math.max(0, Math.trunc(maxVisible))).map(member => {
      const label = `${member.name ?? ''}`.trim() || member.id;
      return {
        id: member.id,
        label,
        initials: `${member.initials ?? ''}`.trim() || AppUtils.initialsFromText(label),
        imageUrl: `${member.imageUrl ?? ''}`.trim() || null
      };
    });
  }

  private static memberCountLabel(count: number): string {
    return count === 1 ? '1 member' : `${count} members`;
  }

  private static chatHeaderRevision(chatId: string, title: string, memberIds: readonly string[]): string {
    return ['chat-header', chatId, title, ...memberIds].join(':');
  }
}

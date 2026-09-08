import { AppUtils } from '../../app-utils';
import type {
  ChatDTO,
  ChatMemberSummaryDto
} from '../../core/contracts/chat.interface';
import type { UserDto } from '../../core/contracts/user.interface';
import type {
  PopupHeaderContext,
  PopupHeaderControl,
  PopupHeaderThumb
} from '../models';

export interface ChatPopupHeaderContextConverterOptions {
  includeThumbs?: boolean;
}

export interface ChatMemberSummarySource {
  id: string;
  user?: Pick<UserDto, 'id' | 'name' | 'initials' | 'gender' | 'images' | 'profileStatus'> | null;
  fallbackName?: string | null;
  imageUrl?: string | null;
}

export class ChatPopupHeaderContextConverter {
  static memberSummaries(sources: readonly ChatMemberSummarySource[]): ChatMemberSummaryDto[] {
    const seenUserIds = new Set<string>();
    return sources.flatMap(source => {
      const id = `${source.id ?? ''}`.trim();
      if (!id || seenUserIds.has(id)) {
        return [];
      }
      seenUserIds.add(id);
      const user = source.user?.id?.trim() === id ? source.user : null;
      const name = `${user?.name ?? source.fallbackName ?? ''}`.trim() || 'User';
      return [{
        id,
        name,
        initials: `${user?.initials ?? ''}`.trim() || AppUtils.initialsFromText(name),
        gender: user?.profileStatus === 'deleted'
          ? 'deleted' as const
          : user?.gender === 'woman' ? 'woman' as const : 'man' as const,
        imageUrl: AppUtils.firstImageUrl(user?.images) || `${source.imageUrl ?? ''}`.trim() || null
      }];
    });
  }

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
      revision: this.chatHeaderRevision(chatId, title, memberIds, chat.ownerStatus),
      title,
      titleBadge: chat.ownerStatus === 'DR'
        ? { label: 'activities.chat.event.status.underReview', tone: 'warning' }
        : null,
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

  private static chatHeaderRevision(
    chatId: string,
    title: string,
    memberIds: readonly string[],
    ownerStatus: ChatDTO['ownerStatus']
  ): string {
    return ['chat-header', chatId, title, ownerStatus ?? '', ...memberIds].join(':');
  }
}

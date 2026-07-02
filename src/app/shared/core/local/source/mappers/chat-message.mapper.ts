import type {
  ChatMessageAttachment,
  ChatMessageDto,
  ChatMessageReaction,
  ChatReadAvatar
} from '../../../contracts/chat.interface';
import type {
  ChatMessageAttachmentRecord,
  ChatMessageAvatarRecord,
  ChatMessageReactionRecord,
  ChatMessageRecord
} from '../entity/chat.entity';

export class LocalChatMessageMapper {
  static toDto(record: ChatMessageRecord): ChatMessageDto {
    return {
      id: record.messageId,
      clientId: record.clientId ?? undefined,
      sender: record.senderName,
      senderAvatar: this.avatarToDto(record.senderAvatar),
      text: record.bodyText,
      time: record.timeLabel,
      sentAtIso: record.sentAtIso,
      mine: record.mine,
      readBy: (record.readBy ?? []).map(reader => this.avatarToDto(reader)),
      deliveryState: record.deliveryState ?? undefined,
      deletedAtIso: record.deletedAtIso,
      deletedByUserId: record.deletedByUserId,
      deletedByName: record.deletedByName,
      editedAtIso: record.editedAtIso,
      pinnedAtIso: record.pinnedAtIso,
      pinnedByUserId: record.pinnedByUserId,
      replyTo: record.replyTo ? {
        id: record.replyTo.messageId,
        sender: record.replyTo.senderName,
        text: record.replyTo.bodyText
      } : record.replyTo,
      reactions: (record.reactions ?? []).map(reaction => this.reactionToDto(reaction)),
      attachments: (record.attachments ?? []).map(attachment => this.attachmentToDto(attachment))
    };
  }

  static toRecord(ownerUserId: string, chatId: string, dto: ChatMessageDto): ChatMessageRecord {
    const normalizedOwnerUserId = `${ownerUserId ?? ''}`.trim();
    const normalizedChatId = `${chatId ?? ''}`.trim();
    const messageId = `${dto.id ?? ''}`.trim();
    return {
      recordId: this.recordKey(normalizedOwnerUserId, normalizedChatId, messageId),
      ownerUserId: normalizedOwnerUserId,
      chatId: normalizedChatId,
      messageId,
      clientId: dto.clientId ?? null,
      senderName: `${dto.sender ?? ''}`.trim(),
      senderAvatar: this.avatarToRecord(dto.senderAvatar),
      bodyText: `${dto.text ?? ''}`,
      timeLabel: `${dto.time ?? ''}`.trim(),
      sentAtIso: `${dto.sentAtIso ?? ''}`.trim(),
      mine: dto.mine === true,
      readBy: (dto.readBy ?? []).map(reader => this.avatarToRecord(reader)),
      deliveryState: dto.deliveryState ?? null,
      deletedAtIso: dto.deletedAtIso ?? null,
      deletedByUserId: dto.deletedByUserId ?? null,
      deletedByName: dto.deletedByName ?? null,
      editedAtIso: dto.editedAtIso ?? null,
      pinnedAtIso: dto.pinnedAtIso ?? null,
      pinnedByUserId: dto.pinnedByUserId ?? null,
      replyTo: dto.replyTo ? {
        messageId: `${dto.replyTo.id ?? ''}`.trim(),
        senderName: `${dto.replyTo.sender ?? ''}`.trim(),
        bodyText: `${dto.replyTo.text ?? ''}`
      } : dto.replyTo,
      reactions: (dto.reactions ?? []).map(reaction => this.reactionToRecord(reaction)),
      attachments: (dto.attachments ?? []).map(attachment => this.attachmentToRecord(attachment))
    };
  }

  static toDtoList(records: readonly ChatMessageRecord[]): ChatMessageDto[] {
    return records.map(record => this.toDto(record));
  }

  static recordKey(ownerUserId: string, chatId: string, messageId: string): string {
    return `${ownerUserId.trim()}:${chatId.trim()}:${messageId.trim()}`;
  }

  static chatKey(ownerUserId: string, chatId: string): string {
    return `${ownerUserId.trim()}:${chatId.trim()}`;
  }

  private static avatarToDto(record: ChatMessageAvatarRecord): ChatReadAvatar {
    return {
      id: record.userId,
      initials: record.initials,
      gender: record.gender,
      imageUrl: record.imageUrl
    };
  }

  private static avatarToRecord(dto: ChatReadAvatar): ChatMessageAvatarRecord {
    return {
      userId: `${dto.id ?? ''}`.trim(),
      initials: `${dto.initials ?? ''}`.trim(),
      gender: dto.gender,
      imageUrl: dto.imageUrl ?? null
    };
  }

  private static reactionToDto(record: ChatMessageReactionRecord): ChatMessageReaction {
    return {
      emoji: record.emoji,
      userId: record.userId,
      userName: record.userName,
      userInitials: record.userInitials,
      userGender: record.userGender,
      reactedAtIso: record.reactedAtIso
    };
  }

  private static reactionToRecord(dto: ChatMessageReaction): ChatMessageReactionRecord {
    return {
      emoji: `${dto.emoji ?? ''}`.trim(),
      userId: `${dto.userId ?? ''}`.trim(),
      userName: `${dto.userName ?? ''}`.trim(),
      userInitials: `${dto.userInitials ?? ''}`.trim(),
      userGender: dto.userGender,
      reactedAtIso: `${dto.reactedAtIso ?? ''}`.trim()
    };
  }

  private static attachmentToDto(record: ChatMessageAttachmentRecord): ChatMessageAttachment {
    return {
      id: record.attachmentId,
      type: record.type,
      title: record.title,
      entityId: record.entityId,
      assetType: record.assetType,
      ownerUserId: record.ownerUserId,
      status: record.status,
      unavailableReason: record.unavailableReason,
      subtitle: record.subtitle,
      description: record.description,
      url: record.url,
      previewUrl: record.previewUrl,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes
    };
  }

  private static attachmentToRecord(dto: ChatMessageAttachment): ChatMessageAttachmentRecord {
    return {
      attachmentId: `${dto.id ?? ''}`.trim(),
      type: dto.type,
      title: `${dto.title ?? ''}`.trim(),
      entityId: dto.entityId ?? null,
      assetType: dto.assetType ?? null,
      ownerUserId: dto.ownerUserId ?? null,
      status: dto.status ?? null,
      unavailableReason: dto.unavailableReason ?? null,
      subtitle: dto.subtitle ?? null,
      description: dto.description ?? null,
      url: dto.url ?? null,
      previewUrl: dto.previewUrl ?? null,
      mimeType: dto.mimeType ?? null,
      sizeBytes: dto.sizeBytes ?? null
    };
  }
}

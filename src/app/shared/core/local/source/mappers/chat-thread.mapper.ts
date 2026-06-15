import type {
  ActivitiesChatPageResultDTO,
  ChatDTO,
  ChatPopupMessage
} from '../../../contracts/chat.interface';
import type { ChatThreadRecord } from '../entity/chat.entity';


export class LocalChatThreadMapper {
  static toDTO(record: ChatThreadRecord): ChatDTO {
    return {
      id: record.id,
      avatar: record.avatar,
      title: record.title,
      lastMessage: record.lastMessage,
      lastSenderId: record.lastSenderId,
      memberIds: [...(record.memberIds ?? [])],
      unread: Math.max(0, Math.trunc(Number(record.unread) || 0)),
      dateIso: record.dateIso,
      distanceKm: record.distanceKm,
      distanceMetersExact: record.distanceMetersExact,
      channelType: record.channelType,
      serviceContext: record.serviceContext,
      eventId: record.eventId,
      subEventId: record.subEventId,
      groupId: record.groupId,
      supportCaseStatus: record.supportCaseStatus ?? null,
      supportCaseAssigneeUserId: record.supportCaseAssigneeUserId ?? null,
      supportCaseAssigneeName: record.supportCaseAssigneeName ?? null,
      supportCaseAssigneeInitials: record.supportCaseAssigneeInitials ?? null,
      supportCaseUpdatedAtIso: record.supportCaseUpdatedAtIso ?? null,
      ownerUserId: record.ownerUserId
    };
  }

  static toDTOList(records: readonly ChatThreadRecord[]): ChatDTO[] {
    return records.map(record => this.toDTO(record));
  }

  static toDTOPage(page: {
    items: readonly ChatThreadRecord[];
    total: number;
    nextCursor?: string | null;
  }): ActivitiesChatPageResultDTO {
    return {
      items: this.toDTOList(page.items),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: page.nextCursor ?? null
    };
  }

  static cloneRecord(record: ChatThreadRecord, options: { includeMessages?: boolean } = {}): ChatThreadRecord {
    return {
      ...record,
      memberIds: [...record.memberIds],
      messages: options.includeMessages === false
        ? undefined
        : this.cloneMessages(record.messages ?? [])
    };
  }

  static cloneMessages(messages: readonly ChatPopupMessage[]): ChatPopupMessage[] {
    return messages.map(message => ({
      ...message,
      senderAvatar: { ...message.senderAvatar },
      readBy: message.readBy.map(reader => ({ ...reader })),
      attachments: message.attachments?.map(attachment => ({ ...attachment })),
      replyTo: message.replyTo ? { ...message.replyTo } : message.replyTo,
      reactions: message.reactions?.map(reaction => ({ ...reaction }))
    }));
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }
}

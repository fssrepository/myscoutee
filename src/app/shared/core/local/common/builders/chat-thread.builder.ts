import type { ChatThreadRecord } from '../../source/entity/chat.entity';
import type { ChatPopupMessage } from '../../../base/models/chat.model';


export class ChatThreadBuilder {
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

import type {
  ActivitiesChatPageResultDTO,
  ChatDTO,
  ChatMetricsDTO
} from '../../../contracts/chat.interface';
import type { RecordToDtoListMapper } from './mapper.types';
import type { ChatThreadRecord } from '../entity/chat.entity';


export class LocalChatThreadMapper {
  static toDto(record: ChatThreadRecord): ChatDTO {
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
      ownerId: record.ownerId,
      supportCase: this.cloneSupportCase(record.supportCase),
      ownerUserId: record.ownerUserId,
      metrics: null
    };
  }

  static toDtoList(records: readonly ChatThreadRecord[]): ChatDTO[] {
    return records.map(record => this.toDto(record));
  }

  static toMap(records: readonly ChatThreadRecord[]): Map<string, ChatDTO> {
    return new Map(
      (records ?? [])
        .map(record => [record.id, this.toDto(record)] as const)
    );
  }

  static toDtoPage(page: {
    items: readonly ChatThreadRecord[];
    total: number;
    nextCursor?: string | null;
  }): ActivitiesChatPageResultDTO {
    return {
      items: this.toDtoList(page.items),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: page.nextCursor ?? null
    };
  }

  static withMetrics(dto: ChatDTO, metrics: ChatMetricsDTO | null | undefined): ChatDTO {
    return {
      ...dto,
      memberIds: [...(dto.memberIds ?? [])],
      supportCase: this.cloneSupportCase(dto.supportCase),
      metrics: this.cloneMetrics(metrics)
    };
  }

  static cloneRecord(record: ChatThreadRecord): ChatThreadRecord {
    return {
      ...record,
      memberIds: [...record.memberIds],
      supportCase: this.cloneSupportCase(record.supportCase)
    };
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }

  private static cloneSupportCase<T extends ChatDTO['supportCase']>(supportCase: T): T {
    return supportCase
      ? {
          ...supportCase,
          assignee: supportCase.assignee ? { ...supportCase.assignee } : supportCase.assignee
        } as T
      : supportCase;
  }

  private static cloneMetrics(metrics: ChatMetricsDTO | null | undefined): ChatMetricsDTO | null {
    return metrics
      ? {
          members: metrics.members ? { ...metrics.members } : null,
          car: metrics.car ? { ...metrics.car } : null,
          accommodation: metrics.accommodation ? { ...metrics.accommodation } : null,
          supplies: metrics.supplies ? { ...metrics.supplies } : null,
          groupsCount: metrics.groupsCount ?? null,
          pendingTotal: Math.max(0, Math.trunc(Number(metrics.pendingTotal) || 0))
        }
      : null;
  }
}

export const localChatThreadMapper =
  LocalChatThreadMapper satisfies RecordToDtoListMapper<ChatThreadRecord, ChatDTO>;

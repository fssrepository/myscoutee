import type {
  NotificationDto,
  NotificationPageResponseDto
} from '../../../contracts/notification.interface';
import type { NotificationRecord } from '../entity/notification.entity';

export class LocalNotificationMapper {
  static toDto(record: NotificationRecord): NotificationDto {
    return {
      ...record,
      readAtIso: record.readAtIso ?? null,
      senderUserId: record.senderUserId ?? null,
      senderName: record.senderName ?? null,
      senderAvatarUrl: record.senderAvatarUrl ?? null,
      actionPath: record.actionPath ?? null,
      sourceType: record.sourceType ?? null,
      sourceId: record.sourceId ?? null,
      payload: record.payload ? { ...record.payload } : null
    };
  }

  static toDtoList(records: readonly NotificationRecord[]): NotificationDto[] {
    return records.map(record => this.toDto(record));
  }

  static toRecord(dto: NotificationDto): NotificationRecord {
    return {
      ...dto,
      readAtIso: dto.readAtIso ?? null,
      senderUserId: dto.senderUserId ?? null,
      senderName: dto.senderName ?? null,
      senderAvatarUrl: dto.senderAvatarUrl ?? null,
      actionPath: dto.actionPath ?? null,
      sourceType: dto.sourceType ?? null,
      sourceId: dto.sourceId ?? null,
      payload: dto.payload ? { ...dto.payload } : null
    };
  }

  static toDtoPage(page: {
    records: readonly NotificationRecord[];
    total: number;
    nextCursor: string | null;
    unreadCount: number;
    muted: boolean;
  }): NotificationPageResponseDto {
    return {
      records: this.toDtoList(page.records),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: `${page.nextCursor ?? ''}`.trim() || null,
      unreadCount: Math.max(0, Math.trunc(Number(page.unreadCount) || 0)),
      muted: page.muted === true
    };
  }
}

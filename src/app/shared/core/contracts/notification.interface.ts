import type { ListQuery, PageResult } from './list.interface';

export type NotificationBucket = 'new' | 'all';

export type NotificationCategory =
  | 'user'
  | 'chat'
  | 'event'
  | 'event-admin'
  | 'asset'
  | 'app-admin'
  | 'scheduled';

export interface NotificationDto {
  id: string;
  recipientUserId: string;
  kind: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAtIso: string;
  readAtIso?: string | null;
  senderUserId?: string | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  actionPath?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  payload?: Readonly<Record<string, string>> | null;
  occurrenceCount?: number | null;
}

export interface NotificationListFilters {
  bucket: NotificationBucket;
}

export interface NotificationPageContextDto {
  unreadCount: number;
  muted: boolean;
}

export type NotificationPageResultDto = PageResult<NotificationDto, NotificationPageContextDto>;

export interface NotificationPageResponseDto {
  records: NotificationDto[];
  total: number;
  nextCursor: string | null;
  unreadCount: number;
  muted: boolean;
}

export interface NotificationReadResponseDto {
  notification: NotificationDto;
  unreadCount: number;
}

export interface NotificationPreferencesRequestDto {
  muted: boolean;
}

export interface NotificationPreferencesResponseDto {
  muted: boolean;
}

export interface NotificationService {
  queryPage(
    userId: string,
    query: ListQuery<NotificationListFilters>,
    signal?: AbortSignal
  ): Promise<NotificationPageResultDto>;
  markRead(
    userId: string,
    notificationId: string,
    signal?: AbortSignal
  ): Promise<NotificationReadResponseDto>;
  updatePreferences(
    userId: string,
    request: NotificationPreferencesRequestDto,
    signal?: AbortSignal
  ): Promise<NotificationPreferencesResponseDto>;
}

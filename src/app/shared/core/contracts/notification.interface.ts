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
  revision: number;
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

export interface NotificationSyncKnownItemDto {
  id: string;
  revision: number;
}

export interface NotificationSyncBoundaryDto {
  id: string;
  createdAtIso: string;
}

export interface NotificationSyncRequestDto {
  bucket: NotificationBucket;
  limit: number;
  knownItems: readonly NotificationSyncKnownItemDto[];
  loadedTail: NotificationSyncBoundaryDto | null;
}

export interface NotificationSyncResponseDto {
  upserts: NotificationDto[];
  removedIds: string[];
  total: number;
  unreadCount: number;
  muted: boolean;
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
  sync(
    userId: string,
    request: NotificationSyncRequestDto,
    signal?: AbortSignal
  ): Promise<NotificationSyncResponseDto>;
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

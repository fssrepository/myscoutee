import type { NotificationCategory } from '../../../contracts/notification.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const NOTIFICATIONS_TABLE_NAME = APP_INDEXED_DB_KEYS.notifications;

export interface NotificationRecord {
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

export interface NotificationsRecordCollection {
  byId: Record<string, NotificationRecord>;
  ids: string[];
  idsByRecipientUserId: Record<string, string[]>;
  mutedByUserId: Record<string, boolean>;
  seededUserIds: string[];
}

export type NotificationsMemorySchema = Record<
  typeof NOTIFICATIONS_TABLE_NAME,
  NotificationsRecordCollection
>;

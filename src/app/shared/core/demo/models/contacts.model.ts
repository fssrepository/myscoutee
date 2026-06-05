import type { StoredContact } from '../../base/models/contact.model';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const CONTACTS_TABLE_NAME = APP_INDEXED_DB_KEYS.contacts;

export interface DemoContactsRecordCollection {
  byOwnerUserId: Record<string, StoredContact[]>;
  ownerUserIds: string[];
}

export type DemoContactsMemorySchema = Record<
  typeof CONTACTS_TABLE_NAME,
  DemoContactsRecordCollection
>;

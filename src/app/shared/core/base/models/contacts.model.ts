import type { StoredContact } from '../../contracts/contact.interface';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const CONTACTS_TABLE_NAME = APP_INDEXED_DB_KEYS.contacts;

export interface ContactsRecordCollection {
  byOwnerUserId: Record<string, StoredContact[]>;
  ownerUserIds: string[];
}

export type ContactsMemorySchema = Record<
  typeof CONTACTS_TABLE_NAME,
  ContactsRecordCollection
>;

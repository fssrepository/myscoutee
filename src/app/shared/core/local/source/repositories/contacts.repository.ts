import { CONTACTS_TABLE_NAME } from '../entity/profile.entity';
import { Injectable, inject } from '@angular/core';

import type { StoredContact } from '../../../contracts/contact.interface';
import { LocalMemoryDb } from '../../../common/app.db';

import { LocalContactsMapper } from '../mappers';

@Injectable({
  providedIn: 'root'
})
export class LocalContactsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryContactRecordsByUser(userId: string): StoredContact[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[CONTACTS_TABLE_NAME];
    return LocalContactsMapper.cloneContacts(table.byOwnerUserId[normalizedUserId] ?? []);
  }

  replaceContactRecordsForUser(
    userId: string,
    contacts: readonly StoredContact[]
  ): StoredContact[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const contactRecords = LocalContactsMapper.cloneContacts(contacts);
    this.memoryDb.write(state => {
      const table = state[CONTACTS_TABLE_NAME];
      const nextByOwnerUserId = { ...table.byOwnerUserId };
      const ownerUserIdSet = new Set(table.ownerUserIds);
      if (contactRecords.length > 0) {
        nextByOwnerUserId[normalizedUserId] = LocalContactsMapper.cloneContacts(contactRecords);
        ownerUserIdSet.add(normalizedUserId);
      } else {
        delete nextByOwnerUserId[normalizedUserId];
        ownerUserIdSet.delete(normalizedUserId);
      }
      return {
        ...state,
        [CONTACTS_TABLE_NAME]: {
          byOwnerUserId: nextByOwnerUserId,
          ownerUserIds: [...ownerUserIdSet]
        }
      };
    });
    return LocalContactsMapper.cloneContacts(contactRecords);
  }

  deleteContactRecord(userId: string, contactId: string): StoredContact[] {
    const normalizedContactId = contactId.trim();
    const nextContacts = this.queryContactRecordsByUser(userId)
      .filter(contact => contact.id !== normalizedContactId);
    return this.replaceContactRecordsForUser(userId, nextContacts);
  }
}

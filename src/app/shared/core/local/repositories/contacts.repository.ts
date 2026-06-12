import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { LocalMemoryDb } from '../../base/db';
import { CONTACTS_TABLE_NAME } from '../../base/models/contacts.model';

@Injectable({
  providedIn: 'root'
})
export class LocalContactsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryContactsByUser(userId: string): AppTypes.StoredContact[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[CONTACTS_TABLE_NAME];
    return this.cloneContacts(table.byOwnerUserId[normalizedUserId] ?? []);
  }

  replaceContactsForUser(
    userId: string,
    contacts: readonly AppTypes.StoredContact[]
  ): AppTypes.StoredContact[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedContacts = contacts
      .map(contact => this.toStoredContact(contact))
      .filter((contact): contact is AppTypes.StoredContact => Boolean(contact));
    this.memoryDb.write(state => {
      const table = state[CONTACTS_TABLE_NAME];
      const nextByOwnerUserId = { ...table.byOwnerUserId };
      const ownerUserIdSet = new Set(table.ownerUserIds);
      if (normalizedContacts.length > 0) {
        nextByOwnerUserId[normalizedUserId] = this.cloneContacts(normalizedContacts);
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
    return this.cloneContacts(normalizedContacts);
  }

  deleteContact(userId: string, contactId: string): AppTypes.StoredContact[] {
    const normalizedContactId = contactId.trim();
    const nextContacts = this.queryContactsByUser(userId)
      .filter(contact => contact.id !== normalizedContactId);
    return this.replaceContactsForUser(userId, nextContacts);
  }

  private toStoredContact(
    value: Partial<AppTypes.StoredContact> | null | undefined
  ): AppTypes.StoredContact | null {
    if (!value) {
      return null;
    }
    const id = `${value.id ?? ''}`.trim();
    const userId = `${value.userId ?? ''}`.trim();
    if (!id && !userId) {
      return null;
    }
    return {
      id: id || userId,
      userId,
      name: `${value.name ?? ''}`.trim() || 'Contact',
      initials: `${value.initials ?? ''}`.trim(),
      gender: value.gender === 'woman' ? 'woman' : 'man',
      city: `${value.city ?? ''}`.trim(),
      avatarUrl: `${value.avatarUrl ?? ''}`.trim(),
      headline: `${value.headline ?? ''}`.trim(),
      createdAtIso: `${value.createdAtIso ?? ''}`.trim(),
      updatedAtIso: `${value.updatedAtIso ?? ''}`.trim(),
      methods: (value.methods ?? [])
        .map(method => this.toMethodDraft(method))
        .filter((method): method is AppTypes.ContactMethodDraft => Boolean(method))
    };
  }

  private toMethodDraft(
    value: Partial<AppTypes.ContactMethodDraft> | null | undefined
  ): AppTypes.ContactMethodDraft | null {
    if (!value) {
      return null;
    }
    const type = `${value.type ?? ''}`.trim() as AppTypes.ContactMethodType;
    const methodType: AppTypes.ContactMethodType = [
      'phone',
      'sms',
      'whatsapp',
      'email',
      'facebook',
      'instagram',
      'telegram',
      'linkedin',
      'website'
    ].includes(type) ? type : 'phone';
    const methodValue = `${value.value ?? ''}`.trim();
    if (!methodValue) {
      return null;
    }
    return {
      id: `${value.id ?? ''}`.trim(),
      type: methodType,
      value: methodValue
    };
  }

  private cloneContacts(contacts: readonly AppTypes.StoredContact[]): AppTypes.StoredContact[] {
    return contacts.map(contact => ({
      ...contact,
      methods: contact.methods.map(method => ({ ...method }))
    }));
  }
}

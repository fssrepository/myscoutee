import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoMemoryDb } from '../../base/db';
import type { UserDto } from '../../base/interfaces/user.interface';
import { CONTACTS_TABLE_NAME } from '../models/contacts.model';

const DEMO_CONTACT_OWNER_USER_ID = 'bf057de7c586eede7e84bdc7';
const DEMO_CONTACT_UPDATED_AT_ISO = '2026-05-04T00:00:00Z';
const DEMO_CONTACT_METHODS_BY_USER_ID: Record<string, AppTypes.ContactMethodDraft[]> = {
  b29df68956f3fe15e04558de: [
    { id: 'kb-phone', type: 'phone', value: '+1 312 555 0184' },
    { id: 'kb-email', type: 'email', value: 'balazs.kiss@example.com' }
  ],
  '9f3b3f085e23af6c89dbc432': [
    { id: 'ne-instagram', type: 'instagram', value: 'eszter.groups' },
    { id: 'ne-telegram', type: 'telegram', value: '@eszter_groups' }
  ],
  '1b1c70be2349b3359a8f6f94': [
    { id: 'ms-whatsapp', type: 'whatsapp', value: '+1 619 555 0142' },
    { id: 'ms-linkedin', type: 'linkedin', value: 'https://www.linkedin.com/in/maya-stone-demo' }
  ]
};
const DEMO_CONTACT_CREATED_AT_BY_USER_ID: Record<string, string> = {
  b29df68956f3fe15e04558de: '2026-04-22T08:15:00Z',
  '9f3b3f085e23af6c89dbc432': '2026-04-24T10:30:00Z',
  '1b1c70be2349b3359a8f6f94': '2026-04-29T17:45:00Z'
};

@Injectable({
  providedIn: 'root'
})
export class DemoContactsRepository {
  private readonly memoryDb = inject(DemoMemoryDb);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  seedDefaultContacts(users: readonly UserDto[]): boolean {
    const ownerUserId = DEMO_CONTACT_OWNER_USER_ID;
    if (this.queryContactsByUser(ownerUserId).length > 0) {
      return false;
    }
    const usersById = new Map(users.map(user => [user.id.trim(), user]));
    const contacts = Object.entries(DEMO_CONTACT_METHODS_BY_USER_ID)
      .map(([contactUserId, methods]) => this.toSeedContact(usersById.get(contactUserId), methods))
      .filter((contact): contact is AppTypes.StoredContact => Boolean(contact));
    if (contacts.length === 0) {
      return false;
    }
    this.replaceContactsForUser(ownerUserId, contacts);
    return true;
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

  private toSeedContact(
    user: UserDto | undefined,
    methods: readonly AppTypes.ContactMethodDraft[]
  ): AppTypes.StoredContact | null {
    const userId = user?.id?.trim() ?? '';
    if (!user || !userId) {
      return null;
    }
    return {
      id: userId,
      userId,
      name: `${user.name ?? ''}`.trim() || 'Contact',
      initials: `${user.initials ?? ''}`.trim(),
      gender: user.gender === 'woman' ? 'woman' : 'man',
      city: `${user.city ?? ''}`.trim(),
      avatarUrl: `${user.images?.[0] ?? ''}`.trim(),
      headline: `${user.headline ?? user.statusText ?? ''}`.trim(),
      createdAtIso: DEMO_CONTACT_CREATED_AT_BY_USER_ID[userId] ?? DEMO_CONTACT_UPDATED_AT_ISO,
      updatedAtIso: DEMO_CONTACT_UPDATED_AT_ISO,
      methods: methods.map(method => ({ ...method }))
    };
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

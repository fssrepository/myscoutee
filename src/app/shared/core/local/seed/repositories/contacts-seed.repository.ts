import { CONTACTS_TABLE_NAME } from '../../source/entity/profile.entity';
import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../base/models';
import { LocalMemoryDb } from '../../../common/app.db';
import type { UserRecord } from '../../source/entity/user.entity';

import type * as ContactContracts from '../../../contracts/contact.interface';

const DEMO_CONTACT_OWNER_USER_ID = 'bf057de7c586eede7e84bdc7';
const DEMO_CONTACT_UPDATED_AT_ISO = '2026-05-04T00:00:00Z';
const DEMO_CONTACT_METHODS_BY_USER_ID: Record<string, ContactContracts.ContactMethodDraft[]> = {
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
export class SeedContactsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  seedDefaultContacts(users: readonly UserRecord[]): boolean {
    const ownerUserId = DEMO_CONTACT_OWNER_USER_ID;
    const table = this.memoryDb.read()[CONTACTS_TABLE_NAME];
    if ((table.byOwnerUserId[ownerUserId] ?? []).length > 0) {
      return false;
    }
    const usersById = new Map(users.map(user => [user.id.trim(), user]));
    const contacts = Object.entries(DEMO_CONTACT_METHODS_BY_USER_ID)
      .map(([contactUserId, methods]) => this.toSeedContact(usersById.get(contactUserId), methods))
      .filter((contact): contact is ContactContracts.StoredContact => Boolean(contact));
    if (contacts.length === 0) {
      return false;
    }
    this.memoryDb.write(state => {
      const current = state[CONTACTS_TABLE_NAME];
      return {
        ...state,
        [CONTACTS_TABLE_NAME]: {
          byOwnerUserId: {
            ...current.byOwnerUserId,
            [ownerUserId]: contacts.map(contact => this.cloneContact(contact))
          },
          ownerUserIds: [...new Set([...current.ownerUserIds, ownerUserId])]
        }
      };
    });
    return true;
  }

  private toSeedContact(
    user: UserRecord | undefined,
    methods: readonly ContactContracts.ContactMethodDraft[]
  ): ContactContracts.StoredContact | null {
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

  private cloneContact(contact: ContactContracts.StoredContact): ContactContracts.StoredContact {
    return {
      ...contact,
      methods: contact.methods.map(method => ({ ...method }))
    };
  }
}

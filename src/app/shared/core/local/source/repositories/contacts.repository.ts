import { CONTACTS_TABLE_NAME, type ContactChatAccessRecord } from '../entity/profile.entity';
import { Injectable, inject } from '@angular/core';

import type { StoredContact, ContactChatAccess, ContactChatAccessAction } from '../../../contracts/contact.interface';
import { LocalMemoryDb } from '../../../common/app.db';

import { USERS_TABLE_NAME } from '../entity/user.entity';
import { LocalNotificationsRepository } from './notifications.repository';
import { AppUtils } from '../../../../app-utils';
import { LocalContactsMapper } from '../mappers';
import { LocalUsersRepository } from './users.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalContactsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly notifications = inject(LocalNotificationsRepository);
  private readonly users = inject(LocalUsersRepository);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  queryContactRecordsByUser(userId: string): StoredContact[] {
    const normalizedUserId = this.users.accountId(userId);
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
    const normalizedUserId = this.users.accountId(userId);
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
        [USERS_TABLE_NAME]: { ...state[USERS_TABLE_NAME], byId: { ...state[USERS_TABLE_NAME].byId,
          ...(state[USERS_TABLE_NAME].byId[normalizedUserId] ? { [normalizedUserId]: {
            ...state[USERS_TABLE_NAME].byId[normalizedUserId], activities: {
              ...state[USERS_TABLE_NAME].byId[normalizedUserId].activities, contacts: contactRecords.length
            }
          } } : {}) } },
        [CONTACTS_TABLE_NAME]: {
          ...table,
          byOwnerUserId: nextByOwnerUserId,
          ownerUserIds: [...ownerUserIdSet]
        }
      };
    });
    return LocalContactsMapper.cloneContacts(contactRecords);
  }

  queryChatAccess(actor: string): ContactChatAccess[] {
    const state = this.memoryDb.read();
    const owner = state[USERS_TABLE_NAME].byId[actor];
    return Object.values(state[CONTACTS_TABLE_NAME].chatAccessById ?? {})
      .filter(value => value.leftUserId === actor || value.rightUserId === actor)
      .filter(value => {
        const peer = state[USERS_TABLE_NAME].byId[value.leftUserId === actor ? value.rightUserId : value.leftUserId];
        return !!owner && !!peer && !peer.deletedAtIso && peer.profileStatus !== 'deleted'
          && (owner.workspaceGroupId ?? '') === (peer.workspaceGroupId ?? '');
      })
      .map(value => this.chatAccessDto(value, actor))
      .sort((a, b) => b.requestedAtIso.localeCompare(a.requestedAtIso) || a.id.localeCompare(b.id));
  }

  isChatApproved(first: string, second: string): boolean {
    const record = this.memoryDb.read()[CONTACTS_TABLE_NAME].chatAccessById?.[this.pairId(first, second)];
    return record?.status === 'approved';
  }

  changeChatAccess(actor: string, target: string, action: ContactChatAccessAction, version?: number): ContactChatAccess {
    const state = this.memoryDb.read();
    const owner = state[USERS_TABLE_NAME].byId[actor], peer = state[USERS_TABLE_NAME].byId[target];
    if (!owner || !peer || target === actor || peer.deletedAtIso || peer.profileStatus === 'deleted'
      || (owner.workspaceGroupId ?? '') !== (peer.workspaceGroupId ?? '')) throw new Error('Contact unavailable.');
    const id = this.pairId(actor, target);
    const current = state[CONTACTS_TABLE_NAME].chatAccessById?.[id];
    const now = new Date().toISOString();
    let next: ContactChatAccessRecord;
    if (action === 'request') {
      if (!this.queryContactRecordsByUser(actor).some(contact => contact.userId === target)) throw new Error('Save the contact first.');
      if (current && current.status !== 'rejected') return this.chatAccessDto(current, actor);
      const [leftUserId, rightUserId] = [actor, target].sort();
      next = { id, leftUserId, rightUserId, requestedBy: actor, status: 'pending', requestedAtIso: now, decidedAtIso: null,
        version: (current?.version ?? -1) + 1 };
    } else {
      if (!current || current.requestedBy === actor) throw new Error('Only the recipient can decide.');
      const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
      if (!status) throw new Error('Unknown chat access action.');
      if (current.status === status) return this.chatAccessDto(current, actor);
      if (current.status !== 'pending' || current.version !== version) throw new Error('The request has changed.');
      next = { ...current, status, decidedAtIso: now, version: current.version + 1 };
    }
    const contacts = this.queryContactRecordsByUser(actor);
    const addContact = next.status === 'approved' && !contacts.some(contact => contact.userId === target);
    if (addContact) contacts.push(this.chatAccessDto(next, actor).contact);
    const counterOwner = next.status === 'pending' ? target : actor;
    this.memoryDb.write(snapshot => {
      const recipient = snapshot[USERS_TABLE_NAME].byId[counterOwner];
      return { ...snapshot,
        [CONTACTS_TABLE_NAME]: { ...snapshot[CONTACTS_TABLE_NAME],
          ...(addContact ? { byOwnerUserId: { ...snapshot[CONTACTS_TABLE_NAME].byOwnerUserId, [actor]: contacts },
            ownerUserIds: [...new Set([...snapshot[CONTACTS_TABLE_NAME].ownerUserIds, actor])] } : {}),
          chatAccessById: { ...snapshot[CONTACTS_TABLE_NAME].chatAccessById, [id]: next } },
        [USERS_TABLE_NAME]: { ...snapshot[USERS_TABLE_NAME], byId: { ...snapshot[USERS_TABLE_NAME].byId,
          [counterOwner]: { ...recipient, activities: { ...recipient.activities,
            ...(addContact ? { contacts: contacts.length } : {}),
            contactRequestsPending: Math.max(0, (recipient.activities.contactRequestsPending ?? 0) + (next.status === 'pending' ? 1 : -1)) } } } }
      };
    });
    const kind = 'contact-chat-' + (next.status === 'pending' ? 'requested' : next.status);
    this.notifications.append([{ id: `${kind}:${id}:${next.version}`, recipientUserId: target, kind, category: 'chat',
      title: 'MyScoutee', message: `notification.kind.${kind}.message`, createdAtIso: now, senderUserId: actor,
      senderName: owner.name, senderAvatarUrl: AppUtils.firstImageUrl(owner.images), sourceType: 'contact', sourceId: id,
      actionPath: '/game', payload: { notification_message_key: `notification.kind.${kind}.message`, contactUserId: actor }, revision: 1 }]);
    return this.chatAccessDto(next, actor);
  }

  private chatAccessDto(value: ContactChatAccessRecord, actor: string): ContactChatAccess {
    const peerId = value.leftUserId === actor ? value.rightUserId : value.leftUserId;
    const peer = this.memoryDb.read()[USERS_TABLE_NAME].byId[peerId];
    return { id: value.id, requestedBy: value.requestedBy, status: value.status,
      requestedAtIso: value.requestedAtIso, decidedAtIso: value.decidedAtIso, version: value.version,
      contact: { id: peerId, userId: peerId, name: peer.name, initials: peer.initials, gender: peer.gender,
        city: peer.city, avatarUrl: AppUtils.firstImageUrl(peer.images), headline: '', methods: [],
        createdAtIso: value.requestedAtIso, updatedAtIso: value.decidedAtIso ?? value.requestedAtIso } };
  }

  private pairId(first: string, second: string): string {
    const [left, right] = [first, second].sort();
    return `${left.length}:${left}${right}`;
  }

  deleteContactRecord(userId: string, contactId: string): StoredContact[] {
    const normalizedContactId = contactId.trim();
    const nextContacts = this.queryContactRecordsByUser(userId)
      .filter(contact => contact.id !== normalizedContactId);
    return this.replaceContactRecordsForUser(userId, nextContacts);
  }
}

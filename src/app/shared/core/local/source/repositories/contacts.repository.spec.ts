import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import type { StoredContact } from '../../../contracts/contact.interface';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';
import { CONTACTS_TABLE_NAME } from '../entity/profile.entity';
import { NOTIFICATIONS_TABLE_NAME } from '../entity/notification.entity';
import { LocalContactsRepository } from './contacts.repository';
import { LocalChatsRepository } from './chats.repository';

describe('Contact chat permission writes', () => {
  let db: LocalMemoryDb;
  let contacts: LocalContactsRepository;
  let chats: LocalChatsRepository;
  const saved = (id: string): StoredContact => ({ id, userId: id, name: id, initials: id,
    gender: 'man', city: '', avatarUrl: '', headline: '', createdAtIso: '', updatedAtIso: '',
    methods: [{ id: 'phone', type: 'phone', value: 'private number' }] });
  beforeEach(async () => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(LocalMemoryDb);
    await db.whenReady();
    contacts = TestBed.inject(LocalContactsRepository);
    chats = TestBed.inject(LocalChatsRepository);
    db.write(state => ({ ...state,
      [CONTACTS_TABLE_NAME]: { byOwnerUserId: {}, ownerUserIds: [], chatAccessById: {} },
      [NOTIFICATIONS_TABLE_NAME]: { ...state[NOTIFICATIONS_TABLE_NAME], byId: {}, ids: [] },
      [USERS_TABLE_NAME]: { byId: Object.fromEntries(['a', 'b', 'c'].map(id => [id, {
        id, name: id, initials: id, gender: 'man', city: '', images: [], profileStatus: 'public',
        age: 30, birthday: '1996-01-01', height: '', physique: '', languages: [], horoscope: '', statusText: '',
        hostTier: '', traitLabel: '', completion: 100, headline: '', about: '', activities: { game: 0, chats: 0, invitations: 0, events: 0, hosting: 0, contacts: 0 }
      } as UserRecord])), ids: ['a', 'b', 'c'] }
    }));
    contacts.replaceContactRecordsForUser('a', [saved('b')]);
  });
  afterEach(() => TestBed.resetTestingModule());
  const notices = () => Object.values(db.read()[NOTIFICATIONS_TABLE_NAME].byId);
  const pending = (id: string) => db.read()[USERS_TABLE_NAME].byId[id].activities.contactRequestsPending ?? 0;

  it('resolves contact reads and edits to the account in the repository', () => {
    db.write(state => ({...state, [USERS_TABLE_NAME]: {...state[USERS_TABLE_NAME],
      ids: [...state[USERS_TABLE_NAME].ids, 'a-group'],
      byId: {...state[USERS_TABLE_NAME].byId, 'a-group': {...state[USERS_TABLE_NAME].byId['a'],
        id: 'a-group', accountUserId: 'a', workspaceGroupId: 'group'}}
    }}));
    expect(contacts.queryContactRecordsByUser('a-group')).toEqual(contacts.queryContactRecordsByUser('a'));
    contacts.replaceContactRecordsForUser('a-group', [saved('b'), saved('c')]);
    expect(contacts.queryContactRecordsByUser('a').map(c => c.userId)).toEqual(['b', 'c']);
    expect(db.read()[CONTACTS_TABLE_NAME].byOwnerUserId['a-group']).toBeUndefined();
  });

  it('saving a contact grants no chat access; request notifies only the recipient once', () => {
    expect(() => chats.ensureContactChat('a', 'b')).toThrow();
    const requested = contacts.changeChatAccess('a', 'b', 'request');
    expect(requested.status).toBe('pending');
    expect(pending('b')).toBe(1);
    expect(pending('a')).toBe(0);
    expect(notices().map(n => n.recipientUserId)).toEqual(['b']);
    expect(contacts.queryChatAccess('b')[0].contact.methods).toEqual([]);
    expect(contacts.queryContactRecordsByUser('b')).toEqual([]);
    expect(contacts.changeChatAccess('a', 'b', 'request')).toEqual(requested);
    expect(pending('b')).toBe(1);
    expect(notices()).toHaveLength(1);
    expect(() => chats.ensureContactChat('a', 'b')).toThrow();
  });

  it('approval moves the recipient into contacts, preserves private methods and enables the existing direct chat', () => {
    const request = contacts.changeChatAccess('a', 'b', 'request');
    const approved = contacts.changeChatAccess('b', 'a', 'approve', request.version);
    expect(approved.status).toBe('approved');
    expect(pending('b')).toBe(0);
    expect(contacts.queryContactRecordsByUser('b').map(c => c.userId)).toEqual(['a']);
    expect(db.read()[USERS_TABLE_NAME].byId['b'].activities.contacts).toBe(1);
    expect(contacts.queryContactRecordsByUser('b')[0].methods).toEqual([]);
    expect(contacts.queryContactRecordsByUser('a')[0].methods[0].value).toBe('private number');
    expect(notices().map(n => [n.kind, n.recipientUserId])).toEqual([
      ['contact-chat-requested', 'b'], ['contact-chat-approved', 'a']
    ]);
    const direct = chats.ensureContactChat('a', 'b');
    expect(chats.ensureContactChat('b', 'a').id).toBe(direct.id);
    contacts.changeChatAccess('b', 'a', 'approve', request.version);
    expect(pending('b')).toBe(0);
    expect(notices()).toHaveLength(2);
    expect(contacts.queryContactRecordsByUser('b')).toHaveLength(1);
  });

  it('rejects actor approval, stale decisions, strangers and other workspaces without side effects', () => {
    const request = contacts.changeChatAccess('a', 'b', 'request');
    expect(() => contacts.changeChatAccess('a', 'b', 'approve', request.version)).toThrow();
    expect(() => contacts.changeChatAccess('b', 'a', 'approve', request.version + 1)).toThrow();
    expect(() => contacts.changeChatAccess('c', 'a', 'request')).toThrow();
    db.write(state => ({ ...state, [USERS_TABLE_NAME]: { ...state[USERS_TABLE_NAME], byId: {
      ...state[USERS_TABLE_NAME].byId, b: { ...state[USERS_TABLE_NAME].byId['b'], workspaceGroupId: 'foreign' }
    } } }));
    expect(() => contacts.changeChatAccess('b', 'a', 'approve', request.version)).toThrow();
    expect(contacts.queryChatAccess('b')).toEqual([]);
    expect(pending('b')).toBe(1);
    expect(notices()).toHaveLength(1);
  });

  it('rejects and permits a new request, without duplicating the pending counter on retries', () => {
    const request = contacts.changeChatAccess('a', 'b', 'request');
    contacts.changeChatAccess('b', 'a', 'reject', request.version);
    expect(pending('b')).toBe(0);
    expect(contacts.queryContactRecordsByUser('b')).toEqual([]);
    expect(() => chats.ensureContactChat('a', 'b')).toThrow();
    contacts.changeChatAccess('b', 'a', 'reject', request.version);
    const retry = contacts.changeChatAccess('a', 'b', 'request');
    expect(retry.version).toBeGreaterThan(request.version);
    expect(pending('b')).toBe(1);
    expect(notices().map(n => n.recipientUserId)).toEqual(['b', 'a', 'b']);
    expect(() => contacts.changeChatAccess('b', 'a', 'approve', request.version)).toThrow();
  });

  it('contact edits keep accepted permission records and update only the saved-contact count', () => {
    const request = contacts.changeChatAccess('a', 'b', 'request');
    contacts.changeChatAccess('b', 'a', 'approve', request.version);
    contacts.replaceContactRecordsForUser('a', [saved('b'), saved('c')]);
    expect(contacts.isChatApproved('a', 'b')).toBe(true);
    expect(db.read()[USERS_TABLE_NAME].byId['a'].activities.contacts).toBe(2);
    expect(pending('a')).toBe(0);
    expect(pending('b')).toBe(0);
  });
});

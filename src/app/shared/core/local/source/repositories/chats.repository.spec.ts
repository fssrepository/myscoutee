import { CONTACTS_TABLE_NAME } from '../entity/profile.entity';
import type { StoredContact } from '../../../contracts/contact.interface';
import { CHATS_TABLE_NAME } from '../entity/chat.entity';
import type { ChatThreadRecord } from '../entity/chat.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import type { UserRecord } from '../entity/user.entity';
import { TestBed } from '@angular/core/testing';

import type * as ContractTypes from '../../../contracts';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { LocalMemoryDb } from '../../../common/app.db';

import { LocalChatsRepository } from './chats.repository';

describe('LocalChatsRepository chat pages', () => {
  let memoryDb: LocalMemoryDb;
  let repository: LocalChatsRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.whenReady();
    repository = TestBed.inject(LocalChatsRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens one eventless conversation for saved contacts and limits member invitations to that list', () => {
    for (const id of ['contact-a', 'contact-b', 'contact-c', 'outsider']) seedUser(user(id));
    const contacts = ['contact-b', 'contact-c'].map(id => ({ userId: id } as StoredContact));
    memoryDb.write(state => ({ ...state, [CONTACTS_TABLE_NAME]: {
      ownerUserIds: ['contact-a'], byOwnerUserId: { 'contact-a': contacts }
    } }));
    const direct = repository.ensureContactChat('contact-a', 'contact-b');
    expect(direct.channelType).toBe('contact');
    expect(direct.eventId).toBeUndefined();
    expect(repository.queryChatItemById('contact-b', direct.id)?.memberIds).toEqual(['contact-a', 'contact-b']);
    expect(repository.ensureContactChat('contact-a', 'contact-b').id).toBe(direct.id);
    expect(() => repository.addContactChatMembers('contact-a', direct.id, ['outsider'])).toThrow();
    expect(repository.queryChatItemById('outsider', direct.id)).toBeNull();
    const updated = repository.addContactChatMembers('contact-a', direct.id, ['contact-c']);
    expect(updated.memberIds).toEqual(['contact-a', 'contact-b', 'contact-c']);
    expect(repository.queryChatItemById('contact-c', direct.id)?.memberIds).toEqual(updated.memberIds);
    const page = repository.queryActivitiesChatPage('contact-a', pageRequest({ filters: {chatContextFilter: 'contacts'} }));
    expect(page.items.map(item => item.id)).toEqual([direct.id]);
  });

  it('sends one persisted share to both contact members and deletes the old message in both copies', () => {
    for (const id of ['share-a', 'share-b']) seedUser(user(id));
    memoryDb.write(state => ({ ...state, [CONTACTS_TABLE_NAME]: {
      ownerUserIds: ['share-a'], byOwnerUserId: { 'share-a': [{ userId: 'share-b' } as StoredContact] }
    } }));
    const direct = repository.ensureContactChat('share-a', 'share-b');
    const before = memoryDb.read()[USERS_TABLE_NAME].byId['share-b'].activities.chats ?? 0;
    const message: ContractTypes.ChatMessageDto = { id: 'shared-stable-id', clientId: 'shared-stable-id',
      sender: 'Sender', senderAvatar: {id: 'share-a', initials: 'SA', gender: 'man'}, text: '',
      time: '10:00', sentAtIso: '2026-09-25T10:00:00Z', mine: true, readBy: [],
      attachments: [{ id: 'attachment', type: 'event', entityId: 'event', title: 'Shared event' }] };
    repository.appendChatMessage(direct, message);
    repository.appendChatMessage(direct, message);
    const recipient = repository.queryChatItemById('share-b', direct.id)!;
    expect(recipient.unread).toBe(1);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['share-b'].activities.chats).toBe(before + 1);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['share-b'].activities.chat?.contacts).toBe(1);
    expect(repository.queryChatSharedMessages(direct, 'event').map(item => item.id)).toEqual([message.id]);
    expect(repository.queryChatSharedMessages(recipient, 'event')).toEqual([]);
    expect(repository.queryChatMessagesPage(recipient, pageRequest({})).items[0].mine).toBe(false);
    expect(() => repository.updateChatMessage(recipient, message.id, {deleted: true})).toThrow();
    repository.updateChatMessage(direct, message.id, {deleted: true});
    expect(repository.queryChatSharedMessages(direct, 'event')).toEqual([]);
    const deleted = repository.queryChatMessagesPage(recipient, pageRequest({})).items[0];
    expect(deleted.deletedAtIso).toBeTruthy();
    expect(deleted.deletedByUserId).toBe('share-a');
  });

  it('rejects a saved contact from a different workspace', () => {
    seedUser(user('contact-a'));
    seedUser({ ...user('contact-b'), workspaceGroupId: 'other' });
    memoryDb.write(state => ({ ...state, [CONTACTS_TABLE_NAME]: {
      ownerUserIds: ['contact-a'], byOwnerUserId: { 'contact-a': [{ userId: 'contact-b' } as StoredContact] }
    } }));
    expect(() => repository.ensureContactChat('contact-a', 'contact-b')).toThrow();
  });

  it('keeps moderation support-message retries from incrementing unread counters twice', () => {
    const ownerId = 'moderation-retry-owner';
    seedUser(user(ownerId));
    const thread = chat('moderation-retry-chat', ownerId, 'appSupport', '2026-09-22T10:00:00Z');
    const message: ContractTypes.ChatMessageDto = {
      id: 'content-moderation:one-command', sender: 'Admin',
      senderAvatar: { id: 'admin', initials: 'AD', gender: 'system' },
      text: 'Please review this photo.', time: '10:00', sentAtIso: thread.dateIso!,
      mine: false, readBy: []
    };
    const before = memoryDb.read()[USERS_TABLE_NAME].byId[ownerId].activities.chats ?? 0;
    repository.upsertSupportChatMessage(thread, message, true);
    repository.upsertSupportChatMessage(thread, message, true);
    expect(repository.queryChatItemById(ownerId, thread.id)?.unread).toBe(1);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId[ownerId].activities.chats).toBe(before + 1);
  });

  it('pages all IndexedDB chat categories by date', () => {
    seedChats([
      chat('chat-event', 'user-1', 'mainEvent', '2026-05-01T10:00:00Z'),
      chat('chat-sub-event', 'user-1', 'optionalSubEvent', '2026-05-02T10:00:00Z'),
      chat('chat-group', 'user-1', 'groupSubEvent', '2026-05-03T10:00:00Z'),
      chat('chat-service', 'user-1', 'serviceEvent', '2026-05-04T10:00:00Z'),
      chat('chat-general', 'user-1', 'general', '2026-05-05T10:00:00Z')
    ]);

    const firstPage = repository.queryActivitiesChatPage('user-1', pageRequest({ pageSize: 2 }));
    const secondPage = repository.queryActivitiesChatPage('user-1', pageRequest({
      pageSize: 2,
      cursor: firstPage.nextCursor
    }));

    expect(firstPage.total).toBe(5);
    expect(firstPage.items.map(item => item.id)).toEqual(['chat-general', 'chat-service']);
    expect(secondPage.items.map(item => item.id)).toEqual(['chat-group', 'chat-sub-event']);
  });

  it('filters the IndexedDB chat page by service category only', () => {
    seedChats([
      chat('chat-event', 'user-1', 'mainEvent', '2026-05-01T10:00:00Z'),
      chat('chat-service-one', 'user-1', 'serviceEvent', '2026-05-02T10:00:00Z'),
      chat('chat-group', 'user-1', 'groupSubEvent', '2026-05-03T10:00:00Z'),
      chat('chat-service-two', 'user-1', 'serviceEvent', '2026-05-04T10:00:00Z')
    ]);

    const page = repository.queryActivitiesChatPage('user-1', pageRequest({
      filters: {
        chatContextFilter: 'service'
      },
      pageSize: 10
    }));

    expect(page.total).toBe(2);
    expect(page.items.map(item => item.id)).toEqual(['chat-service-two', 'chat-service-one']);
    expect(page.items.every(item => item.channelType === 'serviceEvent')).toBe(true);
  });

  it('filters admin support cases from IndexedDB without exposing them to normal users', () => {
    seedChats([
      chat('support-pending', 'reporter-1', 'supportCase', '2026-05-01T10:00:00Z', {
        ownerId: 'support-pending',
        supportCase: {
          status: 'pending',
          assignee: null,
          updatedAtIso: '2026-05-01T10:00:00Z'
        }
      }),
      chat('support-picked', 'reporter-2', 'supportCase', '2026-05-02T10:00:00Z', {
        ownerId: 'support-picked',
        supportCase: {
          status: 'picked',
          assignee: null,
          updatedAtIso: '2026-05-02T10:00:00Z'
        }
      }),
      chat('normal-service', 'user-1', 'serviceEvent', '2026-05-03T10:00:00Z')
    ]);

    const adminPendingPage = repository.queryActivitiesChatPage('admin-demo-ava', pageRequest({
      filters: {
        adminServiceOnly: true,
        chatContextFilter: 'service',
        supportCaseFilter: 'pending'
      },
      pageSize: 10
    }));
    const normalUserPage = repository.queryActivitiesChatPage('user-1', pageRequest({
      filters: {
        adminServiceOnly: true,
        chatContextFilter: 'service',
        supportCaseFilter: 'pending'
      },
      pageSize: 10
    }));

    expect(adminPendingPage.total).toBe(1);
    expect(adminPendingPage.items[0]?.id).toBe('support-pending');
    expect(adminPendingPage.items[0]?.ownerUserId).toBe('admin-demo-ava');
    expect(normalUserPage.total).toBe(0);
  });

  it('applies date ranges before paging IndexedDB chat rows', () => {
    seedChats([
      chat('chat-old', 'user-1', 'mainEvent', '2026-05-01T10:00:00Z'),
      chat('chat-middle', 'user-1', 'groupSubEvent', '2026-05-02T10:00:00Z'),
      chat('chat-new', 'user-1', 'serviceEvent', '2026-05-03T10:00:00Z')
    ]);

    const page = repository.queryActivitiesChatPage('user-1', pageRequest({
      pageSize: 10,
      rangeStart: '2026-05-02T00:00:00Z',
      rangeEnd: '2026-05-02T23:59:59Z'
    }));

    expect(page.total).toBe(1);
    expect(page.items.map(item => item.id)).toEqual(['chat-middle']);
  });

  it('materializes an empty published-event channel without changing attention counters', () => {
    const ownerUserId = 'user-publish-counter-test';
    const owner = user(ownerUserId);
    seedUser(owner);
    const originalChats = owner.activities.chats ?? 0;
    const originalEventChats = owner.activities.chat?.event ?? 0;
    const event = {
      id: 'event-publish-chat-test',
      title: 'Published Event',
      acceptedMemberUserIds: [ownerUserId],
      adminIds: [ownerUserId]
    } as ActivityEventRecord;

    const firstAdded = repository.syncPublishedMainEventChat(event, ownerUserId);
    const repeatedAdded = repository.syncPublishedMainEventChat(event, ownerUserId);

    const chatRecord = repository.queryChatItemById(ownerUserId, 'c-context-main-event-publish-chat-test');
    expect(chatRecord).toMatchObject({
      lastMessage: '',
      lastSenderId: null,
      unread: 0,
      channelType: 'mainEvent',
      ownerId: event.id,
      eventId: event.id,
      ownerStatus: 'A'
    });
    expect(firstAdded).toBe(true);
    expect(repeatedAdded).toBe(false);
    const publishedOwner = memoryDb.read()[USERS_TABLE_NAME].byId[ownerUserId];
    expect(publishedOwner.activities.chats).toBe(originalChats);
    expect(publishedOwner.activities.chat?.all).toBe(originalChats);
    expect(publishedOwner.activities.chat?.event).toBe(originalEventChats);
  });

  it('appends one event system message to every owner copy and updates stored attention counters once', () => {
    const eventId = 'event-member-approval-chat-test';
    const casey = user('casey');
    const riley = user('riley');
    seedUser(casey);
    seedUser(riley);
    repository.syncPublishedMainEventChat({
      id: eventId,
      title: 'Approval Event',
      acceptedMemberUserIds: ['casey', 'riley'],
      adminIds: ['casey']
    } as ActivityEventRecord);

    const sentAtIso = '2026-08-14T13:31:15.045Z';
    expect(repository.appendEventSystemMessage(
      eventId,
      'Riley joined the event.',
      'member-joined',
      sentAtIso
    )).toBe(2);
    expect(repository.appendEventSystemMessage(
      eventId,
      'Riley joined the event.',
      'member-joined',
      sentAtIso
    )).toBe(0);

    for (const userId of ['casey', 'riley']) {
      const chatRecord = repository.queryChatItemById(userId, `c-context-main-${eventId}`);
      const storedUser = memoryDb.read()[USERS_TABLE_NAME].byId[userId];
      expect(chatRecord).toMatchObject({
        unread: 1,
        lastMessage: 'Riley joined the event.',
        lastSenderId: 'system'
      });
      expect(storedUser.activities.chats).toBe((user(userId).activities.chats ?? 0) + 1);
      expect(storedUser.activities.chat?.all).toBe((user(userId).activities.chat?.all ?? user(userId).activities.chats ?? 0) + 1);
      expect(storedUser.activities.chat?.event).toBe((user(userId).activities.chat?.event ?? 0) + 1);
      expect(repository.queryChatMessagesPage(chatRecord!, pageRequest({ pageSize: 10 })).total).toBe(1);
    }
  });

  it('updates every physical chat copy for an event without replacing chat identity or content', () => {
    const eventId = 'event-status-test';
    const records: ChatThreadRecord[] = [
      {
        id: `c-context-main-${eventId}`,
        ownerUserId: 'casey',
        avatar: 'CB',
        title: 'Main',
        lastMessage: 'kept main message',
        lastSenderId: 'nova',
        memberIds: ['casey', 'nova'],
        unread: 0,
        channelType: 'mainEvent',
        ownerId: eventId,
        eventId,
        ownerStatus: 'A'
      },
      {
        id: `c-context-optional-${eventId}`,
        ownerUserId: 'nova',
        avatar: 'NS',
        title: 'Optional',
        lastMessage: 'kept optional message',
        lastSenderId: 'casey',
        memberIds: ['casey', 'nova'],
        unread: 1,
        channelType: 'optionalSubEvent',
        ownerId: `${eventId}:optional-1`,
        eventId,
        ownerStatus: 'A'
      }
    ];
    seedChats(records);

    expect(repository.updateEventChatOwnerStatus(eventId, 'DR')).toBe(2);
    expect(repository.queryChatItemById('casey', records[0].id)).toMatchObject({
      id: records[0].id,
      lastMessage: 'kept main message',
      ownerStatus: 'DR'
    });
    expect(repository.queryChatItemById('nova', records[1].id)).toMatchObject({
      id: records[1].id,
      lastMessage: 'kept optional message',
      unread: 1,
      ownerStatus: 'DR'
    });

    expect(repository.updateEventChatOwnerStatus(eventId, 'A')).toBe(2);
    expect(repository.queryChatItemById('casey', records[0].id)?.ownerStatus).toBe('A');
    expect(repository.queryChatItemById('nova', records[1].id)?.ownerStatus).toBe('A');
  });

  it('keeps the empty published-event channel read when it is opened', () => {
    const ownerUserId = 'user-publish-read-test';
    const owner = user(ownerUserId);
    seedUser(owner);
    const originalChats = owner.activities.chats ?? 0;
    const event = {
      id: 'event-publish-read-test',
      title: 'Published Event',
      acceptedMemberUserIds: [ownerUserId],
      adminIds: [ownerUserId]
    } as ActivityEventRecord;
    repository.syncPublishedMainEventChat(event);
    const chatRecord = repository.queryChatItemById(ownerUserId, 'c-context-main-event-publish-read-test');
    const initialRevision = chatRecord?.revision ?? 1;

    const read = repository.markChatRead(chatRecord!, ownerUserId, [], true);

    expect(read).toBeNull(); // No unread transition emits no read mutation.
    expect(repository.queryChatItemById(ownerUserId, 'c-context-main-event-publish-read-test')).toMatchObject({
      unread: 0,
      revision: initialRevision
    });
    expect(memoryDb.read()[USERS_TABLE_NAME].byId[ownerUserId].activities.chats).toBe(originalChats);
  });

  it('finds only active own shares, including messages outside the visible page', () => {
    const thread = chat('shared-history', 'user-1', 'general', '2026-09-25T10:00:00Z');
    seedChats([thread]);
    const message = (id: string, senderId: string, kind: 'event' | 'asset', deleted = false): ContractTypes.ChatMessageDto => ({
      id, sender: senderId, senderAvatar: { id: senderId, initials: 'US', gender: 'man' },
      text: '', time: '10:00', sentAtIso: '2026-09-25T10:00:00Z', mine: senderId === 'user-1', readBy: [],
      deletedAtIso: deleted ? '2026-09-25T11:00:00Z' : null,
      attachments: [{ id, type: kind, entityId: id, title: id }]
    });
    repository.appendChatMessage(thread, message('old-share', 'user-1', 'event'));
    repository.appendChatMessage(thread, message('other-sender', 'user-2', 'event'));
    repository.appendChatMessage(thread, message('deleted-share', 'user-1', 'event', true));
    repository.appendChatMessage(thread, message('asset-share', 'user-1', 'asset'));
    expect(repository.queryChatMessagesPage(thread, pageRequest({ pageSize: 1 })).items.map(item => item.id)).not.toContain('old-share');
    expect(repository.queryChatSharedMessages(thread, 'event').map(item => item.id)).toEqual(['old-share']);
    expect(repository.queryChatSharedMessages(thread, 'asset').map(item => item.id)).toEqual(['asset-share']);
  });

  it('advances the chat row revision when its message summary changes', () => {
    const original = chat('chat-row-poll', 'user-1', 'groupSubEvent', '2026-08-30T05:00:00Z', {
      revision: 7
    });
    seedChats([original]);

    repository.appendChatMessage(original, {
      id: 'message-row-poll',
      sender: 'Nova Social',
      senderAvatar: {
        id: 'nova',
        initials: 'NS',
        gender: 'woman'
      },
      text: 'Row state changed',
      time: '7:01 AM',
      sentAtIso: '2026-08-30T05:01:00Z',
      mine: false,
      readBy: []
    });

    expect(repository.queryChatItemById('user-1', 'chat-row-poll')).toMatchObject({
      lastMessage: 'Row state changed',
      lastSenderId: 'nova',
      dateIso: '2026-08-30T05:01:00Z'
    });
    expect(repository.queryChatItemById('user-1', 'chat-row-poll')?.revision).toBeGreaterThan(7);
  });

  function seedChats(records: ChatThreadRecord[]): void {
    memoryDb.write(state => ({
      ...state,
      [CHATS_TABLE_NAME]: {
        byId: Object.fromEntries(records.map(record => [recordKey(record), record])),
        ids: records.map(recordKey)
      }
    }));
  }

  function seedUser(record: UserRecord): void {
    memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: {
          ...state[USERS_TABLE_NAME].byId,
          [record.id]: record
        },
        ids: state[USERS_TABLE_NAME].ids.includes(record.id)
          ? [...state[USERS_TABLE_NAME].ids]
          : [...state[USERS_TABLE_NAME].ids, record.id]
      }
    }));
  }
});

function pageRequest(
  overrides: Partial<ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters>> = {}
): ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters> {
  const { filters, ...queryOverrides } = overrides;
  return {
    page: 0,
    pageSize: 10,
    sort: 'date',
    direction: 'desc',
    view: 'day',
    filters: {
      primaryFilter: 'chats',
      secondaryFilter: 'recent',
      chatContextFilter: 'all',
      hostingPublicationFilter: 'all',
      rateFilter: 'individual-given',
      ...filters
    },
    ...queryOverrides
  };
}

function chat(
  id: string,
  ownerUserId: string,
  channelType: ChatThreadRecord['channelType'],
  dateIso: string,
  overrides: Partial<ChatThreadRecord> = {}
): ChatThreadRecord {
  return {
    id,
    ownerUserId,
    avatar: id.slice(0, 2).toUpperCase(),
    title: id,
    lastMessage: 'Last message',
    lastSenderId: ownerUserId,
    memberIds: [ownerUserId],
    unread: 0,
    dateIso,
    channelType,
    ...overrides
  };
}

function recordKey(record: ChatThreadRecord): string {
  return `${record.ownerUserId}:${record.id}`;
}

function user(id: string): UserRecord {
  return {
    id,
    name: 'Publish Counter Test',
    age: 30,
    birthday: '1996-01-01',
    city: 'Bratislava',
    height: '180 cm',
    physique: 'average',
    languages: ['English'],
    horoscope: 'Capricorn',
    initials: 'PT',
    gender: 'man',
    statusText: '',
    hostTier: '',
    traitLabel: '',
    completion: 100,
    headline: '',
    about: '',
    profileStatus: 'public',
    activities: {
      game: 0,
      chats: 3,
      invitations: 0,
      events: 0,
      hosting: 0,
      chat: {
        all: 3,
        event: 2,
        subEvent: 1,
        group: 0,
        service: 0,
        appSupport: 0
      }
    }
  };
}

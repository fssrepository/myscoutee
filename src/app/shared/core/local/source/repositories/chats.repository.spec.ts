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

  it('materializes published-event attention and stored counters idempotently', () => {
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
      unread: 1,
      channelType: 'mainEvent',
      ownerId: event.id
    });
    expect(firstAdded).toBe(true);
    expect(repeatedAdded).toBe(false);
    const publishedOwner = memoryDb.read()[USERS_TABLE_NAME].byId[ownerUserId];
    expect(publishedOwner.activities.chats).toBe(originalChats + 1);
    expect(publishedOwner.activities.chat?.all).toBe(originalChats + 1);
    expect(publishedOwner.activities.chat?.event).toBe(originalEventChats + 1);
  });

  it('clears the unread publish system message when the channel is opened', () => {
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

    const read = repository.markChatRead(chatRecord!, ownerUserId, [], true);

    expect(read).toMatchObject({ messageIds: [], unread: 0 });
    expect(repository.queryChatItemById(ownerUserId, 'c-context-main-event-publish-read-test')).toMatchObject({
      unread: 0
    });
    expect(memoryDb.read()[USERS_TABLE_NAME].byId[ownerUserId].activities.chats).toBe(originalChats);
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

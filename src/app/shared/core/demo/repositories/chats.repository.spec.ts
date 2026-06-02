import { TestBed } from '@angular/core/testing';

import type * as AppTypes from '../../../core/base/models';
import { AppMemoryDb } from '../../base/db';
import type { ChatPopupMessage } from '../../base/models/chat.model';
import { CHATS_TABLE_NAME, type DemoChatRecord } from '../models/chats.model';
import { DemoChatsRepository } from './chats.repository';

describe('DemoChatsRepository chat pages', () => {
  let memoryDb: AppMemoryDb;
  let repository: DemoChatsRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(AppMemoryDb);
    await memoryDb.whenReady();
    repository = TestBed.inject(DemoChatsRepository);
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
      chatContextFilter: 'service',
      pageSize: 10
    }));

    expect(page.total).toBe(2);
    expect(page.items.map(item => item.id)).toEqual(['chat-service-two', 'chat-service-one']);
    expect(page.items.every(item => item.channelType === 'serviceEvent')).toBe(true);
  });

  it('filters admin support cases from IndexedDB without exposing them to normal users', () => {
    seedChats([
      chat('support-pending', 'reporter-1', 'serviceEvent', '2026-05-01T10:00:00Z', {
        supportCaseStatus: 'pending'
      }),
      chat('support-picked', 'reporter-2', 'serviceEvent', '2026-05-02T10:00:00Z', {
        supportCaseStatus: 'picked'
      }),
      chat('normal-service', 'user-1', 'serviceEvent', '2026-05-03T10:00:00Z')
    ]);

    const adminPendingPage = repository.queryActivitiesChatPage('admin-demo-ava', pageRequest({
      adminServiceOnly: true,
      chatContextFilter: 'service',
      supportCaseFilter: 'pending',
      pageSize: 10
    }));
    const normalUserPage = repository.queryActivitiesChatPage('user-1', pageRequest({
      adminServiceOnly: true,
      chatContextFilter: 'service',
      supportCaseFilter: 'pending',
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

  function seedChats(records: DemoChatRecord[]): void {
    memoryDb.write(state => ({
      ...state,
      [CHATS_TABLE_NAME]: {
        byId: Object.fromEntries(records.map(record => [recordKey(record), record])),
        ids: records.map(recordKey)
      }
    }));
  }
});

function pageRequest(
  overrides: Partial<AppTypes.ActivitiesPageRequest> = {}
): AppTypes.ActivitiesPageRequest {
  return {
    primaryFilter: 'chats',
    secondaryFilter: 'recent',
    chatContextFilter: 'all',
    hostingPublicationFilter: 'all',
    rateFilter: 'individual-given',
    view: 'day',
    page: 0,
    pageSize: 10,
    sort: 'date',
    direction: 'desc',
    ...overrides
  };
}

function chat(
  id: string,
  ownerUserId: string,
  channelType: DemoChatRecord['channelType'],
  dateIso: string,
  overrides: Partial<DemoChatRecord> = {}
): DemoChatRecord {
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
    messages: [message(id, dateIso)],
    ...overrides
  };
}

function message(chatId: string, sentAtIso: string): ChatPopupMessage {
  return {
    id: `${chatId}:message`,
    sender: 'System',
    senderAvatar: {
      id: 'deleted',
      initials: 'SY',
      gender: 'deleted'
    },
    text: 'Seed message',
    time: '10:00',
    sentAtIso,
    mine: false,
    readBy: []
  };
}

function recordKey(record: DemoChatRecord): string {
  return `${record.ownerUserId}:${record.id}`;
}

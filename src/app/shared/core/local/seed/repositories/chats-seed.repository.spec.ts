import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { SeedChatsRepository } from './chats-seed.repository';
import { SeedUsersRepository } from './users-seed.repository';
import { CHATS_TABLE_NAME, CHAT_MESSAGES_TABLE_NAME } from '../../source/entity/chat.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';

describe('Demo chat seed persistence and counters', () => {
  let db: LocalMemoryDb;
  let seed: SeedChatsRepository;
  beforeEach(async () => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    seed = TestBed.inject(SeedChatsRepository);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('replaces placeholder profile badges with the unread total of actual threads', () => {
    seed.seedDefaults();
    const users = TestBed.inject(SeedUsersRepository).seedDefaults();
    seed.stampStoredChatCountersForUsers(users.map(user => user.id));
    const state = db.read();
    for (const user of users) {
      const total = state[CHATS_TABLE_NAME].ids.map(id => state[CHATS_TABLE_NAME].byId[id])
        .filter(chat => chat.ownerUserId === user.id).reduce((sum, chat) => sum + chat.unread, 0);
      expect(state[USERS_TABLE_NAME].byId[user.id].activities.chats).toBe(total);
      expect(state[USERS_TABLE_NAME].byId[user.id].activities.chat?.all).toBe(total);
    }
    expect(seed.stampStoredChatCountersForUsers(users.map(user => user.id))).toBe(false);
  });

  it('does not overwrite an existing thread or read receipts when the seed owner is recreated', () => {
    seed.seedDefaults();
    const threadId = db.read()[CHATS_TABLE_NAME].ids[0];
    expect(threadId).toBeTruthy();
    const messageId = db.read()[CHAT_MESSAGES_TABLE_NAME].ids[0];
    db.write(state => ({ ...state,
      [CHATS_TABLE_NAME]: { ...state[CHATS_TABLE_NAME], byId: { ...state[CHATS_TABLE_NAME].byId,
        [threadId]: { ...state[CHATS_TABLE_NAME].byId[threadId], unread: 0, lastMessage: 'Kept after reload' } } },
      [CHAT_MESSAGES_TABLE_NAME]: { ...state[CHAT_MESSAGES_TABLE_NAME], byId: { ...state[CHAT_MESSAGES_TABLE_NAME].byId,
        [messageId]: { ...state[CHAT_MESSAGES_TABLE_NAME].byId[messageId], text: 'Edited message' } } }
    }));
    const threads = structuredClone(db.read()[CHATS_TABLE_NAME]);
    const messages = structuredClone(db.read()[CHAT_MESSAGES_TABLE_NAME]);
    TestBed.runInInjectionContext(() => new SeedChatsRepository()).seedDefaults();
    expect(db.read()[CHATS_TABLE_NAME]).toEqual(threads);
    expect(db.read()[CHAT_MESSAGES_TABLE_NAME]).toEqual(messages);
  });
});

import type { UserRecord } from '../../source/entity/user.entity';
import { SeedNotificationsBuilder } from './notification-seed.builder';

describe('SeedNotificationsBuilder', () => {
  const users: UserRecord[] = [
    {
      id: 'u3',
      name: 'Nagy Eszter',
      initials: 'NE',
      images: ['eszter.jpg'],
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      }
    } as UserRecord,
    {
      id: 'u1',
      name: 'Farkas Anna',
      initials: 'FA',
      images: ['anna.jpg'],
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      }
    } as UserRecord
  ];

  it('builds a cursor-pagination-sized category mix for the selected user', () => {
    const records = SeedNotificationsBuilder.buildForUser('u3', users);

    expect(records.length).toBe(32);
    expect(records.filter(record => !record.readAtIso).length).toBe(24);
    expect(new Set(records.map(record => record.category))).toEqual(new Set([
      'user',
      'chat',
      'event',
      'event-admin',
      'asset',
      'app-admin',
      'scheduled'
    ]));
    expect(records.every(record => record.recipientUserId === 'u3')).toBe(true);
    expect(new Set(records.map(record => record.id)).size).toBe(records.length);
  });

  it('targets any selected demo member without leaking the previous recipient', () => {
    const records = SeedNotificationsBuilder.buildForUser('u1', users);

    expect(records.length).toBe(32);
    expect(records.every(record => record.recipientUserId === 'u1')).toBe(true);
    expect(records.every(record => record.id.startsWith('u1:notification-demo-v2:'))).toBe(true);
  });
});

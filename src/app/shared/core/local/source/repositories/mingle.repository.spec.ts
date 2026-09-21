import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { ActivityMemberRecord } from '../entity/activity.entity';
import type { UserRecord } from '../entity/user.entity';
import { LocalMingleRepository } from './mingle.repository';
import { LocalEventsRepository } from './events.repository';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { completedMinglePeerIds } from '../mappers/mingle.mapper';
import { LocalEventFeedbackRepository } from './event-feedback.repository';

const start = Date.parse('2030-04-18T19:00:00Z');
describe('LocalMingleRepository', () => {
  let db: LocalMemoryDb;
  let repository: LocalMingleRepository;
  beforeEach(async () => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    vi.spyOn(Date, 'now').mockReturnValue(start);
    repository = TestBed.inject(LocalMingleRepository);
    const event = {
      id: 'event', userId: 'owner', creatorUserId: 'owner', adminIds: [], type: 'hosting', status: 'A',
      title: 'Speed meeting', subtitle: 'Rounds', avatar: 'SM', timeframe: '', inviter: null,
      unread: 0, activity: 0, trashedAtIso: null, creatorName: 'Owner', creatorInitials: 'O',
      creatorGender: 'woman', creatorCity: '', visibility: 'Public', blindMode: 'Open Event',
      startAtIso: new Date(start).toISOString(), endAtIso: new Date(start + 120_000).toISOString(),
      distanceKm: 0, imageUrl: '', sourceLink: '', location: '', locationCoordinates: null,
      capacityMin: 2, capacityMax: 10, capacityTotal: 10, frequency: 'One-time',
      ticketing: false, approvalRequired: false, policiesEnabled: false, slotsEnabled: false,
      eventType: 'main', nextSlot: null, upcomingSlots: [], acceptedMembers: 4, pendingMembers: 0,
      acceptedMemberUserIds: ['a', 'b', 'c', 'd'], pendingMemberUserIds: [], invitedMemberUserIds: [],
      pendingRequestMemberUserIds: [], pendingReason: null, topics: [], subEventsEnabled: true,
      subEventDefinitions: [], subEvents: [], mode: 'Mingle',
      mingleConfiguration: { groupSize: 2, plannedRounds: 2, roundDurationMinutes: 1,
        breakDurationMinutes: 1, requireGenderBalance: false }
    } as ActivityEventRecord;
    const users = ['owner', 'a', 'b', 'c', 'd'].map((id, index) => ({ id, name: id, initials: id,
      gender: index % 2 ? 'woman' : 'man', profileStatus: 'public', images: [], age: 30, activities: {} } as UserRecord));
    const members = users.map(user => member(user.id, user.gender, user.id === 'owner'));
    db.write(state => ({ ...state,
      events: { byId: { event }, ids: ['event'] },
      users: { byId: Object.fromEntries(users.map(user => [user.id, user])), ids: users.map(user => user.id) },
      activityMembers: { byId: Object.fromEntries(members.map(item => [item.id, item])), ids: members.map(item => item.id),
        idsByOwnerKey: { 'event:event': members.map(item => item.id) } }
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('keeps outsider state private and excludes organizer-only and pending memberships from tables', () => {
    expect(repository.query('a', 'event')).toBeNull();
    expect(() => repository.apply('event', 'a', 'start')).toThrow('MINGLE_MANAGE_FORBIDDEN');
    const state = repository.apply('event', 'owner', 'start');
    expect(state.tables).toHaveLength(2);
    expect(state.tables.flatMap(table => table.participants.map(user => user.userId)).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(repository.query('outsider', 'event')).toBeNull();
    expect(repository.query('a', 'event')?.tables).toHaveLength(1);
    expect(db.read().notifications.ids).toHaveLength(4);
    const groups = TestBed.inject(LocalEventsRepository).queryTournamentStageGroups({ eventId: 'event', stageId: 'mingle-round-1', userId: 'owner' });
    expect(groups).toHaveLength(2);
    expect(groups.map(group => group.membersAccepted)).toEqual([2, 2]);
  });

  it('rejects an old break confirmation after the next round starts without changing that round', () => {
    repository.apply('event', 'owner', 'start', 0);
    const breakState = repository.apply('event', 'owner', 'next');
    const nextRound = repository.apply('event', 'owner', 'next', breakState.revision);
    expect(nextRound.status).toBe('ROUND');
    expect(nextRound.roundNumber).toBe(2);
    const before = structuredClone(db.read());
    expect(() => repository.apply('event', 'owner', 'next', breakState.revision)).toThrow('MINGLE_STATE_CHANGED');
    expect(db.read()).toEqual(before);
  });

  it('preserves paused time across a persisted-state round trip and advances elapsed phases once', async () => {
    repository.apply('event', 'owner', 'start');
    vi.mocked(Date.now).mockReturnValue(start + 20_000);
    expect(repository.apply('event', 'owner', 'pause').remainingSeconds).toBe(40);
    const snapshot = structuredClone(db.read());
    await repository.flushToIndexedDb();
    db.write(() => snapshot);
    vi.mocked(Date.now).mockReturnValue(start + 600_000);
    expect(repository.query('a', 'event')?.remainingSeconds).toBe(40);
    expect(repository.apply('event', 'owner', 'resume').phaseEndsAtIso).toBe(new Date(start + 640_000).toISOString());
    vi.mocked(Date.now).mockReturnValue(start + 640_000);
    expect(repository.query('a', 'event')?.status).toBe('BREAK');
    vi.mocked(Date.now).mockReturnValue(start + 700_000);
    expect(repository.query('a', 'event')?.roundNumber).toBe(2);
    expect(db.read().notifications.ids).toHaveLength(8);
    expect(repository.query('a', 'event')?.revision).toBe(5);
    expect(db.read().notifications.ids).toHaveLength(8);
    await db.resetStorage();
    expect(db.read().mingleSessions.ids).toEqual([]);
  });

  it('freezes actual edited table members at completion and uses those peers for Met and feedback', () => {
    const state = repository.apply('event', 'owner', 'start');
    const table = state.tables.find(table => table.participants.some(user => user.userId === 'a'))!;
    const previousPeer = table.participants.find(user => user.userId !== 'a')!.userId;
    const replacement = ['b', 'c', 'd'].find(id => id !== previousPeer)!;
    const members = TestBed.inject(LocalActivityMembersRepository);
    expect(members.queryMetUserIds('a')).toEqual([]);
    const records = members.peekRecordsByOwner({ ownerType: 'group', ownerId: table.memberOwnerId });
    members.replaceRecordsByOwner({ ownerType: 'group', ownerId: table.memberOwnerId }, [
      records.find(record => record.userId === 'a')!,
      { ...records.find(record => record.userId === previousPeer)!, userId: replacement, id: `edited:${replacement}` }
    ]);
    repository.apply('event', 'owner', 'complete');
    const session = db.read().mingleSessions.byId['event'];
    expect(completedMinglePeerIds(session, 'a')).toEqual([replacement]);
    expect(members.queryMetUserIds('a')).toEqual([replacement]);
    expect(Object.values(db.read().userRates.byId).some(rate => rate.met && [rate.fromUserId, rate.toUserId].includes('a')
      && [rate.fromUserId, rate.toUserId].includes(replacement) && rate.scoreGiven === 0 && rate.scoreReceived === 0)).toBe(true);
    const event = db.read().events.byId['event'];
    expect(TestBed.inject(LocalEventFeedbackRepository).queryMinglePeers('a', [event])).toEqual({ event: [replacement] });
    members.replaceRecordsByOwner({ ownerType: 'group', ownerId: table.memberOwnerId }, []);
    expect(repository.query('a', 'event', 1)?.tables[0].participants.map(user => user.userId).sort()).toEqual(['a', replacement].sort());
  });

  for (const mode of ['Casual', 'Tournament'] as const) {
    it(`does not start a live round or change memberships for ${mode}`, () => {
      db.write(state => ({ ...state, events: { ...state.events, byId: {
        event: { ...state.events.byId['event'], mode }
      } } }));
      const before = structuredClone(db.read().activityMembers);
      expect(repository.query('owner', 'event')).toBeNull();
      expect(() => repository.apply('event', 'owner', 'start')).toThrow('MINGLE_EVENT_NOT_FOUND');
      expect(db.read().activityMembers).toEqual(before);
      expect(db.read().mingleSessions.ids).toEqual([]);
      expect(db.read().notifications.ids).toEqual([]);
      expect(db.read().userRates.ids).toEqual([]);
    });
  }

  it('waits when balanced full tables are impossible and does not create a partial session', () => {
    db.write(state => ({ ...state, events: { ...state.events, byId: { event: { ...state.events.byId['event'],
      mingleConfiguration: { ...state.events.byId['event'].mingleConfiguration!, requireGenderBalance: true, groupSize: 6 } } } } }));
    expect(() => repository.apply('event', 'owner', 'start')).toThrow('MINGLE_TABLE_ASSIGNMENT_UNAVAILABLE_GENDER_BALANCE');
    expect(db.read().mingleSessions.ids).toEqual([]);
    expect(db.read().notifications.ids).toEqual([]);
  });
});

function member(userId: string, gender: 'woman' | 'man', organizerOnly = false): ActivityMemberRecord {
  return { id: `event:event:${userId}`, userId, name: userId, initials: userId, gender, city: '', statusText: '',
    role: organizerOnly ? 'Admin' : 'Member', status: 'accepted', pendingSource: null, requestKind: null,
    invitedByActiveUser: false, metAtIso: '', actionAtIso: '', metWhere: 'Speed meeting', avatarUrl: '', organizerOnly,
    ownerType: 'event', ownerId: 'event', ownerKey: 'event:event', createdMs: start, updatedMs: start,
    createdAtIso: new Date(start).toISOString(), updatedAtIso: new Date(start).toISOString() };
}

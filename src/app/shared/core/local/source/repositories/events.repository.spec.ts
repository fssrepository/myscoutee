import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import type * as ContractTypes from '../../../contracts';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';
import { LocalMemoryDb } from '../../../common/app.db';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';

import { LocalEventsRepository } from './events.repository';

describe('LocalEventsRepository event membership pages', () => {
  let memoryDb: LocalMemoryDb;
  let repository: LocalEventsRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
    repository = TestBed.inject(LocalEventsRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('filters event formats before counting and paginating Explore', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-04-18T10:00:00.000Z'));
    seedUsers([user('owner-1', 'Owner'), user('viewer-1', 'Viewer')]);
    seedEvents([
      eventRecord({ id: 'standard', mode: 'Casual' }),
      eventRecord({ id: 'mingle-a', mode: 'Mingle' }),
      eventRecord({ id: 'tournament', mode: 'Tournament' }),
      eventRecord({ id: 'mingle-b', mode: 'Mingle' })
    ]);
    const query = { userId: 'viewer-1', order: 'upcoming' as const, view: 'day' as const,
      friendsOnly: false, openSpotsOnly: false, topic: '', mode: 'Mingle' as const, limit: 1 };
    const first = repository.queryEventExplorePage(query);
    expect(first.total).toBe(2);
    expect(first.records).toHaveLength(1);
    expect(first.records[0].mode).toBe('Mingle');
    const second = repository.queryEventExplorePage({ ...query, cursor: first.nextCursor });
    expect(second.records).toHaveLength(1);
    expect(second.records[0].id).not.toBe(first.records[0].id);
    expect(second.nextCursor).toBeNull();
    expect(repository.queryEventExplorePage({ ...query, mode: '', limit: 10 }).total).toBe(4);
    vi.restoreAllMocks();
  });

  it('keeps a cancelled waitlist membership out of pending activity pages', () => {
    seedUsers([
      user('owner-1', 'Owner One'),
      user('viewer-1', 'Viewer One')
    ]);
    seedEvents([
      eventRecord({
        id: 'waitlist-event',
        userId: 'owner-1',
        creatorUserId: 'owner-1'
      })
    ]);

    const joinResult = repository.requestJoin('viewer-1', 'waitlist-event', null, false, true, false);
    expect(joinResult?.pendingReason).toBe('waitlist');
    expect(repository.queryActivitiesEventRecordPage('viewer-1', eventsPage('pending')).records.map(item => item.id))
      .toEqual(['waitlist-event']);

    const leaveResult = repository.leaveEvent('viewer-1', 'waitlist-event', {
      removeMembershipOnly: true
    });

    expect(leaveResult?.pendingRequestMemberUserIds ?? []).not.toContain('viewer-1');
    expect(repository.queryActivitiesEventRecordPage('viewer-1', eventsPage('pending')).records.map(item => item.id))
      .toEqual([]);
    expect(repository.queryActivitiesEventRecordPage('viewer-1', eventsPage('all')).records.map(item => item.id))
      .toEqual([]);
  });

  it('keeps a tournament room nested under its parent instead of listing it as an activity event', () => {
    seedUsers([
      user('casey', 'Casey Bridge'),
      user('nova', 'Nova Social')
    ]);
    seedEvents([
      eventRecord({
        id: 'tournament-1',
        userId: 'casey',
        creatorUserId: 'casey',
        acceptedMembers: 2,
        acceptedMemberUserIds: ['casey', 'nova']
      }),
      eventRecord({
        id: 'tournament-room-1',
        userId: 'room-system',
        type: 'events',
        creatorUserId: '',
        organizerUserId: 'casey',
        creatorName: 'Casey Bridge',
        eventType: 'tournament-room',
        generated: true,
        parentEventId: 'tournament-1',
        acceptedMembers: 2,
        acceptedMemberUserIds: ['casey', 'nova']
      })
    ]);

    const active = repository.queryActivitiesEventRecordPage('casey', eventsPage('active-events')).records;
    const hosting = repository.queryActivitiesEventRecordPage('casey', eventsPage('my-events')).records;

    expect(active).toEqual([]);
    expect(hosting.map(item => item.id)).toEqual(['tournament-1']);
  });

  it('shows only still-public followed events in Watchlist', () => {
    seedUsers([
      user('owner-1', 'Owner One'),
      user('viewer-1', 'Viewer One')
    ]);
    seedEvents([
      eventRecord({ id: 'public-event', watchingUserIds: ['viewer-1'] }),
      eventRecord({ id: 'draft-event', status: 'DR', watchingUserIds: ['viewer-1'] }),
      eventRecord({ id: 'invite-only-event', visibility: 'Invitation only', watchingUserIds: ['viewer-1'] })
    ]);

    const watchlist = repository.queryActivitiesEventRecordPage('viewer-1', eventsPage('watchlist')).records;

    expect(watchlist.map(item => item.id)).toEqual(['public-event']);
  });

  it('keeps an ongoing event in upcoming Explore until the event ends', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-04-18T20:00:00.000Z'));
    seedUsers([
      user('owner-1', 'Owner One'),
      user('viewer-1', 'Viewer One')
    ]);
    seedEvents([
      eventRecord({
        id: 'ended-event',
        startAtIso: '2030-04-18T17:00:00.000Z',
        endAtIso: '2030-04-18T19:00:00.000Z'
      }),
      eventRecord({
        id: 'ongoing-event',
        startAtIso: '2030-04-18T18:00:00.000Z',
        endAtIso: '2030-04-18T22:00:00.000Z'
      }),
      eventRecord({
        id: 'future-event',
        startAtIso: '2030-04-18T21:00:00.000Z',
        endAtIso: '2030-04-18T23:00:00.000Z'
      })
    ]);

    const upcoming = repository.queryEventExplorePage({
      userId: 'viewer-1',
      order: 'upcoming',
      view: 'day',
      friendsOnly: false,
      openSpotsOnly: false,
      topic: '',
      excludedSourceIds: [],
      cursor: null,
      limit: 10
    }).records;

    expect(upcoming.map(item => item.id)).toEqual([
      'ongoing-event',
      'future-event',
      'ended-event'
    ]);
    expect(upcoming.find(item => item.id === 'ongoing-event')?.exploreSortKey?.[0]).toBe(0);
    expect(upcoming.find(item => item.id === 'ended-event')?.exploreSortKey?.[0]).toBe(1);
  });

  function seedUsers(users: UserDto[]): void {
    memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: Object.fromEntries(users.map(item => [item.id, item])),
        ids: users.map(item => item.id)
      }
    }));
  }

  function seedEvents(records: ActivityEventRecord[]): void {
    memoryDb.write(state => ({
      ...state,
      [EVENTS_TABLE_NAME]: {
        byId: Object.fromEntries(records.map(record => [eventRecordKey(record), record])),
        ids: records.map(eventRecordKey)
      }
    }));
  }
});

function eventsPage(
  eventScopeFilter: ContractTypes.ActivitiesEventScope
): ContractTypes.ListQuery<ContractTypes.ActivitiesFeedFilters> {
  return {
    page: 0,
    pageSize: 10,
    sort: 'date',
    direction: 'desc',
    view: 'day',
    filters: {
      primaryFilter: 'events',
      eventScopeFilter,
      secondaryFilter: 'recent',
      hostingPublicationFilter: 'all'
    }
  };
}

function eventRecord(overrides: Partial<ActivityEventRecord> = {}): ActivityEventRecord {
  const startAtIso = '2030-04-18T19:00:00.000Z';
  const endAtIso = '2030-04-18T22:00:00.000Z';
  return {
    id: 'event-1',
    userId: 'owner-1',
    type: 'hosting',
    status: 'A',
    adminIds: [],
    avatar: 'EO',
    title: 'Waitlist Test Event',
    subtitle: 'Seeded for waitlist cancellation.',
    timeframe: 'Apr 18 · 7:00 PM - 10:00 PM',
    inviter: null,
    unread: 0,
    activity: 0,
    trashedAtIso: null,
    creatorUserId: 'owner-1',
    creatorName: 'Owner One',
    creatorInitials: 'OO',
    creatorGender: 'woman',
    creatorCity: 'Austin',
    visibility: 'Public',
    blindMode: 'Open Event',
    startAtIso,
    endAtIso,
    distanceKm: 0,
    imageUrl: '',
    sourceLink: '',
    location: 'Austin',
    locationCoordinates: null,
    capacityMin: null,
    capacityMax: null,
    capacityTotal: 1,
    frequency: 'One-time',
    ticketing: false,
    approvalRequired: false,
    policiesEnabled: false,
    slotsEnabled: false,
    eventType: 'main',
    nextSlot: null,
    upcomingSlots: [],
    acceptedMembers: 0,
    pendingMembers: 0,
    acceptedMemberUserIds: [],
    pendingMemberUserIds: [],
    invitedMemberUserIds: [],
    pendingRequestMemberUserIds: [],
    pendingReason: null,
    topics: [],
    subEventsEnabled: true,
    subEventDefinitions: [],
    subEvents: [],
    mode: 'Casual',
    rating: 0,
    boost: 0,
    affinity: 0,
    ...overrides
  };
}

function user(id: string, name: string): UserDto {
  return {
    id,
    name,
    age: 30,
    birthday: '',
    city: 'Austin',
    height: '',
    physique: '',
    languages: [],
    horoscope: '',
    initials: name
      .split(/\s+/)
      .map(part => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    gender: 'woman',
    statusText: '',
    hostTier: '',
    traitLabel: '',
    completion: 100,
    profileFormVersion: 1,
    headline: '',
    about: '',
    affinity: 0,
    images: [],
    profileStatus: 'public',
    activities: {
      game: 0,
      chats: 0,
      invitations: 0,
      events: 0,
      hosting: 0
    }
  };
}

function eventRecordKey(record: ActivityEventRecord): string {
  return `${record.userId}:${record.type}:${record.id}`;
}

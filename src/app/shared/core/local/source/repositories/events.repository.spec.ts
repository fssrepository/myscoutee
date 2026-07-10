import { TestBed } from '@angular/core/testing';

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
      chat: 0,
      invitations: 0,
      events: 0,
      hosting: 0
    }
  };
}

function eventRecordKey(record: ActivityEventRecord): string {
  return `${record.userId}:${record.type}:${record.id}`;
}

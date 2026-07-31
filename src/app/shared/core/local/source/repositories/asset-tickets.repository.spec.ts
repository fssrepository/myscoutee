import { TestBed } from '@angular/core/testing';

import { AssetTicketBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../common/app.db';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { LocalAssetTicketsRepository } from './asset-tickets.repository';

describe('LocalAssetTicketsRepository ticket validation', () => {
  let memoryDb: LocalMemoryDb;
  let repository: LocalAssetTicketsRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
    seedUsers([
      user('owner-1', 'Event Owner'),
      user('holder-1', 'Ticket Holder'),
      user('other-1', 'Other Member')
    ]);
    seedEvents([eventRecord()]);
    repository = TestBed.inject(LocalAssetTicketsRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('atomically checks in an accepted holder once and rejects reuse', () => {
    const request = {
      code: AssetTicketBuilder.createDemoScanCode('event-1', 'holder-1'),
      userId: 'owner-1'
    };

    const first = repository.validateTicket(request);
    const second = repository.validateTicket(request);

    expect(first.valid).toBe(true);
    expect(first.ticket).toMatchObject({
      code: request.code,
      holderUserId: 'holder-1',
      holderName: 'Ticket Holder',
      eventId: 'event-1'
    });
    expect(first.ticket?.usedAtIso).toBeTruthy();
    expect(second).toEqual({
      valid: false,
      reason: 'already_used',
      ticket: null
    });
  });

  it('requires the scanner actor to manage the event', () => {
    const response = repository.validateTicket({
      code: AssetTicketBuilder.createDemoScanCode('event-1', 'holder-1'),
      userId: 'other-1'
    });

    expect(response).toEqual({
      valid: false,
      reason: 'not_authorized',
      ticket: null
    });
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
        byId: Object.fromEntries(records.map(record => [record.id, record])),
        ids: records.map(record => record.id)
      }
    }));
  }
});

function eventRecord(): ActivityEventRecord {
  return {
    id: 'event-1',
    userId: 'owner-1',
    type: 'hosting',
    status: 'A',
    adminIds: [],
    avatar: 'EO',
    title: 'Ticketed Event',
    subtitle: 'Main hall',
    timeframe: 'Apr 18 · 7:00 PM - 10:00 PM',
    inviter: null,
    unread: 0,
    activity: 0,
    trashedAtIso: null,
    creatorUserId: 'owner-1',
    creatorName: 'Event Owner',
    creatorInitials: 'EO',
    creatorGender: 'woman',
    creatorCity: 'Budapest',
    visibility: 'Public',
    blindMode: 'Open Event',
    startAtIso: '2035-04-18T19:00:00.000Z',
    endAtIso: '2035-04-18T22:00:00.000Z',
    distanceKm: 0,
    imageUrl: '',
    sourceLink: '',
    location: 'Budapest',
    locationCoordinates: null,
    capacityMin: null,
    capacityMax: null,
    capacityTotal: 50,
    frequency: 'One-time',
    ticketing: true,
    approvalRequired: false,
    policiesEnabled: false,
    slotsEnabled: false,
    eventType: 'main',
    nextSlot: null,
    upcomingSlots: [],
    acceptedMembers: 1,
    pendingMembers: 0,
    acceptedMemberUserIds: ['holder-1'],
    pendingMemberUserIds: [],
    invitedMemberUserIds: [],
    pendingRequestMemberUserIds: [],
    pendingReason: null,
    topics: [],
    subEventsEnabled: false,
    subEventDefinitions: [],
    subEvents: [],
    mode: 'Casual',
    rating: 0,
    boost: 0,
    affinity: 0
  };
}

function user(id: string, name: string): UserDto {
  return {
    id,
    name,
    age: 30,
    birthday: '',
    city: 'Budapest',
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

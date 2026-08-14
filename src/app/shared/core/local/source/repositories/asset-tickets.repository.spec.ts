import { TestBed } from '@angular/core/testing';

import { LocalMemoryDb } from '../../../common/app.db';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type ActivityMemberRecord
} from '../entity/activity.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { EVENT_TICKETS_TABLE_NAME, type EventTicketRecord } from '../entity/event-ticket.entity';
import { NOTIFICATIONS_TABLE_NAME } from '../entity/notification.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { LocalAssetTicketsRepository } from './asset-tickets.repository';

describe('LocalAssetTicketsRepository physical ticket lifecycle', () => {
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
    seedEventMembers([eventHolderRecord()]);
    repository = TestBed.inject(LocalAssetTicketsRepository);
    repository.synchronizeForEvent('event-1', new Date('2035-04-17T12:00:00.000Z'));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates one physical ticket on publish and keeps list reads read-only', async () => {
    const before = activeTickets();

    const first = await repository.queryTicketPage({
      userId: 'holder-1',
      page: 0,
      pageSize: 20,
      order: 'upcoming'
    });
    const second = await repository.queryTicketPage({
      userId: 'holder-1',
      page: 0,
      pageSize: 20,
      order: 'upcoming'
    });

    expect(before).toHaveLength(1);
    expect(first.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({
      id: 'event-1',
      holderUserId: 'holder-1',
      scanCode: first.items[0].scanCode,
      issuedAtIso: '2035-04-17T12:00:00.000Z'
    });
    expect(allTickets()).toEqual(before);
    expect(repository.peekTicketCountByUser('owner-1')).toBe(0);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['owner-1'].activities.tickets).toBe(0);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['owner-1'].activities.asset?.tickets).toBe(0);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['holder-1'].activities.tickets).toBe(1);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['holder-1'].activities.asset?.tickets).toBe(1);
  });

  it('atomically checks in an accepted holder once and rejects reuse', () => {
    const ticket = activeTickets()[0];
    const request = {
      code: ticket.code,
      userId: 'owner-1'
    };

    const first = repository.validateTicket(request);
    const second = repository.validateTicket(request);
    const third = repository.validateTicket(request);

    expect(first.valid).toBe(true);
    expect(first.ticket).toMatchObject({
      code: request.code,
      holderUserId: 'holder-1',
      holderName: 'Ticket Holder',
      eventId: 'event-1',
      issuedAtIso: '2035-04-17T12:00:00.000Z'
    });
    expect(first.ticket?.usedAtIso).toBeTruthy();
    expect(second).toEqual({
      valid: false,
      reason: 'already_used',
      ticket: null
    });
    expect(third).toEqual(second);
    const persisted = allTickets()[0];
    expect(persisted.usedAtIso).toBe(first.ticket?.usedAtIso);
    expect(persisted.replayAudits).toHaveLength(2);
    expect(persisted.replayAudits?.map(item => item.actorUserId)).toEqual([
      'owner-1',
      'owner-1'
    ]);
    const notifications = memoryDb.read()[NOTIFICATIONS_TABLE_NAME];
    const holderNotifications = (notifications.idsByRecipientUserId['holder-1'] ?? [])
      .map(id => notifications.byId[id]);
    expect(holderNotifications).toHaveLength(1);
    expect(holderNotifications[0]).toMatchObject({
      kind: 'event-ticket-replay-warning',
      senderUserId: 'owner-1',
      occurrenceCount: 2,
      readAtIso: null
    });
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['holder-1'].activities.notifications).toBe(1);
    const attendance = memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME].byId['event:event-1:holder-1'];
    expect(attendance).toMatchObject({
      status: 'accepted',
      actionAtIso: '2030-04-18T18:00:00.000Z',
      attendanceStatus: 'checked-in',
      checkedInAtIso: first.ticket?.usedAtIso,
      checkedInByUserId: 'owner-1',
      checkedInTicketId: persisted.id,
      updatedAtIso: first.ticket?.usedAtIso
    });
  });

  it('requires the scanner actor to manage the event', () => {
    const response = repository.validateTicket({
      code: activeTickets()[0].code,
      userId: 'other-1'
    });

    expect(response).toEqual({
      valid: false,
      reason: 'not_authorized',
      ticket: null
    });
  });

  it('allows an accepted event manager to validate a ticket', () => {
    seedEventMembers([eventHolderRecord(), eventManagerRecord()]);

    const response = repository.validateTicket({
      code: activeTickets()[0].code,
      userId: 'other-1'
    });

    expect(response.valid).toBe(true);
    expect(response.ticket).toMatchObject({
      holderUserId: 'holder-1',
      eventId: 'event-1'
    });
  });

  it('marks active tickets D when ticketing is disabled and creates a new QR after republish', () => {
    const first = activeTickets()[0];
    updateEvent({ status: 'DR', ticketing: false });
    repository.synchronizeForEvent('event-1', new Date('2035-04-17T13:00:00.000Z'));

    expect(activeTickets()).toEqual([]);
    expect(allTickets()).toEqual([expect.objectContaining({
      id: first.id,
      code: first.code,
      status: 'D'
    })]);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['holder-1'].activities.tickets).toBe(0);

    updateEvent({ status: 'A', ticketing: true });
    repository.synchronizeForEvent('event-1', new Date('2035-04-17T14:00:00.000Z'));

    const second = activeTickets()[0];
    expect(allTickets()).toHaveLength(2);
    expect(second.id).not.toBe(first.id);
    expect(second.code).not.toBe(first.code);
    expect(second.issuedAtIso).toBe('2035-04-17T14:00:00.000Z');
  });

  it('keeps an admin-preapproved invitation ticketless until the invitee accepts', () => {
    clearTickets();
    updateEvent({
      acceptedMembers: 1,
      pendingMembers: 1,
      acceptedMemberUserIds: ['holder-1'],
      pendingMemberUserIds: ['other-1'],
      invitedMemberUserIds: ['other-1'],
      pendingRequestMemberUserIds: []
    });

    repository.synchronizeForMemberChange(
      'event-1',
      'other-1',
      new Date('2035-04-17T15:00:00.000Z')
    );
    repository.synchronizeForMemberChange(
      'event-1',
      'other-1',
      new Date('2035-04-17T15:01:00.000Z')
    );

    expect(repository.peekTicketCountByUser('other-1')).toBe(0);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['other-1'].activities.tickets).toBe(0);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['other-1'].activities.asset?.tickets).toBe(0);

    updateEvent({
      acceptedMembers: 2,
      pendingMembers: 0,
      acceptedMemberUserIds: ['holder-1', 'other-1'],
      pendingMemberUserIds: [],
      invitedMemberUserIds: []
    });
    repository.synchronizeForMemberChange(
      'event-1',
      'other-1',
      new Date('2035-04-17T15:02:00.000Z')
    );

    expect(activeTickets()).toEqual([
      expect.objectContaining({ holderUserId: 'other-1', status: 'A' })
    ]);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['other-1'].activities.tickets).toBe(1);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['other-1'].activities.asset?.tickets).toBe(1);
  });

  it('creates only the accepted join applicant ticket on the admin approval write', () => {
    clearTickets();
    updateEvent({
      acceptedMembers: 1,
      pendingMembers: 1,
      acceptedMemberUserIds: ['holder-1'],
      pendingMemberUserIds: ['other-1'],
      invitedMemberUserIds: [],
      pendingRequestMemberUserIds: ['other-1']
    });
    repository.synchronizeForMemberChange(
      'event-1',
      'other-1',
      new Date('2035-04-17T16:00:00.000Z')
    );

    expect(repository.peekTicketCountByUser('other-1')).toBe(0);

    updateEvent({
      acceptedMembers: 2,
      pendingMembers: 0,
      acceptedMemberUserIds: ['holder-1', 'other-1'],
      pendingMemberUserIds: [],
      pendingRequestMemberUserIds: []
    });
    repository.synchronizeForMemberChange(
      'event-1',
      'other-1',
      new Date('2035-04-17T16:01:00.000Z')
    );
    repository.synchronizeForMemberChange(
      'event-1',
      'other-1',
      new Date('2035-04-17T16:02:00.000Z')
    );

    expect(activeTickets()).toEqual([
      expect.objectContaining({ holderUserId: 'other-1', status: 'A' })
    ]);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['other-1'].activities.tickets).toBe(1);
    expect(memoryDb.read()[USERS_TABLE_NAME].byId['other-1'].activities.asset?.tickets).toBe(1);
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

  function seedEventMembers(records: ActivityMemberRecord[]): void {
    memoryDb.write(state => ({
      ...state,
      [ACTIVITY_MEMBERS_TABLE_NAME]: {
        byId: Object.fromEntries(records.map(record => [record.id, record])),
        ids: records.map(record => record.id),
        idsByOwnerKey: {
          'event:event-1': records.map(record => record.id)
        }
      }
    }));
  }

  function updateEvent(update: Partial<ActivityEventRecord>): void {
    memoryDb.write(state => ({
      ...state,
      [EVENTS_TABLE_NAME]: {
        ...state[EVENTS_TABLE_NAME],
        byId: {
          ...state[EVENTS_TABLE_NAME].byId,
          'event-1': {
            ...state[EVENTS_TABLE_NAME].byId['event-1'],
            ...update
          }
        }
      }
    }));
  }

  function clearTickets(): void {
    memoryDb.write(state => ({
      ...state,
      [EVENT_TICKETS_TABLE_NAME]: {
        byId: {},
        ids: []
      }
    }));
  }

  function allTickets(): EventTicketRecord[] {
    const table = memoryDb.read()[EVENT_TICKETS_TABLE_NAME];
    return table.ids.map(id => table.byId[id]);
  }

  function activeTickets(): EventTicketRecord[] {
    return allTickets().filter(ticket => ticket.status === 'A');
  }
});

function eventManagerRecord(): ActivityMemberRecord {
  return {
    id: 'event:event-1:other-1',
    userId: 'other-1',
    name: 'Other Member',
    initials: 'OM',
    gender: 'woman',
    city: 'Budapest',
    statusText: '',
    role: 'Manager',
    status: 'accepted',
    pendingSource: null,
    requestKind: null,
    invitedByActiveUser: false,
    invitedByUserId: null,
    metAtIso: '2030-04-18T18:00:00.000Z',
    actionAtIso: '2030-04-18T18:00:00.000Z',
    metWhere: 'Ticketed Event',
    avatarUrl: '',
    ownerType: 'event',
    ownerId: 'event-1',
    ownerKey: 'event:event-1',
    createdMs: 1,
    updatedMs: 1,
    createdAtIso: '2030-04-18T18:00:00.000Z',
    updatedAtIso: '2030-04-18T18:00:00.000Z'
  };
}

function eventHolderRecord(): ActivityMemberRecord {
  return {
    ...eventManagerRecord(),
    id: 'event:event-1:holder-1',
    userId: 'holder-1',
    name: 'Ticket Holder',
    initials: 'TH',
    role: 'Member'
  };
}

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
      hosting: 0,
      tickets: 0,
      asset: { tickets: 0 }
    }
  };
}

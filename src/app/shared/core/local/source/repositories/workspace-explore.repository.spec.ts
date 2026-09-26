import { LocalAssetsService } from '../services/assets.service';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';
import { ASSETS_TABLE_NAME, type AssetRecord } from '../entity/asset.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';
import { LocalAssetsRepository } from './assets.repository';
import { LocalEventsRepository } from './events.repository';

describe('Workspace explore boundaries', () => {
  let db: LocalMemoryDb;
  beforeEach(async () => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    const users: UserRecord[] = [
      user('viewer', 'Viewer'),
      {...user('viewer-a', 'Viewer A'), accountUserId: 'viewer', workspaceGroupId: 'group-a'},
      {...user('viewer-b', 'Viewer B'), accountUserId: 'viewer', workspaceGroupId: 'group-b'},
      user('owner', 'Owner'),
      {...user('host-a', 'Host A'), accountUserId: 'owner', workspaceGroupId: 'group-a'},
      {...user('host-b', 'Host B'), accountUserId: 'owner', workspaceGroupId: 'group-b'},
      {...user('host-private', 'Private Host'), accountUserId: 'owner', workspaceGroupId: 'unjoined-group'}
    ];
    const events = ['owner', 'host-a', 'host-b', 'host-private'].map(creatorUserId => ({
      ...eventRecord(), id: `event-${creatorUserId}`, creatorUserId, userId: creatorUserId,
      acceptedMemberUserIds: [], acceptedMembers: 0
    }));
    const assets: AssetRecord[] = ['public', 'private', 'mine'].map(id => ({
      id, type: 'Supplies', title: id, subtitle: '', city: 'Budapest', capacityTotal: 5,
      quantity: 5, details: '', imageUrl: '', sourceLink: '', ownerUserId: id === 'mine' ? 'viewer' : 'owner',
      visibility: id === 'private' ? 'Invitation only' : 'Public', status: 'A',
      requests: id === 'public' ? [{id: 'booking', userId: 'host-private', name: 'Private Host', initials: 'PH',
        gender: 'woman', status: 'accepted', note: '', booking: {eventId: 'event-host-private', quantity: 1}}] : [],
      createdMs: 0, updatedMs: 0, createdAtIso: '2030-01-01T00:00:00Z', updatedAtIso: '2030-01-01T00:00:00Z'
    }));
    db.write(state => ({...state,
      [USERS_TABLE_NAME]: {ids: users.map(u => u.id), byId: Object.fromEntries(users.map(u => [u.id, u]))},
      [EVENTS_TABLE_NAME]: {ids: events.map(e => e.id), byId: Object.fromEntries(events.map(e => [e.id, e]))},
      [ASSETS_TABLE_NAME]: {ids: assets.map(a => a.id), byId: Object.fromEntries(assets.map(a => [a.id, a])),
        idsByOwnerUserId: {owner: ['public', 'private'], viewer: ['mine']}}
    }));
  });
  afterEach(() => TestBed.resetTestingModule());

  it('keeps asset discovery and ownership unchanged across profiles, including bookings in an unjoined group', async () => {
    const assets = TestBed.inject(LocalAssetsRepository);
    for (const userId of ['viewer', 'viewer-a', 'viewer-b']) {
      expect((await assets.queryVisibleAssets({userId, type: 'Supplies'})).map(a => a.id)).toEqual(['public']);
      const page = assets.queryVisibleAssetsPage({userId, type: 'Supplies', page: 0, pageSize: 20});
      expect(page.items.map(a => a.id)).toEqual(['public']);
      expect(page.total).toBe(1);
      expect(assets.peekOwnedAssetsByUser(userId).map(a => a.id)).toEqual(['mine']);
    }
  });

  it('stores a new asset on the base profile even when it is created while a group is selected', async () => {
    const assets = TestBed.inject(LocalAssetsRepository);
    const template = db.read()[ASSETS_TABLE_NAME].byId['public'];
    const saved = await assets.saveOwnedAsset('viewer-a', {...template, id: 'new-asset', requests: []});
    expect(saved.ownerUserId).toBe('viewer');
    expect(db.read()[ASSETS_TABLE_NAME].idsByOwnerUserId['viewer']).toContain('new-asset');
    expect(db.read()[ASSETS_TABLE_NAME].idsByOwnerUserId['viewer-a']).toBeUndefined();
    expect(assets.peekOwnedAssetsByUser('viewer-b').map(a => a.id)).toContain('new-asset');
  });

  it('opens a borrow window only for the event group participant, while inventory remains account-wide', async () => {
    const eventId = 'event-host-a';
    db.write(state => ({...state, [EVENTS_TABLE_NAME]: {...state[EVENTS_TABLE_NAME], byId: {
      ...state[EVENTS_TABLE_NAME].byId, [eventId]: {...state[EVENTS_TABLE_NAME].byId[eventId],
        subEvents: [{id: 'sub-1', startAt: '2035-04-18T19:00:00Z', endAt: '2035-04-18T22:00:00Z'}] as any}
    }}}));
    const assets = TestBed.inject(LocalAssetsRepository);
    const events = TestBed.inject(LocalEventsRepository);
    const service: LocalAssetsService = Object.assign(Object.create(LocalAssetsService.prototype), {
      assetsRepository: assets, eventsRepository: events, waitForRouteDelay: async () => {}
    });
    const scope = {eventId, subEventId: 'sub-1'};
    expect(await service.loadOwnedAssetDetailById('viewer-a', 'public', scope)).toBeNull();
    TestBed.inject(LocalActivityMembersRepository).replaceRecordsByOwner({ownerType: 'event', ownerId: eventId}, [{
      id: 'member-a', userId: 'viewer-a', role: 'Member', status: 'accepted', name: 'Viewer A',
      initials: 'VA', gender: 'man', ownerType: 'event', ownerId: eventId,
      metAtIso: '2035-04-18T18:00:00Z', actionAtIso: '2035-04-18T18:00:00Z'
    } as any]);
    expect((await service.loadOwnedAssetDetailById('viewer-a', 'public', scope))?.borrowWindow?.eventId).toBe(eventId);
    expect(await service.loadOwnedAssetDetailById('viewer-b', 'public', scope)).toBeNull();
    expect(await service.loadOwnedAssetDetailById('viewer', 'public', scope)).toBeNull();
    expect(await service.loadOwnedAssetDetailById('viewer-b', 'public')).not.toBeNull();
  });

  it('limits event discovery to the selected profile and never includes the unjoined group', () => {
    const events = TestBed.inject(LocalEventsRepository);
    for (const [viewer, host] of [['viewer', 'owner'], ['viewer-a', 'host-a'], ['viewer-b', 'host-b']]) {
      expect(events.queryExploreItems(viewer).map(e => e.id)).toEqual([`event-${host}`]);
      expect(events.queryEventRecordById(viewer, `event-${host}`)?.id).toBe(`event-${host}`);
      expect(events.queryEventRecordById(viewer, 'event-host-private')).toBeNull();
    }
  });
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
      hosting: 0,
      tickets: 0,
      asset: { tickets: 0 }
    }
  };
}

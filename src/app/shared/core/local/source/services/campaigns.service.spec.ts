import { LocalChatsService } from './chats.service';
import { UserProfileStore } from '../../../../ui/context/stores/user-profile.store';
import { RateOutboxRepository } from '../../../base/repositories/rate-outbox.repository';
import { LocalEventsService } from './events.service';
import { LocalActivityEventDetailsMapper } from '../mappers/event.mapper';
import { SeedWorkActivityRepository } from '../../seed/repositories/work-activity-seed.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalRatesRepository } from '../repositories/rates.repository';
import { BaseUserRatesMapper } from '../../../base/mappers/rate.mapper';
import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedUsersRepository } from '../../seed/repositories/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../seed/repositories/community-groups-seed.repository';
import { SeedCampaignsRepository } from '../../seed/repositories/campaigns-seed.repository';
import { LocalCampaignsService } from './campaigns.service';
import type { SaveCampaign } from '../../../contracts/campaign.interface';

describe('Independent Work campaigns', () => {
  let db: LocalMemoryDb;
  let service: LocalCampaignsService;
  let owner: string;
  let member: string;
  const draft = (): SaveCampaign => ({ userId: owner, title: 'Build a team', description: 'A practical idea', kind: 'business',
    category: 'technology', imageUrls: [], attachments: [] });
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: RouteDelayService, useValue: { waitForRouteDelay: async () => undefined } }] });
    db = TestBed.inject(LocalMemoryDb); await db.resetStorage();
    const users = TestBed.inject(SeedUsersRepository).seedDefaults();
    TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(users);
    const profiles = Object.values(db.read().users.byId).filter(u => u.workspaceGroupId === 'myscoutee-work');
    owner = profiles.find(u => u.name === 'Alex Turner')!.id;
    member = profiles.find(u => u.name === 'Farkas Anna')!.id;
    service = TestBed.inject(LocalCampaignsService);
  });
  afterEach(() => TestBed.resetTestingModule());
  it('keeps its lifecycle independent of event records and attendee state', async () => {
    const events = structuredClone(db.read().events); const memberships = structuredClone(db.read().activityMembers);
    let campaign = await service.save(draft());
    expect(campaign.status).toBe('draft');
    await expect(service.detail(member, campaign.id)).rejects.toThrow();
    campaign = await service.action(owner, campaign.id, 'publish', campaign.version);
    expect((await service.detail(member, campaign.id)).status).toBe('published');
    expect((await service.page(member, { page: 0, pageSize: 10, filters: { scope: 'discover' } })).items.map(c => c.id)).toEqual([campaign.id]);
    await expect(service.action(member, campaign.id, 'trash', campaign.version)).rejects.toThrow();
    campaign = await service.action(owner, campaign.id, 'trash', campaign.version);
    await expect(service.detail(member, campaign.id)).rejects.toThrow();
    campaign = await service.action(owner, campaign.id, 'restore', campaign.version);
    expect(campaign.status).toBe('draft');
    expect(db.read().events).toEqual(events); expect(db.read().activityMembers).toEqual(memberships);
  });
  it('lets a regular member organize a campaign and participate in another without becoming an app admin', async () => {
    const profileBefore = structuredClone(db.read().users.byId[member]);
    const first = await service.save(draft());
    await service.action(owner, first.id, 'publish', first.version);
    const own = await service.save({ ...draft(), userId: member, title: 'My opportunity' });
    const published = await service.action(member, own.id, 'publish', own.version);
    expect(published.ownerUserId).toBe(member);
    expect((await service.page(member, { page: 0, pageSize: 20, filters: { scope: 'discover' } })).items.map(c => c.id)).toContain(first.id);
    expect(db.read().users.byId[member]).toEqual(profileBefore);
    expect(profileBefore.admin).not.toBe(true);
    await expect(service.save({ ...draft(), userId: member, id: first.id, version: 1 })).rejects.toThrow('Forbidden');
  });

  it('rejects stale edits and access from another workspace or the Dating base profile', async () => {
    const campaign = await service.save(draft());
    await service.save({ ...draft(), id: campaign.id, version: campaign.version, title: 'Updated' });
    await expect(service.save({ ...draft(), id: campaign.id, version: campaign.version })).rejects.toThrow('Campaign changed');
    const rootOwner = db.read().users.byId[owner].accountUserId!;
    await expect(service.detail(rootOwner, campaign.id)).rejects.toThrow('Forbidden');
    const other = Object.values(db.read().users.byId).find(u => u.workspaceGroupId && u.workspaceGroupId !== 'myscoutee-work')!;
    await expect(service.detail(other.id, campaign.id)).rejects.toThrow();
  });
  it('stores separate ratings per campaign and queries one person with campaign filtering before aggregation', async () => {
    TestBed.inject(SeedCampaignsRepository).seedDefaults();
    const rates = TestBed.inject(LocalRatesRepository);
    const first = 'work-campaign-product-team'; const second = 'work-campaign-company-introductions';
    const record = (from: string, to: string, campaignId: string, rating: number) => BaseUserRatesMapper.toRecord({
      kind: 'game-card', raterUserId: from, ratedUserId: to, campaignId, rating
    })!;
    const writes = [record(member, owner, first, 6), record(member, owner, second, 10), record(owner, member, first, 8)];
    expect(new Set(writes.map(r => r.id)).size).toBe(3);
    rates.upsertGameCardRatings(writes);
    const query = { ownerUserId: member, mode: 'single' as const, displayDirection: 'mutual' as const, sort: 'happenedAt' as const, limit: 10 };
    const aggregate = await rates.queryActivityRateItemsPage(query);
    expect(aggregate.total).toBe(1);
    expect(aggregate.items[0]).toMatchObject({ userId: owner, scoreGiven: 8, scoreReceived: 8, campaignId: null });
    const selected = await rates.queryActivityRateItemsPage({ ...query, campaignId: first });
    expect(selected.total).toBe(1);
    expect(rates.peekRateItemsByUserId(member, first).find(item => item.id === selected.items[0].id)?.campaignId).toBe(first);
    expect(selected.items[0]).toMatchObject({ userId: owner, scoreGiven: 6, scoreReceived: 8, campaignId: first });
    expect((await service.detail(member, first)).viewerRating).toBe(6);
    const history = await service.history(member, owner, { page: 0, pageSize: 10 });
    expect(history.items.find(item => item.campaign.id === first)?.campaign.viewerRating).toBe(6);
    expect(history.items.find(item => item.campaign.id === second)?.campaign.viewerRating).toBe(10);
    expect(BaseUserRatesMapper.toSyncPayload(writes[0])?.campaignId).toBe(first);
    rates.upsertGameCardRatings([record(member, owner, second, 4)]);
    expect((await rates.queryActivityRateItemsPage(query)).items[0].scoreGiven).toBe(5);
    expect((await service.detail(member, second)).viewerRating).toBe(4);
    expect(db.read().userRates.ids.length).toBe(3);
    expect(rates.upsertGameCardRatings([record(member, owner, 'work-campaign-alex-draft', 9)])).toEqual([]);
    expect(db.read().userRates.ids.length).toBe(3);
  });

  it('notifies only the other person after a saved campaign rating, preserving its context and suppressing identical retries', async () => {
    TestBed.inject(SeedCampaignsRepository).seedDefaults();
    const outbox = TestBed.inject(RateOutboxRepository), rates = TestBed.inject(LocalRatesRepository);
    const record = BaseUserRatesMapper.toRecord({ kind: 'game-card', raterUserId: member, ratedUserId: owner,
      campaignId: 'work-campaign-product-team', rating: 8 })!;
    outbox.enqueueUserRateOutbox(record);
    await rates.flushPendingUserRatesOutboxBatch();
    const notifications = () => Object.values(db.read().notifications.byId).filter(n => n.kind === 'user-rated');
    expect(notifications()).toHaveLength(1);
    expect(notifications()[0].recipientUserId).toBe(db.read().users.byId[owner].accountUserId);
    expect(notifications()[0].payload).toMatchObject({ workspaceGroupId: 'myscoutee-work', campaignId: record.campaignId });
    expect(notifications()[0].actionPath).toContain('ratings=1');
    outbox.enqueueUserRateOutbox(record);
    await rates.flushPendingUserRatesOutboxBatch();
    expect(notifications()).toHaveLength(1);
  });

  it('opens a campaign conversation only after a persisted rating and delivers one peer notification per message', async () => {
    TestBed.inject(SeedCampaignsRepository).seedDefaults();
    const profile = TestBed.inject(UserProfileStore), chats = TestBed.inject(LocalChatsService);
    profile.setActiveUserId(member);
    const input = { serviceContext: 'campaign' as const, campaignId: 'work-campaign-product-team', targetUserId: owner, title: '', lastMessage: '' };
    await expect(chats.ensureServiceChat(input)).rejects.toThrow('Rate the campaign');
    const rates = TestBed.inject(LocalRatesRepository);
    TestBed.inject(RateOutboxRepository).enqueueUserRateOutbox(BaseUserRatesMapper.toRecord({ kind: 'game-card', raterUserId: member,
      ratedUserId: owner, campaignId: input.campaignId, rating: 8 })!);
    await rates.flushPendingUserRatesOutboxBatch();
    const chat = (await chats.ensureServiceChat(input))!;
    expect(chat.channelType).toBe('campaign');
    await chats.sendChatMessage(chat, 'Can we discuss the idea?', 'question-1');
    await chats.sendChatMessage(chat, 'Can we discuss the idea?', 'question-1');
    const notices = Object.values(db.read().notifications.byId).filter(n => n.kind === 'chat-message');
    expect(notices).toHaveLength(1); expect(notices[0].recipientUserId).toBe(db.read().users.byId[owner].accountUserId);
    expect(db.read().users.byId[owner].activities.chat?.campaign).toBe(1);
    expect(db.read().users.byId[member].activities.chat?.campaign ?? 0).toBe(0);
    profile.setActiveUserId(owner);
    const peer = (await chats.queryChatById(chat.id))!;
    expect(peer).toBeTruthy();
    const page = await chats.queryChatMessagesPage(peer, { page: 0, pageSize: 20 });
    expect(page.items.filter(m => m.id === 'question-1')).toHaveLength(1);
    expect(db.read().users.byId[owner].activities.chat?.campaign).toBe(0);
    expect(db.read().notifications.byId[notices[0].id].readAtIso).toBeTruthy();
  });

  it('seeds campaign events with a matching roster and preserves subsequent edits', () => {
    TestBed.inject(SeedCampaignsRepository).seedDefaults();
    const seed = TestBed.inject(SeedWorkActivityRepository); seed.seedDefaults();
    const state = db.read();
    const events = Object.values(state.events.byId);
    expect(events).toHaveLength(3);
    const eventRepository = TestBed.inject(LocalEventsRepository);
    expect(eventRepository.queryEventItemsByUser(member)).toHaveLength(3);
    expect(state.users.byId[member].activities?.event).toEqual(eventRepository.queryUserEventCounterSnapshot(member).event);
    expect(state.users.byId[owner].activities?.hosting).toBe(eventRepository.queryUserEventCounterSnapshot(owner).hosting);
    for (const event of events) {
      const campaign = state.campaigns.byId[event.campaignId!];
      expect(campaign).toBeTruthy();
      expect(event.creatorUserId).toBe(campaign.ownerUserId);
      const roster = Object.values(state.activityMembers.byId).filter(m => m.ownerType === 'event' && m.ownerId === event.id && m.status === 'accepted');
      expect(roster.length).toBe(event.acceptedMembers);
      expect(roster.every(m => state.users.byId[m.userId]?.workspaceGroupId === campaign.workspaceGroupId)).toBe(true);
    }
    const before = structuredClone(db.read()); seed.seedDefaults();
    expect(db.read().events).toEqual(before.events);
    expect(db.read().activityMembers).toEqual(before.activityMembers);
    expect(db.read().userRates).toEqual(before.userRates);
  });

  it('allows a campaign organizer to attach an event, without granting participants that authority', async () => {
    TestBed.inject(SeedCampaignsRepository).seedDefaults();
    TestBed.inject(SeedWorkActivityRepository).seedDefaults();
    const events = TestBed.inject(LocalEventsService);
    const source = Object.values(db.read().events.byId).find(e => e.creatorUserId === owner)!;
    const payload = LocalActivityEventDetailsMapper.toDto(source);
    payload.id = 'new-campaign-event'; payload.userId = member; payload.creatorUserId = member;
    await expect(events.syncEventSnapshot(payload)).rejects.toThrow('Forbidden');
    payload.userId = owner; payload.creatorUserId = owner;
    expect((await events.syncEventSnapshot(payload))?.campaignId).toBe(source.campaignId);
    const campaign = await service.detail(owner, source.campaignId!);
    await service.action(owner, campaign.id, 'unpublish', campaign.version);
    // An already linked event keeps its own lifecycle when the campaign is unpublished.
    expect((await events.syncEventSnapshot(payload))?.campaignId).toBe(source.campaignId);
  });

  it('filters opportunity kind and category before paging and keeps seed edits on reseeding', async () => {
    const seed = TestBed.inject(SeedCampaignsRepository); seed.seedDefaults();
    const first = await service.page(member, { page: 0, pageSize: 2, filters: { scope: 'all', kind: 'work' } });
    expect(first.items.length).toBe(2); expect(first.nextCursor).toBeTruthy();
    expect(first.items.every(c => ['work', 'both'].includes(c.kind))).toBe(true);
    const second = await service.page(member, { page: 1, pageSize: 2, cursor: first.nextCursor, filters: { scope: 'all', kind: 'work' } });
    expect(second.items.every(c => !first.items.some(a => a.id === c.id))).toBe(true);
    const creative = await service.page(member, { page: 0, pageSize: 50, filters: { scope: 'all', category: 'creative' } });
    expect(creative.items.length).toBeGreaterThan(0); expect(creative.items.every(c => c.category === 'creative')).toBe(true);
    const own = await service.detail(owner, 'work-campaign-alex-draft');
    await service.save({ ...own, userId: owner, title: 'My saved title' });
    expect(seed.seedDefaults()).toBe(false);
    expect((await service.detail(owner, own.id)).title).toBe('My saved title');
  });
});

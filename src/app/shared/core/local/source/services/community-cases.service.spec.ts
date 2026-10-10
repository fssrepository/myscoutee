import { LocalCommunityCasesRepository } from '../repositories/community-cases.repository';
import { LocalChatsService } from './chats.service';
import { UserProfileStore } from '../../../../ui/context/stores/profile/user-profile.store';
import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedUsersRepository } from '../../seed/repositories/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../seed/repositories/community-groups-seed.repository';
import { SeedCommunityCasesRepository } from '../../seed/repositories/community-cases-seed.repository';
import { LocalCommunityCasesService } from './community-cases.service';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';

describe('Community shared cases and scheduled reminders', () => {
  let db: LocalMemoryDb, service: LocalCommunityCasesService;
  let alex: string, maya: string, provider: string;
  const query = { page: 0, pageSize: 20 };
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: RouteDelayService, useValue: { waitForRouteDelay: async () => undefined } }] });
    db = TestBed.inject(LocalMemoryDb); await db.resetStorage();
    const users = TestBed.inject(SeedUsersRepository).seedDefaults();
    TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(users);
    TestBed.inject(SeedCommunityCasesRepository).seedDefaults();
    const account = (name: string) => users.find(u => u.name === name && !u.workspaceGroupId)!.id;
    alex = account('Alex Turner'); maya = account('Maya Stone'); provider = account('Farkas Anna');
    service = TestBed.inject(LocalCommunityCasesService);
  });
  afterEach(() => TestBed.resetTestingModule());
  const notifications = (db: LocalMemoryDb) => Object.values(db.read().notifications.byId);

  it('creates one shared case exactly 45 days ahead, includes its owner in the reminder and does not duplicate on retry', async () => {
    const due = Date.parse('2026-11-19T09:00:00.000Z');
    expect(await service.createScheduledCases(COMMUNITY_BASE_GROUP_ID, new Date(due - 45 * 86400000 - 1))).toBe(0);
    expect(await service.createScheduledCases('myscoutee-work', new Date(due))).toBe(0);
    expect(await service.createScheduledCases(COMMUNITY_BASE_GROUP_ID, new Date(due - 45 * 86400000))).toBe(1);
    const cases = (await service.page(alex, query)).items.filter(c => c.scheduledTaskId);
    expect(cases).toHaveLength(1); expect(cases[0].affectedCount).toBe(4);
    const reminder = notifications(db).filter(n => n.kind === 'case-reminder');
    expect(reminder).toHaveLength(4); expect(reminder.map(n => n.recipientUserId)).toContain(alex);
    expect(reminder.every(n => n.payload?.['workspaceGroupId'] === COMMUNITY_BASE_GROUP_ID && n.sourceId === cases[0].id)).toBe(true);
    expect(await service.createScheduledCases(COMMUNITY_BASE_GROUP_ID, new Date(due - 45 * 86400000))).toBe(0);
    expect(notifications(db).filter(n => n.kind === 'case-reminder')).toHaveLength(4);
  });
  it('aggregates assigned cases across communities without giving an external provider access to private groups', async () => {
    expect((await service.page(alex, query)).items).toHaveLength(2);
    const rows = (await service.page(provider, query)).items;
    expect(rows.map(c => c.id)).toEqual(['community-case-park-meters']);
    expect(rows[0].canManage).toBe(false);
    await expect(service.detail(provider, 'community-case-riverside-leak')).rejects.toThrow();
    expect(Object.values(db.read().activityMembers.byId).some(m => m.userId === provider && m.ownerId === 'community-park-court')).toBe(false);
    expect((await service.tasks(provider, query)).items).toHaveLength(0);
  });
  it('notifies the manager of a resident report, never its author, and rejects a resident choosing All', async () => {
    const before = (await service.page(alex, query)).context!.total;
    const form = { userId: maya, title: 'Broken light', description: 'The entrance light is out.', communityId: 'community-riverside',
      caseType: 'fault' as const, audienceAll: false, audienceAccountIds: [maya] };
    const c = await service.save(form);
    expect(notifications(db).filter(n => n.sourceId === c.id).map(n => n.recipientUserId)).toEqual([alex]);
    expect((await service.page(alex, query)).context?.total).toBe(before + 1);
    const read = await service.read(alex, c.id);
    expect(read.unread).toBe(false);
    expect((await service.page(alex, query)).context?.total).toBe(before + 1);
    await expect(service.save({ ...form, audienceAll: true })).rejects.toThrow('Forbidden');
  });
  it('requires acceptance and an explicit chat invitation, then revokes the external provider conversation on leave', async () => {
    // This scenario exercises a pending invitation; the general demo seed is already accepted.
    const records = TestBed.inject(LocalCommunityCasesRepository);
    const invited = structuredClone(records.findCase('community-case-park-meters')!);
    invited.support.find(member => member.accountId === provider)!.status = 'invited';
    invited.memberStates = {...invited.memberStates, [provider]: 'invited'};
    records.saveCase(invited, invited.version);
    const profile = TestBed.inject(UserProfileStore), chats = TestBed.inject(LocalChatsService);
    const providerProfile = `group:${COMMUNITY_BASE_GROUP_ID}:${provider}`;
    profile.setActiveUserId(providerProfile);
    let c = await service.detail(provider, 'community-case-park-meters');
    const chatRequest = { serviceContext: 'case' as const, caseId: c.id, targetUserId: '', title: '', lastMessage: '' };
    await expect(chats.ensureServiceChat(chatRequest)).rejects.toThrow('Case unavailable');
    c = await service.action(c.id, {userId: provider, version: c.version, action: 'accept-invite'});
    c = await service.action(c.id, {userId: alex, version: c.version, action: 'invite-chat', memberAccountIds: [provider]});
    const chat = (await chats.ensureServiceChat({ serviceContext: 'case', caseId: c.id, targetUserId: '', title: '', lastMessage: '' }))!;
    expect(chat.memberIds).toContain(`group:${COMMUNITY_BASE_GROUP_ID}:${alex}`);
    expect(chat.memberIds).toContain(providerProfile);
    await chats.sendChatMessage(chat, 'Which meters are involved?', 'case-question');
    const notices = notifications(db).filter(n => n.kind === 'chat-message');
    expect(notices).toHaveLength(3); expect(notices.some(n => n.recipientUserId === provider)).toBe(false);
    await service.action(c.id, { userId: provider, version: c.version, action: 'leave' });
    expect(await chats.queryChatById(chat.id)).toBeNull();
    await expect(chats.sendChatMessage(chat, 'Another message', 'after-leave')).rejects.toThrow('Chat unavailable');
    expect(Object.values(db.read().activityMembers.byId).some(m => m.userId === provider && m.ownerId === 'community-park-court')).toBe(false);
  });

  it('uses unique selected members for the scheduled count and rejects unauthorized or stale edits', async () => {
    const form = { userId: alex, communityId: 'community-riverside', title: 'A shared repair', description: '', caseType: 'maintenance' as const,
      audienceAll: false, audienceAccountIds: [maya, maya], startAtIso: '2026-12-01T09:00:00Z', nextDueAtIso: '2026-12-01T09:00:00Z', frequency: 'once' as const, enabled: true };
    const task = await service.saveTask(form);
    expect(task.affectedCount).toBe(1);
    expect(task.nextDueAtIso).toBe('2026-12-01T09:00:00.000Z');
    await expect(service.saveTask({ ...form, userId: maya })).rejects.toThrow('Forbidden');
    await service.saveTask({ ...form, id: task.id, version: task.version, title: 'Changed' });
    await expect(service.saveTask({ ...form, id: task.id, version: task.version })).rejects.toThrow('case.changed');
  });
});

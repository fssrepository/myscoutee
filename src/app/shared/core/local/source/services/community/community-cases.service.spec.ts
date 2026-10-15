import { LocalCommunityCasesRepository } from '../../repositories/community/community-cases.repository';
import { LocalChatsService } from '../chat/chats.service';
import { UserProfileStore } from '../../../../../ui/context/stores/profile/user-profile.store';
import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../../common/app.db';
import { RouteDelayService } from '../../../../base/services/platform/route-delay.service';
import { SeedUsersRepository } from '../../../seed/repositories/accounts/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../../seed/repositories/groups/community-groups-seed.repository';
import { SeedCommunityCasesRepository } from '../../../seed/repositories/community/community-cases-seed.repository';
import { LocalCommunityCasesService } from './community-cases.service';
import { COMMUNITY_BASE_GROUP_ID } from '../../../../contracts/groups/group-type';

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

  it('calendar ranges include visible task dates beyond list paging, without changing list counts or provider visibility', async () => {
    const month = {...query, pageSize: 1, view: 'month', rangeStart: '2026-10-01', rangeEnd: '2026-10-31'};
    const rows = await service.page(alex, month);
    expect(rows.items.map(c => c.id).sort()).toEqual(['community-case-park-meters', 'community-case-riverside-leak']);
    expect(rows.nextCursor).toBeNull();
    expect(rows.context?.total).toBe((await service.page(alex, query)).context?.total);
    expect((await service.page(provider, month)).items.map(c => c.id)).toEqual(['community-case-park-meters']);
    expect((await service.page(alex, {...month, rangeStart: '2026-10-09', rangeEnd: '2026-10-10'})).items).toHaveLength(0);
    expect((await service.page(alex, {...month, filters: {caseType: 'fault'}})).items.map(c => c.id)).toEqual(['community-case-riverside-leak']);
    await expect(service.page(alex, {...month, rangeEnd: '2027-10-01'})).rejects.toThrow('Invalid calendar range');
    const repository = TestBed.inject(LocalCommunityCasesRepository);
    const c = structuredClone(repository.findCase('community-case-park-meters')!);
    c.boardTasks = (c.boardTasks ?? []).map(t => ({...t, status: 'deleted'}));
    repository.saveCase(c, c.version);
    expect((await service.page(provider, month)).items).toHaveLength(0);
  });
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
  it.each([
    ['monthly', '2026-01-31T09:00:00.000Z', '2026-02-28T09:00:00.000Z'],
    ['quarterly', '2026-11-30T09:00:00.000Z', '2027-02-28T09:00:00.000Z'],
    ['yearly', '2028-02-29T09:00:00.000Z', '2029-02-28T09:00:00.000Z']
  ] as const)('advances %s through short months without resetting progress on description edits', async (frequency, startAtIso, expectedNext) => {
    const form = { userId: alex, title: `Recurrence ${frequency}`, description: 'Initial description',
      communityId: null, caseType: 'maintenance' as const, audienceAll: false, audienceAccountIds: [], startAtIso, nextDueAtIso: startAtIso, frequency, enabled: true };
    const task = await service.saveTask(form);
    await service.createScheduledCases(COMMUNITY_BASE_GROUP_ID, new Date(Date.parse(startAtIso) - 45 * 86400000));
    const advanced = (await service.tasks(alex, {page: 0, pageSize: 20, filters: {status: 'active'}})).items.find(t => t.id === task.id)!;
    expect(advanced.startAtIso).toBe(startAtIso);
    expect(advanced.nextDueAtIso).toBe(expectedNext);
    const edited = await service.saveTask({...form, id: task.id, version: advanced.version, description: 'Edited description'});
    expect(edited.startAtIso).toBe(startAtIso);
    expect(edited.nextDueAtIso).toBe(expectedNext);
    const changed = await service.saveTask({...form, id: task.id, version: edited.version, startAtIso: '2030-03-31T09:00:00.000Z'});
    expect(changed.nextDueAtIso).toBe('2030-03-31T09:00:00.000Z');
  });
  it('applies all schedule commands to current worker progress while preserving editor and permission guards', async () => {
    const startAtIso = '2026-11-28T12:52:00.000Z';
    const form = {userId: alex, title: 'Current schedule', description: 'Current description', communityId: null,
      caseType: 'maintenance' as const, audienceAll: false, audienceAccountIds: [], startAtIso,
      nextDueAtIso: startAtIso, frequency: 'yearly' as const, enabled: true};
    const task = await service.saveTask(form);
    await service.createScheduledCases(COMMUNITY_BASE_GROUP_ID, new Date(Date.parse(startAtIso) - 45 * 86400000));
    for (const action of ['pause', 'resume', 'trash', 'restore'] as const) {
      await expect(service.taskAction(maya, task.id, action, task.version)).rejects.toThrow('Forbidden');
      const changed = await service.taskAction(alex, task.id, action, task.version);
      expect(changed.version).toBeGreaterThan(task.version);
      expect(changed.nextDueAtIso).toBe('2027-11-28T12:52:00.000Z');
      expect(changed.description).toBe(form.description);
      expect(changed.status).toBe(action === 'trash' ? 'trash' : action === 'pause' ? 'paused' : 'active');
      await expect(service.taskAction(alex, task.id, action, task.version)).rejects.toThrow('Invalid schedule action');
    }
    await expect(service.saveTask({...form, id: task.id, version: task.version, title: 'Stale overwrite'})).rejects.toThrow('case.changed');
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
  it('keeps an open editor version valid when another member marks the case read', async () => {
    const created = await service.save({userId: alex, title: 'Read without a conflict', description: '',
      communityId: 'community-park-court', caseType: 'maintenance', audienceAll: false, audienceAccountIds: [maya]});
    const before = (await service.page(alex, query)).context;
    expect((await service.detail(maya, created.id)).unread).toBe(true);
    expect((await service.read(maya, created.id)).version).toBe(created.version);
    const again = await service.read(maya, created.id);
    expect(again.version).toBe(created.version);
    expect(again.unread).toBe(false);
    expect((await service.page(alex, query)).context).toEqual(before);
    const started = await service.action(created.id, {userId: alex, action: 'start', version: created.version});
    expect(started.status).toBe('in-progress');
    expect(started.version).toBe(created.version + 1);
    await expect(service.save({userId: alex, id: created.id, version: created.version, title: 'Stale editor',
      description: '', communityId: 'community-park-court', caseType: 'maintenance', audienceAll: false, audienceAccountIds: [maya]}))
      .rejects.toThrow('case.changed');
  });
  it('uses current membership for leave and takeover even when another member changed the case version', async () => {
    const created = await service.save({userId: alex, title: 'Independent membership commands', description: '',
      communityId: 'community-park-court', caseType: 'maintenance', audienceAll: false, audienceAccountIds: [maya]});
    const joined = await service.action(created.id, {userId: maya, action: 'join', version: created.version});
    const left = await service.action(created.id, {userId: alex, action: 'leave', version: created.version});
    expect(left.version).toBe(joined.version + 1);
    expect(left.ownerAccountId).toBeNull();
    expect(left.status).toBe('open');
    expect((await service.detail(maya, created.id)).membershipStatus).toBe('accepted');
    const claimed = await service.action(created.id, {userId: maya, action: 'take-over', version: joined.version});
    expect(claimed.ownerAccountId).toBe(maya);
    await expect(service.action(created.id, {userId: alex, action: 'start', version: created.version})).rejects.toThrow('Forbidden');
    const finalLeave = await service.action(created.id, {userId: maya, action: 'leave', version: joined.version});
    expect(finalLeave.status).toBe('trash');
    expect(finalLeave.ownerAccountId).toBeNull();
  });
  it('validates lifecycle against current state while rejecting stale editor snapshots', async () => {
    const created = await service.save({userId: alex, title: 'Current lifecycle', description: '',
      communityId: 'community-park-court', caseType: 'maintenance', audienceAll: false, audienceAccountIds: [maya]});
    await service.action(created.id, {userId: maya, action: 'join', version: created.version});
    expect((await service.action(created.id, {userId: alex, action: 'start', version: created.version})).status).toBe('in-progress');
    await expect(service.action(created.id, {userId: alex, action: 'start', version: created.version})).rejects.toThrow('case.changed');
    await expect(service.action(created.id, {userId: alex, action: 'save-board-task', version: created.version})).rejects.toThrow('case.changed');
    await expect(service.action(created.id, {userId: alex, action: 'edit-offer', version: created.version})).rejects.toThrow('case.changed');
    expect((await service.action(created.id, {userId: alex, action: 'cancel', version: created.version})).status).toBe('cancelled');
    await expect(service.action(created.id, {userId: alex, action: 'complete', version: created.version})).rejects.toThrow('case.changed');
    expect((await service.action(created.id, {userId: alex, action: 'reopen', version: created.version})).status).toBe('open');
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

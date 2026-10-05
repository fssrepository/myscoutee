import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalHelpCenterService } from './help-center.service';
import { SeedHelpCenterRepository } from '../../seed/repositories/help-center-seed.repository';
import { I18nService } from '../../../base/services/i18n.service';
import { LocalCommunityGroupsService } from './community-groups.service';
import { LocalAdminStatsRepository } from '../repositories/admin-stats.repository';
import { LocalAdminAffinityGraphRepository } from '../repositories/admin-affinity-graph.repository';
import { LocalAdminNotificationsService } from './admin-notifications.service';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedUsersRepository } from '../../seed/repositories/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../seed/repositories/community-groups-seed.repository';
import { SeedAdminBootstrapRepository } from '../../seed/repositories/admin-bootstrap-seed.repository';
import { LocalAdminParamsService } from './admin-params.service';
import { LocalAdminMonitoringService } from './admin-monitoring.service';
import { LocalAdminModerationService } from './admin-moderation.service';

describe('App-admin base group data isolation', () => {
  let db: LocalMemoryDb;
  let workAdmin: string;
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
    TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { ensureLanguageLoaded: async () => {}, translateForLanguage: (key: string) => key } }, { provide: RouteDelayService, useValue: { waitForRouteDelay: async () => undefined } }] });
    db = TestBed.inject(LocalMemoryDb); await db.resetStorage();
    // This unit runner has no IndexedDB; preserve its transaction contract in one backing map.
    const entries = new Map<string, unknown>();
    vi.spyOn(db, 'readIndexedDbTableEntry').mockImplementation(async <T>(key: string) => structuredClone(entries.get(key) ?? null) as T | null);
    vi.spyOn(db, 'writeIndexedDbTableEntry').mockImplementation(async (key, value) => { entries.set(key, structuredClone(value)); });
    vi.spyOn(db, 'updateIndexedDbTableEntry').mockImplementation(async <T>(key: string, update: (value: T | null) => T) => {
      const next = update(structuredClone(entries.get(key) ?? null) as T | null); entries.set(key, structuredClone(next)); return next;
    });
    TestBed.inject(SeedUsersRepository).seedDefaults();
    const admins = TestBed.inject(SeedAdminBootstrapRepository);
    await admins.seedDemoAdminUsers();
    TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(Object.values(db.read().users.byId));
    await admins.seedDemoAdminStores();
    workAdmin = Object.values(db.read().users.byId).find(u => u.workspaceGroupId === 'myscoutee-work' && u.accountUserId === 'admin-demo-ava')!.id;
  });
  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('keeps Community admin jobs, profiles and demo membership separate from Work and Dating', async () => {
    const communityAdmin = Object.values(db.read().users.byId).find(u => u.workspaceGroupId === 'myscoutee-community' && u.accountUserId === 'admin-demo-ava')!;
    expect(communityAdmin.admin).toBe(true);
    const groups = TestBed.inject(LocalCommunityGroupsService);
    expect((await groups.resolveWorkspace('admin-demo-ava', 'myscoutee-community')).profile.id).toBe(communityAdmin.id);
    const jobs = TestBed.inject(LocalAdminNotificationsService);
    const options = { skipDemoDelay: true };
    const work = await jobs.loadNotificationCenter(options, workAdmin);
    const community = await jobs.loadNotificationCenter(options, communityAdmin.id);
    expect(community.rules.some(rule => rule.ruleKey === 'event-random-groups')).toBe(false);
    const rule = community.rules.find(rule => rule.ruleKey === 'affinity-recompute')!;
    await jobs.saveNotificationCenter([{ ...rule, enabled: false }], communityAdmin.id, options);
    expect(await jobs.loadNotificationCenter(options, workAdmin)).toEqual(work);
    const users = TestBed.inject(LocalUsersRepository);
    const alex = Object.values(db.read().users.byId).find(u => !u.workspaceGroupId && u.name === 'Alex Turner')!;
    expect(users.queryDemoBaseGroupTypes([alex.id]).get(alex.id)).toEqual(['dating', 'work', 'community']);
  });

  it('isolates job schedules and retains an omitted Work random-room job after reseeding', async () => {
    const jobs = TestBed.inject(LocalAdminNotificationsService);
    const options = { skipDemoDelay: true };
    const dating = await jobs.loadNotificationCenter(options, 'admin-demo-ava');
    const work = await jobs.loadNotificationCenter(options, workAdmin);
    expect(dating.rules.some(rule => rule.ruleKey === 'event-random-groups')).toBe(true);
    expect(work.rules.some(rule => rule.ruleKey === 'event-random-groups')).toBe(false);
    const rule = work.rules.find(rule => rule.ruleKey === 'affinity-recompute')!;
    await jobs.saveNotificationCenter([{ ...rule, enabled: false }], workAdmin, options);
    expect(await jobs.loadNotificationCenter(options, 'admin-demo-ava')).toEqual(dating);
    await TestBed.inject(SeedAdminBootstrapRepository).seedDemoAdminStores();
    expect((await jobs.loadNotificationCenter(options, workAdmin)).rules.find(item => item.ruleKey === rule.ruleKey)?.enabled).toBe(false);
    await expect(jobs.saveNotificationCenter([dating.rules.find(item => item.ruleKey === 'event-random-groups')!], workAdmin, options))
      .rejects.toThrow('Job is not seeded for this group');
  });

  it('updates only the due group statistics and persists its graph/history across reads', async () => {
    const bootstrap = TestBed.inject(SeedAdminBootstrapRepository);
    await bootstrap.buildAndWriteAffinityGraphSnapshot();
    const stats = TestBed.inject(LocalAdminStatsRepository);
    const graph = TestBed.inject(LocalAdminAffinityGraphRepository);
    const jobs = TestBed.inject(LocalAdminNotificationsService);
    const datingStats = await stats.readStore();
    const datingGraph = await graph.readGroupSnapshot(null);
    const dating = await jobs.loadNotificationCenter({ skipDemoDelay: true }, 'admin-demo-ava');
    await jobs.saveNotificationCenter(dating.rules.map(rule => ({ ...rule, enabled: false })), 'admin-demo-ava');
    vi.setSystemTime(new Date('2026-10-05T01:00:00Z'));
    await jobs.runStatsTick();
    expect(await stats.readStore()).toEqual(datingStats);
    expect(await graph.readGroupSnapshot(null)).toEqual(datingGraph);
    const work = await stats.readStore<{ generatedAtIso: string; graph: { timeline: unknown[] } }>('myscoutee-work');
    expect(work?.generatedAtIso).toBe('2026-10-05T01:00:00.000Z');
    expect(work?.graph.timeline).toHaveLength(14);
    const rule = await jobs.loadNotificationRuleRuntime('admin-telemetry', workAdmin);
    expect(rule?.runState.lastRunStatus).toBe('completed');
    expect(rule?.runHistory?.[0].trigger).toBe('scheduled');
    expect((await graph.readGroupSnapshot('myscoutee-work'))?.nodes.every(node => db.read().users.byId[node.id]?.workspaceGroupId === 'myscoutee-work')).toBe(true);
  });

  it('saves Work content revisions and rejects mutations of Dating content', async () => {
    const seed = TestBed.inject(SeedHelpCenterRepository);
    await seed.seedDefaults();
    const help = TestBed.inject(LocalHelpCenterService);
    const dating = await help.loadAdminState('admin-demo-ava', 'help', 'en');
    const work = await help.loadAdminState(workAdmin, 'help', 'en');
    expect(work.activeRevision?.id).not.toBe(dating.activeRevision?.id);
    const saved = await help.saveRevision({ ...work.activeRevision!, actorUserId: workAdmin,
      title: 'Work guide update', baseRevisionId: work.activeRevision!.id });
    const draft = saved.revisions.find(revision => revision.title === 'Work guide update')!;
    await help.activateRevision(draft.id, workAdmin);
    await seed.seedDefaults();
    expect((await help.loadState('help', 'en', null, 'myscoutee-work')).activeRevision?.id).toBe(draft.id);
    expect(await help.loadAdminState('admin-demo-ava', 'help', 'en')).toEqual(dating);
    await expect(help.activateRevision(dating.activeRevision!.id, workAdmin)).rejects.toThrow();
    await expect(help.deleteRevision(dating.activeRevision!.id, workAdmin)).rejects.toThrow();
  });

  it('updates the selected admin job badge and its workspace aggregate', async () => {
    const groups = TestBed.inject(LocalCommunityGroupsService);
    const jobs = TestBed.inject(LocalAdminNotificationsService);
    const before = (await groups.workspaces('admin-demo-ava')).find(group => group.groupId === 'myscoutee-work')!.activity;
    const datingBadge = db.read().users.byId['admin-demo-ava'].activities.adminJobs;
    const state = await jobs.loadNotificationCenter({ skipDemoDelay: true }, workAdmin);
    const rule = state.rules[0];
    await jobs.saveNotificationCenter([{ ...rule, runState: { ...rule.runState, currentStatus: 'failed', lastRunStatus: 'failed' } }], workAdmin);
    expect(db.read().users.byId[workAdmin].activities.adminJobs).toBe(1);
    expect(db.read().users.byId['admin-demo-ava'].activities.adminJobs).toBe(datingBadge);
    expect((await groups.workspaces('admin-demo-ava')).find(group => group.groupId === 'myscoutee-work')!.activity).toBe(before + 1);
  });

  it('saves and reloads Work parameters and history without changing Dating', async () => {
    const params = TestBed.inject(LocalAdminParamsService);
    const before = await params.loadParamsState(undefined, 'admin-demo-ava');
    const work = await params.loadParamsState(undefined, workAdmin);
    const section = work.sections.find(s => s.key === 'matching')!;
    await params.saveParamsSection('matching', section.fields, 'Work-specific update', workAdmin);
    expect(await params.loadParamsState(undefined, 'admin-demo-ava')).toEqual(before);
    await TestBed.inject(SeedAdminBootstrapRepository).seedDemoAdminStores();
    const history = await params.loadParamsHistory('matching', undefined, workAdmin);
    expect(history.versions[0].summary).toBe('Work-specific update');
    expect((await params.loadParamsState(undefined, workAdmin)).sections.find(s => s.key === 'matching')!.summary).toBe('Work-specific update');
  });

  it('keeps monitoring categories but reads separate Work measurements', async () => {
    const monitoring = TestBed.inject(LocalAdminMonitoringService);
    const dating = await monitoring.loadMonitoringState('all', 'admin-demo-ava');
    const work = await monitoring.loadMonitoringState('all', workAdmin);
    expect(work.categories.map(c => c.key)).toEqual(dating.categories.map(c => c.key));
    expect(work.categories.every(c => c.total === 0)).toBe(true);
    expect(dating.categories.some(c => c.total > 0)).toBe(true);
  });

  it('keeps Work support cases, assignments and badges in their base group', async () => {
    const moderation = TestBed.inject(LocalAdminModerationService);
    const chats = TestBed.inject(LocalChatsRepository);
    const member = Object.values(db.read().users.byId).find(u => u.workspaceGroupId === 'myscoutee-work' && !u.admin)!;
    await moderation.warnUser(member.id, { id: workAdmin, name: 'Ava', initials: 'AV', email: '' }, 'Review this report');
    const query = { page: 0, pageSize: 10, filters: { adminServiceOnly: true, supportCaseFilter: 'all' as const } };
    const work = chats.queryActivitiesChatPage(workAdmin, query);
    expect(work.items).toHaveLength(1);
    expect(chats.queryActivitiesChatPage('admin-demo-ava', query).items).toHaveLength(0);
    expect(db.read().users.byId[workAdmin].activities.chat?.supportCases?.warned).toBe(1);
    const selected = chats.updateSupportCase(work.items[0], 'pick');
    expect(selected?.supportCase?.assignee?.userId).toBe(workAdmin);
    expect(db.read().users.byId[workAdmin].activities.chat?.supportCases?.picked).toBe(1);
    expect(chats.updateSupportCase({ ...work.items[0], ownerUserId: 'admin-demo-ava' } as typeof work.items[0], 'solve')).toBeNull();
    expect(() => moderation.requireScope(member.id, member.id)).toThrow('App-admin access required');
  });

  it('rejects moderation mutations from the other base context', () => {
    const moderation = TestBed.inject(LocalAdminModerationService);
    const member = Object.values(db.read().users.byId).find(u => u.workspaceGroupId === 'myscoutee-work' && !u.admin)!;
    expect(() => moderation.requireScope('admin-demo-ava', member.id)).toThrow();
    expect(() => moderation.requireScope(workAdmin, member.id)).not.toThrow();
    expect(db.read().users.byId[member.id].admin).not.toBe(true);
  });
});

import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';
// Consume the running watcher's compiled output; no compiler or browser session.
const compiled = compiledDevModules(process.argv[2]);
const Service = await compiled.symbol('LocalCommunityCasesService');
const records = new Map(), tasks = new Map(), notices = [], base = 'myscoutee-community';
const group = { id: 'homes', name: 'Homes', groupType: 'community' };
let roster = [{ userId: 'admin', role: 'Admin' }, { userId: 'resident', role: 'Member' }];
const copy = value => JSON.parse(JSON.stringify(value));
const save = map => (row, version) => {
  if (map.has(row.id)) assert.equal(map.get(row.id).version, version);
  map.set(row.id, copy(row)); return row;
};
const service = Object.create(Service.prototype);
Object.assign(service, {
  actor: async id => id,
  repository: { ready: async () => {}, flush: async () => {}, tasks: () => [...tasks.values()], findTask: id => tasks.get(id), saveTask: save(tasks), cases: () => [...records.values()], findCase: id => records.get(id), saveCase: save(records) },
  access: {
    managedGroups: id => new Set(id === 'admin' ? ['homes'] : []),
    group: () => group, roster: () => roster, member: (_, id) => roster.find(m => m.userId === id),
    admin: (_, id) => id === 'admin', requireAdmin: (_, id) => { if (id !== 'admin') throw Error('Forbidden'); },
    requireBaseMember() {}, audience: (_, all, ids) => all ? roster.map(m => m.userId) : ids
  },
  groups: { find: () => group }, users: { queryUserById: id => ({ id, name: id, images: [] }) },
  chats: { syncCaseChat() {} }, notifications: { append: rows => notices.push(...rows) }
});
const fields = { userId: 'resident', communityId: null, title: 'Annual inspection', description: 'Inspect the meter.', caseType: 'maintenance', audienceAll: false, audienceAccountIds: [], startAtIso: '2026-11-19T09:35:00.000Z', frequency: 'yearly', enabled: true };
const page = (actor, status = 'active') => service.tasks(actor, { page: 0, pageSize: 20, filters: { status } });
const action = (actor, task, command) => service.taskAction(actor, task.id, command, tasks.get(task.id).version);
let personal = await service.saveTask(fields);
assert.equal(personal.communityId, null); assert.equal(personal.canManage, true); assert.equal(personal.status, 'active');
assert.deepEqual(personal.audienceAccountIds, ['resident']);
assert.equal((await page('resident')).total, 1); assert.equal((await page('admin')).total, 0);
await assert.rejects(() => service.saveTask({ ...fields, id: personal.id, version: personal.version, userId: 'other' }), /Forbidden/);
await assert.rejects(() => action('other', personal, 'pause'), /Forbidden/);
const shared = await service.saveTask({ ...fields, userId: 'admin', communityId: 'homes', audienceAll: true });
assert.equal((await page('resident')).items.find(t => t.id === shared.id).canManage, false);
assert.equal((await page('other')).total, 0);
await assert.rejects(() => action('resident', shared, 'pause'), /Forbidden/);
const selected = await service.saveTask({ ...fields, userId: 'admin', communityId: 'homes', audienceAccountIds: ['admin'] });
assert.ok(!(await page('resident')).items.some(t => t.id === selected.id));
group.lifecycleStatus = 'deleted'; assert.deepEqual((await page('resident')).items.map(t => t.id), [personal.id]); delete group.lifecycleStatus;
console.log('PASS personal ownership, group-admin editing, affected-member visibility and group lifecycle isolation');

personal = await action('resident', personal, 'pause');
assert.deepEqual((await page('resident')).context, { total: 2, active: 1, paused: 1, trash: 0 });
assert.equal((await page('resident', 'paused')).items[0].id, personal.id);
await assert.rejects(() => service.taskAction('resident', personal.id, 'resume', 0), /changed/);
personal = await service.saveTask({ ...fields, id: personal.id, version: personal.version, enabled: true });
assert.equal(personal.status, 'paused', 'Ordinary edits cannot change lifecycle');
personal = await action('resident', personal, 'trash');
assert.deepEqual((await page('resident')).context, { total: 1, active: 1, paused: 0, trash: 1 });
await assert.rejects(() => action('resident', personal, 'resume'), /Invalid/);
await assert.rejects(() => service.saveTask({ ...fields, id: personal.id, version: personal.version }), /not found/);
await action('admin', shared, 'pause'); await action('admin', selected, 'trash');
assert.equal(await service.createScheduledCases(base, new Date('2026-10-06T09:35:00Z')), 0, 'Paused/deleted schedules do not run');
personal = await action('resident', personal, 'restore');
assert.equal(personal.status, 'active');
console.log('PASS lifecycle persistence, bucket counters, stale-write guard, restore and inactive worker exclusion');

assert.equal(await service.createScheduledCases(base, new Date('2026-10-05T09:34:59Z')), 0);
assert.equal(await service.createScheduledCases(base, new Date('2026-10-05T09:35:00Z')), 1);
assert.equal(await service.createScheduledCases(base, new Date('2026-10-05T09:35:00Z')), 0);
const occurrence = [...records.values()][0];
assert.equal(occurrence.ownerAccountId, 'resident'); assert.equal(occurrence.memberStates.resident, 'accepted');
assert.deepEqual(occurrence.participantAccountIds, ['resident']);
assert.ok(notices.some(n => n.recipientUserId.endsWith(':resident')));
assert.equal(tasks.get(personal.id).startAtIso, fields.startAtIso);
assert.equal(tasks.get(personal.id).nextDueAtIso, '2027-11-19T09:35:00.000Z');
personal = await service.saveTask({ ...fields, id: personal.id, version: tasks.get(personal.id).version, title: 'Renamed inspection' });
assert.equal(personal.nextDueAtIso, '2027-11-19T09:35:00.000Z', 'Unchanged schedule does not reset worker progress');
const detail = await service.detail('resident', occurrence.id); assert.equal(detail.canManage, true);
await service.save({ ...fields, id: detail.id, version: detail.version, title: 'Personal case edit' });
assert.equal((await service.detail('resident', detail.id)).title, 'Personal case edit');
await assert.rejects(() => service.save({ ...fields, communityId: null }), /community group/, 'Manual cases retain their group requirement');
personal = await service.saveTask({ ...fields, id: personal.id, version: personal.version, startAtIso: '2026-12-08T14:35:00.000Z', frequency: 'quarterly' });
assert.equal(personal.nextDueAtIso, personal.startAtIso);
assert.equal(personal.frequency, 'quarterly');
console.log('PASS start-date persistence, minute precision, worker lead boundary/advance/idempotency and editable personal occurrence');

await action('admin', shared, 'resume');
assert.equal(await service.createScheduledCases(base, new Date('2026-10-05T09:35:00Z')), 1);
const sharedCase = [...records.values()].find(c => c.scheduledTaskId === shared.id);
assert.equal(sharedCase.ownerAccountId, null); assert.equal(sharedCase.memberStates.resident, 'invited');
roster = roster.filter(m => m.userId !== 'resident');
const result = await action('admin', shared, 'pause'); assert.equal(result.affectedCount, 1);
assert.ok(!(await page('resident')).items.some(t => t.id === shared.id));
console.log('PASS group worker retains shared invitations and membership removal updates audience/visibility');

const Store = await compiled.symbol('CommunityCasesStore'), signal = await compiled.symbol('signal');
const store = Object.create(Store.prototype);
Object.assign(store, { taskRevision: 0, taskCounters: signal({ total: 2, active: 2, paused: 0, trash: 0 }), taskChanged: signal(null), counters: signal({ total: 7 }) });
const initial = { id: 's', status: 'active' };
store.publishTask({ ...initial, status: 'paused' }, initial);
assert.deepEqual(store.taskCounters(), { total: 2, active: 1, paused: 1, trash: 0 });
store.publishTask({ ...initial, status: 'trash' }, { ...initial, status: 'paused' });
assert.deepEqual(store.taskCounters(), { total: 1, active: 1, paused: 0, trash: 1 });
assert.deepEqual(store.counters(), { total: 7 }, 'Schedule counters do not aggregate into the sidebar case counter');
console.log('PASS immediate signal-store bucket totals and separate schedule/header counters');

Object.assign(store, { session: signal({ userId: 'resident' }), error: signal(''), service: { tasks: async () => { throw Error('HTTP 500'); } } });
await assert.rejects(() => store.tasks({ page: 0, pageSize: 1, filters: { status: 'active' } }));
assert.equal(store.error(), 'case.tasks.load.failed', 'List failures must not claim a save failed');
store.service.tasks = async () => ({ items: [], total: 0, context: { total: 0, active: 0, paused: 0, trash: 0 } });
await store.tasks({ page: 0, pageSize: 1, filters: { status: 'active' } });
assert.equal(store.error(), '', 'Successful retry clears the list error');
const delayed = {};
store.service.tasks = () => new Promise(resolve => delayed.resolve = resolve);
const stale = store.tasks({ page: 0, pageSize: 1, filters: { status: 'active' } });
store.publishTask({ id: 'new', status: 'active' }, null);
delayed.resolve({ items: [], total: 0, context: { total: 0, active: 0, paused: 0, trash: 0 } });
await assert.rejects(() => stale, { name: 'AbortError' });
assert.equal(store.taskCounters().active, 1, 'Late responses cannot overwrite a mutation counter');
console.log('PASS list-specific error, successful recovery and stale counter response guard');

const DialogStore = await compiled.symbol('DialogStore'), dialogs = new DialogStore();
let mutations = 0;
Object.assign(store, { dialogs, generation: 0, busy: signal(false),
  profile: { activeUserId: () => store.session().userId }, workspace: { accountId: id => id, isCommunity: () => true },
  service: { taskAction: async (_user, id, command) => {
  mutations++; return { id, status: command === 'pause' ? 'paused' : 'trash' };
} } });
for (const [command, palette] of [['pause', 'amber'], ['trash', 'danger']]) {
  const task = { id: 'confirm', title: 'Confirm scheduled task', canManage: true, status: 'active', version: 0 };
  const before = mutations;
  const menuItem = { id: command, label: command, palette };
  store.taskAction(task, command, menuItem);
  assert.equal(dialogs.dialog().confirmPalette, palette);
  assert.equal(mutations, before, 'Opening confirmation must not mutate');
  dialogs.cancel(); assert.equal(mutations, before, 'Cancel must not mutate');
  store.taskAction(task, command, menuItem); await dialogs.confirm();
  assert.equal(mutations, before + 1); assert.equal(dialogs.dialog(), null);
}
console.log('PASS suspend/delete confirmations, matching amber/danger buttons and cancellation without mutation');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Exercise the existing watch output. No compiler, browser, or running data changes.
assert.ok(process.argv[2], 'Pass the current dev output directory');
const compiled = compiledDevModules(process.argv[2]);
const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const fields = read('../src/app/shared/core/local/seed/data/help-center-guide-fields.json');
const contexts = Object.keys(fields).filter(key => /^(admin|operator)\./.test(key));
const messages = Object.fromEntries(['en', 'hu'].map(lang => [lang, read(`../src/assets/i18n/${lang}.json`).messages]));
const catalogs = ['demo_db', 'e2e_db', 'myscoutee_db'].map(db => read(`../../server/docker/conf/mongodb/${db}/helpCenterRevisions.json`));
for (const rows of catalogs) {
  const identities = rows.map(row => JSON.stringify([row.baseGroupId ?? null,row.documentType,row.lang,row.contextKey ?? null,row.version]));
  assert.equal(new Set(identities).size,identities.length,'Unique Mongo revision identity before import');
}
const [Guide, LocalHelp, Mapper, Store, Converter, Repo, RoleEvents, Popup, signal, run, Injector, DestroyRef,
  Dialog, SideMenu, NotificationPopup] = await Promise.all(
  ['ExplanationGuideService','LocalHelpCenterService','LocalHelpCenterMapper','NotificationCenterStore','NotificationSingleRowConverter',
   'LocalNotificationsRepository','LocalRoleNotificationsService','PopupComponent','signal','runInInjectionContext','Injector','DestroyRef',
   'DialogStore','SideMenuComponent','NotificationCenterPopupComponent'].map(compiled.symbol));
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
function context(providers = {}) {
  const pending = new Set(), cleanup = [];
  const injector = { get(token, fallback) {
    const name = (token.name ?? '').replace(/^_/, '');
    if (token === Injector) return injector;
    if (token === DestroyRef) return { onDestroy: fn => { cleanup.push(fn); return () => {}; } };
    if (name === 'EffectScheduler') return { add: node => pending.add(node), schedule: node => pending.add(node), remove: node => pending.delete(node) };
    if (name === 'ChangeDetectionScheduler') return { notify() {} };
    if (name === 'ViewContext') return null;
    if (name in providers) return providers[name];
    if (fallback !== undefined) return fallback;
    throw new Error('Missing provider ' + name);
  } };
  return { make: Type => run(injector, () => new Type()), construct: fn => run(injector, fn), cleanup,
    async flush() { for (let i=0;i<5;i++) { await Promise.resolve(); let count=0; while(pending.size) {
      assert.ok(++count < 100, 'Effects settle without a loop'); const node=pending.values().next().value; pending.delete(node); node.run();
    } } } };
}
for (const rows of catalogs) for (const group of [null,'myscoutee-work','myscoutee-community']) for (const lang of ['en','hu']) {
  for (const key of contexts) {
    const active = rows.filter(row => row.active && row.contextKey === key && row.lang === lang && (row.baseGroupId ?? null) === group);
    assert.equal(active.length, 1, `${group}/${lang}/${key}`); assert.equal(active[0].isSystem, true);
    assert.deepEqual(active[0].sections.map(s => s.guideStepId), fields[key].map(f => f.id));
    for (const field of fields[key]) {
      assert.ok(messages[lang][field.i18nKey+'.label']);
      const description = messages[lang][field.i18nKey+'.description']; assert.ok(description);
      assert.ok(description.length <= 300, `${key}/${field.id} must stay brief`);
      assert.equal(active[0].sections.find(s => s.guideStepId===field.id).contentHtml, '<p>'+description+'</p>');
    }
  }
}
console.log(`PASS ${contexts.length} role contexts: EN/HU, three groups, all Mongo catalogs, protected flag and step/content parity`);
const i18n = { currentLanguage: signal('en') }, loads=[];
const ctx = context({ I18nService: i18n });
const guide = ctx.construct(() => new Guide({ loadState: async (key,lang) => {
  loads.push([key,lang]); return { activeRevision: catalogs[0].find(row => row.active && row.contextKey === key && row.lang === lang && !row.baseGroupId), guideFields: fields[key] };
} }));
const root = guide.registerContext('operator.home'); guide.openCurrent(); await ctx.flush();
for (const key of contexts) {
  const close = guide.registerContext(key); await ctx.flush();
  assert.equal(guide.currentContextKey(), key); assert.equal(guide.visibleRevision().contextKey, key);
  assert.equal(guide.visibleRevision().isSystem, true);
  const before = loads.length; guide.nextStep(); guide.setStepIndex(0); await ctx.flush(); assert.equal(loads.length,before);
  close(); await ctx.flush(); assert.equal(guide.currentContextKey(),'operator.home');
}
guide.dismissLauncher(); assert.equal(guide.launcherVisible(),false); guide.setEnabled(true); assert.equal(guide.launcherVisible(),true);
root(); ctx.cleanup.forEach(fn=>fn());
console.log('PASS compiled guide nesting, return to parent, explicit re-enable after dismiss, no per-step reload');

const rows = catalogs[0].filter(row => !row.baseGroupId);
const records = rows.map(row => ({ ...row, id: row._id, documentKind: row.documentType,
  createdAtIso: row.createdDate, createdByUserId:row.createdUser, updatedAtIso:row.updatedDate, updatedByUserId:row.updatedUser }));
let table = { seeded:true, seededKinds:{explanation:true,help:true}, activeRevisionId:null,
  activeRevisionIdsByKind:Object.fromEntries(records.filter(r=>r.active).map(r=>[r.contextKey?`${r.documentKind}:${r.lang}:${r.contextKey}`:`${r.documentKind}:${r.lang}`,r.id])),
  revisionsById:Object.fromEntries(records.map(r=>[r.id,r])), revisionIds:records.map(r=>r.id), auditById:{},auditIds:[],guideFieldsById:{},guideFieldIds:[] };
let writes=0;
const helpContext = context({ LocalHelpCenterRepository:{whenReady:async()=>{},readTable:()=>table,groupForUser:()=>null,
  updateTable:fn=>{writes++;table=fn(table);},flushToIndexedDb:async()=>{}},RouteDelayService:{waitForRouteDelay:async()=>{}} });
const help = helpContext.make(LocalHelp), system=records.find(r=>r.contextKey==='admin.home'&&r.lang==='en');
assert.equal(Mapper.toRecord(Mapper.toDto(system)).isSystem,true);
assert.equal((await help.loadState('explanation','en','admin.home')).activeRevision.isSystem,true);
for (const action of [()=>help.loadAdminState('admin','explanation','en','admin.home'),
  ()=>help.saveRevision({actorUserId:'admin',contextKey:'admin.home',lang:'hu'},'explanation'),
  ()=>help.saveRevision({actorUserId:'admin',contextKey:'landing.home',lang:'en',baseRevisionId:system.id},'explanation'),
  ()=>help.activateRevision(system.id,'admin','explanation'),()=>help.deleteRevision(system.id,'admin','explanation')]) {
  await assert.rejects(action,/System content is not editable/);
}
assert.equal(writes,0);
const adminState=await help.loadAdminState('admin','explanation','en','landing.home');
assert.ok(adminState.revisions.length);assert.ok(adminState.revisions.every(r=>!r.isSystem));
console.log('PASS local round-trip flag; active read; editor hides system content; create/copy/activate/delete rejected before writes');

const dialog=context().make(Dialog), preferenceWrites=[];
let savedMuted=false, preferenceFailure=false;
const storeCtx = context({NotificationsService:{setMuted:async(userId,muted)=>{
  preferenceWrites.push([userId,muted]);
  if(preferenceFailure) throw new Error('Preference save failed');
  savedMuted=muted;return {muted};
}}, ActivityStore:{setUserCounterOverride(){}},
  UserProfileStore:{patchUserActivityCounters(){},patchUserNotificationPreferences(){}}});
const store=storeCtx.make(Store);store.initialize('operator',4);assert.equal(store.attentionVisible(),true);
const toggleAlerts = store => {
  const popup = Object.assign(Object.create(NotificationPopup.prototype), {
    store, dialogStore:dialog, preferenceUnavailable:()=>false
  });
  popup.onHeaderMenuSelect({itemSelect:{id:'notification-attention-toggle',context:{action:'toggle-muted'},
    sourceEvent:{preventDefault(){},stopPropagation(){}}}});
};
const side = Object.assign(Object.create(SideMenu.prototype), {
  notificationCenterStore:store, connectionOffline:()=>false, accountLocationMissing:()=>false,
  closeSideMenu(){}
});
side.onNavigatorHeaderActionMenuSelect({id:'notifications'});
assert.equal(store.isOpen(),true);assert.equal(preferenceWrites.length,0);store.close();
toggleAlerts(store);
assert.equal(store.isOpen(),false);assert.equal(preferenceWrites.length,0);
assert.equal(dialog.dialog().title,'Mute notification alerts?');await dialog.confirm();
assert.deepEqual(preferenceWrites,[['operator',true]]);assert.equal(store.muted(),true);
assert.equal(store.attentionVisible(),false);assert.equal(store.unreadCount(),4);
const reloaded=storeCtx.make(Store);reloaded.initialize('operator',4,savedMuted);
assert.equal(reloaded.muted(),true);assert.equal(reloaded.attentionVisible(),false);
reloaded.open();assert.equal(reloaded.isOpen(),true);reloaded.close();
toggleAlerts(reloaded);
assert.equal(dialog.dialog().title,'Unmute notification alerts?');await dialog.confirm();
assert.deepEqual(preferenceWrites,[['operator',true],['operator',false]]);assert.equal(reloaded.muted(),false);
reloaded.syncUnreadCount(5,{announce:true});assert.equal(reloaded.attentionVisible(),true);
SideMenu.prototype.dismissNotificationLauncher.call({notificationCenterStore:reloaded,offlineAttentionDismissed:signal(false)});
assert.equal(reloaded.attentionVisible(),false);assert.equal(reloaded.muted(),false);assert.equal(preferenceWrites.length,2);
reloaded.syncUnreadCount(6,{announce:true});assert.equal(reloaded.attentionVisible(),true);
preferenceFailure=true;toggleAlerts(reloaded);await dialog.confirm();
assert.equal(reloaded.muted(),false);assert.equal(reloaded.attentionVisible(),true);
assert.equal(dialog.dialog().errorMessage,'Preference save failed');dialog.cancel();
const token=reloaded.captureUnreadSyncToken();reloaded.syncUnreadCount(1);assert.equal(reloaded.applyRealtimeUnreadCount(token,9),false);
console.log('PASS bell opens inbox directly; popup mute controls the floating alert; reload, dismissal, save failure and stale realtime remain consistent');

let memory={users:{byId:{op:{id:'op',operator:true,activities:{}},admin:{id:'admin',admin:true,activities:{}},member:{id:'member',activities:{}}},ids:['op','admin','member']},
  notifications:{byId:{},ids:[],idsByRecipientUserId:{},mutedByUserId:{},seededUserIds:[]}};
// Resolve configured table names from the actual compiled repository operations.
const memoryDb={whenReady:async()=>{},read:()=>memory,write:fn=>{memory=fn(memory);},flushToIndexedDb:async()=>{}};
const repo=context({LocalMemoryDb:memoryDb}).make(Repo);
const users={whenReady:async()=>{},queryAvailableDemoUsers:role=>Object.values(memory.users.byId).filter(u=>role==='operator'?u.operator:u.admin)};
const events=context({LocalUsersRepository:users,LocalNotificationsRepository:repo}).make(RoleEvents);
await events.publish('release-available','1.2.3',{releaseVersion:'1.2.3'});
await events.publish('release-available','1.2.3',{releaseVersion:'1.2.3'});
await events.publish('node-member-joined','new-member');await events.publish('report-submitted','report1');
assert.equal(repo.unreadCount('op'),2);assert.equal(repo.unreadCount('admin'),2);assert.equal(repo.unreadCount('member'),0);
const notices=repo.queryPage('op',{pageSize:20,filters:{bucket:'all'}}).records;
const release=notices.find(n=>n.kind==='release-available');assert.equal(Converter.roleTargetPath(release),'/operator?notificationTarget=updates');
assert.equal(Converter.roleTargetPath({...release,payload:{roleTarget:'https://evil.example'}}),null);
assert.equal(repo.markRead('member',release.id),null);repo.markRead('op',release.id);repo.markRead('op',release.id);assert.equal(repo.unreadCount('op'),1);
console.log('PASS local event -> inbox -> role target; repeated events/read are idempotent; recipient isolation');

// Shared popup registration changes only at actual context/lifecycle transitions.
const transitions=[];const surface={active:true,guideContext:'admin.reports',registeredGuideContext:undefined,
  explanationGuide:{registerContext:key=>{transitions.push('+'+key);return()=>transitions.push('-'+key);}},presenceToken:Symbol(),
  clearPresence(){this.presenceToken=null;}};
Popup.prototype.syncPresence.call(surface);Popup.prototype.syncPresence.call(surface);
surface.guideContext='admin.report-detail';Popup.prototype.syncPresence.call(surface);surface.active=false;Popup.prototype.syncPresence.call(surface);
assert.deepEqual(transitions,['+admin.reports','-admin.reports','+admin.report-detail','-admin.report-detail']);
console.log('PASS shared popup context registration is bounded and released on close');

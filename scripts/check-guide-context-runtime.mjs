import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const compiled=compiledDevModules(process.argv[2]);
const [Service,signal,effect,runInInjectionContext,Injector,DestroyRef]=await Promise.all(['ExplanationGuideService','signal','effect','runInInjectionContext','Injector','DestroyRef'].map(compiled.symbol));
const cleanups=[];
const pending=new Set();
function flush() {
 let count=0;
 while(pending.size) {
  assert.ok(++count<50,'Guide registration effects must settle without a feedback loop');
  const node=pending.values().next().value;pending.delete(node);node.run();
 }
}
const injector={get(token,fallback){
 const name=(token.name??'').replace(/^_/,'');
 if(token===Injector)return injector;
 if(token===DestroyRef)return {onDestroy:fn=>{cleanups.push(fn);return ()=>{};}};
 if(String(token)==='InjectionToken MyScoutee UI translations')return {currentLanguage:signal('en')};
 if(name==='EffectScheduler')return {add:node=>pending.add(node),schedule:node=>pending.add(node),remove:node=>pending.delete(node)};
 if(name==='ChangeDetectionScheduler')return {notify(){}};
 if(name==='ViewContext')return null;
 if(fallback!==undefined)return fallback;
 throw Error('Missing '+name);
}};
globalThis.localStorage={getItem:()=>null,setItem(){}};
const guide=runInInjectionContext(injector,()=>new Service({isExplainableContext:key=>Boolean(key),contextPriority:key=>key===null||['navigation.menu','child'].includes(key)?1:0,loadState:async()=>({activeRevision:null,guideFields:[]})}));
const dating=guide.registerContext('dating.home');
const menu=guide.registerContext('navigation.menu');
const work=guide.registerContext('work.home');
assert.equal(guide.currentContextKey(),'navigation.menu','late background route cannot replace visible sidebar');
dating();assert.equal(guide.currentContextKey(),'navigation.menu');
const modal=guide.registerContext(null);assert.equal(guide.currentContextKey(),null);
const child=guide.registerContext('child');assert.equal(guide.currentContextKey(),'child');
child();assert.equal(guide.currentContextKey(),null);
modal();assert.equal(guide.currentContextKey(),'navigation.menu');
menu();assert.equal(guide.currentContextKey(),'work.home');
work();assert.equal(guide.currentContextKey(),null);
const first=guide.registerContext('first'); const second=guide.registerContext('second');
assert.equal(guide.currentContextKey(),'second','equal priority preserves latest registration');
first();assert.equal(guide.currentContextKey(),'second');second();
flush();
const opened=signal(false);
let registrations=0;
const registrationEffect=runInInjectionContext(injector,()=>effect(onCleanup=>{
 if(opened()) {registrations++;onCleanup(guide.registerContext('child'));}
}));
flush();opened.set(true);flush();
assert.equal(registrations,1,'Opening registers exactly once');
assert.equal(guide.currentContextKey(),'child');
const nested=guide.registerContext(null);flush();
assert.equal(registrations,1,'Nested context changes must not rerun the owner effect');
assert.equal(guide.currentContextKey(),null);
nested();flush();assert.equal(guide.currentContextKey(),'child');
guide.openCurrent();flush();guide.closePopup();flush();
assert.equal(registrations,1,'Opening and closing help must not recreate its context');
opened.set(false);flush();assert.equal(guide.currentContextKey(),null);
opened.set(true);flush();assert.equal(registrations,2);
registrationEffect.destroy();flush();assert.equal(guide.currentContextKey(),null);
for(const cleanup of cleanups.reverse())cleanup();
console.log('PASS sidebar/background route, null modal, nested popup, disposal, equal-priority ordering, reactive registration/cleanup/reopen without feedback loops');

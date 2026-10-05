import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const compiled=compiledDevModules(process.argv[2]);
const Page=await compiled.symbol('EntryPageComponent');
const Landing=Page.ɵcmp.dependencies.find(c=>c.name?.replace(/^_/,'')==='EntryLandingComponent');
assert.ok(Landing);
const signal=await compiled.symbol('signal'),run=await compiled.symbol('runInInjectionContext');
const pending=new Set(),destroy=[],document={documentElement:{dataset:{}}},mode=signal('dating');
const injector={get(token,fallback){const name=(token.name??'').replace(/^_/,'');
  if(name==='Injector')return injector;
  if(name==='DestroyRef')return {onDestroy(fn){destroy.push(fn);return()=>{}}};
  if(name==='ViewContext')return null;
  if(name==='ChangeDetectionScheduler')return {notify(){}};
  if(name==='EffectScheduler')return {add:n=>pending.add(n),schedule:n=>pending.add(n),remove:n=>pending.delete(n)};
  if(String(token).includes('DocumentToken'))return document;
  if(name==='LandingContentService')return {mode};
  if(name==='DeploymentConfigurationService')return {branding:signal({productName:'Custom name',logoUrl:'/logo.webp'}),socialLinks:signal([])};
  if(name==='I18nService')return {revision:signal(0),translate:k=>k};
  if(['ChangeDetectorRef','IdeaPostsService','PwaService'].includes(name))return {};
  if(fallback!==undefined)return fallback;throw Error('Missing provider '+name+' '+String(token));
}};
const flush=()=>{let count=0;while(pending.size){assert.ok(++count<20);const node=pending.values().next().value;pending.delete(node);node.run();}};
run(injector,()=>new Landing());
for(const value of ['dating','work','community','dating']){mode.set(value);flush();assert.equal(document.documentElement.dataset.landingMode,value);}
destroy.forEach(fn=>fn());assert.equal(document.documentElement.dataset.landingMode,undefined);
const Branding=await compiled.symbol('DeploymentConfigurationService');
const normalized=Object.create(Branding.prototype).normalize({productName:'Custom name',homeLabel:'Custom label',logoUrl:'/logo.webp',logoCharacterIndex:1,revision:2,themePreset:'FOREST'});
assert.deepEqual(normalized,{productName:'Custom name',homeLabel:'Custom label',logoUrl:'/logo.webp',logoCharacterIndex:1,revision:2});
const css=readFileSync(resolve(process.argv[2],'styles.css'),'utf8'),primary=new Set();
const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
for(const value of ['dating','work','community']){
  const block=css.match(new RegExp(`:root\\[data-landing-mode=${value}\\] \\{([^}]+)\\}`))?.[1];assert.ok(block);
  for(const token of ['primary','secondary','accent']){const color=block.match(new RegExp(`--deployment-brand-${token}: ([^;]+);`))?.[1];assert.ok(color);
    const rgb=color.startsWith('rgb(')?color.slice(4,-1).split(',').map(Number)
      : /^#[0-9a-f]{6}$/i.test(color)?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):null;
    assert.ok(rgb,`${value}/${token}: supported compiled color ${color}`);
    assert.ok(1.05/(luminance(rgb)+.05)>=4.5,`${value}/${token}: white hero text contrast`);
    if(token==='primary')primary.add(rgb.join(','));
  }
  assert.ok(block.includes('--deployment-footer-background'));assert.ok(block.includes('--deployment-panel-background'));
}
assert.equal(primary.size,3);
console.log('PASS mode switching/cleanup, build-defined distinct semantic palettes, hero contrast and editable branding independent of retired database themes');

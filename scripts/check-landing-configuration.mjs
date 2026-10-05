import assert from 'node:assert/strict';
import {compiledDevModules} from './compiled-dev-modules.mjs';
const {symbol}=compiledDevModules(process.argv[2]);
const Service=await symbol('DeploymentConfigurationService'),signal=await symbol('signal');
const service=Object.create(Service.prototype);let attempts=0;
const branding={productName:'MyScoutee'};const links=[{platform:'instagram',url:'https://www.instagram.com/myscoutee/'}];
Object.assign(service,{loadPromise:null,brandingRef:signal(branding),loadingRef:signal(false),socialLinksRef:signal([]),
 configurationService:()=>({loadBranding:async()=>{attempts++;if(attempts===1)throw Error('offline');return {...branding,socialLinks:links};}}),
 applyConfiguration(value){this.socialLinksRef.set(value.socialLinks);return branding;}});
assert.deepEqual(await service.initialize(),branding);assert.equal(service.loadPromise,null);
await Promise.all([service.initialize(),service.initialize()]);assert.equal(attempts,2);assert.deepEqual(service.socialLinksRef(),links);
await service.initialize();assert.equal(attempts,2,'Successful configuration remains cached');
console.log('PASS deployment configuration: failed first load is retryable, concurrent loads deduplicate, social links survive, successful load stays cached');
const Converter=await symbol('CampaignConverter');
const card=Converter.imageCard({id:'c',ownerUserId:'o',title:'One title',description:'Short advertisement',category:'creative',imageUrls:[]},k=>k);
assert.equal(card.contextBadge.label,'campaign.category.creative');assert.equal(card.contextBadge.accentHue,265);assert.equal(card.ratingDomain,'campaign');assert.equal(card.profileView.userId,'o');
console.log('PASS campaign Home: category badge + eye target + campaign rating domain');

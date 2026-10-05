import { compiledDevModules } from './compiled-dev-modules.mjs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Render the existing watcher's AOT output in an isolated DOM; no build or browser session.
const {symbol} = compiledDevModules(process.argv[2]);
const dom = new JSDOM('<!doctype html><html><body><app-form-flow></app-form-flow></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for (const key of ['window','document','Node','NodeFilter','Element','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','MutationObserver','getComputedStyle']) globalThis[key] = dom.window[key];
dom.window.matchMedia = () => ({ matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){} });
globalThis.ResizeObserver = class { observe(){} disconnect(){} unobserve(){} };
globalThis.IntersectionObserver = class { observe(){} disconnect(){} unobserve(){} };
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
dom.window.HTMLElement.prototype.scrollTo = function() {};
const bootstrap = await symbol('bootstrapApplication'), FormFlow = await symbol('FormFlowComponent'), I18n = await symbol('I18nService');
const app = await bootstrap(FormFlow,{providers:[{provide:I18n,useValue:{revision:()=>0,translate:k=>k,currentLanguage:()=> 'hu'}}]});
const ref = app.components[0], flow = ref.instance;
let value = { title:'', description:'' };
flow.registerOnChange(next => { value = next; });
ref.setInput('model',{ title:'',layout:'grouped',header:false,summary:{enabled:false},save:null,deferPreparation:false,
  steps:[{id:'details',title:'',controls:[{id:'title',bind:'title',kind:'text',label:'Name',required:true,maxLength:120}, {id:'description',bind:'description',kind:'textarea',label:'Description',maxLength:4000}]}] });
flow.writeValue(value); app.tick(); await new Promise(r=>setTimeout(r,0)); app.tick();
for (const [selector,field] of [['input[type="text"]','title'],['textarea','description']]) {
  const el = document.querySelector(selector); assert.ok(el,selector); assert.equal(el.disabled,false); assert.equal(el.readOnly,false); assert.equal(el.closest('[inert]'),null);
  el.focus(); assert.equal(document.activeElement,el);
  el.value = 'Árvíztűrő text'; el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  app.tick(); await new Promise(r=>setTimeout(r,0)); app.tick();
  assert.equal(value[field],'Árvíztűrő text',field+' emits native typing'); assert.equal(el.value,value[field]);
}
console.log('PASS compiled FormFlow native text/textarea input, focus, disabled/read-only state and value persistence');
const createComponent = await symbol('createComponent'), createEnvironmentInjector = await symbol('createEnvironmentInjector'), signal = await symbol('signal');
const ServiceStore = await symbol('ServiceOfferingsStore'), Guide = await symbol('ExplanationGuideService');
const Popup = await symbol('ServiceOfferingsPopupComponent'), Editor = Popup.ɵcmp.dependencies.find(c => c.name.replace(/^_/,'') === 'ServiceOfferingEditorComponent');
const store = {staffMembers:signal([]),busy:signal(false),error:signal(''),profileId:signal('provider'),accountId:signal('account'),closeEditor(){},save(){},chooseStaff(){}};
const env = createEnvironmentInjector([{provide:ServiceStore,useValue:store},{provide:Guide,useValue:{registerContext:()=>()=>{}}}],app.injector);
const host = document.createElement('div'); document.body.append(host);
const editor = createComponent(Editor,{environmentInjector:env,hostElement:host});
editor.setInput('editor',{value:null,readOnly:false});app.attachView(editor.hostView);app.tick();
await new Promise(r=>setTimeout(r,40));app.tick();await new Promise(r=>setTimeout(r,40));app.tick();
for (const [selector,field] of [['input[type="text"]','title'],['textarea','description']]) {
 const el=host.querySelector('app-form-flow '+selector);assert.ok(el,selector);console.log(field,{disabled:el.disabled,readOnly:el.readOnly,inert:!!el.closest('[inert]')});
 const pointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
 el.dispatchEvent(pointer);
 assert.equal(pointer.defaultPrevented, false, field + ': popup must preserve native pointer focus');
 for(const char of 'Árvíz'){el.value+=char;el.dispatchEvent(new Event('input',{bubbles:true}));app.tick();await new Promise(r=>setTimeout(r,0));app.tick();}
 assert.equal(editor.instance.form()[field],'Árvíz');assert.equal(el.value,'Árvíz');
}
console.log('PASS Service editor native typing through parent signal, computed model and nested FormFlow');
const link=host.querySelector('app-link-input input');assert.ok(link,'Service uses the common LinkInput');
link.value='https://example.org/service';link.dispatchEvent(new Event('input',{bubbles:true}));app.tick();await new Promise(r=>setTimeout(r,0));app.tick();
assert.equal(editor.instance.form().sourceLink,'https://example.org/service');
console.log('PASS shared service LinkInput feeds the service form');

const staffRows=Array.from({length:5},(_,i)=>({userId:'staff-'+i,name:'Staff member '+i,city:'Budapest',initials:'S'+i,avatarUrl:i===0?'/staff-avatar.webp':'',status:'accepted'}));
store.staffMembers.set(staffRows);editor.instance.form.update(form=>({...form,staffAccountIds:staffRows.map(m=>m.userId)}));app.tick();
const staffSection=host.querySelector('[data-step-id="staff"]');
assert.ok(staffSection);assert.equal(staffSection.querySelectorAll('table').length,0,'Names use compact inline pills');
const staffPills=[...staffSection.querySelectorAll('[data-control-id="staff-list"] button')];
assert.equal(staffPills.length,5,'All selected people remain visible in the block');
for(const member of staffRows)assert.ok(staffSection.textContent.includes(member.name));
assert.equal(staffSection.textContent.includes('Budapest'),false,'Staff block does not add unrelated profile location');
const addStaff=[...staffSection.querySelectorAll('button')].filter(b=>b.textContent.includes('add'));
assert.equal(addStaff.length,1,'The section has one shared + action');
let viewedStaff;store.openMemberProfile=id=>viewedStaff=id;
assert.ok(!staffPills[0].textContent.includes('person'));assert.ok(staffPills[0].querySelector('.app-menu__item-image, .app-menu__avatar, [class*=image]'),'Staff pills have avatars');
assert.equal(staffPills[0].querySelector('img').getAttribute('src'),'/staff-avatar.webp');
assert.ok(staffPills[1].querySelector('.app-menu__item-image--circle').textContent.includes('S1'),'Missing photo uses initials in the same circular avatar');
assert.ok(staffPills[0].textContent.includes('chevron_right'));staffPills[0].click();app.tick();
assert.equal(viewedStaff,'staff-0');assert.deepEqual(editor.instance.form().staffAccountIds,staffRows.map(m=>m.userId),'Profile opening does not toggle selection');
let selectedStaff;store.chooseStaff=(ids,apply)=>{selectedStaff=[...ids];apply([]);};
addStaff[0].click();app.tick();await new Promise(r=>setTimeout(r,0));app.tick();
assert.deepEqual(selectedStaff,staffRows.map(m=>m.userId));assert.deepEqual(editor.instance.form().staffAccountIds,[]);
assert.ok(staffSection.textContent.includes('service.staff.empty'),'Clearing staff shows the empty state');
console.log('PASS service staff block lists every selected person, shared + opens the preselected picker and clearing updates the list');

const PopupComponent = await symbol('PopupComponent');
for (const backdrop of [undefined, true, false]) {
 const popupHost = document.createElement('div'), field = document.createElement('input');
 document.body.append(popupHost);
 const popup = createComponent(PopupComponent, {environmentInjector:env,hostElement:popupHost,projectableNodes:[[field]]});
 popup.setInput('model', {title:'Focus regression',backdrop,errorMessage:'case.save.failed'}); app.attachView(popup.hostView); app.tick();
 const alert=field.closest('.ui-popup__panel').querySelector('.ui-popup__error');assert.ok(alert);assert.equal(alert.getAttribute('role'),'alert');assert.ok(alert.nextElementSibling.classList.contains('ui-popup__body'));
 let bubbled = false;
 popupHost.addEventListener('pointerdown', () => { bubbled = true; }, {once:true});
 const pointer = new MouseEvent('pointerdown', {bubbles:true,cancelable:true}); field.dispatchEvent(pointer);
 assert.equal(pointer.defaultPrevented,false,'Native pointer focus remains available with backdrop='+backdrop);
 assert.equal(bubbled,backdrop!==false,'Nonmodal popup retains its outside-click boundary');
 popup.destroy();popupHost.remove();
}
console.log('PASS modal/nonmodal popup pointer default and propagation');
const InfoCard=await symbol('InfoCardComponent'),CaseConverter=await symbol('CommunityCaseConverter');
const cardHost=document.createElement('div');document.body.append(cardHost);
const cardRef=createComponent(InfoCard,{environmentInjector:env,hostElement:cardHost});
const caseCard=CaseConverter.card({id:'case',title:'Joint meter replacement',communityName:'Park Court',description:'Collect proposals.',caseType:'meter-replacement',status:'open',boardTasks:[],updatedAtIso:'2026-10-06'});
cardRef.setInput('card',caseCard);app.attachView(cardRef.hostView);app.tick();
assert.equal(cardHost.textContent.split('Joint meter replacement').length-1,1,'Case name appears once');
assert.equal(cardHost.textContent.split('case.type.meter-replacement').length-1,1,'Category appears once');
assert.ok(cardHost.querySelector('.ui-info-card__overlay-action--start.ui-info-card__overlay-action--tone-stage'),'Category reuses saturated stage badge');
assert.ok(cardHost.querySelector('.ui-info-card__overlay-action--end.ui-info-card__overlay-action--tone-stage-scheduled'),'Status keeps its existing palette');
console.log('PASS case-card single name/category labels and stronger category badge with unchanged status');
const GroupConverter=await symbol('CommunityGroupConverter');
const groupCardSource={id:'group',ownerUserId:'admin',ownerName:'Admin',name:'Group',category:'work',imageUrl:null,visibility:'public',membershipStatus:'accepted',role:'Admin',acceptedMembers:3,pendingMembers:1,activity:1};
const groupCards=['friends','work','neighbourhood'].map(category=>GroupConverter.card({...groupCardSource,category},k=>k));
assert.equal(new Set(groupCards.map(c=>c.accentHue)).size,3,'Category determines each group card base color');
for(const card of groupCards){
 cardRef.setInput('card',card);app.tick();
 assert.ok(cardHost.querySelector('.ui-info-card--tone-subevent-light'));
 assert.equal(cardHost.querySelector('.ui-info-card').style.getPropertyValue('--ui-info-card-accent-hue'),String(card.accentHue));
 const badge=cardHost.querySelector('.ui-info-card__overlay-action--bottom-start');
 assert.ok(badge);assert.ok(badge.textContent.includes('groups.bucket.hosting'));assert.equal(badge.tagName,'SPAN');
 assert.ok(badge.classList.contains('ui-info-card__overlay-action--tone-stage-finalized'));
 assert.equal(card.mediaEnd.label,'3');assert.equal(card.clickable,false);
}
const invitedGroup=GroupConverter.card({...groupCardSource,membershipStatus:'pending',requestKind:'invite'},k=>k);
assert.equal(invitedGroup.accentHue,groupCards[1].accentHue);assert.equal(invitedGroup.mediaBottomStart.tone,'purple');
const reviewedGroup=GroupConverter.card({...groupCardSource,moderationStatus:'under-review'},k=>k);
assert.equal(reviewedGroup.mediaBottomStart.label,'moderation.status.under-review');
const deletedGroup=GroupConverter.card({...groupCardSource,membershipStatus:'deleted',lifecycleStatus:'deleted',canRestoreGroup:true},k=>k);
assert.equal(deletedGroup.mediaBottomStart.label,'deleted');assert.equal(deletedGroup.mediaBottomStart.tone,'danger');
assert.equal(deletedGroup.mediaEnd.disabled,true);assert.deepEqual(GroupConverter.menu(deletedGroup.eagerDetail).map(m=>m.id),['restore']);
console.log('PASS group category card colors, passive lower-left contextual status, moderation/deletion and retained member/menu access');
cardRef.destroy();cardHost.remove();
const HomeHeader=await symbol('HomeHeaderComponent');
const headerHost=document.createElement('div');document.body.append(headerHost);
const header=createComponent(HomeHeader,{environmentInjector:env,hostElement:headerHost});
header.setInput('branding',{productName:'MyScoutee',logoUrl:''});app.attachView(header.hostView);app.tick();
assert.equal(headerHost.querySelectorAll('button').length,0,'Startup must not guess the active workspace menu');
assert.equal(headerHost.querySelector('.game-actions'),null);
header.setInput('items',[{id:'category',label:'All services',kind:'select-trigger',layout:'pill'}, {id:'rates',label:'Ratings',kind:'action',layout:'pill'}]);
header.setInput('showControls',false);app.tick();
assert.equal(headerHost.querySelectorAll('button').length,0,'Unsettled profile must not show provisional controls');
header.setInput('showControls',true);app.tick();
assert.equal(headerHost.querySelectorAll('button').length,2,'Only the resolved workspace controls appear');
assert.ok(!headerHost.textContent.includes('Preferences'));
console.log('PASS Home startup header stays action-free until the resolved workspace menu is ready');
header.destroy();headerHost.remove();
const Announcements=await symbol('CommunityAnnouncementsComponent');
const AnnouncementEditor=Announcements.ɵcmp.dependencies.find(c=>c.name.replace(/^_/,'')==='CommunityAnnouncementEditorComponent');
const AnnouncementStore=await symbol('CommunityAnnouncementsStore'),Media=await symbol('MediaService');
const uploads=[],downloads=[],saved=[];
const announcementStore={busy:signal(false),error:signal(''),userId:()=> 'admin',groupId:()=> 'homes',closeEditor(){},save:async value=>saved.push(JSON.parse(JSON.stringify(value)))};
const announcementEnv=createEnvironmentInjector([
 {provide:AnnouncementStore,useValue:announcementStore},{provide:Guide,useValue:{registerContext:()=>()=>{}}},
 {provide:Media,useValue:{uploadDocument:async(owner,id,file)=>{uploads.push({owner,id,name:file.name});return {uploaded:true,url:'data:text/plain;base64,U2F2ZWQgZG9jdW1lbnQ='};},downloadDocument:async(url,name)=>downloads.push({url,name})}}
],app.injector);
const announcementHost=document.createElement('div');document.body.append(announcementHost);
const noticeRef=createComponent(AnnouncementEditor,{environmentInjector:announcementEnv,hostElement:announcementHost});
const notice={id:'notice',title:'Meter replacement',body:'First paragraph.\n\nSecond paragraph.',voting:false,attachments:[{name:'Details.txt',mimeType:'text/plain',sizeBytes:14,url:'data:text/plain;base64,U2F2ZWQgZG9jdW1lbnQ='}],canVote:false,myBallot:null,results:{yes:0,no:0,abstain:0}};
noticeRef.setInput('editor',{value:notice,readOnly:true});app.attachView(noticeRef.hostView);
const settle=async()=>{app.tick();await new Promise(r=>setTimeout(r,40));app.tick();await new Promise(r=>setTimeout(r,40));app.tick();};
await settle();
assert.equal(announcementHost.querySelector('.announcement-document h2')?.textContent,notice.title);
assert.equal(announcementHost.querySelector('.announcement-document p')?.textContent,notice.body);
assert.equal(announcementHost.querySelectorAll('input:not([type="file"]),textarea').length,0,'Read view contains prose, not disabled fields');
assert.equal(announcementHost.querySelector('[data-step-id="voting"]'),null,'Notices do not display a false voting field');
const attachments=()=>announcementHost.querySelector('[data-step-id="attachments"]');
assert.ok(attachments());assert.equal(attachments().querySelectorAll('button').length,1,'Reader gets the download action only');
assert.equal(attachments().querySelectorAll('table tbody tr').length,1,'Read view lists attachments in the common table');
attachments().querySelector('button').click();await settle();
assert.deepEqual(downloads,[{url:notice.attachments[0].url,name:'Details.txt'}]);
noticeRef.setInput('editor',{value:notice,readOnly:false});await settle();
assert.ok(announcementHost.querySelector('textarea:not(:disabled)'));
assert.ok(announcementHost.querySelector('[data-step-id="voting"] app-on-off-toggle'),'Editor uses the existing real toggle');
const filenames=()=>attachments().querySelector('input[type="text"]');
assert.equal(filenames().value,'Details.txt');assert.equal(filenames().readOnly,true);assert.equal(filenames().disabled,false);
assert.equal(attachments().querySelector('table'),null,'The editor uses the filename textbox');
assert.equal(announcementHost.querySelector('input[type="file"]').multiple,true,'The picker accepts multiple files in one selection');
let pickerOpened=0;announcementHost.querySelector('input[type="file"]').click=()=>pickerOpened++;
const plus=[...attachments().querySelectorAll('button')].find(b=>b.textContent.includes('add'));assert.ok(plus);plus.click();await settle();assert.equal(pickerOpened,1);
await noticeRef.instance.upload({target:{files:[new dom.window.File(['Saved document'],'New.txt',{type:'text/plain'}),new dom.window.File(['Second document'],'Other.txt',{type:'text/plain'})],value:'chosen'}});await settle();
assert.equal(uploads.length,2);assert.equal(noticeRef.instance.form().attachments.length,3);
assert.equal(filenames().value,'Details.txt, New.txt, Other.txt','All uploaded names are separated by comma and space');
noticeRef.instance.popup().onAction();await settle();assert.equal(saved[0].attachments[1].name,'New.txt');
assert.equal(Object.hasOwn(saved[0],'attachmentNames'),false,'Display text is not a persisted attachment field');
noticeRef.setInput('editor',{value:{...notice,...saved[0]},readOnly:true});await settle();
assert.equal(attachments().querySelectorAll('button').length,3,'Every reopened attachment remains downloadable');
assert.deepEqual([...attachments().querySelectorAll('table th')].map(cell=>cell.textContent),['Details.txt','New.txt','Other.txt']);
attachments().querySelectorAll('button')[2].click();await settle();assert.equal(downloads.at(-1).name,'Other.txt','Download belongs to the selected table row');
noticeRef.setInput('editor',{value:{...notice,...saved[0]},readOnly:false});await settle();
const manageFiles=[...attachments().querySelectorAll('button')].find(b=>b.textContent.includes('more_vert'));assert.ok(manageFiles);manageFiles.click();await settle();
const removeFile=[...attachments().querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='remove');assert.ok(removeFile,'The existing removable menu item is available');removeFile.click();await settle();
assert.equal(filenames().value,'New.txt, Other.txt');assert.equal(noticeRef.instance.form().attachments.length,2);
noticeRef.instance.popup().onAction();await settle();noticeRef.setInput('editor',{value:{...notice,...saved[1]},readOnly:true});await settle();
assert.deepEqual([...attachments().querySelectorAll('table th')].map(cell=>cell.textContent),['New.txt','Other.txt'],'Removal is reflected after reopening the saved form');
console.log('PASS multi-file upload, comma-separated filename textbox, table downloads and menu removal/save/reopen');
const openVote={...notice,voting:true,deadlineIso:'2099-01-01T18:00:00Z',status:'published',closed:false,canVote:true,castVotes:0,eligibleMembers:2};
noticeRef.setInput('editor',{value:openVote,readOnly:true});await settle();
assert.ok(announcementHost.querySelector('.announcement-document'));
assert.equal(announcementHost.querySelector('[data-step-id="voting-summary"]'),null,'View contains no voting controls/results');
assert.equal(announcementHost.querySelector('[data-step-id="voting-results"]'),null);
noticeRef.setInput('editor',{value:openVote,readOnly:true,view:'voting'});await settle();
assert.equal(announcementHost.querySelector('.announcement-document'),null,'Voting does not duplicate the description view');
assert.ok(announcementHost.querySelector('[data-step-id="voting-summary"]'));
assert.equal(announcementHost.querySelector('[data-step-id="voting-results"]'),null,'Results are hidden before deadline');
const voteBlock=announcementHost.querySelector('[data-step-id="my-vote"]');assert.ok(voteBlock);
let cast;announcementStore.command=(...args)=>cast=args;
voteBlock.querySelector('button').click();await settle();assert.equal(cast[1],'vote');assert.equal(cast[2],'yes');assert.equal(cast[3],'green');
noticeRef.setInput('editor',{value:{...openVote,myBallot:'yes',castVotes:1,results:{yes:1,no:0,abstain:0}},readOnly:true,view:'voting'});await settle();
assert.equal(announcementHost.querySelectorAll('[data-step-id="my-vote"] button').length,0,'Already cast vote is read-only');
assert.equal(announcementHost.querySelector('[data-step-id="voting-results"]'),null);
noticeRef.setInput('editor',{value:{...openVote,deadlineIso:'2020-01-01T18:00:00Z',closed:true},readOnly:true,view:'voting'});await settle();
assert.ok(announcementHost.querySelector('[data-step-id="voting-results"] table'));
assert.equal(announcementHost.querySelectorAll('[data-step-id="my-vote"] button').length,0);
console.log('PASS separate description/voting views, structured ballot blocks, cast-vote lock and deadline-gated results');
noticeRef.destroy();announcementEnv.destroy();announcementHost.remove();
console.log('PASS announcement prose, no false voting row, real editor toggle, attachment picker/upload/save/reopen/download and read-only actions');
// Campaigns reuse the document block and profile viewer, in the same modal.
const CampaignPopup=await symbol('CampaignsPopupComponent'),CampaignStore=await symbol('CampaignsStore');
const CampaignEditor=CampaignPopup.ɵcmp.dependencies.find(c=>c.name.replace(/^_/,'')==='CampaignEditorComponent');
const Contacts=await symbol('ContactsService'),Profiles=await symbol('ProfileStore');
const campaignSaves=[],profileLoads=[];
const campaignState={busy:signal(false),error:signal(''),editor:signal({userId:'organizer'}),closeEditor(){},save:async v=>campaignSaves.push(structuredClone(v))};
const campaignEnv=createEnvironmentInjector([
 {provide:CampaignStore,useValue:campaignState},{provide:Guide,useValue:{registerContext:()=>()=>{}}},
 {provide:Profiles,useValue:{profileViewTarget:signal(null)}},
 {provide:Contacts,useValue:{loadContactProfile:async id=>{profileLoads.push(id);return {user:null,experiences:[]};}}},
 {provide:Media,useValue:{uploadDocument:async(owner,id,file)=>({uploaded:true,url:'data:'+file.type+';base64,SGk='}),downloadDocument:async(url,name)=>downloads.push({url,name})}}
],app.injector);
const campaignHost=document.createElement('div');document.body.append(campaignHost);
const campaignRef=createComponent(CampaignEditor,{environmentInjector:campaignEnv,hostElement:campaignHost});
const ad={id:'ad',title:'A short invitation',description:'The complete campaign description.',kind:'work',category:'creative',imageUrls:[],attachments:[],ownerUserId:'organizer',ownerName:'Organizer',version:0};
campaignRef.setInput('campaign',ad);campaignRef.setInput('readOnly',false);app.attachView(campaignRef.hostView);await settle();
assert.deepEqual(campaignRef.instance.flowModel().steps[0].controls.map(c=>c.id),['images','title','description','kind','category']);
assert.ok(campaignHost.querySelector('[data-guide-field="image-gallery-expand"]'),'Campaign images use the existing gallery launcher');
const imageControl=campaignRef.instance.flowModel().steps[0].controls[0];assert.equal(imageControl.config.gallery,true);assert.equal(imageControl.config.slotCount,4);
await campaignRef.instance.documents.upload({target:{files:[new dom.window.File(['Hi'],'Brief.txt',{type:'text/plain'}),new dom.window.File(['Hi'],'Terms.txt',{type:'text/plain'})],value:'chosen'}});await settle();
assert.equal(campaignHost.querySelector('[data-step-id="attachments"] input').value,'Brief.txt, Terms.txt');
campaignRef.instance.popupModel().onMenuSelect({itemSelect:{id:'save'}});await settle();assert.equal(campaignSaves.length,1);
assert.equal(Object.hasOwn(campaignSaves[0],'attachmentNames'),false);
campaignRef.setInput('campaign',{...ad,...campaignSaves[0]});campaignRef.setInput('readOnly',true);await settle();
assert.equal(campaignRef.instance.view(),'details');
assert.equal(campaignHost.querySelectorAll('[data-step-id="attachments"] table tbody tr').length,2);
campaignHost.querySelector('[data-step-id="attachments"] button').click();await settle();assert.equal(downloads.at(-1).name,'Brief.txt');
assert.deepEqual(campaignRef.instance.popupModel().headerControls[0].items.map(i=>i.id),['details','organizer']);
const chooseCampaignView=async id=>{
 const trigger=[...campaignHost.querySelectorAll('.popup-header button, .ui-popup__header button, app-menu button')].find(b=>b.textContent.includes('campaign.'+campaignRef.instance.view()));
 assert.ok(trigger,'Details/Organizer header menu');trigger.click();await settle();
 const option=[...campaignHost.querySelectorAll('button')].find(b=>b.getAttribute('role')==='menuitemradio'&&b.textContent.includes('campaign.'+id))
   ?? [...campaignHost.querySelectorAll('button')].filter(b=>b.textContent.includes('campaign.'+id)).at(-1);
 assert.ok(option);option.click();await settle();
};
assert.deepEqual(campaignRef.instance.popupModel().headerControls[0].items.map(i=>i.palette),['blue','violet']);
await chooseCampaignView('organizer');assert.equal(campaignRef.instance.view(),'organizer');
assert.equal(campaignRef.instance.popupModel().headerControls[0].trigger.palette,'violet');
assert.deepEqual(profileLoads,['organizer']);assert.equal(campaignHost.querySelectorAll('app-popup').length,1,'Organizer is embedded in the same popup');
assert.ok(campaignHost.querySelector('app-profile-view-popup'));assert.equal(campaignHost.querySelector('app-form-flow'),null);
await chooseCampaignView('details');assert.equal(campaignRef.instance.view(),'details');
assert.equal(campaignHost.querySelectorAll('[data-step-id="attachments"] table tbody tr').length,2);
campaignRef.setInput('campaign',{...ad});await settle();assert.equal(campaignRef.instance.view(),'details','Every new campaign starts at Details');
campaignRef.destroy();campaignEnv.destroy();campaignHost.remove();
console.log('PASS campaign gallery, compact fields, shared multi-upload/save/reopen/download and real Details/Organizer header switching in one popup');
const listState={historyTarget:signal(null),session:signal({userId:'organizer'}),changed:signal(null),selectedId:signal(null),selected:signal(null),error:signal(''),editor:signal(null),
 page:async()=>({items:[{...ad,status:'published',updatedAtIso:'2026-10-01T10:00:00Z'}],total:1,nextCursor:null}),close(){},action:async(...args)=>listActions.push(args)};
const listActions=[],listEnv=createEnvironmentInjector([{provide:CampaignStore,useValue:listState},{provide:Guide,useValue:{registerContext:()=>()=>{},popupOpen:()=>false}},{provide:Profiles,useValue:{}}],app.injector);
const listHost=document.createElement('div');document.body.append(listHost);
const listRef=createComponent(CampaignPopup,{environmentInjector:listEnv,hostElement:listHost});app.attachView(listRef.hostView);await settle();await settle();
assert.equal(listHost.querySelector('app-form-flow'),null,'Campaign list has no search field');
const campaignMenuButton=listHost.querySelector('app-image-card app-menu-trigger button');assert.ok(campaignMenuButton,'Real campaign card menu trigger');
campaignMenuButton.click();await settle();
assert.equal([...listHost.querySelectorAll('app-menu-outlet button')].some(b=>b.textContent.includes('campaign.author')),false,'Own campaign management omits the author profile');
const viewAction=[...listHost.querySelectorAll('app-menu-outlet button')].find(b=>b.textContent.includes('campaign.view'));
assert.ok(viewAction,'Card menu keeps its own shared items through the SmartList outlet');viewAction.click();await settle();
assert.equal(listActions[0][0],'view');assert.equal(listActions[0][1].id,ad.id);
const left=listHost.querySelector('.ui-image-card__status-chip'),right=listHost.querySelector('.ui-image-card__badge');
assert.equal(getComputedStyle(left).top,getComputedStyle(right).top);assert.equal(getComputedStyle(left).height,getComputedStyle(right).height);
listState.session.set({userId:'organizer',select:()=>{}});listState.toggleSelection=c=>listState.selectedId.set(c.id);listRef.instance.list.reload();await settle();await settle();
assert.equal(listHost.querySelector('app-image-card app-menu-trigger'),null,'Selector cards have no action menu');
assert.equal(listHost.querySelector('app-image-card .ui-image-card__badge'),null,'Selector contains only published cards');
const pickButton=listHost.querySelector('app-image-card .ui-image-card__actions--top-right button');assert.ok(pickButton);pickButton.click();await settle();
assert.equal(listState.selectedId(),ad.id);assert.ok(pickButton.textContent.includes('check'),'Selection remains in the upper right corner');
listRef.destroy();listEnv.destroy();listHost.remove();
console.log('PASS real campaign SmartList menu opens and dispatches View for the selected campaign; both badges have equal top/height');


const policyText='Work begins after agreement. Full policy remains visible.';
const inlineModel=locked=>({title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},deferPreparation:false,steps:[
 {id:'links',title:'',controls:[{id:'offers',kind:'menu',config:{kind:'inline',items:[
  {id:'quotation',kind:'action',layout:'pill',label:'360 EUR',icon:'request_quote',trailingIcon:'chevron_right'},
  {id:'plain',kind:'action',layout:'pill',label:'Ordinary action',icon:'check'}]}},
 {id:'selection',bind:'selected',kind:'menu',config:{kind:'inline',items:[{id:'choice',kind:'radio',layout:'pill',label:'Bound choice'}]}}]},
 {id:'policy',title:'',controls:[{id:'work',bind:'workPolicies',kind:'policies',disabled:locked,config:{model:{title:'Work policy',toggleable:false}}}]}
]});
ref.setInput('model',inlineModel(true));flow.writeValue({workPolicies:[{id:'policy',title:'Work',description:policyText,required:true}]});await settle();
const root=ref.location.nativeElement;
const priceButton=[...root.querySelectorAll('button')].find(b=>b.textContent.includes('360 EUR'));assert.ok(priceButton);
assert.equal(priceButton.querySelector('.app-menu__button-row-caret')?.textContent.trim(),'chevron_right');
const formBefore=JSON.stringify(value);let opened=0;const navigation=flow.action.subscribe(e=>{if(e.sourceEvent.id==='quotation')opened++;});
priceButton.click();await settle();
assert.equal(opened,1,'Unbound pill still emits its popup-opening action');
assert.equal(JSON.stringify(value),formBefore,'Opening a popup does not write an item ID into the form');
assert.ok(!priceButton.classList.contains('app-menu__button-row-item--active'),'Unbound popup action must not become selected');
const boundChoice=[...root.querySelectorAll('button')].find(b=>b.textContent.includes('Bound choice'));boundChoice.click();await settle();
assert.equal(value.selected,'choice','Bound menus still save their selected value');
assert.ok(boundChoice.classList.contains('app-menu__button-row-item--active'));
const disabledActions=inlineModel(true);disabledActions.steps[0].controls[0].disabled=true;ref.setInput('model',disabledActions);await settle();
const disabledPrice=[...root.querySelectorAll('button')].find(b=>b.textContent.includes('360 EUR'));
assert.equal(disabledPrice.disabled,true,'Action-only menu still respects the form disabled state');
disabledPrice.click();await settle();assert.equal(opened,1);
navigation.unsubscribe();
assert.equal([...root.querySelectorAll('button')].find(b=>b.textContent.includes('Ordinary action')).querySelector('.app-menu__button-row-caret'),null,'Unconfigured actions keep their existing layout');
assert.ok(root.querySelector('.event-policy-summary-card').textContent.includes(policyText));
assert.equal(root.querySelector('[data-guide-field="policies-read"]'),null,'Read-only full policy needs no duplicate viewer');
ref.setInput('model',inlineModel(false));await settle();
assert.ok(root.querySelector('[data-guide-field="policies-read"]'),'Editing still provides the existing policy editor');
console.log('PASS requested pill chevron, unchanged ordinary action and inline full policies without duplicate read-only launcher');
const quotationCards=[{id:'part-a',title:'Provider A',detail:'Replace the water meters and connect the new fittings.',price:'360 EUR',icon:'request_quote',tone:'gold',menuItems:[{id:'view',label:'View terms',icon:'article',context:'part-a'},{id:'remove',label:'Detach',icon:'link_off',context:'part-a'}]},
 {id:'part-b',title:'Provider B',detail:'Check the pipe pressure after installation.',price:'80 EUR',icon:'request_quote',tone:'gold',menuItems:[{id:'view',label:'View terms',icon:'article',context:'part-b'}]}];
const quotationModel=items=>({title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},deferPreparation:false,steps:[{id:'quotations',title:'Quotations',controls:[{id:'offer-list',kind:'text-cards',layout:'wide',config:{columns:3,items}}]}]});
ref.setInput('model',quotationModel(quotationCards));await settle();await settle();
let cards=root.querySelectorAll('app-text-card');assert.equal(cards.length,2,'Assigned parts use the existing Slots text cards');
assert.equal(cards[0].querySelector('.ui-text-card__badge')?.textContent.trim(),'360 EUR');
assert.ok(cards[0].querySelector('.ui-text-card--badge-end'));
assert.equal(cards[0].querySelector('.ui-text-card__badge').tagName,'SPAN','Price badge is passive');
assert.ok(cards[0].textContent.includes(quotationCards[0].detail));
assert.equal(cards[0].querySelector('article').getAttribute('role'),null,'Card itself is not a popup button');
let cardAction;const cardActions=flow.action.subscribe(e=>cardAction=e);
cards[0].querySelector('.ui-text-card__menu button').click();await settle();
const sharedOutlet=root.querySelector('app-menu-outlet.app-menu-outlet--open');assert.ok(sharedOutlet,'Card menu uses the existing shared overlay');
assert.equal(cards[0].querySelector('.app-menu__panel'),null,'Overlay is outside the card clipping context');
const panel=sharedOutlet.querySelector('.app-menu__panel'),heading=panel.querySelector('.app-menu__heading'),actions=panel.querySelector('.app-menu__items');
assert.ok(heading.textContent.includes('Provider A'));assert.equal(actions.contains(heading),false,'Provider heading is outside scrolling actions');
assert.equal(getComputedStyle(panel).overflow,'hidden');assert.equal(getComputedStyle(actions).overflowY,'auto');
assert.equal(getComputedStyle(cards[0].querySelector('article')).minHeight,'0');
assert.equal(getComputedStyle(cards[0].querySelector('.ui-text-card__badge')).position,'static','Price shares the first content row');
const Outlet=await symbol('AppMenuOutletComponent'),placement=Object.create(Outlet.prototype);
const popupBounds=document.createElement('section');popupBounds.className='ui-popup__panel';document.body.append(popupBounds);
popupBounds.getBoundingClientRect=()=>({left:100,right:900,top:200,bottom:600});
const clipped=document.createElement('div');clipped.style.overflow='auto';popupBounds.append(clipped);clipped.getBoundingClientRect=()=>({left:120,right:700,top:380,bottom:470});
const anchor=document.createElement('button');clipped.append(anchor);
const menu={id:'geometry',kind:'select',layout:'list',panelMode:'auto',panelAlign:'auto',openUp:false,triggerElement:anchor,triggerRect:{left:420,right:452,top:430,bottom:462,width:32,height:32},items:[{id:'view',label:'View'}],groups:[],model:null,mobileBreakpointPx:760};
placement.menu=menu;placement.hostRef={nativeElement:sharedOutlet};
assert.deepEqual(placement.layoutBounds(menu),{left:100,right:900,top:0,bottom:window.innerHeight});
assert.equal(placement.resolvedOpenUp(menu),false,'Room below is determined by screen, not card/list height');
assert.equal(placement.hostTop,466);assert.ok(parseInt(placement.hostPanelAvailableHeight)>200);
menu.triggerRect={...menu.triggerRect,left:860,right:892,top:730,bottom:762};
assert.equal(placement.resolvedOpenUp(menu),true,'Near the screen bottom the menu opens upward');
assert.equal(placement.resolvedPanelAlign(menu),'end');assert.ok(placement.hostLeft<=892,'Menu stays inside popup horizontally');
popupBounds.remove();
const detach=[...sharedOutlet.querySelectorAll('button')].find(b=>b.textContent.includes('Detach'));assert.ok(detach);detach.click();await settle();
assert.equal(cardAction.sourceEvent.id,'remove');assert.equal(cardAction.context,'part-a');
ref.setInput('model',quotationModel(quotationCards.slice(1)));await settle();await settle();
cards=root.querySelectorAll('app-text-card');assert.equal(cards.length,1);assert.ok(cards[0].textContent.includes('Provider B'));
cardActions.unsubscribe();
console.log('PASS slot-style quotation cards, passive right-hand price badges, menu action routing and in-place list removal');
// The existing feedback popup owns event and service cards, including the original status menu.
const FeedbackPopup=await symbol('EventFeedbackPopupComponent');
const ServiceFeedbackStore=await symbol('ServiceFeedbackStore');
const eventFeedbackItem={eventId:'event-feedback-one',title:'Community walk',subtitle:'Park Court',timeframe:'Today',imageUrl:'',startAtMs:Date.parse('2026-10-06T01:00:00Z'),pendingCards:1,totalCards:1,isRemoved:false,isFeedbacked:false,feedbackedAtMs:null};
const review={feedback:{id:'service-review-one',caseTitle:'Repair',providerAccountId:'provider',viewerAccountId:'reviewer',status:'pending',criteria:{},average:null,comment:'',createdAtIso:'2026-10-06T02:00:00Z',submittedAtIso:null},providerName:'Service provider',reviewerName:'Reviewer'};
const detailOpens=[],feedbackDialogs=[];
const mixedFeedback={changed:signal(null),pageAfterEvents:async query=>({items:query.filter===review.feedback.status?[structuredClone(review)]:[],total:query.filter===review.feedback.status?1:0,context:{pending:review.feedback.status==='pending'?1:0,feedbacked:0,removed:review.feedback.status==='removed'?1:0,received:0}}),
 openDetail:async(item,received)=>detailOpens.push({item,received}),action:async(item,command)=>{review.feedback.status=command.action==='remove'?'removed':'pending';mixedFeedback.changed.set({userId:'reviewer',id:item.feedback.id,action:command.action});}};
const eventPages=async query=>({items:query.filter==='pending'?[eventFeedbackItem]:[],allItems:[eventFeedbackItem],organizerItems:[],total:query.filter==='pending'?1:0,counts:{pending:1,feedbacked:0,removed:0,ownEvents:0}});
const providerValues={
 ServiceFeedbackStore:mixedFeedback,CampaignsStore:{feedbackCampaign:signal(null)},GroupWorkspaceContextService:{isWork:()=>false,isCommunity:()=>true},
 UserProfileStore:{activeUserId:signal('reviewer'),activeUserProfile:()=>({id:'reviewer'})},AppRuntimeStore:{isDataSourceAvailable:()=>true},
 ActivityStore:{counterOverridesByUserId:signal({}),activityEventFeedbackSubmitSync:signal(null),getUserCounterOverride:()=>null},
 MemberMenuStore:{navigatorEventFeedbackRequest:signal(null),clearNavigatorEventFeedbackRequest(){}},ActivitiesPopupStore:{},EventsService:{loadEventFeedbackPage:eventPages},
 ExplanationGuideService:{registerContext:()=>()=>{},popupOpen:signal(false)},DialogStore:{open:config=>feedbackDialogs.push(config)}
};
const feedbackProviders=[];for(const [name,useValue] of Object.entries(providerValues))feedbackProviders.push({provide:await symbol(name),useValue});
const feedbackEnv=createEnvironmentInjector(feedbackProviders,app.injector),feedbackHost=document.createElement('div');document.body.append(feedbackHost);
const feedbackRef=createComponent(FeedbackPopup,{environmentInjector:feedbackEnv,hostElement:feedbackHost});app.attachView(feedbackRef.hostView);await settle();
feedbackRef.instance.openPopup();await settle();await settle();
const feedbackModel=feedbackRef.instance.eventFeedbackPopupModel();
assert.equal(feedbackModel.title,'feedback.list.title');
assert.equal(feedbackModel.headerControls.length,1,'Only the original status menu remains');
assert.equal(feedbackModel.headerControls[0].id,'event-feedback-filter');
assert.equal(feedbackModel.headerControls[0].trigger.palette,'amber','Pending retains its original contextual palette');
assert.equal(feedbackModel.headerControls[0].trigger.counter.value,2,'The existing red count includes event and service rows');
assert.deepEqual(feedbackModel.headerControls[0].items.map(i=>i.palette),['violet','amber','green','slate']);
assert.equal(feedbackHost.querySelectorAll('app-info-card').length,2,'Both types share the existing card grid');
const serviceShell=feedbackHost.querySelector('.is-service-feedback');assert.ok(serviceShell);
assert.equal(serviceShell.querySelector('.ui-info-card').style.getPropertyValue('--ui-info-card-accent-hue'),'42');
assert.equal(feedbackHost.querySelectorAll('.event-feedback-info-card-shell:not(.is-service-feedback)').length,1);
const serviceSummary=feedbackRef.instance.eventFeedbackSmartList.itemsSnapshot().find(c=>c.eagerDetail?.kind==='service-feedback');
feedbackRef.instance.onEventFeedbackCardPrimaryAction(serviceSummary);await settle();assert.equal(detailOpens[0].item.feedback.id,review.feedback.id);
feedbackRef.instance.onEventFeedbackCardMenuAction(serviceSummary,{actionId:'removeFeedback'});assert.equal(feedbackDialogs.length,1);
await feedbackDialogs[0].onConfirm();await settle();await settle();
assert.equal(feedbackHost.querySelectorAll('app-info-card').length,1,'Removed service feedback leaves Pending without removing event feedback');
feedbackRef.instance.selectEventFeedbackListFilter('removed');await settle();await settle();
assert.equal(feedbackHost.querySelectorAll('app-info-card').length,1);assert.ok(feedbackHost.querySelector('.is-service-feedback.is-removed'));
const removedSummary=feedbackRef.instance.eventFeedbackSmartList.itemsSnapshot()[0];
feedbackRef.instance.onEventFeedbackCardMenuAction(removedSummary,{actionId:'restoreFeedback'});await feedbackDialogs[1].onConfirm();await settle();await settle();
assert.equal(feedbackHost.querySelectorAll('app-info-card').length,0,'Restore removes the row from Removed');
feedbackRef.destroy();feedbackEnv.destroy();feedbackHost.remove();
console.log('PASS one shared feedback list, original status control/colors/counters, distinct service-card tint, details and remove/restore updates');

const CasesStore=await symbol('CommunityCasesStore'),CasesPopup=await symbol('CommunityCasesPopupComponent');
const caseStore=Object.create(CasesStore.prototype),caseCount=signal(1);
const caseRow={id:'case-counter',status:'open',caseType:'maintenance',title:'Repair',description:'',communityId:'selected-group',audienceAll:false,audienceAccountIds:[],canManage:true};
const caseGroup={groupId:'selected-group',role:'Admin'},casePeople=[{userId:'one',name:'One',status:'accepted'},{userId:'two',name:'Two',status:'accepted'}];
Object.assign(caseStore,{session:signal({userId:'one',tasks:false}),activeGroup:signal(caseGroup),groups:signal([caseGroup]),managedGroups:signal([caseGroup]),
 board:signal(null),quotations:signal(null),chatContext:signal(null),editor:signal(null),changed:signal(null),taskChanged:signal(null),busy:signal(false),error:signal(''),
 taskCounters:signal({total:0,active:0,paused:0,trash:0}),known:new Map([[caseRow.id,caseRow]]),counters:signal({total:1,'open:maintenance':1}),count:caseCount,
 profile:{activeUserId:()=> 'one'},activity:{patchUserCounterOverrides:(_id,value)=>caseCount.set(value.cases)},
 audienceMembers:signal(casePeople),audienceLoading:signal(false),close(){},closeEditor(){}});
const casesEnv=createEnvironmentInjector([{provide:CasesStore,useValue:caseStore},{provide:Guide,useValue:{registerContext:()=>()=>{}}}],app.injector);
const runInInjectionContext=await symbol('runInInjectionContext');
const casePopup=runInInjectionContext(casesEnv,()=>new CasesPopup());
const menuHost=document.createElement('div');document.body.append(menuHost);
const Menu=await symbol('AppMenuComponent'),menuRef=createComponent(Menu,{environmentInjector:casesEnv,hostElement:menuHost});
const mainModel=casePopup.model();assert.equal(mainModel.toolbarControls.find(c=>c.id==='create').align,'end');
const scheduleTrigger=mainModel.headerControls[0].items[0];assert.equal(scheduleTrigger.label,'case.tasks');assert.equal(scheduleTrigger.trailingIcon,'chevron_right');
caseStore.taskCounters.set({total:2,active:1,paused:1,trash:3});assert.equal(scheduleTrigger.counter.value(),2);
assert.deepEqual(casePopup.tasksModel().toolbarControls[0].items.map(i=>i.id),['active','paused','trash']);
const taskSample={id:'task',title:'Check',communityName:'Group',communityId:'selected-group',nextDueAtIso:'2026-11-01T09:00:00Z',frequency:'yearly',affectedCount:2,canManage:true,status:'active'};
const taskRow=casePopup.taskRow(taskSample);assert.equal(taskRow.clickable,false);assert.equal(taskRow.badges.at(-1).position,'top-right');
assert.deepEqual(casePopup.taskMenu(taskSample).map(i=>i.id),['view','edit','pause','trash']);
assert.deepEqual(casePopup.taskMenu({...taskSample,canManage:false}).map(i=>i.id),['view']);
const status=mainModel.toolbarControls[0];
menuRef.setInput('kind','select');menuRef.setInput('trigger',status.trigger);menuRef.setInput('items',status.items);app.attachView(menuRef.hostView);await settle();
menuHost.querySelector('button').click();await settle();
const menuText=id=>{const item=menuRef.instance.items.find(i=>i.id===id);return menuRef.instance.itemCounterLabel(item)};
assert.equal(menuText('active'),'1');assert.equal(menuText('completed'),'0');
caseStore.publish({...caseRow,status:'completed'});await settle();
assert.equal(menuText('active'),'0');assert.equal(menuText('completed'),'1');
assert.equal(menuRef.instance.hasTriggerCounter(),false,'An empty selected bucket must not inherit the other buckets total');
const completedButton=[...menuHost.querySelectorAll('.app-menu__panel button')].find(b=>b.textContent.includes('case.status.completed'));
assert.ok(completedButton);assert.ok(completedButton.textContent.includes('1'),'The already-open dropdown paints the new count without a click');
caseStore.publish({...caseRow,status:'cancelled'});await settle();
assert.equal(menuText('completed'),'0');assert.equal(menuText('cancelled'),'1');
menuRef.destroy();menuHost.remove();
console.log('PASS open case dropdown follows store status changes immediately and zero hides the selected bucket badge');

const CaseEditor=CasesPopup.ɵcmp.dependencies.find(c=>c.name.replace(/^_/,'')==='CommunityCaseEditorComponent');
const caseHost=document.createElement('div');document.body.append(caseHost);
const caseEditor=createComponent(CaseEditor,{environmentInjector:casesEnv,hostElement:caseHost});
caseEditor.setInput('editor',{kind:'case',value:null,readOnly:false});app.attachView(caseEditor.hostView);await settle();
assert.equal(caseEditor.instance.form().communityId,'selected-group');
assert.equal(caseEditor.instance.form().audienceAll,false);assert.deepEqual(caseEditor.instance.form().audienceAccountIds,[]);
assert.equal(caseHost.querySelector('[data-control-id="community"]'),null,'Group is supplied by the active workspace');
const memberBlock=()=>caseHost.querySelector('[data-step-id="audience"]');
assert.ok(memberBlock().textContent.includes('case.audience.empty'));assert.equal(memberBlock().querySelectorAll('button').length,1,'Only + remains in the form block; All belongs in the picker header');
const addMembers=()=>[...memberBlock().querySelectorAll('button')].find(b=>b.textContent.includes('add'));
let audienceSelected,savedCase,viewedAudience;caseStore.openMemberProfile=id=>viewedAudience=id;
caseStore.chooseMembers=async(groupId,ids,apply)=>{assert.equal(groupId,'selected-group');audienceSelected=[...ids];apply(['two']);};
caseStore.save=value=>savedCase=value;
addMembers().click();await settle();assert.deepEqual(audienceSelected,[]);
assert.deepEqual(caseEditor.instance.form().audienceAccountIds,['two']);assert.ok(memberBlock().textContent.includes('Two'));assert.ok(!memberBlock().textContent.includes('One'));
const detailIds=caseEditor.instance.flowModel().steps.find(s=>s.id==='case').controls.map(c=>c.id);
assert.deepEqual(detailIds,['title','type','description']);
caseEditor.instance.form.update(value=>({...value,title:'New repair'}));await settle();caseEditor.instance.popupModel().onAction();
assert.deepEqual(savedCase.audienceAccountIds,['two']);assert.equal(savedCase.communityId,'selected-group');
caseEditor.setInput('editor',{kind:'case',value:{...caseRow,...savedCase},readOnly:false});await settle();assert.ok(memberBlock().textContent.includes('Two'),'Reopened selection is displayed');
caseStore.chooseMembers=async(_group,_ids,apply)=>apply([]);addMembers().click();await settle();
assert.deepEqual(caseEditor.instance.form().audienceAccountIds,[]);assert.equal(caseEditor.instance.popupModel().headerControls[0].disabled,false,'The creator can save without preselected affected people');
caseEditor.setInput('editor',{kind:'case',value:{...caseRow,audienceAccountIds:['two']},readOnly:true});await settle();
assert.equal(addMembers(),undefined);assert.ok(memberBlock().textContent.includes('Two'));
assert.equal(memberBlock().querySelector('table'),null);
const memberPill=memberBlock().querySelector('button');assert.ok(memberPill.textContent.includes('chevron_right'));
assert.ok(memberPill.querySelector('.app-menu__item-image--circle'),'Affected members also use circular avatars');
assert.equal(memberPill.disabled,false);memberPill.click();await settle();
assert.equal(viewedAudience,'two');assert.deepEqual(caseEditor.instance.form().audienceAccountIds,['two'],'Read-only profile action preserves selection');
caseEditor.setInput('editor',{kind:'task',value:null,readOnly:false});await settle();
assert.equal(caseEditor.instance.form().communityId,'selected-group','Group admin creates in the entered group');
assert.equal(caseHost.querySelector('[data-step-id="scope"]'),null,'No redundant Kinek/group selector');
assert.ok(memberBlock(),'The implicit group audience is available');
caseStore.activeGroup.set(null);
caseEditor.setInput('editor',{kind:'task',value:null,readOnly:false});await settle();
assert.equal(caseEditor.instance.form().communityId,null,'A personal schedule does not require an active group');
caseStore.activeGroup.set({...caseGroup,role:'Member'});
assert.equal(caseStore.newTaskGroupId(),null,'An ordinary member still creates their own personal schedule');
assert.equal(caseEditor.instance.flowModel().steps.flatMap(s=>s.controls).some(c=>c.id==='enabled'),false,'Activation belongs to the row menu');
const frequencyButton=[...caseHost.querySelectorAll('[data-control-id="schedule-frequency"] button')][0];
assert.ok(frequencyButton.textContent.includes('chevron_right'));frequencyButton.click();await settle();
const scheduleInput=caseEditor.instance.scheduleInput;assert.equal(scheduleInput.showSchedulePopup,true);
assert.ok(caseHost.querySelector('.event-slots-schedule-flow'));assert.equal(scheduleInput.scheduleTimeControls()[0].label,'case.task.start.from');
scheduleInput.onScheduleFlowValueChange({...scheduleInput.scheduleFlowValue,frequency:'Quarterly',startAt:'2026-12-08T14:35'});
scheduleInput.confirmSchedulePopup();await settle();
assert.equal(caseEditor.instance.form().frequency,'quarterly');assert.equal(caseEditor.instance.form().startAtIso,new Date('2026-12-08T14:35').toISOString());
assert.equal(scheduleInput.showSchedulePopup,false);
scheduleInput.config={frequency:'Monthly',frequencyOptions:['Custom','Monthly','Yearly'],startAtIso:'2026-12-08T14:35:00Z',enabled:true};scheduleInput.ngOnChanges({});
scheduleInput.openScheduleEditor();assert.deepEqual(scheduleInput.scheduleTimeControls().map(c=>c.id),['day','time'],'Existing event-slot popup retains its monthly controls');
scheduleInput.closeSchedulePopup();
caseEditor.destroy();caseHost.remove();casesEnv.destroy();
console.log('PASS nested schedule launcher, second-row create, status menus/counters, personal creation, shared recurrence popup and unchanged event-slot controls');
console.log('PASS case form uses the active group, empty initial audience, shared member block/picker, retained selection and adjacent name/type fields');

editor.destroy();env.destroy();
app.destroy(); dom.window.close();

import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AppUtils } from '../../../core/base/app-utils';
import {
  PopupComponent,
  type PopupModel,
  FormFlowComponent,
  type FormFlowModel,
  SmartListComponent,
  SingleRowComponent,
  type SingleRowData,
  type SmartListConfig,
  type SmartListLoadPage,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  I18nPipe,
  ExplanationGuideService
} from '@fssrepository/myscoutee-components';

import { CommunityCasesStore } from '../../context/stores/community/community-cases.store';
import { I18nService } from '../../../core/base/services/i18n.service';

import { CommunityCaseConverter } from '../../converters/community/community-case.converter';
import type { EventPolicyDTO } from '../../../core/contracts/event.interface';
import type { CaseOffer } from '../../../core/contracts/community-case.interface';
type Row = SingleRowData<CaseOffer>;
const emptyOffer = () => ({amount:0,currency:'EUR',note:'',workPolicies:[] as EventPolicyDTO[],refundPolicies:[] as EventPolicyDTO[]});
@Component({selector:'app-community-case-quotations',standalone:true,
 imports:[PopupComponent,FormFlowComponent,FormsModule,SmartListComponent,SingleRowComponent,I18nPipe],
 template:`<app-popup [model]="model()" [zIndex]="14900" data-guide-context="community-case-quotations">
   @if (store.quotations()?.canReviewOffers) {
     <app-smart-list data-guide-field="case-quotations" #list [config]="config" [query]="query()" [loadPage]="loadPage" [itemTemplate]="rowTemplate" (menuItemSelect)="action($event)"></app-smart-list>
     <ng-template #rowTemplate let-row let-openMenu="openMenu"><single-row [row]="row" [useSharedMenu]="true" (menuRequest)="openMenu($event)"></single-row></ng-template>
   } @else { <p data-guide-field="quotation-provider-help">{{ 'case.offers.provider-help' | i18n }}</p> }
 </app-popup>
 @if (editing()) {
   <app-popup [model]="editorModel()" [zIndex]="15300" data-guide-context="community-case-quotation-editor">
     <app-form-flow data-guide-field="case-quotation-details" [model]="flow()" [ngModel]="offer()" (ngModelChange)="offer.set($event)" [saving]="store.busy()"></app-form-flow>
   </app-popup>
 }`})
export class CommunityCaseQuotationsComponent {
 protected readonly store=inject(CommunityCasesStore);
 private readonly i18n=inject(I18nService);
 private readonly guide=inject(ExplanationGuideService);
 private readonly list=viewChild<SmartListComponent<Row>>('list');
 protected readonly editing=signal(false);
 protected readonly readOnly=signal(false);
 protected readonly editingId=signal<string|null>(null);
 protected readonly status=signal<CaseOffer['status']|'all'>('all');
 protected readonly query=computed(()=>({filters:{status:this.status()}}));
 protected readonly offer=signal(emptyOffer());
 protected readonly canOffer=computed(()=>{const c=this.store.quotations();return !!c&&['open','in-progress'].includes(c.status)&&c.membershipStatus==='accepted'&&c.support.some(s=>s.accountId===this.store.session()?.userId&&s.status==='accepted');});
 protected readonly rows=computed<Row[]>(()=>{
   const c=this.store.quotations();if(!c?.canReviewOffers)return [];
   return c.offers.filter(o=>this.status()==='all'||o.status===this.status()).map(o=>CommunityCaseConverter.offerRow(o,c,k=>this.i18n.translate(k),this.menu(o).map(m=>m.id)));
 });
 protected readonly config:SmartListConfig<Row>={pageSize:20,trackBy:(_,r)=>r.id,cacheable:{identity:r=>r.id},showStickyHeader:false,showGroupMarker:()=>false,
   headerProgress:{enabled:true},emptyLabel:'case.offers.empty',menuItems:c=>this.menu(c.item?.eagerDetail)};
 protected readonly loadPage:SmartListLoadPage<Row>=query=>{
   const rows=this.rows(),start=Number(query.cursor??0),items=rows.slice(start,start+query.pageSize);
   return of({items,total:rows.length,nextCursor:start+items.length<rows.length?String(start+items.length):null});
 };
 constructor(){
   effect(()=>{const id=this.store.quotationFocus();const c=this.store.quotations();if(id&&c){const offer=c.offers.find(o=>o.id===id);if(offer)untracked(()=>{this.openOffer(offer,true);this.store.quotationFocus.set(null);});}});
   effect(onCleanup=>onCleanup(untracked(()=>this.guide.registerContext('community.case.quotations'))));
   effect(onCleanup=>{if(this.editing())onCleanup(untracked(()=>this.guide.registerContext('community.case.quotation.editor')));});
   effect(()=>{const rows=this.rows(),list=this.list();if(!list)return;untracked(()=>{
     const count=Math.max(20,list.itemsSnapshot().length),items=rows.slice(0,count);
     list.syncVisibleItems(items,{total:rows.length,hasMore:items.length<rows.length,nextCursor:items.length<rows.length?String(items.length):null});
   });});
 }
 private menu(offer:CaseOffer|null|undefined):AppMenuItem[]{
   const c=this.store.quotations();if(!c||!offer)return [];
   return [
     {id:'view',label:'case.offer.view',icon:'article',palette:'blue',surface:'tinted',context:offer},
     ...(CommunityCaseConverter.canChatOffer(c,offer,this.store.session()?.userId??'')?[{id:'chat',label:'case.action.chat',icon:'chat',palette:'teal' as const,surface:'tinted' as const,context:offer}]:[]),
     ...(c.canManage&&['open','in-progress'].includes(c.status)?[{id:'edit',label:'edit',icon:'edit',palette:'blue' as const,surface:'tinted' as const,context:offer}]:[]),
     ...(c.canManage&&c.status!=='trash'
       ? (['pending','accepted','rejected'] as const).filter(status=>status!==offer.status).map(status=>({id:status==='pending'?'pending-offer':status==='accepted'?'accept-offer':'reject-offer',label:`case.offer.${status}`,...CommunityCaseConverter.offerStyle(status),surface:'tinted' as const,context:offer})):[]),
     ...(c.canManage&&!c.chatAccountIds.includes(offer.providerAccountId)&&c.support.some(s=>s.accountId===offer.providerAccountId&&s.status==='accepted')
       ? [{id:'invite-chat',label:'case.action.invite-chat',icon:'person_add',palette:'violet' as const,surface:'tinted' as const,context:offer}]:[])
   ];
 }
 protected action(e:AppMenuItemSelectEvent):void{
   const c=this.store.quotations(),offer=e.context as CaseOffer;if(!c||!offer)return;
   if(e.id==='view'||e.id==='edit'){
     if(e.id==='edit'&&!c.canManage)return;this.openOffer(offer,e.id==='view');
   } else if(e.id==='chat') void this.store.openChat(c, offer.id);
   else if(e.id==='invite-chat') void this.store.command(c,{action:'invite-chat',memberAccountIds:[offer.providerAccountId]},e.item);
   else if(c.canManage&&(e.id==='accept-offer'||e.id==='reject-offer'||e.id==='pending-offer')) void this.store.command(c,{action:e.id,offerId:offer.id},e.item);
 }
 private openOffer(offer:CaseOffer,readOnly:boolean):void {
   this.offer.set(CommunityCaseConverter.offerForm(offer,k=>this.i18n.translate(k)));this.editingId.set(offer.id);this.readOnly.set(readOnly);this.editing.set(true);
 }
 protected readonly canSave=computed(()=>this.editingId()?!!this.store.quotations()?.canManage&&['open','in-progress'].includes(this.store.quotations()!.status):this.canOffer());
 protected readonly model=computed<PopupModel>(()=>{
   const c=this.store.quotations(),providers=c?.members.filter(m=>c.support.some(s=>s.accountId===m.accountId&&s.status!=='declined'))??[];
   return {errorMessage:this.editing()?null:this.store.error(),title:'case.action.offers',subtitle:c?.title,size:'wide',height:'full',bodyLayout:'fill',onClose:()=>this.store.quotations.set(null),
     headerControls:[{id:'providers',kind:'menu',menuKind:'inline',items:[{
       id:'providers',kind:'action',layout:providers.length?'image-stack':'pill',label:providers.length?null:'case.offer.providers',icon:providers.length?null:'home_repair_service',palette:'teal',ariaLabel:'case.offer.providers',
       imageStack:providers.map(m=>({id:m.accountId,imageUrl:m.avatarUrl,imageAlt:m.name,imageFallback:AppUtils.initialsFromText(m.name)})),imageStackMaxVisible:4,
       counter:providers.length>4?providers.length-4:null,trailingIcon:'chevron_right'
     }]}],
     toolbarControls:[{id:'status',kind:'menu',menuKind:'select',trigger:{label:`case.offer.${this.status()}`,...CommunityCaseConverter.offerStyle(this.status()),layout:'pill'},
       items:(['all','pending','accepted','rejected'] as const).map(id=>({id,label:`case.offer.${id}`,...CommunityCaseConverter.offerStyle(id),kind:'radio',checked:id===this.status(),active:id===this.status(),surface:'tinted'}))},
       ...(this.canOffer()?[{id:'offer',icon:'add',ariaLabel:'case.offer.create',palette:'green' as const,align:'end' as const}]:[])],
     onAction:()=>{if(this.canOffer()){this.editingId.set(null);this.offer.set(emptyOffer());this.readOnly.set(false);this.editing.set(true);}},
     onMenuSelect:e=>{if(e.control.id==='status')this.status.set(e.itemSelect.id as CaseOffer['status']|'all');else if(c)void this.store.showProviders(c);}};
 });
 protected readonly editorModel=computed<PopupModel>(()=>({errorMessage:this.store.error(),title:this.readOnly()?'case.offer.view':this.editingId()?'case.offer.edit':'case.offer.create',size:'wide',onClose:()=>this.editing.set(false),
   headerControls:this.readOnly()?[]:[{id:'save',icon:'done',ariaLabel:'save',palette:'success',disabled:this.store.busy()||!this.canSave()||!Number.isFinite(this.offer().amount)||this.offer().amount<0||!/^[A-Z]{3}$/.test(this.offer().currency)}],
   onAction:()=>{const c=this.store.quotations();if(c&&!this.readOnly()&&this.canSave())void this.store.command(c,{action:this.editingId()?'edit-offer':'offer',offerId:this.editingId()??undefined,...this.offer()}).then(()=>{if(!this.store.error()){this.editing.set(false);this.offer.set(emptyOffer());}});}}));
 protected readonly flow=computed<FormFlowModel>(()=>{
   const t=(key:string)=>this.i18n.translate(key),disabled=this.readOnly();
   return {title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},steps:[
     {id:'quotation',title:t('case.offer.price'),icon:'request_quote',palette:'gold',controls:[
       {id:'amount',guideFieldId:'amount',bind:'amount',kind:'number',label:t('case.offer.amount'),min:0,max:100000000,required:true,disabled},
       {id:'currency',guideFieldId:'currency',bind:'currency',kind:'text',label:t('case.offer.currency'),maxLength:3,required:true,disabled},
       {id:'note',guideFieldId:'note',bind:'note',kind:'textarea',label:t('description'),maxLength:4000,rows:3,layout:'wide',disabled}]},
     ...(['work','refund'] as const).map(kind=>({id:`${kind}-policies`,title:'',chrome:'none' as const,controls:[
       {id:`${kind}-policies`,guideFieldId:`${kind}-policies`,bind:`${kind}Policies`,kind:'policies' as const,layout:'wide' as const,disabled,
         config:{model:{title:`case.offer.${kind}-policy`,subtitle:kind==='work'?'case.offer.work-policy.help':'',toggleable:false,
           popupSubtitle:`case.offer.${kind}-policy`,editorSubtitle:`case.offer.${kind}-policy`}}}]}))
   ]};
 });
}

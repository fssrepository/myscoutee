import {
  UiDateUtils,
  ExplanationGuideService,
  PopupComponent,
  type PopupModel,
  SmartListComponent,
  InfoCardComponent,
  SingleCardComponent,
  type SmartListConfig,
  type SmartListLoadPage,
  type InfoCardData,
  type AppMenuItemSelectEvent
} from '@myscoutee/components';
import { ServiceProviderCalendarComponent } from './service-provider-calendar.component';

import { Component, ViewChild, effect, inject, untracked, computed, signal } from '@angular/core';
import { defer,map } from 'rxjs';

import { ServiceOfferingsStore } from '../../context/stores/services/service-offerings.store';
import { ProfileStore } from '../../context/stores/profile/profile.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { type ServiceImageCard, ServiceOfferingConverter, SERVICE_STATUS_STYLE, SERVICE_CATEGORY_STYLE } from '../../converters/services/service-offering.converter';
import { ServiceOfferingEditorComponent } from './service-offering-editor.component';
import { SERVICE_CATEGORIES,type ServiceOfferingItem,type ServiceOfferingFilters,type ServiceCategory,type ServiceStatus,type ServiceAction } from '../../../core/contracts/service-offering.interface';

@Component({selector:'app-service-offerings-popup',standalone:true,imports:[ServiceProviderCalendarComponent,PopupComponent,SmartListComponent,InfoCardComponent,SingleCardComponent,ServiceOfferingEditorComponent],template:`
 @if(store.session()){
 <app-popup [model]="model()" [zIndex]="14600" data-guide-context="community-services">
 @if(store.session()?.providers){
 <app-smart-list data-guide-field="service-list" [config]="providerConfig" [loadPage]="loadProviders" [itemTemplate]="providerCard"></app-smart-list>
 <ng-template #providerCard let-card><app-single-card [card]="card" (detailClick)="openProfile($event.userId)"></app-single-card></ng-template>
 } @else if(view()==='list'||store.session()?.pick){
 <app-smart-list #list data-guide-field="service-list" [config]="config" [query]="query()" [loadPage]="loadPage" [itemTemplate]="card" (menuItemSelect)="action($event)"></app-smart-list>
 <ng-template #card let-card let-openMenu="openMenu"><app-info-card [card]="card" [useSharedMenu]="true" (menuRequest)="openMenu($event)" (mediaEndClick)="store.toggleSelection(card.eagerDetail)"></app-info-card></ng-template>
 } @else {<app-service-provider-calendar [view]="view()"></app-service-provider-calendar>}
 </app-popup>}
 @if(store.editor();as editor){<app-service-offering-editor [editor]="editor"></app-service-offering-editor>}`})
export class ServiceOfferingsPopupComponent {
 protected readonly store=inject(ServiceOfferingsStore);
 private readonly profiles=inject(ProfileStore);
 private readonly i18n=inject(I18nService);
 @ViewChild('list')private list?:SmartListComponent<InfoCardData<ServiceOfferingItem>,ServiceOfferingFilters>;
 protected readonly status = signal<ServiceStatus>('published');protected readonly category = signal<ServiceCategory|null>(null);
 protected readonly view=signal<'list'|'week'|'month'>('list');
 protected readonly query = computed(() => {return {filters:{scope:this.store.session()?.pick?'all' as const:'own' as const,status:this.status(),category:this.store.session()?.pick?this.category():null},userId:this.store.profileId()};});
 protected readonly config:SmartListConfig<InfoCardData<ServiceOfferingItem>,ServiceOfferingFilters>={pageSize:20,listLayout:'card-grid',trackBy:(_,c)=>c.id,cacheable:{identity:c=>c.id},headerProgress:{enabled:true,placement:'inline'},
   sortable:{sortKey:(c,_index,q)=>[q.filters?.scope==='own'?-Date.parse(c.dateIso??''):(c.eagerDetail?.distanceKm??Infinity),c.id]},
   groupBy:(c,q)=>q.filters?.scope==='own'?UiDateUtils.smartListDayLabel(new Date(c.dateIso!)):'',
   showFirstGroupMarker:false,menuItems:c=>c.item?.eagerDetail?ServiceOfferingConverter.menu(c.item.eagerDetail):[]};
 protected readonly providerConfig:SmartListConfig<ServiceImageCard>={pageSize:20,listLayout:'card-grid',trackBy:(_,card)=>card.id,showStickyHeader:false,showGroupMarker:()=>false,headerProgress:{enabled:true},emptyLabel:'service.empty'};
 protected readonly loadProviders:SmartListLoadPage<ServiceImageCard>=(q,c)=>defer(()=>this.store.page(q,c?.signal)).pipe(map(p=>({...p,items:p.items.map(item=>ServiceOfferingConverter.imageCard(item,k=>this.i18n.translate(k)))})));
 protected openProfile(userId:string):void{this.profiles.openProfileView({userId});}
 protected readonly loadPage:SmartListLoadPage<InfoCardData<ServiceOfferingItem>,ServiceOfferingFilters>=(q,c)=>defer(()=>this.store.page(q,c?.signal)).pipe(map(p=>({...p,items:p.items.map(i=>this.card(i))})));
 private card(item:ServiceOfferingItem):InfoCardData<ServiceOfferingItem>{return ServiceOfferingConverter.card(item,k=>this.i18n.translate(k),!!this.store.session()?.pick,this.store.selected()?.service.id===item.service.id);}
 private renderedSelectionId:string|null=null;
 private readonly guide=inject(ExplanationGuideService);
 constructor(){effect(()=>{const id=this.store.selected()?.service.id??null,previous=this.renderedSelectionId;this.renderedSelectionId=id;untracked(()=>{for(const key of new Set([previous,id]))if(key)this.list?.patchVisibleItem(card=>card.id===key,card=>this.card(card.eagerDetail!));});});
 effect(onCleanup=>{if(this.store.session())onCleanup(untracked(() => this.guide.registerContext('community.services')));});effect(()=>{const item=this.store.changed();if(!item)return;const s=item.service;
   if(s.status!==this.status()||this.store.session()?.pick&&this.category()&&s.category!==this.category())untracked(() => this.list?.removeVisibleItemByIdentity(s.id));
   else{const card=untracked(()=>this.card(item));if(!untracked(() => this.list?.patchVisibleItem(c=>c.id===s.id,()=>card)))untracked(() => this.list?.reinsertVisibleItem(card,{loadedRange:'before-or-within'}));}});}
 protected action(e:AppMenuItemSelectEvent):void{const item=e.context as ServiceOfferingItem;
   if(e.id==='view'||e.id==='edit')this.store.edit(item,e.id==='view');else if(e.id==='author')void this.profiles.openProfileView({userId:item.ownerUserId});else void this.store.action(item,e.id as ServiceAction,e.item);}
 protected readonly model = computed<PopupModel>(() => {const selected=this.store.selected();if(this.store.session()?.providers)return {title:'case.offer.providers',subtitle:this.store.session()?.providers?.title,errorMessage:this.store.error(),size:'wide',height:'full',bodyLayout:'fill',onClose:()=>this.store.close()};return {errorMessage:this.store.editor()?null:this.store.error(),title:this.store.session()?.pick?'service.select':'service.title',size:'wide',height:'full',bodyLayout:'fill',onClose:()=>this.store.close(),showToolbar:true,
   headerControls:this.store.session()?.pick?[{id:'selection',kind:'menu',menuKind:'inline',panelAlign:'end',closeOnSelect:false,items:[
     ...(selected?[{id:'basket',icon:'shopping_basket',openIcon:'shopping_basket',kind:'branch' as const,palette:'blue' as const,counter:1,ariaLabel:'service.select',items:[
       {id:'selected-service',label:selected.service.title,description:selected.ownerName,icon:'home_repair_service',kind:'action' as const,palette:'blue' as const,surface:'tinted' as const,removable:true,removeIcon:'close',removeAriaLabel:'remove',closeOnSelect:false}]}]:[]),
     {id:'confirm',icon:'done',kind:'action',palette:'success',ariaLabel:'confirm',disabled:!selected}]}]:[{id:'view',kind:'menu',menuKind:'select',trigger:{label:this.view()==='list'?'service.view.list':this.view()==='week'?'week':'month',icon:this.view()==='list'?'view_agenda':this.view()==='week'?'view_week':'calendar_month',palette:this.view()==='list'?'blue':this.view()==='week'?'teal':'violet',layout:'pill',collapsible:true},items:(['list','week','month'] as const).map(id=>({id,label:id==='list'?'service.view.list':id==='week'?'week':'month',icon:id==='list'?'view_agenda':id==='week'?'view_week':'calendar_month',palette:id==='list'?'blue':id==='week'?'teal':'violet',surface:'tinted',kind:'radio',active:id===this.view(),checked:id===this.view()}))}],onAction:()=>this.store.edit(),
   toolbarControls:!this.store.session()?.pick?[...(this.view()==='list'?[{id:'status',kind:'menu' as const,menuKind:'select' as const,trigger:{label:`service.status.${this.status()}`,...SERVICE_STATUS_STYLE[this.status()],layout:'pill' as const},items:(['published','draft','trash'] as const).map(id=>({id,label:`service.status.${id}`,...SERVICE_STATUS_STYLE[id],kind:'radio' as const,active:id===this.status(),checked:id===this.status(),surface:'tinted' as const}))}]:[]),{id:'create',icon:'add',ariaLabel:'service.create',palette:'green',align:'end'}]:[
     {id:'category',kind:'menu',menuKind:'select',trigger:{label:this.category()?`service.category.${this.category()}`:'service.category.all',...(this.category()?SERVICE_CATEGORY_STYLE[this.category()!]:{icon:'category',palette:'teal' as const}),layout:'pill'},items:(['',...SERVICE_CATEGORIES] as const).map(id=>({id,label:id?`service.category.${id}`:'service.category.all',...(id?SERVICE_CATEGORY_STYLE[id]:{icon:'category',palette:'teal' as const}),surface:'tinted',kind:'radio',checked:id===(this.category()??'')}))}],
   onMenuSelect:e=>{if(e.control.id==='view')this.view.set(e.itemSelect.id as 'list'|'week'|'month');else if(e.itemSelect.id==='confirm')this.store.confirmSelection();else if(e.itemSelect.id==='selected-service'&&e.itemSelect.action==='remove')this.store.selected.set(null);else if(e.control.id==='status')this.status.set(e.itemSelect.id as ServiceStatus);else if(e.control.id==='category')this.category.set(e.itemSelect.id as ServiceCategory||null);}};});
}

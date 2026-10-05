import { AppUtils } from '../../../app-utils';
import { ServiceFeedbackService } from '../../../core/base/services/service-feedback.service';
import type { ServiceFeedbackStats } from '../../../core/contracts/service-feedback.interface';
import { SERVICE_RATING_CRITERIA } from '../../../core/contracts/rating-snapshot';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { Component, OnChanges, OnDestroy, inject, computed, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent,type PopupModel } from '../core/popup';
import { FormFlowComponent,type FormFlowModel,type FormFlowActionEvent } from '../core/form/flow';
import { ServiceOfferingsStore } from '../../context/stores/service-offerings.store';
import { SERVICE_CATEGORY_STYLE } from '../../converters/service-offering.converter';
import { I18nService } from '../../../core/base/services/i18n.service';
import { SERVICE_CATEGORIES,type ServiceOfferingItem,type SaveServiceOffering } from '../../../core/contracts/service-offering.interface';
@Component({selector:'app-service-offering-editor',standalone:true,imports:[FormsModule,PopupComponent,FormFlowComponent],template:`
 <app-popup [model]="popup()" [zIndex]="15100" data-guide-context="community-service-editor">
 <app-form-flow data-guide-field="service-details" [model]="flow()" [ngModel]="form()" (ngModelChange)="form.set($event)" (action)="staffAction($event)" [saving]="store.busy()"></app-form-flow>
 </app-popup>`, styles: [`:host { --form-flow-grouped-media-image-height: 100%; --form-flow-grouped-media-image-align: stretch; --form-flow-grouped-media-image-width: 100%; }
 @media (max-width: 760px) { :host { --form-flow-grouped-media-image-height: clamp(160px, 54vw, 260px); } }`]})
export class ServiceOfferingEditorComponent implements OnChanges, OnDestroy {
  readonly editor = input.required<{value:ServiceOfferingItem|null;readOnly:boolean}>();
 protected readonly store=inject(ServiceOfferingsStore);
 private readonly i18n=inject(I18nService);
 private readonly feedback=inject(ServiceFeedbackService);
 protected readonly stats=signal<ServiceFeedbackStats|null>(null);
 private statsGeneration=0;
 private readonly guide=inject(ExplanationGuideService);
 private unregister:(()=>void)|null=null;
 ngOnDestroy():void{this.statsGeneration++;this.unregister?.();}
 protected readonly form = signal<SaveServiceOffering>(null!);
 private loadStats():void{const owner=this.editor().value?.service.ownerAccountId,generation=++this.statsGeneration;this.stats.set(null);if(owner)void this.feedback.stats(this.store.profileId(),owner).then(stats=>{if(generation===this.statsGeneration)this.stats.set(stats);}).catch(()=>{if(generation===this.statsGeneration)this.store.error.set('service.feedback.failed');});}
 ngOnChanges():void{this.loadStats();this.unregister??=this.guide.registerContext('community.service.editor');const s=this.editor().value?.service;this.form.set({userId:this.store.profileId(),id:s?.id,version:s?.version,title:s?.title??'',description:s?.description??'',sourceLink:s?.sourceLink??'',category:s?.category??'maintenance',imageUrls:[...(s?.imageUrls??[])],languages:[...(s?.languages??[])],maxDistanceKm:null,
   staffAccountIds:[...(s?.staffAccountIds??[this.store.accountId()])],slotsEnabled:false,startAtIso:null,endAtIso:null,frequency:'One-time',durationMinutes:60,slotTemplates:[],pricing:null});}
 protected readonly popup = computed<PopupModel>(() => ({errorMessage:this.store.error(),title:this.editor().readOnly?'service.view':'service.edit',size:'wide',height:'full',onClose:()=>this.store.closeEditor(),
   headerControls:this.editor().readOnly?[]:[{id:'save',icon:'done',ariaLabel:'save',palette:'success',disabled:this.store.busy()||!this.form().title.trim()||!this.form().staffAccountIds.length}],onAction:()=>void this.store.save(this.form())}));
 protected readonly staffFlow = computed<FormFlowModel>(() => {
   const members=new Map(this.store.staffMembers().map(member=>[member.userId,member]));
   const selected=this.form().staffAccountIds.flatMap(id=>{const member=members.get(id);return member?[member]:[];});
   return {title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},steps:[{
     id:'staff',title:this.i18n.translate('service.staff'),icon:'groups',palette:'teal',
     headerControl:this.editor().readOnly?null:{id:'choose-staff',kind:'menu',config:{kind:'inline',items:[{id:'choose-staff',icon:'add',ariaLabel:'service.staff',palette:'green',disabled:this.store.busy()}]}},
     controls:selected.length?[{id:'staff-list',guideFieldId:'staff',kind:'menu',layout:'wide',config:{kind:'inline',items:selected.map(member=>({id:member.userId,label:member.name,imageUrl:member.avatarUrl,imageFallback:member.initials||AppUtils.initialsFromText(member.name),imageAlt:member.name,imageShape:"circle",trailingIcon:'chevron_right',layout:'pill',kind:'action',palette:'teal'}))}}]
       :[{id:'staff-empty',guideFieldId:'staff',kind:'static',summary:{value:()=>this.i18n.translate(this.form().staffAccountIds.length?'loading':'service.staff.empty')}}]
   }]};
 });
 protected staffAction(event:FormFlowActionEvent):void{
   if(event.control.id==='staff-list'){this.store.openMemberProfile(event.sourceEvent.id);return;}
   if(event.control.id==='choose-staff')this.chooseStaff();
 }
 protected chooseStaff():void{if(!this.editor().readOnly)void this.store.chooseStaff(this.form().staffAccountIds,ids=>this.form.update(form=>({...form,staffAccountIds:ids})));}
 protected imagesChanged(imageUrls: string[]): void { this.form.update(form => ({ ...form, imageUrls })); }
 protected readonly flow = computed<FormFlowModel>(() => {const t=(k:string)=>this.i18n.translate(k);const model:FormFlowModel={title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},steps:[...this.staffFlow().steps,{id:'details',title:'',presentation:'media',controls:[
   {id:'imageUrls',guideFieldId:'imageUrls',bind:'imageUrls',kind:'image-carousel',layout:'wide',rowSpan:4,config:{gallery:true,slotCount:4,uploadOwnerId:this.store.profileId(),uploadEntityId:this.form().id??'service-draft'},summary:{hidden:true}},
   {id:'title',guideFieldId:'title',bind:'title',kind:'text',label:t('name'),maxLength:120,required:true},{id:'description',guideFieldId:'description',bind:'description',kind:'textarea',label:t('description'),rows:2,maxLength:120},
   {id:'sourceLink',guideFieldId:'sourceLink',bind:'sourceLink',kind:'link',label:t('service.external.link'),placeholder:'https://...',layout:'wide'},
   {id:'category',guideFieldId:'category',bind:'category',kind:'menu',config:{kind:'select',trigger:{label:`service.category.${this.form().category}`,...SERVICE_CATEGORY_STYLE[this.form().category],layout:'pill'},items:SERVICE_CATEGORIES.map(id=>({id,value:id,label:`service.category.${id}`,...SERVICE_CATEGORY_STYLE[id],surface:'tinted',kind:'radio',active:id===this.form().category,checked:id===this.form().category}))}},

 ]},...(this.stats()?[{id:'statistics',title:t('service.feedback.statistics'),icon:'star',palette:'gold',controls:[
   {id:'statistics-values',kind:'table' as const,layout:'wide' as const,config:{rows:[
     {label:t('service.feedback.count'),value:String(this.stats()!.count)},
     ...(this.stats()!.count?[{label:t('service.feedback.average'),value:`${this.stats()!.average.toFixed(2)} / 10`},
       ...SERVICE_RATING_CRITERIA.criteria.map(c=>({label:t(c.label),value:`${(this.stats()!.criteria[c.id]??0).toFixed(2)} / 10`}))]:[])]}}
 ]}]:[])]};return {...model,steps:model.steps.map(step=>({...step,controls:step.controls.map(c=>({...c,disabled:this.editor().readOnly&&c.id!=='staff-list'}))}))};});
}

import { DocumentAttachments } from '../core/form/flow/document-attachments';
import { Component, OnChanges, OnDestroy, inject, computed, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PopupComponent,
  type PopupModel,
  FormFlowComponent,
  type FormFlowModel,
  type FormFlowActionEvent,
  type AppMenuModel,
  ExplanationGuideService
} from '@fssrepository/myscoutee-components';

import { CommunityAnnouncementsStore, type AnnouncementEditor } from '../../context/stores/community/community-announcements.store';
import { MediaService } from '../../../core/base/services/media.service';
import { I18nService } from '../../../core/base/services/i18n.service';

import { VOTE_CHOICES, type VoteChoice, type SaveAnnouncement } from '../../../core/contracts/community-announcement.interface';
@Component({selector:'app-community-announcement-editor',standalone:true,imports:[FormsModule,PopupComponent,FormFlowComponent],
 template:`<app-popup [model]="popup()" [zIndex]="15000" data-guide-context="community-announcement-editor">
   @if (editor().readOnly && editor().view !== 'voting') {
     <article class="announcement-document" data-guide-field="announcement-details">
       <h2>{{form().title}}</h2>
       @if (form().body) { <p>{{form().body}}</p> }
     </article>
   }
   <input #files type="file" hidden multiple accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods" (change)="upload($event)">
   <app-form-flow data-guide-field="announcement-details" [model]="flow()" [ngModel]="formView()" (ngModelChange)="formChanged($event)" (action)="attachmentAction($event, files)" [saving]="store.busy() || uploading()"></app-form-flow>

 </app-popup>`,styles:[`.announcement-document { padding: 0 12px 12px; }
 .announcement-document h2 { margin: 0 0 16px; font-size: 1.15rem; }
 .announcement-document p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 1rem; line-height: 1.65; }`]})
export class CommunityAnnouncementEditorComponent implements OnChanges, OnDestroy {
  readonly editor = input.required<AnnouncementEditor>();
 protected readonly store=inject(CommunityAnnouncementsStore);
 private readonly media=inject(MediaService);
 private readonly i18n=inject(I18nService);
 private readonly guide=inject(ExplanationGuideService);
 private unregister:(()=>void)|null=null;
 protected readonly form = signal<SaveAnnouncement & { deadline:string }>(null!);
 protected readonly formView = computed(() => ({...this.form(),attachmentNames:this.form().attachments.map(file=>file.name).join(', ')}));
 protected formChanged(value: SaveAnnouncement & {deadline:string;attachmentNames:string}): void {
   const {attachmentNames,...form}=value;this.form.set(form);
 }
 protected readonly choices=VOTE_CHOICES;
 private readonly documents = new DocumentAttachments(this.media, {
   files:()=>this.form().attachments,setFiles:attachments=>this.form.update(form=>({...form,attachments})),
   ownerId:()=>this.store.userId(),entityId:()=>this.form().id??'announcement-draft',
   readOnly:()=>this.editor().readOnly,busy:()=>this.store.busy()
 });
 protected readonly uploading = this.documents.uploading;
 protected readonly error = signal('');

 ngOnChanges():void {this.documents.reset();this.unregister??=this.guide.registerContext('community.announcement.editor');const a=this.editor().value;
   const iso=a?.deadlineIso??new Date(Date.now()+7*86400000).toISOString();const date=new Date(iso);
   this.form.set({userId:this.store.userId(),communityId:this.store.groupId(),id:a?.id,version:a?.version,title:a?.title??'',body:a?.body??'',attachments:[...(a?.attachments??[])],voting:a?.voting??this.editor().defaultVoting??false,deadlineIso:iso,
     deadline:new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}); }
 ngOnDestroy():void {this.documents.reset();this.unregister?.();}
 protected readonly popup = computed<PopupModel>(() => {return {errorMessage:this.error()||this.documents.error()||this.store.error(),title:this.editor().view==='voting'?(this.deadlinePassed()?'announcement.results':'announcement.voting'):this.editor().readOnly?'announcement.view':'announcement.edit',size:'wide',height:'full',onClose:()=>this.store.closeEditor(),
   headerControls:this.editor().readOnly?[]:[{id:'save',icon:'done',ariaLabel:'save',palette:'success',disabled:this.store.busy()||this.uploading()||!this.form().title.trim()}],
   onAction:()=>{if(this.form().voting&&!Number.isFinite(Date.parse(this.form().deadline))){this.error.set('announcement.failed');return;}
     void this.store.save({...this.form(),deadlineIso:this.form().voting?new Date(this.form().deadline).toISOString():null});}};});
 protected readonly flow = computed<FormFlowModel>(() => {
   if(this.editor().view==='voting')return this.votingFlow();
   const t=(k:string)=>this.i18n.translate(k), readOnly=this.editor().readOnly, form=this.form();
   return {title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},steps:[
     ...(!readOnly?[{id:'details',title:'',controls:[{id:'title',guideFieldId:'title',bind:'title',kind:'text' as const,label:t('name'),required:true,maxLength:160},
          {id:'body',guideFieldId:'body',bind:'body',kind:'textarea' as const,label:t('description'),maxLength:12000,rows:8}]}]:[]),
     ...(!readOnly?[{id:'voting',title:t('announcement.voting'),icon:'how_to_vote',
       headerControl:{id:'voting',guideFieldId:'voting',bind:'voting',kind:'toggle' as const,label:t('announcement.voting'),disabled:!!this.editor().value?.castVotes},
       controls:form.voting?[{id:'deadline',guideFieldId:'deadline',bind:'deadline',kind:'date' as const,config:{model:{precision:'minute' as const,valueFormat:'iso-date-time' as const,time:true}},label:t('announcement.deadline'),required:true,description:t('announcement.deadline.help')}] : []}]:[]),
     ...this.documents.steps(t)
   ]};
 });
 protected readonly deadlinePassed = computed(() => {
   const deadline=this.editor().value?.deadlineIso;
   return this.editor().value?.closed === true || !!deadline && Date.parse(deadline)<=Date.now();
 });
 protected readonly votingFlow = computed<FormFlowModel>(() => {
   const a=this.editor().value,t=(key:string)=>this.i18n.translate(key),ended=this.deadlinePassed();
   if(!a)return {title:'',steps:[]};
   return {title:'',layout:'grouped',header:false,save:null,summary:{enabled:false},steps:[
     {id:'voting-summary',title:a.title,icon:'how_to_vote',controls:[
       {id:'deadline',kind:'table',layout:'wide',config:{rows:[{label:t('announcement.deadline'),value:a.deadlineIso?new Date(a.deadlineIso).toLocaleString(this.i18n.currentLanguage(),{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}]}},
       ...(!ended?[{id:'results-later',kind:'static' as const,layout:'wide' as const,summary:{value:()=>t('announcement.results.after.deadline')}}]:[])
     ]},
     ...(a.myBallot?[{id:'my-vote',title:t('announcement.my.vote'),icon:'how_to_vote',controls:[
       {id:'cast-choice',kind:'static' as const,layout:'wide' as const,summary:{value:()=>t('announcement.choice.'+a.myBallot)}}]}]
       :!ended&&a.status==='published'?[{id:'my-vote',title:t('announcement.voting'),icon:'how_to_vote',controls:a.canVote
         ?[{id:'vote-member',guideFieldId:'vote',kind:'menu' as const,layout:'wide' as const,description:t('announcement.vote.final'),config:{kind:'inline' as const,model:this.voteMenu()}}]
         :[{id:'not-eligible',kind:'static' as const,layout:'wide' as const,summary:{value:()=>t('announcement.vote.not.eligible')}}]}]:[]),
     ...(ended?[{id:'voting-results',title:t('announcement.results'),icon:'poll',palette:'green',controls:[
       {id:'results',guideFieldId:'voting-results',kind:'table' as const,layout:'wide' as const,config:{rows:[
         {label:t('announcement.votes.cast'),value:`${a.castVotes} / ${a.eligibleMembers}`},
         ...this.choices.map(choice=>({label:t('announcement.choice.'+choice),value:String(a.results[choice])}))
       ]}}
     ]}]:[])
   ]};
 });
 protected readonly voteMenu = computed<AppMenuModel>(() => ({ nodes: [{ id:'vote', items:this.choices.map(choice=>({
   id:choice,label:`announcement.choice.${choice}`,icon:choice==='yes'?'thumb_up':choice==='no'?'thumb_down':'remove',
   kind:'action',layout:'pill',palette:choice==='yes'?'green':choice==='no'?'red':'slate',surface:'tinted',disabled:this.store.busy()
 })) }] }));
 protected attachmentAction(event:FormFlowActionEvent, input:HTMLInputElement):void {
   const action=event.sourceEvent.id;
   if(event.control.id.startsWith('vote-')){
     const a=this.editor().value;
     if(a&&this.editor().view==='voting'&&!this.deadlinePassed()&&!a.closed&&a.status==='published'&&VOTE_CHOICES.includes(action as VoteChoice))void this.store.command(a,'vote',action as VoteChoice,this.voteMenu().nodes?.[0]?.items?.find(item=>item.id===action)?.palette);
     return;
   }
   this.documents.action(event,input);
 }
 protected upload(event:Event):Promise<void>{return this.documents.upload(event);}
}

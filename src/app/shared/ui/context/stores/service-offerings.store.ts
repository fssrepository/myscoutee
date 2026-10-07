import type { RatingSnapshot } from '../../../core/contracts/rating-snapshot';
import { CaseAppointmentsService } from '../../../core/base/services/case-appointments.service';
import { Injectable, Type, computed, effect, inject, signal } from '@angular/core';
import { ServiceOfferingsService } from '../../../core/base/services/service-offerings.service';
import { GroupWorkspaceContextService } from '../../../core/base/services/group-workspace-context.service';
import { GameService } from '../../../core/base/services/game.service';
import { ActivityMembersService } from '../../../core/base/services/activity-members.service';
import { ActivityInvitePopupStore } from './activity-invite-popup.store';
import { UserProfileStore } from './user-profile.store';
import { ProfileStore } from './profile.store';
import { DialogStore } from './dialog.store';
import type { AppMenuItem } from '../../components/core/menu';
import type { CaseAppointmentCalendarEntry } from '../../../core/contracts/case-appointment.interface';
import { COMMUNITY_BASE_GROUP_ID } from '../../../core/contracts/group-type';
import type { ServiceOfferingItem, ServiceOfferingFilters, SaveServiceOffering, ServiceAction } from '../../../core/contracts/service-offering.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';
@Injectable({providedIn:'root'})
export class ServiceOfferingsStore {
  private readonly appointments=inject(CaseAppointmentsService);
  readonly calendarCancelled=signal<string|null>(null);
  private readonly service=inject(ServiceOfferingsService);
  private readonly workspace=inject(GroupWorkspaceContextService);
  private readonly profile=inject(UserProfileStore);
  private readonly profiles=inject(ProfileStore);
  private readonly game=inject(GameService);
  private readonly members=inject(ActivityMembersService);
  private readonly picker=inject(ActivityInvitePopupStore);
  private readonly dialogs=inject(DialogStore);
  readonly accountId=computed(()=>this.workspace.accountId(this.profile.activeUserId()));
  readonly profileId=computed(()=>`group:${COMMUNITY_BASE_GROUP_ID}:${this.accountId()}`);
  readonly session=signal<{pick:((item:ServiceOfferingItem)=>void)|null;providers?:{title:string;ids:string[]}}|null>(null);
  readonly selected=signal<ServiceOfferingItem|null>(null);
  readonly component=signal<Type<unknown>|null>(null);
  readonly editor=signal<{value:ServiceOfferingItem|null;readOnly:boolean}|null>(null);
  readonly changed=signal<ServiceOfferingItem|null>(null);
  readonly busy=signal(false);
  readonly error=signal('');
  readonly scores=signal<Record<string,number>>({});
  readonly staffMembers=signal<ActivityMemberDTO[]>([]);
  private staffMembersRequest:Promise<ActivityMemberDTO[]>|null=null;
  private generation=0;
  private account=this.accountId();
  constructor(){effect(()=>{if(!this.workspace.isCommunity()&&(this.session()||this.editor()))this.close();const account=this.accountId();if(account!==this.account){this.account=account;this.close();this.scores.set({});this.changed.set(null);}});}
  async open(pick:((item:ServiceOfferingItem)=>void)|null=null):Promise<void>{if(!this.workspace.isCommunity())return;
    this.close();const gen=this.generation;this.session.set({pick});
    if(!this.component()){const component=(await import('../../components/service-offerings/service-offerings-popup.component')).ServiceOfferingsPopupComponent;if(gen===this.generation)this.component.set(component);}}
  async openProviders(title:string,ids:string[]):Promise<void>{
    await this.open();if(this.session())this.session.set({pick:null,providers:{title,ids:[...new Set(ids)]}});
  }
  close():void{this.generation++;this.session.set(null);this.selected.set(null);this.editor.set(null);this.clearStaffMembers();this.busy.set(false);this.error.set('');}
  closeEditor():void{this.generation++;this.editor.set(null);this.clearStaffMembers();this.busy.set(false);this.error.set('');}
  select(item:ServiceOfferingItem):void{const pick=this.session()?.pick;if(pick){this.close();pick(item);}}
  toggleSelection(item:ServiceOfferingItem):void{if(this.session()?.pick)this.selected.update(current=>current?.service.id===item.service.id?null:item);}
  confirmSelection():void{const item=this.selected();if(item)this.select(item);}
  async page(query:ListQuery<ServiceOfferingFilters>,signal?:AbortSignal){const id=this.profileId(),providers=this.session()?.providers;
    if(providers&&!providers.ids.length)return {items:[],total:0,nextCursor:null};
    const page=await this.service.page(id,providers?{...query,filters:{scope:'all',serviceIds:providers.ids}}:query,signal);
    if(id!==this.profileId())throw new DOMException('Workspace changed','AbortError');
    this.scores.update(scores=>({...scores,...Object.fromEntries(page.items.map(i=>[i.ownerUserId,i.viewerRating]))}));return page;}
  score(item:ServiceOfferingItem):number{return this.scores()[item.ownerUserId]??item.viewerRating;}
  rate(item:ServiceOfferingItem,rating:number,snapshot?:RatingSnapshot):void{if(item.canManage)return;
    this.game.recordUserGameCardRating(this.profileId(),item.ownerUserId,rating,'single',undefined,undefined,undefined,snapshot);this.scores.update(scores=>({...scores,[item.ownerUserId]:rating}));}
  async openReference(id:string):Promise<void>{
    await this.open();
    await this.mutate(async()=>{const value=await this.service.detail(this.profileId(),id);return()=>this.edit(value,true);});
  }
  edit(value:ServiceOfferingItem|null=null,readOnly=false):void{this.error.set('');this.clearStaffMembers();const editor={value,readOnly};this.editor.set(editor);
    void this.loadStaffMembers().catch(()=>{if(this.editor()===editor)this.error.set('service.failed');});}
  async save(value:SaveServiceOffering):Promise<void>{await this.mutate(async()=>{const result=await this.service.save({...value,userId:this.profileId()});return()=>{this.changed.set(result);this.editor.set(null);};});}
  async action(item:ServiceOfferingItem,action:ServiceAction,menuItem:AppMenuItem):Promise<void>{
    const actor = this.profileId(), id = item.service.id, version = item.service.version;
    this.confirmMutation(menuItem, item.service.title, `service.confirm.${action}`, async () => {
      const result = await this.service.action(actor, id, action, version);
      return () => this.changed.set(result);
    });
  }
  async chooseStaff(selected:readonly string[],apply:(ids:string[])=>void):Promise<void>{const gen=this.generation;
    const rows=await this.loadStaffMembers();
    await this.picker.ensureAssetMemberPickerPopupLoaded();if(gen!==this.generation)return;
    this.picker.openActivityInvitePopup({ownerType:'community',ownerId:COMMUNITY_BASE_GROUP_ID,headerTitle:'service.staff',parentZIndex:15100,initialCandidates:rows,initialSelection:rows.filter(m=>selected.includes(m.userId)),
      onApply:members=>{if(gen===this.generation)apply(members.map(m=>m.userId));}});}
  openMemberProfile(accountId:string):void{
    const member=this.staffMembers().find(m=>m.userId===accountId);
    if(member)void this.profiles.openProfileView({userId:accountId,label:member.name});
  }
  private clearStaffMembers():void{this.staffMembersRequest=null;this.staffMembers.set([]);}
  private loadStaffMembers():Promise<ActivityMemberDTO[]>{
    if(this.staffMembersRequest)return this.staffMembersRequest;
    const request=this.members.queryMembersByOwner({ownerType:'community',ownerId:COMMUNITY_BASE_GROUP_ID})
      .then(members=>{const rows=members.filter(m=>m.status==='accepted');if(this.staffMembersRequest===request)this.staffMembers.set(rows);return rows;})
      .catch(error=>{if(this.staffMembersRequest===request)this.staffMembersRequest=null;throw error;});
    this.staffMembersRequest=request;return request;
  }
  calendar(rangeStart:string,rangeEnd:string){return this.appointments.calendar(this.profileId(),rangeStart,rangeEnd);}
  async cancelAppointment(entry:CaseAppointmentCalendarEntry,menuItem:AppMenuItem):Promise<void>{
    const appointment = entry.appointment;
    if (!appointment) return;
    const actor = this.profileId(), {caseId, providerAccountId, id, startAtIso} = appointment;
    const message = [entry.caseTitle, entry.serviceTitle, entry.customerName, new Date(startAtIso).toLocaleString()].filter(Boolean).join(' · ');
    this.confirmMutation(menuItem, message, 'case.appointments.cancel.confirm', async () => {
      await this.appointments.cancel(actor, caseId, providerAccountId, id);
      return () => this.calendarCancelled.set(id);
    });
  }
  private confirmMutation(menuItem:AppMenuItem,message:string,warningMessage:string,work:()=>Promise<()=>void>):void{
    if (this.busy()) return;
    const actor = this.profileId(), session = this.session();
    let generation = this.generation;
    const label = (typeof menuItem.label === 'function' ? menuItem.label() : menuItem.label) ?? 'confirm';
    this.dialogs.open({
      title: label, message, warningMessage,
      cancelLabel: 'cancel', confirmLabel: label, confirmPalette: menuItem.palette,
      busyConfirmLabel: 'saving', failureMessage: 'service.failed',
      onConfirm: async () => {
        if (actor !== this.profileId() || session !== this.session() || generation !== this.generation
          || this.busy() || !this.workspace.isCommunity()) throw new Error('service.changed');
        generation++;
        await this.mutate(work, true);
      }
    });
  }
  private async mutate(work:()=>Promise<()=>void>,rethrow=false):Promise<void>{if(this.busy())return;const gen=++this.generation;this.busy.set(true);this.error.set('');
    try{const apply=await work();if(gen===this.generation)apply();}catch{if(gen===this.generation)this.error.set('service.failed');if(rethrow)throw new Error('service.failed');}finally{if(gen===this.generation)this.busy.set(false);}}
}

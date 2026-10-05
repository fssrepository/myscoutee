import {Injectable,inject,effect,signal} from '@angular/core';
import {CaseAppointmentsService} from '../../../core/base/services/case-appointments.service';
import {GroupWorkspaceContextService} from '../../../core/base/services/group-workspace-context.service';
import {UserProfileStore} from './user-profile.store';
import {EventCheckoutSlotPickerStore} from './event-checkout-slot-picker.store';
import type {CaseAppointment} from '../../../core/contracts/case-appointment.interface';
import type {CommunityCase,CaseSupport} from '../../../core/contracts/community-case.interface';
import type {EventCheckoutBasket,EventCheckoutSlot} from '../../../core/contracts/activity.interface';
@Injectable({providedIn:'root'})
export class CaseAppointmentsStore {
 private readonly service=inject(CaseAppointmentsService);
 private readonly picker=inject(EventCheckoutSlotPickerStore);private readonly profile=inject(UserProfileStore);private readonly workspace=inject(GroupWorkspaceContextService);
 readonly changed=signal<CaseAppointment[]|null>(null);readonly error=signal('');readonly busy=signal(false);
 private generation=0;private pickerId:number|null=null;private identity=this.profile.activeUserId();
 constructor(){effect(()=>{const identity=this.profile.activeUserId();if(identity===this.identity)return;this.identity=identity;this.generation++;if(this.pickerId===this.picker.popup()?.id)this.picker.close();this.pickerId=null;this.error.set('');this.busy.set(false);});}
 async open(c:CommunityCase,support:CaseSupport):Promise<void>{if(!support.serviceId||support.status!=='accepted'||this.busy())return;
  const gen=++this.generation,userId=this.profile.activeUserId();this.busy.set(true);this.error.set('');
  try {const initial=await this.service.slots(c.id,support.serviceId,support.accountId,{userId,eventId:c.id,limit:15});if(gen!==this.generation)return;const s=initial.service;
   const upcoming=initial.appointments.filter(a=>Date.parse(a.startAtIso)>Date.now()),basket=this.basket(userId,c.id,upcoming);
   let operationId='',selection='';
   const state=this.picker.open({userId,zIndex:16000,record:{id:c.id,title:c.title,timeframe:s.title,startAtIso:s.startAtIso!,endAtIso:s.endAtIso!,pricing:s.pricing,
    upcomingSlots:[...upcoming.map(a=>this.slot(a,s.title)),...initial.result.slots].map(slot=>({...slot,slotTemplateId:slot.slotTemplateId??'',title:slot.title??s.title,timeframe:slot.timeframe??''}))},checkoutBasket:basket,
    selectionAdapter:{loadSlots:async q=>{const page=await this.service.slots(c.id,s.id,support.accountId,q);if(gen!==this.generation)throw new DOMException('Closed','AbortError');
      return {...page.result,checkoutBasket:this.basket(userId,c.id,page.appointments.filter(a=>Date.parse(a.startAtIso)>Date.now()))};},
     saveSlots:async slotIds=>{const signature=[...slotIds].sort().join('|');if(!operationId||signature!==selection){operationId=crypto.randomUUID();selection=signature;}
      const saved=await this.service.save(c.id,{userId,serviceId:s.id,providerAccountId:support.accountId,slotIds,version:initial.version,operationId});
      if(gen===this.generation)this.changed.set(saved.appointments);}}});
   this.pickerId=state?.id??null;
  }catch{if(gen===this.generation)this.error.set('case.appointments.failed');}finally{if(gen===this.generation)this.busy.set(false);}
 }
 private slot(a:CaseAppointment,title:string):EventCheckoutSlot{return {id:a.slotId,parentEventId:a.caseId,slotSourceId:a.slotId,slotTemplateId:a.slotTemplateId,title,timeframe:`${a.startAtIso} – ${a.endAtIso}`,startAtIso:a.startAtIso,endAtIso:a.endAtIso,capacityTotal:1,acceptedMembers:1,pendingMembers:0,availableSlots:0,bookedByViewer:true,amount:a.amount,currency:a.currency,pricingSummaryRows:a.pricingSummaryRows};}
 private basket(userId:string,caseId:string,appointments:CaseAppointment[]):EventCheckoutBasket{return {userId,sourceId:caseId,status:'confirmed',currency:appointments[0]?.currency??'USD',totalAmount:appointments.reduce((n,a)=>n+a.amount,0),pricingSummaryRows:[],lineItems:[],appliedPromoCodes:[],items:appointments.map(a=>({id:a.id,kind:'event',sourceId:caseId,slotSourceId:a.slotId,slotTemplateId:a.slotTemplateId,selectedDateKey:a.startAtIso.slice(0,10),label:'case.appointments',detail:`${a.startAtIso} – ${a.endAtIso}`,amount:a.amount,currency:a.currency,quantity:1,status:'confirmed',resultState:'pending',pricingSummaryRows:a.pricingSummaryRows,createdAtIso:a.createdAtIso,updatedAtIso:a.updatedAtIso}))};}
}

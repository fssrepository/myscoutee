import { LocalCommunityCasesRepository } from '../repositories/community-cases.repository';
import { activeCaseParticipantIds } from '../entity/community-case.entity';
import {PricingBuilder} from '../../../base/builders/pricing.builder';
import { Injectable,inject } from '@angular/core';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalCaseAppointmentsRepository } from '../repositories/case-appointments.repository';
import { LocalServiceOfferingsRepository } from '../repositories/service-offerings.repository';
import { LocalCommunityCasesService } from './community-cases.service';
import { LocalCommunityAccessService } from './community-access.service';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalEventsService } from './events.service';
import { LocalActivityEventsMapper } from '../mappers/event.mapper';
import type { CaseAppointment,CaseAppointmentCalendarEntry,CaseAppointmentSelection,ICaseAppointmentsService,ServiceProviderCalendar } from '../../../contracts/case-appointment.interface';
import type { ServiceOffering } from '../../../contracts/service-offering.interface';
import type { EventCheckoutSlotsQuery,EventCheckoutSlot } from '../../../contracts/activity.interface';
interface Occurrence {id:string;templateId:string;start:Date;end:Date;}
@Injectable({providedIn:'root'})
export class LocalCaseAppointmentsService extends LocalRouteDelayService implements ICaseAppointmentsService {
 private readonly caseRecords=inject(LocalCommunityCasesRepository);
 private readonly users=inject(LocalUsersRepository);
 private readonly repository=inject(LocalCaseAppointmentsRepository);private readonly offerings=inject(LocalServiceOfferingsRepository);
 private readonly cases=inject(LocalCommunityCasesService);private readonly access=inject(LocalCommunityAccessService);private readonly events=inject(LocalEventsService);
 private async context(userId:string,caseId:string,serviceId:string,provider:string){
  await this.waitForRouteDelay('/community-cases');await this.repository.ready();const actor=this.access.actor(userId),c=this.cases.visible(actor,caseId),s=this.offerings.find(serviceId);
  if(!s||!c.participantAccountIds.includes(actor)||c.support.some(v=>v.accountId===actor&&v.status==='declined'&&!c.audienceAccountIds.includes(actor)&&c.ownerAccountId!==actor)
   ||!c.support.some(v=>v.accountId===provider&&v.serviceId===serviceId))throw new Error('Forbidden');
  return {actor,c,s,calendar:this.repository.find(provider)};
 }
 private bookable(c:import('../entity/community-case.entity').CommunityCaseRecord,s:ServiceOffering,provider:string){return ['open','in-progress'].includes(c.status)&&s.status==='published'&&s.slotsEnabled&&s.staffAccountIds.includes(provider)&&c.support.some(v=>v.accountId===provider&&v.serviceId===s.id&&v.status==='accepted');}
 private owns(a:CaseAppointment,actor:string,caseId:string,serviceId:string){return a.customerAccountId===actor&&a.caseId===caseId&&a.serviceId===serviceId;}
 private range(from:string,to:string){const start=new Date(`${from}T00:00:00.000Z`),end=new Date(`${to}T23:59:59.999Z`);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start||end.getTime()-start.getTime()>93*86400000)throw new Error('Invalid range');return {start,end};}
 private occurrences(s:ServiceOffering,start:Date,end:Date):Occurrence[]{
  const windowStart=new Date(s.startAtIso!),windowEnd=new Date(s.endAtIso!),overrides=new Set(s.slotTemplates.filter(t=>t.overrideDate).map(t=>t.overrideDate!.slice(0,10))),rows:Occurrence[]=[];
  for(const t of s.slotTemplates){if(t.closed)continue;const template=new Date(t.startAt!);
   for(const date of LocalActivityEventsMapper.generateSlotOccurrenceStarts(t.overrideDate?'One-time':s.frequency,template,start,end,true)){
    const anchor=new Date(date.getTime()-(template.getTime()-windowStart.getTime())).toISOString().slice(0,10);
    if(!t.overrideDate&&overrides.has(anchor))continue;const finish=new Date(date.getTime()+s.durationMinutes*60000);
    if(date<windowStart||finish>windowEnd)continue;
    rows.push({id:`${s.id}:slot:${t.id}:${date.toISOString().replace('.000Z','Z')}`,templateId:t.id,start:date,end:finish});
   }
  }return rows.sort((a,b)=>a.start.getTime()-b.start.getTime()||a.id.localeCompare(b.id));
 }
 private overlaps(a:CaseAppointment,o:Occurrence){return Date.parse(a.startAtIso)<o.end.getTime()&&Date.parse(a.endAtIso)>o.start.getTime();}
 private price(s:ServiceOffering,o:Occurrence,occupied:number){const quote=this.events.resolveCheckoutSlotPricing(s,{id:o.id,parentEventId:s.id,slotTemplateId:o.templateId,title:s.title,timeframe:'',startAtIso:o.start.toISOString(),endAtIso:o.end.toISOString(),capacityTotal:1,acceptedMembers:occupied,pendingMembers:0});return {...quote,amount:PricingBuilder.applyPricingRounding(quote.amount,s.pricing?.rounding??'none')};}
 async slots(caseId:string,serviceId:string,provider:string,q:EventCheckoutSlotsQuery){const x=await this.context(q.userId,caseId,serviceId,provider),{actor,c,s,calendar}=x;
  const from=q.rangeStart??new Date().toISOString().slice(0,10),to=q.rangeEnd??new Date(Date.parse(`${from}T00:00:00Z`)+31*86400000).toISOString().slice(0,10),range=this.range(from,to);
  const own=calendar.appointments.filter(a=>this.owns(a,actor,caseId,serviceId)&&a.status==='booked');
  const rows:EventCheckoutSlot[]=q.view==='basket'||!this.bookable(c,s,provider)?own.filter(a=>Date.parse(a.startAtIso)>Date.now()).map(a=>({id:a.slotId,parentEventId:caseId,slotSourceId:a.slotId,slotTemplateId:a.slotTemplateId,title:s.title,timeframe:`${a.startAtIso} – ${a.endAtIso}`,startAtIso:a.startAtIso,endAtIso:a.endAtIso,capacityTotal:1,acceptedMembers:1,pendingMembers:0,availableSlots:0,bookedByViewer:true,amount:a.amount,currency:a.currency,pricingSummaryRows:a.pricingSummaryRows})):
   this.occurrences(s,range.start,range.end).map(o=>{const overlaps=calendar.appointments.filter(a=>a.status==='booked'&&this.overlaps(a,o)),quote=this.price(s,o,overlaps.length?1:0);
    return {id:o.id,parentEventId:caseId,slotSourceId:o.id,slotTemplateId:o.templateId,title:s.title,timeframe:`${o.start.toISOString()} – ${o.end.toISOString()}`,startAtIso:o.start.toISOString(),endAtIso:o.end.toISOString(),capacityTotal:1,acceptedMembers:overlaps.length?1:0,pendingMembers:0,availableSlots:!overlaps.length&&o.start.getTime()>Date.now()?1:0,bookedByViewer:overlaps.some(a=>this.owns(a,actor,caseId,serviceId)&&a.slotId===o.id),amount:quote.amount,currency:quote.currency,pricingSummaryRows:quote.rows};});
  const days=new Map<string,EventCheckoutSlot[]>();rows.forEach(s=>days.set(s.startAtIso.slice(0,10),[...(days.get(s.startAtIso.slice(0,10))??[]),s]));
  const offset=Number(q.cursor??0),limit=Math.max(1,Math.min(100,q.limit??20));if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid cursor');const end=offset+limit,currency=s.pricing?.currency??'USD';
  return {service:structuredClone(s),version:calendar.version,appointments:own,result:{eventId:caseId,mode:'service',slots:rows.slice(offset,end),total:rows.length,nextCursor:end<rows.length?`${end}`:null,currency,optionalSubEvents:[],checkoutBasket:null,
   days:[...days].map(([dateKey,slots])=>({dateKey,slotCount:slots.length,availableSlots:slots.filter(s=>s.availableSlots>0).length,bookedByViewer:slots.some(s=>s.bookedByViewer),lowestAmount:Math.min(...slots.map(s=>s.amount)),currency}))}};
 }
 async save(caseId:string,r:CaseAppointmentSelection){if(!r.operationId||r.operationId.length>100||r.slotIds.length>50)throw new Error('Invalid selection');
  const {actor,c,s,calendar}=await this.context(r.userId,caseId,r.serviceId,r.providerAccountId);
  if(!c.audienceAccountIds.includes(actor)&&c.ownerAccountId!==actor)throw new Error('Forbidden');
  const ids=[...new Set(r.slotIds)].sort(),signature=`${actor}:${caseId}:${r.serviceId}:${ids.join('|')}`;
  if(calendar.lastOperationId===r.operationId){if(calendar.lastOperationSignature!==signature)throw new Error('Conflict');this.cases.notify(c,actor,'appointments-updated',r.operationId);return this.saved(calendar,actor,caseId,r.serviceId);}
  if(calendar.version!==r.version)throw new Error('case.appointments.changed');
  const now=new Date().toISOString(),rows=new Map(calendar.appointments.map(a=>[a.id,a])),selected:CaseAppointment[]=[];
  for(const id of ids){const previous=calendar.appointments.find(a=>this.owns(a,actor,caseId,r.serviceId)&&a.slotId===id&&a.status==='booked'&&Date.parse(a.startAtIso)>Date.now());if(previous){selected.push(previous);continue;}
   if(!this.bookable(c,s,r.providerAccountId))throw new Error('Unavailable slot');const iso=id.match(/:(\d{4}-\d{2}-\d{2}T.*Z)$/)?.[1];if(!iso)throw new Error('Invalid slot');const date=new Date(iso),day=date.toISOString().slice(0,10),range=this.range(day,day);
   const o=this.occurrences(s,range.start,range.end).find(o=>o.id===id);if(!o||o.start.getTime()<=Date.now())throw new Error('Unavailable slot');
   if(calendar.appointments.some(a=>a.status==='booked'&&!this.owns(a,actor,caseId,r.serviceId)&&this.overlaps(a,o))||selected.some(a=>this.overlaps(a,o)))throw new Error('Unavailable slot');
   const old=calendar.appointments.find(a=>this.owns(a,actor,caseId,r.serviceId)&&a.slotId===id&&a.status==='booked');if(old){selected.push(old);continue;}
   const quote=this.price(s,o,0);selected.push({id:crypto.randomUUID(),caseId,serviceId:r.serviceId,providerAccountId:r.providerAccountId,customerAccountId:actor,slotId:id,slotTemplateId:o.templateId,startAtIso:o.start.toISOString(),endAtIso:o.end.toISOString(),status:'booked',amount:quote.amount,currency:quote.currency,pricingSummaryRows:quote.rows,createdAtIso:now,updatedAtIso:now});
  }
  for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++)if(Date.parse(selected[i].startAtIso)<Date.parse(selected[j].endAtIso)&&Date.parse(selected[i].endAtIso)>Date.parse(selected[j].startAtIso))throw new Error('Unavailable slot');
  for(const old of calendar.appointments)if(this.owns(old,actor,caseId,r.serviceId)&&old.status==='booked'&&Date.parse(old.startAtIso)>Date.now()&&!ids.includes(old.slotId))rows.set(old.id,{...old,status:'cancelled',updatedAtIso:now});
  selected.forEach(a=>rows.set(a.id,a));const saved=this.repository.save({...calendar,appointments:[...rows.values()],lastOperationId:r.operationId,lastOperationSignature:signature},r.version);
  this.cases.notify(c,actor,'appointments-updated',r.operationId);await this.repository.flush();return this.saved(saved,actor,caseId,r.serviceId);
 }
 private saved(c:ServiceProviderCalendar,actor:string,caseId:string,serviceId:string){return {version:c.version,appointments:c.appointments.filter(a=>this.owns(a,actor,caseId,serviceId)&&a.status==='booked')};}
 async calendar(userId:string,rangeStart:string,rangeEnd:string):Promise<CaseAppointmentCalendarEntry[]> {
  await this.repository.ready();const actor=this.access.actor(userId),range=this.range(rangeStart,rangeEnd);
  const cases=this.caseRecords.cases(),byId=new Map(cases.map(c=>[c.id,c]));
  const appointments:CaseAppointmentCalendarEntry[]=this.repository.find(actor).appointments.filter(a=>a.status==='booked'&&Date.parse(a.startAtIso)<range.end.getTime()&&Date.parse(a.endAtIso)>range.start.getTime()&&!!byId.get(a.caseId)&&activeCaseParticipantIds(byId.get(a.caseId)!).includes(actor))
    .map(a=>({appointment:a,caseId:a.caseId,task:null,caseTitle:byId.get(a.caseId)!.title,serviceTitle:this.offerings.find(a.serviceId)?.title??'',customerName:this.users.queryUserById(a.customerAccountId)?.name??''}));
  for(const c of cases){
   if(['cancelled','trash'].includes(c.status)||!activeCaseParticipantIds(c).includes(actor))continue;
   for(const task of c.boardTasks??[]){
    if(task.status==='deleted'||!task.assigneeAccountIds.includes(actor)||!task.startAtIso)continue;
    const start=Date.parse(task.startAtIso),end=task.endAtIso?Date.parse(task.endAtIso):start;
    if(start<range.end.getTime()&&(end>range.start.getTime()||start>=range.start.getTime()))appointments.push({appointment:null,caseId:c.id,task,caseTitle:c.title,serviceTitle:task.title,customerName:''});
   }
  }
  return appointments.sort((a,b)=>(a.task?.startAtIso??a.appointment!.startAtIso).localeCompare(b.task?.startAtIso??b.appointment!.startAtIso));
 }
 async cancel(userId:string,caseId:string,provider:string,appointmentId:string){await this.repository.ready();const actor=this.access.actor(userId),c=this.cases.visible(actor,caseId),calendar=this.repository.find(provider),a=calendar.appointments.find(v=>v.id===appointmentId&&v.caseId===caseId);
  if(!a||actor!==provider&&actor!==a.customerAccountId&&!this.cases.canManage(c,actor))throw new Error('Forbidden');
  if(a.status!=='cancelled')this.repository.save({...calendar,lastOperationId:null,lastOperationSignature:null,appointments:calendar.appointments.map(v=>v.id===a.id?{...v,status:'cancelled',updatedAtIso:new Date().toISOString()}:v)},calendar.version);
  this.cases.notify(c,actor,'appointments-updated',`cancel:${a.id}`);await this.repository.flush();}

}

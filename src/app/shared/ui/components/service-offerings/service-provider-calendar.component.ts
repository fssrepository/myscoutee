import {
  UiDateUtils,
  SmartListComponent,
  SingleRowComponent,
  type SingleRowData,
  type SmartListConfig,
  type SmartListLoadPage,
  type SmartListItemSelectEvent,
  ExplanationGuideService,
  type AppMenuItemSelectEvent
} from '@fssrepository/myscoutee-components';
import { Component, ViewChild, inject, effect, untracked, input, computed } from '@angular/core';
import {defer,map} from 'rxjs';

import {ServiceOfferingsStore} from '../../context/stores/services/service-offerings.store';
import {AppUtils} from '../../../core/base/app-utils';
import {CommunityCaseConverter} from '../../converters/community/community-case.converter';
import {CommunityCasesStore} from '../../context/stores/community/community-cases.store';

import type {CaseAppointmentCalendarEntry} from '../../../core/contracts/community/case-appointment.interface';

@Component({selector:'app-service-provider-calendar',standalone:true,host:{style:'display: contents'},imports:[SmartListComponent,SingleRowComponent],template:`
 <app-smart-list #list data-guide-field="provider-calendar" [config]="config" [query]="query()" [loadPage]="load" [itemTemplate]="row" (itemSelect)="select($event)" (menuItemSelect)="action($event)"></app-smart-list>
 <ng-template #row let-row let-openMenu="openMenu"><single-row [row]="row" [useSharedMenu]="true" (menuRequest)="openMenu($event)"></single-row></ng-template>`})
export class ServiceProviderCalendarComponent {
 protected readonly store=inject(ServiceOfferingsStore);private readonly cases=inject(CommunityCasesStore);private readonly guide=inject(ExplanationGuideService);
 @ViewChild('list')private list?:SmartListComponent<SingleRowData<CaseAppointmentCalendarEntry>>;
 readonly view=input<string>('week');
 protected readonly query=computed(()=>({view:this.view()}));
 protected readonly config:SmartListConfig<SingleRowData<CaseAppointmentCalendarEntry>>={pageSize:200,defaultView:'week',presentation:'list',views:[{key:'day',label:'day',mode:'list'},{key:'week',label:'week',mode:'week'},{key:'month',label:'month',mode:'month'}],
  trackBy:(_,r)=>r.id,cacheable:{identity:r=>r.id},calendar:{resolveDateRange:r=>({start:new Date(r.eagerDetail!.task?.startAtIso ?? r.eagerDetail!.appointment!.startAtIso),end:new Date(r.eagerDetail!.task?.endAtIso ?? r.eagerDetail!.task?.startAtIso ?? r.eagerDetail!.appointment!.endAtIso)}),badgeLabel:r=>r.title,badgeColors:{palette:CommunityCaseConverter.calendarColors,resolveKey:r=>CommunityCaseConverter.calendarColorKey(r.eagerDetail!.caseStatus,r.eagerDetail!.caseType)},badgeToneClass:r=>`calendar-badge-tone-${AppUtils.hashText(r.id)%8+1}`},
  groupBy:r=>UiDateUtils.smartListDayLabel(new Date(r.eagerDetail!.task?.startAtIso ?? r.eagerDetail!.appointment!.startAtIso)),showFirstGroupMarker:false,
  sortable:{sortKey:r=>[r.eagerDetail!.task?.startAtIso ?? r.eagerDetail!.appointment!.startAtIso,r.id]},
  menuItems:c=>c.item?.eagerDetail?[{id:'case',label:'case.view',icon:'article',palette:'blue',surface:'tinted',context:c.item.eagerDetail},...(c.item.eagerDetail.appointment?[{id:'cancel',label:'case.appointments.cancel',icon:'event_busy',palette:'danger' as const,surface:'tinted' as const,context:c.item.eagerDetail}]:[])]:[]};
 protected readonly load:SmartListLoadPage<SingleRowData<CaseAppointmentCalendarEntry>>=q=>{const today=new Date().toISOString().slice(0,10),from=q.rangeStart??q.anchorDate??today,to=q.rangeEnd??from;
  return defer(()=>this.store.calendar(from,to)).pipe(map(rows=>({items:rows.map(entry=>({id:entry.task?`${entry.caseId}:${entry.task.id}`:entry.appointment!.id,title:entry.caseTitle,subtitle:[entry.serviceTitle,entry.customerName].filter(Boolean).join(' · '),detail:new Date(entry.task?.startAtIso ?? entry.appointment!.startAtIso).toLocaleString(),icon:'event_available',eagerDetail:entry})),total:rows.length})));};
 constructor(){effect(onCleanup=>onCleanup(untracked(() => this.guide.registerContext('community.service.calendar'))));effect(()=>{const id=this.store.calendarCancelled();if(id)untracked(() => this.list?.removeVisibleItemByIdentity(id));});}
 protected action(e:AppMenuItemSelectEvent):void{const entry=e.context as CaseAppointmentCalendarEntry,a=entry.appointment;
  if(e.id==='cancel'&&a)void this.store.cancelAppointment(entry,e.item);else this.openCase(entry);}
 protected select(event:SmartListItemSelectEvent<SingleRowData<CaseAppointmentCalendarEntry>>):void{
  if((event.currentViewMode==='week'||event.currentViewMode==='month')&&event.item.eagerDetail)this.openCase(event.item.eagerDetail);}
 private openCase(entry:CaseAppointmentCalendarEntry):void{this.store.close();void this.cases.openReference(entry.caseId);}
}

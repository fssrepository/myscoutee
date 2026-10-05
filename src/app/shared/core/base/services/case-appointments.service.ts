import {Injectable,inject} from '@angular/core';
import {BaseRouteModeService} from './base-route-mode.service';
import {LocalCaseAppointmentsService} from '../../local/source/services/case-appointments.service';
import {HttpCaseAppointmentsService} from '../../http/services/case-appointments.service';
import type {CaseAppointmentSelection,ICaseAppointmentsService} from '../../contracts/case-appointment.interface';
import type {EventCheckoutSlotsQuery} from '../../contracts/activity.interface';
@Injectable({providedIn:'root'})
export class CaseAppointmentsService extends BaseRouteModeService implements ICaseAppointmentsService {
 private readonly local=inject(LocalCaseAppointmentsService);private readonly http=inject(HttpCaseAppointmentsService);
 private get adapter():ICaseAppointmentsService{return this.resolveRouteService('/community-cases',this.local,this.http);}
 slots(caseId:string,serviceId:string,providerAccountId:string,q:EventCheckoutSlotsQuery){return this.adapter.slots(caseId,serviceId,providerAccountId,q);}
 save(caseId:string,r:CaseAppointmentSelection){return this.adapter.save(caseId,r);}
 cancel(userId:string,caseId:string,providerAccountId:string,appointmentId:string){return this.adapter.cancel(userId,caseId,providerAccountId,appointmentId);}
 calendar(userId:string,rangeStart:string,rangeEnd:string){return this.adapter.calendar(userId,rangeStart,rangeEnd);}
}

import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import {Injectable,inject} from '@angular/core';
import {BaseRouteModeService} from '../platform/base-route-mode.service';

import type {CaseAppointmentSelection,ICaseAppointmentsService} from '../../../contracts/community/case-appointment.interface';
import type {EventCheckoutSlotsQuery} from '../../../contracts/common/activity.interface';
@Injectable({providedIn:'root'})
export class CaseAppointmentsService extends BaseRouteModeService implements ICaseAppointmentsService {
  private readonly transportAdapters = inject(AdapterProxyService);
 private readonly local=this.transportAdapters.reference(LOCAL_ADAPTER.CASE_APPOINTMENTS);private readonly http=this.transportAdapters.reference(HTTP_ADAPTER.CASE_APPOINTMENTS);
 private get adapter():ICaseAppointmentsService{return this.resolveRouteService('/community-cases',this.local,this.http);}
 slots(caseId:string,serviceId:string,providerAccountId:string,q:EventCheckoutSlotsQuery){return this.adapter.slots(caseId,serviceId,providerAccountId,q);}
 save(caseId:string,r:CaseAppointmentSelection){return this.adapter.save(caseId,r);}
 cancel(userId:string,caseId:string,providerAccountId:string,appointmentId:string){return this.adapter.cancel(userId,caseId,providerAccountId,appointmentId);}
 calendar(userId:string,rangeStart:string,rangeEnd:string){return this.adapter.calendar(userId,rangeStart,rangeEnd);}
}

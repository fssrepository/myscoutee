import {Injectable,inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {environment} from '../../../../../environments/environment';
import type {CaseAppointmentCalendarEntry,CaseAppointment,CaseAppointmentSelection,CaseAppointmentSlots,SavedCaseAppointments,ICaseAppointmentsService} from '../../contracts/case-appointment.interface';
import type {EventCheckoutSlotsQuery} from '../../contracts/activity.interface';
@Injectable({providedIn:'root'})
export class HttpCaseAppointmentsService implements ICaseAppointmentsService {
 private readonly http=inject(HttpClient);private readonly base=environment.apiBaseUrl??'/api';
 slots(caseId:string,serviceId:string,providerAccountId:string,q:EventCheckoutSlotsQuery){const params:Record<string,string|number>={serviceId,providerAccountId};for(const [k,v]of Object.entries(q))if(v!=null&&k!=='eventId')params[k]=v;
  return firstValueFrom(this.http.get<CaseAppointmentSlots>(`${this.base}/community-cases/${encodeURIComponent(caseId)}/appointments`,{params}));}
 save(caseId:string,r:CaseAppointmentSelection){return firstValueFrom(this.http.post<SavedCaseAppointments>(`${this.base}/community-cases/${encodeURIComponent(caseId)}/appointments`,r));}
 cancel(userId:string,caseId:string,providerAccountId:string,appointmentId:string){return firstValueFrom(this.http.post<void>(`${this.base}/community-cases/${encodeURIComponent(caseId)}/appointments/${encodeURIComponent(appointmentId)}/cancel`,{userId,providerAccountId}));}
 calendar(userId:string,rangeStart:string,rangeEnd:string){return firstValueFrom(this.http.get<CaseAppointmentCalendarEntry[]>(`${this.base}/service-offerings/calendar`,{params:{userId,rangeStart,rangeEnd}}));}
}

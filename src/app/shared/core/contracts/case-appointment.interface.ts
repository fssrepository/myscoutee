import type { CaseBoardTask } from './community-case.interface';
import type { ServiceOffering } from './service-offering.interface';
import type { EventCheckoutPricingSummaryRow, EventCheckoutSlotsQuery, EventCheckoutSlotsResult } from './activity.interface';
export interface CaseAppointment {
 id:string;caseId:string;serviceId:string;providerAccountId:string;customerAccountId:string;
 slotId:string;slotTemplateId:string;startAtIso:string;endAtIso:string;status:'booked'|'cancelled';
 amount:number;currency:string;pricingSummaryRows:EventCheckoutPricingSummaryRow[];createdAtIso:string;updatedAtIso:string;
}
export interface CaseAppointmentCalendarEntry {appointment:CaseAppointment|null;caseId:string;task:CaseBoardTask|null;caseTitle:string;serviceTitle:string;customerName:string;}
export interface ServiceProviderCalendar {id:string;appointments:CaseAppointment[];lastOperationId:string|null;lastOperationSignature:string|null;version:number|null;}
export interface CaseAppointmentSelection {userId:string;serviceId:string;providerAccountId:string;slotIds:string[];version:number|null;operationId:string;}
export interface CaseAppointmentSlots {service:ServiceOffering;result:EventCheckoutSlotsResult;version:number|null;appointments:CaseAppointment[];}
export interface SavedCaseAppointments {version:number|null;appointments:CaseAppointment[];}
export interface ICaseAppointmentsService {
 slots(caseId:string,serviceId:string,providerAccountId:string,query:EventCheckoutSlotsQuery):Promise<CaseAppointmentSlots>;
 save(caseId:string,request:CaseAppointmentSelection):Promise<SavedCaseAppointments>;
 calendar(userId:string,rangeStart:string,rangeEnd:string):Promise<CaseAppointmentCalendarEntry[]>;
 cancel(userId:string,caseId:string,providerAccountId:string,appointmentId:string):Promise<void>;
}

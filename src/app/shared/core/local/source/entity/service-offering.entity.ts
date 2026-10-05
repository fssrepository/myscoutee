import type { ServiceProviderCalendar } from '../../../contracts/case-appointment.interface';
import type { ServiceOffering } from '../../../contracts/service-offering.interface';
export const SERVICE_PROVIDER_CALENDARS_TABLE_NAME = 'serviceProviderCalendars' as const;
export const SERVICE_OFFERINGS_TABLE_NAME = 'serviceOfferings' as const;
export interface ServiceOfferingsMemorySchema {
  [SERVICE_PROVIDER_CALENDARS_TABLE_NAME]: {ids:string[];byId:Record<string,ServiceProviderCalendar>};
  [SERVICE_OFFERINGS_TABLE_NAME]: { ids: string[]; byId: Record<string, ServiceOffering> };
}

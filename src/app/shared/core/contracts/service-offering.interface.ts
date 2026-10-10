import type { ListQuery, PageResult } from '@fssrepository/myscoutee-components';
import type { PricingConfig } from './pricing.interface';
import type { EventSlotTemplateDTO } from './event.interface';
export const SERVICE_CATEGORIES = ['maintenance','plumbing','electrical','cleaning','renovation','fitness','education','other'] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];
export type ServiceStatus = 'draft' | 'published' | 'trash';
export type ServiceAction = 'publish' | 'unpublish' | 'trash' | 'restore';
export const SERVICE_FREQUENCIES = ['One-time','Daily','Weekly','Bi-weekly','Monthly','Yearly'] as const;
export interface ServiceOfferingFields {
  title: string; description: string; sourceLink?: string; category: ServiceCategory; imageUrls: string[];
  maxDistanceKm: number | null; languages: string[]; staffAccountIds: string[];
  slotsEnabled: boolean; startAtIso: string | null; endAtIso: string | null; frequency: string;
  durationMinutes: number; slotTemplates: EventSlotTemplateDTO[]; pricing: PricingConfig | null;
}
export interface ServiceOffering extends ServiceOfferingFields {
  id: string; baseGroupId: string; ownerAccountId: string; status: ServiceStatus;
  createdAtIso: string; updatedAtIso: string; version: number;
}
export interface ServiceOfferingItem {
  service: ServiceOffering; ownerUserId: string; ownerName: string; ownerAvatarUrl: string | null;
  distanceKm: number | null; viewerRating: number; canManage: boolean;
}
export interface SaveServiceOffering extends ServiceOfferingFields { userId: string; id?: string; version?: number; }
export interface ServiceOfferingFilters { serviceIds?: string[]; scope?: 'own' | 'discover' | 'all'; status?: ServiceStatus; category?: ServiceCategory | null; search?: string; maxDistanceKm?: number | null; }
export interface IServiceOfferingsService {
  page(userId: string, query: ListQuery<ServiceOfferingFilters>, signal?: AbortSignal): Promise<PageResult<ServiceOfferingItem>>;
  detail(userId: string, id: string, signal?: AbortSignal): Promise<ServiceOfferingItem>;
  save(request: SaveServiceOffering): Promise<ServiceOfferingItem>;
  action(userId: string, id: string, action: ServiceAction, version: number): Promise<ServiceOfferingItem>;
}

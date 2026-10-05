import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { LocalServiceOfferingsService } from '../../local/source/services/service-offerings.service';
import { HttpServiceOfferingsService } from '../../http/services/service-offerings.service';
import type { IServiceOfferingsService, ServiceOfferingFilters, SaveServiceOffering, ServiceAction } from '../../contracts/service-offering.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({providedIn:'root'})
export class ServiceOfferingsService extends BaseRouteModeService implements IServiceOfferingsService {
  private readonly local=inject(LocalServiceOfferingsService);
  private readonly http=inject(HttpServiceOfferingsService);
  private get adapter():IServiceOfferingsService{return this.resolveRouteService('/service-offerings',this.local,this.http);}
  page(userId:string,query:ListQuery<ServiceOfferingFilters>,signal?:AbortSignal){return this.adapter.page(userId,query,signal);}
  detail(userId:string,id:string,signal?:AbortSignal){return this.adapter.detail(userId,id,signal);}
  save(r:SaveServiceOffering){return this.adapter.save(r);}
  action(userId:string,id:string,action:ServiceAction,version:number){return this.adapter.action(userId,id,action,version);}
}

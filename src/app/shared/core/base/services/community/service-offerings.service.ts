import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { IServiceOfferingsService, ServiceOfferingFilters, SaveServiceOffering, ServiceAction } from '../../../contracts/community/service-offering.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({providedIn:'root'})
export class ServiceOfferingsService extends BaseRouteModeService implements IServiceOfferingsService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly local=this.transportAdapters.reference(LOCAL_ADAPTER.SERVICE_OFFERINGS);
  private readonly http=this.transportAdapters.reference(HTTP_ADAPTER.SERVICE_OFFERINGS);
  private get adapter():IServiceOfferingsService{return this.resolveRouteService('/service-offerings',this.local,this.http);}
  page(userId:string,query:ListQuery<ServiceOfferingFilters>,signal?:AbortSignal){return this.adapter.page(userId,query,signal);}
  detail(userId:string,id:string,signal?:AbortSignal){return this.adapter.detail(userId,id,signal);}
  save(r:SaveServiceOffering){return this.adapter.save(r);}
  action(userId:string,id:string,action:ServiceAction,version:number){return this.adapter.action(userId,id,action,version);}
}
